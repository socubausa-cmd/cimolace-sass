-- C-8 (REQ-LIVE-003) : préfixage tenant sur les recordings R2.
-- Contexte : tous les fichiers R2 actuels sont stockés sous le préfixe
-- "recordings/<live_session_id>/...". Lorsqu'un autre tenant Cimolace
-- déploiera son école, il faut une isolation logique des objets pour :
--   - éviter qu'un mauvais bucket policy expose tout ;
--   - faciliter les exports / suppressions par tenant ;
--   - faciliter le quota / facturation par tenant.
--
-- Solution minimale : ajouter `tenant_slug` sur `live_recordings` avec
-- default 'isna' (le seul tenant productif aujourd'hui). Les nouveaux
-- recordings écriront sous "tenants/<slug>/recordings/...". Les
-- recordings historiques gardent leur ancien `file_path` (rétrocompat),
-- et le script `scripts/migrate/r2-recordings-tenant-prefix.js`
-- documente le rename R2 si jamais on veut tout uniformiser.

ALTER TABLE public.live_recordings
  ADD COLUMN IF NOT EXISTS tenant_slug TEXT NOT NULL DEFAULT 'isna';

ALTER TABLE public.live_recordings
  ADD COLUMN IF NOT EXISTS storage_filepath TEXT;

CREATE INDEX IF NOT EXISTS idx_live_recordings_tenant_recorded_at
  ON public.live_recordings(tenant_slug, recorded_at DESC);

COMMENT ON COLUMN public.live_recordings.tenant_slug IS
  'C-8 — Slug du tenant propriétaire du recording. Sert de préfixe R2.';
COMMENT ON COLUMN public.live_recordings.storage_filepath IS
  'C-8 — Chemin canonique du fichier dans le bucket R2 (sans bucket_name). '
  'Format attendu pour les nouveaux : "tenants/<slug>/recordings/<session>/<ts>.mp4". '
  'Les recordings historiques peuvent avoir un format "recordings/..." (à migrer hors-ligne).';
