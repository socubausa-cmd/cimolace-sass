-- ============================================================================
-- UNIFICATION FORUM (Option A) — formation_student_questions → conversations kind='topic'
-- ============================================================================
-- BUT : un seul forum « connecté ». Les questions manuelles d'élèves
-- (formation_student_questions) deviennent des Sujets kind='topic' dans
-- `conversations` (le forum connecté, déjà alimenté par le récap live). Les
-- réponses (formation_question_answers) deviennent des messages du Sujet.
--
-- ⚠️⚠️ BROUILLON — NE PAS APPLIQUER SUR PROD AVANT :
--   1) BACKUP : formation_student_questions, formation_question_answers,
--      conversations, conversation_participants, messages.
--   2) CONFIRMER LE SCHÉMA RÉEL de formation_student_questions — c'est une table
--      « fantôme » (AUCUNE migration CREATE TABLE versionnée : seules des
--      `ALTER … ADD COLUMN IF NOT EXISTS` la touchent dans
--      20260605010000_forum_answers_favorites.sql et
--      20260621160000_formation_question_columns_and_tables.sql ; les colonnes de
--      base — id/formation_id/student_id/author_name/question/tags/is_public/
--      is_pinned/reply_count/vote_count/accepted_answer_id/status/tenant_id/
--      created_at/updated_at — sont INFÉRÉES du code).
--
--      ▶ Lancer d'abord sur prod (LECTURE SEULE) pour confirmer le schéma fantôme
--        des deux tables sources avant tout INSERT :
--
--        -- (a) colonnes réelles de formation_student_questions
--        SELECT column_name, data_type, is_nullable, column_default
--        FROM information_schema.columns
--        WHERE table_schema = 'public'
--          AND table_name   = 'formation_student_questions'
--        ORDER BY ordinal_position;
--
--        -- (b) colonnes réelles de formation_question_answers
--        --     (DOIT confirmer l'ABSENCE de tenant_id — cf. étape 5)
--        SELECT column_name, data_type, is_nullable, column_default
--        FROM information_schema.columns
--        WHERE table_schema = 'public'
--          AND table_name   = 'formation_question_answers'
--        ORDER BY ordinal_position;
--
--      → si une colonne utilisée ici (tenant_id, question, content, status,
--        formation_id, student_id, is_public ; côté réponses : question_id,
--        student_id, answer, is_solution, created_at) n'existe pas / a un autre
--        nom, AJUSTER avant d'exécuter.
--
-- SCHÉMA PROD RÉEL des tables CIBLES (vérifié — cf. en-tête de
-- 20260620170000_forum_connecte_sujets.sql + 20260614140000_…rpc.sql +
-- apps/api/src/messaging/topics.service.ts). ⚠️ La migration
-- 20260521000033_chat_messaging.sql est PÉRIMÉE (déclare à tort
-- conv_type/title/read_by) — NE PAS s'y fier :
--   conversations(id, tenant_id, name, description,
--                 type CHECK('direct','group') DEFAULT 'direct',
--                 created_by, created_at, updated_at)
--                 + colonnes additives Phase A :
--                   kind('direct'|'group'|'topic') DEFAULT 'direct',
--                   subject, status('open'|'closed') DEFAULT 'open',
--                   visibility('public'|'private'|'context') DEFAULT 'private',
--                   context_type('video'|'live'|'class'), context_id uuid
--   conversation_participants(id, tenant_id, conversation_id, user_id, joined_at)
--                 UNIQUE(conversation_id, user_id)
--   messages(id, tenant_id, conversation_id, sender_id, recipient_id, subject,
--            content, is_read, read_at, created_at)   -- content NOT NULL
--   formation_question_answers(id, question_id, parent_id, student_id, author_name,
--            answer NOT NULL, is_public, is_solution, is_instructor_answer,
--            created_at, updated_at)                  -- ⚠️ AUCUN tenant_id
--
-- ⚠️ CONTRAINTE D'UNICITÉ À NE PAS DÉCLENCHER : la migration
-- 20260621160000_topic_context_unique.sql a posé un index UNIQUE PARTIEL
--   uniq_conversations_topic_context
--   ON conversations (tenant_id, context_type, context_id)
--   WHERE kind='topic' AND context_id IS NOT NULL
-- → UN SEUL Sujet par (tenant, context_type, context_id). Si on rattachait chaque
-- question au contexte 'course'/formation_id, deux questions sur LA MÊME formation
-- (cas courant) violeraient cet index (23505) et FERAIENT ÉCHOUER toute la
-- migration. On NE met donc PAS context_type/context_id sur ces Sujets (ils
-- restent NULL → hors prédicat de l'index unique). L'origine formation reste
-- traçable via la colonne dédiée `source_formation_id` (étape 1).
--
-- 100% ADDITIF & IDEMPOTENT : ne supprime rien, garde les tables sources
-- intactes (rollback = supprimer les conversations où source_question_id IS NOT NULL).
-- ============================================================================

BEGIN;

-- 1) Colonnes de TRAÇAGE de l'origine (idempotence + rollback ciblé).
--    - source_question_id : 1:1 avec la question d'origine (garde l'idempotence) ;
--    - source_formation_id : conserve le lien vers la formation SANS utiliser
--      context_id (qui déclencherait l'index unique de contexte, cf. en-tête).
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS source_question_id  uuid,
  ADD COLUMN IF NOT EXISTS source_formation_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'conversations_source_question_uq'
  ) THEN
    ALTER TABLE public.conversations
      ADD CONSTRAINT conversations_source_question_uq UNIQUE (source_question_id);
  END IF;
