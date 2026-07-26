-- ─────────────────────────────────────────────────────────────────────────────
-- CHAPITRAGE DES REPLAYS — colonnes manquantes de published_videos
--
-- POURQUOI CE FICHIER : le chapitrage sémantique (POST /masterclass-factory/
-- chapters-from-replay → ReplayChaptersService) ÉCRIT son résultat dans
-- published_videos.chapters, et la Vidéothèque le relit tel quel (select '*')
-- pour que les élèves lisent les chapitres SANS jamais consommer de jetons.
-- Ces deux colonnes avaient été ajoutées HORS-BANDE en production (comme
-- transcript_cues), mais AUCUNE migration ne les déclarait : sur toute autre
-- instance (nouvelle base, environnement de test), l'UPDATE échouait en 42703 /
-- PGRST204 — échec seulement journalisé, donc invisible : le créateur voyait ses
-- chapitres, les élèves n'en voyaient jamais, et chaque clic refacturait un
-- appel modèle sur ~40 000 caractères (le cache d'idempotence ne pouvant jamais
-- faire mouche).
--
-- ⚠️ Ce dépôt applique ses migrations par psql HORS-BANDE (jamais `supabase db
-- push`). Le fichier est idempotent : le rejouer sur la prod, où les colonnes
-- existent déjà, ne fait rien.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.published_videos
  ADD COLUMN IF NOT EXISTS chapters JSONB,
  ADD COLUMN IF NOT EXISTS chapters_generated_at TIMESTAMPTZ;

COMMENT ON COLUMN public.published_videos.chapters IS
  'Chapitrage sémantique du replay : [{t:secondes, label, summary}]. NULL = jamais chapitré '
  '(le lecteur dérive alors des repères des silences de la transcription). Écrit par '
  'ReplayChaptersService, lu par la Vidéothèque et le lecteur immersif.';

COMMENT ON COLUMN public.published_videos.chapters_generated_at IS
  'Horodatage de la dernière génération des chapitres (sert à décider une régénération).';
