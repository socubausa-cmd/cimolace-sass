-- ============================================================
-- Live immersif « production » — étend le booking live existant
-- sans casser immersive_live_* (messagerie) ni live_sessions (RDV).
-- Nouvelles tables : blueprints, scènes production, contenus, rapports, replay jobs.
-- ============================================================

-- 1) Lien optionnel vers une session messagerie immersive + méta production
ALTER TABLE public.live_sessions
  ADD COLUMN IF NOT EXISTS immersive_live_session_id UUID REFERENCES public.immersive_live_sessions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_live_sessions_immersive_link
  ON public.live_sessions(immersive_live_session_id)
  WHERE immersive_live_session_id IS NOT NULL;

ALTER TABLE public.live_sessions
  ADD COLUMN IF NOT EXISTS production_live_type TEXT;

COMMENT ON COLUMN public.live_sessions.production_live_type IS
  'Type produit : cours, conference, entretien, coaching, culte, priere, etc. (libre)';

ALTER TABLE public.live_sessions
  ADD COLUMN IF NOT EXISTS production_category TEXT;

ALTER TABLE public.live_sessions
  ADD COLUMN IF NOT EXISTS room_mode TEXT NOT NULL DEFAULT 'secret_classroom';

COMMENT ON COLUMN public.live_sessions.room_mode IS
  'secret_classroom, public, focus, guided, prayer, healing, ceremony, ...';

ALTER TABLE public.live_sessions
  ADD COLUMN IF NOT EXISTS preparation_status TEXT NOT NULL DEFAULT 'draft'
    CHECK (preparation_status IN ('draft', 'blueprint', 'scenes', 'content', 'ready', 'live', 'archived'));

ALTER TABLE public.live_sessions
  ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'Europe/Paris';

ALTER TABLE public.live_sessions
  ADD COLUMN IF NOT EXISTS access_mode TEXT NOT NULL DEFAULT 'invite_only'
    CHECK (access_mode IN ('private', 'public', 'invite_only', 'password', 'manual_gate'));

ALTER TABLE public.live_sessions
  ADD COLUMN IF NOT EXISTS access_password_hash TEXT;

ALTER TABLE public.live_sessions
  ADD COLUMN IF NOT EXISTS interaction_script_json JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.live_sessions
  ADD COLUMN IF NOT EXISTS scheduling_json JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.live_sessions
  ADD COLUMN IF NOT EXISTS ai_prep_json JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.live_sessions
  ADD COLUMN IF NOT EXISTS engagement_snapshot_json JSONB NOT NULL DEFAULT '{}'::jsonb;

-- 2) Blueprint (plan de live)
CREATE TABLE IF NOT EXISTS public.live_blueprints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  live_session_id UUID NOT NULL REFERENCES public.live_sessions(id) ON DELETE CASCADE,
  outline_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  goals_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  key_points_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  private_notes TEXT,
  estimated_duration_minutes INT,
  blueprint_score NUMERIC(5,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(live_session_id)
);

CREATE INDEX IF NOT EXISTS idx_live_blueprints_session ON public.live_blueprints(live_session_id);

-- 3) Scènes « production » (distinct de immersive_live_slides messagerie)
CREATE TABLE IF NOT EXISTS public.live_scenes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  live_session_id UUID NOT NULL REFERENCES public.live_sessions(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Scène',
  scene_type TEXT NOT NULL DEFAULT 'camera_only',
  order_index INT NOT NULL DEFAULT 0,
  content_payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_preset BOOLEAN NOT NULL DEFAULT false,
  preset_name TEXT,
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_live_scenes_session_order ON public.live_scenes(live_session_id, order_index);

-- 4) Contenus injectables
CREATE TABLE IF NOT EXISTS public.live_contents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  live_session_id UUID NOT NULL REFERENCES public.live_sessions(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL DEFAULT 'text',
  title TEXT,
  asset_url TEXT,
  content_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_live_contents_session ON public.live_contents(live_session_id);

-- 5) Questions : extension
ALTER TABLE public.live_session_questions
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE public.live_session_questions
  ADD COLUMN IF NOT EXISTS prompt TEXT;

UPDATE public.live_session_questions SET prompt = question_text WHERE prompt IS NULL;

