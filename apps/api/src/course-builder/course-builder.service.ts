import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
import { AiUtilsService } from '../ai-utils/ai-utils.service';

@Injectable()
export class CourseBuilderService {
  private readonly logger = new Logger(CourseBuilderService.name);
  constructor(
    private readonly supabase: SupabaseService,
    private readonly aiUtils: AiUtilsService,
    private readonly config: ConfigService,
  ) {}

  async createPipeline(tenantId: string, name: string, sourceText: string) {
    const { data } = await (this.supabase.client as any).from('course_pipelines').insert({
      tenant_id: tenantId, name, source_text: sourceText, status: 'pending',
    }).select('*').single();
    return data;
  }

  async listPipelines(tenantId: string) {
    const { data } = await (this.supabase.client as any).from('course_pipelines').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false });
    return data ?? [];
  }

  async autoSegment(tenantId: string, pipelineId: string) {
    const { data: pipeline } = await (this.supabase.client as any).from('course_pipelines').select('*').eq('id', pipelineId).single();
    if (!pipeline) return { error: 'Pipeline introuvable' };
    const segments = this.naiveSegment(pipeline.source_text);
    for (const seg of segments) {
      await (this.supabase.client as any).from('pipeline_segments').insert({ tenant_id: tenantId, pipeline_id: pipelineId, title: seg.title, content: seg.content, order_index: seg.index });
    }
    await (this.supabase.client as any).from('course_pipelines').update({ status: 'segmented', segment_count: segments.length }).eq('id', pipelineId);
    return { segments: segments.length };
  }

  async listSegments(tenantId: string, pipelineId: string) {
    const { data } = await (this.supabase.client as any).from('pipeline_segments').select('*').eq('pipeline_id', pipelineId).order('order_index');
    return data ?? [];
  }

  async enqueueRender(tenantId: string, pipelineId: string) {
    await (this.supabase.client as any).from('course_pipelines').update({ status: 'rendering' }).eq('id', pipelineId);
    await (this.supabase.client as any).from('render_jobs').insert({ tenant_id: tenantId, pipeline_id: pipelineId, status: 'queued' });
    return { status: 'queued' };
  }

  async getRenderJobs(tenantId: string) {
    const { data } = await (this.supabase.client as any).from('render_jobs').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false });
    return data ?? [];
  }

  async getRenderStatus(tenantId: string, jobId: string) {
    const { data } = await (this.supabase.client as any).from('render_jobs').select('*').eq('id', jobId).eq('tenant_id', tenantId).single();
    return data ?? { status: 'unknown' };
  }

  // ── Segment AI (« tableau IA » par chapitre — classe numérique) ────────────

  /**
   * Génère le contenu IA d'un (ou tous les) chapitre(s) : découpe le transcript
   * sur la fenêtre temporelle du chapitre, reformule via AiUtilsService, et
   * upsert dans course_segment_ai_content. Renvoie { rows } (le front fusionne
   * ces lignes même si la table manque — dégradation gracieuse).
   * Remplace l'ancien edge /.netlify/functions/course-builder-segment-ai-generate (404).
   */
  async generateSegmentAi(
    tenantId: string,
    userId: string,
    dto: { contentId: string; segmentIndex?: number; applyAll?: boolean; mode?: string; chapters?: any[]; transcript?: any[] },
  ) {
    const chapters: any[] = Array.isArray(dto.chapters) ? dto.chapters : [];
    const transcript: any[] = Array.isArray(dto.transcript) ? dto.transcript : [];
    const targets = dto.applyAll ? chapters.map((_c, i) => i) : [Number(dto.segmentIndex) || 0];
    const rows: any[] = [];

    for (const idx of targets) {
      const ch = chapters[idx];
      if (!ch) continue;
      const start = Number(ch.startSeconds) || 0;
      const end = Number(ch.endSeconds) || Number.MAX_SAFE_INTEGER;
      const text = transcript
        .filter((l) => { const t = Number(l?.timeSeconds); return t >= start && t < end; })
        .map((l) => String(l?.text ?? ''))
        .join(' ')
        .trim()
        .slice(0, 4000);

      let reformulation = '';
      if (text) {
        try {
          const r: any = await this.aiUtils.reformulate(tenantId, {
            text,
            context: 'Reformulation pédagogique synthétique pour le tableau d’un segment de cours (classe numérique).',
          });
          reformulation = String(r?.result ?? '').trim();
        } catch (e) {
          this.logger.warn(`reformulate échec (segment ${idx}): ${String(e)}`);
        }
      }

      const row: Record<string, any> = {
        tenant_id: tenantId,
        content_id: dto.contentId,
        segment_index: idx,
        status: 'draft',
        reformulation_text: reformulation || null,
        created_by: userId || null,
      };
      try {
        const { data } = await (this.supabase.client as any)
          .from('course_segment_ai_content')
          .upsert(row, { onConflict: 'content_id,segment_index' })
          .select('*')
          .single();
        rows.push(data ?? row);
      } catch {
        rows.push(row);
      }
    }
    return { rows };
  }

  async listSegmentAi(tenantId: string, contentId: string) {
    const { data } = await (this.supabase.client as any)
      .from('course_segment_ai_content')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('content_id', contentId)
      .order('segment_index');
    return { rows: data ?? [] };
  }

  /** Approuve / rejette le contenu IA d'un segment. Remplace l'edge course-builder-segment-ai-approve (404). */
  async approveSegmentAi(tenantId: string, dto: { contentId: string; segmentIndex?: number; approved?: boolean }) {
    const status = dto.approved === false ? 'rejected' : 'approved';
    const { data } = await (this.supabase.client as any)
      .from('course_segment_ai_content')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('tenant_id', tenantId)
      .eq('content_id', dto.contentId)
      .eq('segment_index', Number(dto.segmentIndex) || 0)
      .select('*')
      .single();
    return { ok: true, status, row: data ?? null };
  }

  // ── Versions / snapshots post-production ───────────────────────────────────

  /** Enregistre un snapshot de l'état post-prod. Remplace l'edge postprod-version-save (404). */
  async saveVersion(
    tenantId: string,
    userId: string,
    dto: { contentId: string; snapshotLabel?: string; snapshot?: any },
  ) {
    const { data } = await (this.supabase.client as any)
      .from('course_postprod_versions')
      .insert({
        tenant_id: tenantId,
        content_id: dto.contentId,
        label: dto.snapshotLabel ?? null,
        snapshot: dto.snapshot ?? {},
        created_by: userId || null,
      })
      .select('*')
      .single();
    return { ok: true, version: data ?? null };
  }

  async listVersions(tenantId: string, contentId: string) {
    const { data } = await (this.supabase.client as any)
      .from('course_postprod_versions')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('content_id', contentId)
      .order('created_at', { ascending: false });
    return { rows: data ?? [] };
  }

  /** Restaure un snapshot : réécrit formation_day_contents.data avec l'état sauvegardé. */
  async restoreVersion(tenantId: string, dto: { versionId: string }) {
    const { data: v } = await (this.supabase.client as any)
      .from('course_postprod_versions')
      .select('*')
      .eq('id', dto.versionId)
      .eq('tenant_id', tenantId)
      .single();
    if (!v) return { ok: false, error: 'Version introuvable' };
    const snap = v.snapshot || {};
    const { data: content } = await (this.supabase.client as any)
      .from('formation_day_contents')
      .select('data')
      .eq('id', v.content_id)
      .single();
    const newData = {
      ...((content && content.data) || {}),
      ...(snap.transcript !== undefined ? { transcript: snap.transcript } : {}),
      ...(snap.chapters !== undefined ? { chapters: snap.chapters } : {}),
      ...(snap.timestamps !== undefined ? { timestamps: snap.timestamps } : {}),
      ...(snap.dataPatch && typeof snap.dataPatch === 'object' ? snap.dataPatch : {}),
    };
    await (this.supabase.client as any)
      .from('formation_day_contents')
      .update({ data: newData })
      .eq('id', v.content_id);
    return { ok: true, contentId: v.content_id };
  }

  // ── Pipeline (segmentation + master script) ────────────────────────────────

  /** Segmentation auto depuis un texte. Remplace l'edge course-builder-pipeline-auto-segment (404). */
  async pipelineAutoSegment(_tenantId: string, dto: { contentId?: string; transcriptText?: string }) {
    const text = String(dto.transcriptText ?? '');
    return { segments: this.naiveSegment(text), transcript: text };
  }

  /** Master script : reformule chaque segment en discours pédagogique. Remplace l'edge ...-master-script (404). */
  async pipelineMasterScript(
    tenantId: string,
    dto: { segments?: any[]; transcript?: string; courseTitle?: string },
  ) {
    const segs = Array.isArray(dto.segments) ? dto.segments.slice(0, 12) : [];
    const sections: any[] = [];
    for (const s of segs) {
      const content = String(
        s?.content ?? (Array.isArray(s?.points) ? s.points.join('. ') : '') ?? '',
      ).slice(0, 4000);
      let discourse = content;
      if (content) {
        try {
          const r: any = await this.aiUtils.reformulate(tenantId, {
            text: content,
            context: `Discours pédagogique de présentation pour le cours « ${dto.courseTitle ?? 'Cours'} ».`,
          });
          discourse = String(r?.result ?? content).trim();
        } catch (e) {
          this.logger.warn(`master-script reformulate échec: ${String(e)}`);
        }
      }
      sections.push({ title: s?.title ?? '', discourse });
    }
    return { sections };
  }

  // ── Illustration d'un segment (réutilise l'edge generate-visual-image) ─────

  /** (Re)génère l'illustration d'un segment. Remplace l'edge course-builder-segment-illustration-regenerate (404). */
  async segmentIllustrationRegenerate(
    tenantId: string,
    userId: string,
    dto: { contentId: string; segmentIndex?: number; prompt?: string },
  ) {
    const segIndex = Number(dto.segmentIndex) || 0;
    let prompt = String(dto.prompt ?? '').trim();
    if (!prompt) {
      const { data: row } = await (this.supabase.client as any)
        .from('course_segment_ai_content')
        .select('reformulation_text,summary_text')
        .eq('tenant_id', tenantId)
        .eq('content_id', dto.contentId)
        .eq('segment_index', segIndex)
        .single();
      prompt =
        String(row?.summary_text || row?.reformulation_text || '').slice(0, 500).trim() ||
        `Illustration pédagogique claire, chapitre ${segIndex + 1}`;
    }

    const supaUrl = this.config.get<string>('SUPABASE_URL') ?? '';
    const key = this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    let imageUrl: string | null = null;
    if (supaUrl && key) {
      try {
        const r = await fetch(`${supaUrl}/functions/v1/generate-visual-image`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${key}` },
          body: JSON.stringify({ prompt, size: '1792x1024' }),
        });
        const j: any = await r.json().catch(() => ({}));
        imageUrl = j?.imageUrl ?? j?.url ?? null;
      } catch (e) {
        this.logger.warn(`illustration edge échec: ${String(e)}`);
      }
    }

    if (imageUrl) {
      try {
        await (this.supabase.client as any)
          .from('course_segment_ai_content')
          .upsert(
            {
              tenant_id: tenantId,
              content_id: dto.contentId,
              segment_index: segIndex,
              illustration_url: imageUrl,
              illustration_prompt: prompt,
              created_by: userId || null,
            },
            { onConflict: 'content_id,segment_index' },
          );
      } catch {
        /* dégradation gracieuse si table absente */
      }
    }
    return { illustration_url: imageUrl, prompt };
  }

  private naiveSegment(text: string): { title: string; content: string; index: number }[] {
    const paragraphs = text.split(/\n\n+/).filter(p => p.trim());
    return paragraphs.map((p, i) => ({ title: `Segment ${i + 1}`, content: p.trim(), index: i }));
  }
}
