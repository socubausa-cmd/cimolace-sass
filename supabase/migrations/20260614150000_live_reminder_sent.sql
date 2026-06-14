-- Anti-doublon pour les rappels « live bientôt » (worker live-reminders).
ALTER TABLE public.live_sessions ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_live_sessions_reminder
  ON public.live_sessions(status, scheduled_at)
  WHERE reminder_sent_at IS NULL;
