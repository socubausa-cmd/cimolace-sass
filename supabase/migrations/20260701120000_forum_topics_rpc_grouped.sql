-- ============================================================================
-- get_forum_topics v2 — forum GROUPÉ PAR SOURCE (live / cours / questions).
-- ----------------------------------------------------------------------------
-- Deux évolutions vs v1 :
--  1) VISIBILITÉ : les Sujets de CONTEXTE (visibility='context' : récap de live,
--     post-prod de cours) deviennent visibles par TOUT membre actif du tenant
--     — c'est un forum COMMUNAUTAIRE : « on voit toutes les discussions d'un live ».
--     Seuls les Sujets 'private' (messagerie 1-1) restent réservés aux participants.
--  2) ENRICHISSEMENT : on renvoie le vrai titre de la source (live_sessions.title
--     ou courses.title), son statut et sa date, pour que le front puisse GROUPER
--     et ÉTIQUETER par source au lieu d'un « Questions — live » générique.
--
-- SECURITY DEFINER : compte les messages (service_role) + lit live_sessions /
-- courses sans buter sur leurs RLS. Le filtre tenant (tm.tenant_id = c.tenant_id)
-- garantit l'absence de fuite cross-tenant.
-- ============================================================================

DROP FUNCTION IF EXISTS public.get_forum_topics(integer);

CREATE OR REPLACE FUNCTION public.get_forum_topics(p_limit integer DEFAULT 100)
RETURNS TABLE (
  id                  uuid,
  subject             text,
  context_type        text,
  context_id          uuid,
  created_by          uuid,
  created_at          timestamptz,
  updated_at          timestamptz,
  message_count       bigint,
  source_question_id  uuid,
  source_formation_id uuid,
  context_title       text,
  context_status      text,
  context_at          timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.id,
    COALESCE(NULLIF(c.subject, ''), c.name, 'Sujet') AS subject,
    c.context_type,
    c.context_id,
    c.created_by,
    c.created_at,
    c.updated_at,
    -- Compte les VRAIS messages (exclut les sentinelles techniques `__live_*`).
    (SELECT count(*) FROM public.messages m
       WHERE m.conversation_id = c.id
         AND substr(COALESCE(m.subject, ''), 1, 2) <> '__') AS message_count,
    c.source_question_id,
    c.source_formation_id,
    -- Titre lisible de la source (live > cours > sujet).
    COALESCE(ls.title, co.title, NULLIF(c.subject, ''), c.name) AS context_title,
    ls.status::text AS context_status,
    COALESCE(ls.started_at, ls.scheduled_at, c.created_at) AS context_at
  FROM public.conversations c
  LEFT JOIN public.live_sessions ls ON c.context_type = 'live' AND ls.id = c.context_id
  LEFT JOIN public.courses co       ON c.context_type IN ('course','video') AND co.id = c.context_id
  WHERE c.kind = 'topic'
    AND (
      -- PUBLIC : tout membre actif du tenant (questions communautaires)
      (c.visibility = 'public' AND EXISTS (
        SELECT 1 FROM public.tenant_memberships tm
        WHERE tm.tenant_id = c.tenant_id AND tm.user_id = auth.uid() AND tm.status = 'active'
      ))
      OR
      -- CONTEXTE (live / cours) : forum communautaire → tout membre actif du tenant
      (c.visibility = 'context' AND EXISTS (
        SELECT 1 FROM public.tenant_memberships tm
        WHERE tm.tenant_id = c.tenant_id AND tm.user_id = auth.uid() AND tm.status = 'active'
      ))
      OR
      -- PRIVÉ (messagerie 1-1) : participants uniquement
      (c.visibility = 'private' AND EXISTS (
        SELECT 1 FROM public.conversation_participants cp
        WHERE cp.conversation_id = c.id AND cp.user_id = auth.uid()
      ))
    )
  ORDER BY c.updated_at DESC NULLS LAST
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 100), 200));
$$;

REVOKE ALL ON FUNCTION public.get_forum_topics(integer) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_forum_topics(integer) TO authenticated;

COMMENT ON FUNCTION public.get_forum_topics(integer) IS
  'Forum unifié GROUPÉ PAR SOURCE : Sujets kind=topic visibles (public+context=membre tenant, private=participant) + message_count + titre/statut/date de la source (live/cours). SECURITY DEFINER.';
