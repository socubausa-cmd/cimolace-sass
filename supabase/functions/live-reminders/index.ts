/// <reference lib="deno.ns" />

/**
 * live-reminders — Rappels « live bientôt » AVANT le démarrage d'un live.
 *
 * Comble le trou : `live_sessions.reminder_sent_at` existe désormais mais aucun
 * worker ne l'exploitait. On poll les sessions PROGRAMMÉES qui démarrent dans la
 * fenêtre (~15 min) et on insère une notification dans la VRAIE table `notifications`
 * de prod (pas la table fantôme `live_notifications` qui n'existe pas) pour les
 * INVITÉS de la session (`live_invitations`). Puis on pose `reminder_sent_at = now()`.
 *
 * Idempotent : `reminder_sent_at` est posé après traitement (même à 0 destinataire)
 * → la session n'est jamais retraitée.
 *
 * Sélection : status='scheduled', reminder_sent_at IS NULL,
 *             scheduled_at ∈ [now, now + LIVE_REMINDER_WINDOW_MIN (def 15)].
 *
 * Déclenchement (toutes les ~5 min) — cron externe ou pg_cron :
 *   curl -X POST "https://<ref>.functions.supabase.co/live-reminders" \
 *     -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
 */
import { corsHeaders } from '../_shared/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

const INVITE_STATUSES = ['pending', 'sent', 'seen', 'accepted'];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  // @ts-ignore Deno
  const env = (k: string) => String(Deno.env.get(k) || '').trim();
  const serviceKey = env('SUPABASE_SERVICE_ROLE_KEY');
  const url = env('SUPABASE_URL');
  const cronSecret = env('LIVE_REMINDERS_CRON_SECRET');

  // Auth : bearer == service-role key OU secret cron dédié.
  const auth = req.headers.get('Authorization') || '';
  const bearer = auth.replace(/^Bearer\s+/i, '').trim();
  if (!bearer || (bearer !== serviceKey && (!cronSecret || bearer !== cronSecret))) {
    return json(401, { ok: false, error: 'unauthorized' });
  }
  if (!url || !serviceKey) return json(500, { ok: false, error: 'missing service env' });

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  const windowMin = Number(env('LIVE_REMINDER_WINDOW_MIN')) || 15;
  const now = new Date();
  const until = new Date(now.getTime() + windowMin * 60_000);

  // 1) Sessions programmées qui démarrent bientôt, sans rappel déjà envoyé.
  const { data: sessions, error: sErr } = await admin
    .from('live_sessions')
    .select('id, tenant_id, title, scheduled_at, status, reminder_sent_at')
    .eq('status', 'scheduled')
    .is('reminder_sent_at', null)
    .gte('scheduled_at', now.toISOString())
    .lte('scheduled_at', until.toISOString())
    .limit(100);

  if (sErr) return json(502, { ok: false, error: `live_sessions: ${sErr.message}` });

  let notifs = 0;
  const processed: string[] = [];

  for (const s of sessions || []) {
    // 2) Destinataires = invités actifs de la session.
    const { data: invs } = await admin
      .from('live_invitations')
      .select('user_id, status')
      .eq('live_session_id', s.id)
      .in('status', INVITE_STATUSES);

    const userIds = Array.from(
      new Set((invs || []).map((i: { user_id: string | null }) => i.user_id).filter(Boolean)),
    ) as string[];

    if (userIds.length) {
      const rows = userIds.map((uid) => ({
        tenant_id: s.tenant_id,
        user_id: uid,
        type: 'info',
        priority: 'high',
        title: 'Rappel : live bientôt',
        body: `« ${s.title || 'La session'} » commence bientôt. Rejoins la salle d'attente.`,
        action_url: `/live/waiting/${s.id}`,
        is_read: false,
      }));
      const { error: nErr, count } = await admin
        .from('notifications')
        .insert(rows, { count: 'exact' });
      if (!nErr) notifs += count ?? rows.length;
    }

    // 3) Marque la session traitée (idempotence) — même à 0 destinataire.
    await admin.from('live_sessions').update({ reminder_sent_at: now.toISOString() }).eq('id', s.id);
    processed.push(s.id);
  }

  return json(200, { ok: true, sessions: processed.length, notifications: notifs });
});
