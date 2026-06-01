-- ============================================================
-- PRORASCIENCE — Système complet Booking + Live Sessions
-- Architecture modulaire, rôles respectés
-- ============================================================

-- 1) availability_slots (disponibilités enseignant/conseiller)
CREATE TABLE IF NOT EXISTS public.availability_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_recurring BOOLEAN NOT NULL DEFAULT true,
  valid_from DATE,
  valid_until DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_availability_slots_user ON public.availability_slots(user_id);

-- 2) live_sessions (salles virtuelles, appointment_id ajouté après création appointments)
CREATE TABLE IF NOT EXISTS public.live_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID,
  formation_id UUID REFERENCES public.formations(id) ON DELETE SET NULL,
  teacher_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  session_type TEXT NOT NULL DEFAULT 'classe'
    CHECK (session_type IN ('entretien', 'classe', 'conference')),
  scheduled_at TIMESTAMPTZ NOT NULL,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  visibility_mode TEXT NOT NULL DEFAULT 'secret'
    CHECK (visibility_mode IN ('secret', 'public')),
  video_room_id TEXT,
  video_room_url TEXT,
  video_provider TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'live', 'ended', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_live_sessions_teacher ON public.live_sessions(teacher_id);
CREATE INDEX IF NOT EXISTS idx_live_sessions_scheduled ON public.live_sessions(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_live_sessions_status ON public.live_sessions(status);

-- 3) appointments (rendez-vous confirmés, après live_sessions pour FK)
CREATE TABLE IF NOT EXISTS public.appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_request_id UUID REFERENCES public.appointment_requests(id) ON DELETE SET NULL,
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  teacher_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  type TEXT NOT NULL DEFAULT 'entretien'
    CHECK (type IN ('entretien', 'coaching', 'conseil', 'classe', 'conference')),
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_minutes INT NOT NULL DEFAULT 30,
  status TEXT NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled', 'no_show', 'rescheduled')),
  live_session_id UUID REFERENCES public.live_sessions(id) ON DELETE SET NULL,
  video_meeting_url TEXT,
  video_meeting_id TEXT,
  notes TEXT,
  cancelled_at TIMESTAMPTZ,
  cancelled_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_appointments_student ON public.appointments(student_id);
CREATE INDEX IF NOT EXISTS idx_appointments_teacher ON public.appointments(teacher_id);
CREATE INDEX IF NOT EXISTS idx_appointments_scheduled ON public.appointments(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON public.appointments(status);

-- Lien live_sessions -> appointments (FK différée)
ALTER TABLE public.live_sessions DROP CONSTRAINT IF EXISTS live_sessions_appointment_id_fkey;
ALTER TABLE public.live_sessions ADD CONSTRAINT live_sessions_appointment_id_fkey
  FOREIGN KEY (appointment_id) REFERENCES public.appointments(id) ON DELETE SET NULL;

-- 4) live_session_participants
CREATE TABLE IF NOT EXISTS public.live_session_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  live_session_id UUID NOT NULL REFERENCES public.live_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'student'
    CHECK (role IN ('host', 'moderator', 'student')),
  joined_at TIMESTAMPTZ,
  left_at TIMESTAMPTZ,
  hand_raised_at TIMESTAMPTZ,
  is_visible_to_others BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(live_session_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_live_participants_session ON public.live_session_participants(live_session_id);
CREATE INDEX IF NOT EXISTS idx_live_participants_user ON public.live_session_participants(user_id);

-- 5) live_session_questions (questions du prof affichées)
CREATE TABLE IF NOT EXISTS public.live_session_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  live_session_id UUID NOT NULL REFERENCES public.live_sessions(id) ON DELETE CASCADE,
  asked_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_live_questions_session ON public.live_session_questions(live_session_id);

-- 6) live_session_answers (réponses des élèves)
CREATE TABLE IF NOT EXISTS public.live_session_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES public.live_session_questions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  answer_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_live_answers_question ON public.live_session_answers(question_id);

