import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CimolaceBackofficeService } from './cimolace-backoffice.service';
import { SupabaseService } from '../supabase/supabase.service';

const INTERVAL_MS        = 5 * 60 * 1000;  // 5 minutes
const BILLING_CHECK_MS   = 24 * 60 * 60 * 1000; // 24 heures
const MONITORED_PROVIDERS = ['supabase', 'livekit', 'ai', 'payment', 'email_sms_optional'];
const HEALTH_CHECK_CONCURRENCY = 8;
const OVERDUE_GRACE_DAYS = 7; // Suspension après 7 jours de facture impayée

@Injectable()
export class HealthCheckSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(HealthCheckSchedulerService.name);
  private timer: ReturnType<typeof setInterval> | null = null;
  private billingTimer: ReturnType<typeof setInterval> | null = null;
  private firstRunTimer: ReturnType<typeof setTimeout> | null = null;
  private firstBillingTimer: ReturnType<typeof setTimeout> | null = null;
  private running = false;

  constructor(
    private readonly svc: CimolaceBackofficeService,
    private readonly supabase: SupabaseService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    if (!this.schedulerEnabled()) {
      this.logger.log('Health-check scheduler désactivé');
      return;
    }

    // Premier health-check après 30s
    this.firstRunTimer = setTimeout(() => this.runCycle(), 30_000);
    this.timer = setInterval(() => this.runCycle(), INTERVAL_MS);

    // Billing check au démarrage puis toutes les 24h
    this.firstBillingTimer = setTimeout(() => this.runBillingCheck(), 60_000);
    this.billingTimer = setInterval(() => this.runBillingCheck(), BILLING_CHECK_MS);

    this.logger.log(`Health-check scheduler démarré (intervalle ${INTERVAL_MS / 60_000} min)`);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    if (this.billingTimer) clearInterval(this.billingTimer);
    if (this.firstRunTimer) clearTimeout(this.firstRunTimer);
    if (this.firstBillingTimer) clearTimeout(this.firstBillingTimer);
  }

  private schedulerEnabled() {
    const explicit = this.config.get<string>('CIMOLACE_HEALTH_SCHEDULER_ENABLED');
    const nodeEnv = this.config.get<string>('NODE_ENV');
    if (explicit !== undefined) return explicit !== 'false';
    return nodeEnv !== 'test';
  }

  private async runCycle() {
    if (this.running) return;
    this.running = true;
    try {
      const clients = await this.getActiveSchoolClients();
      if (!clients.length) return;

      let checked = 0;
      const tasks = clients.flatMap((client) =>
        MONITORED_PROVIDERS.map((provider) => ({ client, provider })),
      );

      for (let i = 0; i < tasks.length; i += HEALTH_CHECK_CONCURRENCY) {
        const batch = tasks.slice(i, i + HEALTH_CHECK_CONCURRENCY);
        const results = await Promise.all(
          batch.map(async ({ client, provider }) => {
            try {
              await (this.svc as any).runProviderHealthCheck(client.id, provider);
              return true;
            } catch (err: any) {
              this.logger.warn(`Health-check ${provider} / client ${client.id} : ${err?.message}`);
              return false;
            }
          }),
        );
        checked += results.filter(Boolean).length;
      }
      if (checked > 0) {
        this.logger.log(`Cycle health-checks : ${checked} checks sur ${clients.length} clients école`);
      }
    } catch (err: any) {
      this.logger.error(`Erreur cycle health-check : ${err?.message}`);
    } finally {
      this.running = false;
    }
  }

  /** Suspend automatiquement les écoles avec factures impayées > OVERDUE_GRACE_DAYS */
  private async runBillingCheck() {
    try {
      const overdueDate = new Date();
      overdueDate.setDate(overdueDate.getDate() - OVERDUE_GRACE_DAYS);

      // Factures Cimolace en statut pending/overdue depuis plus de GRACE_DAYS jours
      const { data: overdueInvoices } = await (this.supabase.client as any)
        .from('cimolace_invoices')
        .select('client_id, due_date, status')
        .in('status', ['pending', 'overdue', 'failed'])
        .lt('due_date', overdueDate.toISOString())
        .limit(50);

      if (!overdueInvoices?.length) return;

      const clientIds = [...new Set((overdueInvoices as any[]).map((i: any) => i.client_id))];
      let suspended = 0;

      for (const clientId of clientIds) {
        try {
          // Vérifier que le client n'est pas déjà suspendu
          const { data: client } = await (this.supabase.client as any)
            .from('cimolace_clients')
            .select('status')
            .eq('id', clientId)
            .single();

          if (client?.status === 'suspended') continue;

          await (this.svc as any).runTenantOperation(clientId, {
            status: 'suspended',
            reason: `Suspension automatique — facture impayée depuis plus de ${OVERDUE_GRACE_DAYS} jours`,
          });
          suspended++;
          this.logger.warn(`Client ${clientId} suspendu pour facture impayée`);
        } catch (err: any) {
          this.logger.error(`Erreur suspension client ${clientId}: ${err?.message}`);
        }
      }

      if (suspended > 0) {
        this.logger.log(`Billing check : ${suspended} école(s) suspendue(s) sur ${clientIds.length} en retard`);
      }
    } catch (err: any) {
      this.logger.error(`Erreur billing check : ${err?.message}`);
    }
  }

  private async getActiveSchoolClients(): Promise<Array<{ id: string }>> {
    const { data, error } = await (this.supabase.client as any)
      .from('cimolace_clients')
      .select('id')
      .eq('status', 'active')
      .eq('client_type', 'school')
      .limit(50);
    if (error) return [];
    return (data ?? []) as Array<{ id: string }>;
  }
}
