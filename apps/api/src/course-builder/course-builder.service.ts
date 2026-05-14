import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class CourseBuilderService {
  private readonly logger = new Logger(CourseBuilderService.name);
  constructor(private readonly supabase: SupabaseService) {}

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

  private naiveSegment(text: string): { title: string; content: string; index: number }[] {
    const paragraphs = text.split(/\n\n+/).filter(p => p.trim());
    return paragraphs.map((p, i) => ({ title: `Segment ${i + 1}`, content: p.trim(), index: i }));
  }
}