-- 7) live_session_chat (messagerie modérée)
CREATE TABLE IF NOT EXISTS public.live_session_chat (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  live_session_id UUID NOT NULL REFERENCES public.live_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  is_moderated BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_live_chat_session ON public.live_session_chat(live_session_id);

-- 8) hand_raise_events
CREATE TABLE IF NOT EXISTS public.hand_raise_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  live_session_id UUID NOT NULL REFERENCES public.live_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  raised_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  lowered_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_hand_raise_session ON public.hand_raise_events(live_session_id);

-- 9) live_transcripts (transcription brute)
CREATE TABLE IF NOT EXISTS public.live_transcripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  live_session_id UUID NOT NULL REFERENCES public.live_sessions(id) ON DELETE CASCADE,
  content TEXT,
  raw_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_live_transcripts_session ON public.live_transcripts(live_session_id);

-- 10) live_summaries (résumé IA)
CREATE TABLE IF NOT EXISTS public.live_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  live_session_id UUID NOT NULL REFERENCES public.live_sessions(id) ON DELETE CASCADE,
  summary_text TEXT,
  main_themes JSONB,
  key_points JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_live_summaries_session ON public.live_summaries(live_session_id);

-- 11) live_mindmaps (mindmap IA)
CREATE TABLE IF NOT EXISTS public.live_mindmaps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  live_session_id UUID NOT NULL REFERENCES public.live_sessions(id) ON DELETE CASCADE,
  mindmap_data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_live_mindmaps_session ON public.live_mindmaps(live_session_id);

-- 12) student_live_reports (compte rendu par élève)
CREATE TABLE IF NOT EXISTS public.student_live_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  live_session_id UUID NOT NULL REFERENCES public.live_sessions(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  report_text TEXT,
  summary_id UUID REFERENCES public.live_summaries(id) ON DELETE SET NULL,
  mindmap_id UUID REFERENCES public.live_mindmaps(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(live_session_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_student_reports_session ON public.student_live_reports(live_session_id);
CREATE INDEX IF NOT EXISTS idx_student_reports_student ON public.student_live_reports(student_id);

-- 13) RLS - appointments
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  DROP POLICY IF EXISTS "appointments_read" ON public.appointments;
  DROP POLICY IF EXISTS "appointments_insert" ON public.appointments;
  DROP POLICY IF EXISTS "appointments_update" ON public.appointments;
  DROP POLICY IF EXISTS "availability_read" ON public.availability_slots;
  DROP POLICY IF EXISTS "availability_manage" ON public.availability_slots;
  DROP POLICY IF EXISTS "live_sessions_read" ON public.live_sessions;
  DROP POLICY IF EXISTS "live_sessions_insert" ON public.live_sessions;
  DROP POLICY IF EXISTS "live_sessions_update" ON public.live_sessions;
  DROP POLICY IF EXISTS "live_participants_read" ON public.live_session_participants;
  DROP POLICY IF EXISTS "live_participants_insert" ON public.live_session_participants;
  DROP POLICY IF EXISTS "live_participants_update" ON public.live_session_participants;
  DROP POLICY IF EXISTS "live_questions_all" ON public.live_session_questions;
  DROP POLICY IF EXISTS "live_answers_read" ON public.live_session_answers;
  DROP POLICY IF EXISTS "live_answers_insert" ON public.live_session_answers;
  DROP POLICY IF EXISTS "live_chat_read" ON public.live_session_chat;
  DROP POLICY IF EXISTS "live_chat_insert" ON public.live_session_chat;
  DROP POLICY IF EXISTS "live_chat_delete" ON public.live_session_chat;
  DROP POLICY IF EXISTS "hand_raise_all" ON public.hand_raise_events;
  DROP POLICY IF EXISTS "live_transcripts_read" ON public.live_transcripts;
  DROP POLICY IF EXISTS "live_summaries_read" ON public.live_summaries;
  DROP POLICY IF EXISTS "live_mindmaps_read" ON public.live_mindmaps;
  DROP POLICY IF EXISTS "student_reports_read" ON public.student_live_reports;
END $$;

CREATE POLICY "appointments_read" ON public.appointments FOR SELECT USING (
  student_id = auth.uid() OR teacher_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND lower(COALESCE(p.role,'')) IN ('owner','admin','secretariat'))
);

CREATE POLICY "appointments_insert" ON public.appointments FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND lower(COALESCE(p.role,'')) IN ('owner','admin','secretariat','teacher'))
);

