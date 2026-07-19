/**
 * MarketingAdvancedService — Moteur CRM/marketing multi-tenant.
 *
 * ⚠️ RÉCONCILIÉ SUR LE SCHÉMA RÉEL DE LA PROD (2026-07-18). Le port v1 visait un
 * schéma fantôme (cimolace_tenant_id, automation_flows/actions, funnel_steps,
 * marketing_logs, payment_failures, lead_segments, segments) qui N'EXISTE PAS en
 * base. Le schéma réel, propre et tenant-scopé (colonne `tenant_id`), est :
 *   • leads(id, tenant_id, email, name, source, status, score, created_at)
 *   • marketing_campaigns(id, tenant_id, name, type, channel, content, status, started_at, created_at)
 *   • marketing_funnels(id, tenant_id, name, steps jsonb, status, created_at)
 *   • marketing_automations(id, tenant_id, name, trigger_condition, actions jsonb, status, created_at)
 * Les fonctionnalités avancées qui exigeaient des tables absentes (journaux
 * détaillés, segments, relance paiement persistée, tracking comportemental) sont
 * DÉGRADÉES proprement (no-op sûr + commentaire), pas supprimées de la surface API :
 * elles pourront être réactivées par une migration ultérieure (colonnes metadata/logs).
 */

import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { EmailEngineService } from '../email-engine/email-engine.service';

const VALID_TRIGGERS = new Set([
  'lead_created', 'email_click', 'signup', 'payment',
  'payment_failed', 'abandon', 'inactivity',
]);
const VALID_ACTIONS = new Set([
  'send_email', 'send_notification', 'assign_segment',
  'launch_campaign', 'propose_appointment', 'send_funnel_link',
]);
const VALID_OBJECTIVES = new Set(['acquisition', 'conversion', 'relance', 'reactivation']);
const VALID_STEP_TYPES = new Set([
  'landing', 'capture', 'presentation', 'offer', 'payment', 'confirmation',
]);
// Pipeline CRM (texte libre en base — aucune contrainte CHECK).
const LEAD_STATUSES = new Set(['new', 'warm', 'hot', 'customer', 'lost']);

const TEMPLATES: Record<string, string[]> = {
  acquisition: [
    "Découvrez comment notre plateforme transforme l'apprentissage en résultats concrets.",
    'Prenez une longueur d’avance : rejoignez notre parcours premium dès aujourd’hui.',
  ],
  conversion: [
    'Votre parcours est prêt. Finalisez votre inscription en 2 minutes.',
    'Dernière étape : activez votre accès pour démarrer immédiatement.',
  ],
  relance: [
    'Nous avons gardé votre place. Reprenez là où vous vous êtes arrêté.',
    'Un conseiller peut vous guider maintenant. Réservez votre créneau.',
  ],
  reactivation: [
    'Revenez avec un plan personnalisé et des ressources mises à jour.',
    'Nouveautés disponibles pour accélérer votre progression cette semaine.',
  ],
};

@Injectable()
export class MarketingAdvancedService {
  private readonly logger = new Logger(MarketingAdvancedService.name);

  // Anti-abus des envois d'automation (déclencheur = capture PUBLIQUE, origine spoofable) —
  // in-memory / par-réplica. Durcissement DB (audit + idempotence + double opt-in) = suivi.
  private static readonly AUTO_EMAIL_TENANT_CAP = 100; // max emails d'automation / heure / tenant
  private static readonly AUTO_EMAIL_WINDOW_MS = 60 * 60 * 1000;
  private static readonly AUTO_EMAIL_RECIP_COOLDOWN_MS = 30 * 60 * 1000;
  private readonly autoEmailTenantHits = new Map<string, { count: number; resetAt: number }>();
  private readonly autoEmailRecipHits = new Map<string, number>();

  constructor(
    private readonly supabase: SupabaseService,
    private readonly email: EmailEngineService,
  ) {}

  private db() {
    return (this.supabase.client as any);
  }

  /**
   * Journal marketing : la table `marketing_logs` n'existe pas en prod → no-op
   * (trace applicative uniquement). Réactivable via migration `marketing_logs`.
   */
  private async log(entry: {
    tenantId?: string | null;
    action: string;
    result: string;
    payload?: any;
    campaign_id?: string | null;
    lead_id?: string | null;
    channel?: string | null;
  }) {
    this.logger.debug(`[mkt:${entry.tenantId ?? '-'}] ${entry.action} → ${entry.result}`);
  }

