-- Couche « aparté texte » formateur ↔ membre : persistance + Realtime.
-- Dépend de internal_live_session_teacher_id / internal_is_live_session_participant (202604302314).
-- + extension longia_chat_threads.scope_type pour coach élève (live_student).

ALTER TABLE public.longia_chat_threads DROP CONSTRAINT IF EXISTS longia_chat_threads_scope_type_check;
ALTER TABLE public.longia_chat_threads ADD CONSTRAINT longia_chat_threads_scope_type_check
  CHECK (scope_type IN ('designer', 'live', 'live_student'));

COMMENT ON CONSTRAINT longia_chat_threads_scope_type_check ON public.longia_chat_threads IS
  'live = fil LONGIA hôte session ; live_student = fil LONGIA coach privé élève ; designer = Smartboard.';

CREATE TABLE IF NOT EXISTS public.live_session_private_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  live_session_id uuid NOT NULL REFERENCES public.live_sessions (id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(trim(body)) > 0 AND char_length(body) <= 16000),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT live_session_private_messages_distinct_pair CHECK (sender_id <> recipient_id)
);

CREATE INDEX IF NOT EXISTS live_session_private_messages_session_created_idx
  ON public.live_session_private_messages (live_session_id, created_at DESC);

CREATE INDEX IF NOT EXISTS live_session_private_messages_sender_idx
  ON public.live_session_private_messages (sender_id);

CREATE INDEX IF NOT EXISTS live_session_private_messages_recipient_idx
  ON public.live_session_private_messages (recipient_id);

ALTER TABLE public.live_session_private_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lspm_select_participants" ON public.live_session_private_messages;
DROP POLICY IF EXISTS "lspm_insert_teacher_member" ON public.live_session_private_messages;

CREATE POLICY "lspm_select_participants"
  ON public.live_session_private_messages FOR SELECT
  USING (
    (sender_id = auth.uid() OR recipient_id = auth.uid())
    AND (
      public.internal_live_session_teacher_id(live_session_id) = auth.uid()
      OR public.internal_is_live_session_participant(live_session_id, auth.uid())
    )
  );

CREATE POLICY "lspm_insert_teacher_member"
  ON public.live_session_private_messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND public.internal_live_session_teacher_id(live_session_id) IN (sender_id, recipient_id)
    AND (
      public.internal_live_session_teacher_id(live_session_id) = sender_id
      OR public.internal_is_live_session_participant(live_session_id, sender_id)
    )
    AND (
      public.internal_live_session_teacher_id(live_session_id) = recipient_id
      OR public.internal_is_live_session_participant(live_session_id, recipient_id)
    )
  );

COMMENT ON TABLE public.live_session_private_messages IS
  'Aparté texte formateur ↔ membre pendant un live (historique + Realtime).';

ALTER TABLE public.live_session_private_messages REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'live_session_private_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.live_session_private_messages;
  END IF;
END $$;
