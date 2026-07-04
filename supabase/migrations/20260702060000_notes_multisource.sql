-- Généralise `formation_student_notes` en HUB de prise de notes MULTI-SOURCE
-- (cours / live / précepteur). L'élève prend des notes rattachées à leur source ;
-- le hub « Mes notes » les liste avec un filtre par source + un lien vers l'origine.
--
-- Additif + rétrocompatible :
--   • source_type  = 'course' | 'live' | 'precepteur'
--   • source_id    = identifiant générique de la source (formation_id / live_session_id / course id précepteur)
--   • source_title = titre dénormalisé (affichage hub sans jointure)
--   • source_ref   = sous-localisateur optionnel (chapitre, timestamp…)
-- Les colonnes propres au COURS (formation_id, day_id) deviennent optionnelles
-- (un live/précepteur n'en a pas). L'upsert cours existant (onConflict
-- formation_id,student_id,day_id,video_id) reste valide.

BEGIN;

ALTER TABLE public.formation_student_notes
  ADD COLUMN IF NOT EXISTS source_type  text NOT NULL DEFAULT 'course',
  ADD COLUMN IF NOT EXISTS source_id    text,
  ADD COLUMN IF NOT EXISTS source_title text,
  ADD COLUMN IF NOT EXISTS source_ref   text;

-- Colonnes « cours » désormais optionnelles (live / précepteur ne les renseignent pas)
ALTER TABLE public.formation_student_notes ALTER COLUMN formation_id DROP NOT NULL;
ALTER TABLE public.formation_student_notes ALTER COLUMN day_id DROP NOT NULL;

-- Backfill : les notes existantes sont des notes de COURS
UPDATE public.formation_student_notes n
   SET source_id = COALESCE(n.source_id, n.formation_id::text)
 WHERE n.source_id IS NULL;

UPDATE public.formation_student_notes n
   SET source_title = c.title
  FROM public.courses c
 WHERE n.formation_id = c.id
   AND n.source_title IS NULL;

-- 1 note par source pour les notes NON-cours (live / précepteur).
-- (les notes de cours gardent leur contrainte d'origine formation_id,student_id,day_id,video_id)
CREATE UNIQUE INDEX IF NOT EXISTS fsn_source_uniq
  ON public.formation_student_notes (student_id, source_type, source_id, COALESCE(source_ref, ''))
  WHERE source_type <> 'course';

-- Index de listing du hub (par élève, source, récence)
CREATE INDEX IF NOT EXISTS fsn_student_source_idx
  ON public.formation_student_notes (student_id, source_type, updated_at DESC);

COMMIT;
