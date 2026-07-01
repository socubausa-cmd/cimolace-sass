-- Player unifié « mode révision » (cours + replay) — colonnes additives.
-- 100 % additif et idempotent : aucune colonne existante touchée, aucun backfill.
-- ⚠️ Appliquer ces ALTER DIRECTEMENT en prod (run-sql.js), PAS via db push
-- (202604301200_neuro_recall_system.sql diverge de la prod).

-- Vignette (poster frame) extraite du MP4 par le worker (clé R2), + garde anti-boucle.
ALTER TABLE public.live_recordings
  ADD COLUMN IF NOT EXISTS thumbnail_url text;
ALTER TABLE public.live_recordings
  ADD COLUMN IF NOT EXISTS poster_status text;

-- Chapitres du replay [{label,timeSeconds}] (dérivés mindmap+offsets), pour ChapterList.
ALTER TABLE public.live_neuro_recall_state
  ADD COLUMN IF NOT EXISTS chapters jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Transcript du replay aplati en texte (fallback captions live), pour TranscriptPanel.
ALTER TABLE public.live_neuro_recall_state
  ADD COLUMN IF NOT EXISTS transcript_text text;

-- Vignette propagée pour lecture front sans re-jointure.
ALTER TABLE public.live_neuro_recall_state
  ADD COLUMN IF NOT EXISTS replay_poster_url text;
