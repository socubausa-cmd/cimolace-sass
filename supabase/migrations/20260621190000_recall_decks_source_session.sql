-- ============================================================================
-- Migration : unicité des decks de révision générés par un live (neuro-recall)
-- Date : 2026-06-21
--
-- Contexte : l'edge function `neuro-recall-bootstrap` crée, à la fin d'un live, UN
-- deck « Révision — <live> » par participant. L'idempotence reposait sur un
-- SELECT-puis-INSERT par titre (non atomique) → sous deux invocations quasi
-- simultanées (endSession + appel manuel), deux decks identiques pouvaient être
-- créés pour le même élève (revue adversariale, finding #1).
--
-- On ajoute un discriminant `source_session_id` (= live_sessions.id à l'origine du
-- deck ; NULL pour les decks créés manuellement) + un index UNIQUE PARTIEL qui rend
-- l'INSERT atomiquement idempotent : un seul deck par (tenant, user, live). Le
-- partiel WHERE source_session_id IS NOT NULL n'impacte PAS les decks manuels
-- (createDeck de l'API NestJS, source_session_id NULL) → aucune régression.
--
-- 100 % additif (colonne nullable + index partiel ; recall_decks vide en prod).
-- ============================================================================

ALTER TABLE public.recall_decks
  ADD COLUMN IF NOT EXISTS source_session_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_recall_decks_source
  ON public.recall_decks (tenant_id, user_id, source_session_id)
  WHERE source_session_id IS NOT NULL;

COMMENT ON INDEX public.uniq_recall_decks_source IS
  'neuro-recall : un seul deck de révision par (tenant, user, live) — rend neuro-recall-bootstrap idempotent (INSERT 23505 si déjà créé). N''affecte pas les decks manuels (source_session_id NULL).';
