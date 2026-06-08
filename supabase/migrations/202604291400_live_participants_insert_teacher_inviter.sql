-- Inserts sur live_session_participants : l’enseignant / staff / membre avec can_invite_others
-- peut ajouter des lignes pour d’autres user_id (invités). L’ancienne policy
-- (user_id = auth.uid() seul) provoquait des 403 sur upsert depuis le studio ou la classroom.

DROP POLICY IF EXISTS "live_participants_insert" ON public.live_session_participants;

CREATE POLICY "live_participants_insert" ON public.live_session_participants FOR INSERT WITH CHECK (
  user_id = auth.uid()
  OR public.internal_live_session_teacher_id(live_session_id) = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
    AND lower(COALESCE(p.role, '')) IN ('owner', 'admin', 'secretariat')
  )
  OR EXISTS (
    SELECT 1 FROM public.live_session_participants lp
    WHERE lp.live_session_id = live_session_id
      AND lp.user_id = auth.uid()
      AND lp.can_invite_others = true
  )
);
