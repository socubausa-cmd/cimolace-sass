/**
 * WebhookService — Envoi HMAC-signé des événements LIRI vers les endpoints clients.
 *
 * Événements disponibles :
 *   session.started | session.ended | session.cancelled
 *   participant.joined | participant.left
 *   recording.started | recording.completed
 *   waiting_room.knock
 */

import { Injectable, Logger } from '@nestjs/common';
import { createHmac, randomUUID } from 'crypto';
import { SupabaseService } from '../supabase/supabase.service';

export type LiriWebhookEvent =
  | 'session.started'
  | 'session.ended'
  | 'session.cancelled'
  | 'participant.joined'
  | 'participant.left'
  | 'recording.started'
  | 'recording.completed'
  | 'waiting_room.knock';

export interface WebhookPayload {
  event: LiriWebhookEvent;
  tenant_id: string;
  session_id?: string;
  data: Record<string, unknown>;
  liri_delivery_id: string;
  timestamp: string;
}

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Émet un événement à tous les webhooks actifs du tenant qui souscrivent à cet event.
   * Fire-and-forget : les erreurs HTTP sont loggées mais ne bloquent pas la réponse.
   */
  async emit(
    tenantId: string,
    event: LiriWebhookEvent,
    data: Record<string, unknown>,
  ): Promise<void> {
    const { data: hooks } = await (this.supabase.client as any)
      .from('tenant_webhooks')
      .select('id, url, secret, events')
      .eq('tenant_id', tenantId)
      .eq('is_active', true);

    if (!hooks?.length) return;

    const payload: WebhookPayload = {
      event,
      tenant_id: tenantId,
      session_id: (data.session_id as string) ?? undefined,
      data,
      liri_delivery_id: randomUUID(),
      timestamp: new Date().toISOString(),
    };

    const body = JSON.stringify(payload);

    const fires = ((hooks ?? []) as Array<{ id: string; url: string; secret: string; events: string[] }>)
      .filter((h) => h.events.includes(event) || h.events.includes('*'))
      .map((hook) => this.deliverOne(hook, body, payload.liri_delivery_id));

    await Promise.allSettled(fires);
  }

  private async deliverOne(
    hook: { id: string; url: string; secret: string },
    body: string,
    deliveryId: string,
  ): Promise<void> {
    const sig = createHmac('sha256', hook.secret).update(body).digest('hex');

    let status: number | null = null;
    try {
      const res = await fetch(hook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Liri-Signature': `sha256=${sig}`,
          'X-Liri-Delivery': deliveryId,
        },
        body,
        signal: AbortSignal.timeout(8000),
      });
      status = res.status;
      this.logger.debug(`Webhook ${deliveryId} → ${hook.url} : ${status}`);
    } catch (err) {
      this.logger.warn(
        `Webhook delivery failed → ${hook.url}: ${(err as Error).message}`,
      );
    }

    // Mise à jour des stats non-bloquante
    const isFailure = status === null || status >= 400;
    await (this.supabase.client as any)
      .from('tenant_webhooks')
      .update({
        last_fired_at: new Date().toISOString(),
        last_status: status,
        failure_count: isFailure
          ? (this.supabase.client as any).rpc !== undefined
            ? undefined  // fallback
            : 0
          : 0,
      })
      .eq('id', hook.id)
      .catch(() => {});
  }

  // ─── CRUD webhooks ────────────────────────────────────────────────────────

  // ── CRUD webhooks — gracieux si table inexistante ─────────────────────────

  private async tableExists(): Promise<boolean> {
    const { error } = await (this.supabase.client as any)
      .from('tenant_webhooks')
      .select('id')
      .limit(1);
    return !error || !error.message?.includes("Could not find the table");
  }

  async listWebhooks(tenantId: string) {
    if (!await this.tableExists()) {
      return { data: [], _pending_migration: 'tenant_webhooks table not yet created. Run migration: supabase/migrations/20260528190001_liri_webhooks.sql' };
    }
    const { data } = await (this.supabase.client as any)
      .from('tenant_webhooks')
      .select('id, label, url, events, is_active, last_fired_at, last_status, failure_count, created_at')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });
    return data ?? [];
  }

  async createWebhook(
    tenantId: string,
    input: { label: string; url: string; events: string[]; secret?: string },
  ) {
    if (!await this.tableExists()) {
      throw new Error(
        'Webhooks non disponibles — créez d\'abord la table via Supabase Dashboard SQL Editor. ' +
        'Migration: supabase/migrations/20260528190001_liri_webhooks.sql',
      );
    }
    const secret = input.secret || createHmac('sha256', tenantId).update(Date.now().toString()).digest('hex');
    const { data, error } = await (this.supabase.client as any)
      .from('tenant_webhooks')
      .insert({
        tenant_id: tenantId,
        label: input.label,
        url: input.url,
        events: input.events,
        secret,
      })
      .select('id, label, url, events, is_active, created_at')
      .single();
    if (error) throw new Error(error.message);
    return { ...data, signing_secret: secret };
  }

  async deleteWebhook(tenantId: string, webhookId: string) {
    if (!await this.tableExists()) return;
    await (this.supabase.client as any)
      .from('tenant_webhooks')
      .delete()
      .eq('id', webhookId)
      .eq('tenant_id', tenantId);
  }

  async toggleWebhook(tenantId: string, webhookId: string, isActive: boolean) {
    if (!await this.tableExists()) return null;
    const { data } = await (this.supabase.client as any)
      .from('tenant_webhooks')
      .update({ is_active: isActive })
      .eq('id', webhookId)
      .eq('tenant_id', tenantId)
      .select('id, is_active')
      .single();
    return data;
  }
}
