-- Statut de cycle de vie (Module 1 — versioning & brouillons).

ALTER TABLE public.liri_course_workspaces
  ADD COLUMN IF NOT EXISTS lifecycle_status text NOT NULL DEFAULT 'draft';

ALTER TABLE public.liri_course_workspaces
  DROP CONSTRAINT IF EXISTS liri_course_workspaces_lifecycle_status_check;

ALTER TABLE public.liri_course_workspaces
  ADD CONSTRAINT liri_course_workspaces_lifecycle_status_check
  CHECK (lifecycle_status IN ('draft', 'in_progress', 'validated', 'ready_live', 'archived'));

COMMENT ON COLUMN public.liri_course_workspaces.lifecycle_status IS
  'Statut produit : draft=brouillon, in_progress=en cours, validated=validé, ready_live=prêt live, archived=archivé.';