-- 6) Chat : scope
ALTER TABLE public.live_session_chat
  ADD COLUMN IF NOT EXISTS target_scope TEXT NOT NULL DEFAULT 'public'
    CHECK (target_scope IN ('public', 'private', 'host_only', 'support', 'moderators'));

-- 7) Transcription
ALTER TABLE public.live_transcripts
  ADD COLUMN IF NOT EXISTS transcript_json JSONB;

ALTER TABLE public.live_transcripts
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'ready', 'failed'));

-- 8) Participants : rôles élargis (hors profil global)
ALTER TABLE public.live_session_participants DROP CONSTRAINT IF EXISTS live_session_participants_role_check;
ALTER TABLE public.live_session_participants ADD CONSTRAINT live_session_participants_role_check
  CHECK (role IN (
    'host', 'co_host', 'moderator', 'student', 'participant',
    'patient', 'visitor', 'priest'
  ));

ALTER TABLE public.live_session_participants
  ADD COLUMN IF NOT EXISTS hand_raised BOOLEAN NOT NULL DEFAULT false;

-- 9) Rapports post-live génériques
CREATE TABLE IF NOT EXISTS public.live_session_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  live_session_id UUID NOT NULL REFERENCES public.live_sessions(id) ON DELETE CASCADE,
  report_type TEXT NOT NULL DEFAULT 'session',
  report_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_live_session_reports_session ON public.live_session_reports(live_session_id);

-- 10) Jobs replay enrichi
CREATE TABLE IF NOT EXISTS public.replay_augmentation_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  live_session_id UUID NOT NULL REFERENCES public.live_sessions(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
  output_url TEXT,
  error_message TEXT,
  meta_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_replay_jobs_session ON public.replay_augmentation_jobs(live_session_id);

-- Triggers updated_at (réutilise public.set_updated_at définie dans le booking live)
DROP TRIGGER IF EXISTS trg_live_blueprints_updated ON public.live_blueprints;
CREATE TRIGGER trg_live_blueprints_updated
  BEFORE UPDATE ON public.live_blueprints
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_live_scenes_updated ON public.live_scenes;
CREATE TRIGGER trg_live_scenes_updated
  BEFORE UPDATE ON public.live_scenes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_live_contents_updated ON public.live_contents;
CREATE TRIGGER trg_live_contents_updated
  BEFORE UPDATE ON public.live_contents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_replay_jobs_updated ON public.replay_augmentation_jobs;
CREATE TRIGGER trg_replay_jobs_updated
  BEFORE UPDATE ON public.replay_augmentation_jobs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ========== RLS ==========
ALTER TABLE public.live_blueprints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_scenes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_contents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_session_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.replay_augmentation_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "live_blueprints_teacher" ON public.live_blueprints;
CREATE POLICY "live_blueprints_teacher"
  ON public.live_blueprints FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.live_sessions ls
      WHERE ls.id = live_blueprints.live_session_id
        AND (ls.teacher_id = auth.uid()
          OR EXISTS (SELECT 1 FROM public.live_session_participants lp
            WHERE lp.live_session_id = ls.id AND lp.user_id = auth.uid()
              AND lp.role IN ('host', 'co_host', 'moderator')))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.live_sessions ls
      WHERE ls.id = live_blueprints.live_session_id
        AND (ls.teacher_id = auth.uid()
          OR EXISTS (SELECT 1 FROM public.live_session_participants lp
            WHERE lp.live_session_id = ls.id AND lp.user_id = auth.uid()
              AND lp.role IN ('host', 'co_host', 'moderator')))
    )
  );

DROP POLICY IF EXISTS "live_blueprints_participant_read" ON public.live_blueprints;
CREATE POLICY "live_blueprints_participant_read"
  ON public.live_blueprints FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.live_sessions ls
      WHERE ls.id = live_blueprints.live_session_id
        AND EXISTS (SELECT 1 FROM public.live_session_participants lp
          WHERE lp.live_session_id = ls.id AND lp.user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "live_scenes_teacher" ON public.live_scenes;
CREATE POLICY "live_scenes_teacher"
  ON public.live_scenes FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.live_sessions ls
      WHERE ls.id = live_scenes.live_session_id
        AND (ls.teacher_id = auth.uid()
          OR EXISTS (SELECT 1 FROM public.live_session_participants lp
            WHERE lp.live_session_id = ls.id AND lp.user_id = auth.uid()
              AND lp.role IN ('host', 'co_host', 'moderator')))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.live_sessions ls
      WHERE ls.id = live_scenes.live_session_id
        AND (ls.teacher_id = auth.uid()
          OR EXISTS (SELECT 1 FROM public.live_session_participants lp
            WHERE lp.live_session_id = ls.id AND lp.user_id = auth.uid()
              AND lp.role IN ('host', 'co_host', 'moderator')))
    )
  );