END$$;

-- Index pour relister les Sujets issus d'une formation (et rollback ciblé).
CREATE INDEX IF NOT EXISTS idx_conversations_source_formation
  ON public.conversations (tenant_id, source_formation_id)
  WHERE source_question_id IS NOT NULL;

-- 2) Chaque question → un Sujet kind='topic'.
--    visibility = public (is_public) sinon private.
--    ⚠️ context_type/context_id RESTENT NULL (cf. en-tête : éviter la collision
--    avec uniq_conversations_topic_context). Le lien formation est porté par
--    source_formation_id.
--    Le garde NOT EXISTS(source_question_id) rend l'INSERT ré-exécutable.
INSERT INTO public.conversations (
  tenant_id, kind, type, name, subject, status, visibility,
  context_type, context_id,
  created_by, created_at, updated_at,
  source_question_id, source_formation_id
)
SELECT
  q.tenant_id,
  'topic', 'group',
  COALESCE(NULLIF(q.question, ''), 'Sujet'),
  COALESCE(NULLIF(q.question, ''), 'Sujet'),
  CASE WHEN q.status IN ('resolved','closed') THEN 'closed' ELSE 'open' END,
  CASE WHEN q.is_public THEN 'public' ELSE 'private' END,
  NULL, NULL,
  q.student_id,
  q.created_at,
  q.created_at,  -- formation_student_questions n'a PAS de updated_at (schéma prod confirmé)
  q.id,
  q.formation_id
FROM public.formation_student_questions q
WHERE q.tenant_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.conversations c WHERE c.source_question_id = q.id
  );

-- 3) Auteur = participant du Sujet (requis pour la RLS private/context).
INSERT INTO public.conversation_participants (tenant_id, conversation_id, user_id, joined_at)
SELECT c.tenant_id, c.id, c.created_by, c.created_at
FROM public.conversations c
WHERE c.kind = 'topic'
  AND c.source_question_id IS NOT NULL
  AND c.created_by IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.conversation_participants cp
    WHERE cp.conversation_id = c.id AND cp.user_id = c.created_by
  )
ON CONFLICT (conversation_id, user_id) DO NOTHING;

-- 4) Corps de la question (content) → 1er message du Sujet (si renseigné).
--    messages.content est NOT NULL → on filtre les content vides.
INSERT INTO public.messages (tenant_id, conversation_id, sender_id, recipient_id, subject, content, created_at)
SELECT q.tenant_id, c.id, q.student_id, NULL, NULL, q.content, q.created_at
FROM public.formation_student_questions q
JOIN public.conversations c
  ON c.source_question_id = q.id AND c.kind = 'topic'
WHERE q.content IS NOT NULL AND q.content <> ''
  AND q.student_id IS NOT NULL   -- messages.sender_id est NOT NULL → on saute les questions anonymes (le Sujet existe quand même, titre = question)
  AND NOT EXISTS (
    SELECT 1 FROM public.messages m
    WHERE m.conversation_id = c.id
      AND m.sender_id IS NOT DISTINCT FROM q.student_id
      AND m.content = q.content
  );

-- 5) Réponses (formation_question_answers) → messages du Sujet.
--    NB : formation_question_answers n'a PAS de tenant_id (cf. en-tête / requête
--    d'introspection (b)) → on hérite de celui du Sujet (c.tenant_id).
--    messages.content est NOT NULL → on filtre les answer vides.
INSERT INTO public.messages (tenant_id, conversation_id, sender_id, recipient_id, subject, content, created_at)
SELECT c.tenant_id, c.id, a.student_id, NULL,
       CASE WHEN a.is_solution THEN 'Réponse acceptée' ELSE NULL END,
       a.answer, a.created_at
FROM public.formation_question_answers a
JOIN public.conversations c
  ON c.source_question_id = a.question_id AND c.kind = 'topic'
WHERE a.answer IS NOT NULL AND a.answer <> ''
  AND a.student_id IS NOT NULL   -- messages.sender_id est NOT NULL → on saute les réponses anonymes
  AND NOT EXISTS (
    SELECT 1 FROM public.messages m
    WHERE m.conversation_id = c.id
      AND m.sender_id IS NOT DISTINCT FROM a.student_id
      AND m.content = a.answer
      AND m.created_at = a.created_at
  );

COMMIT;

-- ============================================================================
-- ROLLBACK (si besoin) :
--   DELETE FROM public.messages                  WHERE conversation_id IN (SELECT id FROM public.conversations WHERE source_question_id IS NOT NULL);
--   DELETE FROM public.conversation_participants WHERE conversation_id IN (SELECT id FROM public.conversations WHERE source_question_id IS NOT NULL);
--   DELETE FROM public.conversations             WHERE source_question_id IS NOT NULL;
-- (les tables sources formation_student_questions / formation_question_answers ne sont jamais touchées.)
-- ============================================================================
