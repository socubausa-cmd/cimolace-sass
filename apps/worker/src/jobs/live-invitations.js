/**
 * live-invitations.js — E-mail d'INVITATION envoyé dès qu'un live est programmé.
 *
 * Pattern : poll les live_sessions programmées (futures) dont l'invitation n'a pas
 * encore été envoyée, et enfile un e-mail vers chaque ÉLÈVE INVITÉ
 * (live_session_participants role='student') dans email_queue (→ jobs/email.js → Resend).
 * Idempotent via live_sessions.invitations_sent_at.
 *
 * Complète live-reminders.js (qui ne couvrait que l'hôte + le guest d'un rendez-vous) :
 * un live de CLASSE notifie désormais TOUS ses invités dès la programmation, pas
 * seulement 15 min avant. Le studio upsert les invités dans live_session_participants.
 */
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
);

const APP_URL = (process.env.APP_PUBLIC_URL || process.env.PUBLIC_SITE_URL || 'https://app.cimolace.space').replace(/\/$/, '');

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

export async function pollLiveInvitations() {
  const now = new Date();

  const { data: sessions } = await supabase
    .from('live_sessions')
    .select('id, title, scheduled_at')
    .eq('status', 'scheduled')
    .is('invitations_sent_at', null)
    .gte('scheduled_at', now.toISOString())
    .limit(50);

  if (!sessions || sessions.length === 0) return 0;

  let enqueued = 0;
  for (const s of sessions) {
    // Élèves invités : le studio (useTeacherAppointments.createLiveSession) upsert les
    // invités dans live_session_participants (role='student').
    const { data: parts } = await supabase
      .from('live_session_participants')
      .select('user_id, role')
      .eq('live_session_id', s.id);

    const studentIds = (parts || [])
      .filter((p) => (p.role || 'student') === 'student')
      .map((p) => p.user_id);

    const title = esc(s.title || 'Séance live');
    const when = (() => {
      try { return new Date(s.scheduled_at).toLocaleString('fr-FR'); } catch { return ''; }
    })();
    // Lien vers la salle d'attente (compte à rebours) : un live programmé n'est pas
    // encore démarré, l'élève y patiente jusqu'à l'admission le jour J.
    const link = `${APP_URL}/live/waiting/${s.id}`;

    const seen = new Set();
    for (const uid of studentIds) {
      const r = await emailFor(uid);
      if (!r || seen.has(r.email)) continue;
      seen.add(r.email);
      const html =
        `<p>Bonjour ${esc(r.name)},</p>` +
        `<p>Vous êtes invité(e) à la séance live « <strong>${title}</strong> »` +
        `${when ? ` prévue le <strong>${esc(when)}</strong>` : ''}.</p>` +
        `<p>Le jour J, rejoignez la salle d'attente depuis ce lien :</p>` +
        `<p><a href="${link}">Rejoindre la séance</a></p>`;
      try {
        await supabase.from('email_queue').insert({
          to: r.email,
          subject: `Invitation — ${title}`,
          html_body: html,
          status: 'pending',
        });
        enqueued += 1;
      } catch (e) {
        console.error('[live-invitations] enqueue', String(e));
      }
    }

    // Idempotence : marqué même si 0 invité, pour ne pas reboucler.
    await supabase.from('live_sessions').update({ invitations_sent_at: new Date().toISOString() }).eq('id', s.id);
  }

  return enqueued;
}
