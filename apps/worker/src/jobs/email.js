import { createClient } from '@supabase/supabase-js';
import { getTenantNotif } from '../lib/tenantNotif.js';

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
);

const CENTRAL_KEY = process.env.RESEND_API_KEY || '';
const FALLBACK_FROM = process.env.RESEND_FROM || 'noreply@cimolace.com';

export async function pollEmailQueue() {
  const { data: emails } = await supabase.from('email_queue')
    .select('*').eq('status', 'pending').limit(10);
  if (!emails?.length) return 0;

  let sent = 0;
  for (const email of emails) {
    await supabase.from('email_queue').update({ status: 'sending' }).eq('id', email.id);

    // Multi-tenant : clé Resend DU TENANT (BYO) si définie, sinon clé centrale Cimolace.
    let apiKey = CENTRAL_KEY;
    if (email.tenant_id) {
      const notif = await getTenantNotif(email.tenant_id);
      if (notif.resendKey) apiKey = notif.resendKey;
    }
    // Expéditeur : « Nom <adresse> » si un nom d'expéditeur est fourni.
    const addr = email.from || FALLBACK_FROM;
    const fromHeader = email.from_name ? `${email.from_name} <${addr}>` : addr;

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
        await supabase.from('email_queue').update({ status: 'failed', error: detail }).eq('id', email.id);
      }
    } catch (e) {
      await supabase.from('email_queue').update({ status: 'failed', error: String(e) }).eq('id', email.id);
    }
  }
  console.log('[email-worker] Sent', sent, 'emails');
  return sent;
}
