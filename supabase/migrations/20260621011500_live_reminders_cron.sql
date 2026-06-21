-- ═════════════════════════════════════════════════════════════════════════════
-- RAPPELS « live bientôt » (avant le démarrage) — worker edge `live-reminders`.
--
-- La colonne d'idempotence live_sessions.reminder_sent_at + son index partiel
-- idx_live_sessions_reminder sont déjà créés par 20260614150000_live_reminder_sent.sql.
--
-- Ce fichier ajoute :
--   1) enqueue_live_reminder(uuid) : insère les live_notifications (dashboard + email)
--      de type 'reminder' pour UNE session, en réutilisant EXACTEMENT le même schéma
--      de destinataires que notify_live_session_started (cf. 202604302400) — invités
--      (live_invitations) + inscrits actifs si la session est publique (enrollments).
--      L'edge function 'live-reminders' appelle cette RPC par session puis pose
--      reminder_sent_at = now(). Idempotent (anti-doublon par destinataire).
--   2) (optionnel) un job pg_cron toutes les 5 min qui frappe l'edge function, si et
--      seulement si l'extension pg_cron est installée. Sinon : cron externe requis
--      (cf. commande de déclenchement dans le résumé).
-- ═════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) Fonction d'enfilement des rappels pour une session (mêmes destinataires que
--    notify_live_session_started, type 'reminder').
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.enqueue_live_reminder(p_session_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sess RECORD;
  v_rules RECORD;
  v_host_name text;
  v_vis text;
  v_is_public boolean;
  v_rules_found boolean := false;
  v_inserted integer := 0;
  v_n integer;
BEGIN
  SELECT
    ls.id,
    ls.teacher_id,
    ls.formation_id,
    ls.title,
    COALESCE(NULLIF(trim(ls.visibility_mode), ''), 'secret') AS vis
  INTO v_sess
  FROM public.live_sessions ls
  WHERE ls.id = p_session_id;

  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  SELECT * INTO v_rules
  FROM public.live_visibility_rules lvr
  WHERE lvr.live_session_id = p_session_id
  LIMIT 1;
  v_rules_found := FOUND;

  v_vis := lower(v_sess.vis);
  v_is_public := false;
  IF v_rules_found THEN
    v_is_public := COALESCE(v_rules.is_public, false);
  END IF;
  IF v_vis = 'public' THEN
    v_is_public := true;
  END IF;

  SELECT p.name INTO v_host_name
  FROM public.profiles p
  WHERE p.id = v_sess.teacher_id
  LIMIT 1;

  -- ── Canal dashboard ────────────────────────────────────────────────────────
  INSERT INTO public.live_notifications (
    live_session_id, user_id, channel, type, title, body, action_url, payload_json, sent_at
  )
  SELECT
    p_session_id,
    x.user_id,
    'dashboard',
    'reminder',
    'Rappel: live bientôt',
    format(
      '%s — « %s » commence bientôt. Préparez-vous à rejoindre la salle d''attente.',
      COALESCE(v_host_name, 'Le formateur'),
      COALESCE(v_sess.title, 'la session')
    ),
    '/live/waiting/' || p_session_id::text,
    jsonb_build_object('session_id', p_session_id::text, 'title', v_sess.title),
    now()
  FROM (
    SELECT DISTINCT li.user_id AS user_id
    FROM public.live_invitations li
    WHERE li.live_session_id = p_session_id
      AND li.user_id IS NOT NULL
      AND li.user_id IS DISTINCT FROM v_sess.teacher_id
      AND li.status IN ('pending', 'sent', 'seen', 'accepted')
    UNION
    SELECT DISTINCT e.student_id AS user_id
    FROM public.enrollments e
    WHERE v_is_public
      AND v_sess.formation_id IS NOT NULL
      AND e.formation_id = v_sess.formation_id
      AND e.status IN ('active', 'enrolled')
      AND e.student_id IS DISTINCT FROM v_sess.teacher_id
  ) x
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.live_notifications ln
    WHERE ln.live_session_id = p_session_id
      AND ln.user_id = x.user_id
      AND ln.type = 'reminder'
      AND ln.channel = 'dashboard'
  );
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_inserted := v_inserted + COALESCE(v_n, 0);

  -- ── Canal email (sent_at NULL → file traitée par le worker email) ───────────
  INSERT INTO public.live_notifications (
    live_session_id, user_id, channel, type, title, body, action_url, payload_json, sent_at
  )
  SELECT
    p_session_id,
    x.user_id,
    'email',
    'reminder',
    'Rappel: live bientôt — ' || COALESCE(v_sess.title, 'Session'),
    format(
      '%s — « %s » commence bientôt. Rejoignez la salle d''attente depuis votre espace.',
      COALESCE(v_host_name, 'Le formateur'),
      COALESCE(v_sess.title, 'la session')
    ),
    '/live/waiting/' || p_session_id::text,
    jsonb_build_object('session_id', p_session_id::text, 'title', v_sess.title),
    NULL
  FROM (
    SELECT DISTINCT li.user_id AS user_id
    FROM public.live_invitations li
    WHERE li.live_session_id = p_session_id
      AND li.user_id IS NOT NULL
      AND li.user_id IS DISTINCT FROM v_sess.teacher_id
      AND li.status IN ('pending', 'sent', 'seen', 'accepted')
    UNION
    SELECT DISTINCT e.student_id AS user_id
    FROM public.enrollments e
    WHERE v_is_public
      AND v_sess.formation_id IS NOT NULL
      AND e.formation_id = v_sess.formation_id
      AND e.status IN ('active', 'enrolled')
      AND e.student_id IS DISTINCT FROM v_sess.teacher_id
  ) x
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.live_notifications ln
    WHERE ln.live_session_id = p_session_id
      AND ln.user_id = x.user_id
      AND ln.type = 'reminder'
      AND ln.channel = 'email'
  );
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_inserted := v_inserted + COALESCE(v_n, 0);

  RETURN v_inserted;
