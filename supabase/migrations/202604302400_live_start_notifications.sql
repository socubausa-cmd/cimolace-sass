-- Notifications « live démarré » : dashboard (+ file d’e-mails traitée par Netlify).
-- Public (is_public ou visibility_mode = public) : invités + inscrits actifs à la formation liée.
-- Privé / secret : uniquement les utilisateurs invités (live_invitations).

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

  -- Anti-doublon court (plusieurs mises à jour successives)
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

  IF v_rules_found THEN
    v_is_public := COALESCE(v_rules.is_public, false);
    v_notify_dash := COALESCE(v_rules.notify_dashboard, true);
    v_notify_email := COALESCE(v_rules.notify_email, false);
  END IF;

  IF v_vis = 'public' THEN
    v_is_public := true;
  END IF;

  IF NOT v_rules_found AND NOT v_is_public THEN
    v_is_public := false;
  END IF;

  IF NOT v_notify_dash AND NOT v_notify_email THEN
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
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_fn_notify_live_started()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM 'live' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status IS NOT DISTINCT FROM 'live' THEN
    RETURN NEW;
  END IF;

  PERFORM public.notify_live_session_started(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_live_sessions_notify_started ON public.live_sessions;
CREATE TRIGGER trg_live_sessions_notify_started
AFTER INSERT OR UPDATE OF status ON public.live_sessions
FOR EACH ROW
EXECUTE FUNCTION public.trg_fn_notify_live_started();

CREATE INDEX IF NOT EXISTS idx_live_notif_email_live_now_pending
  ON public.live_notifications (created_at ASC)
  WHERE channel = 'email' AND type = 'live_now' AND sent_at IS NULL;

COMMENT ON FUNCTION public.notify_live_session_started(uuid) IS
  'Insère live_notifications (dashboard + file e-mail) quand une session passe en live ; respecte is_public / visibility_mode.';
