import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

/**
 * CRM — cœur sales (Vague 2). Toutes les opérations sont TENANT-SCOPÉES :
 *  - chaque INSERT porte `tenant_id` ;
 *  - chaque SELECT/UPDATE/DELETE filtre par `.eq('tenant_id', tenantId)`.
 * Le client Supabase tourne en service_role (bypass RLS) → le scoping applicatif
 * ci-dessous EST la frontière d'isolation inter-tenant. Ne jamais retirer un
 * `.eq('tenant_id', ...)` d'une requête d'écriture/lecture.
 */
@Injectable()
export class CrmService {
  constructor(private readonly supabase: SupabaseService) {}

  private db() {
    return this.supabase.client as any;
  }

  private static pick(body: any, fields: string[]): Record<string, any> {
    const out: Record<string, any> = {};
    for (const f of fields) {
      if (body && body[f] !== undefined) out[f] = body[f];
    }
    return out;
  }

  private static requireId(id: string | undefined, label = 'id'): string {
    const v = String(id || '').trim();
    if (!v) throw new BadRequestException(`${label} requis`);
    return v;
  }

  // ─── Companies ─────────────────────────────────────────────────────────────
  private static COMPANY_FIELDS = [
    'name', 'website', 'industry', 'size', 'phone', 'address',
    'city', 'country', 'description', 'owner_id',
  ];

  async listCompanies(
    tenantId: string,
    opts: { search?: string; limit?: number; offset?: number } = {},
  ) {
    let q = this.db()
      .from('crm_companies')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .range(opts.offset ?? 0, (opts.offset ?? 0) + (opts.limit ?? 50) - 1);
    if (opts.search) q = q.ilike('name', `%${opts.search}%`);
    const { data, error } = await q;
    if (error) throw new BadRequestException(error.message);
    return { companies: data ?? [] };
  }

