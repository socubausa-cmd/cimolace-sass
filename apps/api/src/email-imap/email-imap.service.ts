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
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { SupabaseService } from '../supabase/supabase.service';

const DEFAULT_MAILBOX_ID = 'a0000000-0000-4000-8000-000000000001';

@Injectable()
export class EmailImapService {
  private readonly logger = new Logger(EmailImapService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly config: ConfigService,
  ) {}

  // ─── 1. Sync manuel (admin) ───────────────────────────────────────────────

  private normalizeSubject(s?: string | null): string {
    return String(s || '(sans objet)')
      .replace(/^\s*((re|fwd?|tr|fw)\s*:\s*)+/i, '')
      .trim()
      .toLowerCase()
      .slice(0, 300);
  }

  /** Sync IMAP réel : boîte org (imap.hostinger.com) → tables emails/email_threads.
   *  Incrémental par `mailboxes.imap_last_uid`. Host/port/user viennent de la ligne
   *  mailbox ; seul `IMAP_PASSWORD` (secret Railway) est requis. */
  async syncManual(_tenantId: string, options?: { maxMessages?: number; sinceDays?: number }) {
    const client = this.supabase.client as any;
    const { data: mb } = await client
      .from('mailboxes')
      .select('*')
      .eq('id', DEFAULT_MAILBOX_ID)
      .maybeSingle();

    const host = mb?.imap_host || this.config.get<string>('IMAP_HOST') || 'imap.hostinger.com';
    const port = Number(mb?.imap_port || this.config.get<string>('IMAP_PORT') || 993);
    const user = this.config.get<string>('IMAP_USER') || mb?.address;
    const password = this.config.get<string>('IMAP_PASSWORD');
    if (!user || !password) {
      return {
        ok: false,
        status: 'imap_not_configured',
        hint: 'Définir IMAP_PASSWORD (mot de passe Hostinger de la boîte) sur Railway. Host/port/user viennent de la table mailboxes.',
      };
    }

    const maxMessages = Math.min(Math.max(Number(options?.maxMessages) || 50, 1), 200);
    const sinceDays = Math.min(Math.max(Number(options?.sinceDays) || 60, 1), 365);
    const lastUid = Number(mb?.imap_last_uid || 0);

    const imap = new ImapFlow({ host, port, secure: true, auth: { user, pass: password }, logger: false });
    let synced = 0;
    let maxUid = lastUid;
    let status = 'ok';
    let errMsg = '';
    try {
      await imap.connect();
      const lock = await imap.getMailboxLock('INBOX');
      try {
        // UIDs à traiter : incrémental (> last_uid), sinon fenêtre `sinceDays`.
        const found = lastUid > 0
          ? await imap.search({ uid: `${lastUid + 1}:*` }, { uid: true })
          : await imap.search({ since: new Date(Date.now() - sinceDays * 86400000) }, { uid: true });
        const uids = (Array.isArray(found) ? found : [])
          .filter((u) => u > lastUid)
          .sort((a, b) => a - b)
          .slice(-maxMessages); // les plus récents

        for (const uid of uids) {
          const msg = await imap.fetchOne(String(uid), { source: true }, { uid: true });
          if (!msg || !(msg as any).source) { maxUid = Math.max(maxUid, uid); continue; }
          const parsed = await simpleParser((msg as any).source);
          const messageId = parsed.messageId || `<uid-${uid}@${host}>`;

          const { data: exists } = await client
            .from('emails')
            .select('id')
            .eq('mailbox_id', DEFAULT_MAILBOX_ID)
            .eq('message_id', messageId)
            .maybeSingle();
          if (exists?.id) { maxUid = Math.max(maxUid, uid); continue; }

          const fromAddr: any = (parsed.from as any)?.value?.[0];
          const subject = parsed.subject || '(sans objet)';
          const normalized = this.normalizeSubject(subject);
          const toEmails = (((parsed.to as any)?.value) || []).map((v: any) => v.address).filter(Boolean);
          const ccEmails = (((parsed.cc as any)?.value) || []).map((v: any) => v.address).filter(Boolean);
          const receivedAt = (parsed.date instanceof Date && !Number.isNaN(parsed.date.getTime()) ? parsed.date : new Date()).toISOString();
          const bodyText = parsed.text || '';
          const bodyHtml = typeof parsed.html === 'string' ? parsed.html : null;
          const snippet = String(bodyText || '').replace(/\s+/g, ' ').trim().slice(0, 200);

          // Fil par sujet normalisé (crée si absent).
          let threadId: string | null = null;
          const { data: th } = await client
            .from('email_threads')
            .select('id')
            .eq('mailbox_id', DEFAULT_MAILBOX_ID)
            .eq('normalized_subject', normalized)
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          if (th?.id) threadId = th.id;
          else {
            const { data: nt } = await client
              .from('email_threads')
              .insert({
                mailbox_id: DEFAULT_MAILBOX_ID,
                subject,
                normalized_subject: normalized,
                primary_contact_email: fromAddr?.address || null,
                pipeline_status: 'new',
              })
              .select('id')
              .single();
            threadId = nt?.id || null;
          }
          if (!threadId) { maxUid = Math.max(maxUid, uid); continue; }

          await client.from('emails').insert({
            mailbox_id: DEFAULT_MAILBOX_ID,
            thread_id: threadId,
            message_id: messageId,
            in_reply_to: parsed.inReplyTo || null,
            references_chain: Array.isArray(parsed.references) ? parsed.references.join(' ') : (parsed.references || null),
            from_name: fromAddr?.name || null,
            from_email: fromAddr?.address || null,
            to_emails: toEmails,
            cc_emails: ccEmails,
            subject,
            body_text: bodyText,
            body_html: bodyHtml,
            snippet,
            received_at: receivedAt,
            is_read: false,
            is_outbound: false,
            imap_uid: uid,
          });
          await client
            .from('email_threads')
            .update({ updated_at: receivedAt, primary_contact_email: fromAddr?.address || null })
            .eq('id', threadId);

          synced++;
          maxUid = Math.max(maxUid, uid);
        }
      } finally {
        lock.release();
      }
      await imap.logout();
    } catch (e) {
      status = 'error';
      errMsg = (e as Error).message || 'IMAP error';
      this.logger.error(`IMAP sync: ${errMsg}`);
      try { await imap.close(); } catch { /* ignore */ }
    }

    await client
      .from('mailboxes')
      .update({
        imap_last_uid: maxUid,
        last_synced_at: new Date().toISOString(),
        sync_status: status,
        last_error: errMsg || null,
      })
      .eq('id', DEFAULT_MAILBOX_ID);
    await client.from('email_sync_logs').insert({
      mailbox_id: DEFAULT_MAILBOX_ID,
      status,
      message: errMsg || `Synced ${synced}`,
      synced_count: synced,
    });

    if (status === 'error') return { ok: false, status: 'error', error: errMsg, synced };
    return { ok: true, status: 'ok', synced };
  }

  // ─── 2. Cron tick ─────────────────────────────────────────────────────────

  async cronTick(secretProvided?: string) {
    const secret = (this.config.get<string>('MAIL_IMAP_SYNC_SECRET') ?? '').trim();
    if (secret && secretProvided !== secret) {
      throw new BadRequestException('Invalid cron secret');
    }
    // Sync de la boîte org par défaut (mono-tenant isna pour l'instant).
    const r = await this.syncManual('', { maxMessages: 40, sinceDays: 14 });
    return { ...r, next_run: new Date(Date.now() + 30 * 60 * 1000).toISOString() };
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
