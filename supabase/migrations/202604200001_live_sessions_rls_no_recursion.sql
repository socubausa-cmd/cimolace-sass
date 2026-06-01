-- Évite la récursion infinie entre policies RLS sur live_sessions et live_session_participants
-- (Postgres peut renvoyer une erreur 500 via PostgREST sur GET .../live_sessions?select=*)

CREATE OR REPLACE FUNCTION public.internal_live_session_teacher_id(p_session_id uuid)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT teacher_id FROM public.live_sessions WHERE id = p_session_id;
$$;

CREATE OR REPLACE FUNCTION public.internal_is_live_session_participant(p_session_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.live_session_participants
    WHERE live_session_id = p_session_id AND user_id = p_user_id
  );
$$;

REVOKE ALL ON FUNCTION public.internal_live_session_teacher_id(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.internal_live_session_teacher_id(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.internal_is_live_session_participant(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.internal_is_live_session_participant(uuid, uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "live_sessions_read" ON public.live_sessions;
CREATE POLICY "live_sessions_read" ON public.live_sessions FOR SELECT USING (
  teacher_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
    AND lower(COALESCE(p.role, '')) IN ('owner', 'admin', 'secretariat')
  )
  OR public.internal_is_live_session_participant(id, auth.uid())
);

DROP POLICY IF EXISTS "live_participants_read" ON public.live_session_participants;
CREATE POLICY "live_participants_read" ON public.live_session_participants FOR SELECT USING (
  user_id = auth.uid()
  OR public.internal_live_session_teacher_id(live_session_id) = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
    AND lower(COALESCE(p.role, '')) IN ('owner', 'admin', 'secretariat')
  )
);

DROP POLICY IF EXISTS "live_participants_update" ON public.live_session_participants;
CREATE POLICY "live_participants_update" ON public.live_session_participants FOR UPDATE USING (
  user_id = auth.uid()
  OR public.internal_live_session_teacher_id(live_session_id) = auth.uid()
);