  private normalizeLeadStatus(score: number, currentStatus = 'new'): string {
    if (currentStatus === 'customer') return 'customer';
    if (score >= 70) return 'hot';
    if (score >= 35) return 'warm';
    return LEAD_STATUSES.has(currentStatus) ? currentStatus : 'new';
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ANALYTICS / LOGS / PUBLISH
  // ═══════════════════════════════════════════════════════════════════════════

  async getAnalytics(tenantId: string) {
    const db = this.db();
    const [campaignsRes, leadsRes, funnelsRes] = await Promise.all([
      db.from('marketing_campaigns').select('id,status,type,channel').eq('tenant_id', tenantId),
      db.from('leads').select('id,status,score').eq('tenant_id', tenantId),
      db.from('marketing_funnels').select('id,status,name').eq('tenant_id', tenantId),
    ]);

    const campaigns = campaignsRes.data ?? [];
    const leads = leadsRes.data ?? [];
    const funnels = funnelsRes.data ?? [];

    const totalLeads = leads.length;
    const hot = leads.filter((l: any) => Number(l.score || 0) >= 70 || l.status === 'hot').length;
    const customers = leads.filter((l: any) => l.status === 'customer').length;

    return {
      campaigns: {
        total: campaigns.length,
        active: campaigns.filter((c: any) => c.status === 'active').length,
        paused: campaigns.filter((c: any) => c.status === 'paused').length,
        completed: campaigns.filter((c: any) => c.status === 'completed').length,
      },
      leads: { total: totalLeads, hot, customers },
      // Revenu/relances : `billing_payments` n'expose pas payment_status/price_amount
      // dans ce schéma → 0 (à rebrancher sur la vraie source de paiement plus tard).
      payments: { confirmed: 0, failed: 0 },
      funnels: {
        total: funnels.length,
        active: funnels.filter((f: any) => f.status === 'active').length,
      },
      metrics: {
        conversionRate: Number((totalLeads ? (customers / totalLeads) * 100 : 0).toFixed(2)),
        // click/open rate : nécessitent le journal marketing (absent) → 0.
        clickRate: 0,
        openRate: 0,
        revenue: 0,
      },
    };
  }

  async listLogs(
    _tenantId: string,
    opts: { limit: number; offset: number; actionPrefix?: string },
  ) {
    // Journal marketing absent en prod → liste vide (surface conservée).
    const limit = Math.min(500, Math.max(1, opts.limit));
    const offset = Math.max(0, opts.offset);
    return { logs: [], total: 0, limit, offset };
  }

  async publish(tenantId: string, body: any) {
    const channel = String(body?.channel || 'email').trim().toLowerCase();
    const message = String(body?.message || '').trim();
    const immediate = Boolean(body?.immediate);
    if (!message) throw new BadRequestException('message is required');

    await this.log({
      tenantId,
      campaign_id: body?.campaignId ?? null,
      action: 'publish',
      result: immediate ? 'sent' : 'scheduled',
      channel,
      payload: { message, audience: body?.audience ?? null, scheduledAt: body?.scheduledAt ?? null },
    });

    return {
      channel,
      status: immediate ? 'sent' : 'scheduled',
      integrationReady: { email: true, facebook: true, instagram: true, tiktok: true, whatsapp: true },
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ORCHESTRATE / PAYMENT RECOVERY / SCORE REFRESH  (dégradés — voir en-tête)
  // ═══════════════════════════════════════════════════════════════════════════

  async orchestrate(tenantId: string, body: { leadId?: string }) {
    const db = this.db();
    let lead: any = null;
    if (body.leadId) {
      const { data } = await db.from('leads').select('*').eq('id', body.leadId).eq('tenant_id', tenantId).maybeSingle();
      lead = data;
    } else {
      const { data } = await db.from('leads')
        .select('*').eq('tenant_id', tenantId)
        .in('status', ['hot', 'warm', 'new'])
        .order('score', { ascending: false }).limit(1);
      lead = (data ?? [])[0] ?? null;
    }
    if (!lead) throw new NotFoundException('Lead not found');

    // Plan d'orchestration recommandé (les actions à écriture — notifications ciblées,
    // relance paiement persistée — exigent owner_user_id / payment_failures absents ici :
    // renvoyées comme plan à exécuter par les automations/canaux, pas écrites en base).
    const executed: any[] = [{ step: 'funnel_followup', result: 'queued' }];
    if (['hot', 'warm'].includes(String(lead.status || '').toLowerCase())) {
      executed.push({ step: 'booking_proposal', result: 'recommended', booking_link: '/appointment/request' });
    }
    if (String(lead.status || '').toLowerCase() === 'customer') {
      executed.push({ step: 'onboarding', result: 'recommended' });
    }
    await this.log({ tenantId, lead_id: lead.id, action: 'orchestrate', result: 'planned' });
    return { leadId: lead.id, executed };
  }

  async paymentRecovery(tenantId: string, _body: any) {
    // `payment_failures` absent en prod → relance non persistée. Surface conservée.
    await this.log({ tenantId, action: 'payment_recovery', result: 'noop_no_table' });
    return { createdCount: 0, failures: [], note: 'payment_failures indisponible sur ce schéma' };
  }

  async scoreRefresh(tenantId: string) {
    // Le tracking comportemental (behavior_json) n'existe pas sur `leads` (schéma
    // minimal) → le score est géré manuellement à la capture. No-op sûr.
    const { count } = await this.db().from('leads').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId);
    return { total: count ?? 0, updated: 0, note: 'scoring comportemental désactivé (schéma minimal)' };
  }

  aiSuggestMessage(body: { objective?: string; segment?: string; tone?: string }) {
    const objective = String(body?.objective || 'acquisition').toLowerCase();
    const segment = String(body?.segment || 'general').trim();
    const tone = String(body?.tone || 'premium').trim();
    const picks = TEMPLATES[objective] ?? TEMPLATES.acquisition;
    const suggestions = picks.map((text, idx) => ({
      id: `${objective}-${idx + 1}`,
      subject: `[Marketing] ${objective.toUpperCase()} - ${segment}`,
      message: `${text} (${tone})`,
      cta: objective === 'conversion' ? '/forfaits' : '/appointment/request',
    }));
    return { objective, segment, tone, suggestions };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CAMPAIGNS  (table réelle : marketing_campaigns)
  // ═══════════════════════════════════════════════════════════════════════════

  async listCampaigns(tenantId: string, opts: { status?: string; limit: number; offset: number }) {
    const limit = Math.min(200, Math.max(1, opts.limit));
    const offset = Math.max(0, opts.offset);
    let q = this.db()
      .from('marketing_campaigns')
      .select('*', { count: 'exact' })
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (opts.status) q = q.eq('status', opts.status.toLowerCase());
    const { data, count, error } = await q;
    if (error) throw new BadRequestException(error.message);
    return { campaigns: data ?? [], total: count ?? (data?.length ?? 0), limit, offset };
  }

  async createCampaign(tenantId: string, body: any) {
    const name = String(body?.name || '').trim();
    const objective = String(body?.objective || body?.type || 'acquisition').toLowerCase();
    const channel = String(body?.channel || 'email').toLowerCase();
    if (!name) throw new BadRequestException('name is required');
    if (!VALID_OBJECTIVES.has(objective)) throw new BadRequestException('invalid objective');

    // Schéma réel : name, type, channel, content, status, started_at.
    const { data, error } = await this.db().from('marketing_campaigns').insert({
      tenant_id: tenantId,
      name,
      type: objective,
      channel,
      content: String(body?.contentMessage || body?.content_message || body?.content || '').trim() || null,
      status: 'draft',
    }).select('*').single();
    if (error) throw new BadRequestException(error.message);
    await this.log({ tenantId, campaign_id: data.id, action: 'campaign_create', result: 'success', channel, payload: { objective } });
    return { campaign: data };
  }

  async campaignAction(tenantId: string, body: { campaignId: string; action: string }) {
    const campaignId = String(body?.campaignId || '').trim();
    const action = String(body?.action || 'start').toLowerCase();
    if (!campaignId) throw new BadRequestException('campaignId is required');

    const db = this.db();
    const { data: current } = await db.from('marketing_campaigns').select('*').eq('id', campaignId).eq('tenant_id', tenantId).maybeSingle();
    if (!current) throw new NotFoundException('Campaign not found');

    if (action === 'duplicate') {
      const { data: duplicated, error } = await db.from('marketing_campaigns').insert({
        tenant_id: tenantId,
        name: `${current.name} (copie)`,
        type: current.type,
        channel: current.channel,
        content: current.content,
        status: 'draft',
      }).select('*').single();
      if (error) throw new BadRequestException(error.message);
      await this.log({ tenantId, campaign_id: duplicated.id, action: 'campaign_duplicate', result: 'success', channel: duplicated.channel });
      return { campaign: duplicated };
    }

    // Schéma réel : seules les colonnes status + started_at existent.
    const patch: any = {};
    if (action === 'start') { patch.status = 'active'; patch.started_at = new Date().toISOString(); }
    else if (action === 'pause') patch.status = 'paused';
    else if (action === 'archive') patch.status = 'archived';
    else if (action === 'complete') patch.status = 'completed';
    else throw new BadRequestException('Unsupported action');

    const { data, error } = await db.from('marketing_campaigns').update(patch).eq('id', campaignId).eq('tenant_id', tenantId).select('*').single();
    if (error) throw new BadRequestException(error.message);
    await this.log({ tenantId, campaign_id: data.id, action: `campaign_${action}`, result: data.status, channel: data.channel });
    return { campaign: data };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FUNNELS  (table réelle : marketing_funnels, steps en JSONB inline)
  // ═══════════════════════════════════════════════════════════════════════════

  async listFunnels(tenantId: string) {
    const { data: funnels, error } = await this.db().from('marketing_funnels')
      .select('*').eq('tenant_id', tenantId)
      .order('created_at', { ascending: false }).limit(200);
    if (error) throw new BadRequestException(error.message);

    return {
      funnels: (funnels ?? []).map((f: any) => ({
        ...f,
        steps: Array.isArray(f.steps) ? f.steps : [],
        // Perf par étape : nécessite le journal marketing (absent) → 0.
        performance: { visits: 0, captures: 0, payments: 0, confirmations: 0, conversionRate: 0 },
      })),
    };
  }

  async createFunnel(tenantId: string, body: any) {
    const name = String(body?.name || '').trim();
    if (!name) throw new BadRequestException('name is required');

    const steps = (Array.isArray(body?.steps) ? body.steps : [])
      .map((s: any, idx: number) => ({
        step_type: String(s.step_type || s.stepType || '').toLowerCase(),
        order_index: Number.isFinite(Number(s.order_index)) ? Number(s.order_index) : idx,
        config: s.config_json ?? s.config ?? {},
      }))
      .filter((s: any) => VALID_STEP_TYPES.has(s.step_type))
      .sort((a: any, b: any) => a.order_index - b.order_index);

    const { data: funnel, error } = await this.db().from('marketing_funnels').insert({
      tenant_id: tenantId,
      name,
      steps, // JSONB inline
      status: 'draft',
    }).select('*').single();
    if (error) throw new BadRequestException(error.message);
    await this.log({ tenantId, action: 'funnel_create', result: 'success', payload: { funnelId: funnel.id, steps: steps.length } });
    return { funnel, steps };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // AUTOMATIONS  (table réelle : marketing_automations, trigger_condition + actions JSONB)
  // Structure du JSONB `actions` : { conditions: {...}, steps: [{action_type, order_index, config}] }
  // ═══════════════════════════════════════════════════════════════════════════

  private normalizeConditions(payload: any) {
    const incoming = payload && typeof payload === 'object' ? payload : {};
    const rawRules = Array.isArray(incoming.rules) ? incoming.rules : [];
    const normalizedRules = rawRules
      .map((rule: any) => ({ type: String(rule?.type || 'none').toLowerCase() }))
      .filter((rule: any) => Boolean(rule.type));
    return {
      operator: String(incoming.operator || 'AND').toUpperCase() === 'OR' ? 'OR' : 'AND',
      rules: normalizedRules,
      type: String(incoming.type || normalizedRules[0]?.type || 'none').toLowerCase(),
    };
  }

  private normalizeSteps(actionsInput: any[]) {
    return (actionsInput ?? [])
      .map((a: any, idx: number) => {
        const actionType = String(a.action_type || a.actionType || '').toLowerCase();
        const orderIndex = Number.isFinite(Number(a.order_index)) ? Number(a.order_index) : idx;
        const config = (a.config_json && typeof a.config_json === 'object') ? a.config_json
          : (a.config && typeof a.config === 'object') ? a.config : {};
        const branch = String(config.branch || a.branch || 'yes').toLowerCase() === 'no' ? 'no' : 'yes';
        return { action_type: actionType, order_index: orderIndex, config: { ...config, branch } };
      })
      .filter((a: any) => VALID_ACTIONS.has(a.action_type))
      .sort((a: any, b: any) => a.order_index - b.order_index);
  }

  /** Reshape une ligne marketing_automations vers la forme attendue par le front (flow + actions[]). */
  private shapeFlow(row: any) {
    const bag = (row?.actions && typeof row.actions === 'object' && !Array.isArray(row.actions)) ? row.actions : { conditions: {}, steps: [] };
    return {
      id: row.id,
      tenant_id: row.tenant_id,
      name: row.name,
      trigger: row.trigger_condition,
      status: row.status,
      created_at: row.created_at,
      conditions_json: bag.conditions ?? {},
      actions: Array.isArray(bag.steps) ? bag.steps : [],
    };
  }

  async listAutomations(tenantId: string) {
    const { data: flows, error } = await this.db().from('marketing_automations')
      .select('*').eq('tenant_id', tenantId)
      .order('created_at', { ascending: false }).limit(200);
    if (error) throw new BadRequestException(error.message);
    return { flows: (flows ?? []).map((f: any) => this.shapeFlow(f)) };
  }

  async createAutomation(tenantId: string, body: any) {
    const name = String(body?.name || '').trim();
    const trigger = String(body?.trigger || '').trim().toLowerCase();
    if (!name) throw new BadRequestException('name is required');
    if (!VALID_TRIGGERS.has(trigger)) throw new BadRequestException('invalid trigger');

    const conditions = this.normalizeConditions(body?.conditions_json ?? body?.conditions ?? {});
    const steps = this.normalizeSteps(body?.actions ?? []);
    const { data: flow, error } = await this.db().from('marketing_automations').insert({
      tenant_id: tenantId,
      name,
      trigger_condition: trigger,
      actions: { conditions, steps }, // JSONB inline
      status: String(body?.status || 'active').toLowerCase(),
    }).select('*').single();
    if (error) throw new BadRequestException(error.message);
    await this.log({ tenantId, action: 'automation_create', result: 'success', payload: { flowId: flow.id, trigger, actions: steps.length } });
    return this.shapeFlow(flow);
  }

  async updateAutomation(tenantId: string, body: any) {
    const flowId = String(body?.flowId || body?.id || '').trim();
    const name = String(body?.name || '').trim();
    const trigger = String(body?.trigger || '').trim().toLowerCase();
    if (!flowId) throw new BadRequestException('flowId is required');
    if (!name) throw new BadRequestException('name is required');
    if (!VALID_TRIGGERS.has(trigger)) throw new BadRequestException('invalid trigger');

    const conditions = this.normalizeConditions(body?.conditions_json ?? body?.conditions ?? {});
    const steps = this.normalizeSteps(body?.actions ?? []);
    const { data: flow, error } = await this.db().from('marketing_automations').update({
      name,
      trigger_condition: trigger,
      actions: { conditions, steps },
      status: String(body?.status || 'active').toLowerCase(),
    }).eq('id', flowId).eq('tenant_id', tenantId).select('*').single();
    if (error) throw new BadRequestException(error.message);
    if (!flow) throw new NotFoundException('Flow not found');
    await this.log({ tenantId, action: 'automation_update', result: 'success', payload: { flowId, trigger, actions: steps.length } });
    return this.shapeFlow(flow);
  }

  async deleteAutomation(tenantId: string, body: { flowId: string }) {
    const flowId = String(body?.flowId || '').trim();
    if (!flowId) throw new BadRequestException('flowId is required');
    const db = this.db();
    const { data: flow } = await db.from('marketing_automations').select('id').eq('id', flowId).eq('tenant_id', tenantId).maybeSingle();
    if (!flow) throw new NotFoundException('Flow not found');
    const { error } = await db.from('marketing_automations').delete().eq('id', flowId).eq('tenant_id', tenantId);
    if (error) throw new BadRequestException(error.message);
    await this.log({ tenantId, action: 'automation_delete', result: 'success', payload: { flowId } });
    return { ok: true, flowId };
  }

  private evaluateConditionType(type: string, lead: any, context: any = {}): boolean {
    const t = String(type || 'none').toLowerCase();
    const score = Number(lead?.score || 0);
    if (t === 'none') return true;
    if (t === 'score_hot') return score >= 70;
    if (t === 'score_warm_or_more') return score >= 35;
    if (t === 'payment_failure_true') return Boolean(context.paymentFailure || lead?.status === 'payment_failed');
    if (t === 'abandon_true') return Boolean(context.abandon || lead?.status === 'abandoned');
    return true;
  }

  private evaluateCondition(cfg: any, lead: any, context: any = {}): boolean {
    if (!cfg || typeof cfg !== 'object') return this.evaluateConditionType(cfg, lead, context);
    const rules = Array.isArray(cfg.rules) ? cfg.rules : [];
    const op = String(cfg.operator || 'AND').toUpperCase() === 'OR' ? 'OR' : 'AND';
    if (!rules.length) return this.evaluateConditionType(cfg.type || 'none', lead, context);
    const checks = rules.map((r: any) => this.evaluateConditionType(r?.type || 'none', lead, context));
    return op === 'OR' ? checks.some(Boolean) : checks.every(Boolean);
  }

  private async runActionForFlow(action: any, ctx: { lead: any | null; trigger: string; context: any }) {
    const type = String(action.action_type || '').toLowerCase();
    const cfg = (action.config && typeof action.config === 'object') ? action.config : {};
    const lead = ctx.lead;
    const db = this.db();

    if (type === 'launch_campaign') {
      const campaignId = String(cfg.campaignId || '').trim();
      if (!campaignId) return { type, result: 'missing_campaign' };
      await db.from('marketing_campaigns').update({
        status: 'active', started_at: new Date().toISOString(),
      }).eq('id', campaignId).eq('tenant_id', lead?.tenant_id ?? ctx.context?.tenantId);
      return { type, result: 'campaign_started' };
    }
    if (type === 'assign_segment') return { type, result: 'segment_unavailable' }; // segments absents du schéma
    if (type === 'send_notification') return { type, result: 'notification_planned' };
    if (type === 'propose_appointment') return { type, result: 'appointment_link_prepared' };
    if (type === 'send_funnel_link') return { type, result: 'funnel_link_prepared' };
    if (type === 'send_email') {
      // Action RÉELLE (Vague 3) : envoi transactionnel via Resend, CLÉ PAR TENANT.
      // Le déclencheur (capture de lead) étant PUBLIC + l'origine SPOOFABLE, on borne le
      // risque d'email-bombing : (1) clé Resend PROPRE au tenant obligatoire (jamais la clé
      // globale Cimolace) ; (2) cooldown par destinataire NORMALISÉ (anti plus-addressing) ;
      // (3) plafond horaire par tenant. sendRaw reste best-effort (ne jette jamais).
      const to = String(lead?.email || '').trim();
      if (!to) return { type, result: 'skipped_no_recipient' };
      const emailTenantId = String(lead?.tenant_id ?? ctx.context?.tenantId ?? '').trim();
      if (!emailTenantId) return { type, result: 'skipped_no_tenant' };
      const blocked = await this.guardAutomationEmail(emailTenantId, to);
      if (blocked) return { type, result: blocked, to };
      const subject = String(cfg.subject || 'Merci de nous avoir contactés').slice(0, 200);
      const html = this.marketingEmailHtml(cfg, subject);
      const res = await this.email.sendRaw(emailTenantId, to, subject, html);
      return {
        type,
        result: res.status === 'sent' ? 'email_sent' : `email_${res.status}`,
        to,
        ...(res.from ? { from: res.from } : {}),
      };
    }
    return { type, result: 'unsupported_action' };
  }

  /** Normalise un destinataire pour le cooldown : minuscule + retrait du +tag (anti plus-addressing). */
  private normalizeRecipient(email: string): string {
    const e = String(email || '').trim().toLowerCase();
    const at = e.indexOf('@');
    if (at < 0) return e;
    const local = e.slice(0, at).replace(/\+.*$/, '');
    return `${local}@${e.slice(at + 1)}`;
  }

  /**
   * Garde-fou d'envoi d'automation depuis un déclencheur PUBLIC (anti email-bombing).
   * Renvoie une RAISON de skip (string) si bloqué, sinon null (autorisé — le slot est réservé).
   * NB : in-memory/par-réplica ; un audit + une idempotence DB restent un durcissement de suivi.
   */
  private async guardAutomationEmail(tenantId: string, to: string): Promise<string | null> {
    // (1) Exiger la clé Resend PROPRE au tenant (ne jamais envoyer via la clé globale Cimolace).
    const { data: ns } = await this.db()
      .from('tenant_notification_settings')
      .select('resend_api_key')
      .eq('tenant_id', tenantId)
      .maybeSingle();
    const key = ns?.resend_api_key ? String(ns.resend_api_key).trim() : '';
    if (!key || key === 'replace_me') return 'email_skipped_no_tenant_key';

    const now = Date.now();
    // (3) Plafond horaire par tenant.
    let cap = this.autoEmailTenantHits.get(tenantId);
    if (!cap || now > cap.resetAt) {
      cap = { count: 0, resetAt: now + MarketingAdvancedService.AUTO_EMAIL_WINDOW_MS };
      this.autoEmailTenantHits.set(tenantId, cap);
    }
    if (cap.count >= MarketingAdvancedService.AUTO_EMAIL_TENANT_CAP) return 'email_skipped_tenant_cap';

    // (2) Cooldown par destinataire normalisé.
    const rkey = `${tenantId}|${this.normalizeRecipient(to)}`;
    if (now < (this.autoEmailRecipHits.get(rkey) || 0)) return 'email_skipped_recipient_cooldown';

    // Autorisé → réserver le slot (conservateur : un envoi qui échouera consomme quand même le slot).
    cap.count += 1;
    this.autoEmailRecipHits.set(rkey, now + MarketingAdvancedService.AUTO_EMAIL_RECIP_COOLDOWN_MS);
    if (this.autoEmailRecipHits.size > 10000) {
      for (const [k, v] of this.autoEmailRecipHits) if (now > v) this.autoEmailRecipHits.delete(k);
    }
    return null;
  }

  /** Gabarit email marketing NEUTRE (white-label, pas de mention « espace santé » MEDOS). */
  private marketingEmailHtml(cfg: any, subject: string): string {
    const accent = String(cfg?.brand || '#d97757');
    const title = String(cfg?.title || subject || 'Bonjour');
    const body = String(
      cfg?.body || 'Merci de votre intérêt — notre équipe revient vers vous très vite.',
    );
    const cta = cfg?.ctaUrl
      ? `<p style="margin:26px 0"><a href="${String(cfg.ctaUrl)}" style="background:${accent};color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:600;display:inline-block">${String(cfg.ctaLabel || 'En savoir plus')}</a></p>`
      : '';
    return `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;color:#1c1c1a">
      <h2 style="color:${accent};font-size:20px;margin:0 0 12px">${title}</h2>
      <p style="font-size:15px;line-height:1.6;margin:0 0 8px">${body}</p>
      ${cta}
      <p style="font-size:12px;color:#8a8a84;margin-top:28px">Vous recevez cet email suite à votre demande de contact.</p>
    </div>`;
  }

  async runAutomation(
    tenantId: string,
    body: { trigger: string; leadId?: string; context?: any; dryRun?: boolean },
  ) {
    const trigger = String(body?.trigger || '').trim().toLowerCase();
    if (!trigger) throw new BadRequestException('trigger is required');
    const dryRun = !!body?.dryRun; // aperçu : matche + planifie sans exécuter les actions (anti preview-as-send)

    const db = this.db();
    const { data: flows, error } = await db.from('marketing_automations')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('trigger_condition', trigger)
      .eq('status', 'active')
      .order('created_at', { ascending: true });
    if (error) throw new BadRequestException(error.message);

    let lead: any = null;
    if (body.leadId) {
      const { data } = await db.from('leads').select('*').eq('id', body.leadId).eq('tenant_id', tenantId).maybeSingle();
      lead = data;
    }

    const executed: any[] = [];
    for (const row of flows ?? []) {
      const flow = this.shapeFlow(row);
      const match = this.evaluateCondition(flow.conditions_json ?? {}, lead, body.context ?? {});
      for (const action of flow.actions) {
        const branch = String(action?.config?.branch || 'yes').toLowerCase();
        const shouldRun = branch === 'yes' ? match : branch === 'no' ? !match : true;
        if (!shouldRun) {
          executed.push({ flowId: flow.id, type: action.action_type, result: 'skipped_due_branch', branch });
          continue;
        }
        if (dryRun) {
          executed.push({ flowId: flow.id, branch, conditionMatch: match, type: action.action_type, result: 'dry_run' });
          continue;
        }
        // Isolation par action : un échec d'action ne fait pas tomber tout le run (les autres continuent).
        let result: any;
        try {
          result = await this.runActionForFlow(action, { lead, trigger, context: { ...(body.context ?? {}), tenantId } });
        } catch (e: any) {
          result = { type: action.action_type, result: 'action_error', message: String(e?.message || e) };
        }
        executed.push({ flowId: flow.id, branch, conditionMatch: match, ...result });
      }
    }
    return { trigger, dryRun, executedCount: executed.length, executed };
  }

  async listAutomationAudit(_tenantId: string) {
    // Journal marketing absent → audit vide (surface conservée).
    return { logs: [] };
  }

  async recordAutomationAudit(tenantId: string, body: any) {
    await this.log({ tenantId, action: `automation_bulk_${String(body?.actionType || 'unknown')}`, result: 'recorded' });
    return { ok: true };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LEADS  (table réelle : leads = tenant_id, email, name, source, status, score)
  // ═══════════════════════════════════════════════════════════════════════════

  async listLeads(
    tenantId: string,
    opts: { status?: string; search?: string; segment?: string; limit: number; offset: number },
  ) {
    const limit = Math.min(200, Math.max(1, opts.limit));
    const offset = Math.max(0, opts.offset);
    let q = this.db().from('leads')
      .select('*', { count: 'exact' })
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (opts.status) q = q.eq('status', opts.status.toLowerCase());
    if (opts.search) {
      const escaped = opts.search.replace(/[%_]/g, (c) => `\\${c}`);
      const pattern = `%${escaped}%`;
      q = q.or(`name.ilike.${pattern},email.ilike.${pattern}`);
    }
    const { data: leads, count, error } = await q;
    if (error) throw new BadRequestException(error.message);
    // segments absents du schéma → tableau vide (surface conservée).
    const output = (leads ?? []).map((l: any) => ({ ...l, segments: [] }));
    return { leads: output, total: count ?? output.length, limit, offset };
  }

  async captureLead(body: any) {
    const db = this.db();
    const email = String(body?.email || '').trim().toLowerCase();
    const name = String(body?.name || '').trim() || null;
    const source = String(body?.source || 'web').trim();
    if (!email) throw new BadRequestException('email is required');

    const tenantId = String(body?.tenant_id || body?.tenantId || '').trim();
    if (!tenantId) throw new BadRequestException('tenant_id is required');

    const scoreInput = Number(body?.score);
    let score = Number.isFinite(scoreInput) ? Math.max(0, Math.min(100, scoreInput)) : 0;
    if (!Number.isFinite(scoreInput)) {
      const b = body?.behavior && typeof body.behavior === 'object' ? body.behavior : {};
      if (b.visitedLanding) score += 10;
      if (b.visitedOfferPage) score += 15;
      if (b.clicked) score += 15;
      if (b.startedCheckout) score += 20;
      if (b.bookedAppointment) score += 20;
      score = Math.max(0, Math.min(100, score));
    }
    const status = this.normalizeLeadStatus(score, String(body?.status || 'new').toLowerCase());

    // Upsert par (tenant_id, email) — contrainte UNIQUE du schéma. `_`/`%` sont des
    // jokers LIKE (supabase-js n'échappe PAS) → on les échappe, sinon un email neuf comme
    // `a_b@x.com` matcherait `axb@x.com` (faux positif : automation non déclenchée + upsert erroné).
    const emailLike = email.replace(/[%_]/g, (c) => `\\${c}`);
    const { data: existing } = await db.from('leads').select('*').eq('tenant_id', tenantId).ilike('email', emailLike).maybeSingle();
    let lead: any = null;
    if (existing) {
      const nextScore = Math.max(Number(existing.score || 0), score);
      const { data, error } = await db.from('leads').update({
        name: name || existing.name,
        source,
        score: nextScore,
        status: this.normalizeLeadStatus(nextScore, existing.status),
      }).eq('id', existing.id).select('*').single();
      if (error) throw new BadRequestException(error.message);
      lead = data;
    } else {
      const { data, error } = await db.from('leads').insert({
        tenant_id: tenantId, email, name, source, score, status,
      }).select('*').single();
      if (error) throw new BadRequestException(error.message);
      lead = data;
    }

    await this.log({ tenantId, lead_id: lead.id, action: 'lead_capture', result: 'captured', payload: { source, score: lead.score } });

    // Vague 3 — automations EVENT-DRIVEN : un lead NEUF (jamais sur une ré-capture, anti-spam)
    // déclenche les flows `lead_created` du tenant. Fire-and-forget : un échec d'automation ne
    // casse JAMAIS la capture ; le résultat est tracé dans les logs (Railway).
    if (!existing) {
      void this.runAutomation(tenantId, { trigger: 'lead_created', leadId: lead.id })
        .then((r) => {
          if (r?.executedCount) {
            this.logger.log(
              `[mkt:${tenantId}] lead_created → ${r.executedCount} action(s): ` +
                JSON.stringify((r.executed || []).map((e: any) => e.result)),
            );
          }
        })
        .catch((e) => this.logger.warn(`[mkt:${tenantId}] lead_created automations failed: ${e?.message || e}`));
    }
    return { lead, automationTrigger: 'lead_created' };
  }
}

// silence unused import warning (ForbiddenException conservé pour usage futur)
void ForbiddenException;