  async createCompany(tenantId: string, body: any) {
    const name = String(body?.name || '').trim();
    if (!name) throw new BadRequestException('name requis');
    const row = { ...CrmService.pick(body, CrmService.COMPANY_FIELDS), name, tenant_id: tenantId };
    const { data, error } = await this.db().from('crm_companies').insert(row).select().single();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async updateCompany(tenantId: string, id: string, body: any) {
    CrmService.requireId(id);
    const patch = CrmService.pick(body, CrmService.COMPANY_FIELDS);
    if (Object.keys(patch).length === 0) throw new BadRequestException('aucun champ à mettre à jour');
    const { data, error } = await this.db()
      .from('crm_companies').update(patch)
      .eq('tenant_id', tenantId).eq('id', id).select().maybeSingle();
    if (error) throw new BadRequestException(error.message);
    if (!data) throw new NotFoundException('société introuvable');
    return data;
  }

  async deleteCompany(tenantId: string, id: string) {
    CrmService.requireId(id);
    const { error } = await this.db()
      .from('crm_companies').delete().eq('tenant_id', tenantId).eq('id', id);
    if (error) throw new BadRequestException(error.message);
    return { ok: true };
  }

  // ─── Contacts ──────────────────────────────────────────────────────────────
  private static CONTACT_FIELDS = [
    'company_id', 'first_name', 'last_name', 'email', 'phone',
    'title', 'status', 'source', 'owner_id',
  ];

  async listContacts(
    tenantId: string,
    opts: { search?: string; companyId?: string; status?: string; limit?: number; offset?: number } = {},
  ) {
    let q = this.db()
      .from('crm_contacts')
      .select('*, company:crm_companies(id,name)')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .range(opts.offset ?? 0, (opts.offset ?? 0) + (opts.limit ?? 50) - 1);
    if (opts.companyId) q = q.eq('company_id', opts.companyId);
    if (opts.status) q = q.eq('status', opts.status);
    if (opts.search) q = q.or(`first_name.ilike.%${opts.search}%,last_name.ilike.%${opts.search}%,email.ilike.%${opts.search}%`);
    const { data, error } = await q;
    if (error) throw new BadRequestException(error.message);
    return { contacts: data ?? [] };
  }

  async createContact(tenantId: string, body: any) {
    const row: Record<string, any> = { ...CrmService.pick(body, CrmService.CONTACT_FIELDS), tenant_id: tenantId };
    if (!row.first_name && !row.last_name && !row.email) {
      throw new BadRequestException('au moins un nom ou un email est requis');
    }
    const { data, error } = await this.db().from('crm_contacts').insert(row).select().single();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async updateContact(tenantId: string, id: string, body: any) {
    CrmService.requireId(id);
    const patch = CrmService.pick(body, CrmService.CONTACT_FIELDS);
    if (Object.keys(patch).length === 0) throw new BadRequestException('aucun champ à mettre à jour');
    const { data, error } = await this.db()
      .from('crm_contacts').update(patch)
      .eq('tenant_id', tenantId).eq('id', id).select().maybeSingle();
    if (error) throw new BadRequestException(error.message);
    if (!data) throw new NotFoundException('contact introuvable');
    return data;
  }

  async deleteContact(tenantId: string, id: string) {
    CrmService.requireId(id);
    const { error } = await this.db()
      .from('crm_contacts').delete().eq('tenant_id', tenantId).eq('id', id);
    if (error) throw new BadRequestException(error.message);
    return { ok: true };
  }

  /**
   * Convertit un lead du Growth Engine en contact CRM (lien lead_id conservé).
   * Marque le lead comme 'customer'. Idempotent-ish : refuse si déjà converti.
   */
  async convertLead(tenantId: string, leadId: string) {
    CrmService.requireId(leadId, 'leadId');
    const { data: lead, error: le } = await this.db()
      .from('leads').select('*').eq('tenant_id', tenantId).eq('id', leadId).maybeSingle();
    if (le) throw new BadRequestException(le.message);
    if (!lead) throw new NotFoundException('lead introuvable');

    const { data: existing } = await this.db()
      .from('crm_contacts').select('id').eq('tenant_id', tenantId).eq('lead_id', leadId).maybeSingle();
    if (existing) throw new BadRequestException('ce lead a déjà été converti en contact');

    const fullName = String(lead.name || '').trim();
    const [first, ...rest] = fullName.split(/\s+/);
    const row = {
      tenant_id: tenantId,
      lead_id: leadId,
      first_name: first || null,
      last_name: rest.join(' ') || null,
      email: lead.email || null,
      source: 'lead',
      status: 'active',
    };
    const { data: contact, error } = await this.db().from('crm_contacts').insert(row).select().single();
    if (error) throw new BadRequestException(error.message);
    await this.db().from('leads').update({ status: 'customer' }).eq('tenant_id', tenantId).eq('id', leadId);
    return contact;
  }

  // ─── Pipelines & stages ──────────────────────────────────────────────────────
  // ⚠️ CLÉS HOMOGÈNES OBLIGATOIRES : l'insert en lot PostgREST exige que TOUS les objets
  // aient EXACTEMENT les mêmes clés (sinon 400/échec silencieux → pipeline sans étapes).
  // Donc is_won ET is_lost sont explicites sur CHAQUE étape.
  private static DEFAULT_STAGES = [
    { name: 'Nouveau', position: 0, win_probability: 10, is_won: false, is_lost: false },
    { name: 'Qualifié', position: 1, win_probability: 25, is_won: false, is_lost: false },
    { name: 'Proposition', position: 2, win_probability: 50, is_won: false, is_lost: false },
    { name: 'Négociation', position: 3, win_probability: 75, is_won: false, is_lost: false },
    { name: 'Gagné', position: 4, win_probability: 100, is_won: true, is_lost: false },
    { name: 'Perdu', position: 5, win_probability: 0, is_won: false, is_lost: true },
  ];

  private async seedDefaultStages(tenantId: string, pipelineId: string) {
    const stages = CrmService.DEFAULT_STAGES.map((s) => ({
      ...s,
      tenant_id: tenantId,
      pipeline_id: pipelineId,
    }));
    const { error } = await this.db().from('crm_stages').insert(stages);
    if (error) throw new BadRequestException(error.message);
  }

  async listPipelines(tenantId: string) {
    const { data, error } = await this.db()
      .from('crm_pipelines').select('*').eq('tenant_id', tenantId)
      .order('position', { ascending: true });
    if (error) throw new BadRequestException(error.message);
    return { pipelines: data ?? [] };
  }

  /** Retourne le pipeline par défaut du tenant, en le créant (+ étapes) si absent. */
  async ensureDefaultPipeline(tenantId: string) {
    const { data: existing } = await this.db()
      .from('crm_pipelines').select('*').eq('tenant_id', tenantId)
      .order('is_default', { ascending: false }).order('position', { ascending: true })
      .limit(1).maybeSingle();
    if (existing) {
      // Auto-réparation : un pipeline sans étape (échec partiel d'un seed antérieur) est re-seedé.
      const { count } = await this.db()
        .from('crm_stages')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('pipeline_id', existing.id);
      if (!count) await this.seedDefaultStages(tenantId, existing.id);
      return existing;
    }

    const { data: pipeline, error } = await this.db().from('crm_pipelines')
      .insert({ tenant_id: tenantId, name: 'Pipeline commercial', is_default: true, position: 0 })
      .select().single();
    if (error) throw new BadRequestException(error.message);
    await this.seedDefaultStages(tenantId, pipeline.id);
    return pipeline;
  }

  async createPipeline(tenantId: string, body: any) {
    const name = String(body?.name || '').trim();
    if (!name) throw new BadRequestException('name requis');
    const { data, error } = await this.db().from('crm_pipelines')
      .insert({ tenant_id: tenantId, name, is_default: !!body?.is_default, position: Number(body?.position) || 0 })
      .select().single();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async listStages(tenantId: string, pipelineId: string) {
    CrmService.requireId(pipelineId, 'pipelineId');
    const { data, error } = await this.db()
      .from('crm_stages').select('*')
      .eq('tenant_id', tenantId).eq('pipeline_id', pipelineId)
      .order('position', { ascending: true });
    if (error) throw new BadRequestException(error.message);
    return { stages: data ?? [] };
  }

  // ─── Deals (kanban) ────────────────────────────────────────────────────────
  private static DEAL_FIELDS = [
    'pipeline_id', 'stage_id', 'company_id', 'contact_id', 'title',
    'amount', 'currency', 'status', 'expected_close_date', 'position', 'owner_id',
  ];

  /** Vue kanban : le pipeline (défaut si non fourni) + ses étapes, chacune avec ses deals. */
  async dealsBoard(tenantId: string, pipelineId?: string) {
    const pipeline = pipelineId
      ? (await this.db().from('crm_pipelines').select('*').eq('tenant_id', tenantId).eq('id', pipelineId).maybeSingle()).data
      : await this.ensureDefaultPipeline(tenantId);
    if (!pipeline) throw new NotFoundException('pipeline introuvable');

    const [{ data: stages }, { data: deals }] = await Promise.all([
      this.db().from('crm_stages').select('*')
        .eq('tenant_id', tenantId).eq('pipeline_id', pipeline.id)
        .order('position', { ascending: true }),
      this.db().from('crm_deals')
        .select('*, company:crm_companies(id,name), contact:crm_contacts(id,first_name,last_name)')
        .eq('tenant_id', tenantId).eq('pipeline_id', pipeline.id)
        .order('position', { ascending: true }),
    ]);

    const byStage = new Map<string, any[]>();
    for (const s of stages ?? []) byStage.set(s.id, []);
    const orphans: any[] = [];
    for (const d of deals ?? []) {
      const bucket = d.stage_id && byStage.has(d.stage_id) ? byStage.get(d.stage_id)! : orphans;
      bucket.push(d);
    }
    return {
      pipeline,
      stages: (stages ?? []).map((s: any) => ({ ...s, deals: byStage.get(s.id) ?? [] })),
      orphans,
    };
  }

  async createDeal(tenantId: string, body: any) {
    const title = String(body?.title || '').trim();
    if (!title) throw new BadRequestException('title requis');
    let pipelineId = String(body?.pipeline_id || '').trim();
    let stageId = String(body?.stage_id || '').trim();
    if (!pipelineId) {
      const p = await this.ensureDefaultPipeline(tenantId);
      pipelineId = p.id;
    }
    if (!stageId) {
      const { data: firstStage } = await this.db().from('crm_stages').select('id')
        .eq('tenant_id', tenantId).eq('pipeline_id', pipelineId)
        .order('position', { ascending: true }).limit(1).maybeSingle();
      stageId = firstStage?.id ?? null;
    }
    const row = {
      ...CrmService.pick(body, CrmService.DEAL_FIELDS),
      title, tenant_id: tenantId, pipeline_id: pipelineId, stage_id: stageId || null,
    };
    const { data, error } = await this.db().from('crm_deals').insert(row).select().single();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async updateDeal(tenantId: string, id: string, body: any) {
    CrmService.requireId(id);
    const patch = CrmService.pick(body, CrmService.DEAL_FIELDS);
    if (Object.keys(patch).length === 0) throw new BadRequestException('aucun champ à mettre à jour');
    // Cohérence statut/clôture : si won/lost, horodater closed_at ; si ré-ouvert, l'effacer.
    if (patch.status === 'won' || patch.status === 'lost') patch.closed_at = new Date().toISOString();
    else if (patch.status === 'open') patch.closed_at = null;
    const { data, error } = await this.db()
      .from('crm_deals').update(patch)
      .eq('tenant_id', tenantId).eq('id', id).select().maybeSingle();
    if (error) throw new BadRequestException(error.message);
    if (!data) throw new NotFoundException('deal introuvable');
    return data;
  }

  async deleteDeal(tenantId: string, id: string) {
    CrmService.requireId(id);
    const { error } = await this.db()
      .from('crm_deals').delete().eq('tenant_id', tenantId).eq('id', id);
    if (error) throw new BadRequestException(error.message);
    return { ok: true };
  }

  // ─── Notes ─────────────────────────────────────────────────────────────────
  private static ENTITY_TYPES = ['contact', 'company', 'deal'];

  private static assertEntityType(t: string) {
    if (!CrmService.ENTITY_TYPES.includes(t)) throw new BadRequestException('entity_type invalide');
  }

  async listNotes(tenantId: string, entityType: string, entityId: string) {
    CrmService.assertEntityType(entityType);
    CrmService.requireId(entityId, 'entity_id');
    const { data, error } = await this.db()
      .from('crm_notes').select('*')
      .eq('tenant_id', tenantId).eq('entity_type', entityType).eq('entity_id', entityId)
      .order('created_at', { ascending: false });
    if (error) throw new BadRequestException(error.message);
    return { notes: data ?? [] };
  }

  async createNote(tenantId: string, body: any) {
    const entityType = String(body?.entity_type || '');
    CrmService.assertEntityType(entityType);
    const entityId = CrmService.requireId(body?.entity_id, 'entity_id');
    const bodyText = String(body?.body || '').trim();
    if (!bodyText) throw new BadRequestException('body requis');
    const row = {
      tenant_id: tenantId, entity_type: entityType, entity_id: entityId,
      body: bodyText, author_id: body?.author_id ?? null,
    };
    const { data, error } = await this.db().from('crm_notes').insert(row).select().single();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async deleteNote(tenantId: string, id: string) {
    CrmService.requireId(id);
    const { error } = await this.db().from('crm_notes').delete().eq('tenant_id', tenantId).eq('id', id);
    if (error) throw new BadRequestException(error.message);
    return { ok: true };
  }

  // ─── Tasks ─────────────────────────────────────────────────────────────────
  private static TASK_FIELDS = ['entity_type', 'entity_id', 'title', 'due_date', 'assignee_id', 'status'];

  async listTasks(
    tenantId: string,
    opts: { status?: string; entityType?: string; entityId?: string } = {},
  ) {
    let q = this.db().from('crm_tasks').select('*').eq('tenant_id', tenantId)
      .order('due_date', { ascending: true, nullsFirst: false });
    if (opts.status) q = q.eq('status', opts.status);
    if (opts.entityType) q = q.eq('entity_type', opts.entityType);
    if (opts.entityId) q = q.eq('entity_id', opts.entityId);
    const { data, error } = await q;
    if (error) throw new BadRequestException(error.message);
    return { tasks: data ?? [] };
  }

  async createTask(tenantId: string, body: any) {
    const title = String(body?.title || '').trim();
    if (!title) throw new BadRequestException('title requis');
    if (body?.entity_type) CrmService.assertEntityType(String(body.entity_type));
    const row = { ...CrmService.pick(body, CrmService.TASK_FIELDS), title, tenant_id: tenantId };
    const { data, error } = await this.db().from('crm_tasks').insert(row).select().single();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async updateTask(tenantId: string, id: string, body: any) {
    CrmService.requireId(id);
    const patch = CrmService.pick(body, CrmService.TASK_FIELDS);
    if (Object.keys(patch).length === 0) throw new BadRequestException('aucun champ à mettre à jour');
    if (patch.status === 'done') patch.completed_at = new Date().toISOString();
    else if (patch.status === 'open') patch.completed_at = null;
    const { data, error } = await this.db()
      .from('crm_tasks').update(patch).eq('tenant_id', tenantId).eq('id', id).select().maybeSingle();
    if (error) throw new BadRequestException(error.message);
    if (!data) throw new NotFoundException('tâche introuvable');
    return data;
  }

  async deleteTask(tenantId: string, id: string) {
    CrmService.requireId(id);
    const { error } = await this.db().from('crm_tasks').delete().eq('tenant_id', tenantId).eq('id', id);
    if (error) throw new BadRequestException(error.message);
    return { ok: true };
  }

  // ─── Tags ──────────────────────────────────────────────────────────────────
  async listTags(tenantId: string) {
    const { data, error } = await this.db()
      .from('crm_tags').select('*').eq('tenant_id', tenantId).order('name', { ascending: true });
    if (error) throw new BadRequestException(error.message);
    return { tags: data ?? [] };
  }

  async createTag(tenantId: string, body: any) {
    const name = String(body?.name || '').trim();
    if (!name) throw new BadRequestException('name requis');
    const { data, error } = await this.db().from('crm_tags')
      .insert({ tenant_id: tenantId, name, color: String(body?.color || '#64748b') })
      .select().single();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async attachTag(tenantId: string, body: any) {
    const tagId = CrmService.requireId(body?.tag_id, 'tag_id');
    const entityType = String(body?.entity_type || '');
    CrmService.assertEntityType(entityType);
    const entityId = CrmService.requireId(body?.entity_id, 'entity_id');
    // Le tag doit appartenir au tenant (garde-fou anti cross-tenant).
    const { data: tag } = await this.db()
      .from('crm_tags').select('id').eq('tenant_id', tenantId).eq('id', tagId).maybeSingle();
    if (!tag) throw new NotFoundException('tag introuvable');
    const { error } = await this.db().from('crm_taggables')
      .upsert({ tag_id: tagId, entity_type: entityType, entity_id: entityId, tenant_id: tenantId });
    if (error) throw new BadRequestException(error.message);
    return { ok: true };
  }

  async detachTag(tenantId: string, body: any) {
    const tagId = CrmService.requireId(body?.tag_id, 'tag_id');
    const entityType = String(body?.entity_type || '');
    CrmService.assertEntityType(entityType);
    const entityId = CrmService.requireId(body?.entity_id, 'entity_id');
    const { error } = await this.db().from('crm_taggables').delete()
      .eq('tenant_id', tenantId).eq('tag_id', tagId).eq('entity_type', entityType).eq('entity_id', entityId);
    if (error) throw new BadRequestException(error.message);
    return { ok: true };
  }

  // ─── Résumé (dashboard) ──────────────────────────────────────────────────────
  async summary(tenantId: string) {
    const db = this.db();
    const countOf = async (table: string, extra?: (q: any) => any) => {
      let q = db.from(table).select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId);
      if (extra) q = extra(q);
      const { count } = await q;
      return count ?? 0;
    };
    const [companies, contacts, openDeals, wonDeals] = await Promise.all([
      countOf('crm_companies'),
      countOf('crm_contacts'),
      countOf('crm_deals', (q) => q.eq('status', 'open')),
      countOf('crm_deals', (q) => q.eq('status', 'won')),
    ]);
    // Valeur du pipeline ouvert (somme amount des deals open).
    const { data: openRows } = await db.from('crm_deals')
      .select('amount, currency').eq('tenant_id', tenantId).eq('status', 'open');
    const pipelineValue: Record<string, number> = {};
    for (const r of openRows ?? []) {
      const cur = r.currency || 'EUR';
      pipelineValue[cur] = (pipelineValue[cur] || 0) + Number(r.amount || 0);
    }
    return { companies, contacts, openDeals, wonDeals, pipelineValue };
  }
}
