-- Migration: publication d'un contenu de jour (vidéo post-prod) dans le calendrier élève.
--
-- Constat : `formation_day_contents` (vidéo post-prod, payload dans `data` jsonb) ne
-- possède aucun champ date ni lien calendrier. Pour pouvoir « publier au calendrier »
-- une vidéo depuis la post-production et la faire apparaître dans l'agenda élève
-- (« Vidéo du cours disponible »), on ajoute une colonne date de publication.
--
-- Idempotente : ADD COLUMN IF NOT EXISTS + CREATE INDEX IF NOT EXISTS.
-- Aucune modification de RLS : les policies SELECT/MANAGE existantes de la table
-- couvrent déjà cette colonne (cf. 20260609120000_formation_studio_tables.sql).

ALTER TABLE public.formation_day_contents
  ADD COLUMN IF NOT EXISTS publication_date TIMESTAMPTZ NULL;

COMMENT ON COLUMN public.formation_day_contents.publication_date IS
  'Date de publication au calendrier élève (NULL = non publié). Renseignée depuis la post-production ; lue par l''agenda élève comme « Vidéo du cours disponible ».';

-- Index partiel : l'agenda ne lit que les lignes publiées (publication_date IS NOT NULL).
CREATE INDEX IF NOT EXISTS idx_formation_day_contents_publication_date
  ON public.formation_day_contents (publication_date)
  WHERE publication_date IS NOT NULL;