END;
$$;

COMMENT ON FUNCTION public.enqueue_live_reminder(uuid) IS
  'Insère les live_notifications (dashboard + email, type=reminder) « live bientôt » pour une session ; mêmes destinataires que notify_live_session_started. Idempotent.';

-- File d'attente e-mail des rappels — index seulement si la table existe.
-- ⚠️ En prod, `live_notifications` N'EXISTE PAS (l'infra de notification live des
--    fichiers de migration n'a jamais été appliquée). Tant qu'elle n'est pas
--    provisionnée, ce bloc est un no-op et la fonction ci-dessus reste inerte
--    (jamais appelée : edge `live-reminders` non déployée, cron non programmé).
DO $idx$
BEGIN
  IF to_regclass('public.live_notifications') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_live_notif_email_reminder_pending
      ON public.live_notifications (created_at ASC)
      WHERE channel = 'email' AND type = 'reminder' AND sent_at IS NULL;
  ELSE
    RAISE NOTICE 'live_notifications absente — rappels live non provisionnés (infra notif live manquante en prod).';
  END IF;
END
$idx$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) (Optionnel) pg_cron toutes les 5 min → frappe l'edge function live-reminders.
--    Nécessite l'extension pg_cron ET pg_net + le GUC `app.settings.*` configurés.
--    Si pg_cron n'est pas dispo : NO-OP ici, un cron externe doit appeler la fn
--    (voir la commande de déclenchement dans le résumé / commentaire ci-dessous).
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_base   text;
  v_secret text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE NOTICE 'pg_cron non installé — déclencher live-reminders via un cron externe (voir résumé).';
    RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    RAISE NOTICE 'pg_net non installé — déclencher live-reminders via un cron externe (voir résumé).';
    RETURN;
  END IF;

  -- Lecture best-effort des réglages projet (à poser une fois :
  --   ALTER DATABASE postgres SET app.settings.functions_base_url = 'https://<ref>.functions.supabase.co';
  --   ALTER DATABASE postgres SET app.settings.live_reminders_secret = '<SUPABASE_SERVICE_ROLE_KEY ou secret dédié>';
  -- ).
  BEGIN
    v_base := current_setting('app.settings.functions_base_url', true);
  EXCEPTION WHEN OTHERS THEN v_base := NULL;
  END;
  BEGIN
    v_secret := current_setting('app.settings.live_reminders_secret', true);
  EXCEPTION WHEN OTHERS THEN v_secret := NULL;
  END;

  IF v_base IS NULL OR length(trim(v_base)) = 0 THEN
    RAISE NOTICE 'app.settings.functions_base_url absent — cron live-reminders non programmé (cron externe requis).';
    RETURN;
  END IF;

  PERFORM cron.unschedule('liri-live-reminders')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'liri-live-reminders');

  PERFORM cron.schedule(
    'liri-live-reminders',
    '*/5 * * * *',
    format(
      $cron$SELECT net.http_post(
        url := %L,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', %L
        ),
        body := '{}'::jsonb
      );$cron$,
      rtrim(v_base, '/') || '/live-reminders',
      'Bearer ' || COALESCE(v_secret, '')
    )
  );

  RAISE NOTICE 'Cron liri-live-reminders programmé (*/5 min) → %/live-reminders', rtrim(v_base, '/');
END $$;
