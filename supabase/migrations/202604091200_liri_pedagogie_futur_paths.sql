-- LIRI — Pédagogie du futur (pack liri_pedagogie_du_futur_complete)
-- Parcours scolaire : path → cours → modules → semaines → jours → blocs pédagogiques + replay + analytics.

CREATE TABLE IF NOT EXISTS public.school_paths (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  owner_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.path_courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  path_id uuid NOT NULL REFERENCES public.school_paths (id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  level text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.course_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.path_courses (id) ON DELETE CASCADE,
  title text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.module_weeks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id uuid NOT NULL REFERENCES public.course_modules (id) ON DELETE CASCADE,
  title text NOT NULL,
  grammar_key text,
  sort_order integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.week_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_id uuid NOT NULL REFERENCES public.module_weeks (id) ON DELETE CASCADE,
  day_number integer NOT NULL,
  title text NOT NULL,
  pedagogy_type text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.pedagogical_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  day_id uuid NOT NULL REFERENCES public.week_days (id) ON DELETE CASCADE,
  type text NOT NULL,
  title text,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  sort_order integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.replay_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  block_id uuid NOT NULL REFERENCES public.pedagogical_blocks (id) ON DELETE CASCADE,
  transcript jsonb DEFAULT '{}'::jsonb,
  summary text,
  chapters jsonb DEFAULT '[]'::jsonb,
  key_points jsonb DEFAULT '[]'::jsonb,
  quiz jsonb DEFAULT '[]'::jsonb,
  mindmap jsonb DEFAULT '{}'::jsonb,
  replay_version_student jsonb DEFAULT '{}'::jsonb,
  replay_version_teacher jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.learning_analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  path_id uuid REFERENCES public.school_paths (id) ON DELETE CASCADE,
  course_id uuid REFERENCES public.path_courses (id) ON DELETE CASCADE,
  learner_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  metric_key text NOT NULL,
  metric_value jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_path_courses_path_id ON public.path_courses (path_id);
CREATE INDEX IF NOT EXISTS idx_course_modules_course_id ON public.course_modules (course_id);
CREATE INDEX IF NOT EXISTS idx_module_weeks_module_id ON public.module_weeks (module_id);
CREATE INDEX IF NOT EXISTS idx_week_days_week_id ON public.week_days (week_id);
CREATE INDEX IF NOT EXISTS idx_pedagogical_blocks_day_id ON public.pedagogical_blocks (day_id);
CREATE INDEX IF NOT EXISTS idx_replay_assets_block_id ON public.replay_assets (block_id);
CREATE INDEX IF NOT EXISTS idx_learning_analytics_path_learner ON public.learning_analytics (path_id, learner_id);

COMMENT ON TABLE public.school_paths IS 'Parcours scolaire LIRI — propriétaire = créateur / organisme.';
COMMENT ON TABLE public.pedagogical_blocks IS 'Blocs canoniques (previsualisation_video, opening_live, smartboard_session, …).';

-- RLS — tout le sous-arbre suit le propriétaire du parcours.

ALTER TABLE public.school_paths ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.path_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.module_weeks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.week_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedagogical_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.replay_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_analytics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "school_paths_select_own" ON public.school_paths;
CREATE POLICY "school_paths_select_own"
ON public.school_paths FOR SELECT TO authenticated
USING (owner_id = auth.uid());

DROP POLICY IF EXISTS "school_paths_insert_own" ON public.school_paths;
CREATE POLICY "school_paths_insert_own"
ON public.school_paths FOR INSERT TO authenticated
WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "school_paths_update_own" ON public.school_paths;
CREATE POLICY "school_paths_update_own"
ON public.school_paths FOR UPDATE TO authenticated
USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "school_paths_delete_own" ON public.school_paths;
CREATE POLICY "school_paths_delete_own"
ON public.school_paths FOR DELETE TO authenticated
USING (owner_id = auth.uid());

DROP POLICY IF EXISTS "path_courses_rw_under_path" ON public.path_courses;
CREATE POLICY "path_courses_rw_under_path"
ON public.path_courses FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.school_paths sp WHERE sp.id = path_courses.path_id AND sp.owner_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.school_paths sp WHERE sp.id = path_courses.path_id AND sp.owner_id = auth.uid()));

DROP POLICY IF EXISTS "course_modules_rw_under_path" ON public.course_modules;
CREATE POLICY "course_modules_rw_under_path"
ON public.course_modules FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.path_courses pc
  JOIN public.school_paths sp ON sp.id = pc.path_id
  WHERE pc.id = course_modules.course_id AND sp.owner_id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.path_courses pc
  JOIN public.school_paths sp ON sp.id = pc.path_id
  WHERE pc.id = course_modules.course_id AND sp.owner_id = auth.uid()
));

