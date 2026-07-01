-- LIRI — Pédagogie du futur : ancre calendrier du parcours.
-- Le front (schoolPathsApi.js listSchoolPaths/createSchoolPath/updateSchoolPath/fetchPathTreeForCalendar
-- + SchoolPathsParcoursPanel) sélectionne et écrit school_paths.starts_on, mais la table créée par
-- 202604091200_liri_pedagogie_futur_paths.sql ne comporte pas cette colonne -> PostgREST renvoie
-- "column school_paths.starts_on does not exist". On l'ajoute (nullable, additif, idempotent).

ALTER TABLE public.school_paths
  ADD COLUMN IF NOT EXISTS starts_on date DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_school_paths_starts_on
  ON public.school_paths (starts_on);

COMMENT ON COLUMN public.school_paths.starts_on IS
  'Date d''ancrage calendrier (lundi de la semaine 1) — timeline des week_days du parcours. NULL = non ancré.';
