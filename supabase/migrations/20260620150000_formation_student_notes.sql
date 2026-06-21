-- Cahier de notes de l'élève (player de cours, onglet « Cahier » →
-- « Qu'est-ce que tu as retenu ? »).
--
-- La table `formation_student_notes` était TOTALEMENT ABSENTE en prod : le
-- SELECT de loadNotes() et l'UPSERT de saveNotes()
-- (apps/app/src/components/school/formations/CoursePlayerInterface.jsx)
-- partaient vers le vrai Supabase (table non mappée dans supabaseCompat →
-- branche `default` → executeRealSupabase) et échouaient avec
-- « relation "public.formation_student_notes" does not exist » (42P01),
-- d'où « Erreur: la note n'a pas pu être enregistrée » à l'ouverture du
-- panneau (loadNotes) comme à l'enregistrement (saveNotes).
--
-- Conception :
--   • Note PERSONNELLE et privée → RLS scoppée à l'élève
--     (student_id = auth.uid()), INDÉPENDANTE de l'appartenance au tenant.
--     Un compte authentifié (même admin global non-membre du tenant) peut
--     donc lire/écrire SES propres notes — pas de cul-de-sac « non membre ».
--   • La contrainte UNIQUE reproduit exactement le onConflict de l'upsert
--     côté front : (formation_id, student_id, day_id, video_id). Les 4
--     colonnes sont NOT NULL (video_id DEFAULT '') pour que le matching
--     ON CONFLICT soit déterministe (pas de piège NULL ≠ NULL).
--   • module_id / week_id / day_id / video_id en `text` (pas de FK) :
--     ce sont des identifiants opaques fournis par la structure chargée
--     dans le player ; rester en text évite tout rejet de type et tout
--     couplage fragile à la structure modules→weeks→days.

CREATE TABLE IF NOT EXISTS public.formation_student_notes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  formation_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  student_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module_id    text,
  week_id      text,
  day_id       text NOT NULL,
  video_id     text NOT NULL DEFAULT '',
  content      text NOT NULL DEFAULT '',
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT formation_student_notes_uniq
    UNIQUE (formation_id, student_id, day_id, video_id)
);

ALTER TABLE public.formation_student_notes ENABLE ROW LEVEL SECURITY;

-- Une seule policy FOR ALL : l'élève gère intégralement ses propres notes
-- (couvre SELECT de loadNotes + INSERT/UPDATE de l'upsert de saveNotes).
DROP POLICY IF EXISTS fsn_all_own ON public.formation_student_notes;
CREATE POLICY fsn_all_own ON public.formation_student_notes
  FOR ALL TO authenticated
  USING (student_id = auth.uid())
  WITH CHECK (student_id = auth.uid());

CREATE INDEX IF NOT EXISTS fsn_student_formation_day_idx
  ON public.formation_student_notes (student_id, formation_id, day_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.formation_student_notes TO authenticated;
