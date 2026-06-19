/**
 * live-reminders.js — Rappels e-mail avant le démarrage d'un live.
 *
 * Pattern : poll les live_sessions programmées qui démarrent bientôt et
 * enfile un rappel dans email_queue (envoyé par jobs/email.js → Resend).
 * Idempotent via live_sessions.reminder_sent_at.
 *
 * Porté d'ISNA v1 (live-start-emails-scheduled), version multi-tenant v2.
 */
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
);

const APP_URL = (process.env.APP_PUBLIC_URL || process.env.PUBLIC_SITE_URL || 'https://app.cimolace.space').replace(/\/$/, '');
const WINDOW_MIN = Number(process.env.LIVE_REMINDER_WINDOW_MIN || 15);

function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function emailFor(userId) {
  if (!userId) return null;
  const { data } = await supabase.from('profiles').select('email, name').eq('id', userId).maybeSingle();
  return data?.email ? { email: data.email, name: data.name || '' } : null;
}

export async function pollLiveReminders() {
  const now = new Date();
  const until = new Date(now.getTime() + WINDOW_MIN * 60_000);

  const { data: sessions } = await supabase
    .from('live_sessions')
    .select('id, title, scheduled_at, teacher_id, appointment_id')
    .eq('status', 'scheduled')
    .is('reminder_sent_at', null)
    .gte('scheduled_at', now.toISOString())
    .lte('scheduled_at', until.toISOString())
    .limit(50);

  if (!sessions || sessions.length === 0) return 0;

  let enqueued = 0;
  for (const s of sessions) {
    const recipients = [];

    const host = await emailFor(s.teacher_id);
    if (host) recipients.push({ ...host, link: `${APP_URL}/live/host/${s.id}`, cta: 'Démarrer la séance' });

    if (s.appointment_id) {
      const { data: appt } = await supabase
        .from('appointments')
        .select('student_id')
        .eq('id', s.appointment_id)
        .maybeSingle();
      const guest = await emailFor(appt?.student_id);
      if (guest) recipients.push({ ...guest, link: `${APP_URL}/live/${s.id}`, cta: 'Rejoindre la séance' });
    }

    // Élèves INVITÉS du live (live de classe) — pas seulement le guest d'un rendez-vous.
    // Le studio upsert les invités dans live_session_participants (role='student').
    const { data: parts } = await supabase
      .from('live_session_participants')
      .select('user_id, role')
      .eq('live_session_id', s.id);
    for (const p of parts || []) {
      if ((p.role || 'student') !== 'student') continue;
      const stu = await emailFor(p.user_id);
      if (stu) recipients.push({ ...stu, link: `${APP_URL}/live/${s.id}`, cta: 'Rejoindre la séance' });
    }

    const title = esc(s.title || 'Votre séance live');
    const when = (() => {
      try { return new Date(s.scheduled_at).toLocaleString('fr-FR'); } catch { return ''; }
    })();

    const seen = new Set();
    for (const r of recipients) {
      if (seen.has(r.email)) continue;
      seen.add(r.email);
      const html =
        `<p>Bonjour ${esc(r.name)},</p>` +
        `<p>Votre séance « <strong>${title}</strong> » commence bientôt${when ? ` (${esc(when)})` : ''}.</p>` +
        `<p><a href="${r.link}">${esc(r.cta)}</a></p>`;
      try {
        await supabase.from('email_queue').insert({
          to: r.email,
          subject: `Rappel — ${title} commence bientôt`,
          html_body: html,
          status: 'pending',
        });
        enqueued += 1;
      } catch (e) {
        console.error('[live-reminders] enqueue', String(e));
      }
    }

    // Marquer comme rappelé (idempotence) même si 0 destinataire, pour ne pas reboucler.
    await supabase.from('live_sessions').update({ reminder_sent_at: new Date().toISOString() }).eq('id', s.id);
  }

  return enqueued;
}
