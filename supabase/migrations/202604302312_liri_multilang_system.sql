-- LIRI — Multilingue live + vidéo (pack liri_complete_multilang_system)
-- Sessions de traduction live, projets vidéo multilingues, journal d’usage (crédits).

CREATE TABLE IF NOT EXISTS public.liri_multilang_live_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  room_label text,
  source_lang text NOT NULL DEFAULT 'fr',
  target_langs text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'draft',
  credits_estimate integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT liri_multilang_live_sessions_status_chk CHECK (status = ANY (ARRAY['draft'::text, 'active'::text, 'ended'::text]))
);

CREATE TABLE IF NOT EXISTS public.liri_multilang_video_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  title text NOT NULL,
  source_lang text NOT NULL DEFAULT 'fr',
  target_langs text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'draft',
  credits_estimate integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT liri_multilang_video_projects_status_chk CHECK (status = ANY (ARRAY['draft'::text, 'processing'::text, 'ready'::text, 'error'::text]))
);

CREATE TABLE IF NOT EXISTS public.liri_multilang_usage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  event_type text NOT NULL,
  credits integer NOT NULL DEFAULT 0,
  ref_table text,
  ref_id uuid,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_liri_ml_live_user_created ON public.liri_multilang_live_sessions (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_liri_ml_video_user_created ON public.liri_multilang_video_projects (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_liri_ml_usage_user_created ON public.liri_multilang_usage_events (user_id, created_at DESC);

COMMENT ON TABLE public.liri_multilang_live_sessions IS 'LIRI — session traduction / voix live (langues cibles, estimation crédits).';
COMMENT ON TABLE public.liri_multilang_video_projects IS 'LIRI — projet export vidéo multilingue (designer pipeline).';
COMMENT ON TABLE public.liri_multilang_usage_events IS 'LIRI — événements facturation / traçabilité multilingue.';

ALTER TABLE public.liri_multilang_live_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.liri_multilang_video_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.liri_multilang_usage_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "liri_ml_live_select_own" ON public.liri_multilang_live_sessions;
CREATE POLICY "liri_ml_live_select_own"
ON public.liri_multilang_live_sessions FOR SELECT TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "liri_ml_live_insert_own" ON public.liri_multilang_live_sessions;
CREATE POLICY "liri_ml_live_insert_own"
ON public.liri_multilang_live_sessions FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "liri_ml_live_update_own" ON public.liri_multilang_live_sessions;
CREATE POLICY "liri_ml_live_update_own"
ON public.liri_multilang_live_sessions FOR UPDATE TO authenticated
USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "liri_ml_live_delete_own" ON public.liri_multilang_live_sessions;
CREATE POLICY "liri_ml_live_delete_own"
ON public.liri_multilang_live_sessions FOR DELETE TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "liri_ml_video_select_own" ON public.liri_multilang_video_projects;
CREATE POLICY "liri_ml_video_select_own"
ON public.liri_multilang_video_projects FOR SELECT TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "liri_ml_video_insert_own" ON public.liri_multilang_video_projects;
CREATE POLICY "liri_ml_video_insert_own"
ON public.liri_multilang_video_projects FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "liri_ml_video_update_own" ON public.liri_multilang_video_projects;
CREATE POLICY "liri_ml_video_update_own"
ON public.liri_multilang_video_projects FOR UPDATE TO authenticated
USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "liri_ml_video_delete_own" ON public.liri_multilang_video_projects;
CREATE POLICY "liri_ml_video_delete_own"
ON public.liri_multilang_video_projects FOR DELETE TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "liri_ml_usage_select_own" ON public.liri_multilang_usage_events;
CREATE POLICY "liri_ml_usage_select_own"
ON public.liri_multilang_usage_events FOR SELECT TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "liri_ml_usage_insert_own" ON public.liri_multilang_usage_events;
CREATE POLICY "liri_ml_usage_insert_own"
ON public.liri_multilang_usage_events FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.liri_multilang_live_sessions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.liri_multilang_video_projects TO authenticated;
GRANT SELECT, INSERT ON public.liri_multilang_usage_events TO authenticated;