DROP POLICY IF EXISTS "live_scenes_participant_read" ON public.live_scenes;
CREATE POLICY "live_scenes_participant_read"
  ON public.live_scenes FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.live_sessions ls
      WHERE ls.id = live_scenes.live_session_id
        AND EXISTS (SELECT 1 FROM public.live_session_participants lp
          WHERE lp.live_session_id = ls.id AND lp.user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "live_contents_teacher" ON public.live_contents;
CREATE POLICY "live_contents_teacher"
  ON public.live_contents FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.live_sessions ls
      WHERE ls.id = live_contents.live_session_id
        AND (ls.teacher_id = auth.uid()
          OR EXISTS (SELECT 1 FROM public.live_session_participants lp
            WHERE lp.live_session_id = ls.id AND lp.user_id = auth.uid()
              AND lp.role IN ('host', 'co_host', 'moderator')))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.live_sessions ls
      WHERE ls.id = live_contents.live_session_id
        AND (ls.teacher_id = auth.uid()
          OR EXISTS (SELECT 1 FROM public.live_session_participants lp
            WHERE lp.live_session_id = ls.id AND lp.user_id = auth.uid()
              AND lp.role IN ('host', 'co_host', 'moderator')))
    )
  );

DROP POLICY IF EXISTS "live_contents_participant_read" ON public.live_contents;
CREATE POLICY "live_contents_participant_read"
  ON public.live_contents FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.live_sessions ls
      WHERE ls.id = live_contents.live_session_id
        AND EXISTS (SELECT 1 FROM public.live_session_participants lp
          WHERE lp.live_session_id = ls.id AND lp.user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "live_session_reports_read" ON public.live_session_reports;
CREATE POLICY "live_session_reports_read"
  ON public.live_session_reports FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.live_sessions ls
      WHERE ls.id = live_session_reports.live_session_id
        AND (ls.teacher_id = auth.uid()
          OR EXISTS (SELECT 1 FROM public.live_session_participants lp
            WHERE lp.live_session_id = ls.id AND lp.user_id = auth.uid()))
    )
  );

DROP POLICY IF EXISTS "live_session_reports_teacher_write" ON public.live_session_reports;
CREATE POLICY "live_session_reports_teacher_write"
  ON public.live_session_reports FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.live_sessions ls
      WHERE ls.id = live_session_reports.live_session_id
        AND ls.teacher_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "replay_jobs_read" ON public.replay_augmentation_jobs;
CREATE POLICY "replay_jobs_read"
  ON public.replay_augmentation_jobs FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.live_sessions ls
      WHERE ls.id = replay_augmentation_jobs.live_session_id
        AND (ls.teacher_id = auth.uid()
          OR EXISTS (SELECT 1 FROM public.live_session_participants lp
            WHERE lp.live_session_id = ls.id AND lp.user_id = auth.uid()))
    )
  );

DROP POLICY IF EXISTS "replay_jobs_teacher_write" ON public.replay_augmentation_jobs;
CREATE POLICY "replay_jobs_teacher_write"
  ON public.replay_augmentation_jobs FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.live_sessions ls
      WHERE ls.id = replay_augmentation_jobs.live_session_id
        AND ls.teacher_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.live_sessions ls
      WHERE ls.id = replay_augmentation_jobs.live_session_id
        AND ls.teacher_id = auth.uid()
    )
  );

COMMENT ON TABLE public.live_blueprints IS 'Plan de live (chapitres, objectifs, notes) — Live Preparation Studio';
COMMENT ON TABLE public.live_scenes IS 'Scènes production (ordre, type, payload) — Scene Composer';
COMMENT ON TABLE public.live_contents IS 'Contenus injectables pendant le live';
