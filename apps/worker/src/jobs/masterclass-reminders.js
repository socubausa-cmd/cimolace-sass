/**
 * masterclass-reminders.js — Rappel e-mail AVANT le démarrage d'un direct payant.
 *
 * Contrairement à live-reminders (qui poll les `live_sessions` programmées), une
 * masterclass ne crée sa live_session qu'au « Démarrer le direct » (tardif). Le
 * rappel PRÉ-programmé est donc piloté par la MASTERCLASS elle-même :
 *   billing_plans (category='masterclass', metadata.scheduled_at) + acheteurs
 *   (access_passes resource_type='service', resource_id=<clé>, status='active').
 *
 * Poll : masterclasses dont `scheduled_at` tombe dans la fenêtre [now, now+WINDOW]
 * et pas encore rappelées → enfile un rappel par acheteur dans `email_queue`
 * (envoyé par jobs/email.js → Resend, expéditeur résolu PAR TENANT).
 * Idempotent via `billing_plans.metadata.reminder_sent_at`.
 *
 * Lien : /t/<slug>/reserver?service=<clé> — à H-10 l'hôte n'a pas encore lancé,
 * donc le bouton « Rejoindre le direct » dira « pas encore démarré » puis ouvrira
 * la salle dès que le praticien démarre. L'email = « tenez-vous prêt·e ».
 */
import { createClient } from '@supabase/supabase-js';
import { getTenantNotif } from '../lib/tenantNotif.js';

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
);

// Fenêtre de rappel (min avant le direct). ~H-10 par défaut, configurable.
const WINDOW_MIN = Number(process.env.MASTERCLASS_REMINDER_WINDOW_MIN || 12);

function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Email d'un acheteur : profiles d'abord, fallback auth admin (acheteur invité). */
async function emailFor(userId) {
  if (!userId) return null;
  const { data } = await supabase.from('profiles').select('email, name').eq('id', userId).maybeSingle();
  if (data?.email) return { email: data.email, name: data.name || '' };
  try {
    const { data: u } = await supabase.auth.admin.getUserById(userId);
    if (u?.user?.email) return { email: u.user.email, name: '' };
  } catch {
    /* skip */
  }
  return null;
}

async function slugFor(tenantId) {
  try {
    const { data } = await supabase.from('tenants').select('slug').eq('id', tenantId).maybeSingle();
    return data?.slug || '';
  } catch {
    return '';
  }
}

export async function pollMasterclassReminders() {
  const now = new Date();
  const until = new Date(now.getTime() + WINDOW_MIN * 60_000);

  const { data: plans } = await supabase
    .from('billing_plans')
    .select('id, key, label, tenant_id, metadata')
    .eq('category', 'masterclass')
    .limit(200);

  if (!plans || plans.length === 0) return 0;

  let enqueued = 0;
  for (const p of plans) {
    const meta = p.metadata || {};
    if (meta.reminder_sent_at) continue; // déjà rappelée
    const sched = meta.scheduled_at ? new Date(meta.scheduled_at) : null;
    if (!sched || Number.isNaN(sched.getTime())) continue;
    if (sched < now || sched > until) continue; // hors fenêtre H-WINDOW

    const { data: passes } = await supabase
      .from('access_passes')
      .select('user_id')
      .eq('tenant_id', p.tenant_id)
      .eq('resource_type', 'service')
      .eq('resource_id', p.key)
      .eq('status', 'active');
    const userIds = [...new Set((passes || []).map((x) => x.user_id).filter(Boolean))];

    if (userIds.length) {
      const notif = await getTenantNotif(p.tenant_id);
      const slug = await slugFor(p.tenant_id);
      const link = `${notif.baseUrl}/t/${encodeURIComponent(slug)}/reserver?service=${encodeURIComponent(p.key)}`;
      const title = esc(p.label || 'Votre direct');
      const when = (() => {
        try { return sched.toLocaleString('fr-FR'); } catch { return ''; }
      })();
      const seen = new Set();
      for (const uid of userIds) {
        const r = await emailFor(uid);
        if (!r || seen.has(r.email)) continue;
        seen.add(r.email);
        const html =
          `<p>Bonjour ${esc(r.name)},</p>` +
          `<p>Le direct « <strong>${title}</strong> » commence bientôt${when ? ` (${esc(when)})` : ''}.</p>` +
          `<p>Tenez-vous prêt·e — la salle s'ouvrira dès que le praticien démarre :</p>` +
          `<p><a href="${link}">Rejoindre le direct</a></p>`;
        try {
          await supabase.from('email_queue').insert({
            to: r.email,
            from: notif.from,
            from_name: notif.fromName,
            tenant_id: p.tenant_id || null,
            subject: `Rappel — « ${p.label || 'le direct'} » commence bientôt`,
            html_body: html,
            status: 'pending',
          });
          enqueued += 1;
        } catch (e) {
          console.error('[masterclass-reminders] enqueue', String(e));
        }
      }
    }

    // Marquer rappelée (idempotence), même sans destinataire, pour ne pas reboucler.
    await supabase
      .from('billing_plans')
      .update({ metadata: { ...meta, reminder_sent_at: new Date().toISOString() } })
      .eq('id', p.id);
  }

  return enqueued;
}
