import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
);

export async function pollEmailQueue() {
  const { data: emails } = await supabase.from('email_queue')
    .select('*').eq('status', 'pending').limit(10);
  if (!emails?.length) return 0;
  
  let sent = 0;
  for (const email of emails) {
    await supabase.from('email_queue').update({ status: 'sending' }).eq('id', email.id);
    try {
      // In production: call Resend API
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + (process.env.RESEND_API_KEY || ''),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: email.from || process.env.RESEND_FROM || 'noreply@cimolace.com',
          to: [email.to],
          subject: email.subject,
          html: email.html_body,
        }),
      });
      if (res.ok) {
        await supabase.from('email_queue').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', email.id);
        sent++;
      } else {
        await supabase.from('email_queue').update({ status: 'failed', error: 'HTTP ' + res.status }).eq('id', email.id);
      }
    } catch (e) {
      await supabase.from('email_queue').update({ status: 'failed', error: String(e) }).eq('id', email.id);
    }
  }
  console.log('[email-worker] Sent', sent, 'emails');
  return sent;
}
