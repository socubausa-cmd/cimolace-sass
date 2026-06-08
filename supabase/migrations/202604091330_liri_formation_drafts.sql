-- Brouillons Formation Builder LIRI — persistance cloud par utilisateur

CREATE TABLE IF NOT EXISTS public.liri_formation_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  title text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_liri_formation_drafts_owner_updated
  ON public.liri_formation_drafts (owner_id, updated_at DESC);

COMMENT ON TABLE public.liri_formation_drafts IS 'Arbres formation générés (JSON) — Course Builder / Designer ensuite.';

ALTER TABLE public.liri_formation_drafts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "liri_formation_drafts_select_own" ON public.liri_formation_drafts;
CREATE POLICY "liri_formation_drafts_select_own"
ON public.liri_formation_drafts FOR SELECT TO authenticated
USING (owner_id = auth.uid());

DROP POLICY IF EXISTS "liri_formation_drafts_insert_own" ON public.liri_formation_drafts;
CREATE POLICY "liri_formation_drafts_insert_own"
ON public.liri_formation_drafts FOR INSERT TO authenticated
WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "liri_formation_drafts_update_own" ON public.liri_formation_drafts;
CREATE POLICY "liri_formation_drafts_update_own"
ON public.liri_formation_drafts FOR UPDATE TO authenticated
USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "liri_formation_drafts_delete_own" ON public.liri_formation_drafts;
CREATE POLICY "liri_formation_drafts_delete_own"
ON public.liri_formation_drafts FOR DELETE TO authenticated
USING (owner_id = auth.uid());
