-- ============================================================================
-- Migration: student_progress — inscription au NIVEAU COURS
-- Date: 2026-06-21
--
-- Contexte : le vrai contenu d'un cours publié vit dans le modèle studio
-- (modules → formation_weeks → formation_days → formation_day_contents), PAS
-- dans course_lessons. L'app mobile (EleveCoursePage) doit pouvoir inscrire un
-- élève au niveau COURS (une ligne par user+cours), sans lesson_id.
--
-- Deux changements idempotents :
--   1. lesson_id devient NULLABLE  (pré-requis pour une ligne course-level).
--   2. Contrainte UNIQUE(user_id, course_id) pour qu'un upsert
--      onConflict:'user_id,course_id' soit fiable. On dé-duplique d'abord les
--      éventuels doublons existants (course_id NON NULL) avant d'ajouter la
--      contrainte, sinon l'ADD CONSTRAINT échouerait.
--
-- La contrainte historique UNIQUE(user_id, lesson_id) reste en place : elle ne
-- gêne pas les lignes course-level (lesson_id NULL → NULLs distincts en
-- Postgres) et continue de protéger les lignes leçon-par-leçon.
-- ============================================================================

-- 1. lesson_id nullable (la table le crée NOT NULL : 20260521000031).
ALTER TABLE public.student_progress
  ALTER COLUMN lesson_id DROP NOT NULL;

-- 2a. Dé-duplication : ne conserver qu'une ligne par (user_id, course_id) quand
--     course_id est renseigné. On garde la plus récemment mise à jour (puis créée),
--     ce qui préserve la meilleure progression connue.
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, course_id
      ORDER BY
        (status = 'completed') DESC,   -- garde un cours terminé en priorité
        completed_at DESC NULLS LAST,  -- (student_progress n'a pas d'updated_at en prod)
        created_at DESC NULLS LAST,
        id DESC
    ) AS rn
  FROM public.student_progress
  WHERE course_id IS NOT NULL
)
DELETE FROM public.student_progress sp
USING ranked r
WHERE sp.id = r.id
  AND r.rn > 1;

-- 2b. Contrainte UNIQUE(user_id, course_id) — ajoutée seulement si absente.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'student_progress_user_course_unique'
      AND conrelid = 'public.student_progress'::regclass
  ) THEN
    ALTER TABLE public.student_progress
      ADD CONSTRAINT student_progress_user_course_unique
      UNIQUE (user_id, course_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_student_progress_user_course
  ON public.student_progress (user_id, course_id);

COMMENT ON CONSTRAINT student_progress_user_course_unique ON public.student_progress
  IS 'Une seule ligne de progression par (élève, cours) — supporte l''inscription course-level (lesson_id NULL).';
