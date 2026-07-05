import { createClient } from '@supabase/supabase-js';
import { getTenantNotif } from '../lib/tenantNotif.js';

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
);

const CENTRAL_KEY = process.env.RESEND_API_KEY || '';
const FALLBACK_FROM = process.env.RESEND_FROM || 'noreply@cimolace.com';
const MAX_RETRIES = 4; // réessais sur échec TRANSITOIRE (réseau, 429, 5xx)

// Un statut Resend transitoire mérite un réessai ; un 4xx « métier » (adresse
// invalide, contenu refusé) non — SAUF 429 (rate-limit) qui est transitoire.
function isTransient(httpStatus) {
  return httpStatus === 429 || (httpStatus >= 500 && httpStatus <= 599);
}

export async function pollEmailQueue() {
  const { data: emails } = await supabase.from('email_queue')
    .select('*').eq('status', 'pending').limit(10);
  if (!emails?.length) return 0;

  let sent = 0;
  for (const email of emails) {
    await supabase.from('email_queue').update({ status: 'sending' }).eq('id', email.id);

    // Multi-tenant : clé Resend DU TENANT (BYO) si définie, sinon clé centrale Cimolace.
    let apiKey = CENTRAL_KEY;
    let notif = null;
    if (email.tenant_id) {
      notif = await getTenantNotif(email.tenant_id);
      if (notif.resendKey) apiKey = notif.resendKey;
    }

    // GARDE domaine non vérifié : si l'email vise un expéditeur de domaine CUSTOM
    // (email.from ≠ domaine central) NON vérifié chez Resend ET SANS clé Resend
    // propre au tenant, Resend refuserait (« domain is not verified »). On envoie
    // alors depuis le domaine CENTRAL vérifié, en GARDANT le nom d'école affiché
    // (l'élève voit « Mon École », pas un « noreply@cimolace » brut perçu comme
    // phishing). Aucune substitution silencieuse : c'est loggué.
    const customFrom = email.from && email.from !== FALLBACK_FROM;
    const usingTenantKey = notif && notif.resendKey;
    const domainUnverified = notif && customFrom && notif.verified === false && !usingTenantKey;
    const addr = domainUnverified ? FALLBACK_FROM : (email.from || FALLBACK_FROM);
    if (domainUnverified) {
      console.warn(`[email-worker] domaine non vérifié pour tenant=${email.tenant_id} (from=${email.from}) → envoi via domaine central, nom d'école conservé.`);
    }
    const displayName = email.from_name || (notif && notif.fromName) || '';
    const fromHeader = displayName ? `${displayName} <${addr}>` : addr;

    const retry = Number(email.retry_count || 0);

    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: fromHeader,
          to: [email.to],
          subject: email.subject,
          html: email.html_body,
        }),
      });
      if (res.ok) {
        await supabase.from('email_queue').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', email.id);
        sent++;
      } else {
        // Conserver le message Resend (ex. « domain is not verified ») pour diagnostic.
        let detail = 'HTTP ' + res.status;
        try { const b = await res.json(); if (b?.message) detail += ' — ' + String(b.message).slice(0, 160); } catch { /* noop */ }
        // Réessai borné sur échec transitoire ; échec permanent (4xx hors 429) → failed direct.
        if (isTransient(res.status) && retry < MAX_RETRIES) {
          await supabase.from('email_queue').update({ status: 'pending', retry_count: retry + 1, error: `retry ${retry + 1}/${MAX_RETRIES}: ${detail}` }).eq('id', email.id);
        } else {
          await supabase.from('email_queue').update({ status: 'failed', retry_count: retry, error: detail }).eq('id', email.id);
        }
      }
    } catch (e) {
      // Exception réseau = transitoire → réessai borné.
      if (retry < MAX_RETRIES) {
        await supabase.from('email_queue').update({ status: 'pending', retry_count: retry + 1, error: `retry ${retry + 1}/${MAX_RETRIES}: ${String(e).slice(0, 160)}` }).eq('id', email.id);
      } else {
        await supabase.from('email_queue').update({ status: 'failed', retry_count: retry, error: String(e).slice(0, 200) }).eq('id', email.id);
      }
    }
  }
  console.log('[email-worker] Sent', sent, 'emails');
  return sent;
}
