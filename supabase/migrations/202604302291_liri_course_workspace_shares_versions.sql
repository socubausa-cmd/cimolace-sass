-- Partage de workspaces (viewer / éditeur) + historique de versions (payload JSON).

-- Empêche tout changement de propriétaire (même via API).
CREATE OR REPLACE FUNCTION public.liri_course_workspace_prevent_owner_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'liri_course_workspace: changement de propriétaire interdit';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_liri_course_workspace_lock_owner ON public.liri_course_workspaces;
CREATE TRIGGER trg_liri_course_workspace_lock_owner
  BEFORE UPDATE ON public.liri_course_workspaces
  FOR EACH ROW
  EXECUTE FUNCTION public.liri_course_workspace_prevent_owner_change();

-- ─── Partages ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.liri_course_workspace_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.liri_course_workspaces (id) ON DELETE CASCADE,
  grantee_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('viewer', 'editor')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, grantee_id)
);

CREATE INDEX IF NOT EXISTS idx_liri_course_workspace_shares_grantee
  ON public.liri_course_workspace_shares (grantee_id);

CREATE INDEX IF NOT EXISTS idx_liri_course_workspace_shares_workspace
  ON public.liri_course_workspace_shares (workspace_id);

COMMENT ON TABLE public.liri_course_workspace_shares IS 'Accès lecture ou édition à un workspace appartenant à un autre compte.';

ALTER TABLE public.liri_course_workspace_shares ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "liri_course_workspace_shares_select" ON public.liri_course_workspace_shares;
CREATE POLICY "liri_course_workspace_shares_select"
ON public.liri_course_workspace_shares
FOR SELECT
TO authenticated
USING (
  grantee_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.liri_course_workspaces w
    WHERE w.id = workspace_id AND w.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "liri_course_workspace_shares_insert" ON public.liri_course_workspace_shares;
CREATE POLICY "liri_course_workspace_shares_insert"
ON public.liri_course_workspace_shares
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.liri_course_workspaces w
    WHERE w.id = workspace_id AND w.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "liri_course_workspace_shares_delete" ON public.liri_course_workspace_shares;
CREATE POLICY "liri_course_workspace_shares_delete"
ON public.liri_course_workspace_shares
FOR DELETE
TO authenticated
USING (
  grantee_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.liri_course_workspaces w
    WHERE w.id = workspace_id AND w.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "liri_course_workspace_shares_update" ON public.liri_course_workspace_shares;
CREATE POLICY "liri_course_workspace_shares_update"
ON public.liri_course_workspace_shares
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.liri_course_workspaces w
    WHERE w.id = workspace_id AND w.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.liri_course_workspaces w
    WHERE w.id = workspace_id AND w.user_id = auth.uid()
  )
);

-- ─── Versions ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.liri_course_workspace_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.liri_course_workspaces (id) ON DELETE CASCADE,
  payload jsonb NOT NULL,
  title_snapshot text,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_liri_course_workspace_versions_ws_created
  ON public.liri_course_workspace_versions (workspace_id, created_at DESC);

COMMENT ON TABLE public.liri_course_workspace_versions IS 'Snapshots du bundle workspace (restauration ponctuelle).';

ALTER TABLE public.liri_course_workspace_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "liri_course_workspace_versions_select" ON public.liri_course_workspace_versions;
CREATE POLICY "liri_course_workspace_versions_select"
ON public.liri_course_workspace_versions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.liri_course_workspaces w
    WHERE w.id = workspace_id
      AND (
        w.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.liri_course_workspace_shares s
          WHERE s.workspace_id = w.id AND s.grantee_id = auth.uid()
        )
      )
  )
);

DROP POLICY IF EXISTS "liri_course_workspace_versions_insert" ON public.liri_course_workspace_versions;
CREATE POLICY "liri_course_workspace_versions_insert"
ON public.liri_course_workspace_versions
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.liri_course_workspaces w
    WHERE w.id = workspace_id
      AND (
        w.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.liri_course_workspace_shares s
          WHERE s.workspace_id = w.id AND s.grantee_id = auth.uid() AND s.role = 'editor'
        )
      )
  )
);

DROP POLICY IF EXISTS "liri_course_workspace_versions_delete" ON public.liri_course_workspace_versions;
CREATE POLICY "liri_course_workspace_versions_delete"
ON public.liri_course_workspace_versions
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.liri_course_workspaces w
    WHERE w.id = workspace_id AND w.user_id = auth.uid()
  )
);

-- ─── RLS workspaces : remplacer par accès propriétaire + partagé ─────────────
DROP POLICY IF EXISTS "liri_course_workspaces_select_own" ON public.liri_course_workspaces;
CREATE POLICY "liri_course_workspaces_select_own"
ON public.liri_course_workspaces
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.liri_course_workspace_shares s
    WHERE s.workspace_id = id AND s.grantee_id = auth.uid()
  )
);

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
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.liri_course_workspace_shares s
    WHERE s.workspace_id = id AND s.grantee_id = auth.uid() AND s.role = 'editor'
  )
)
WITH CHECK (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.liri_course_workspace_shares s
    WHERE s.workspace_id = id AND s.grantee_id = auth.uid() AND s.role = 'editor'
  )
);

DROP POLICY IF EXISTS "liri_course_workspaces_delete_own" ON public.liri_course_workspaces;
CREATE POLICY "liri_course_workspaces_delete_own"
ON public.liri_course_workspaces
FOR DELETE
TO authenticated
USING (user_id = auth.uid());
