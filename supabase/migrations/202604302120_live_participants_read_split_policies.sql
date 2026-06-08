-- Évite les 500 PostgREST sur SELECT live_session_participants (ex. can_invite_others) :
-- une seule policy avec (user_id = auth.uid() OR teacher_id(...) OR staff) peut forcer
-- l’évaluation de branches lourdes même pour la ligne « soi ». Politiques séparées (OR implicite)
-- pour que la lecture de sa propre participation reste triviale.

DROP POLICY IF EXISTS "live_participants_read" ON public.live_session_participants;
DROP POLICY IF EXISTS "live_participants_select_own_row" ON public.live_session_participants;
DROP POLICY IF EXISTS "live_participants_select_as_teacher" ON public.live_session_participants;
DROP POLICY IF EXISTS "live_participants_select_staff" ON public.live_session_participants;

CREATE POLICY "live_participants_select_own_row" ON public.live_session_participants
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "live_participants_select_as_teacher" ON public.live_session_participants
  FOR SELECT
  USING (public.internal_live_session_teacher_id(live_session_id) = auth.uid());

CREATE POLICY "live_participants_select_staff" ON public.live_session_participants
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND lower(COALESCE(p.role, '')) IN ('owner', 'admin', 'secretariat')
    )
  );
