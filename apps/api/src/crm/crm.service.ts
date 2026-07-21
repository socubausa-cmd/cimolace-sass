import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { MarketingAdvancedService } from '../marketing/marketing-advanced.service';
import { WebhookService, type LiriWebhookEvent } from '../liri-public/webhook.service';
import { MessagingService } from '../messaging/messaging.service';
import { EmailEngineService } from '../email-engine/email-engine.service';

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
  constructor(
    private readonly supabase: SupabaseService,
    private readonly marketing: MarketingAdvancedService,
    private readonly webhooks: WebhookService,
    private readonly messaging: MessagingService,
    private readonly email: EmailEngineService,
  ) {}

  private db() {
    return this.supabase.client as any;
  }

  /**
   * Émet un webhook sortant CRM (crm.*) vers le SI du client (HMAC-signé, retry).
   * Fire-and-forget best-effort : ne bloque jamais l'opération métier.
   */
  private fireWebhook(tenantId: string, event: LiriWebhookEvent, data: Record<string, any>): void {
    try {
      void this.webhooks.emit(tenantId, event, data).catch(() => {});
    } catch {
      /* le webhook ne doit jamais casser une écriture CRM */
    }
  }

  /**
   * Émet un événement CRM dans le bus d'automations (best-effort, fire-and-forget) : le tenant
   * peut configurer des `marketing_automations` (trigger_condition = 'crm_deal_won' | 'crm_deal_lost'
   * | 'crm_contact_created') pour réagir (email, campagne…). Ne bloque JAMAIS l'opération métier ;
   * ne matche RIEN tant qu'aucune automation n'est configurée. `tenantId` est réinjecté par
   * runAutomation ; on transmet `email` (destinataire potentiel) + contexte du deal/contact.
   */
  private fireAutomation(tenantId: string, trigger: string, context: Record<string, any>): void {
    try {
      void this.marketing.runAutomation(tenantId, { trigger, context }).catch(() => {});
    } catch {
      /* le bus ne doit jamais casser une écriture CRM */
    }
  }

  /** Email du contact lié à un deal (pour cibler une automation). Best-effort. */
  private async dealContactEmail(tenantId: string, deal: any): Promise<string | null> {
    const contactId = deal?.contact_id;
    if (!contactId) return null;
    const rows = await this.safeRows(() =>
      this.db().from('crm_contacts').select('email').eq('tenant_id', tenantId).eq('id', contactId).limit(1),
    );
    return rows[0]?.email || null;
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
    opts: { search?: string; ownerId?: string; limit?: number; offset?: number } = {},
  ) {
    let q = this.db()
      .from('crm_companies')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .range(opts.offset ?? 0, (opts.offset ?? 0) + (opts.limit ?? 50) - 1);
    if (opts.search) q = q.ilike('name', `%${opts.search}%`);
    if (opts.ownerId) q = q.eq('owner_id', opts.ownerId);
    const { data, error } = await q;
    if (error) throw new BadRequestException(error.message);
    return { companies: data ?? [] };
  }

  async createCompany(tenantId: string, body: any, actorId: string | null = null) {
    const name = String(body?.name || '').trim();
    if (!name) throw new BadRequestException('name requis');
    const row: Record<string, any> = { ...CrmService.pick(body, CrmService.COMPANY_FIELDS), name, tenant_id: tenantId };
    if (row.owner_id && !(await this.isActiveMember(tenantId, String(row.owner_id)))) delete row.owner_id;
    const { data, error } = await this.db().from('crm_companies').insert(row).select().single();
    if (error) throw new BadRequestException(error.message);
    await this.recordActivity(tenantId, {
      entityType: 'company', entityId: data.id, type: 'company_created', actorId, title: `Société créée : ${data.name}`,
    });
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
    opts: { search?: string; companyId?: string; status?: string; ownerId?: string; limit?: number; offset?: number } = {},
  ) {
    let q = this.db()
      .from('crm_contacts')
      .select('*, company:crm_companies(id,name)')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .range(opts.offset ?? 0, (opts.offset ?? 0) + (opts.limit ?? 50) - 1);
    if (opts.companyId) q = q.eq('company_id', opts.companyId);
    if (opts.status) q = q.eq('status', opts.status);
    if (opts.ownerId) q = q.eq('owner_id', opts.ownerId);
    if (opts.search) q = q.or(`first_name.ilike.%${opts.search}%,last_name.ilike.%${opts.search}%,email.ilike.%${opts.search}%`);
    const { data, error } = await q;
    if (error) throw new BadRequestException(error.message);
    return { contacts: data ?? [] };
  }

  async createContact(tenantId: string, body: any, actorId: string | null = null) {
    const row: Record<string, any> = { ...CrmService.pick(body, CrmService.CONTACT_FIELDS), tenant_id: tenantId };
    if (!row.first_name && !row.last_name && !row.email) {
      throw new BadRequestException('au moins un nom ou un email est requis');
    }
    if (row.owner_id && !(await this.isActiveMember(tenantId, String(row.owner_id)))) delete row.owner_id;
    const { data, error } = await this.db().from('crm_contacts').insert(row).select().single();
    if (error) throw new BadRequestException(error.message);
    await this.recordActivity(tenantId, {
      entityType: 'contact', entityId: data.id, type: 'contact_created', actorId,
      title: `Contact créé : ${[data.first_name, data.last_name].filter(Boolean).join(' ') || data.email || 'sans nom'}`,
    });
    this.fireAutomation(tenantId, 'crm_contact_created', {
      email: data.email || null,
      contactId: data.id,
      name: [data.first_name, data.last_name].filter(Boolean).join(' ') || null,
    });
    this.fireWebhook(tenantId, 'crm.contact.created', {
      contactId: data.id, email: data.email || null,
      name: [data.first_name, data.last_name].filter(Boolean).join(' ') || null,
    });
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

  /** Résout l'identité plateforme d'un contact : userId SEULEMENT si membre actif du tenant. */
  private async resolveContactMember(tenantId: string, contactId: string): Promise<{ userId: string | null; name: string; email: string | null }> {
    const { data: contact } = await this.db()
      .from('crm_contacts').select('first_name, last_name, email')
      .eq('tenant_id', tenantId).eq('id', contactId).maybeSingle();
    if (!contact) throw new NotFoundException('contact introuvable');
    const name = [contact.first_name, contact.last_name].filter(Boolean).join(' ') || contact.email || 'Contact';
    const email = String(contact.email || '').trim().toLowerCase();
    if (!email) return { userId: null, name, email: null };
    const profs = await this.safeRows(() =>
      this.db().from('profiles').select('id').ilike('email', CrmService.escapeLike(email)).limit(1),
    );
    const uid = profs[0]?.id || null;
    if (!uid) return { userId: null, name, email };
    const members = await this.safeRows(() =>
      this.db().from('tenant_memberships').select('status')
        .eq('tenant_id', tenantId).eq('user_id', uid).eq('status', 'active').limit(1),
    );
    return { userId: members[0] ? uid : null, name, email };
  }

  /**
   * Envoie un VRAI message (messagerie immersive) depuis une fiche contact, au nom de
   * l'opérateur. Refuse si le contact n'est pas un membre actif de l'espace (403 métier).
   */
  async sendMessageToContact(tenantId: string, senderId: string, contactId: string, content: string) {
    const id = CrmService.requireId(contactId, 'contactId');
    const text = String(content || '').trim();
    if (!text) throw new BadRequestException('content requis');
    const { userId, name } = await this.resolveContactMember(tenantId, id);
    if (!userId) throw new BadRequestException('contact non joignable : pas un membre actif de l’espace');
    const result = await this.messaging.sendMessage(
      { id: tenantId } as any, senderId, { recipientId: userId, content: text } as any,
    );
    await this.recordActivity(tenantId, {
      entityType: 'contact', entityId: id, type: 'message_sent',
      title: `Message envoyé à ${name}`, actorId: senderId,
    });
    return { ok: true, result };
  }

  /**
   * Convertit un lead du Growth Engine en contact CRM (lien lead_id conservé).
   * Marque le lead comme 'customer'. Idempotent-ish : refuse si déjà converti.
   */
  async convertLead(tenantId: string, leadId: string, actorId: string | null = null) {
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
    await this.recordActivity(tenantId, {
      entityType: 'contact', entityId: contact.id, type: 'lead_converted', actorId,
      title: `Lead converti en contact${contact.email ? ` : ${contact.email}` : ''}`, meta: { lead_id: leadId },
    });
    return contact;
  }

  /**
   * Import CSV de contacts en lot. Chaque ligne : {first_name,last_name,email,phone,title,company}.
   * Les sociétés sont résolues par NOM (find-or-create, insensible à la casse, dédupliquées dans le lot).
   * Tenant-scopé, plafonné, best-effort par ligne (une ligne en erreur n'annule pas les autres).
   */
  async importContacts(tenantId: string, rows: any[]) {
    if (!Array.isArray(rows) || !rows.length) throw new BadRequestException('aucune ligne à importer');
    if (rows.length > 1000) throw new BadRequestException('max 1000 lignes par import');

    // Précharge les sociétés existantes pour matcher par nom sans une requête par ligne.
    const { data: existingCos } = await this.db()
      .from('crm_companies').select('id, name').eq('tenant_id', tenantId);
    const coByName = new Map<string, string>(
      (existingCos ?? []).map((c: any) => [String(c.name || '').trim().toLowerCase(), c.id]),
    );

    let created = 0;
    let skipped = 0;
    let companiesCreated = 0;
    const errors: { line: number; error: string }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const raw = rows[i] || {};
      const email = String(raw.email || '').trim().toLowerCase() || null;
      const first = String(raw.first_name || raw.firstName || '').trim() || null;
      const last = String(raw.last_name || raw.lastName || '').trim() || null;
      if (!email && !first && !last) { skipped++; continue; } // ligne vide → ignorée

      let company_id: string | null = null;
      const coName = String(raw.company || raw.company_name || raw.societe || '').trim();
      if (coName) {
        const key = coName.toLowerCase();
        if (coByName.has(key)) {
          company_id = coByName.get(key)!;
        } else {
          const { data: co } = await this.db()
            .from('crm_companies').insert({ tenant_id: tenantId, name: coName }).select('id').single();
          if (co?.id) { company_id = co.id; coByName.set(key, co.id); companiesCreated++; }
        }
      }

      const row = {
        tenant_id: tenantId,
        first_name: first,
        last_name: last,
        email,
        phone: String(raw.phone || raw.telephone || '').trim() || null,
        title: String(raw.title || raw.fonction || '').trim() || null,
        source: 'import',
        company_id,
      };
      const { error } = await this.db().from('crm_contacts').insert(row);
      if (error) { errors.push({ line: i + 1, error: error.message }); skipped++; }
      else created++;
    }

    return { created, skipped, companiesCreated, errors: errors.slice(0, 20) };
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

  // ─── CRUD pipelines & étapes (#10) — le tenant n'est plus figé sur les 6 étapes seedées ──
  private static PIPELINE_FIELDS = ['name', 'is_default', 'position'];
  private static STAGE_FIELDS = ['name', 'position', 'win_probability', 'is_won', 'is_lost'];

  async updatePipeline(tenantId: string, id: string, body: any) {
    CrmService.requireId(id);
    const patch = CrmService.pick(body, CrmService.PIPELINE_FIELDS);
    if (Object.keys(patch).length === 0) throw new BadRequestException('aucun champ à mettre à jour');
    const { data, error } = await this.db().from('crm_pipelines').update(patch)
      .eq('tenant_id', tenantId).eq('id', id).select().maybeSingle();
    if (error) throw new BadRequestException(error.message);
    if (!data) throw new NotFoundException('pipeline introuvable');
    return data;
  }

  async deletePipeline(tenantId: string, id: string) {
    CrmService.requireId(id);
    // Refuser la suppression du dernier pipeline (garde-fou : dealsBoard exige un pipeline).
    const { count } = await this.db().from('crm_pipelines')
      .select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId);
    if ((count ?? 0) <= 1) throw new BadRequestException('impossible de supprimer le dernier pipeline');
    // Refuser un pipeline non vide (sinon ses étapes cascadent et ses deals perdent leur étape).
    const { count: dealCount } = await this.db().from('crm_deals')
      .select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('pipeline_id', id);
    if (dealCount) throw new BadRequestException(`pipeline non vide (${dealCount} deal(s)) — déplacez ses deals avant de le supprimer`);
    const { error } = await this.db().from('crm_pipelines').delete().eq('tenant_id', tenantId).eq('id', id);
    if (error) throw new BadRequestException(error.message);
    return { ok: true };
  }

  async createStage(tenantId: string, body: any) {
    const pipelineId = CrmService.requireId(body?.pipeline_id, 'pipeline_id');
    const name = String(body?.name || '').trim();
    if (!name) throw new BadRequestException('name requis');
    // Le pipeline doit appartenir au tenant.
    const { data: pl } = await this.db().from('crm_pipelines').select('id').eq('tenant_id', tenantId).eq('id', pipelineId).maybeSingle();
    if (!pl) throw new NotFoundException('pipeline introuvable');
    let position = Number(body?.position);
    if (!Number.isFinite(position)) {
      const { data: last } = await this.db().from('crm_stages').select('position')
        .eq('tenant_id', tenantId).eq('pipeline_id', pipelineId).order('position', { ascending: false }).limit(1).maybeSingle();
      position = (Number(last?.position) || 0) + 1;
    }
    const row = {
      ...CrmService.pick(body, CrmService.STAGE_FIELDS),
      tenant_id: tenantId, pipeline_id: pipelineId, name, position,
      is_won: !!body?.is_won, is_lost: !!body?.is_lost,
    };
    const { data, error } = await this.db().from('crm_stages').insert(row).select().single();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async updateStage(tenantId: string, id: string, body: any) {
    CrmService.requireId(id);
    const patch = CrmService.pick(body, CrmService.STAGE_FIELDS);
    if (Object.keys(patch).length === 0) throw new BadRequestException('aucun champ à mettre à jour');
    const { data, error } = await this.db().from('crm_stages').update(patch)
      .eq('tenant_id', tenantId).eq('id', id).select().maybeSingle();
    if (error) throw new BadRequestException(error.message);
    if (!data) throw new NotFoundException('étape introuvable');
    return data;
  }

  async deleteStage(tenantId: string, id: string) {
    CrmService.requireId(id);
    // crm_deals.stage_id → ON DELETE SET NULL (deals orphelins gérés par dealsBoard.orphans).
    const { error } = await this.db().from('crm_stages').delete().eq('tenant_id', tenantId).eq('id', id);
    if (error) throw new BadRequestException(error.message);
    return { ok: true };
  }

  /** Réordonne les étapes d'un pipeline (positions = index dans la liste fournie). Best-effort séquentiel. */
  async reorderStages(tenantId: string, pipelineId: string, orderedIds: string[]) {
    CrmService.requireId(pipelineId, 'pipelineId');
    if (!Array.isArray(orderedIds) || !orderedIds.length) throw new BadRequestException('orderedIds requis');
    for (let i = 0; i < orderedIds.length; i++) {
      await this.db().from('crm_stages').update({ position: i })
        .eq('tenant_id', tenantId).eq('pipeline_id', pipelineId).eq('id', orderedIds[i]);
    }
    return this.listStages(tenantId, pipelineId);
  }

  // ─── Deals (kanban) ────────────────────────────────────────────────────────
  private static DEAL_FIELDS = [
    'pipeline_id', 'stage_id', 'company_id', 'contact_id', 'title',
    'amount', 'currency', 'status', 'expected_close_date', 'position', 'owner_id',
  ];

  /** Vue kanban : le pipeline (défaut si non fourni) + ses étapes, chacune avec ses deals. */
  async dealsBoard(tenantId: string, pipelineId?: string, ownerId?: string) {
    const pipeline = pipelineId
      ? (await this.db().from('crm_pipelines').select('*').eq('tenant_id', tenantId).eq('id', pipelineId).maybeSingle()).data
      : await this.ensureDefaultPipeline(tenantId);
    if (!pipeline) throw new NotFoundException('pipeline introuvable');

    let dealsQ = this.db().from('crm_deals')
      .select('*, company:crm_companies(id,name), contact:crm_contacts(id,first_name,last_name)')
      .eq('tenant_id', tenantId).eq('pipeline_id', pipeline.id)
      .order('position', { ascending: true });
    if (ownerId) dealsQ = dealsQ.eq('owner_id', ownerId);
    const [{ data: stages }, { data: deals }] = await Promise.all([
      this.db().from('crm_stages').select('*')
        .eq('tenant_id', tenantId).eq('pipeline_id', pipeline.id)
        .order('position', { ascending: true }),
      dealsQ,
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

  async createDeal(tenantId: string, body: any, actorId: string | null = null) {
    const title = String(body?.title || '').trim();
    if (!title) throw new BadRequestException('title requis');
    // #8 : les références fournies doivent appartenir au tenant (anti-rattachement cross-tenant).
    if (body?.company_id) await this.assertEntityExists(tenantId, 'company', String(body.company_id));
    if (body?.contact_id) await this.assertEntityExists(tenantId, 'contact', String(body.contact_id));
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
    await this.recordActivity(tenantId, {
      entityType: 'deal', entityId: data.id, type: 'deal_created', actorId,
      title: `Deal créé : ${data.title}`, meta: { amount: data.amount, currency: data.currency },
    });
    this.fireWebhook(tenantId, 'crm.deal.created', {
      dealId: data.id, title: data.title, amount: data.amount ?? null,
      currency: data.currency ?? null, contactId: data.contact_id ?? null,
    });
    return data;
  }

  async updateDeal(tenantId: string, id: string, body: any, actorId: string | null = null) {
    CrmService.requireId(id);
    const patch = CrmService.pick(body, CrmService.DEAL_FIELDS);
    if (Object.keys(patch).length === 0) throw new BadRequestException('aucun champ à mettre à jour');
    if (patch.company_id) await this.assertEntityExists(tenantId, 'company', String(patch.company_id));
    if (patch.contact_id) await this.assertEntityExists(tenantId, 'contact', String(patch.contact_id));
    // État PRÉCÉDENT : ne déclencher les automations/webhooks que sur un CHANGEMENT réel
    // (transition won/lost pour l'email ; changement d'étape effectif pour stage_moved).
    let prevStatus: string | null = null;
    let prevStageId: string | null = null;
    if (patch.status !== undefined || patch.stage_id !== undefined) {
      const { data: cur } = await this.db()
        .from('crm_deals').select('status, stage_id').eq('tenant_id', tenantId).eq('id', id).maybeSingle();
      prevStatus = cur?.status ?? null;
      prevStageId = cur?.stage_id ?? null;
    }
    // #10 : déplacer un deal vers une étape is_won/is_lost DÉRIVE le statut (sauf statut explicite).
    if (patch.stage_id !== undefined && patch.status === undefined) {
      const { data: st } = await this.db().from('crm_stages').select('is_won, is_lost')
        .eq('tenant_id', tenantId).eq('id', patch.stage_id).maybeSingle();
      if (st) patch.status = st.is_won ? 'won' : st.is_lost ? 'lost' : 'open';
    }
    // Cohérence statut/clôture : si won/lost, horodater closed_at ; si ré-ouvert, l'effacer.
    if (patch.status === 'won' || patch.status === 'lost') patch.closed_at = new Date().toISOString();
    else if (patch.status === 'open') patch.closed_at = null;
    const { data, error } = await this.db()
      .from('crm_deals').update(patch)
      .eq('tenant_id', tenantId).eq('id', id).select().maybeSingle();
    if (error) throw new BadRequestException(error.message);
    if (!data) throw new NotFoundException('deal introuvable');
    const actType =
      patch.status === 'won' ? 'deal_won'
      : patch.status === 'lost' ? 'deal_lost'
      : patch.stage_id !== undefined ? 'deal_stage_moved'
      : 'deal_updated';
    const actTitle =
      actType === 'deal_won' ? `Deal gagné : ${data.title}`
      : actType === 'deal_lost' ? `Deal perdu : ${data.title}`
      : actType === 'deal_stage_moved' ? `Deal déplacé : ${data.title}`
      : `Deal modifié : ${data.title}`;
    await this.recordActivity(tenantId, {
      entityType: 'deal', entityId: data.id, type: actType, title: actTitle, actorId,
      meta: { stage_id: data.stage_id, status: data.status },
    });
    // Automations + webhooks : UNIQUEMENT sur transition (open/autre → won/lost) — anti re-émission.
    const becameWon = patch.status === 'won' && prevStatus !== 'won';
    const becameLost = patch.status === 'lost' && prevStatus !== 'lost';
    if (becameWon || becameLost) {
      const email = await this.dealContactEmail(tenantId, data);
      const evtCtx = {
        email, contactId: data.contact_id ?? null,
        dealId: data.id, dealTitle: data.title, amount: data.amount ?? null, currency: data.currency ?? null,
      };
      this.fireAutomation(tenantId, becameWon ? 'crm_deal_won' : 'crm_deal_lost', evtCtx);
      this.fireWebhook(tenantId, becameWon ? 'crm.deal.won' : 'crm.deal.lost', evtCtx);
    } else if (patch.stage_id !== undefined && (data.stage_id ?? null) !== prevStageId) {
      this.fireWebhook(tenantId, 'crm.deal.stage_moved', { dealId: data.id, stageId: data.stage_id ?? null, contactId: data.contact_id ?? null });
    }
    return data;
  }

  async deleteDeal(tenantId: string, id: string, actorId: string | null = null) {
    CrmService.requireId(id);
    const { error } = await this.db()
      .from('crm_deals').delete().eq('tenant_id', tenantId).eq('id', id);
    if (error) throw new BadRequestException(error.message);
    await this.recordActivity(tenantId, { entityType: 'deal', entityId: id, type: 'deal_deleted', title: 'Deal supprimé', actorId });
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

  async createNote(tenantId: string, body: any, actorId: string | null = null) {
    const entityType = String(body?.entity_type || '');
    CrmService.assertEntityType(entityType);
    const entityId = CrmService.requireId(body?.entity_id, 'entity_id');
    await this.assertEntityExists(tenantId, entityType, entityId); // #21 : rattachement valide
    const bodyText = String(body?.body || '').trim();
    if (!bodyText) throw new BadRequestException('body requis');
    const row = {
      tenant_id: tenantId, entity_type: entityType, entity_id: entityId,
      body: bodyText, author_id: body?.author_id ?? actorId ?? null,
    };
    const { data, error } = await this.db().from('crm_notes').insert(row).select().single();
    if (error) throw new BadRequestException(error.message);
    await this.recordActivity(tenantId, {
      entityType, entityId, type: 'note_added', title: 'Note ajoutée', actorId, meta: { note_id: data.id },
    });
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
    opts: { status?: string; entityType?: string; entityId?: string; assigneeId?: string; due?: string } = {},
  ) {
    let q = this.db().from('crm_tasks').select('*').eq('tenant_id', tenantId)
      .order('due_date', { ascending: true, nullsFirst: false });
    if (opts.status) q = q.eq('status', opts.status);
    if (opts.entityType) q = q.eq('entity_type', opts.entityType);
    if (opts.entityId) q = q.eq('entity_id', opts.entityId);
    if (opts.assigneeId) q = q.eq('assignee_id', opts.assigneeId);
    const today = new Date().toISOString().slice(0, 10);
    if (opts.due === 'overdue') q = q.lt('due_date', today).neq('status', 'done');
    else if (opts.due === 'today') q = q.eq('due_date', today);
    else if (opts.due === 'upcoming') q = q.gt('due_date', today);
    const { data, error } = await q;
    if (error) throw new BadRequestException(error.message);
    return { tasks: data ?? [] };
  }

  async createTask(tenantId: string, body: any) {
    const title = String(body?.title || '').trim();
    if (!title) throw new BadRequestException('title requis');
    if (body?.entity_type) {
      CrmService.assertEntityType(String(body.entity_type));
      if (body?.entity_id) await this.assertEntityExists(tenantId, String(body.entity_type), String(body.entity_id));
    }
    // #11 : assignee invalide (non membre actif) → ignoré silencieusement plutôt que rattaché à un fantôme.
    if (body?.assignee_id && !(await this.isActiveMember(tenantId, String(body.assignee_id)))) body.assignee_id = null;
    const row = { ...CrmService.pick(body, CrmService.TASK_FIELDS), title, tenant_id: tenantId };
    const { data, error } = await this.db().from('crm_tasks').insert(row).select().single();
    if (error) throw new BadRequestException(error.message);
    this.fireWebhook(tenantId, 'crm.task.created', {
      taskId: data.id, title: data.title, entityType: data.entity_type ?? null,
      entityId: data.entity_id ?? null, assigneeId: data.assignee_id ?? null, dueDate: data.due_date ?? null,
    });
    // Notif email best-effort à l'assignee (clé Resend du tenant ; jamais bloquant).
    if (data.assignee_id) void this.notifyAssignee(tenantId, data).catch(() => {});
    return data;
  }

  /** Échappe une chaîne pour insertion sûre dans du HTML (anti-injection dans les emails). */
  private static escapeHtml(s: string): string {
    return String(s ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /**
   * Notifie par email l'assignee d'une tâche (best-effort, clé Resend tenant).
   * ⚠️ N'emaile QUE si l'assignee est un membre ACTIF de CE tenant (pas d'email arbitraire
   * cross-tenant), applique le cap anti-spam marketing, et échappe le titre injecté dans le HTML.
   */
  private async notifyAssignee(tenantId: string, task: any): Promise<void> {
    const members = await this.safeRows(() =>
      this.db().from('tenant_memberships').select('user_id')
        .eq('tenant_id', tenantId).eq('user_id', task.assignee_id).eq('status', 'active').limit(1),
    );
    if (!members[0]) return; // assignee hors tenant → on n'emaile pas
    const rows = await this.safeRows(() =>
      this.db().from('profiles').select('email').eq('id', task.assignee_id).limit(1),
    );
    const to = String(rows[0]?.email || '').trim();
    if (!to) return;
    if (await this.marketing.guardAutomationEmail(tenantId, to)) return; // cap anti-spam
    const safeTitle = CrmService.escapeHtml(task.title);
    const due = task.due_date ? ` (échéance ${String(task.due_date).slice(0, 10)})` : '';
    await this.email.sendRaw(
      tenantId, to, `Nouvelle tâche : ${safeTitle}`,
      `<p>Une tâche vous a été assignée : <strong>${safeTitle}</strong>${due}.</p>`,
    );
  }

  async updateTask(tenantId: string, id: string, body: any) {
    CrmService.requireId(id);
    const patch = CrmService.pick(body, CrmService.TASK_FIELDS);
    if (Object.keys(patch).length === 0) throw new BadRequestException('aucun champ à mettre à jour');
    // #11 : un nouvel assignee doit être membre actif ; null autorisé (désassignation).
    if (patch.assignee_id && !(await this.isActiveMember(tenantId, String(patch.assignee_id)))) patch.assignee_id = null;
    if (patch.entity_type && patch.entity_id) await this.assertEntityExists(tenantId, String(patch.entity_type), String(patch.entity_id));
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

  /** Tags ATTACHÉS à une entité (jointure crm_taggables → crm_tags), tenant-scopé. */
  async listEntityTags(tenantId: string, entityType: string, entityId: string) {
    CrmService.assertEntityType(entityType);
    CrmService.requireId(entityId, 'entity_id');
    const { data, error } = await this.db()
      .from('crm_taggables')
      .select('tag:crm_tags(id,name,color)')
      .eq('tenant_id', tenantId)
      .eq('entity_type', entityType)
      .eq('entity_id', entityId);
    if (error) throw new BadRequestException(error.message);
    return { tags: (data ?? []).map((r: any) => r.tag).filter(Boolean) };
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
    await this.assertEntityExists(tenantId, entityType, entityId); // #21 : entité valide dans le tenant
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
    const today = new Date().toISOString().slice(0, 10);
    const [companies, contacts, openDeals, wonDeals, tasksOpen, tasksDueToday, tasksOverdue] = await Promise.all([
      countOf('crm_companies'),
      countOf('crm_contacts'),
      countOf('crm_deals', (q) => q.eq('status', 'open')),
      countOf('crm_deals', (q) => q.eq('status', 'won')),
      countOf('crm_tasks', (q) => q.neq('status', 'done')),
      countOf('crm_tasks', (q) => q.eq('due_date', today).neq('status', 'done')),
      countOf('crm_tasks', (q) => q.lt('due_date', today).neq('status', 'done')),
    ]);
    // Valeur du pipeline ouvert (somme amount des deals open).
    const { data: openRows } = await db.from('crm_deals')
      .select('amount, currency').eq('tenant_id', tenantId).eq('status', 'open');
    const pipelineValue: Record<string, number> = {};
    for (const r of openRows ?? []) {
      const cur = r.currency || 'EUR';
      pipelineValue[cur] = (pipelineValue[cur] || 0) + Number(r.amount || 0);
    }
    return {
      companies, contacts, openDeals, wonDeals, pipelineValue,
      tasks: { open: tasksOpen, dueToday: tasksDueToday, overdue: tasksOverdue },
    };
  }

  // ─── Timeline d'activités (Vague 4) ──────────────────────────────────────────
  /**
   * Journalise un événement CRM (best-effort : ne casse JAMAIS l'opération métier —
   * l'insert supabase-js renvoie {error} sans throw, et un éventuel throw est avalé).
   */
  private async recordActivity(
    tenantId: string,
    a: { entityType?: string | null; entityId?: string | null; type: string; title?: string; meta?: any; actorId?: string | null },
  ): Promise<void> {
    try {
      await this.db().from('crm_activities').insert({
        tenant_id: tenantId,
        entity_type: a.entityType ?? null,
        entity_id: a.entityId ?? null,
        type: a.type,
        title: a.title ?? '',
        meta: a.meta ?? {},
        actor_id: a.actorId ?? null,
      });
    } catch {
      /* timeline best-effort : ignorer toute erreur d'audit */
    }
  }

  /** Timeline : flux récent global, ou filtré par entité (entity_type + entity_id). */
  async listActivities(
    tenantId: string,
    opts: { entityType?: string; entityId?: string; limit?: number } = {},
  ) {
    let q = this.db()
      .from('crm_activities')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(Math.min(Math.max(Number(opts.limit) || 50, 1), 200));
    if (opts.entityType) q = q.eq('entity_type', opts.entityType);
    if (opts.entityId) q = q.eq('entity_id', opts.entityId);
    const { data, error } = await q;
    if (error) throw new BadRequestException(error.message);
    const acts = data ?? [];
    // Résoudre le NOM de l'auteur (actor_id → profiles) pour l'affichage « qui a agi ».
    const actorIds = [...new Set(acts.map((a: any) => a.actor_id).filter(Boolean))];
    if (actorIds.length) {
      const profs = await this.safeRows(() => this.db().from('profiles').select('id, name, full_name').in('id', actorIds));
      const nameById = new Map<string, string>(profs.map((p: any) => [p.id, p.full_name || p.name || '']));
      for (const a of acts) a.actor_name = a.actor_id ? nameById.get(a.actor_id) || null : null;
    }
    return { activities: acts };
  }

  // ─── Reliure écosystème (Vague 5) ────────────────────────────────────────────
  // Un contact CRM = une personne (email/nom), PAS forcément une identité plateforme.
  // Le SEUL pont vers le reste de l'écosystème (messagerie immersive, boutique mbolo,
  // RDV, services, forum) est l'EMAIL :
  //   crm_contacts.email (lower) → profiles.email (lower) → profiles.id (= user_id
  //   = auth.users.id, la clé universelle) → tenant_memberships actif du tenant courant.
  // ⚠️ profiles/auth.users sont GLOBAUX (cross-tenant) : seule la membership porte la
  // frontière tenant → on exige TOUJOURS status='active' sur le tenant courant, sinon on
  // « contacterait/enrichirait » un homonyme d'un autre tenant. Toutes les requêtes de
  // fan-out restent .eq('tenant_id', tenantId). Lecture seule : aucune écriture côté CRM.

  /** Échappe les métacaractères LIKE (%, _, \) pour un match email insensible à la casse et sûr. */
  private static escapeLike(value: string): string {
    return value.replace(/[\\%_]/g, (m) => `\\${m}`);
  }

  /** Lève si un résultat supabase-js porte une erreur (les writes ne throw pas d'eux-mêmes). */
  private static chk(r: any): void {
    if (r?.error) throw new BadRequestException(r.error.message);
  }

  /** Vrai si valeur « vide » (null/undefined/chaîne vide) — pour le remplissage à la fusion. */
  private static isBlank(v: any): boolean {
    return v == null || (typeof v === 'string' && v.trim() === '');
  }

  /** SELECT best-effort : renvoie [] sur toute erreur (table absente, drift schéma…). */
  private async safeRows(build: () => any): Promise<any[]> {
    try {
      const { data, error } = await build();
      if (error) return [];
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }

  /** COUNT best-effort (head:true) : renvoie 0 sur toute erreur. */
  private async safeCount(build: () => any): Promise<number> {
    try {
      const { count, error } = await build();
      if (error) return 0;
      return count ?? 0;
    } catch {
      return 0;
    }
  }

  /**
   * Résout l'identité plateforme d'un contact (email → user_id + membership active),
   * puis enrichit sa fiche en éventail : commandes mbolo, RDV (LIRI + MEDOS), services
   * achetés, activité forum. Tenant-scopé, read-only, tout best-effort (une brique
   * absente n'échoue jamais l'ensemble).
   */
  async getContactPlatformLink(tenantId: string, contactId: string) {
    const id = CrmService.requireId(contactId, 'contactId');
    const { data: contact, error } = await this.db()
      .from('crm_contacts')
      .select('id, first_name, last_name, email, phone, company:crm_companies(id,name)')
      .eq('tenant_id', tenantId)
      .eq('id', id)
      .maybeSingle();
    if (error) throw new BadRequestException(error.message);
    if (!contact) throw new NotFoundException('contact introuvable');

    const email = String(contact.email || '').trim().toLowerCase();
    const displayName =
      [contact.first_name, contact.last_name].filter(Boolean).join(' ') || contact.email || 'Contact';

    const result: any = {
      contact: {
        id: contact.id,
        name: displayName,
        email: contact.email || null,
        phone: contact.phone || null,
        company: contact.company || null,
      },
      isPlatformUser: false, // membre actif du tenant courant (seule condition d'exposition d'identité)
      hasAccount: false, // == isPlatformUser (membre actif) : jamais un compte d'un AUTRE tenant
      userId: null as string | null,
      fullName: null as string | null,
      role: null as string | null,
      orders: [] as any[],
      appointments: [] as any[],
      services: [] as any[],
      forum: { topics: 0, posts: 0, questions: 0, total: 0 },
      messaging: { conversations: 0, lastMessageAt: null as string | null },
      counts: { orders: 0, appointments: 0, services: 0, forum: 0, messaging: 0 },
    };

    if (!email) return result; // contact sans email → non rattachable à une identité

    // 1) email → profil GLOBAL (case-insensitive). ⚠️ profiles/auth sont GLOBAUX (cross-tenant) :
    //    on ne dévoile RIEN (UUID, nom, existence de compte) tant que l'appartenance au tenant
    //    courant n'est pas prouvée — sinon un owner du tenant A sonderait l'identité/l'existence
    //    de compte d'un homonyme appartenant uniquement à un autre tenant (fuite PII + oracle).
    const emailLike = CrmService.escapeLike(email);
    const profiles = await this.safeRows(() =>
      this.db().from('profiles').select('id, name, full_name, email').ilike('email', emailLike).limit(1),
    );
    const prof = profiles[0];
    const resolvedUserId: string | null = prof?.id || null;

    // 2) membership ACTIVE du tenant courant — résolue AVANT toute exposition d'identité.
    let active: any = null;
    if (resolvedUserId) {
      const memberships = await this.safeRows(() =>
        this.db()
          .from('tenant_memberships')
          .select('role, status')
          .eq('tenant_id', tenantId)
          .eq('user_id', resolvedUserId)
          .eq('status', 'active')
          .limit(1),
      );
      active = memberships[0] || null;
    }
    // Identité plateforme (UUID, nom, compte) exposée UNIQUEMENT pour un membre actif de CE tenant.
    // Le fan-out par user (RDV/services/forum/messagerie) devient inerte si userId=null.
    const userId: string | null = active ? resolvedUserId : null;
    result.isPlatformUser = !!active;
    result.hasAccount = !!active;
    result.role = active?.role || null;
    result.userId = userId;
    result.fullName = active ? prof?.full_name || prof?.name || null : null;

    // 3) Fan-out enrichissement (tenant-scopé). Commandes : matchables même invité (email).
    const ordersByEmail = await this.safeRows(() =>
      this.db()
        .from('mbolo_orders')
        .select('*')
        .eq('tenant_id', tenantId)
        .ilike('customer_email', emailLike)
        .order('created_at', { ascending: false })
        .limit(50),
    );
    const ordersByUser = userId
      ? await this.safeRows(() =>
          this.db()
            .from('mbolo_orders')
            .select('*')
            .eq('tenant_id', tenantId)
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(50),
        )
      : [];
    const orderMap = new Map<string, any>();
    for (const o of [...ordersByEmail, ...ordersByUser]) orderMap.set(o.id, o);
    result.orders = [...orderMap.values()]
      .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))
      .map((o) => ({
        id: o.id,
        order_number: o.order_number || null,
        status: o.status || null,
        payment_status: o.payment_status || null,
        amount:
          o.total_cents != null
            ? Number(o.total_cents) / 100
            : o.total != null
              ? Number(o.total)
              : null,
        currency: o.currency || 'EUR',
        channel: o.channel || null,
        created_at: o.created_at || null,
      }));

    if (userId) {
      // RDV LIRI/école (clé student_id).
      const liriRdv = await this.safeRows(() =>
        this.db()
          .from('appointments')
          .select('*')
          .eq('tenant_id', tenantId)
          .eq('student_id', userId)
          .order('created_at', { ascending: false })
          .limit(50),
      );
      // RDV MEDOS/santé (clé indirecte : med_patients.patient_user_id → med_appointments.patient_id).
      const patients = await this.safeRows(() =>
        this.db()
          .from('med_patients')
          .select('id')
          .eq('tenant_id', tenantId)
          .eq('patient_user_id', userId),
      );
      const patientIds = patients.map((p: any) => p.id).filter(Boolean);
      const medRdv = patientIds.length
        ? await this.safeRows(() =>
            this.db()
              .from('med_appointments')
              .select('*')
              .eq('tenant_id', tenantId)
              .in('patient_id', patientIds)
              .order('scheduled_at', { ascending: false })
              .limit(50),
          )
        : [];
      // Dates réelles des RDV LIRI via booking_slots.start_at (appointments n'a pas de colonne date).
      const slotIds = liriRdv.map((a: any) => a.slot_id).filter(Boolean);
      const slots = slotIds.length
        ? await this.safeRows(() =>
            this.db().from('booking_slots').select('id, start_at').eq('tenant_id', tenantId).in('id', slotIds),
          )
        : [];
      const slotStart = new Map<string, string>(slots.map((s: any) => [s.id, s.start_at]));
      result.appointments = [
        ...liriRdv.map((a: any) => ({
          id: a.id,
          kind: 'liri',
          status: a.status || null,
          at: slotStart.get(a.slot_id) || a.created_at || null,
          created_at: a.created_at || null,
        })),
        ...medRdv.map((a: any) => ({
          id: a.id,
          kind: 'medos',
          status: a.status || null,
          at: a.scheduled_at || a.created_at || null,
          created_at: a.created_at || null,
        })),
      ].sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')));

      // Services achetés (masterclass / consultation) = access_passes resource_type='service'.
      const passes = await this.safeRows(() =>
        this.db()
          .from('access_passes')
          .select('*')
          .eq('tenant_id', tenantId)
          .eq('user_id', userId)
          .eq('resource_type', 'service')
          .order('created_at', { ascending: false })
          .limit(50),
      );
      result.services = passes.map((p: any) => ({
        id: p.id,
        resource_id: p.resource_id || null,
        status: p.status || null,
        created_at: p.created_at || null,
      }));

      // Forum : 3 systèmes coexistants (legacy + conversations kind='topic' + Q&A cours).
      const [legacyTopics, connectedTopics, legacyPosts, questions] = await Promise.all([
        this.safeCount(() =>
          this.db()
            .from('forum_topics')
            .select('id', { count: 'exact', head: true })
            .eq('tenant_id', tenantId)
            .eq('author_id', userId),
        ),
        this.safeCount(() =>
          this.db()
            .from('conversations')
            .select('id', { count: 'exact', head: true })
            .eq('tenant_id', tenantId)
            .eq('kind', 'topic')
            .eq('created_by', userId),
        ),
        this.safeCount(() =>
          this.db()
            .from('forum_posts')
            .select('id', { count: 'exact', head: true })
            .eq('tenant_id', tenantId)
            .eq('author_id', userId),
        ),
        this.safeCount(() =>
          this.db()
            .from('formation_student_questions')
            .select('id', { count: 'exact', head: true })
            .eq('tenant_id', tenantId)
            .eq('student_id', userId),
        ),
      ]);
      result.forum = {
        topics: legacyTopics + connectedTopics,
        posts: legacyPosts,
        questions,
        total: legacyTopics + connectedTopics + legacyPosts + questions,
      };

      // Messagerie immersive : conversations DM du contact (aperçu).
      result.messaging = await this.loadMessagingSummary(tenantId, userId);
    }

    result.counts = {
      orders: result.orders.length,
      appointments: result.appointments.length,
      services: result.services.length,
      forum: result.forum.total,
      messaging: result.messaging.conversations,
    };
    return result;
  }

  /**
   * Résumé messagerie DM d'un utilisateur : SIGNAL D'ACTIVITÉ uniquement (nombre de
   * conversations directes + date de dernière activité). Best-effort, tenant-scopé.
   * ⚠️ CONFIDENTIALITÉ : n'expose NI le contenu des messages NI l'identité des correspondants.
   * La lecture d'un DM privé est réservée à ses participants ; un owner/admin non-partie ne
   * doit voir qu'un compteur, pas le fil. (Appelé uniquement pour un membre actif → userId gaté.)
   * NB : les conversations kind='topic'/'group' relèvent du forum → filtrées (type='direct').
   */
  private async loadMessagingSummary(tenantId: string, userId: string) {
    const empty = { conversations: 0, lastMessageAt: null as string | null };
    const parts = await this.safeRows(() =>
      this.db()
        .from('conversation_participants')
        .select('conversation_id')
        .eq('tenant_id', tenantId)
        .eq('user_id', userId),
    );
    const convIds = [...new Set(parts.map((p: any) => p.conversation_id).filter(Boolean))];
    if (!convIds.length) return empty;

    // DM uniquement (type='direct'). limit haute = compteur non plafonné en pratique.
    const directConvs = await this.safeRows(() =>
      this.db()
        .from('conversations')
        .select('id')
        .eq('tenant_id', tenantId)
        .in('id', convIds)
        .eq('type', 'direct')
        .limit(500),
    );
    const dmIds = directConvs.map((c: any) => c.id);
    if (!dmIds.length) return empty;

    // Date d'activité la plus récente (une seule ligne, aucun contenu).
    const lastMsg = await this.safeRows(() =>
      this.db()
        .from('messages')
        .select('created_at')
        .eq('tenant_id', tenantId)
        .in('conversation_id', dmIds)
        .order('created_at', { ascending: false })
        .limit(1),
    );
    return { conversations: dmIds.length, lastMessageAt: lastMsg[0]?.created_at || null };
  }

  /**
   * Reliure plateforme d'une SOCIÉTÉ : agrège ses contacts membres + leur activité.
   * Résolution en LOT (peu de requêtes quel que soit le nb de contacts). Read-only, tenant-scopé.
   * profiles/auth étant globaux, l'appartenance est toujours filtrée par tenant_memberships actif.
   */
  async getCompanyPlatformLink(tenantId: string, companyId: string) {
    const id = CrmService.requireId(companyId, 'companyId');
    const { data: company, error } = await this.db()
      .from('crm_companies')
      .select('id, name')
      .eq('tenant_id', tenantId)
      .eq('id', id)
      .maybeSingle();
    if (error) throw new BadRequestException(error.message);
    if (!company) throw new NotFoundException('société introuvable');

    const contacts = await this.safeRows(() =>
      this.db()
        .from('crm_contacts')
        .select('id, first_name, last_name, email')
        .eq('tenant_id', tenantId)
        .eq('company_id', id)
        .limit(500),
    );
    const base: any = {
      company: { id: company.id, name: company.name },
      contactsTotal: contacts.length,
      members: [] as any[],
      counts: { contacts: contacts.length, members: 0, orders: 0, appointments: 0, services: 0 },
    };

    const emails = [
      ...new Set(contacts.map((c: any) => String(c.email || '').trim().toLowerCase()).filter(Boolean)),
    ];
    if (!emails.length) {
      base.members = contacts.map((c: any) => ({
        contactId: c.id,
        name: [c.first_name, c.last_name].filter(Boolean).join(' ') || 'Contact',
        email: null,
        userId: null,
        isMember: false,
        role: null,
      }));
      return base;
    }

    // Profils par lot. auth.users (GoTrue) minuscule les emails → .in sur emails minuscules matche.
    const profs = await this.safeRows(() =>
      this.db().from('profiles').select('id, email, name, full_name').in('email', emails).limit(1000),
    );
    const profByEmail = new Map<string, any>();
    for (const p of profs) {
      const k = String(p.email || '').toLowerCase();
      if (k && !profByEmail.has(k)) profByEmail.set(k, p);
    }
    const userIds = [...new Set(profs.map((p: any) => p.id).filter(Boolean))];

    const memberships = userIds.length
      ? await this.safeRows(() =>
          this.db()
            .from('tenant_memberships')
            .select('user_id, role')
            .eq('tenant_id', tenantId)
            .in('user_id', userIds)
            .eq('status', 'active'),
        )
      : [];
    const roleByUser = new Map<string, string>(memberships.map((m: any) => [m.user_id, m.role]));
    const memberUserIds = new Set([...roleByUser.keys()]);

    base.members = contacts.map((c: any) => {
      const k = String(c.email || '').toLowerCase();
      const prof = k ? profByEmail.get(k) : null;
      const uid = prof?.id || null;
      const member = uid ? memberUserIds.has(uid) : false;
      // UUID exposé UNIQUEMENT pour un membre actif du tenant (pas d'oracle d'existence inter-tenant).
      return {
        contactId: c.id,
        name: [c.first_name, c.last_name].filter(Boolean).join(' ') || c.email || 'Contact',
        email: c.email || null,
        userId: member ? uid : null,
        isMember: member,
        role: member ? roleByUser.get(uid) || null : null,
      };
    });

    // Agrégats d'activité en lot (par user_id membre + email pour commandes invité).
    const memberIds = [...memberUserIds];
    // Commandes invité : customer_email n'est PAS normalisé à l'écriture (saisie checkout) →
    // match insensible à la casse comme le chemin contact. Emails filtrés sûrs pour PostgREST
    // .or() (aucun , ( ) % _ \ ni espace → ni injection de filtre ni wildcard LIKE), plafonnés.
    const safeEmails = emails.filter((e) => /^[^\s,()%_\\]+@[^\s,()%_\\]+$/.test(e)).slice(0, 60);
    const custOr = safeEmails.map((e) => `customer_email.ilike.${e}`).join(',');
    const [ordersUser, ordersEmail, appts, services] = await Promise.all([
      memberIds.length
        ? this.safeRows(() =>
            this.db().from('mbolo_orders').select('id').eq('tenant_id', tenantId).in('user_id', memberIds).limit(500),
          )
        : Promise.resolve([]),
      safeEmails.length
        ? this.safeRows(() =>
            this.db().from('mbolo_orders').select('id').eq('tenant_id', tenantId).or(custOr).limit(500),
          )
        : Promise.resolve([]),
      memberIds.length
        ? this.safeRows(() =>
            this.db().from('appointments').select('id').eq('tenant_id', tenantId).in('student_id', memberIds).limit(500),
          )
        : Promise.resolve([]),
      memberIds.length
        ? this.safeRows(() =>
            this.db()
              .from('access_passes')
              .select('id')
              .eq('tenant_id', tenantId)
              .in('user_id', memberIds)
              .eq('resource_type', 'service')
              .limit(500),
          )
        : Promise.resolve([]),
    ]);
    const orderIds = new Set([...ordersUser.map((o: any) => o.id), ...ordersEmail.map((o: any) => o.id)]);
    base.counts = {
      contacts: contacts.length,
      members: memberUserIds.size,
      orders: orderIds.size,
      appointments: appts.length,
      services: services.length,
    };
    return base;
  }

  // ─── Recherche globale (#9) ───────────────────────────────────────────────────
  /** Recherche unifiée contacts + sociétés + deals (Cmd-K), tenant-scopée, plafonnée. */
  async search(tenantId: string, q: string, limit = 8) {
    const raw = String(q || '').trim();
    if (raw.length < 2) return { contacts: [], companies: [], deals: [] };
    // Retirer les métacaractères PostgREST .or() puis échapper les wildcards LIKE.
    const safe = CrmService.escapeLike(raw.replace(/[,()]/g, ' ').trim());
    const like = `%${safe}%`;
    const cap = Math.min(Math.max(limit, 1), 25);
    const [contacts, companies, deals] = await Promise.all([
      this.safeRows(() => this.db().from('crm_contacts')
        .select('id, first_name, last_name, email, company:crm_companies(id,name)')
        .eq('tenant_id', tenantId)
        .or(`first_name.ilike.${like},last_name.ilike.${like},email.ilike.${like},phone.ilike.${like}`)
        .limit(cap)),
      this.safeRows(() => this.db().from('crm_companies')
        .select('id, name, website').eq('tenant_id', tenantId)
        .or(`name.ilike.${like},website.ilike.${like}`).limit(cap)),
      this.safeRows(() => this.db().from('crm_deals')
        .select('id, title, amount, currency, status').eq('tenant_id', tenantId)
        .ilike('title', like).limit(cap)),
    ]);
    return { contacts, companies, deals };
  }

  // ─── Reporting sales (#17) ────────────────────────────────────────────────────
  /** Métriques pipeline : win-rate, forecast pondéré, conversion par étape, vélocité, leaderboard. */
  async analytics(tenantId: string) {
    const [deals, stages] = await Promise.all([
      this.safeRows(() => this.db().from('crm_deals')
        .select('id, amount, currency, status, stage_id, owner_id, created_at, closed_at')
        .eq('tenant_id', tenantId).limit(5000)),
      this.safeRows(() => this.db().from('crm_stages')
        .select('id, name, win_probability, is_won, is_lost, position').eq('tenant_id', tenantId)),
    ]);
    const won = deals.filter((d: any) => d.status === 'won');
    const lost = deals.filter((d: any) => d.status === 'lost');
    const open = deals.filter((d: any) => d.status === 'open');
    const num = (v: any) => Number(v || 0);
    const winRate = won.length + lost.length ? won.length / (won.length + lost.length) : 0;
    const avgWonAmount = won.length ? won.reduce((s: number, d: any) => s + num(d.amount), 0) / won.length : 0;
    const probByStage = new Map<string, number>(stages.map((s: any) => [s.id, num(s.win_probability) / 100]));
    const forecast = open.reduce((s: number, d: any) => s + num(d.amount) * (probByStage.get(d.stage_id) ?? 0), 0);
    const pipelineValue: Record<string, number> = {};
    for (const d of open) { const c = d.currency || 'EUR'; pipelineValue[c] = (pipelineValue[c] || 0) + num(d.amount); }
    const byStage = [...stages].sort((a: any, b: any) => num(a.position) - num(b.position)).map((s: any) => {
      const inStage = open.filter((d: any) => d.stage_id === s.id);
      return { id: s.id, name: s.name, count: inStage.length, value: inStage.reduce((x: number, d: any) => x + num(d.amount), 0) };
    });
    const leaderboard: Record<string, { won: number; amount: number }> = {};
    for (const d of won) { const o = d.owner_id || 'non attribué'; leaderboard[o] = leaderboard[o] || { won: 0, amount: 0 }; leaderboard[o].won++; leaderboard[o].amount += num(d.amount); }
    const cycles = won.filter((d: any) => d.closed_at && d.created_at)
      .map((d: any) => (new Date(d.closed_at).getTime() - new Date(d.created_at).getTime()) / 86400000)
      .filter((n: number) => n >= 0);
    const avgCycleDays = cycles.length ? Math.round(cycles.reduce((a: number, b: number) => a + b, 0) / cycles.length) : null;
    return {
      totals: { open: open.length, won: won.length, lost: lost.length },
      winRate: Math.round(winRate * 100) / 100,
      avgWonAmount: Math.round(avgWonAmount * 100) / 100,
      forecast: Math.round(forecast * 100) / 100,
      pipelineValue, byStage, leaderboard, avgCycleDays,
    };
  }

  // ─── Intégrité (#21) ──────────────────────────────────────────────────────────
  /** Vérifie qu'une entité (contact/company/deal) existe DANS le tenant (anti-rattachement fantôme). */
  private async assertEntityExists(tenantId: string, entityType: string, entityId: string): Promise<void> {
    const table = entityType === 'contact' ? 'crm_contacts' : entityType === 'company' ? 'crm_companies' : 'crm_deals';
    const { data } = await this.db().from(table).select('id').eq('tenant_id', tenantId).eq('id', entityId).maybeSingle();
    if (!data) throw new NotFoundException(`${entityType} introuvable`);
  }

  /** Vrai si user_id est un membre ACTIF du tenant (pour valider owner_id/assignee_id). */
  private async isActiveMember(tenantId: string, userId: string): Promise<boolean> {
    if (!userId) return false;
    const rows = await this.safeRows(() =>
      this.db().from('tenant_memberships').select('user_id')
        .eq('tenant_id', tenantId).eq('user_id', userId).eq('status', 'active').limit(1),
    );
    return !!rows[0];
  }

  // ─── Fusion d'enregistrements (#19) ──────────────────────────────────────────
  /** Fusionne deux contacts : réassigne deals + notes/tâches/activités, complète les vides, supprime le perdant. */
  async mergeContacts(tenantId: string, keepId: string, loseId: string) {
    CrmService.requireId(keepId, 'keepId');
    CrmService.requireId(loseId, 'loseId');
    if (keepId === loseId) throw new BadRequestException('identifiants identiques');
    const { data: keep } = await this.db().from('crm_contacts').select('*').eq('tenant_id', tenantId).eq('id', keepId).maybeSingle();
    const { data: lose } = await this.db().from('crm_contacts').select('*').eq('tenant_id', tenantId).eq('id', loseId).maybeSingle();
    if (!keep || !lose) throw new NotFoundException('contact introuvable');
    // 1) réassigner deals + historique : erreurs VÉRIFIÉES → on ne supprime JAMAIS le perdant sur échec
    //    (état re-jouable plutôt que deals NULLés / historique orphelin).
    CrmService.chk(await this.db().from('crm_deals').update({ contact_id: keepId }).eq('tenant_id', tenantId).eq('contact_id', loseId));
    for (const t of ['crm_notes', 'crm_tasks', 'crm_activities']) {
      CrmService.chk(await this.db().from(t).update({ entity_id: keepId }).eq('tenant_id', tenantId).eq('entity_type', 'contact').eq('entity_id', loseId));
    }
    // Tags du perdant : supprimés (ceux du gagnant priment ; évite les collisions d'unicité).
    await this.db().from('crm_taggables').delete().eq('tenant_id', tenantId).eq('entity_type', 'contact').eq('entity_id', loseId);
    // 2) email/user_id sont sous unique partiel → le perdant doit DISPARAÎTRE avant qu'on copie ses
    //    valeurs sur le gagnant (sinon violation 23505). Ordre : calculer le fill → delete → fill.
    const fill: Record<string, any> = {};
    for (const f of ['first_name', 'last_name', 'email', 'phone', 'title', 'company_id', 'user_id', 'lead_id']) {
      if (CrmService.isBlank((keep as any)[f]) && !CrmService.isBlank((lose as any)[f])) fill[f] = (lose as any)[f];
    }
    CrmService.chk(await this.db().from('crm_contacts').delete().eq('tenant_id', tenantId).eq('id', loseId));
    if (Object.keys(fill).length) {
      CrmService.chk(await this.db().from('crm_contacts').update(fill).eq('tenant_id', tenantId).eq('id', keepId));
    }
    await this.recordActivity(tenantId, { entityType: 'contact', entityId: keepId, type: 'contact_merged', title: 'Contacts fusionnés', meta: { merged_from: loseId } });
    const { data } = await this.db().from('crm_contacts').select('*').eq('tenant_id', tenantId).eq('id', keepId).maybeSingle();
    return data;
  }

  /** Fusionne deux sociétés : réassigne contacts + deals + notes/tâches/activités, complète, supprime le perdant. */
  async mergeCompanies(tenantId: string, keepId: string, loseId: string) {
    CrmService.requireId(keepId, 'keepId');
    CrmService.requireId(loseId, 'loseId');
    if (keepId === loseId) throw new BadRequestException('identifiants identiques');
    const { data: keep } = await this.db().from('crm_companies').select('*').eq('tenant_id', tenantId).eq('id', keepId).maybeSingle();
    const { data: lose } = await this.db().from('crm_companies').select('*').eq('tenant_id', tenantId).eq('id', loseId).maybeSingle();
    if (!keep || !lose) throw new NotFoundException('société introuvable');
    CrmService.chk(await this.db().from('crm_contacts').update({ company_id: keepId }).eq('tenant_id', tenantId).eq('company_id', loseId));
    CrmService.chk(await this.db().from('crm_deals').update({ company_id: keepId }).eq('tenant_id', tenantId).eq('company_id', loseId));
    for (const t of ['crm_notes', 'crm_tasks', 'crm_activities']) {
      CrmService.chk(await this.db().from(t).update({ entity_id: keepId }).eq('tenant_id', tenantId).eq('entity_type', 'company').eq('entity_id', loseId));
    }
    await this.db().from('crm_taggables').delete().eq('tenant_id', tenantId).eq('entity_type', 'company').eq('entity_id', loseId);
    const fill: Record<string, any> = {};
    for (const f of ['website', 'industry', 'size', 'phone', 'address', 'city', 'country', 'description']) {
      if (CrmService.isBlank((keep as any)[f]) && !CrmService.isBlank((lose as any)[f])) fill[f] = (lose as any)[f];
    }
    CrmService.chk(await this.db().from('crm_companies').delete().eq('tenant_id', tenantId).eq('id', loseId));
    if (Object.keys(fill).length) {
      CrmService.chk(await this.db().from('crm_companies').update(fill).eq('tenant_id', tenantId).eq('id', keepId));
    }
    await this.recordActivity(tenantId, { entityType: 'company', entityId: keepId, type: 'company_merged', title: 'Sociétés fusionnées', meta: { merged_from: loseId } });
    const { data } = await this.db().from('crm_companies').select('*').eq('tenant_id', tenantId).eq('id', keepId).maybeSingle();
    return data;
  }

  // ─── RGPD (#20) ───────────────────────────────────────────────────────────────
  /** Anonymise un contact (efface la PII, conserve les agrégats deals). L'email nullé neutralise
   *  la recréation par les triggers entrants (compatible avec l'unique partiel WHERE email IS NOT NULL). */
  async anonymizeContact(tenantId: string, id: string) {
    CrmService.requireId(id);
    const { data, error } = await this.db().from('crm_contacts')
      .update({ first_name: null, last_name: '(anonymisé)', email: null, phone: null, user_id: null, source: 'anonymized' })
      .eq('tenant_id', tenantId).eq('id', id).select().maybeSingle();
    if (error) throw new BadRequestException(error.message);
    if (!data) throw new NotFoundException('contact introuvable');
    // Effacer toutes les données personnelles rattachées (notes/tâches/activités peuvent contenir de la PII).
    for (const t of ['crm_notes', 'crm_tasks', 'crm_activities']) {
      await this.db().from(t).delete().eq('tenant_id', tenantId).eq('entity_type', 'contact').eq('entity_id', id);
    }
    await this.recordActivity(tenantId, { entityType: 'contact', entityId: id, type: 'contact_anonymized', title: 'Contact anonymisé (RGPD)' });
    return { ok: true };
  }

  /** Export DSAR : toutes les données CRM d'un contact (JSON). */
  async exportContact(tenantId: string, id: string) {
    CrmService.requireId(id);
    const { data: contact } = await this.db().from('crm_contacts').select('*').eq('tenant_id', tenantId).eq('id', id).maybeSingle();
    if (!contact) throw new NotFoundException('contact introuvable');
    const [notes, tasks, activities, deals] = await Promise.all([
      this.safeRows(() => this.db().from('crm_notes').select('*').eq('tenant_id', tenantId).eq('entity_type', 'contact').eq('entity_id', id)),
      this.safeRows(() => this.db().from('crm_tasks').select('*').eq('tenant_id', tenantId).eq('entity_type', 'contact').eq('entity_id', id)),
      this.safeRows(() => this.db().from('crm_activities').select('*').eq('tenant_id', tenantId).eq('entity_type', 'contact').eq('entity_id', id)),
      this.safeRows(() => this.db().from('crm_deals').select('*').eq('tenant_id', tenantId).eq('contact_id', id)),
    ]);
    return { contact, notes, tasks, activities, deals, exportedAt: null };
  }

  // ─── Export CSV serveur (#26) ────────────────────────────────────────────────
  /** Exporte contacts|companies|deals en CSV (tenant-scopé, plafonné). */
  async exportCsv(tenantId: string, entity: string): Promise<string> {
    const esc = (v: any) => {
      let s = v == null ? '' : String(v);
      // Anti-injection de formule (Excel/Sheets) : préfixer les déclencheurs par une apostrophe.
      if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
      return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    let cols: string[] = [];
    let rows: any[] = [];
    if (entity === 'companies') {
      cols = ['name', 'website', 'industry', 'size', 'phone', 'city', 'country', 'created_at'];
      rows = await this.safeRows(() => this.db().from('crm_companies').select(cols.join(',')).eq('tenant_id', tenantId).limit(10000));
    } else if (entity === 'deals') {
      cols = ['title', 'amount', 'currency', 'status', 'expected_close_date', 'created_at'];
      rows = await this.safeRows(() => this.db().from('crm_deals').select(cols.join(',')).eq('tenant_id', tenantId).limit(10000));
    } else {
      cols = ['first_name', 'last_name', 'email', 'phone', 'title', 'status', 'source', 'created_at'];
      rows = await this.safeRows(() => this.db().from('crm_contacts').select(cols.join(',')).eq('tenant_id', tenantId).limit(10000));
    }
    const head = cols.join(',');
    const body = rows.map((r) => cols.map((c) => esc(r[c])).join(',')).join('\n');
    return `﻿${head}\n${body}`; // BOM UTF-8 pour Excel
  }
}
