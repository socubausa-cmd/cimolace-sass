-- Workspaces SmartBoard + LIRI Course Copilot (JSON bundle) par utilisateur authentifié.

CREATE TABLE IF NOT EXISTS public.liri_course_workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Sans titre',
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_liri_course_workspaces_user_updated
  ON public.liri_course_workspaces (user_id, updated_at DESC);

COMMENT ON TABLE public.liri_course_workspaces IS 'Bundle Konva + Copilot (format liri-course-workspace-v1) — une ligne par brouillon cloud.';

ALTER TABLE public.liri_course_workspaces ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "liri_course_workspaces_select_own" ON public.liri_course_workspaces;
CREATE POLICY "liri_course_workspaces_select_own"
ON public.liri_course_workspaces
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "liri_course_workspaces_insert_own" ON public.liri_course_workspaces;
CREATE POLICY "liri_course_workspaces_insert_own"
ON public.liri_course_workspaces
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "liri_course_workspaces_update_own" ON public.liri_course_workspaces;
CREATE POLICY "liri_course_workspaces_update_own"
ON public.liri_course_workspaces
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "liri_course_workspaces_delete_own" ON public.liri_course_workspaces;
CREATE POLICY "liri_course_workspaces_delete_own"
ON public.liri_course_workspaces
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS trg_liri_course_workspaces_updated_at ON public.liri_course_workspaces;
CREATE TRIGGER trg_liri_course_workspaces_updated_at
  BEFORE UPDATE ON public.liri_course_workspaces
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
