-- Compteur de participants actifs (left_at NULL) pour l’app élève (carte accueil, etc.)
-- Nécessite internal_* (migrations 202604302110 / 202604302314).

CREATE OR REPLACE FUNCTION public.live_session_active_participant_count(p_session_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
STABLE
AS $$
DECLARE
  uid uuid := auth.uid();
  n int;
  allowed boolean;
BEGIN
  IF p_session_id IS NULL THEN
    RETURN 0;
  END IF;

  IF uid IS NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.live_visibility_rules v
      INNER JOIN public.live_sessions ls ON ls.id = v.live_session_id
      WHERE v.live_session_id = p_session_id
        AND v.is_public IS TRUE
        AND ls.status = 'live'
    ) INTO allowed;
    IF NOT allowed THEN
      RETURN 0;
    END IF;
  ELSE
    SELECT EXISTS (
      SELECT 1
      FROM public.live_sessions ls
      WHERE ls.id = p_session_id
        AND (
          ls.teacher_id = uid
          OR EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = uid
            AND lower(COALESCE(p.role, '')) IN ('owner', 'admin', 'secretariat')
          )
          OR public.internal_is_live_session_participant(ls.id, uid)
          OR public.internal_user_has_live_invitation(ls.id, uid)
          OR (
            ls.debate_id IS NOT NULL
            AND public.internal_user_is_debate_participant(ls.debate_id, uid)
          )
          OR ls.status = 'live'
        )
    ) INTO allowed;
    IF NOT allowed THEN
      RETURN 0;
    END IF;
  END IF;

  SELECT COUNT(*)::int INTO n
  FROM public.live_session_participants lp
  WHERE lp.live_session_id = p_session_id
    AND lp.left_at IS NULL;

  RETURN COALESCE(n, 0);
END;
$$;

COMMENT ON FUNCTION public.live_session_active_participant_count(uuid) IS
  'Lignes live_session_participants actives (left_at NULL) si l’appelant peut lire la session.';

REVOKE ALL ON FUNCTION public.live_session_active_participant_count(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.live_session_active_participant_count(uuid) TO anon, authenticated, service_role;
