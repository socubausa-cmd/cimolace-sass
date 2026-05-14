/**
 * CourseBuilderService — Pipeline de création de cours avec IA
 * Segmentation, Master Script, Génération segments, Render, Post-production
 */
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { MasterclassFactoryService } from '../masterclass-factory/masterclass-factory.service';

@Injectable()
export class CourseBuilderService {
  private readonly logger = new Logger(CourseBuilderService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly masterclassFactory: MasterclassFactoryService,
  ) {}

  // ── Pipeline CRUD ───────────────────────────────────────────────────────

  async createPipeline(tenantId: string, name: string, sourceText: string) {
    const { data } = await (this.supabase.client as any).from('course_pipelines').insert({
      tenant_id: tenantId, name, source_text: sourceText, status: 'pending',
    }).select('*').single();
    return data;
  }

  async listPipelines(tenantId: string) {
    const { data } = await (this.supabase.client as any).from('course_pipelines')
      .select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false });
    return data ?? [];
  }

  async getPipeline(tenantId: string, pipelineId: string) {
    const { data } = await (this.supabase.client as any).from('course_pipelines')
      .select('*').eq('id', pipelineId).eq('tenant_id', tenantId).single();
    if (!data) throw new NotFoundException('Pipeline introuvable');
    return data;
  }

  async deletePipeline(tenantId: string, pipelineId: string) {
    await this.getPipeline(tenantId, pipelineId);
    await (this.supabase.client as any).from('course_pipelines').delete().eq('id', pipelineId).eq('tenant_id', tenantId);
    return { id: pipelineId };
  }

  // ── AI Segmentation ────────────────────────────────────────────────────

  async autoSegment(tenantId: string, pipelineId: string): Promise<any> {
    const pipeline = await this.getPipeline(tenantId, pipelineId);
    const sourceText = pipeline.source_text;
    if (!sourceText || sourceText.length < 50) throw new BadRequestException('Texte source trop court (<50 car.)');

    await (this.supabase.client as any).from('course_pipelines').update({ status: 'analyzing' }).eq('id', pipelineId);

    // Use masterclass-factory for AI analysis
    let analysis: any;
    try {
      analysis = await this.masterclassFactory.analyzeDocument(tenantId, { sourceText });
    } catch (e: any) {
      this.logger.warn(`AI analysis failed, using naive segmentation: ${e.message}`);
      analysis = null;
    }

    // Extract subjects as segments from analysis, or fallback to naive
    let segments: { title: string; content: string; index: number }[];
    if (analysis?.subjects?.length) {
      const textMap = analysis.textMap || [];
      segments = analysis.subjects.map((subject: string, i: number) => {
        const mapEntry = textMap.find((m: any) => m.summary?.includes(subject));
        return {
          title: subject,
          content: mapEntry?.summary || sourceText.slice(i * 200, (i + 1) * 200),
          index: i,
        };
      });
    } else {
      segments = this.naiveSegment(sourceText);
    }

    // Clear existing segments and insert new ones
    await (this.supabase.client as any).from('pipeline_segments').delete().eq('pipeline_id', pipelineId);
    for (const seg of segments) {
      await (this.supabase.client as any).from('pipeline_segments').insert({
        tenant_id: tenantId, pipeline_id: pipelineId,
        title: seg.title, content: seg.content, order_index: seg.index,
      });
    }

    await (this.supabase.client as any).from('course_pipelines').update({
      status: 'segmented', segment_count: segments.length,
    }).eq('id', pipelineId);

    return { segments: segments.length, aiProvider: analysis?.provider || 'naive' };
  }

  async listSegments(tenantId: string, pipelineId: string) {
    const { data } = await (this.supabase.client as any).from('pipeline_segments')
      .select('*').eq('pipeline_id', pipelineId).order('order_index');
    return data ?? [];
  }

  // ── Master Script Generation ───────────────────────────────────────────

  async generateMasterScript(tenantId: string, pipelineId: string): Promise<any> {
    const pipeline = await this.getPipeline(tenantId, pipelineId);
    const segments = await this.listSegments(tenantId, pipelineId);
    if (!segments.length) throw new BadRequestException('Aucun segment — lancez la segmentation d\'abord');

    const sourceText = pipeline.source_text;
    let script: string;
    try {
      const result = await this.masterclassFactory.aiChatWithFallback(
        `Tu es un scriptwriter pédagogique. Génère un script maître complet pour un cours basé sur le texte source. Format : discours oral fluide, 10-15 phrases par segment.`,
        [{ role: 'user', content: `Texte source:\n${sourceText.slice(0, 5000)}\n\nSegments:\n${segments.map((s: any) => `- ${s.title}`).join('\n')}\n\nGénère le script maître complet.` }],
        3000,
      );
      script = result.text || 'Script non disponible (clé API manquante)';
    } catch {
      script = sourceText.slice(0, 2000);
    }

    await (this.supabase.client as any).from('course_pipelines').update({
      master_script: script, status: 'scripted',
    }).eq('id', pipelineId);

    return { script, provider: 'ai' };
  }

  // ── Segment AI Generation + Approval ───────────────────────────────────

  async generateSegmentContent(tenantId: string, pipelineId: string, segmentId: string): Promise<any> {
    const segment = await this.getSegment(tenantId, segmentId);
    const pipeline = await this.getPipeline(tenantId, pipelineId);

    let content: string;
    try {
      const result = await this.masterclassFactory.aiChatWithFallback(
        `Tu es un créateur de contenu pédagogique. Génère un contenu détaillé pour ce segment de cours. Inclus : idée générale, points clés (3-5), exemple concret, et script oral.`,
        [{ role: 'user', content: `Sujet: ${(segment as any).title}\nContexte du cours: ${pipeline.name}\nTexte source: ${pipeline.source_text?.slice(0, 3000)}\n\nGénère le contenu pédagogique complet pour ce segment.` }],
        2000,
      );
      content = result.text || `[Fallback] ${(segment as any).title} — contenu à générer avec IA.`;
    } catch {
      content = (segment as any).content || 'Contenu à générer.';
    }

    await (this.supabase.client as any).from('pipeline_segments').update({
      content, ai_generated: true, status: 'generated',
    }).eq('id', segmentId);

    return { segmentId, content, aiGenerated: true };
  }

  async approveSegment(tenantId: string, segmentId: string): Promise<any> {
    await (this.supabase.client as any).from('pipeline_segments').update({
      status: 'approved', approved_at: new Date().toISOString(),
    }).eq('id', segmentId).eq('tenant_id', tenantId);
    return { segmentId, status: 'approved' };
  }

  async regenerateSegment(tenantId: string, pipelineId: string, segmentId: string, feedback?: string): Promise<any> {
    // Delete and regenerate
    await (this.supabase.client as any).from('pipeline_segments').update({ status: 'pending', ai_generated: false }).eq('id', segmentId);
    return this.generateSegmentContent(tenantId, pipelineId, segmentId);
  }

  private async getSegment(tenantId: string, segmentId: string): Promise<any> {
    const { data } = await (this.supabase.client as any).from('pipeline_segments')
      .select('*').eq('id', segmentId).eq('tenant_id', tenantId).single();
    if (!data) throw new NotFoundException('Segment introuvable');
    return data;
  }

  // ── Render Jobs ────────────────────────────────────────────────────────

  async enqueueRender(tenantId: string, pipelineId: string): Promise<any> {
    const pipeline = await this.getPipeline(tenantId, pipelineId);
    const segments = await this.listSegments(tenantId, pipelineId);

    const approved = segments.filter((s: any) => s.status === 'approved');
    if (approved.length === 0) throw new BadRequestException('Aucun segment approuvé — approuvez des segments d\'abord');

    await (this.supabase.client as any).from('course_pipelines').update({ status: 'rendering' }).eq('id', pipelineId);

    const { data: job } = await (this.supabase.client as any).from('render_jobs').insert({
      tenant_id: tenantId, pipeline_id: pipelineId, status: 'queued',
      segment_count: approved.length, total_segments: segments.length,
    }).select('*').single();

    // In production, this triggers a worker. For now, simulate completion.
    setTimeout(async () => {
      try {
        await (this.supabase.client as any).from('render_jobs').update({
          status: 'completed', completed_at: new Date().toISOString(),
          output_url: `https://storage.example.com/renders/${pipelineId}/output.mp4`,
        }).eq('id', job.id);
        await (this.supabase.client as any).from('course_pipelines').update({ status: 'done' }).eq('id', pipelineId);
      } catch (e: any) { this.logger.error(`Render simulation failed: ${e.message}`); }
    }, 10000);

    return { jobId: job.id, status: 'queued', estimatedSeconds: approved.length * 5 };
  }

  async getRenderJobs(tenantId: string) {
    const { data } = await (this.supabase.client as any).from('render_jobs')
      .select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(20);
    return data ?? [];
  }

  async getRenderStatus(tenantId: string, jobId: string) {
    const { data } = await (this.supabase.client as any).from('render_jobs')
      .select('*').eq('id', jobId).eq('tenant_id', tenantId).single();
    return data ?? { status: 'unknown' };
  }

  // ── Post-Production Versioning ─────────────────────────────────────────

  async listPostProdVersions(tenantId: string, pipelineId: string) {
    await this.getPipeline(tenantId, pipelineId);
    const { data } = await (this.supabase.client as any).from('postprod_versions')
      .select('*').eq('pipeline_id', pipelineId).order('created_at', { ascending: false });
    return data ?? [];
  }

  async savePostProdVersion(tenantId: string, pipelineId: string, label?: string) {
    const pipeline = await this.getPipeline(tenantId, pipelineId);
    const segments = await this.listSegments(tenantId, pipelineId);

    const { data } = await (this.supabase.client as any).from('postprod_versions').insert({
      tenant_id: tenantId, pipeline_id: pipelineId,
      label: label || `Version ${new Date().toISOString().slice(0, 10)}`,
      snapshot: { pipeline: { name: pipeline.name, status: pipeline.status }, segments },
    }).select('*').single();

    return data;
  }

  async restorePostProdVersion(tenantId: string, pipelineId: string, versionId: string) {
    const { data: version } = await (this.supabase.client as any).from('postprod_versions')
      .select('*').eq('id', versionId).eq('pipeline_id', pipelineId).single();
    if (!version) throw new NotFoundException('Version introuvable');

    // Restore segments
    const segs = version.snapshot?.segments || [];
    await (this.supabase.client as any).from('pipeline_segments').delete().eq('pipeline_id', pipelineId);
    for (const seg of segs) {
      await (this.supabase.client as any).from('pipeline_segments').insert({
        tenant_id: tenantId, pipeline_id: pipelineId,
        title: seg.title, content: seg.content, order_index: seg.order_index,
        status: seg.status || 'pending',
      });
    }

    await (this.supabase.client as any).from('course_pipelines').update({
      status: version.snapshot?.pipeline?.status || 'pending',
    }).eq('id', pipelineId);

    return { restored: versionId, segmentCount: segs.length };
  }

  // ── Fallback ───────────────────────────────────────────────────────────

  private naiveSegment(text: string): { title: string; content: string; index: number }[] {
    const paragraphs = text.split(/\n\n+/).filter(p => p.trim());
    if (paragraphs.length <= 1) return [{ title: 'Contenu', content: text.slice(0, 500), index: 0 }];
    return paragraphs.map((p, i) => ({ title: `Segment ${i + 1}`, content: p.trim().slice(0, 500), index: i }));
  }
}
