-- Les débatteurs / spectateurs du débat lié à la session peuvent lire toute la file NeuronQ
-- (policy précédente : seulement auteur, hôte session, staff).
DROP POLICY IF EXISTS "live_neuronq_select" ON public.live_neuronq_questions;

CREATE POLICY "live_neuronq_select" ON public.live_neuronq_questions
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.internal_live_session_teacher_id(live_session_id) = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND lower(COALESCE(p.role, '')) IN ('owner', 'admin', 'secretariat')
    )
    OR EXISTS (
      SELECT 1
      FROM public.live_sessions ls
      JOIN public.debate_participants dp ON dp.debate_id = ls.debate_id AND dp.user_id = auth.uid()
      WHERE ls.id = live_neuronq_questions.live_session_id
        AND ls.debate_id IS NOT NULL
    )
  );
