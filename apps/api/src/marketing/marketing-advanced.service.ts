/**
 * MarketingAdvancedService — Port des ~20 lambdas v1 marketing-* en NestJS.
 *
 * Tables principales : marketing_campaigns, marketing_logs, funnels, funnel_steps,
 * automation_flows, automation_actions, leads, lead_segments, segments,
 * payment_failures, notifications, billing_payments.
 *
 * Le filtre tenant est toujours appliqué via `cimolace_tenant_id` (legacy column
 * name conservé pour compat avec les tables v1).
 */

import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

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

  constructor(private readonly supabase: SupabaseService) {}

  private db() {
    return (this.supabase.client as any);
  }

  private async log(entry: {
    tenantId?: string | null;
    action: string;
    result: string;
    payload?: any;
    campaign_id?: string | null;
    lead_id?: string | null;
    channel?: string | null;
  }) {
    try {
      await this.db().from('marketing_logs').insert({
        cimolace_tenant_id: entry.tenantId ?? null,
        action: entry.action,
        result: entry.result,
        payload_json: entry.payload ?? {},
        campaign_id: entry.campaign_id ?? null,
        lead_id: entry.lead_id ?? null,
        channel: entry.channel ?? null,
      });
    } catch (e) {
      this.logger.warn(`marketing_log insert failed: ${(e as Error).message}`);
    }
  }

  private normalizeLeadStatus(score: number, currentStatus = 'new'): string {
    if (currentStatus === 'customer') return 'customer';
    if (score >= 70) return 'hot';
    if (score >= 35) return 'warm';
    return currentStatus || 'new';
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ANALYTICS / LOGS / PUBLISH
  // ═══════════════════════════════════════════════════════════════════════════

  async getAnalytics(tenantId: string) {
    const db = this.db();
    const [campaignsRes, leadsRes, paymentsRes, funnelsRes, logsRes] = await Promise.all([
      db.from('marketing_campaigns').select('id,status,objective,channel').eq('cimolace_tenant_id', tenantId),
      db.from('leads').select('id,status,score').eq('cimolace_tenant_id', tenantId),
      db.from('billing_payments').select('id,payment_status,price_amount').eq('cimolace_tenant_id', tenantId),
      db.from('funnels').select('id,status,name').eq('cimolace_tenant_id', tenantId),
      db.from('marketing_logs').select('id,action').eq('cimolace_tenant_id', tenantId).limit(2000),
    ]);

    const campaigns = campaignsRes.data ?? [];
    const leads = leadsRes.data ?? [];
    const payments = paymentsRes.data ?? [];
    const funnels = funnelsRes.data ?? [];
    const logs = logsRes.data ?? [];

    const totalLeads = leads.length;
    const hot = leads.filter((l: any) => Number(l.score || 0) >= 70 || l.status === 'hot').length;
    const customers = leads.filter((l: any) => l.status === 'customer').length;
    const confirmed = payments.filter((p: any) => p.payment_status === 'confirmed');
    const failed = payments.filter((p: any) =>
      ['failed', 'canceled', 'partially_paid'].includes(String(p.payment_status || '').toLowerCase()),
    );
    const revenue = confirmed.reduce((s: number, p: any) => s + Number(p.price_amount || 0), 0);
    const sent = logs.filter((l: any) => /publish|send_email/.test(l.action || '')).length;
    const clicked = logs.filter((l: any) => /click/.test(l.action || '')).length;
    const opened = logs.filter((l: any) => /open/.test(l.action || '')).length;

    return {
      campaigns: {
        total: campaigns.length,
        active: campaigns.filter((c: any) => c.status === 'active').length,
        paused: campaigns.filter((c: any) => c.status === 'paused').length,
        completed: campaigns.filter((c: any) => c.status === 'completed').length,
      },
      leads: { total: totalLeads, hot, customers },
      payments: { confirmed: confirmed.length, failed: failed.length },
      funnels: {
        total: funnels.length,
        active: funnels.filter((f: any) => f.status === 'active').length,
      },
      metrics: {
        conversionRate: Number((totalLeads ? (customers / totalLeads) * 100 : 0).toFixed(2)),
        clickRate: Number((sent ? (clicked / sent) * 100 : 0).toFixed(2)),
        openRate: Number((sent ? (opened / sent) * 100 : 0).toFixed(2)),
        revenue: Number(revenue.toFixed(2)),
      },
    };
  }

  async listLogs(
    tenantId: string,
    opts: { limit: number; offset: number; actionPrefix?: string },
  ) {
    const limit = Math.min(500, Math.max(1, opts.limit));
    const offset = Math.max(0, opts.offset);
    let q = this.db()
      .from('marketing_logs')
      .select('*', { count: 'exact' })
      .eq('cimolace_tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (opts.actionPrefix) q = q.like('action', `${opts.actionPrefix}%`);
    const { data, count, error } = await q;
    if (error) throw new BadRequestException(error.message);
    return { logs: data ?? [], total: count ?? (data?.length ?? 0), limit, offset };
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
  // ORCHESTRATE / PAYMENT RECOVERY / SCORE REFRESH
  // ═══════════════════════════════════════════════════════════════════════════

  private async queueNotification(userId: string | null, type: string, title: string, message: string, payload: any = {}) {
    if (!userId) return;
    try {
      await this.db().from('notifications').insert({
        user_id: userId, type, title, message, payload, read: false,
      });
    } catch (e) {
      this.logger.warn(`notification insert failed: ${(e as Error).message}`);
    }
  }

  async orchestrate(tenantId: string, body: { leadId?: string }) {
    const db = this.db();
    let lead: any = null;
    if (body.leadId) {
      const { data } = await db.from('leads').select('*').eq('id', body.leadId).eq('cimolace_tenant_id', tenantId).maybeSingle();
      lead = data;
    } else {
      const { data } = await db.from('leads')
        .select('*').eq('cimolace_tenant_id', tenantId)
        .in('status', ['hot', 'warm', 'new'])
        .order('score', { ascending: false }).limit(1);
      lead = (data ?? [])[0] ?? null;
    }
    if (!lead) throw new NotFoundException('Lead not found');

    const behavior = (lead.behavior_json && typeof lead.behavior_json === 'object') ? lead.behavior_json : {};
    const executed: any[] = [];

    executed.push({ step: 'funnel_followup', result: 'queued' });
    await this.log({ tenantId, lead_id: lead.id, action: 'orchestrate_funnel_followup', result: 'queued', payload: { leadStatus: lead.status, score: lead.score } });

    if (['hot', 'warm'].includes(String(lead.status || '').toLowerCase())) {
      await this.queueNotification(lead.owner_user_id, 'marketing_booking', 'Proposer un rendez-vous',
        "Lead prioritaire détecté. Envoyez le lien d'entretien immersif.",
        { lead_id: lead.id, booking_link: '/appointment/request' });
      executed.push({ step: 'booking_proposal', result: 'notified' });
      await this.log({ tenantId, lead_id: lead.id, action: 'orchestrate_booking_proposal', result: 'notified' });
    }

    if (behavior.paymentFailure || behavior.abandon) {
      const { data: failure } = await db.from('payment_failures').insert({
        cimolace_tenant_id: tenantId,
        user_id: lead.owner_user_id ?? null,
        lead_id: lead.id,
        reason: behavior.paymentFailure ? 'payment_failed_detected' : 'checkout_abandon_detected',
        status: 'open',
        recovery_link: '/forfaits',
      }).select('*').single();
      await this.queueNotification(lead.owner_user_id, 'payment_recovery', 'Relance paiement',
        'Un lead a besoin d’une relance de paiement.',
        { lead_id: lead.id, payment_failure_id: failure?.id ?? null, recovery_link: '/forfaits' });
      executed.push({ step: 'payment_recovery', result: 'created' });
      await this.log({ tenantId, lead_id: lead.id, action: 'orchestrate_payment_recovery', result: 'created', payload: { paymentFailureId: failure?.id ?? null } });
    }

    if (String(lead.status || '').toLowerCase() === 'customer') {
      await this.queueNotification(lead.owner_user_id, 'marketing_onboarding', 'Onboarding client',
        'Client converti détecté. Démarrer onboarding.', { lead_id: lead.id });
      executed.push({ step: 'onboarding', result: 'notified' });
      await this.log({ tenantId, lead_id: lead.id, action: 'orchestrate_onboarding', result: 'notified' });
    }

    return { leadId: lead.id, executed };
  }

  async paymentRecovery(tenantId: string, body: any) {
    const db = this.db();
    const manualUserId = String(body?.userId || '').trim() || null;
    const manualReason = String(body?.reason || '').trim();
    const recoveryLink = String(body?.recoveryLink || '/forfaits').trim();
    const created: any[] = [];

    if (manualUserId && manualReason) {
      const { data, error } = await db.from('payment_failures').insert({
        cimolace_tenant_id: tenantId,
        user_id: manualUserId,
        reason: manualReason,
        status: 'open',
        recovery_link: recoveryLink,
      }).select('*').single();
      if (error) throw new BadRequestException(error.message);
      created.push(data);
    } else {
      const { data: failedPayments } = await db.from('billing_payments')
        .select('id,user_id,payment_status,created_at')
        .eq('cimolace_tenant_id', tenantId)
        .in('payment_status', ['failed', 'canceled', 'partially_paid'])
        .order('created_at', { ascending: false })
        .limit(50);
      for (const p of failedPayments ?? []) {
        const { data } = await db.from('payment_failures').insert({
          cimolace_tenant_id: tenantId,
          user_id: p.user_id,
          reason: `payment_${p.payment_status}`,
          status: 'open',
          payment_id: p.id,
          recovery_link: '/forfaits',
        }).select('*').single();
        if (data) created.push(data);
      }
    }

    for (const row of created) {
      if (row.user_id) {
        await this.queueNotification(row.user_id, 'payment_recovery', 'Paiement à régulariser',
          'Nous avons détecté un problème de paiement.', { payment_failure_id: row.id, recovery_link: row.recovery_link });
      }
      await this.log({ tenantId, action: 'payment_recovery_event', result: row.status, payload: { paymentFailureId: row.id, userId: row.user_id, reason: row.reason } });
    }

    return { createdCount: created.length, failures: created };
  }

  async scoreRefresh(tenantId: string) {
    const db = this.db();
    const { data: leads, error } = await db.from('leads').select('*').eq('cimolace_tenant_id', tenantId).limit(1000);
    if (error) throw new BadRequestException(error.message);

    let updated = 0;
    for (const lead of leads ?? []) {
      const b = (lead.behavior_json && typeof lead.behavior_json === 'object') ? lead.behavior_json : {};
      let score = 0;
      if (b.visitedLanding) score += 10;
      if (b.visitedOfferPage) score += 15;
      if (b.clicked) score += 15;
      if (b.startedCheckout) score += 20;
      if (b.bookedAppointment) score += 20;
      if (b.completedModule) score += 15;
      if (b.abandon) score -= 5;
      if (b.paymentFailure) score -= 10;
      score = Math.max(0, Math.min(100, score));
      const status = this.normalizeLeadStatus(score, lead.status || 'new');
      if (Number(lead.score || 0) === score && (lead.status || '') === status) continue;
      const { error: upErr } = await db.from('leads').update({
        score, status,
        updated_at: new Date().toISOString(),
        last_activity_at: new Date().toISOString(),
      }).eq('id', lead.id);
      if (!upErr) {
        updated++;
        await this.log({ tenantId, lead_id: lead.id, action: 'lead_score_refresh', result: 'updated', payload: { score, status } });
      }
    }
    return { total: leads?.length ?? 0, updated };
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
  // CAMPAIGNS
  // ═══════════════════════════════════════════════════════════════════════════

  async listCampaigns(tenantId: string, opts: { status?: string; limit: number; offset: number }) {
    const limit = Math.min(200, Math.max(1, opts.limit));
    const offset = Math.max(0, opts.offset);
    let q = this.db()
      .from('marketing_campaigns')
      .select('*', { count: 'exact' })
      .eq('cimolace_tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (opts.status) q = q.eq('status', opts.status.toLowerCase());
    const { data, count, error } = await q;
    if (error) throw new BadRequestException(error.message);
    return { campaigns: data ?? [], total: count ?? (data?.length ?? 0), limit, offset };
  }

  async createCampaign(tenantId: string, body: any) {
    const name = String(body?.name || '').trim();
    const objective = String(body?.objective || 'acquisition').toLowerCase();
    const channel = String(body?.channel || 'email').toLowerCase();
    if (!name) throw new BadRequestException('name is required');
    if (!VALID_OBJECTIVES.has(objective)) throw new BadRequestException('invalid objective');

    const { data, error } = await this.db().from('marketing_campaigns').insert({
      cimolace_tenant_id: tenantId,
      name, objective, channel,
      audience: String(body?.audience || '').trim() || null,
      content_message: String(body?.contentMessage || body?.content_message || '').trim() || null,
      scheduled_at: body?.scheduledAt ?? null,
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
    const { data: current } = await db.from('marketing_campaigns').select('*').eq('id', campaignId).eq('cimolace_tenant_id', tenantId).maybeSingle();
    if (!current) throw new NotFoundException('Campaign not found');

    if (action === 'duplicate') {
      const { data: duplicated, error } = await db.from('marketing_campaigns').insert({
        cimolace_tenant_id: tenantId,
        name: `${current.name} (copie)`,
        objective: current.objective,
        channel: current.channel,
        audience: current.audience,
        content_message: current.content_message,
        status: 'draft',
        scheduled_at: null,
      }).select('*').single();
      if (error) throw new BadRequestException(error.message);
      await this.log({ tenantId, campaign_id: duplicated.id, action: 'campaign_duplicate', result: 'success', channel: duplicated.channel });
      return { campaign: duplicated };
    }

    const patch: any = { updated_at: new Date().toISOString() };
    if (action === 'start') { patch.status = 'active'; patch.started_at = patch.updated_at; }
    else if (action === 'pause') patch.status = 'paused';
    else if (action === 'archive') { patch.status = 'archived'; patch.archived_at = patch.updated_at; }
    else if (action === 'complete') { patch.status = 'completed'; patch.completed_at = patch.updated_at; }
    else throw new BadRequestException('Unsupported action');

    const { data, error } = await db.from('marketing_campaigns').update(patch).eq('id', campaignId).eq('cimolace_tenant_id', tenantId).select('*').single();
    if (error) throw new BadRequestException(error.message);
    await this.log({ tenantId, campaign_id: data.id, action: `campaign_${action}`, result: data.status, channel: data.channel });
    return { campaign: data };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FUNNELS
  // ═══════════════════════════════════════════════════════════════════════════

  async listFunnels(tenantId: string) {
    const db = this.db();
    const { data: funnels, error } = await db.from('funnels')
      .select('*').eq('cimolace_tenant_id', tenantId)
      .order('created_at', { ascending: false }).limit(200);
    if (error) throw new BadRequestException(error.message);

    const ids = (funnels ?? []).map((f: any) => f.id);
    const [stepsRes, logsRes] = await Promise.all([
      ids.length
        ? db.from('funnel_steps').select('*').in('funnel_id', ids).order('order_index', { ascending: true })
        : Promise.resolve({ data: [] }),
      db.from('marketing_logs').select('action,payload_json')
        .eq('cimolace_tenant_id', tenantId)
        .order('created_at', { ascending: false }).limit(1000),
    ]);

    const stepsByFunnel: Record<string, any[]> = {};
    (stepsRes.data ?? []).forEach((s: any) => {
      (stepsByFunnel[s.funnel_id] ??= []).push(s);
    });

    const perfByFunnel: Record<string, any> = {};
    (logsRes.data ?? []).forEach((l: any) => {
      const fid = l.payload_json?.funnelId;
      if (!fid) return;
      const perf = (perfByFunnel[fid] ??= { visits: 0, captures: 0, payments: 0, confirmations: 0 });
      const a = String(l.action || '').toLowerCase();
      if (a.includes('visit')) perf.visits++;
      if (a.includes('capture')) perf.captures++;
      if (a.includes('payment')) perf.payments++;
      if (a.includes('confirmation')) perf.confirmations++;
    });

    return {
      funnels: (funnels ?? []).map((f: any) => {
        const perf = perfByFunnel[f.id] ?? { visits: 0, captures: 0, payments: 0, confirmations: 0 };
        return {
          ...f,
          steps: stepsByFunnel[f.id] ?? [],
          performance: { ...perf, conversionRate: Number((perf.visits ? (perf.confirmations / perf.visits) * 100 : 0).toFixed(2)) },
        };
      }),
    };
  }

  async createFunnel(tenantId: string, body: any) {
    const name = String(body?.name || '').trim();
    if (!name) throw new BadRequestException('name is required');

    const db = this.db();
    const { data: funnel, error: fErr } = await db.from('funnels').insert({
      cimolace_tenant_id: tenantId,
      name,
      linked_product_id: body?.linkedProductId ?? null,
      linked_formation_id: body?.linkedFormationId ?? null,
      linked_live_session_id: body?.linkedLiveSessionId ?? null,
      linked_appointment_type: body?.linkedAppointmentType ?? null,
      status: 'draft',
    }).select('*').single();
    if (fErr) throw new BadRequestException(fErr.message);

    const steps = (Array.isArray(body?.steps) ? body.steps : [])
      .map((s: any, idx: number) => ({
        funnel_id: funnel.id,
        step_type: String(s.step_type || s.stepType || '').toLowerCase(),
        order_index: Number.isFinite(Number(s.order_index)) ? Number(s.order_index) : idx,
        config_json: s.config_json ?? s.config ?? {},
      }))
      .filter((s: any) => VALID_STEP_TYPES.has(s.step_type))
      .sort((a: any, b: any) => a.order_index - b.order_index);

    if (steps.length) {
      const { error: sErr } = await db.from('funnel_steps').insert(steps);
      if (sErr) throw new BadRequestException(sErr.message);
    }
    await this.log({ tenantId, action: 'funnel_create', result: 'success', payload: { funnelId: funnel.id, steps: steps.length } });
    return { funnel, steps };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // AUTOMATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  private normalizeConditions(payload: any) {
    const incoming = payload && typeof payload === 'object' ? payload : {};
    const rawRules = Array.isArray(incoming.rules) ? incoming.rules : [];
    const normalizedRules = rawRules
      .map((rule: any) => ({ type: String(rule?.type || 'none').toLowerCase() }))
      .filter((rule: any) => Boolean(rule.type));
    return {
      ...incoming,
      operator: String(incoming.operator || 'AND').toUpperCase() === 'OR' ? 'OR' : 'AND',
      rules: normalizedRules,
      type: String(incoming.type || normalizedRules[0]?.type || 'none').toLowerCase(),
    };
  }

  private normalizeActions(flowId: string, actionsInput: any[]) {
    return (actionsInput ?? [])
      .map((a: any, idx: number) => {
        const actionType = String(a.action_type || a.actionType || '').toLowerCase();
        const orderIndex = Number.isFinite(Number(a.order_index)) ? Number(a.order_index) : idx;
        const config = (a.config_json && typeof a.config_json === 'object') ? a.config_json
          : (a.config && typeof a.config === 'object') ? a.config : {};
        const branch = String(config.branch || a.branch || 'yes').toLowerCase() === 'no' ? 'no' : 'yes';
        return {
          flow_id: flowId, action_type: actionType, order_index: orderIndex,
          config_json: { ...config, branch },
        };
      })
      .filter((a: any) => VALID_ACTIONS.has(a.action_type))
      .sort((a: any, b: any) => a.order_index - b.order_index);
  }

  async listAutomations(tenantId: string) {
    const db = this.db();
    const { data: flows, error } = await db.from('automation_flows')
      .select('*').eq('cimolace_tenant_id', tenantId)
      .order('created_at', { ascending: false }).limit(200);
    if (error) throw new BadRequestException(error.message);

    const ids = (flows ?? []).map((f: any) => f.id);
    const { data: actions } = ids.length
      ? await db.from('automation_actions').select('*').in('flow_id', ids).order('order_index', { ascending: true })
      : { data: [] };

    const grouped: Record<string, any[]> = {};
    (actions ?? []).forEach((a: any) => { (grouped[a.flow_id] ??= []).push(a); });
    return { flows: (flows ?? []).map((f: any) => ({ ...f, actions: grouped[f.id] ?? [] })) };
  }

  async createAutomation(tenantId: string, body: any) {
    const name = String(body?.name || '').trim();
    const trigger = String(body?.trigger || '').trim().toLowerCase();
    if (!name) throw new BadRequestException('name is required');
    if (!VALID_TRIGGERS.has(trigger)) throw new BadRequestException('invalid trigger');

    const conditions = this.normalizeConditions(body?.conditions_json ?? body?.conditions ?? {});
    const db = this.db();
    const { data: flow, error: flowErr } = await db.from('automation_flows').insert({
      cimolace_tenant_id: tenantId,
      name, trigger,
      conditions_json: conditions,
      status: String(body?.status || 'active').toLowerCase(),
    }).select('*').single();
    if (flowErr) throw new BadRequestException(flowErr.message);

    const actions = this.normalizeActions(flow.id, body?.actions ?? []);
    if (actions.length) {
      const { error: aErr } = await db.from('automation_actions').insert(actions);
      if (aErr) throw new BadRequestException(aErr.message);
    }
    await this.log({ tenantId, action: 'automation_flow_create', result: 'success', payload: { flowId: flow.id, trigger, actions: actions.length } });
    return { flow, actions };
  }

  async updateAutomation(tenantId: string, body: any) {
    const flowId = String(body?.flowId || body?.id || '').trim();
    const name = String(body?.name || '').trim();
    const trigger = String(body?.trigger || '').trim().toLowerCase();
    if (!flowId) throw new BadRequestException('flowId is required');
    if (!name) throw new BadRequestException('name is required');
    if (!VALID_TRIGGERS.has(trigger)) throw new BadRequestException('invalid trigger');

    const conditions = this.normalizeConditions(body?.conditions_json ?? body?.conditions ?? {});
    const db = this.db();
    const { data: flow, error: updateErr } = await db.from('automation_flows').update({
      name, trigger,
      status: String(body?.status || 'active').toLowerCase(),
      conditions_json: conditions,
      updated_at: new Date().toISOString(),
    }).eq('id', flowId).eq('cimolace_tenant_id', tenantId).select('*').single();
    if (updateErr) throw new BadRequestException(updateErr.message);
    if (!flow) throw new NotFoundException('Flow not found');

    await db.from('automation_actions').delete().eq('flow_id', flowId);
    const actions = this.normalizeActions(flowId, body?.actions ?? []);
    if (actions.length) {
      const { error: insErr } = await db.from('automation_actions').insert(actions);
      if (insErr) throw new BadRequestException(insErr.message);
    }
    await this.log({ tenantId, action: 'automation_flow_update', result: 'success', payload: { flowId, trigger, actions: actions.length } });
    return { flow, actions };
  }

  async deleteAutomation(tenantId: string, body: { flowId: string }) {
    const flowId = String(body?.flowId || '').trim();
    if (!flowId) throw new BadRequestException('flowId is required');

    const db = this.db();
    // Vérifier appartenance au tenant avant suppression
    const { data: flow } = await db.from('automation_flows').select('id').eq('id', flowId).eq('cimolace_tenant_id', tenantId).maybeSingle();
    if (!flow) throw new NotFoundException('Flow not found');

    await db.from('automation_actions').delete().eq('flow_id', flowId);
    const { error } = await db.from('automation_flows').delete().eq('id', flowId).eq('cimolace_tenant_id', tenantId);
    if (error) throw new BadRequestException(error.message);
    await this.log({ tenantId, action: 'automation_flow_delete', result: 'success', payload: { flowId } });
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
    const cfg = (action.config_json && typeof action.config_json === 'object') ? action.config_json : {};
    const lead = ctx.lead;
    const db = this.db();

    if (type === 'assign_segment') {
      const segName = String(cfg.segmentName || '').trim();
      if (!segName || !lead?.id) return { type, result: 'skipped' };
      const { data: seg } = await db.from('segments').select('id,name').eq('name', segName).maybeSingle();
      if (!seg?.id) return { type, result: 'segment_not_found' };
      await db.from('lead_segments').upsert({ lead_id: lead.id, segment_id: seg.id }, { onConflict: 'lead_id,segment_id' });
      return { type, result: 'segment_assigned' };
    }
    if (type === 'send_notification' && lead?.owner_user_id) {
      await db.from('notifications').insert({
        user_id: lead.owner_user_id,
        type: 'marketing_followup',
        title: String(cfg.title || 'Relance marketing'),
        message: String(cfg.message || 'Action automatique exécutée.'),
        payload: { lead_id: lead.id, flow_id: action.flow_id },
        read: false,
      });
      return { type, result: 'notification_sent' };
    }
    if (type === 'launch_campaign') {
      const campaignId = String(cfg.campaignId || '').trim();
      if (!campaignId) return { type, result: 'missing_campaign' };
      await db.from('marketing_campaigns').update({
        status: 'active', started_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      }).eq('id', campaignId);
      return { type, result: 'campaign_started' };
    }
    if (type === 'propose_appointment') return { type, result: 'appointment_link_prepared' };
    if (type === 'send_funnel_link') return { type, result: 'funnel_link_prepared' };
    if (type === 'send_email') return { type, result: 'email_queued' };
    return { type, result: 'unsupported_action' };
  }

  async runAutomation(tenantId: string, body: { trigger: string; leadId?: string; context?: any }) {
    const trigger = String(body?.trigger || '').trim().toLowerCase();
    if (!trigger) throw new BadRequestException('trigger is required');

    const db = this.db();
    const { data: flows, error: fErr } = await db.from('automation_flows')
      .select('*')
      .eq('cimolace_tenant_id', tenantId)
      .eq('trigger', trigger)
      .eq('status', 'active')
      .order('created_at', { ascending: true });
    if (fErr) throw new BadRequestException(fErr.message);

    let lead: any = null;
    if (body.leadId) {
      const { data } = await db.from('leads').select('*').eq('id', body.leadId).eq('cimolace_tenant_id', tenantId).maybeSingle();
      lead = data;
    }

    const executed: any[] = [];
    for (const flow of flows ?? []) {
      const match = this.evaluateCondition(flow.conditions_json ?? {}, lead, body.context ?? {});
      const { data: actions } = await db.from('automation_actions').select('*').eq('flow_id', flow.id).order('order_index', { ascending: true });
      for (const action of actions ?? []) {
        const branch = String(action?.config_json?.branch || 'yes').toLowerCase();
        const shouldRun = branch === 'yes' ? match : branch === 'no' ? !match : true;
        if (!shouldRun) {
          executed.push({ flowId: flow.id, actionId: action.id, type: action.action_type, result: 'skipped_due_branch', branch });
          continue;
        }
        const result = await this.runActionForFlow(action, { lead, trigger, context: body.context ?? {} });
        executed.push({ flowId: flow.id, actionId: action.id, branch, conditionMatch: match, ...result });
        await this.log({
          tenantId, lead_id: lead?.id ?? null,
          action: `automation_${result.type}`, result: result.result,
          payload: { flowId: flow.id, actionId: action.id, trigger, branch, conditionMatch: match },
        });
      }
    }
    return { trigger, executedCount: executed.length, executed };
  }

  async listAutomationAudit(tenantId: string) {
    const { data, error } = await this.db().from('marketing_logs')
      .select('*')
      .eq('cimolace_tenant_id', tenantId)
      .like('action', 'automation_%')
      .order('created_at', { ascending: false }).limit(200);
    if (error) throw new BadRequestException(error.message);
    return { logs: data ?? [] };
  }

  async recordAutomationAudit(tenantId: string, body: any) {
    const actionType = String(body?.actionType || '').trim().toLowerCase();
    const selectedFlowIds = Array.isArray(body?.selectedFlowIds) ? body.selectedFlowIds : [];
    const successCount = Number(body?.successCount || 0);
    const failCount = Number(body?.failCount || 0);
    const total = Number(body?.total || selectedFlowIds.length || 0);

    await this.log({
      tenantId,
      action: `automation_bulk_${actionType || 'unknown'}`,
      result: failCount > 0 ? 'partial' : 'success',
      payload: { actionType, total, successCount, failCount, selectedFlowIds },
    });
    return { ok: true };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LEADS
  // ═══════════════════════════════════════════════════════════════════════════

  async listLeads(
    tenantId: string,
    opts: { status?: string; search?: string; segment?: string; limit: number; offset: number },
  ) {
    const limit = Math.min(200, Math.max(1, opts.limit));
    const offset = Math.max(0, opts.offset);
    const db = this.db();

    let q = db.from('leads')
      .select('*', { count: 'exact' })
      .eq('cimolace_tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (opts.status) q = q.eq('status', opts.status.toLowerCase());
    if (opts.search) {
      const escaped = opts.search.replace(/[%_]/g, (c) => `\\${c}`);
      const pattern = `%${escaped}%`;
      q = q.or(`name.ilike.${pattern},email.ilike.${pattern},phone.ilike.${pattern}`);
    }

    const { data: leads, count, error } = await q;
    if (error) throw new BadRequestException(error.message);
    const list = leads ?? [];
    const ids = list.map((l: any) => l.id);

    const segsByLead: Record<string, string[]> = {};
    if (ids.length) {
      const { data: joins } = await db.from('lead_segments').select('lead_id,segments(name)').in('lead_id', ids);
      (joins ?? []).forEach((j: any) => {
        const segName = j?.segments?.name;
        if (!segName) return;
        (segsByLead[j.lead_id] ??= []).push(segName);
      });
    }

    const enriched = list.map((l: any) => ({ ...l, segments: segsByLead[l.id] ?? [] }));
    const output = opts.segment ? enriched.filter((l: any) => (l.segments ?? []).includes(opts.segment)) : enriched;
    return { leads: output, total: count ?? output.length, limit, offset };
  }

  async captureLead(body: any) {
    const db = this.db();
    const email = String(body?.email || '').trim().toLowerCase();
    const phone = String(body?.phone || '').trim() || null;
    const name = String(body?.name || '').trim() || null;
    const source = String(body?.source || 'web').trim();
    if (!email && !phone) throw new BadRequestException('email or phone is required');

    const tenantId = String(body?.tenant_id || body?.cimolace_tenant_id || '').trim() || null;
    const scoreInput = Number(body?.score);
    let score = Number.isFinite(scoreInput) ? Math.max(0, Math.min(100, scoreInput)) : 0;
    if (!Number.isFinite(scoreInput)) {
      // derive from behavior
      const b = body?.behavior && typeof body.behavior === 'object' ? body.behavior : {};
      if (b.visitedLanding) score += 10;
      if (b.visitedOfferPage) score += 15;
      if (b.clicked) score += 15;
      if (b.startedCheckout) score += 20;
      if (b.bookedAppointment) score += 20;
      score = Math.max(0, Math.min(100, score));
    }
    const status = this.normalizeLeadStatus(score, String(body?.status || 'new').toLowerCase());
    const behavior = body?.behavior && typeof body.behavior === 'object' ? body.behavior : {};

    let lead: any = null;
    if (email) {
      let existingReq = db.from('leads').select('*').ilike('email', email);
      existingReq = tenantId ? existingReq.eq('cimolace_tenant_id', tenantId) : existingReq.is('cimolace_tenant_id', null);
      const { data: existing } = await existingReq.maybeSingle();
      if (existing) {
        const nextScore = Math.max(Number(existing.score || 0), score);
        const { data, error } = await db.from('leads').update({
          name: name || existing.name,
          phone: phone || existing.phone,
          source,
          score: nextScore,
          status: this.normalizeLeadStatus(nextScore, existing.status),
          behavior_json: { ...(existing.behavior_json ?? {}), ...behavior },
          last_activity_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          cimolace_tenant_id: existing.cimolace_tenant_id || tenantId,
        }).eq('id', existing.id).select('*').single();
        if (error) throw new BadRequestException(error.message);
        lead = data;
      }
    }

    if (!lead) {
      const { data, error } = await db.from('leads').insert({
        name, email: email || null, phone, source, score, status,
        behavior_json: behavior,
        last_activity_at: new Date().toISOString(),
        cimolace_tenant_id: tenantId,
      }).select('*').single();
      if (error) throw new BadRequestException(error.message);
      lead = data;
    }

    await this.log({
      tenantId: lead.cimolace_tenant_id ?? null,
      lead_id: lead.id, action: 'lead_capture', result: 'captured',
      payload: { source, score: lead.score },
    });
    return { lead, automationTrigger: 'lead_created' };
  }
}

// silence unused import warnings (ForbiddenException kept for future use)
void ForbiddenException;
