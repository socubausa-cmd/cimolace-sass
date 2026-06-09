-- Forum Phase 2 — Fiabilité doctrinale.
-- Distinction des réponses (Élève / Formateur / Validé formateur / IA) + citations de sources.
ALTER TABLE public.formation_question_answers
  ADD COLUMN IF NOT EXISTS validated_by uuid,          -- formateur qui a validé la réponse
  ADD COLUMN IF NOT EXISTS validated_at timestamptz,   -- date de validation
  ADD COLUMN IF NOT EXISTS is_ai boolean NOT NULL DEFAULT false,  -- réponse générée par l'IA (LIRI)
  ADD COLUMN IF NOT EXISTS sources jsonb NOT NULL DEFAULT '[]'::jsonb;  -- [{type:'ayah'|'hadith'|'lesson'|'book', label}]
