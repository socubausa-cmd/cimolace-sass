-- ============================================================================
-- Migration: Phase C — UNIQUE partiel sur le Sujet d'un contexte
-- Date: 2026-06-21
--
-- Contexte : Phase C ouvre, à la 1re ouverture du panneau Questions d'une vidéo,
-- LE Sujet (conversations kind='topic', visibility='context') de la ressource via
-- un get-or-create idempotent (TopicsService.getOrCreateContextTopic). Sous forte
-- concurrence (deux ouvertures simultanées), le FIND…CREATE pourrait créer 2 lignes.
--
-- Phase A avait déjà posé un index NON unique idx_conversations_topic_context
-- (tenant_id, context_type, context_id) WHERE kind='topic' AND context_id IS NOT NULL
-- (cf. 20260620170000_forum_connecte_sujets.sql) — utile pour la résolution, mais
-- il n'empêche pas les doublons. On le PROMEUT en index UNIQUE partiel : un seul
-- Sujet par (tenant, context_type, context_id). Le service capture alors la
-- violation 23505 au CREATE concurrent et renvoie l'existant (idempotence prouvée).
--
-- Entièrement additif et idempotent :
--   1. dé-duplication préalable (sinon CREATE UNIQUE INDEX échouerait) ;
--   2. CREATE UNIQUE INDEX IF NOT EXISTS du nouvel index ;
--   3. suppression de l'ancien index non unique (redondant : le nouvel index UNIQUE
--      sert aussi les lectures de résolution par contexte).
-- Aucune RLS touchée : la lecture des Sujets passe par l'API service_role.
-- ============================================================================

-- 1. Dé-duplication : ne conserver qu'UN Sujet par (tenant, context_type, context_id).
--    On garde le plus ancien (created_at asc) — c'est celui que le FIND .limit(1)
--    renvoie déjà de façon déterministe, donc on préserve la continuité des fils.
--    Les éventuels doublons (rares, créés avant l'unicité) sont supprimés ; leurs
--    messages/participants partent en cascade (FK ON DELETE CASCADE des sous-tables).
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY tenant_id, context_type, context_id
      ORDER BY created_at ASC NULLS LAST, id ASC
    ) AS rn
  FROM public.conversations
  WHERE kind = 'topic' AND context_id IS NOT NULL
)
DELETE FROM public.conversations c
USING ranked r
WHERE c.id = r.id
  AND r.rn > 1;

-- 2. Index UNIQUE partiel : un seul Sujet de contexte par ressource et par tenant.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_conversations_topic_context
  ON public.conversations (tenant_id, context_type, context_id)
  WHERE kind = 'topic' AND context_id IS NOT NULL;

COMMENT ON INDEX public.uniq_conversations_topic_context IS
  'Phase C : un seul Sujet (kind=topic, visibility=context) par (tenant, context_type, context_id). Rend getOrCreateContextTopic idempotent sous concurrence (retry sur 23505). Remplace idx_conversations_topic_context.';

-- 3. L'ancien index non unique devient redondant (le nouvel index UNIQUE couvre les
--    mêmes colonnes/prédicat et sert aussi les lectures par contexte).
DROP INDEX IF EXISTS public.idx_conversations_topic_context;
