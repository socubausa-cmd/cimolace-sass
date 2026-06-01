-- ============================================================
-- PRORASCIENCE — Extensions Classroom Live (LiveKit, Recording, Audit)
-- Prérequis : 20260325, 20260326
-- ============================================================

-- 1) Étendre live_sessions : session_type, recording, livekit_room_name
DO $$
BEGIN
  -- session_type : ajouter private_interview, classroom_live, conference_live, mentoring_session
  ALTER TABLE public.live_sessions DROP CONSTRAINT IF EXISTS live_sessions_session_type_check;
  ALTER TABLE public.live_sessions ADD CONSTRAINT live_sessions_session_type_check
    CHECK (session_type IN ('entretien', 'classe', 'conference', 'private_interview', 'classroom_live', 'conference_live', 'mentoring_session'));
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Colonnes recording
ALTER TABLE public.live_sessions ADD COLUMN IF NOT EXISTS recording_requested BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.live_sessions ADD COLUMN IF NOT EXISTS recording_status TEXT
  CHECK (recording_status IS NULL OR recording_status IN ('pending', 'recording', 'completed', 'failed'));
ALTER TABLE public.live_sessions ADD COLUMN IF NOT EXISTS recording_url TEXT;
ALTER TABLE public.live_sessions ADD COLUMN IF NOT EXISTS replay_available BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.live_sessions ADD COLUMN IF NOT EXISTS livekit_room_name TEXT;

-- 2) Étendre live_session_questions : question_type, options pour MCQ/poll
ALTER TABLE public.live_session_questions ADD COLUMN IF NOT EXISTS question_type TEXT NOT NULL DEFAULT 'open_question'
  CHECK (question_type IN ('open_question', 'mcq', 'quick_poll', 'exercise_prompt'));
ALTER TABLE public.live_session_questions ADD COLUMN IF NOT EXISTS options_json JSONB;
ALTER TABLE public.live_session_questions ADD COLUMN IF NOT EXISTS correct_answer_json JSONB;

-- 3) Étendre live_session_answers : answer_json pour MCQ/poll
ALTER TABLE public.live_session_answers ADD COLUMN IF NOT EXISTS answer_json JSONB;

-- 4) live_recordings (egress LiveKit)
CREATE TABLE IF NOT EXISTS public.live_recordings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  live_session_id UUID NOT NULL REFERENCES public.live_sessions(id) ON DELETE CASCADE,
  egress_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'recording', 'completed', 'failed')),
  output_url TEXT,
  duration_seconds INT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  raw_response JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_live_recordings_session ON public.live_recordings(live_session_id);

-- 5) live_webhook_events (événements LiveKit reçus)
CREATE TABLE IF NOT EXISTS public.live_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  room_name TEXT,
  live_session_id UUID REFERENCES public.live_sessions(id) ON DELETE SET NULL,
  payload JSONB NOT NULL,
  processed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_live_webhook_events_session ON public.live_webhook_events(live_session_id);
CREATE INDEX IF NOT EXISTS idx_live_webhook_events_created ON public.live_webhook_events(created_at DESC);

-- 6) audit_logs (audit des actions sensibles)
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id UUID,
  details JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON public.audit_logs(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON public.audit_logs(created_at DESC);

-- 7) Étendre appointment_requests status
DO $$
BEGIN
  ALTER TABLE public.appointment_requests DROP CONSTRAINT IF EXISTS appointment_requests_status_check;
  ALTER TABLE public.appointment_requests ADD CONSTRAINT appointment_requests_status_check
    CHECK (status IN ('pending', 'confirmed', 'cancelled', 'rescheduled', 'requested', 'pending_validation'));
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 8) Étendre appointments status
DO $$
BEGIN
  ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_status_check;
  ALTER TABLE public.appointments ADD CONSTRAINT appointments_status_check
    CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled', 'no_show', 'rescheduled', 'live_now', 'report_generated'));
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 9) RLS live_recordings
ALTER TABLE public.live_recordings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "live_recordings_read" ON public.live_recordings;
CREATE POLICY "live_recordings_read" ON public.live_recordings FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.live_sessions ls WHERE ls.id = live_session_id AND (ls.teacher_id = auth.uid() OR EXISTS (SELECT 1 FROM public.live_session_participants lp WHERE lp.live_session_id = ls.id AND lp.user_id = auth.uid())))
  OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND lower(COALESCE(p.role,'')) IN ('owner','admin','secretariat'))
);

-- 10) RLS live_webhook_events (lecture admin/owner uniquement)
ALTER TABLE public.live_webhook_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "live_webhook_events_admin_read" ON public.live_webhook_events;
CREATE POLICY "live_webhook_events_admin_read" ON public.live_webhook_events FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND lower(COALESCE(p.role,'')) IN ('owner','admin'))
);

-- Insert via service role (webhook handler)
DROP POLICY IF EXISTS "live_webhook_events_insert" ON public.live_webhook_events;
CREATE POLICY "live_webhook_events_insert" ON public.live_webhook_events FOR INSERT WITH CHECK (true);

-- 11) RLS audit_logs (lecture admin/owner)
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_logs_admin_read" ON public.audit_logs;
CREATE POLICY "audit_logs_admin_read" ON public.audit_logs FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND lower(COALESCE(p.role,'')) IN ('owner','admin'))
);

DROP POLICY IF EXISTS "audit_logs_insert" ON public.audit_logs;
CREATE POLICY "audit_logs_insert" ON public.audit_logs FOR INSERT WITH CHECK (true);

COMMENT ON TABLE public.live_recordings IS 'Enregistrements LiveKit Egress par session.';
COMMENT ON TABLE public.live_webhook_events IS 'Événements webhooks LiveKit reçus.';
COMMENT ON TABLE public.audit_logs IS 'Audit des actions sensibles (création room, token, bascule mode, etc.).';
