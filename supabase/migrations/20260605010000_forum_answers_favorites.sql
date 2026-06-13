-- Forum : tables/colonnes manquantes qui cassaient l'ouverture de sujet,
-- l'affichage/écriture des réponses, et la publication de questions.
--   - formation_student_questions.content : colonne attendue par l'UI (corps de la question).
--   - formation_question_answers : table des réponses (était totalement absente).
--   - forum_favorites : table des favoris (était absente).
-- (forum_votes existait déjà.)

ALTER TABLE public.formation_student_questions
  ADD COLUMN IF NOT EXISTS content text;

CREATE TABLE IF NOT EXISTS public.formation_question_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES public.formation_student_questions(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.formation_question_answers(id) ON DELETE CASCADE,
  student_id uuid,
  author_name text,
  answer text NOT NULL DEFAULT '',
  is_public boolean NOT NULL DEFAULT true,
  is_solution boolean NOT NULL DEFAULT false,
  is_instructor_answer boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.formation_question_answers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS fqa_select_public ON public.formation_question_answers;
CREATE POLICY fqa_select_public ON public.formation_question_answers
  FOR SELECT TO authenticated USING (is_public = true);

DROP POLICY IF EXISTS fqa_insert_own ON public.formation_question_answers;
CREATE POLICY fqa_insert_own ON public.formation_question_answers
  FOR INSERT TO authenticated WITH CHECK (student_id = auth.uid());

DROP POLICY IF EXISTS fqa_update_own ON public.formation_question_answers;
CREATE POLICY fqa_update_own ON public.formation_question_answers
  FOR UPDATE TO authenticated USING (student_id = auth.uid()) WITH CHECK (student_id = auth.uid());

DROP POLICY IF EXISTS fqa_delete_own ON public.formation_question_answers;
CREATE POLICY fqa_delete_own ON public.formation_question_answers
  FOR DELETE TO authenticated USING (student_id = auth.uid());

CREATE INDEX IF NOT EXISTS fqa_question_idx
  ON public.formation_question_answers (question_id, created_at);

CREATE TABLE IF NOT EXISTS public.forum_favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (question_id, user_id)
);
ALTER TABLE public.forum_favorites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ff_all_own ON public.forum_favorites;
CREATE POLICY ff_all_own ON public.forum_favorites
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
