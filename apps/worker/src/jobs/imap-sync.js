import { createClient } from '@supabase/supabase-js';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';

/**
 * pollImapSync — RÉCEPTION inbound : tire les nouveaux emails des boîtes
 * configurées (`mailboxes`, IMAP) vers la boîte CRM du back-office
 * (`email_threads` + `emails`). Le pendant de email.js (qui ENVOIE).
 *
 * Config par boîte = ligne `mailboxes` (address, imap_host, imap_port,
 * imap_last_uid = curseur). Le MOT DE PASSE n'est PAS en base : il vient de l'env
 * `MAIL_IMAP_PASSWORD` (boîte unique centralisée) ou
 * `MAIL_IMAP_PASSWORD_<ADRESSE_SANITISÉE>` (multi-boîtes). Idempotent : index
 * unique (mailbox_id, message_id) → un email déjà importé est ignoré.
 */

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
);

function passwordFor(address) {
  const keyed = `MAIL_IMAP_PASSWORD_${String(address).toUpperCase().replace(/[^A-Z0-9]/g, '_')}`;
  return process.env[keyed] || process.env.MAIL_IMAP_PASSWORD || '';
}

const normalizeSubject = (s) =>
  String(s || '')
    .replace(/^(\s*(re|fwd?|tr|rép|rep)\s*:\s*)+/i, '')
    .trim()
    .toLowerCase()
    .slice(0, 200);

const toAddrList = (field) =>
  ((field && field.value) || []).map((a) => a.address).filter(Boolean);

/** Retrouve le thread d'un email (par références, sinon par sujet normalisé), sinon le crée. */
async function findOrCreateThread(mailboxId, parsed) {
  const normSubj = normalizeSubject(parsed.subject);

  // 1) Par chaîne de références / in-reply-to → thread d'un parent déjà importé
  const refIds = []
    .concat(parsed.references || [])
    .concat(parsed.inReplyTo || [])
    .filter(Boolean)
    .map(String);
  if (refIds.length) {
    const { data: parent } = await supabase
      .from('emails')
      .select('thread_id')
      .eq('mailbox_id', mailboxId)
      .in('message_id', refIds)
      .not('thread_id', 'is', null)
      .limit(1)
      .maybeSingle();
    if (parent?.thread_id) return parent.thread_id;
  }

  // 2) Par sujet normalisé
  if (normSubj) {
    const { data: existing } = await supabase
      .from('email_threads')
      .select('id')
      .eq('mailbox_id', mailboxId)
      .eq('normalized_subject', normSubj)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existing?.id) return existing.id;
  }

  // 3) Nouveau thread (entre dans le pipeline CRM en « Nouveau »)
  const fromEmail = parsed.from?.value?.[0]?.address || null;
  const { data: created } = await supabase
    .from('email_threads')
    .insert({
      mailbox_id: mailboxId,
      subject: parsed.subject || '(sans objet)',
      normalized_subject: normSubj,
      primary_contact_email: fromEmail,
      pipeline_status: 'new',
    })
    .select('id')
    .single();
  return created?.id || null;
}

/** Sync d'UNE boîte : connecte IMAP, importe les UID > curseur, avance le curseur. */
async function syncMailbox(mb) {
  const pass = passwordFor(mb.address);
  if (!pass) {
    // ⚠️ sync_status est borné par CHECK à ('idle','syncing','error','ok') → on
    // utilise 'error' (pas 'no_credentials' qui serait rejeté en silence) + détail.
    await supabase
      .from('mailboxes')
      .update({ sync_status: 'error', last_error: `Mot de passe IMAP absent (env MAIL_IMAP_PASSWORD pour ${mb.address})`, updated_at: new Date().toISOString() })
      .eq('id', mb.id);
    return 0;
  }

  const client = new ImapFlow({
    host: mb.imap_host || 'imap.hostinger.com',
    port: mb.imap_port || 993,
    secure: true,
    auth: { user: mb.address, pass },
    logger: false,
  });

  const lastUid = mb.imap_last_uid || 0;
  let maxUid = lastUid;
  let inserted = 0;

  try {
    await client.connect();
    const lock = await client.getMailboxLock('INBOX');
    try {
      // UID range : du dernier connu+1 jusqu'au plus récent (`*`).
      for await (const msg of client.fetch(`${lastUid + 1}:*`, { uid: true, source: true }, { uid: true })) {
        if (!msg.uid || msg.uid <= lastUid) continue; // `X:*` peut renvoyer le dernier connu
        if (msg.uid > maxUid) maxUid = msg.uid;
        let parsed;
        try { parsed = await simpleParser(msg.source); } catch { continue; }

        const messageId = parsed.messageId || `imap-${mb.id}-${msg.uid}`;
        const threadId = await findOrCreateThread(mb.id, parsed);
        if (!threadId) continue;

        const fromAddr = parsed.from?.value?.[0] || {};
        const text = parsed.text || '';
        const { error: insErr } = await supabase.from('emails').insert({
          mailbox_id: mb.id,
          thread_id: threadId,
          message_id: messageId,
          in_reply_to: parsed.inReplyTo || null,
          references_chain: parsed.references ? [].concat(parsed.references).map(String) : null,
          from_name: fromAddr.name || null,
          from_email: fromAddr.address || null,
          to_emails: toAddrList(parsed.to),
          cc_emails: toAddrList(parsed.cc),
          subject: parsed.subject || null,
          body_text: text || null,
          body_html: parsed.html || null,
          snippet: text.replace(/\s+/g, ' ').trim().slice(0, 200) || null,
          received_at: (parsed.date || new Date()).toISOString(),
          is_read: false,
          is_outbound: false,
          imap_uid: msg.uid,
        });
        // insErr 23505 = déjà importé (index unique message_id) → on ignore sans compter.
        if (!insErr) {
          inserted++;
          await supabase.from('email_threads').update({ updated_at: new Date().toISOString() }).eq('id', threadId);
        }
      }
    } finally {
      lock.release();
    }
    await supabase
      .from('mailboxes')
      .update({ imap_last_uid: maxUid, last_synced_at: new Date().toISOString(), sync_status: 'ok', last_error: null, updated_at: new Date().toISOString() })
      .eq('id', mb.id);
  } catch (e) {
    await supabase
      .from('mailboxes')
      .update({ sync_status: 'error', last_error: String(e?.message || e).slice(0, 500), updated_at: new Date().toISOString() })
      .eq('id', mb.id);
  } finally {
    try { await client.logout(); } catch { /* noop */ }
  }
  return inserted;
}

export async function pollImapSync() {
  // Centralisé : toutes les boîtes ayant un hôte IMAP configuré. On lit tout et on
  // filtre en JS (robuste) + on logge l'erreur éventuelle (sinon diagnostic muet).
  const { data: boxes, error } = await supabase.from('mailboxes').select('*');
  if (error) {
    console.error('[imap] lecture mailboxes échouée:', error.message || error);
    return 0;
  }
  const active = (boxes || []).filter((b) => b.imap_host);
  console.log(`[imap] poll: ${active.length} boîte(s) à synchroniser`);
  if (!active.length) return 0;
  let total = 0;
  for (const mb of active) total += await syncMailbox(mb);
  return total;
}

export default pollImapSync;
