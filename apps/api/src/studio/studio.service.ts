import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class StudioService {
  private readonly logger = new Logger(StudioService.name);
  constructor(private readonly supabase: SupabaseService) {}
  private get db(): any {
    return this.supabase.client;
  }

  // ── Workspaces ──────────────────────────────────────────────────────────

  async listWorkspaces(tenantId: string) {
    const { data } = await this.db
      .from('liri_course_workspaces')
      .select(
        'id, title, status, pedagogical_model, source_type, chapter_count, slide_count, quality_score, created_at, updated_at',
      )
      .eq('tenant_id', tenantId)
      .order('updated_at', { ascending: false });
    return data ?? [];
  }

  async getWorkspace(tenantId: string, workspaceId: string) {
    const { data, error } = await this.db
      .from('liri_course_workspaces')
      .select('*')
      .eq('id', workspaceId)
      .eq('tenant_id', tenantId)
      .single();
    if (error || !data) throw new NotFoundException('Workspace introuvable');
    return data;
  }

  async createWorkspace(
    tenantId: string,
    ownerId: string,
    dto: { title: string; sourceText?: string; pedagogicalModel?: string },
  ) {
    const { data, error } = await this.db
      .from('liri_course_workspaces')
      .insert({
        tenant_id: tenantId,
        owner_id: ownerId,
        title: dto.title,
        source_text: dto.sourceText ?? '',
        pedagogical_model: dto.pedagogicalModel ?? 'liri-v1',
      })
      .select('*')
      .single();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async updateWorkspace(
    tenantId: string,
    workspaceId: string,
    patch: Record<string, any>,
  ) {
    const allowed = [
      'title',
      'description',
      'status',
      'slides_json',
      'copilot_json',
      'theme',
      'quality_score',
      'is_public',
      'metadata',
    ];
    const filtered: Record<string, any> = {};
    for (const k of allowed) if (patch[k] !== undefined) filtered[k] = patch[k];

    const { data, error } = await this.db
      .from('liri_course_workspaces')
      .update(filtered)
      .eq('id', workspaceId)
      .eq('tenant_id', tenantId)
      .select('*')
      .single();
    if (error || !data) throw new NotFoundException('Workspace introuvable');
    return data;
  }

  async saveVersion(tenantId: string, workspaceId: string) {
    const ws = await this.getWorkspace(tenantId, workspaceId);
    const versions = Array.isArray(ws.versions) ? ws.versions : [];
    const snapshot = {
      slides_json: ws.slides_json,
      copilot_json: ws.copilot_json,
      saved_at: new Date().toISOString(),
    };
    versions.push({ version: versions.length + 1, ...snapshot });
    return this.updateWorkspace(tenantId, workspaceId, { versions });
  }

  async restoreVersion(
    tenantId: string,
    workspaceId: string,
    versionIndex: number,
  ) {
    const ws = await this.getWorkspace(tenantId, workspaceId);
    const versions = Array.isArray(ws.versions) ? ws.versions : [];
    const v = versions[versionIndex - 1];
    if (!v) throw new NotFoundException(`Version ${versionIndex} introuvable`);
    return this.updateWorkspace(tenantId, workspaceId, {
      slides_json: v.slides_json,
      copilot_json: v.copilot_json,
    });
  }

  async deleteWorkspace(tenantId: string, workspaceId: string) {
    await this.getWorkspace(tenantId, workspaceId);
    await this.db
      .from('liri_course_workspaces')
      .delete()
      .eq('id', workspaceId)
      .eq('tenant_id', tenantId);
    return { id: workspaceId };
  }

  // ── Assets ──────────────────────────────────────────────────────────────

  async listAssets(tenantId: string, type?: string, tags?: string[]) {
    let q = this.db
      .from('liri_assets')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });
    if (type) q = q.eq('asset_type', type);
    if (tags?.length) q = q.contains('tags', tags);
    const { data } = await q;
    return data ?? [];
  }

  async createAsset(
    tenantId: string,
    ownerId: string,
    dto: {
      assetType: string;
      title: string;
      publicUrl?: string;
      tags?: string[];
      width?: number;
      height?: number;
      isTemplate?: boolean;
    },
  ) {
    const { data, error } = await this.db
      .from('liri_assets')
      .insert({
        tenant_id: tenantId,
        owner_id: ownerId,
        asset_type: dto.assetType,
        title: dto.title,
        public_url: dto.publicUrl,
        tags: dto.tags ?? [],
        width: dto.width,
        height: dto.height,
        is_template: dto.isTemplate ?? false,
      })
      .select('*')
      .single();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async deleteAsset(tenantId: string, assetId: string) {
    const { error } = await this.db
      .from('liri_assets')
      .delete()
      .eq('id', assetId)
      .eq('tenant_id', tenantId);
    if (error) throw new BadRequestException(error.message);
    return { id: assetId };
  }

  // ── Formations ──────────────────────────────────────────────────────────

  async listFormations(tenantId: string) {
    const { data } = await this.db
      .from('liri_formations')
      .select(
        'id, title, programme_type, audience_level, status, estimated_duration_hours, created_at, updated_at',
      )
      .eq('tenant_id', tenantId)
      .order('updated_at', { ascending: false });
    return data ?? [];
  }

  async getFormation(tenantId: string, formationId: string) {
    const { data, error } = await this.db
      .from('liri_formations')
      .select('*')
      .eq('id', formationId)
      .eq('tenant_id', tenantId)
      .single();
    if (error || !data) throw new NotFoundException('Formation introuvable');
    return data;
  }

  async createFormation(
    tenantId: string,
    ownerId: string,
    dto: {
      title: string;
      programmeType?: string;
      audienceLevel?: string;
    },
  ) {
    const { data, error } = await this.db
      .from('liri_formations')
      .insert({
        tenant_id: tenantId,
        owner_id: ownerId,
        title: dto.title,
        programme_type: dto.programmeType ?? 'complet',
        audience_level: dto.audienceLevel ?? 'intermediaire',
      })
      .select('*')
      .single();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async updateFormationTree(
    tenantId: string,
    formationId: string,
    treeJson: any,
  ) {
    const { data, error } = await this.db
      .from('liri_formations')
      .update({ tree_json: treeJson })
      .eq('id', formationId)
      .eq('tenant_id', tenantId)
      .select('*')
      .single();
    if (error || !data) throw new NotFoundException('Formation introuvable');
    return data;
  }

  // ── Render Jobs ─────────────────────────────────────────────────────────

  async listRenderJobs(tenantId: string) {
    const { data } = await this.db
      .from('liri_render_jobs')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(50);
    return data ?? [];
  }

  async getRenderJob(tenantId: string, jobId: string) {
    const { data, error } = await this.db
      .from('liri_render_jobs')
      .select('*')
      .eq('id', jobId)
      .eq('tenant_id', tenantId)
      .single();
    if (error || !data) throw new NotFoundException('Job introuvable');
    return data;
  }

  async enqueueRenderJob(
    tenantId: string,
    dto: {
      workspaceId?: string;
      projectId?: string;
      jobType: string;
      exportFormat?: string;
    },
  ) {
    const { data, error } = await this.db
      .from('liri_render_jobs')
      .insert({
        tenant_id: tenantId,
        workspace_id: dto.workspaceId,
        project_id: dto.projectId,
        job_type: dto.jobType,
        export_format: dto.exportFormat,
      })
      .select('*')
      .single();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  // ── Hub Stats ───────────────────────────────────────────────────────────

  async getHubStats(tenantId: string) {
    const [
      { count: workspaceCount },
      { count: projectCount },
      { count: formationCount },
      { count: assetCount },
    ] = await Promise.all([
      this.db
        .from('liri_course_workspaces')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId),
      this.db
        .from('liri_projects')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId),
      this.db
        .from('liri_formations')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId),
      this.db
        .from('liri_assets')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId),
    ]);
    return { workspaceCount, projectCount, formationCount, assetCount };
  }
}
