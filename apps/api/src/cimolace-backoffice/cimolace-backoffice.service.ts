import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateClientDto, UpdateClientDto } from './dto/backoffice.dto';

@Injectable()
export class CimolaceBackofficeService {
  constructor(private readonly supabase: SupabaseService) {}

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

  async updateClient(clientId: string, dto: UpdateClientDto) {
    const patch: any = {};
    if (dto.name) patch.name = dto.name;
    if (dto.email !== undefined) patch.email = dto.email;
    if (dto.status) patch.status = dto.status;
    const { data, error } = await (this.supabase.client as any).from('cimolace_clients').update(patch).eq('id', clientId).select('*').single();
    if (error || !data) throw new NotFoundException('Client introuvable');
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

    const [tenantRes, subsRes, invoicesRes, servicesRes, sitesRes, plansRes, ticketsRes] = await Promise.all([
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

    const activeSubscriptionCount = subscriptions.filter((s: any) =>
      ['active', 'trialing', 'past_due'].includes(s.status),
    ).length;
    const unpaidInvoiceCount = invoices.filter(
      (i: any) => i.status && !['paid', 'void', 'canceled', 'refunded'].includes(i.status),
    ).length;
    const openTicketCount = tickets.filter(
      (t: any) => t.status && !['closed', 'resolved'].includes(t.status),
    ).length;

    const summary = {
      appTenantStatus: appTenant?.status ?? null,
      lastTenantOperation: appTenant?.metadata?.operations ?? null,
      maintenance: Boolean(appTenant?.metadata?.maintenance),
      siteCount: sites.length,
      activeSiteCount: sites.filter((s: any) => s.status === 'active').length,
      engineCount: services.length,
      activeEngineCount: services.filter((s: any) => s.active).length,
      activeSubscriptionCount,
      credentialCount: 0,
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
      schoolModel: null,
      schoolProviders: [],
      credentials: [],
      deployments: [],
      configurationSteps: [],
      changeHistory: [],
      tickets,
      usageLogs: [],
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
    let appTenant: any = null;
    if (tenantId) {
      const { data } = await (this.supabase.client as any)
        .from('tenants').select('id, slug, status, plan').eq('id', tenantId).maybeSingle();
      appTenant = data ?? null;
    }

    const checks = [
      { key: 'client', label: 'Fiche client Cimolace', status: 'pass', detail: client.name },
      {
        key: 'app-tenant',
        label: 'Tenant applicatif lié',
        status: appTenant ? 'pass' : 'block',
        detail: appTenant?.slug ?? 'Aucun tenant applicatif rattaché (cimolace_clients.tenant_id).',
      },
      {
        key: 'tenant-active',
        label: 'Tenant actif',
        status: appTenant ? (appTenant.status === 'active' ? 'pass' : 'warn') : 'block',
        detail: appTenant ? `statut: ${appTenant.status}` : '—',
      },
    ];

    const blockers = checks.filter((c) => c.status === 'block');
    const warnings = checks.filter((c) => c.status === 'warn');
    const passCount = checks.filter((c) => c.status === 'pass').length;
    const percent = checks.length ? Math.round((passCount / checks.length) * 100) : 0;

    return {
      generatedAt: new Date().toISOString(),
      overall: blockers.length ? 'block' : warnings.length ? 'warn' : 'ok',
      score: passCount,
      maxScore: checks.length,
      readiness: {
        percent,
        passCount,
        warningCount: warnings.length,
        blockingCount: blockers.length,
        blockers,
        warnings,
      },
      checks,
      proof: { clientId, tenantId },
      providers: [],
      schoolProviders: [],
    };
  }

  /**
   * Crée une facture manuelle billing_invoices pour le tenant applicatif du
   * client. Accepte `amount` (unités) ou `amount_cents`.
   */
  async createTenantInvoice(clientId: string, dto: any) {
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
    return data;
  }

  /**
   * Active/coupe un moteur (tenant_services) du tenant applicatif du client.
   * Accepte `{ status: 'active' | 'suspended' }` (onglet Moteurs) ou
   * `{ active: boolean }`. Renvoie la ligne mappée (status/config) comme
   * dans le control plane.
   */
  async updateTenantService(clientId: string, serviceId: string, dto: any) {
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
  async runTenantOperation(clientId: string, dto: any) {
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

    return { ok: true, operations: done, reason: dto?.reason ?? null, at: now };
  }

  /**
   * Crée un ticket support (cimolace_tickets) rattaché au client via
   * `contact_email` (le control plane relit les tickets par cet email).
   */
  async createTenantTicket(clientId: string, dto: any) {
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
    return data;
  }
}