CREATE POLICY "appointments_update" ON public.appointments FOR UPDATE USING (
  teacher_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND lower(COALESCE(p.role,'')) IN ('owner','admin','secretariat'))
);

-- 15) RLS - availability_slots
ALTER TABLE public.availability_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "availability_read" ON public.availability_slots FOR SELECT USING (
  user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND lower(COALESCE(p.role,'')) IN ('owner','admin','secretariat'))
);

CREATE POLICY "availability_manage" ON public.availability_slots FOR ALL USING (
  user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND lower(COALESCE(p.role,'')) IN ('owner','admin','secretariat'))
);

-- 16) RLS - live_sessions
ALTER TABLE public.live_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "live_sessions_read" ON public.live_sessions FOR SELECT USING (
  teacher_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND lower(COALESCE(p.role,'')) IN ('owner','admin','secretariat'))
  OR EXISTS (SELECT 1 FROM public.live_session_participants lp WHERE lp.live_session_id = live_sessions.id AND lp.user_id = auth.uid())
);

CREATE POLICY "live_sessions_insert" ON public.live_sessions FOR INSERT WITH CHECK (
  teacher_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND lower(COALESCE(p.role,'')) IN ('owner','admin','secretariat'))
);

CREATE POLICY "live_sessions_update" ON public.live_sessions FOR UPDATE USING (
  teacher_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND lower(COALESCE(p.role,'')) IN ('owner','admin','secretariat'))
);

-- 17) RLS - live_session_participants
ALTER TABLE public.live_session_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "live_participants_read" ON public.live_session_participants FOR SELECT USING (
  user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.live_sessions ls WHERE ls.id = live_session_id AND ls.teacher_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND lower(COALESCE(p.role,'')) IN ('owner','admin','secretariat'))
);

CREATE POLICY "live_participants_insert" ON public.live_session_participants FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND lower(COALESCE(p.role,'')) IN ('owner','admin','secretariat','teacher'))
);

CREATE POLICY "live_participants_update" ON public.live_session_participants FOR UPDATE USING (
  user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.live_sessions ls WHERE ls.id = live_session_id AND ls.teacher_id = auth.uid())
);

-- 18) RLS - live_session_questions, answers, chat, hand_raise
ALTER TABLE public.live_session_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_session_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_session_chat ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hand_raise_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "live_questions_all" ON public.live_session_questions FOR ALL USING (
  EXISTS (SELECT 1 FROM public.live_sessions ls WHERE ls.id = live_session_id AND (ls.teacher_id = auth.uid() OR EXISTS (SELECT 1 FROM public.live_session_participants lp WHERE lp.live_session_id = ls.id AND lp.user_id = auth.uid())))
);

CREATE POLICY "live_answers_read" ON public.live_session_answers FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.live_session_questions q, public.live_sessions ls WHERE q.id = question_id AND ls.id = q.live_session_id AND (ls.teacher_id = auth.uid() OR EXISTS (SELECT 1 FROM public.live_session_participants lp WHERE lp.live_session_id = ls.id AND lp.user_id = auth.uid())))
);

CREATE POLICY "live_answers_insert" ON public.live_session_answers FOR INSERT WITH CHECK (
  user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.live_session_questions q, public.live_sessions ls WHERE q.id = question_id AND ls.id = q.live_session_id AND (ls.teacher_id = auth.uid() OR EXISTS (SELECT 1 FROM public.live_session_participants lp WHERE lp.live_session_id = ls.id AND lp.user_id = auth.uid())))
);

