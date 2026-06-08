-- ============================================================
-- PRORASCIENCE — WebRTC signaling cleanup policies
-- ============================================================

DROP POLICY IF EXISTS "immersive_live_signals_delete" ON public.immersive_live_signals;

CREATE POLICY "immersive_live_signals_delete"
ON public.immersive_live_signals FOR DELETE TO authenticated
USING (
  sender_id = auth.uid()
  OR target_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.immersive_live_sessions s
    WHERE s.id = immersive_live_signals.live_session_id
      AND (s.host_user_id = auth.uid() OR s.guest_user_id = auth.uid())
  )
);
