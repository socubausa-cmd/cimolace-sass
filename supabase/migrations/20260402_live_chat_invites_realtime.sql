-- Enable realtime delivery for live_chat_invites events
-- Needed so invite notifications propagate instantly between users.

ALTER TABLE public.live_chat_invites REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'live_chat_invites'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.live_chat_invites;
  END IF;
END
$$;
