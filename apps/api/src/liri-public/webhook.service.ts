/**
 * WebhookService — Envoi HMAC-signé des événements Cimolace vers les endpoints clients.
 *
 * Événements disponibles :
 *   LIRI    : session.started | session.ended | session.cancelled
 *             participant.joined | participant.left
 *             recording.started | recording.completed | waiting_room.knock
 *   Billing : billing.subscription.activated | billing.invoice.paid
 *             billing.subscription.past_due | billing.subscription.canceled
 */

import { Injectable, Logger } from '@nestjs/common';
import { createHmac, randomUUID } from 'crypto';
import { lookup } from 'dns/promises';
import { lookup as dnsLookupCb } from 'dns';
import { isIP } from 'net';
import * as http from 'node:http';
import * as https from 'node:https';
import { SupabaseService } from '../supabase/supabase.service';

export type LiriWebhookEvent =
  | 'session.started'
  | 'session.ended'
  | 'session.cancelled'
  | 'participant.joined'
  | 'participant.left'
  | 'recording.started'
  | 'recording.completed'
  | 'waiting_room.knock'
  | 'billing.subscription.activated'
  | 'billing.invoice.paid'
  | 'billing.subscription.past_due'
  | 'billing.subscription.canceled'
  | 'crm.contact.created'
  | 'crm.deal.created'
  | 'crm.deal.won'
  | 'crm.deal.lost'
  | 'crm.deal.stage_moved'
  | 'crm.task.created';

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

  // ─── Anti-SSRF ──────────────────────────────────────────────────────────────
  /** Vrai si l'IP (v4/v6) est loopback / link-local / privée / CGNAT / non routable. */
  private static isPrivateIp(ip: string): boolean {
    let s = String(ip || '').toLowerCase().trim();
    // IPv4-mapped IPv6 sous TOUTES ses formes → réduire à l'IPv4 sous-jacent AVANT toute logique.
    // ⚠️ new URL() normalise ::ffff:127.0.0.1 en forme HEX (::ffff:7f00:1) : gérer dotted ET hex.
    if (s.startsWith('::ffff:')) {
      const rest = s.slice(7);
      let dotted: string | null = null;
      if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(rest)) {
        dotted = rest;
      } else {
        const hx = rest.match(/^([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
        if (hx) {
          const hi = parseInt(hx[1], 16);
          const lo = parseInt(hx[2], 16);
          dotted = `${(hi >> 8) & 255}.${hi & 255}.${(lo >> 8) & 255}.${lo & 255}`;
        }
      }
      if (!dotted) return true; // forme mappée non parseable → bloquer (fail-closed)
      s = dotted;
    }
    const v4 = s.split('.');
    if (v4.length === 4 && v4.every((o) => /^\d{1,3}$/.test(o))) {
      const [a, b] = v4.map(Number);
      if (a > 255 || b > 255) return true; // malformé → bloquer par prudence
      if ([0, 10, 127].includes(a)) return true;
      if (a === 169 && b === 254) return true; // link-local (incl. 169.254.169.254 métadonnées cloud)
      if (a === 172 && b >= 16 && b <= 31) return true;
      if (a === 192 && b === 168) return true;
      if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
      if (a >= 224) return true; // multicast / réservé
      return false;
    }
    // IPv6 : loopback / unspecified / link-local / ULA
    if (s === '::1' || s === '::' || s === '') return true;
    if (s.startsWith('fe80') || s.startsWith('fc') || s.startsWith('fd')) return true;
    return false;
  }

  /** hostname d'une URL sans les crochets IPv6 (URL.hostname renvoie « [::1] » avec crochets). */
  private static bareHost(hostname: string): string {
    return String(hostname || '').replace(/^\[|\]$/g, '');
  }

  /**
   * POST via http/https.request avec DNS ÉPINGLÉ et SANS suivi de redirection.
   * - `lookup` custom = la SEULE résolution DNS, celle qui sert à la connexion → l'IP validée EST
   *   l'IP contactée : ferme le DNS-rebinding (plus de fenêtre resolve→connect).
   * - http.request ne suit PAS les 3xx → ferme le SSRF par redirection (un 3xx = statut non-2xx).
   * Renvoie le code HTTP (ou null en cas d'échec réseau / cible bloquée).
   */
  private deliverHttp(
    rawUrl: string,
    headers: Record<string, string>,
    body: string,
    timeoutMs: number,
  ): Promise<number | null> {
    return new Promise((resolve) => {
      let u: URL;
      try { u = new URL(rawUrl); } catch { return resolve(null); }
      if (u.protocol !== 'https:' && u.protocol !== 'http:') return resolve(null);
      // IP LITTÉRALE (crochets IPv6 retirés) : Node n'appelle PAS `lookup` → la valider ici.
      const bare = WebhookService.bareHost(u.hostname);
      if (isIP(bare) && WebhookService.isPrivateIp(bare)) return resolve(null);
      const mod = u.protocol === 'https:' ? https : http;
      const pinnedLookup = (hostname: string, opts: any, cb: any) => {
        dnsLookupCb(hostname, { all: true }, (err, addrs: any) => {
          if (err || !addrs?.length) return cb(err ?? new Error('DNS vide'), '', 0);
          if (addrs.some((a: any) => WebhookService.isPrivateIp(a.address))) {
            return cb(new Error('adresse privée/interne bloquée (SSRF/rebinding)'), '', 0);
          }
          if (opts && opts.all) return cb(null, addrs);
          return cb(null, addrs[0].address, addrs[0].family);
        });
      };
      let done = false;
      const finish = (s: number | null) => { if (!done) { done = true; resolve(s); } };
      try {
        const req = mod.request(
          rawUrl,
          { method: 'POST', headers, lookup: pinnedLookup as any, timeout: timeoutMs },
          (res) => { res.resume(); finish(res.statusCode ?? null); },
        );
        req.on('error', () => finish(null));
        req.on('timeout', () => { req.destroy(); finish(null); });
        req.write(body);
        req.end();
      } catch { finish(null); }
    });
  }

  /** Vrai si l'URL est invalide, non résoluble, ou résout vers une adresse privée/interne. */
  private async resolvesToPrivate(rawUrl: string): Promise<boolean> {
    let u: URL;
    try { u = new URL(rawUrl); } catch { return true; }
    const host = WebhookService.bareHost(u.hostname);
    if (isIP(host)) return WebhookService.isPrivateIp(host);
    try {
      const addrs = await lookup(host, { all: true });
      return addrs.length === 0 || addrs.some((a) => WebhookService.isPrivateIp(a.address));
    } catch {
      return true; // DNS échoue → bloquer par prudence
    }
  }

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
      .select('id, url, secret, events, failure_count')
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

    const fires = ((hooks ?? []) as Array<{ id: string; url: string; secret: string; events: string[]; failure_count?: number }>)
      .filter((h) => (h.events ?? []).includes(event) || (h.events ?? []).includes('*'))
      .map((hook) => this.deliverOne(hook, body, payload.liri_delivery_id));

    await Promise.allSettled(fires);
  }

  private async deliverOne(
    hook: { id: string; url: string; secret: string; failure_count?: number },
    body: string,
    deliveryId: string,
  ): Promise<void> {
    // Anti-SSRF en défense-en-profondeur (rejet précoce). Le contrôle PRINCIPAL est le lookup
    // épinglé de deliverHttp (résolution == connexion) : le vrai anti-rebinding est là, pas ici.
    if (await this.resolvesToPrivate(hook.url)) {
      this.logger.warn(`Webhook bloqué (adresse privée/interne/non résoluble) → ${hook.url}`);
      try {
        await (this.supabase.client as any)
          .from('tenant_webhooks')
          .update({ last_fired_at: new Date().toISOString(), last_status: 0, failure_count: (hook.failure_count ?? 0) + 1 })
          .eq('id', hook.id);
      } catch { /* stats best-effort */ }
      return;
    }

    const sig = createHmac('sha256', hook.secret).update(body).digest('hex');
    const status = await this.deliverHttp(hook.url, {
      'Content-Type': 'application/json',
      // En-tête canonique documenté dans le portail tenant + alias LIRI historique.
      'X-Cimolace-Signature': `sha256=${sig}`,
      'X-Cimolace-Delivery': deliveryId,
      'X-Liri-Signature': `sha256=${sig}`,
      'X-Liri-Delivery': deliveryId,
    }, body, 8000);
    this.logger.debug(`Webhook ${deliveryId} → ${hook.url} : ${status}`);

    // Mise à jour des stats non-bloquante. Seul 2xx = succès (un 3xx N'EST PAS suivi → échec).
    const isFailure = status === null || status < 200 || status >= 300;
    try {
      await (this.supabase.client as any)
        .from('tenant_webhooks')
        .update({
          last_fired_at: new Date().toISOString(),
          last_status: status,
          failure_count: isFailure ? (hook.failure_count ?? 0) + 1 : 0,
        })
        .eq('id', hook.id);
    } catch { /* stats best-effort */ }
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
    // Anti-SSRF strict à la création : https obligatoire + refus de toute cible privée/interne.
    let parsed: URL;
    try { parsed = new URL(input.url); } catch { throw new Error('URL de webhook invalide'); }
    if (parsed.protocol !== 'https:') throw new Error('Le webhook doit utiliser https://');
    if (await this.resolvesToPrivate(input.url)) {
      throw new Error('URL de webhook interdite : adresse privée/interne/non résoluble');
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