DROP POLICY IF EXISTS "module_weeks_rw_under_path" ON public.module_weeks;
CREATE POLICY "module_weeks_rw_under_path"
ON public.module_weeks FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.course_modules cm
  JOIN public.path_courses pc ON pc.id = cm.course_id
  JOIN public.school_paths sp ON sp.id = pc.path_id
  WHERE cm.id = module_weeks.module_id AND sp.owner_id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.course_modules cm
  JOIN public.path_courses pc ON pc.id = cm.course_id
  JOIN public.school_paths sp ON sp.id = pc.path_id
  WHERE cm.id = module_weeks.module_id AND sp.owner_id = auth.uid()
));

DROP POLICY IF EXISTS "week_days_rw_under_path" ON public.week_days;
CREATE POLICY "week_days_rw_under_path"
ON public.week_days FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.module_weeks mw
  JOIN public.course_modules cm ON cm.id = mw.module_id
  JOIN public.path_courses pc ON pc.id = cm.course_id
  JOIN public.school_paths sp ON sp.id = pc.path_id
  WHERE mw.id = week_days.week_id AND sp.owner_id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.module_weeks mw
  JOIN public.course_modules cm ON cm.id = mw.module_id
  JOIN public.path_courses pc ON pc.id = cm.course_id
  JOIN public.school_paths sp ON sp.id = pc.path_id
  WHERE mw.id = week_days.week_id AND sp.owner_id = auth.uid()
));

DROP POLICY IF EXISTS "pedagogical_blocks_rw_under_path" ON public.pedagogical_blocks;
CREATE POLICY "pedagogical_blocks_rw_under_path"
ON public.pedagogical_blocks FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.week_days wd
  JOIN public.module_weeks mw ON mw.id = wd.week_id
  JOIN public.course_modules cm ON cm.id = mw.module_id
  JOIN public.path_courses pc ON pc.id = cm.course_id
  JOIN public.school_paths sp ON sp.id = pc.path_id
  WHERE wd.id = pedagogical_blocks.day_id AND sp.owner_id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.week_days wd
  JOIN public.module_weeks mw ON mw.id = wd.week_id
  JOIN public.course_modules cm ON cm.id = mw.module_id
  JOIN public.path_courses pc ON pc.id = cm.course_id
  JOIN public.school_paths sp ON sp.id = pc.path_id
  WHERE wd.id = pedagogical_blocks.day_id AND sp.owner_id = auth.uid()
));

DROP POLICY IF EXISTS "replay_assets_rw_under_path" ON public.replay_assets;
CREATE POLICY "replay_assets_rw_under_path"
ON public.replay_assets FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.pedagogical_blocks pb
  JOIN public.week_days wd ON wd.id = pb.day_id
  JOIN public.module_weeks mw ON mw.id = wd.week_id
  JOIN public.course_modules cm ON cm.id = mw.module_id
  JOIN public.path_courses pc ON pc.id = cm.course_id
  JOIN public.school_paths sp ON sp.id = pc.path_id
  WHERE pb.id = replay_assets.block_id AND sp.owner_id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.pedagogical_blocks pb
  JOIN public.week_days wd ON wd.id = pb.day_id
  JOIN public.module_weeks mw ON mw.id = wd.week_id
  JOIN public.course_modules cm ON cm.id = mw.module_id
  JOIN public.path_courses pc ON pc.id = cm.course_id
  JOIN public.school_paths sp ON sp.id = pc.path_id
  WHERE pb.id = replay_assets.block_id AND sp.owner_id = auth.uid()
));

DROP POLICY IF EXISTS "learning_analytics_select" ON public.learning_analytics;
CREATE POLICY "learning_analytics_select"
ON public.learning_analytics FOR SELECT TO authenticated
USING (
  learner_id = auth.uid()
  OR (path_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.school_paths sp WHERE sp.id = learning_analytics.path_id AND sp.owner_id = auth.uid()))
);

DROP POLICY IF EXISTS "learning_analytics_insert_self" ON public.learning_analytics;
CREATE POLICY "learning_analytics_insert_self"
ON public.learning_analytics FOR INSERT TO authenticated
WITH CHECK (learner_id = auth.uid());

DROP POLICY IF EXISTS "learning_analytics_update" ON public.learning_analytics;
CREATE POLICY "learning_analytics_update"
ON public.learning_analytics FOR UPDATE TO authenticated
USING (learner_id = auth.uid())
WITH CHECK (learner_id = auth.uid());

DROP POLICY IF EXISTS "learning_analytics_delete" ON public.learning_analytics;
CREATE POLICY "learning_analytics_delete"
ON public.learning_analytics FOR DELETE TO authenticated
USING (learner_id = auth.uid());
