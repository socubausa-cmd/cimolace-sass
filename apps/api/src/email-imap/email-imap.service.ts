/**
 * EmailImapService — sync IMAP + envoi depuis boîte org.
 *
 * NOTE: la lib IMAP complète (imapflow/mailparser) est volumineuse.
 * Cette implémentation v2 fournit la structure des endpoints mais le sync
 * effectif renvoie `{ status: 'not_implemented_yet' }`. TODO: porter
 * netlify/functions/_lib/mail/imapSyncEngine.js → module dédié.
 *
 * L'envoi (send) fonctionne via Resend si RESEND_API_KEY est défini.
 */

import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class EmailImapService {
  private readonly logger = new Logger(EmailImapService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly config: ConfigService,
  ) {}

  // ─── 1. Sync manuel (admin) ───────────────────────────────────────────────

  async syncManual(tenantId: string, _options?: { maxMessages?: number; sinceDays?: number }) {
    const user = this.config.get<string>('IMAP_USER');
    const password = this.config.get<string>('IMAP_PASSWORD');
    if (!user || !password) {
      return {
        ok: false,
        status: 'imap_not_configured',
        hint: 'Définir IMAP_USER et IMAP_PASSWORD dans les variables denvironnement.',
      };
    }
    // TODO: implémenter le sync IMAP réel (imapflow + mailparser)
    this.logger.warn('IMAP sync not implemented — placeholder');
    return {
      ok: true,
      status: 'not_implemented_yet',
      tenant_id: tenantId,
      message: 'Endpoint structuré mais sync IMAP à porter depuis v1.',
    };
  }

  // ─── 2. Cron tick ─────────────────────────────────────────────────────────

  async cronTick(secretProvided?: string) {
    const secret = (this.config.get<string>('MAIL_IMAP_SYNC_SECRET') ?? '').trim();
    if (secret && secretProvided !== secret) {
      throw new BadRequestException('Invalid cron secret');
    }
    // TODO: parcourir les tenants ayant IMAP activé et lancer le sync
    this.logger.log('Cron tick reçu (placeholder)');
    return {
      ok: true,
      status: 'not_implemented_yet',
      next_run: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    };
  }

  // ─── 3. Envoi depuis boîte org (Resend) ───────────────────────────────────

  async send(
    tenantId: string,
    userId: string | null,
    input: { to?: string; subject?: string; html?: string; text?: string; thread_id?: string },
  ) {
    const to = (input.to ?? '').trim();
    const subject = (input.subject ?? '').trim();
    if (!to || !subject) {
      throw new BadRequestException('to et subject requis');
    }
    if (!input.html && !input.text) {
      throw new BadRequestException('Fournir html ou text');
    }

    const apiKey = this.config.get<string>('RESEND_API_KEY');
    const fromEmail =
      this.config.get<string>('ORG_MAILBOX_FROM') ?? 'no-reply@cimolace.com';
    if (!apiKey) {
      return { ok: false, error: 'RESEND_API_KEY non configuré' };
    }

    let resendMessageId: string | null = null;
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [to],
          subject,
          html: input.html ?? undefined,
          text: input.text ?? undefined,
        }),
        signal: AbortSignal.timeout(15000),
      });
      const json: any = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { ok: false, error: json?.message ?? `Resend ${res.status}` };
      }
      resendMessageId = json?.id ?? null;
    } catch (e) {
      this.logger.error(`Resend send: ${(e as Error).message}`);
      return { ok: false, error: 'Send failed' };
    }

    // Log dans outgoing_emails si thread fourni (table peut ne pas exister)
    if (input.thread_id) {
      try {
        await (this.supabase.client as any).from('outgoing_emails').insert({
          thread_id: input.thread_id,
          sent_by_user_id: userId,
          to_email: to,
          subject,
          body_html: input.html ?? null,
          body_text: input.text ?? null,
          resend_message_id: resendMessageId,
          status: 'sent',
          sent_at: new Date().toISOString(),
          cimolace_tenant_id: tenantId,
        });
      } catch (e) {
        this.logger.warn(`outgoing_emails insert (table may be missing): ${(e as Error).message}`);
      }
    }

    return { ok: true, resend_message_id: resendMessageId };
  }
}
