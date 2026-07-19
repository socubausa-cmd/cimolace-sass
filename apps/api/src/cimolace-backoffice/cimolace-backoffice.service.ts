import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { SupabaseService } from '../supabase/supabase.service';
import { PawaPayService } from '../pawapay/pawapay.service';
import { AirtelMoneyService } from '../airtel/airtel.service';
import { AuthService } from '../auth/auth.service';
import { CreateClientDto, UpdateClientDto } from './dto/backoffice.dto';
import { ProvisionSchoolDto } from './dto/provision-school.dto';
import type { InitiateSchoolCheckoutDto } from './school-onboarding.controller';
import {
  SCHOOL_ENGINE_MANIFEST,
  SCHOOL_BASE_ENGINES,
  SCHOOL_RECOMMENDED_ENGINES,
  SCHOOL_PLAN_LIMITS,
} from './school-engine-manifest';

const SCHOOL_CONFIGURED_PROVIDERS = new Set(['supabase', 'supabase_realtime', 'supabase_storage']);
const provConfigured = (p: string) => SCHOOL_CONFIGURED_PROVIDERS.has(p) || p.endsWith('_optional');

@Injectable()
export class CimolaceBackofficeService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly pawapay: PawaPayService,
    private readonly airtel: AirtelMoneyService,
    private readonly auth: AuthService,
  ) {}

  // ─── IMPERSONATION ENCADRÉE (§15) ─────────────────────────────────────────
  // « Agir en tant que tenant » JAMAIS silencieux : motif obligatoire, durée bornée,
  // token court-terme, log dédié au début ET à la fin, expiration automatique.
  private static readonly IMP_MAX_MINUTES = 120;
  private static readonly IMP_DEFAULT_MINUTES = 30;

  async startImpersonation(
    operator: { id?: string; email?: string } | null,
    clientId: string,
    dto: { reason?: string; durationMinutes?: number; role?: string },
  ) {
    const operatorEmail = String(operator?.email || '').trim();
    const operatorId = String(operator?.id || '').trim();
    if (!operatorEmail && !operatorId) throw new BadRequestException('Opérateur non identifié.');
    const reason = String(dto?.reason || '').trim();
    if (reason.length < 5) throw new BadRequestException('Motif d’impersonation obligatoire (≥ 5 caractères).');

    const client = await this.getClientOrThrow(clientId);
    const tenantId: string | null = client.tenant_id ?? null;
    if (!tenantId) throw new BadRequestException('Ce client n’a pas de tenant applicatif à impersonater.');
    const { data: tenant } = await (this.supabase.client as any)
      .from('tenants').select('id, slug, name').eq('id', tenantId).maybeSingle();
    if (!tenant) throw new NotFoundException('Tenant introuvable.');

    // Rôle d'impersonation borné (défaut admin : voir/dépanner sans être owner). owner sur demande.
    const role = dto?.role === 'owner' ? 'owner' : 'admin';
    const minutes = Math.min(
      CimolaceBackofficeService.IMP_MAX_MINUTES,
      Math.max(5, Number(dto?.durationMinutes) || CimolaceBackofficeService.IMP_DEFAULT_MINUTES),
    );
    const token = this.auth.generateImpersonationToken(
      { operatorId: operatorId || operatorEmail, operatorEmail: operatorEmail || operatorId, tenantId, tenantSlug: tenant.slug, role, reason },
      minutes,
    );
    const expiresAt = new Date(Date.now() + minutes * 60 * 1000).toISOString();

    // LOG DÉDIÉ (attribuable, entity=tenant) — début d'impersonation.
    await this.logChange(
      clientId,
      'impersonation:start',
      `Impersonation de « ${tenant.name || tenant.slug} » (rôle ${role}, ${minutes} min) — motif : ${reason}`,
      operatorEmail || operatorId,
    );

    return { token, tenantId, tenantSlug: tenant.slug, tenantName: tenant.name ?? null, role, reason, expiresAt };
  }

  async endImpersonation(
    operator: { id?: string; email?: string } | null,
    clientId: string,
    dto: { reason?: string },
  ) {
    const operatorLabel = String(operator?.email || operator?.id || '').trim();
    const client = await this.getClientOrThrow(clientId);
    await this.logChange(
      clientId,
      'impersonation:end',
      `Fin d’impersonation${dto?.reason ? ` — ${String(dto.reason).trim()}` : ''}`,
      operatorLabel || undefined,
    );
    return { ok: true, clientId, tenantId: client.tenant_id ?? null };
  }

  /** Oversight : impersonations démarrées récemment sans fin correspondante (best-effort). */
  async listActiveImpersonations() {
    const since = new Date(Date.now() - CimolaceBackofficeService.IMP_MAX_MINUTES * 60 * 1000).toISOString();
    const { data } = await (this.supabase.client as any)
      .from('cimolace_change_history')
      .select('entity_id, action, description, changed_by, created_at')
      .in('action', ['impersonation:start', 'impersonation:end'])
      .gte('created_at', since)
      .order('created_at', { ascending: false });
    const rows = (data as any[]) || [];
    // entity_id = clientId (cimolace_clients.id), PAS tenants.id — l'audit logChange keye par client.
    const endedClients = new Set(rows.filter((r) => r.action === 'impersonation:end').map((r) => r.entity_id));
    const active = rows
      .filter((r) => r.action === 'impersonation:start' && !endedClients.has(r.entity_id))
      .map((r) => ({ clientId: r.entity_id, operator: r.changed_by, description: r.description, startedAt: r.created_at }));
    return { active, windowMinutes: CimolaceBackofficeService.IMP_MAX_MINUTES };
  }

  // ─── Finances PLATEFORME (console SaaS Cimolace) ──────────────────────────
  private static ZERO_DECIMAL = new Set(['XAF', 'XOF', 'XPF', 'BIF', 'CLP', 'DJF', 'GNF', 'JPY', 'KMF', 'KRW', 'MGA', 'PYG', 'RWF', 'UGX', 'VND', 'VUV']);

  /** Vue financière SaaS : VRAIS soldes wallet pawaPay + revenus tenants payés + retraits plateforme. */
  async getPlatformFinances() {
    const sb = this.supabase.client as any;
    let walletBalances: Array<{ country: string; balance: string; currency: string; provider?: string }> = [];
    try { walletBalances = await this.pawapay.getWalletBalances(); } catch { walletBalances = []; }
    const { data: invoices } = await sb.from('billing_invoices').select('amount_cents, status');
    const revenuePaidCents = (invoices ?? []).filter((i: any) => String(i.status || '').toLowerCase() === 'paid').reduce((s: number, i: any) => s + Number(i.amount_cents || 0), 0);
    const { data: payouts } = await sb.from('billing_payouts').select('amount_cents, status').is('tenant_id', null);
    const withdrawnCents = (payouts ?? []).filter((p: any) => !['failed', 'rejected'].includes(String(p.status || '').toLowerCase())).reduce((s: number, p: any) => s + Number(p.amount_cents || 0), 0);
    const wallets = await this.listWallets();
    return { walletBalances, revenuePaidCents, withdrawnCents, wallets };
  }

  /** Porte-monnaie (couche logique par produit : afritrack, liri, mbolo, medos…). Solde = Σ entries. */
  async listWallets() {
    const sb = this.supabase.client as any;
    const { data: wallets } = await sb.from('cimolace_wallets').select('*').order('created_at', { ascending: true });
    const { data: entries } = await sb.from('cimolace_wallet_entries').select('wallet_key, amount_cents');
    const bal: Record<string, number> = {};
    for (const e of entries ?? []) bal[e.wallet_key] = (bal[e.wallet_key] || 0) + Number(e.amount_cents || 0);
    return (wallets ?? []).map((w: any) => ({ key: w.key, label: w.label, color: w.color, currency: w.currency, balanceCents: bal[w.key] || 0 }));
  }

  async createWallet(dto: { key?: string; label?: string; color?: string }) {
    const key = String(dto?.key || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');
    const label = String(dto?.label || '').trim();
    if (!key || !label) throw new BadRequestException('key et label requis');
    const { data, error } = await (this.supabase.client as any).from('cimolace_wallets').insert({ key, label, color: dto?.color || '#7c3aed' }).select('*').single();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  /** Attribuer (ou désattribuer si négatif) un montant à un porte-monnaie — attribution manuelle. */
  async allocateWallet(walletKey: string, dto: { amountCents?: number; note?: string; currency?: string }, createdBy: string | null) {
    const amountCents = Math.round(Number(dto?.amountCents) || 0);
    if (!amountCents) throw new BadRequestException('amountCents requis (négatif pour désattribuer)');
    const { error } = await (this.supabase.client as any).from('cimolace_wallet_entries').insert({ wallet_key: walletKey, amount_cents: amountCents, currency: (dto?.currency || 'XAF').toUpperCase(), kind: 'allocation', note: dto?.note ?? null, created_by: createdBy });
    if (error) throw new BadRequestException(error.message);
    return { ok: true };
  }

  async getPlatformPayouts() {
    const { data } = await (this.supabase.client as any).from('billing_payouts').select('*').is('tenant_id', null).order('created_at', { ascending: false });
    return data ?? [];
  }

  /** Retrait PLATEFORME : envoie depuis le wallet pawaPay Cimolace vers un mobile money (owner SaaS). */
  async createPlatformPayout(
    createdBy: string | null,
    dto: { amountCents?: number; currency?: string; phoneNumber?: string; mno?: string; recipientName?: string; reason?: string; wallet?: string },
  ) {
    const amountCents = Math.round(Number(dto?.amountCents) || 0);
    if (amountCents <= 0) throw new BadRequestException('amountCents (> 0) requis');
    if (!dto?.phoneNumber || !dto?.mno) throw new BadRequestException('phoneNumber et mno (opérateur) requis');
    const currency = (dto.currency || 'XAF').toUpperCase();
    const sb = this.supabase.client as any;
    const payoutId = randomUUID();
    await sb.from('billing_payouts').insert({
      tenant_id: null, payout_id: payoutId, provider: 'pawapay', status: 'pending',
      amount_cents: amountCents, currency, phone_number: dto.phoneNumber, mno: dto.mno,
      recipient_name: dto.recipientName ?? null, reason: dto.reason ?? 'Retrait plateforme Cimolace', created_by: createdBy, wallet: dto.wallet ?? null,
    });
    const amount = CimolaceBackofficeService.ZERO_DECIMAL.has(currency) ? String(amountCents) : (amountCents / 100).toFixed(2);
    let initStatus = 'pending';
    try {
      const init = await this.pawapay.initiatePayout({
        payoutId, amount, currency,
        recipient: { type: 'MMO', accountDetails: { phoneNumber: dto.phoneNumber, provider: dto.mno } },
        customerMessage: (dto.reason ?? 'Cimolace payout').slice(0, 22),
        metadata: { platform: 'cimolace' },
      });
      initStatus = (init.status || 'ACCEPTED').toLowerCase();
      await sb.from('billing_payouts').update({ status: initStatus, updated_at: new Date().toISOString() }).eq('payout_id', payoutId);
      if (dto.wallet) {
        await sb.from('cimolace_wallet_entries').insert({ wallet_key: dto.wallet, amount_cents: -amountCents, currency, kind: 'payout', note: dto.reason ?? 'Retrait', ref_id: payoutId, created_by: createdBy });
      }
    } catch (e) {
      await sb.from('billing_payouts').update({ status: 'failed', failure_message: (e as Error).message, updated_at: new Date().toISOString() }).eq('payout_id', payoutId);
      throw e;
    }
    return { payout_id: payoutId, status: initStatus, amount_cents: amountCents, currency };
  }

  /**
   * Décaissement Airtel Money (rail DIRECT, sandbox par défaut). Débite le wallet
   * Airtel Money marchand — indépendant de pawaPay. Tracé dans billing_payouts
   * (provider='airtel') comme les payouts pawaPay.
   */
  async airtelDisburse(
    createdBy: string | null,
    dto: { amountCents?: number; currency?: string; phoneNumber?: string; reference?: string; wallet?: string },
  ) {
    const amountCents = Math.round(Number(dto?.amountCents) || 0);
    if (amountCents <= 0) throw new BadRequestException('amountCents (> 0) requis');
    if (!dto?.phoneNumber) throw new BadRequestException('phoneNumber requis');
    const currency = (dto.currency || 'XAF').toUpperCase();
    const sb = this.supabase.client as any;
    const payoutId = randomUUID();
    await sb.from('billing_payouts').insert({
      tenant_id: null, payout_id: payoutId, provider: 'airtel', status: 'pending',
      amount_cents: amountCents, currency, phone_number: dto.phoneNumber,
      reason: dto.reference ?? 'Décaissement Airtel Cimolace', created_by: createdBy, wallet: dto.wallet ?? null,
    });
    // XAF (zéro-décimale) → montant en unité majeure = amountCents ; sinon /100.
    const amount = CimolaceBackofficeService.ZERO_DECIMAL.has(currency) ? amountCents : amountCents / 100;
    let initStatus = 'pending';
    try {
      const res = await this.airtel.disburse({
        msisdn: dto.phoneNumber, amount, transactionId: payoutId, reference: dto.reference,
      });
      initStatus = String(res?.data?.transaction?.status ?? 'accepted').toLowerCase();
      await sb.from('billing_payouts').update({ status: initStatus, updated_at: new Date().toISOString() }).eq('payout_id', payoutId);
      if (dto.wallet) {
        await sb.from('cimolace_wallet_entries').insert({ wallet_key: dto.wallet, amount_cents: -amountCents, currency, kind: 'payout', note: dto.reference ?? 'Décaissement Airtel', ref_id: payoutId, created_by: createdBy });
      }
    } catch (e) {
      await sb.from('billing_payouts').update({ status: 'failed', failure_message: (e as Error).message, updated_at: new Date().toISOString() }).eq('payout_id', payoutId);
      throw e;
    }
    return { payout_id: payoutId, status: initStatus, amount_cents: amountCents, currency };
  }

  /** Statut d'un décaissement Airtel (polling). */
  async airtelStatus(transactionId: string) {
    return this.airtel.getDisbursementStatus(transactionId);
  }

  async getStats() {
    const [tenants, clients, sites] = await Promise.all([
      (this.supabase.client as any).from('tenants').select('id, name, plan, status, created_at').order('created_at', { ascending: false }),
      (this.supabase.client as any).from('cimolace_clients').select('id, name, status, created_at').order('created_at', { ascending: false }),
      (this.supabase.client as any).from('cimolace_sites').select('id, domain, status, created_at').order('created_at', { ascending: false }),
    ]);
    return {
      tenants: tenants.data ?? [], totalTenants: tenants.data?.length ?? 0,
      clients: clients.data ?? [], totalClients: clients.data?.length ?? 0,
      sites: sites.data ?? [], totalSites: sites.data?.length ?? 0,
    };
  }

  async listClients() {
    const { data } = await (this.supabase.client as any).from('cimolace_clients').select('*').order('created_at', { ascending: false });
    return data ?? [];
  }

  async createClient(dto: CreateClientDto) {
    const { data, error } = await (this.supabase.client as any).from('cimolace_clients').insert({
      name: dto.name, email: dto.email ?? '', plan: dto.plan ?? 'starter', status: 'active',
    }).select('*').single();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async updateClient(clientId: string, dto: UpdateClientDto, actor?: string) {
    const patch: any = {};
    if (dto.name) patch.name = dto.name;
    if (dto.email !== undefined) patch.email = dto.email;
    if (dto.status) patch.status = dto.status;
    const { data, error } = await (this.supabase.client as any).from('cimolace_clients').update(patch).eq('id', clientId).select('*').single();
    if (error || !data) throw new NotFoundException('Client introuvable');
    await this.logChange(clientId, 'client:update', `Fiche client mise à jour (${Object.keys(patch).join(', ') || '—'})`, actor);
    return data;
  }

  async listSites() {
    const { data } = await (this.supabase.client as any).from('cimolace_sites').select('*').order('created_at', { ascending: false });
    return data ?? [];
  }

  async getClientSites(clientId: string) {
    const { data } = await (this.supabase.client as any).from('cimolace_sites').select('*').eq('client_id', clientId);
    return data ?? [];
  }

  private async getClientOrThrow(clientId: string) {
    const { data, error } = await (this.supabase.client as any)
      .from('cimolace_clients').select('*').eq('id', clientId).maybeSingle();
    if (error) throw new BadRequestException(error.message);
    if (!data) throw new NotFoundException('Client introuvable');
    return data;
  }

  /** Journalise une action opérateur dans cimolace_change_history (best-effort). */
  // SÉCURITÉ §15 : audit ATTRIBUABLE — `actor` = email/id de l'opérateur (req.user),
  // pour savoir QUI a suspendu/facturé/basculé un tenant. À défaut → 'Cimolace Ops (non attribué)'
  // (rend visible toute écriture non tracée au lieu de la masquer sous un libellé générique).
  private async logChange(clientId: string, action: string, description: string, actor?: string) {
    try {
      await (this.supabase.client as any).from('cimolace_change_history').insert({
        action,
        entity_type: 'cimolace_client',
        entity_id: clientId,
        description,
        changed_by: (actor && actor.trim()) || 'Cimolace Ops (non attribué)',
      });
    } catch {
      /* journalisation best-effort : ne bloque jamais l'opération */
    }
  }

  /**
   * Construit le `schoolModel` (onglet Modèle école) à partir du manifeste
   * SCHOOL_ENGINE_MANIFEST et de l'état réel du tenant (tenant_services +
   * branding). Renvoie null si le client n'est pas de type 'school'.
   */
  private buildSchoolModel(client: any, appTenant: any, services: any[]) {
    if (client?.client_type !== 'school') return null;

    const byKey = new Map(services.map((s: any) => [s.service_key, s]));
    const isActive = (k: string) => byKey.get(k)?.active === true || byKey.get(k)?.status === 'active';
    const branding = appTenant?.metadata?.branding || {};
    const plan = appTenant?.plan || 'school';
    const limits = SCHOOL_PLAN_LIMITS[plan] || SCHOOL_PLAN_LIMITS.school;

    const productEngines = SCHOOL_ENGINE_MANIFEST.map((m) => {
      const svc = byKey.get(m.key);
      const active = isActive(m.key);
      const providers = m.requiredProviders.map((p) => ({ provider: p, configured: provConfigured(p) }));
      const providersReady = providers.every((p) => p.configured);
      const quota = svc?.settings?.quota ?? null;
      const checks = {
        engine: active ? 'ready' : 'missing',
        shell: m.readiness === 'needs_shell' ? 'partial' : 'ready',
        providers: providersReady ? 'ready' : providers.some((p) => p.configured) ? 'partial' : 'missing',
        branding: branding?.logo_url ? 'ready' : 'partial',
        quotas: quota != null ? 'ready' : 'missing',
        billing: 'ready',
      };
      const readyCount = Object.values(checks).filter((c) => c === 'ready').length;
      const score = Math.round((readyCount / Object.keys(checks).length) * 100);
      return {
        key: m.key,
        label: m.label,
        role: m.role,
        routes: m.routes,
        requiredForBase: m.tier === 'core',
        requiredProviders: m.requiredProviders,
        brandingZones: m.brandingZones,
        shell: m.shell,
        readiness: m.readiness,
        readinessNotes: m.readinessNotes,
        active,
        status: active ? 'active' : 'missing',
        quota_used: svc?.settings?.quota_used ?? null,
        quota_limit: quota,
        coverage: {
          status: score >= 80 ? 'ready' : score >= 40 ? 'partial' : 'missing',
          score,
          checks,
          operations: {
            providers,
            quota: { limit: quota, recommendedDefault: limits.maxStudents, unit: '' },
          },
        },
      };
    });

    const baseActiveCount = SCHOOL_BASE_ENGINES.filter((k) => isActive(k)).length;
    const recommendedActiveCount = SCHOOL_RECOMMENDED_ENGINES.filter((k) => isActive(k)).length;
    const missingRecommendedEngines = SCHOOL_RECOMMENDED_ENGINES.filter((k) => !isActive(k));

    const categories = [...new Set(SCHOOL_ENGINE_MANIFEST.map((m) => m.category))];
    const capabilities = categories.map((cat) => {
      const engines = SCHOOL_ENGINE_MANIFEST.filter((m) => m.category === cat);
      const activeEngines = engines.filter((m) => isActive(m.key));
      return {
        label: cat,
        category: cat,
        status: activeEngines.length === engines.length ? 'active' : activeEngines.length ? 'partial' : 'missing',
        serviceKeys: engines.map((m) => m.key),
        detail: `${activeEngines.length}/${engines.length} moteur(s) actif(s)`,
      };
    });

    const brandingRequirements = [
      { label: 'Logo', key: 'logo_url', configured: !!branding.logo_url, value: branding.logo_url || '', detail: 'Logo du tenant école.' },
      { label: 'Domaine', key: 'primary_domain', configured: !!(branding.primary_domain || appTenant?.metadata?.primary_domain), value: branding.primary_domain || appTenant?.metadata?.primary_domain || '', detail: 'Domaine principal du portail école.' },
      { label: 'Couleur primaire', key: 'brand_colors', configured: !!branding.brand_colors?.primary, value: branding.brand_colors?.primary || '', detail: 'Charte couleur du tenant.' },
      { label: 'Zones de marque', key: 'zones', configured: !!branding.zones, value: branding.zones ? 'configurées' : '', detail: 'Zones de branding (member app, live studio, vitrine).' },
    ];
    const brandingConfiguredCount = brandingRequirements.filter((b) => b.configured).length;
    const missingBranding = brandingRequirements.filter((b) => !b.configured).map((b) => b.label);

    return {
      summary: {
        baseCount: SCHOOL_BASE_ENGINES.length,
        baseActiveCount,
        recommendedCount: SCHOOL_RECOMMENDED_ENGINES.length,
        recommendedActiveCount,
        capabilityCount: capabilities.length,
        capabilityActiveCount: capabilities.filter((c) => c.status === 'active').length,
        brandingRequirementCount: brandingRequirements.length,
        brandingConfiguredCount,
        missingRecommendedEngines,
        missingBranding,
      },
      productEngines,
      capabilities,
      branding: {
        logo_url: branding.logo_url || null,
        primary_domain: branding.primary_domain || appTenant?.metadata?.primary_domain || null,
        brand_colors: branding.brand_colors || {},
        metadata: branding,
      },
      brandingRequirements,
    };
  }

  /**
   * Control plane d'un client : agrège la fiche client Cimolace, son tenant
   * applicatif (table `tenants`, relié via cimolace_clients.tenant_id), ses
   * abonnements / factures / services / sites, plus un `summary` de compteurs.
   * Toutes les clés attendues par la page détail sont présentes (tableaux vides
   * par défaut) pour éviter tout undefined côté frontend.
   */
  async getClientControlPlane(clientId: string) {
    const client = await this.getClientOrThrow(clientId);
    const tenantId: string | null = client.tenant_id ?? null;
    const db = this.supabase.client as any;

    const [tenantRes, subsRes, invoicesRes, servicesRes, sitesRes, plansRes, ticketsRes, apiKeysRes] = await Promise.all([
      tenantId
        ? db.from('tenants').select('*').eq('id', tenantId).maybeSingle()
        : Promise.resolve({ data: null }),
      tenantId
        ? db.from('billing_subscriptions').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false })
        : Promise.resolve({ data: [] }),
      tenantId
        ? db.from('billing_invoices').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false })
        : Promise.resolve({ data: [] }),
      tenantId
        ? db.from('tenant_services').select('*').eq('tenant_id', tenantId)
        : Promise.resolve({ data: [] }),
      db.from('cimolace_sites').select('*').eq('client_id', clientId),
      db.from('billing_plans').select('key, label, price_cents, currency'),
      client.email
        ? db.from('cimolace_tickets').select('*').eq('contact_email', client.email).order('created_at', { ascending: false })
        : Promise.resolve({ data: [] }),
      tenantId
        ? db.from('tenant_api_keys').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false })
        : Promise.resolve({ data: [] }),
    ]);

    const appTenant = tenantRes.data ?? null;
    const planByKey: Record<string, any> = Object.fromEntries(
      (plansRes.data ?? []).map((p: any) => [p.key, p]),
    );

    const subscriptions = (subsRes.data ?? []).map((s: any) => ({
      ...s,
      plan: planByKey[s.plan_id]?.label || s.plan_id || '-',
      amount: (s.amount_cents ?? planByKey[s.plan_id]?.price_cents ?? 0) / 100,
    }));
    const invoices = invoicesRes.data ?? [];
    // tenant_services porte `active`/`settings` ; la page détail lit
    // `status`/`config` → on mappe pour l'onglet Moteurs + le toggle Twin.
    const services = (servicesRes.data ?? []).map((s: any) => ({
      ...s,
      status: s.status ?? (s.active ? 'active' : 'suspended'),
      config: s.config ?? s.settings ?? {},
      activated_at: s.activated_at ?? s.created_at ?? null,
    }));
    const sites = sitesRes.data ?? [];
    const tickets = ticketsRes.data ?? [];

    // Credentials = références cimolace_credentials (par site, ex. ISNA) +
    // clés API du tenant (tenant_api_keys, ex. Zahir mdk_/mbk_) en lecture.
    const apiKeys = apiKeysRes.data ?? [];
    const siteCreds = sites.length
      ? (await db.from('cimolace_credentials').select('*').in('site_id', sites.map((s: any) => s.id))).data ?? []
      : [];
    const credentials = [
      ...siteCreds,
      ...apiKeys.map((k: any) => ({
        id: k.id,
        key_name: k.label || k.key_prefix,
        key_type: k.key_prefix?.startsWith('mdk_')
          ? 'medos_api_key'
          : k.key_prefix?.startsWith('mbk_')
            ? 'mbolo_api_key'
            : k.key_prefix?.startsWith('cml_')
              ? 'cimolace_api_key'
              : 'tenant_api_key',
        description: k.key_prefix,
        last_rotated_at: k.created_at,
        expires_at: null,
        status: k.revoked_at ? 'revoked' : 'active',
        source: 'tenant_api_key',
      })),
    ];

    const activeSubscriptionCount = subscriptions.filter((s: any) =>
      ['active', 'trialing', 'past_due'].includes(s.status),
    ).length;
    const unpaidInvoiceCount = invoices.filter(
      (i: any) => i.status && !['paid', 'void', 'canceled', 'refunded'].includes(i.status),
    ).length;
    const openTicketCount = tickets.filter(
      (t: any) => t.status && !['closed', 'resolved'].includes(t.status),
    ).length;

    // Onglets Données tenant / Logs / (Maintenance déploiements, API étapes).
    const siteIds = sites.map((s: any) => s.id);
    const [changeHistRes, deploysRes, configRes, usageRes] = await Promise.all([
      db.from('cimolace_change_history').select('*').eq('entity_id', clientId).order('created_at', { ascending: false }).limit(50),
      siteIds.length ? db.from('cimolace_deployments').select('*').in('site_id', siteIds).order('created_at', { ascending: false }) : Promise.resolve({ data: [] }),
      siteIds.length ? db.from('cimolace_configuration_steps').select('*').in('site_id', siteIds).order('step_number', { ascending: true }) : Promise.resolve({ data: [] }),
      siteIds.length ? db.from('cimolace_usage_logs').select('*').in('site_id', siteIds).order('created_at', { ascending: false }).limit(50) : Promise.resolve({ data: [] }),
    ]);
    const changeHistory = changeHistRes.data ?? [];
    const deployments = deploysRes.data ?? [];
    const configurationSteps = configRes.data ?? [];
    const usageLogs = usageRes.data ?? [];

    const summary = {
      appTenantStatus: appTenant?.status ?? null,
      lastTenantOperation: appTenant?.metadata?.operations ?? null,
      maintenance: Boolean(appTenant?.metadata?.maintenance),
      siteCount: sites.length,
      activeSiteCount: sites.filter((s: any) => s.status === 'active').length,
      engineCount: services.length,
      activeEngineCount: services.filter((s: any) => s.active).length,
      activeSubscriptionCount,
      credentialCount: credentials.length,
      openTicketCount,
      unpaidInvoiceCount,
      missingRecommendedEngines: [] as string[],
    };

    return {
      client,
      summary,
      tenants: { app: appTenant ? [appTenant] : [], cimolace: [] },
      sites,
      services,
      subscriptions,
      invoices,
      appBilling: { invoices: [] },
      warnings: [],
      schoolModel: this.buildSchoolModel(client, appTenant, services),
      schoolProviders: [],
      credentials,
      deployments,
      configurationSteps,
      changeHistory,
      tickets,
      usageLogs,
    };
  }

  /**
   * Diagnostic léger d'un client : vérifie la fiche + le lien au tenant
   * applicatif et expose la forme `readiness`/`checks` attendue par l'onglet
   * Diagnostic. Volontairement minimal — extensible plus tard.
   */
  async getClientDiagnostics(clientId: string) {
    const client = await this.getClientOrThrow(clientId);
    const tenantId: string | null = client.tenant_id ?? null;
    const db = this.supabase.client as any;

    const [tenantRes, subsRes, keysRes, servicesRes, invoicesRes] = await Promise.all([
      tenantId ? db.from('tenants').select('id, slug, status, metadata').eq('id', tenantId).maybeSingle() : Promise.resolve({ data: null }),
      tenantId ? db.from('billing_subscriptions').select('status').eq('tenant_id', tenantId) : Promise.resolve({ data: [] }),
      tenantId ? db.from('tenant_api_keys').select('revoked_at').eq('tenant_id', tenantId) : Promise.resolve({ data: [] }),
      tenantId ? db.from('tenant_services').select('active').eq('tenant_id', tenantId) : Promise.resolve({ data: [] }),
      tenantId ? db.from('billing_invoices').select('status').eq('tenant_id', tenantId) : Promise.resolve({ data: [] }),
    ]);

    const appTenant = tenantRes.data ?? null;
    const subs = subsRes.data ?? [];
    const keys = (keysRes.data ?? []).filter((k: any) => !k.revoked_at);
    const activeEngines = (servicesRes.data ?? []).filter((s: any) => s.active);
    const unpaid = (invoicesRes.data ?? []).filter((i: any) => i.status && !['paid', 'void', 'canceled', 'refunded'].includes(i.status));
    const activeSub = subs.some((s: any) => ['active', 'trialing', 'past_due'].includes(s.status));
    const gating = appTenant?.metadata?.billing?.api_gating === true;

    const checks = [
      {
        key: 'app_tenant',
        label: 'Tenant applicatif lié',
        status: appTenant ? 'pass' : 'fail',
        message: appTenant ? `Lié à « ${appTenant.slug} ».` : 'Aucun tenant applicatif rattaché (cimolace_clients.tenant_id).',
        remediation: appTenant ? null : 'Rattacher le client à un tenant via cimolace_clients.tenant_id.',
      },
      {
        key: 'tenant_active',
        label: 'Tenant actif',
        status: appTenant ? (appTenant.status === 'active' ? 'pass' : 'warn') : 'fail',
        message: appTenant ? `Statut : ${appTenant.status}.` : '—',
        remediation: appTenant && appTenant.status !== 'active' ? 'Réactiver le tenant depuis Maintenance.' : null,
      },
      {
        key: 'subscription',
        label: 'Abonnement Cimolace actif',
        status: activeSub ? 'pass' : 'warn',
        message: activeSub ? 'Un abonnement actif couvre le tenant.' : 'Aucun abonnement actif.',
        remediation: activeSub ? null : 'Activer le forfait depuis l’onglet Facturation.',
      },
      {
        key: 'api_key',
        label: 'Clé API tenant',
        status: keys.length ? 'pass' : 'warn',
        message: `${keys.length} clé(s) API active(s).`,
        remediation: keys.length ? null : 'Générer une clé API pour le tenant.',
      },
      {
        key: 'engines',
        label: 'Moteurs actifs',
        status: activeEngines.length ? 'pass' : 'warn',
        message: `${activeEngines.length} moteur(s) actif(s) (tenant_services).`,
        remediation: activeEngines.length ? null : 'Activer les moteurs depuis l’onglet Moteurs.',
      },
      {
        key: 'api_gating',
        label: 'Gating d’abonnement armé',
        status: gating ? 'pass' : 'warn',
        message: gating ? 'metadata.billing.api_gating = true : la clé exige un abonnement.' : 'Gating non armé : la clé API n’exige pas d’abonnement.',
        remediation: gating ? null : 'Armer le gating (tenants.metadata.billing.api_gating).',
      },
      {
        key: 'invoices',
        label: 'Factures',
        status: unpaid.length ? 'warn' : 'pass',
        message: unpaid.length ? `${unpaid.length} facture(s) à surveiller.` : 'Aucune facture en souffrance.',
        remediation: unpaid.length ? 'Vérifier les factures dans l’onglet Facturation.' : null,
      },
    ];

    const blockers = checks.filter((c) => c.status === 'fail').map((c) => ({ key: c.key, label: c.label, message: c.message, remediation: c.remediation }));
    const warnings = checks.filter((c) => c.status === 'warn').map((c) => ({ key: c.key, label: c.label, message: c.message, remediation: c.remediation }));
    const passCount = checks.filter((c) => c.status === 'pass').length;
    const percent = checks.length ? Math.round((passCount / checks.length) * 100) : 0;
    const overall = blockers.length ? 'fail' : warnings.length ? 'warn' : 'pass';

    return {
      generatedAt: new Date().toISOString(),
      overall,
      score: passCount,
      maxScore: checks.length,
      readiness: {
        label: overall === 'pass' ? 'Prêt' : overall === 'warn' ? 'À compléter' : 'Bloqué',
        percent,
        passCount,
        warningCount: warnings.length,
        blockingCount: blockers.length,
        blockers,
        warnings,
      },
      checks,
      proof: { clientId, tenantId },
      providers: null,
      schoolProviders: null,
    };
  }

  /**
   * Crée une facture manuelle billing_invoices pour le tenant applicatif du
   * client. Accepte `amount` (unités) ou `amount_cents`.
   */
  async createTenantInvoice(clientId: string, dto: any, actor?: string) {
    const client = await this.getClientOrThrow(clientId);
    if (!client.tenant_id) {
      throw new BadRequestException('Tenant applicatif requis pour créer une facture.');
    }
    const amountCents =
      dto?.amount_cents != null
        ? Math.round(Number(dto.amount_cents))
        : Math.round(Number(dto?.amount || 0) * 100);

    const { data, error } = await (this.supabase.client as any)
      .from('billing_invoices')
      .insert({
        tenant_id: client.tenant_id,
        invoice_number: dto?.invoice_number ?? null,
        amount_cents: amountCents,
        currency: dto?.currency ?? 'EUR',
        status: dto?.status ?? 'pending',
        provider: dto?.provider ?? 'manual',
        description: dto?.description ?? dto?.type ?? null,
        due_date: dto?.due_date ?? null,
        metadata: dto?.metadata ?? {},
      })
      .select('*')
      .single();
    if (error) throw new BadRequestException(error.message);
    await this.logChange(clientId, 'invoice:create', `Facture ${data.invoice_number ?? data.id} créée`, actor);
    return data;
  }

  /**
   * Active/coupe un moteur (tenant_services) du tenant applicatif du client.
   * Accepte `{ status: 'active' | 'suspended' }` (onglet Moteurs) ou
   * `{ active: boolean }`. Renvoie la ligne mappée (status/config) comme
   * dans le control plane.
   */
  async updateTenantService(clientId: string, serviceId: string, dto: any, actor?: string) {
    const client = await this.getClientOrThrow(clientId);
    if (!client.tenant_id) {
      throw new BadRequestException('Tenant applicatif requis pour gérer les moteurs.');
    }
    const patch: any = { updated_at: new Date().toISOString() };
    if (typeof dto?.active === 'boolean') {
      patch.active = dto.active;
    } else if (dto?.status) {
      patch.active = dto.status === 'active';
    } else {
      throw new BadRequestException('Champ `status` ou `active` requis.');
    }

    const { data, error } = await (this.supabase.client as any)
      .from('tenant_services')
      .update(patch)
      .eq('id', serviceId)
      .eq('tenant_id', client.tenant_id)
      .select('*')
      .maybeSingle();
    if (error) throw new BadRequestException(error.message);
    if (!data) throw new NotFoundException('Moteur introuvable pour ce tenant');
    await this.logChange(clientId, `service:${data.active ? 'active' : 'suspended'}`, `Moteur ${data.service_key} → ${data.active ? 'actif' : 'suspendu'}`, actor);
    return {
      ...data,
      status: data.active ? 'active' : 'suspended',
      config: data.settings ?? {},
      activated_at: data.activated_at ?? data.created_at ?? null,
    };
  }

  /**
   * Multiplexeur des commandes opérateur du control plane (POST .../operations).
   * Selon les champs du body : `maintenance` (tenants.metadata.maintenance),
   * `status` (cimolace_clients.status — Suspendre/Réactiver),
   * `ensure_owner_membership` (tenant_memberships owner via owner_email),
   * `record_readiness_check` (journal dans tenants.metadata.readiness).
   * Ne renvoie PAS `controlPlane` → le frontend recharge l'état après coup.
   */
  async runTenantOperation(clientId: string, dto: any, actor?: string) {
    const client = await this.getClientOrThrow(clientId);
    const tenantId: string | null = client.tenant_id ?? null;
    const db = this.supabase.client as any;
    const now = new Date().toISOString();
    const done: string[] = [];

    let tenantMeta: any = null;
    if (tenantId) {
      const { data: t } = await db.from('tenants').select('metadata').eq('id', tenantId).maybeSingle();
      tenantMeta = { ...(t?.metadata || {}) };
    }

    if (typeof dto?.maintenance === 'boolean') {
      if (!tenantMeta) throw new BadRequestException('Tenant applicatif requis pour la maintenance.');
      tenantMeta.maintenance = dto.maintenance;
      done.push(dto.maintenance ? 'maintenance_on' : 'maintenance_off');
    }

    if (dto?.status) {
      await db.from('cimolace_clients').update({ status: dto.status, updated_at: now }).eq('id', clientId);
      done.push(`client_${dto.status}`);
    }

    if (dto?.ensure_owner_membership) {
      const email = String(dto.owner_email || client.email || '').toLowerCase().trim();
      if (!tenantId) throw new BadRequestException('Tenant applicatif requis pour préparer le owner.');
      if (!email) throw new BadRequestException('Email owner requis.');
      const { data: prof } = await db.from('profiles').select('id').eq('email', email).maybeSingle();
      if (prof?.id) {
        const { data: existing } = await db
          .from('tenant_memberships')
          .select('id, role')
          .eq('tenant_id', tenantId)
          .eq('user_id', prof.id)
          .maybeSingle();
        if (existing?.id) {
          if (existing.role !== 'owner') {
            await db.from('tenant_memberships').update({ role: 'owner', status: 'active' }).eq('id', existing.id);
          }
        } else {
          await db.from('tenant_memberships').insert({ tenant_id: tenantId, user_id: prof.id, role: 'owner', status: 'active' });
        }
        done.push('owner_membership');
      } else {
        done.push('owner_membership_skipped_no_profile');
      }
    }

    if (dto?.record_readiness_check && tenantMeta) {
      const readiness = { ...(tenantMeta.readiness || {}) };
      readiness[dto.readiness_key] = {
        status: dto.readiness_status ?? 'verified',
        note: dto.readiness_note ?? null,
        evidence: dto.readiness_evidence ?? null,
        at: now,
      };
      tenantMeta.readiness = readiness;
      done.push('readiness_recorded');
    }

    if (tenantId && tenantMeta) {
      tenantMeta.operations = { last: done[0] ?? 'noop', reason: dto?.reason ?? null, at: now };
      await db.from('tenants').update({ metadata: tenantMeta, updated_at: now }).eq('id', tenantId);
    }

    if (done.length) {
      await this.logChange(clientId, `operation:${done[0]}`, `Opération(s): ${done.join(', ')}${dto?.reason ? ` — ${dto.reason}` : ''}`, actor);
    }
    return { ok: true, operations: done, reason: dto?.reason ?? null, at: now };
  }

  /**
   * Crée un ticket support (cimolace_tickets) rattaché au client via
   * `contact_email` (le control plane relit les tickets par cet email).
   */
  async createTenantTicket(clientId: string, dto: any, actor?: string) {
    const client = await this.getClientOrThrow(clientId);
    const db = this.supabase.client as any;
    const { data: sites } = await db.from('cimolace_sites').select('id').eq('client_id', clientId).limit(1);
    const siteId = sites?.[0]?.id ?? null;
    const ticketNumber = `OPS-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Date.now().toString(36).toUpperCase().slice(-5)}`;

    const { data, error } = await db
      .from('cimolace_tickets')
      .insert({
        site_id: siteId,
        ticket_number: dto?.ticket_number ?? ticketNumber,
        subject: dto?.subject ?? 'Ticket Cimolace',
        description: dto?.description ?? null,
        category: dto?.category ?? 'general',
        priority: dto?.priority ?? 'medium',
        status: dto?.status ?? 'open',
        assignee: dto?.assignee ?? null,
        contact_email: dto?.contact_email ?? client.email ?? null,
      })
      .select('*')
      .single();
    if (error) throw new BadRequestException(error.message);
    await this.logChange(clientId, 'ticket:create', `Ticket ${data.ticket_number ?? data.id} créé : ${data.subject ?? ''}`, actor);
    return data;
  }

  /**
   * Crée une référence de secret (cimolace_credentials) — modèle lié à un SITE.
   * Pour un client sans site (ex. tenant SaaS pur comme Zahir), renvoie une
   * erreur explicite : ses vraies clés sont les tenant_api_keys, listées en
   * lecture seule dans `control-plane.credentials`.
   */
  async createCredentialReference(clientId: string, dto: any) {
    const client = await this.getClientOrThrow(clientId);
    const db = this.supabase.client as any;
    const { data: sites } = await db.from('cimolace_sites').select('id').eq('client_id', clientId).limit(1);
    const siteId = sites?.[0]?.id;
    if (!siteId) {
      throw new BadRequestException(
        "Ce client n'a pas de site Cimolace : une référence credential (LiveKit/Stripe/…) requiert un site. Les clés API du tenant sont déjà listées en lecture seule.",
      );
    }
    const { data, error } = await db
      .from('cimolace_credentials')
      .insert({
        site_id: siteId,
        key_name: dto?.key_name ?? 'credential',
        key_type: dto?.key_type ?? 'api_key',
        description: dto?.description ?? null,
        encrypted_value: dto?.reference ?? dto?.encrypted_value ?? 'pending',
        last_rotated_at: new Date().toISOString(),
      })
      .select('*')
      .single();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  /**
   * Rotation d'une référence credential. Pour une ligne cimolace_credentials :
   * met à jour `last_rotated_at`. Pour une clé API tenant (tenant_api_keys),
   * la régénération se fait via la gestion des clés — soft no-op acquitté ici
   * pour ne pas casser une intégration par mégarde.
   */
  async rotateCredential(clientId: string, credentialId: string, dto: any) {
    await this.getClientOrThrow(clientId);
    const db = this.supabase.client as any;
    const { data: cred } = await db
      .from('cimolace_credentials')
      .select('id')
      .eq('id', credentialId)
      .maybeSingle();
    if (cred?.id) {
      const now = new Date().toISOString();
      const { data, error } = await db
        .from('cimolace_credentials')
        .update({ last_rotated_at: now, updated_at: now })
        .eq('id', credentialId)
        .select('*')
        .single();
      if (error) throw new BadRequestException(error.message);
      return data;
    }
    return {
      ok: true,
      credential_id: credentialId,
      note: 'Clé API tenant : la régénération se fait via la gestion des clés API (non modifiée ici).',
      reason: dto?.reason ?? null,
    };
  }

  // ── Modèle école : provisioning ────────────────────────────────────────────

  private async getSchoolTenantId(clientId: string): Promise<string> {
    const client = await this.getClientOrThrow(clientId);
    if (client.client_type !== 'school') {
      throw new BadRequestException("Ce client n'est pas une infrastructure école.");
    }
    if (!client.tenant_id) {
      throw new BadRequestException('Tenant applicatif requis (cimolace_clients.tenant_id).');
    }
    return client.tenant_id;
  }

  /** Active (upsert) les moteurs école recommandés dans tenant_services. */
  async activateSchoolModelEngines(clientId: string, _dto: any) {
    const tenantId = await this.getSchoolTenantId(clientId);
    const db = this.supabase.client as any;
    const now = new Date().toISOString();
    const { data: existing } = await db.from('tenant_services').select('id, service_key').eq('tenant_id', tenantId);
    const byKey = new Map((existing ?? []).map((s: any) => [s.service_key, s]));
    const activated: string[] = [];
    for (const key of SCHOOL_RECOMMENDED_ENGINES) {
      const ex: any = byKey.get(key);
      if (ex) {
        await db.from('tenant_services').update({ active: true, updated_at: now }).eq('id', ex.id);
      } else {
        await db.from('tenant_services').insert({ tenant_id: tenantId, service_key: key, active: true });
      }
      activated.push(key);
    }
    await this.logChange(clientId, 'school:activate-engines', `Moteurs école activés (${activated.length})`);
    return { ok: true, activated };
  }

  /** Prépare le tenant école : active les moteurs + pose des zones de branding par défaut. */
  async prepareSchoolModel(clientId: string, dto: any) {
    const tenantId = await this.getSchoolTenantId(clientId);
    await this.activateSchoolModelEngines(clientId, dto);
    const db = this.supabase.client as any;
    const { data: t } = await db.from('tenants').select('metadata').eq('id', tenantId).maybeSingle();
    const meta = t?.metadata || {};
    const branding = meta.branding || {};
    if (!branding.zones) {
      branding.zones = { memberApp: true, adminBackoffice: true, liveStudio: true, publicVitrine: true };
    }
    await db.from('tenants').update({ metadata: { ...meta, branding }, updated_at: new Date().toISOString() }).eq('id', tenantId);
    await this.logChange(clientId, 'school:prepare', 'Tenant école préparé (moteurs + branding par défaut)');
    return { ok: true, prepared: true };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ONBOARDING ÉCOLE — endpoints /school-onboarding/* (SchoolOnboardingController)
  // Ces 4 méthodes étaient appelées via `as any` sur un controller JAMAIS
  // enregistré → 404 (audit 2026-07-03, P0 : « vendre un parcours qui n'existe
  // pas »). Réimplémentées ici sur les mêmes patterns que le reste du service.
  // ═══════════════════════════════════════════════════════════════════════════

  /** Manifeste des moteurs école (catalogue + tiers + quotas par plan). Lecture seule. */
  getSchoolEngineManifest() {
    return {
      engines: SCHOOL_ENGINE_MANIFEST,
      baseEngines: SCHOOL_BASE_ENGINES,
      recommendedEngines: SCHOOL_RECOMMENDED_ENGINES,
      planLimits: SCHOOL_PLAN_LIMITS,
    };
  }

  /**
   * DRY-RUN : ce qui SERAIT créé/activé pour une école, sans aucune écriture.
   * Sert à l'écran de prévisualisation du wizard opérateur.
   */
  async previewProvisionSchool(dto: ProvisionSchoolDto) {
    const plan = dto.plan ?? 'school';
    const limits = SCHOOL_PLAN_LIMITS[plan] ?? SCHOOL_PLAN_LIMITS.school;
    const db = this.supabase.client as any;
    const { data: slugTaken } = await db
      .from('tenants').select('id').eq('slug', dto.slug).maybeSingle();
    const { data: ownerProfile } = await db
      .from('profiles').select('id').eq('email', String(dto.owner_email).toLowerCase()).maybeSingle();
    const engines = SCHOOL_RECOMMENDED_ENGINES.map((key) => {
      const m = SCHOOL_ENGINE_MANIFEST.find((e) => e.key === key);
      return {
        key,
        label: m?.label ?? key,
        tier: m?.tier ?? 'recommended',
        readiness: m?.readiness ?? 'ready',
        providersNeeded: (m?.requiredProviders ?? []).filter((p) => !provConfigured(p)),
      };
    });
    return {
      willCreate: {
        tenant: { name: dto.name, slug: dto.slug, plan, status: 'active' },
        client: { name: dto.name, email: dto.contact_email ?? dto.owner_email, client_type: 'school' },
        engines,
        limits,
        brandingZones: dto.branding_zones ?? {
          header: true, footer: true, publicVitrine: true,
          memberApp: true, liveStudio: true, adminBackoffice: true,
        },
      },
      checks: {
        slugAvailable: !slugTaken,
        ownerHasAccount: !!ownerProfile?.id,
        // Providers manquants tous moteurs confondus (informatif).
        missingProviders: [
          ...new Set(engines.flatMap((e) => e.providersNeeded)),
        ],
      },
    };
  }

  /**
   * PROVISIONNE une école de bout en bout (idempotent) : tenant + fiche client
   * liée + moteurs recommandés + branding + quotas. L'accès owner est rattaché
   * si un profil existe déjà pour owner_email, sinon marqué « pending » (à
   * inviter via ensure_owner_membership). N'écrit AUCUN paiement (cf.
   * initiateSchoolCheckout). Rejoue sans doublon (upsert sur slug/service_key).
   */
  async provisionSchoolFromTemplate(dto: ProvisionSchoolDto) {
    const db = this.supabase.client as any;
    const now = new Date().toISOString();
    const plan = dto.plan ?? 'school';
    const limits = SCHOOL_PLAN_LIMITS[plan] ?? SCHOOL_PLAN_LIMITS.school;
    const brandColors = dto.brand_colors ?? {};
    const brandingZones = dto.branding_zones ?? {
      header: true, footer: true, publicVitrine: true,
      memberApp: true, liveStudio: true, adminBackoffice: true,
    };

    // 1) Tenant (créer ou réutiliser par slug — idempotent).
    let { data: tenant } = await db
      .from('tenants').select('id, metadata').eq('slug', dto.slug).maybeSingle();
    const baseMeta = {
      ...(tenant?.metadata ?? {}),
      branding: {
        ...((tenant?.metadata as any)?.branding ?? {}),
        name: dto.name,
        font_family: dto.font_family ?? (tenant?.metadata as any)?.branding?.font_family ?? null,
        radius: dto.radius ?? (tenant?.metadata as any)?.branding?.radius ?? null,
        zones: brandingZones,
      },
      plan_limits: limits,
      provisioned_by: 'school-onboarding',
    };
    if (!tenant) {
      const newTenantId = randomUUID();
      const { data: created, error: tErr } = await db.from('tenants').insert({
        id: newTenantId,
        name: dto.name,
        slug: dto.slug,
        plan,
        status: 'active',
        primary_domain: dto.domain ?? null,
        logo_url: dto.logo_url ?? null,
        brand_colors: brandColors,
        infrastructure_type: 'school',
        metadata: baseMeta,
      }).select('id, metadata').single();
      if (tErr) throw new BadRequestException(`Création tenant échouée : ${tErr.message}`);
      tenant = created;
    } else {
      await db.from('tenants').update({
        name: dto.name, plan, status: 'active',
        primary_domain: dto.domain ?? undefined,
        logo_url: dto.logo_url ?? undefined,
        brand_colors: brandColors,
        metadata: baseMeta,
        updated_at: now,
      }).eq('id', tenant.id);
    }
    const tenantId = tenant.id as string;

    // 2) Fiche client Cimolace (créer ou réutiliser par tenant_id).
    let { data: client } = await db
      .from('cimolace_clients').select('id').eq('tenant_id', tenantId).maybeSingle();
    if (!client) {
      const { data: c } = await db.from('cimolace_clients').insert({
        name: dto.name,
        email: dto.contact_email ?? dto.owner_email,
        plan,
        status: 'active',
        client_type: 'school',
        tenant_id: tenantId,
      }).select('id').single();
      client = c;
    }
    const clientId = client?.id as string;

    // 3) Owner : rattacher si un profil existe déjà, sinon marquer pending.
    let ownerState = 'pending_invite';
    const email = String(dto.owner_email).toLowerCase().trim();
    const { data: prof } = await db.from('profiles').select('id').eq('email', email).maybeSingle();
    if (prof?.id) {
      const { data: existing } = await db
        .from('tenant_memberships').select('id, role')
        .eq('tenant_id', tenantId).eq('user_id', prof.id).maybeSingle();
      if (existing?.id) {
        if (existing.role !== 'owner') {
          await db.from('tenant_memberships').update({ role: 'owner', status: 'active' }).eq('id', existing.id);
        }
      } else {
        await db.from('tenant_memberships').insert({ tenant_id: tenantId, user_id: prof.id, role: 'owner', status: 'active' });
      }
      ownerState = 'linked';
    } else {
      // Trace l'email owner en attente : à inviter via ensure_owner_membership.
      await db.from('tenants').update({
        metadata: { ...baseMeta, pending_owner_email: email }, updated_at: now,
      }).eq('id', tenantId);
    }

    // 4) Moteurs recommandés (upsert dans tenant_services).
    const { data: existingSvcs } = await db.from('tenant_services').select('id, service_key').eq('tenant_id', tenantId);
    const byKey = new Map((existingSvcs ?? []).map((s: any) => [s.service_key, s]));
    const activated: string[] = [];
    for (const key of SCHOOL_RECOMMENDED_ENGINES) {
      const ex: any = byKey.get(key);
      if (ex) {
        await db.from('tenant_services').update({ active: true, updated_at: now }).eq('id', ex.id);
      } else {
        await db.from('tenant_services').insert({ tenant_id: tenantId, service_key: key, active: true });
      }
      activated.push(key);
    }

    if (clientId) {
      await this.logChange(clientId, 'school:provision', `École provisionnée (${activated.length} moteurs, plan ${plan}, owner ${ownerState})`);
    }
    return {
      ok: true,
      tenantId,
      clientId,
      slug: dto.slug,
      plan,
      ownerState,
      activatedEngines: activated,
      limits,
    };
  }

  /**
   * Initie le PAIEMENT d'une école déjà provisionnée. Ne duplique PAS la
   * plomberie Stripe/PawaPay : crée un abonnement `pending` + renvoie l'URL du
   * back-office facturation tenant où le owner règle par carte (Stripe) ou
   * mobile money (PawaPay) via les flux déjà prouvés. `checkoutUrl` est ce que
   * le front doit ouvrir.
   */
  async initiateSchoolCheckout(dto: InitiateSchoolCheckoutDto, _user: { id?: string; email?: string }) {
    const db = this.supabase.client as any;
    const now = new Date().toISOString();
    const { data: tenant } = await db
      .from('tenants').select('id, slug, status').eq('slug', dto.slug).maybeSingle();
    if (!tenant?.id) {
      throw new BadRequestException(
        `École « ${dto.slug} » introuvable — provisionnez-la d'abord (POST /school-onboarding/provision).`,
      );
    }
    // Plan de facturation : clé billing_plans = plan école (starter/pro/business).
    const planKey = dto.plan;
    const { data: plan } = await db
      .from('billing_plans').select('key, price_cents, currency, label').eq('key', planKey).maybeSingle();

    // Abonnement pending (réutilisé s'il existe déjà en pending) — même modèle
    // que BillingService.subscribeToPlan. La confirmation de paiement (webhook)
    // le bascule en active + provisionne les services.
    let { data: sub } = await db
      .from('billing_subscriptions').select('id, status')
      .eq('tenant_id', tenant.id).eq('plan_id', planKey)
      .in('status', ['pending', 'past_due']).order('created_at', { ascending: false })
      .limit(1).maybeSingle();
    if (!sub) {
      const { data: created, error: sErr } = await db.from('billing_subscriptions').insert({
        tenant_id: tenant.id,
        plan_id: planKey,
        provider: dto.provider ?? 'stripe',
        status: 'pending',
        amount_cents: plan?.price_cents ?? null,
        currency: plan?.currency ?? 'EUR',
      }).select('id, status').single();
      if (sErr) throw new BadRequestException(`Création abonnement échouée : ${sErr.message}`);
      sub = created;
    }

    // URL de règlement = back-office facturation tenant (flux carte/MoMo prouvés).
    const frontBase = process.env.FRONTEND_URL || 'https://app.cimolace.space';
    const checkoutUrl =
      dto.success_url ||
      `${frontBase}/cimolace/billing?tenant=${encodeURIComponent(dto.slug)}&plan=${encodeURIComponent(planKey)}&subscription=${encodeURIComponent(String(sub?.id ?? ''))}`;

    return {
      ok: true,
      checkoutUrl,
      subscriptionId: sub?.id ?? null,
      plan: planKey,
      provider: dto.provider ?? 'stripe',
      amountCents: plan?.price_cents ?? null,
      currency: plan?.currency ?? 'EUR',
      createdAt: now,
    };
  }

  /** Pose les quotas recommandés sur les moteurs qui n'en ont pas (sans écraser). */
  async applySchoolModelQuotas(clientId: string, _dto: any) {
    const tenantId = await this.getSchoolTenantId(clientId);
    const db = this.supabase.client as any;
    const { data: t } = await db.from('tenants').select('plan').eq('id', tenantId).maybeSingle();
    const limits = SCHOOL_PLAN_LIMITS[t?.plan || 'school'] || SCHOOL_PLAN_LIMITS.school;
    const quotaFor = (key: string): number => {
      if (key.includes('live')) return limits.maxLivesPerMonth;
      if (key.includes('course') || key.includes('masterclass')) return limits.maxCourses;
      if (key.includes('replay') || key.includes('video') || key.includes('studio')) return limits.maxStorageGb;
      return limits.maxStudents;
    };
    const { data: svcs } = await db.from('tenant_services').select('id, service_key, settings').eq('tenant_id', tenantId);
    const now = new Date().toISOString();
    const applied: string[] = [];
    for (const s of svcs ?? []) {
      const settings = s.settings || {};
      if (settings.quota == null) {
        await db.from('tenant_services').update({ settings: { ...settings, quota: quotaFor(s.service_key) }, updated_at: now }).eq('id', s.id);
        applied.push(s.service_key);
      }
    }
    await this.logChange(clientId, 'school:apply-quotas', `Quotas posés sur ${applied.length} moteur(s)`);
    return { ok: true, applied };
  }

  /** Crée les références providers manquantes (cimolace_credentials) — nécessite un site. */
  async prepareSchoolModelProviders(clientId: string, _dto: any) {
    await this.getSchoolTenantId(clientId);
    const db = this.supabase.client as any;
    const { data: sites } = await db.from('cimolace_sites').select('id').eq('client_id', clientId).limit(1);
    const siteId = sites?.[0]?.id;
    if (!siteId) {
      throw new BadRequestException('Aucun site Cimolace pour ce client — les références providers nécessitent un site.');
    }
    const required = [...new Set(SCHOOL_ENGINE_MANIFEST.flatMap((m) => m.requiredProviders))].filter((p) => !provConfigured(p));
    const { data: existing } = await db.from('cimolace_credentials').select('key_name').eq('site_id', siteId);
    const existingNames = new Set((existing ?? []).map((c: any) => c.key_name));
    const now = new Date().toISOString();
    const created: string[] = [];
    for (const p of required) {
      if (!existingNames.has(p)) {
        await db.from('cimolace_credentials').insert({
          site_id: siteId,
          key_name: p,
          key_type: 'provider_reference',
          description: `Référence provider ${p} (à configurer)`,
          encrypted_value: 'pending',
          last_rotated_at: now,
        });
        created.push(p);
      }
    }
    await this.logChange(clientId, 'school:prepare-providers', `Références providers créées (${created.length})`);
    return { ok: true, created };
  }

  // ── Monitoring (page /cimolace/admin/monitoring) ───────────────────────────

  /** Vue d'ensemble santé de tous les clients : {summary, clients[]}. */
  async getMonitoringOverview() {
    const db = this.supabase.client as any;
    const [clientsRes, tenantsRes, subsRes] = await Promise.all([
      db.from('cimolace_clients').select('id, name, status, client_type, tenant_id, portal_slug').order('created_at', { ascending: false }),
      db.from('tenants').select('id, status, slug'),
      db.from('billing_subscriptions').select('tenant_id, status'),
    ]);
    const clients = clientsRes.data ?? [];
    const tenantsById = new Map((tenantsRes.data ?? []).map((t: any) => [t.id, t]));
    const activeSubTenants = new Set(
      (subsRes.data ?? [])
        .filter((s: any) => ['active', 'trialing', 'past_due'].includes(s.status))
        .map((s: any) => s.tenant_id),
    );

    const enriched = clients.map((c: any) => {
      const tenant: any = tenantsById.get(c.tenant_id);
      const hasSub = activeSubTenants.has(c.tenant_id);
      let overallStatus: string;
      if (!c.tenant_id || !tenant) overallStatus = 'fail';
      else if (tenant.status !== 'active' || !hasSub) overallStatus = 'warn';
      else overallStatus = 'ok';
      return {
        id: c.id,
        name: c.name,
        slug: c.portal_slug || tenant?.slug || '',
        overallStatus,
        providers: [
          { key: 'supabase', status: tenant ? 'ok' : 'unknown' },
          { key: 'livekit', status: 'unknown' },
          { key: 'ai', status: 'unknown' },
          { key: 'payment', status: hasSub ? 'ok' : 'unknown' },
          { key: 'email_sms_optional', status: 'unknown' },
        ],
      };
    });

    return {
      summary: {
        total: enriched.length,
        ok: enriched.filter((c: any) => c.overallStatus === 'ok').length,
        warn: enriched.filter((c: any) => c.overallStatus === 'warn').length,
        fail: enriched.filter((c: any) => c.overallStatus === 'fail').length,
      },
      clients: enriched,
    };
  }

  /** Relance les health checks (recalcul léger de l'overview). */
  async runAllHealthChecks() {
    const overview = await this.getMonitoringOverview();
    return { ok: true, ...overview };
  }
}
