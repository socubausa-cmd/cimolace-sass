-- Notes horodatées de l'élève (composant lesson-player/NotesPanel.tsx, rendu
-- sous la vidéo du player de cours quand `currentVideoMemo?.id` existe).
--
-- DEUXIÈME système de notes du player, DISTINCT du « Cahier de notes » :
--   • Cahier  → table `formation_student_notes` (1 note libre par jour/vidéo,
--     onglet « Cahier », via l'adaptateur supabaseCompat). Déjà corrigé.
--   • NotesPanel → table `lesson_notes` (N notes attachées à un timestamp vidéo,
--     via le VRAI client Supabase `customSupabaseClient`).
--
-- La table `lesson_notes` était ABSENTE en prod → NotesPanel.load()/addNote()
-- échouaient, MAIS l'erreur est avalée (`if (error) return;`) : l'élève tapait
-- une note horodatée, cliquait « Ajouter », et elle était silencieusement perdue
-- (aucun message, « Aucune note. »). Même classe de bug que formation_student_notes,
-- en pire car invisible.
--
-- Conception (calquée sur 20260620150000_formation_student_notes.sql) :
--   • RLS privée scoppée à l'élève (user_id = auth.uid()), indépendante du tenant.
--   • lesson_id en `text` (id opaque de contenu/vidéo, pas de FK).
--   • timestamp_seconds en numeric (demi-secondes : Math.round(t*2)/2 côté UI).
--   • NotesPanel fait insert/delete/select (pas d'upsert) → aucune contrainte
--     UNIQUE nécessaire.

CREATE TABLE IF NOT EXISTS public.lesson_notes (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lesson_id         text NOT NULL,
  timestamp_seconds numeric NOT NULL DEFAULT 0,
  note_text         text NOT NULL DEFAULT '',
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.lesson_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ln_all_own ON public.lesson_notes;
CREATE POLICY ln_all_own ON public.lesson_notes
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS ln_user_lesson_idx
  ON public.lesson_notes (user_id, lesson_id, timestamp_seconds);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lesson_notes TO authenticated;
