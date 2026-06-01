-- Salle d'attente : présence « lobby » (chat / apartés sans encombrer la file d'admission hôte)
-- + accès live_session_chat pour invités en attente ou en lobby

-- ─── Données : éviter 23514 si d’anciennes lignes ont un statut hors liste ─────
-- (ex. « approved » jamais dans le CHECK SQL, mais parfois écrit par scripts / tests.)
UPDATE public.live_waiting_room_entries
SET status = 'accepted'
WHERE status = 'approved';

UPDATE public.live_waiting_room_entries
SET status = 'waiting'
WHERE status IS NOT NULL
  AND status NOT IN (
    'waiting',
    'accepted',
    'rejected',
    'audio_only',
    'host_pending',
    'lobby'
  );

-- ─── live_waiting_room_entries : statut lobby ────────────────────────────────
ALTER TABLE public.live_waiting_room_entries
  DROP CONSTRAINT IF EXISTS live_waiting_room_entries_status_check;

ALTER TABLE public.live_waiting_room_entries
  ADD CONSTRAINT live_waiting_room_entries_status_check
  CHECK (status IN ('waiting', 'accepted', 'rejected', 'audio_only', 'host_pending', 'lobby'));

COMMENT ON CONSTRAINT live_waiting_room_entries_status_check ON public.live_waiting_room_entries IS
  'lobby = présence sur la page salle d''attente (chat), sans demande d''admission — non listé comme « en attente » côté hôte.';

-- ─── live_session_chat : lecture / écriture depuis salle d'attente ───────────
DROP POLICY IF EXISTS "live_chat_read" ON public.live_session_chat;
CREATE POLICY "live_chat_read" ON public.live_session_chat FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.live_session_participants lp
    WHERE lp.live_session_id = live_session_chat.live_session_id AND lp.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.live_sessions ls
    WHERE ls.id = live_session_chat.live_session_id AND ls.teacher_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.live_waiting_room_entries w
    WHERE w.live_session_id = live_session_chat.live_session_id
      AND w.user_id = auth.uid()
      AND w.status IN ('waiting', 'host_pending', 'audio_only', 'accepted', 'lobby')
  )
  OR EXISTS (
    SELECT 1 FROM public.live_invitations li
    WHERE li.live_session_id = live_session_chat.live_session_id AND li.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "live_chat_insert" ON public.live_session_chat;
CREATE POLICY "live_chat_insert" ON public.live_session_chat FOR INSERT WITH CHECK (
  user_id = auth.uid()
  AND (
    EXISTS (
      SELECT 1 FROM public.live_session_participants lp
      WHERE lp.live_session_id = live_session_chat.live_session_id AND lp.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.live_sessions ls
      WHERE ls.id = live_session_chat.live_session_id AND ls.teacher_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.live_waiting_room_entries w
      WHERE w.live_session_id = live_session_chat.live_session_id
        AND w.user_id = auth.uid()
        AND w.status IN ('waiting', 'host_pending', 'audio_only', 'accepted', 'lobby')
    )
    OR EXISTS (
      SELECT 1 FROM public.live_invitations li
      WHERE li.live_session_id = live_session_chat.live_session_id AND li.user_id = auth.uid()
    )
  )
);

-- ─── Apartés : corriger accepted vs approved + lobby / waiting ───────────────
DROP POLICY IF EXISTS "lspm_insert_teacher_member" ON public.live_session_private_messages;
CREATE POLICY "lspm_insert_teacher_member"
  ON public.live_session_private_messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND (
      (
        public.internal_live_session_teacher_id(live_session_id) IN (sender_id, recipient_id)
      )
      OR EXISTS (
        SELECT 1 FROM public.live_session_participants lsp
        WHERE lsp.live_session_id = live_session_private_messages.live_session_id
          AND lsp.user_id = auth.uid()
          AND lsp.role = 'host'
      )
    )
    AND (
      public.internal_live_session_teacher_id(live_session_id) = sender_id
      OR public.internal_is_live_session_participant(live_session_id, sender_id)
      OR EXISTS (
        SELECT 1 FROM public.live_invitations li
        WHERE li.live_session_id = live_session_private_messages.live_session_id
          AND li.user_id = sender_id
      )
      OR EXISTS (
        SELECT 1 FROM public.live_waiting_room_entries w
        WHERE w.live_session_id = live_session_private_messages.live_session_id
          AND w.user_id = sender_id
          AND w.status IN ('waiting', 'host_pending', 'audio_only', 'accepted', 'lobby')
      )
    )
    AND (
      public.internal_live_session_teacher_id(live_session_id) = recipient_id
      OR public.internal_is_live_session_participant(live_session_id, recipient_id)
      OR EXISTS (
        SELECT 1 FROM public.live_waiting_room_entries w
        WHERE w.live_session_id = live_session_private_messages.live_session_id
          AND w.user_id = recipient_id
          AND w.status IN ('waiting', 'host_pending', 'audio_only', 'accepted', 'lobby')
      )
    )
  );

DROP POLICY IF EXISTS "lspm_select_participants" ON public.live_session_private_messages;
CREATE POLICY "lspm_select_participants"
  ON public.live_session_private_messages FOR SELECT
  USING (
    (sender_id = auth.uid() OR recipient_id = auth.uid())
    AND (
      public.internal_live_session_teacher_id(live_session_id) = auth.uid()
      OR public.internal_is_live_session_participant(live_session_id, auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.live_invitations li
        WHERE li.live_session_id = live_session_private_messages.live_session_id
          AND li.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.live_waiting_room_entries w
        WHERE w.live_session_id = live_session_private_messages.live_session_id
          AND w.user_id = auth.uid()
          AND w.status IN ('waiting', 'host_pending', 'audio_only', 'accepted', 'lobby')
      )
    )
  );
