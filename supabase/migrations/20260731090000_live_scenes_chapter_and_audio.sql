-- ═══════════════════════════════════════════════════════════════════════════
-- TABLEAU VIVANT — le chapitre, le mode de rendu et la narration deviennent
-- des colonnes de première classe sur live_scenes.
--
-- Pourquoi : ces trois informations existaient déjà dans le produit, mais
-- uniquement enfouies dans `content_payload_json` (ou nulle part) :
--   • chapter_id  — l'éditeur Masterclass groupe ses 251 scènes en 12 chapitres,
--                   la publication live APLATISSAIT ce regroupement ;
--   • render_mode — le rendu sait faire 'progressive' / 'instant' / 'spotlight'
--                   (cf. SlideParallaxStage), mais aucune scène publiée ne
--                   portait le mode voulu par l'enseignant ;
--   • audio_url   — le cahier des charges (docs/CAHIER_DE_CHARGE_TABLEAU_VIVANT.md,
--                   Lot 4) exige une narration PAR SCÈNE ; le Studio éditait déjà
--                   un `audioUrl` par scène, mais rien ne le persistait côté live.
--
-- Additif et rejouable : aucune colonne existante n'est modifiée, aucune donnée
-- n'est réécrite. Les scènes déjà publiées gardent NULL et continuent de
-- fonctionner (le rendu retombe sur ses valeurs par défaut).
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.live_scenes
  ADD COLUMN IF NOT EXISTS chapter_id integer;

ALTER TABLE public.live_scenes
  ADD COLUMN IF NOT EXISTS render_mode text;

ALTER TABLE public.live_scenes
  ADD COLUMN IF NOT EXISTS audio_url text;

-- Vocabulaire fermé : un mode inconnu ferait retomber le rendu en silence sur
-- son défaut, ce qui est exactement le genre de panne invisible qu'on refuse.
-- NULL reste autorisé (scènes historiques + scènes non-Master-Factory).
ALTER TABLE public.live_scenes
  DROP CONSTRAINT IF EXISTS live_scenes_render_mode_check;
ALTER TABLE public.live_scenes
  ADD CONSTRAINT live_scenes_render_mode_check
  CHECK (render_mode IS NULL OR render_mode IN ('progressive', 'instant', 'spotlight'));

-- La régie relit les scènes d'un chapitre pour l'affichage groupé de l'atelier.
CREATE INDEX IF NOT EXISTS live_scenes_session_chapter_idx
  ON public.live_scenes (live_session_id, chapter_id);

COMMENT ON COLUMN public.live_scenes.chapter_id IS
  'Chapitre pédagogique d''appartenance (1-based). Le regroupement de l''éditeur Masterclass était perdu à la publication live.';
COMMENT ON COLUMN public.live_scenes.render_mode IS
  'Mode du tableau vivant : progressive (révélation séquentielle), instant (tout visible), spotlight (révélation + halo).';
COMMENT ON COLUMN public.live_scenes.audio_url IS
  'Narration de CETTE scène (Lot 4 du cahier des charges Tableau Vivant). ⚠️ ÉTAT AU 2026-07-31 : la piste est PRODUITE et stockée, mais AUCUN lecteur ne la joue encore en direct — le chemin de rendu ne monte pas d''élément audio. Ne pas laisser croire que la voix pilote déjà la révélation.';
