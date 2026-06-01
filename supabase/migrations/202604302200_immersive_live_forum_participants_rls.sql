-- Forum live immersif : lecture / écriture pour tout participant enregistré sur la session,
-- pas seulement host_user_id / guest_user_id sur immersive_live_sessions.

DROP POLICY IF EXISTS "immersive_live_chat_read" ON public.immersive_live_chat_messages;
DROP POLICY IF EXISTS "immersive_live_chat_insert" ON public.immersive_live_chat_messages;

CREATE POLICY "immersive_live_chat_read"
ON public.immersive_live_chat_messages FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.immersive_live_sessions s
    WHERE s.id = immersive_live_chat_messages.live_session_id
      AND (s.host_user_id = auth.uid() OR s.guest_user_id = auth.uid())
  )
  OR EXISTS (
    SELECT 1 FROM public.immersive_live_participants p
    WHERE p.live_session_id = immersive_live_chat_messages.live_session_id
      AND p.user_id = auth.uid()
  )
);

CREATE POLICY "immersive_live_chat_insert"
ON public.immersive_live_chat_messages FOR INSERT TO authenticated
WITH CHECK (
  sender_id = auth.uid()
  AND (
    EXISTS (
      SELECT 1 FROM public.immersive_live_sessions s
      WHERE s.id = immersive_live_chat_messages.live_session_id
        AND (s.host_user_id = auth.uid() OR s.guest_user_id = auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.immersive_live_participants p
      WHERE p.live_session_id = immersive_live_chat_messages.live_session_id
        AND p.user_id = auth.uid()
    )
  )
);