-- Simplified: participants can read/write chat
CREATE POLICY "live_chat_read" ON public.live_session_chat FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.live_session_participants lp WHERE lp.live_session_id = live_session_chat.live_session_id AND lp.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.live_sessions ls WHERE ls.id = live_session_chat.live_session_id AND ls.teacher_id = auth.uid())
);

CREATE POLICY "live_chat_insert" ON public.live_session_chat FOR INSERT WITH CHECK (
  user_id = auth.uid()
  AND (EXISTS (SELECT 1 FROM public.live_session_participants lp WHERE lp.live_session_id = live_session_chat.live_session_id AND lp.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.live_sessions ls WHERE ls.id = live_session_chat.live_session_id AND ls.teacher_id = auth.uid()))
);

CREATE POLICY "live_chat_delete" ON public.live_session_chat FOR DELETE USING (
  user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.live_sessions ls WHERE ls.id = live_session_chat.live_session_id AND ls.teacher_id = auth.uid())
);

CREATE POLICY "hand_raise_all" ON public.hand_raise_events FOR ALL USING (
  user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.live_sessions ls WHERE ls.id = live_session_id AND ls.teacher_id = auth.uid())
);

-- 19) RLS - transcripts, summaries, mindmaps, student_reports
ALTER TABLE public.live_transcripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_mindmaps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_live_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "live_transcripts_read" ON public.live_transcripts FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.live_sessions ls WHERE ls.id = live_session_id AND ls.teacher_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND lower(COALESCE(p.role,'')) IN ('owner','admin','secretariat'))
);

CREATE POLICY "live_summaries_read" ON public.live_summaries FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.live_sessions ls WHERE ls.id = live_session_id AND (ls.teacher_id = auth.uid() OR EXISTS (SELECT 1 FROM public.live_session_participants lp WHERE lp.live_session_id = ls.id AND lp.user_id = auth.uid())))
);

CREATE POLICY "live_mindmaps_read" ON public.live_mindmaps FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.live_sessions ls WHERE ls.id = live_session_id AND (ls.teacher_id = auth.uid() OR EXISTS (SELECT 1 FROM public.live_session_participants lp WHERE lp.live_session_id = ls.id AND lp.user_id = auth.uid())))
);

CREATE POLICY "student_reports_read" ON public.student_live_reports FOR SELECT USING (
  student_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.live_sessions ls WHERE ls.id = live_session_id AND ls.teacher_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND lower(COALESCE(p.role,'')) IN ('owner','admin','secretariat'))
);

-- 20) Triggers updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_appointments_updated ON public.appointments;
CREATE TRIGGER trg_appointments_updated BEFORE UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_live_sessions_updated ON public.live_sessions;
CREATE TRIGGER trg_live_sessions_updated BEFORE UPDATE ON public.live_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 21) Étendre appointment_requests status
DO $$
BEGIN
  ALTER TABLE public.appointment_requests DROP CONSTRAINT IF EXISTS appointment_requests_status_check;
  ALTER TABLE public.appointment_requests ADD CONSTRAINT appointment_requests_status_check
    CHECK (status IN ('pending', 'confirmed', 'cancelled', 'rescheduled'));
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

COMMENT ON TABLE public.appointments IS 'Rendez-vous confirmés, unifiés (entretien, coaching, classe, conférence).';
COMMENT ON TABLE public.availability_slots IS 'Disponibilités des enseignants/conseillers pour la réservation.';
COMMENT ON TABLE public.live_sessions IS 'Salles virtuelles (entretien, classe, conférence) avec mode secret/public.';
COMMENT ON TABLE public.live_session_participants IS 'Participants aux lives, is_visible_to_others = mode secret.';
COMMENT ON TABLE public.student_live_reports IS 'Compte rendu IA post-session par élève.';
