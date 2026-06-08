-- Repair: ERROR 23514 if an older script re-added live_sessions_session_type_check.
-- Safe to run multiple times. Does not re-add CHECK (legacy session_type values vary).
ALTER TABLE public.live_sessions DROP CONSTRAINT IF EXISTS live_sessions_session_type_check;
