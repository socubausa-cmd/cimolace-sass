-- Live démarré : canal WhatsApp (file traitée par Netlify + Twilio) + message messagerie unifiée (`messages`).
-- Option `notify_whatsapp` sur live_visibility_rules (comme notify_email).

ALTER TABLE public.live_visibility_rules
  ADD COLUMN IF NOT EXISTS notify_whatsapp BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.live_visibility_rules.notify_whatsapp IS
  'Si vrai, une ligne live_notifications channel=whatsapp (sent_at null) est créée au passage en live ; worker Netlify envoie via Twilio.';

ALTER TABLE public.live_notifications
  DROP CONSTRAINT IF EXISTS live_notifications_channel_check;

ALTER TABLE public.live_notifications
  ADD CONSTRAINT live_notifications_channel_check
  CHECK (channel IN ('dashboard', 'email', 'whatsapp'));

CREATE OR REPLACE FUNCTION public.notify_live_session_started(p_session_id uuid)
RETURNS void
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
  v_notify_dash boolean;
  v_notify_email boolean;
  v_notify_wa boolean;
  v_rules_found boolean := false;
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
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.live_notifications ln
    WHERE ln.live_session_id = p_session_id
      AND ln.type = 'live_now'
      AND ln.created_at > now() - interval '3 minutes'
  ) THEN
    RETURN;
  END IF;

  SELECT * INTO v_rules
  FROM public.live_visibility_rules lvr
  WHERE lvr.live_session_id = p_session_id
  LIMIT 1;

  v_rules_found := FOUND;

  v_vis := lower(v_sess.vis);
  v_is_public := false;
  v_notify_dash := true;
  v_notify_email := false;
  v_notify_wa := false;

  IF v_rules_found THEN
    v_is_public := COALESCE(v_rules.is_public, false);
    v_notify_dash := COALESCE(v_rules.notify_dashboard, true);
    v_notify_email := COALESCE(v_rules.notify_email, false);
    v_notify_wa := COALESCE(v_rules.notify_whatsapp, false);
  END IF;

  IF v_vis = 'public' THEN
    v_is_public := true;
  END IF;

  IF NOT v_rules_found AND NOT v_is_public THEN
    v_is_public := false;
  END IF;

  IF NOT v_notify_dash AND NOT v_notify_email AND NOT v_notify_wa THEN
    RETURN;
  END IF;

  SELECT p.name INTO v_host_name
  FROM public.profiles p
  WHERE p.id = v_sess.teacher_id
  LIMIT 1;

  IF v_notify_dash THEN
    INSERT INTO public.live_notifications (
      live_session_id,
      user_id,
      channel,
      type,
      title,
      body,
      action_url,
      payload_json,
      sent_at
    )
    SELECT
      p_session_id,
      x.user_id,
      'dashboard',
      'live_now',
      'Live en cours',
      format(
        '%s a démarré « %s ».',
        COALESCE(v_host_name, 'Le formateur'),
        COALESCE(v_sess.title, 'la session')
      ),
      '/live/waiting/' || p_session_id::text,
      jsonb_build_object(
        'session_id', p_session_id::text,
        'title', v_sess.title
      ),
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
        AND e.status IN ('active', 'pending')
        AND e.student_id IS DISTINCT FROM v_sess.teacher_id
    ) x
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.live_notifications ln
      WHERE ln.live_session_id = p_session_id
        AND ln.user_id = x.user_id
        AND ln.type = 'live_now'
        AND ln.channel = 'dashboard'
    );
  END IF;

  IF v_notify_email THEN
    INSERT INTO public.live_notifications (
      live_session_id,
      user_id,
      channel,
      type,
      title,
      body,
      action_url,
      payload_json,
      sent_at
    )
    SELECT
      p_session_id,
      x.user_id,
      'email',
      'live_now',
      'Live en cours — ' || COALESCE(v_sess.title, 'Session'),
      format(
        '%s a démarré « %s ». Rejoignez la salle d''attente ou le direct depuis votre espace.',
        COALESCE(v_host_name, 'Le formateur'),
        COALESCE(v_sess.title, 'la session')
      ),
      '/live/waiting/' || p_session_id::text,
      jsonb_build_object(
        'session_id', p_session_id::text,
        'title', v_sess.title
      ),
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
        AND e.status IN ('active', 'pending')
        AND e.student_id IS DISTINCT FROM v_sess.teacher_id
    ) x
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.live_notifications ln
      WHERE ln.live_session_id = p_session_id
        AND ln.user_id = x.user_id
        AND ln.type = 'live_now'
        AND ln.channel = 'email'
    );
  END IF;

  IF v_notify_wa THEN
    INSERT INTO public.live_notifications (
      live_session_id,
      user_id,
      channel,
      type,
      title,
      body,
      action_url,
      payload_json,
      sent_at
    )
    SELECT
      p_session_id,
      x.user_id,
      'whatsapp',
      'live_now',
      'Live en cours',
      format(
        '%s a démarré « %s ». Ouvrez votre espace ISNA ou la salle d''attente pour rejoindre.',
        COALESCE(v_host_name, 'Le formateur'),
        COALESCE(v_sess.title, 'la session')
      ),
      '/live/waiting/' || p_session_id::text,
      jsonb_build_object(
        'session_id', p_session_id::text,
        'title', v_sess.title
      ),
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
        AND e.status IN ('active', 'pending')
        AND e.student_id IS DISTINCT FROM v_sess.teacher_id
    ) x
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.live_notifications ln
      WHERE ln.live_session_id = p_session_id
        AND ln.user_id = x.user_id
        AND ln.type = 'live_now'
        AND ln.channel = 'whatsapp'
    );
  END IF;

  -- Messagerie unifiée : dès qu’au moins un canal « live démarré » est actif pour les destinataires.
  IF v_notify_dash OR v_notify_email OR v_notify_wa THEN
    INSERT INTO public.messages (sender_id, receiver_id, content, is_read)
    SELECT
      v_sess.teacher_id,
      x.user_id,
      format(
        E'[LIVE_ALERT:%s]\nLive en cours — %s a démarré « %s ».\nRejoindre maintenant : /live/waiting/%s',
        p_session_id::text,
        COALESCE(v_host_name, 'Le formateur'),
        COALESCE(v_sess.title, 'la session'),
        p_session_id::text
      ),
      false
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
        AND e.status IN ('active', 'pending')
        AND e.student_id IS DISTINCT FROM v_sess.teacher_id
    ) x
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.messages m
      WHERE m.sender_id = v_sess.teacher_id
        AND m.receiver_id = x.user_id
        AND m.content LIKE '[LIVE_ALERT:' || p_session_id::text || ']%'
    );
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_live_notif_wa_live_now_pending
  ON public.live_notifications (created_at ASC)
  WHERE channel = 'whatsapp' AND type = 'live_now' AND sent_at IS NULL;

COMMENT ON FUNCTION public.notify_live_session_started(uuid) IS
  'Insère live_notifications (dashboard, e-mail, WhatsApp) + message `messages` (formateur → membre) au passage en live.';
