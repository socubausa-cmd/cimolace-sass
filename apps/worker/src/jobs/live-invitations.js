/**
 * live-invitations.js — Invitation (email + WhatsApp) envoyée dès qu'un live est programmé.
 *
 * Poll les live_sessions programmées (futures) dont l'invitation n'a pas encore été
 * envoyée, et notifie selon les MOYENS DE DIFFUSION choisis par le créateur
 * (live_visibility_rules) + la CHAÎNE WhatsApp de l'école (tenant_notification_settings,
 * éditable no-code dans le back-office) :
 *   - EMAIL élève   : si notify_email → email_queue (→ jobs/email.js → Resend).
 *   - WhatsApp élève : si notify_whatsapp → Twilio (opt-in profiles.notify_sms + téléphone).
 *   - Chaîne école   : si whatsapp_channel_enabled → 1 WhatsApp vers whatsapp_school_number.
 * Idempotent via live_sessions.invitations_sent_at.
 */
import { createClient } from '@supabase/supabase-js';
import { sendWhatsApp, whatsappConfigured } from '../lib/whatsapp.js';

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

async function profileFor(userId) {
  if (!userId) return null;
  const { data } = await supabase
    .from('profiles')
    .select('email, name, phone, notify_sms')
    .eq('id', userId)
    .maybeSingle();
  return data || null;
}

export async function pollLiveInvitations() {
  const now = new Date();

  const { data: sessions } = await supabase
    .from('live_sessions')
    .select('id, title, scheduled_at, tenant_id')
    .eq('status', 'scheduled')
    .is('invitations_sent_at', null)
    .gte('scheduled_at', now.toISOString())
    .limit(50);

  if (!sessions || sessions.length === 0) return 0;

  let sent = 0;
  for (const s of sessions) {
    const titleHtml = esc(s.title || 'Séance live');
    const titleText = s.title || 'Séance live';
    const when = (() => {
      try { return new Date(s.scheduled_at).toLocaleString('fr-FR'); } catch { return ''; }
    })();
    // Lien vers la salle d'attente (compte à rebours) : un live programmé n'est pas
    // encore démarré, l'élève y patiente jusqu'à l'admission le jour J.
    const link = `${APP_URL}/live/waiting/${s.id}`;

    // Moyens de diffusion CHOISIS PAR LE CRÉATEUR (live_visibility_rules, posés par
    // le studio). Sans règle (lives legacy) : défaut email ON (ne pas régresser), WhatsApp OFF.
    const { data: rules } = await supabase
      .from('live_visibility_rules')
      .select('notify_email, notify_whatsapp')
      .eq('live_session_id', s.id)
      .maybeSingle();
    const wantEmail = rules ? rules.notify_email === true : true;
    const wantWhatsApp = rules ? rules.notify_whatsapp === true : false;

    // Chaîne WhatsApp de l'école — numéro configuré NO-CODE dans le back-office
    // (tenant_notification_settings). Notifié une seule fois par live.
    const { data: ns } = await supabase
      .from('tenant_notification_settings')
      .select('whatsapp_school_number, whatsapp_channel_enabled')
      .eq('tenant_id', s.tenant_id)
      .maybeSingle();
    const channelNumber = ns?.whatsapp_channel_enabled ? (ns.whatsapp_school_number || '') : '';
    const wantChannel = Boolean(channelNumber && whatsappConfigured());

    // ── Chaîne école (1 WhatsApp vers le numéro de l'école) ────────────────
    if (wantChannel) {
      try {
        const res = await sendWhatsApp({ to: channelNumber, title: titleText, when, link });
        if (res.status === 'sent') sent += 1;
        else if (res.status !== 'disabled') console.warn('[live-invitations] channel whatsapp', res.status, res.error || '');
      } catch (e) {
        console.error('[live-invitations] channel whatsapp', String(e));
      }
    }

    // ── Notifications individuelles aux élèves invités ─────────────────────
    if (wantEmail || wantWhatsApp) {
      const { data: parts } = await supabase
        .from('live_session_participants')
        .select('user_id, role')
        .eq('live_session_id', s.id);

      const studentIds = (parts || [])
        .filter((p) => (p.role || 'student') === 'student')
        .map((p) => p.user_id);

      const seenEmail = new Set();
      const seenPhone = new Set();
      for (const uid of studentIds) {
        const p = await profileFor(uid);
        if (!p) continue;

        // EMAIL → email_queue (Resend) — si le créateur a choisi l'email
        if (wantEmail && p.email && !seenEmail.has(p.email)) {
          seenEmail.add(p.email);
          const html =
            `<p>Bonjour ${esc(p.name || '')},</p>` +
            `<p>Vous êtes invité(e) à la séance live « <strong>${titleHtml}</strong> »` +
            `${when ? ` prévue le <strong>${esc(when)}</strong>` : ''}.</p>` +
            `<p>Le jour J, rejoignez la salle d'attente depuis ce lien :</p>` +
            `<p><a href="${link}">Rejoindre la séance</a></p>`;
          try {
            await supabase.from('email_queue').insert({
              to: p.email,
              subject: `Invitation — ${titleText}`,
              html_body: html,
              status: 'pending',
            });
            sent += 1;
          } catch (e) {
            console.error('[live-invitations] email enqueue', String(e));
          }
        }

        // WhatsApp élève → Twilio (si choisi + opt-in notify_sms + téléphone + Twilio configuré)
        if (wantWhatsApp && whatsappConfigured() && p.phone && p.notify_sms && !seenPhone.has(p.phone)) {
          seenPhone.add(p.phone);
          try {
            const res = await sendWhatsApp({ to: p.phone, title: titleText, when, link });
            if (res.status === 'sent') sent += 1;
            else if (res.status !== 'disabled') console.warn('[live-invitations] whatsapp', res.status, res.error || '');
          } catch (e) {
            console.error('[live-invitations] whatsapp', String(e));
          }
        }
      }
    }

    // Idempotence : marqué même si 0 destinataire, pour ne pas reboucler.
    await supabase.from('live_sessions').update({ invitations_sent_at: new Date().toISOString() }).eq('id', s.id);
  }

  return sent;
}
