-- ═══════════════════════════════════════════════════════════════════════════
-- COURSE_GENERATION_JOBS — baseline (audit 2026-07-29, constat A7).
--
-- La table est UTILISÉE partout (API masterclass-factory + worker
-- course-from-replay) et ALTÉRÉE par 20260726090000, mais AUCUN CREATE TABLE
-- n'existe dans le repo : une base neuve n'était pas reconstructible. Ce
-- fichier pose le CREATE TABLE de référence, puis répète chaque colonne en
-- ADD COLUMN IF NOT EXISTS pour rester rejouable sur la base existante.
--
-- Colonnes établies depuis les accès réels du code :
--   • apps/api/src/masterclass-factory/course-job.service.ts
--       insert : tenant_id, video_id, source_type, source_id, requested_by,
--                status ; update : pivot_id ; tri : created_at
--   • apps/api/src/masterclass-factory/render-pivot.service.ts
--       select : id, course_id, pivot_id, status
--   • apps/worker/src/jobs/course-from-replay.js
--       update : status, progress, pivot_id, course_id, error_message,
--                updated_at ; polling : status='pending' ORDER BY created_at ;
--       requeue orphelins : status IN (…) AND updated_at < seuil
--   • 20260726090000 (ALTER) : source_type, source_id, targets, pivot_id
--       + contrainte course_generation_jobs_source_coherence.
--
-- Statuts observés : pending → extracting → planning → writing → publishing
-- → done | failed. Pas de CHECK : la table de prod n'en porte pas, on reste
-- fidèle à l'existant plutôt que d'introduire une divergence.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.course_generation_jobs (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID        NOT NULL,

  -- Un job replay porte un video_id ; les autres sources (tiktok, document,
  -- texte, live…) ne portent qu'un source_id TEXTE (cf. 20260726090000).
  video_id      UUID        REFERENCES public.published_videos(id) ON DELETE SET NULL,
  source_type   TEXT        NOT NULL DEFAULT 'replay',
  source_id     TEXT,

  -- Rendus demandés : parcours | pdf | masterclass | precepteur | smartboard
  -- | live | master_script | video_semaine | quiz | forum | faq | manuel.
  targets       TEXT[]      NOT NULL DEFAULT '{parcours}',

  -- Pivot de compréhension relié après extraction ; le pivot survit au job.
  pivot_id      UUID        REFERENCES public.course_pivots(id) ON DELETE SET NULL,

  -- Pas de FK : l'auteur peut disparaître sans invalider l'historique de la file.
  requested_by  UUID,

  status        TEXT        NOT NULL DEFAULT 'pending',
  progress      TEXT,                 -- libellé d'avancement affiché au front
  error_message TEXT,                 -- renseigné quand status = 'failed'

  -- Cours publié en brouillon au poste production quand status = 'done'.
  course_id     UUID        REFERENCES public.courses(id) ON DELETE SET NULL,

  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Le worker le rafraîchit à CHAQUE étape : c'est le signal de vie qui
  -- permet la remise en file des jobs orphelins (requeueStaleJobs).
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Idempotence sur base existante : la table de prod est née hors repo, on ne
-- présume d'aucune colonne. NB : pas de NOT NULL sur tenant_id ici — un ALTER
-- ne peut pas l'imposer sur des lignes déjà présentes.
ALTER TABLE public.course_generation_jobs
  ADD COLUMN IF NOT EXISTS tenant_id     UUID,
  ADD COLUMN IF NOT EXISTS video_id      UUID,
  ADD COLUMN IF NOT EXISTS source_type   TEXT NOT NULL DEFAULT 'replay',
  ADD COLUMN IF NOT EXISTS source_id     TEXT,
  ADD COLUMN IF NOT EXISTS targets       TEXT[] NOT NULL DEFAULT '{parcours}',
  ADD COLUMN IF NOT EXISTS pivot_id      UUID REFERENCES public.course_pivots(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS requested_by  UUID,
  ADD COLUMN IF NOT EXISTS status        TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS progress      TEXT,
  ADD COLUMN IF NOT EXISTS error_message TEXT,
  ADD COLUMN IF NOT EXISTS course_id     UUID,
  ADD COLUMN IF NOT EXISTS created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at    TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS course_generation_jobs_tenant_idx
  ON public.course_generation_jobs (tenant_id);

CREATE INDEX IF NOT EXISTS course_generation_jobs_video_idx
  ON public.course_generation_jobs (video_id);

-- Le worker interroge status='pending' ORDER BY created_at (polling) et
-- status IN (…) + updated_at < seuil (requeue) : l'index sur status sert les deux.
CREATE INDEX IF NOT EXISTS course_generation_jobs_status_idx
  ON public.course_generation_jobs (status, created_at);

-- Même posture fail-closed que course_pivots : RLS activée SANS policy —
-- seul service_role (API + worker) touche la file, aucun client direct.
ALTER TABLE public.course_generation_jobs ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.course_generation_jobs IS
  'File « source → cours enseignable » (Atelier unifié). L''API enregistre la demande, le worker course-from-replay la traite (extracting → planning → writing → publishing → done|failed) et publie le cours en brouillon. RLS sans policy : service_role uniquement.';
