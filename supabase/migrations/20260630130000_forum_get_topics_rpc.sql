-- ============================================================================
-- RPC get_forum_topics — lecture unifiée du forum SANS l'API NestJS.
-- Les `messages` sont en lecture service_role (le front ne peut pas les compter
-- via PostgREST). Cette fonction SECURITY DEFINER renvoie les Sujets kind='topic'
-- VISIBLES par l'appelant (mêmes règles que les policies topic_public_read /
-- topic_participant_read) + le compte de messages, sans exposer les messages.
-- Le front appelle: supabase.rpc('get_forum_topics', { p_limit: 100 }).
-- ============================================================================

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
  source_formation_id uuid
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
    (SELECT count(*) FROM public.messages m WHERE m.conversation_id = c.id) AS message_count,
    c.source_question_id,
    c.source_formation_id
  FROM public.conversations c
  WHERE c.kind = 'topic'
    AND (
      -- PUBLIC : tout membre actif du tenant (réplique topic_public_read_members)
      (c.visibility = 'public' AND EXISTS (
        SELECT 1 FROM public.tenant_memberships tm
        WHERE tm.tenant_id = c.tenant_id
          AND tm.user_id = auth.uid()
          AND tm.status = 'active'
      ))
      OR
      -- PRIVÉ / CONTEXTE : participant (réplique topic_participant_read)
      (c.visibility IN ('private','context') AND EXISTS (
        SELECT 1 FROM public.conversation_participants cp
        WHERE cp.conversation_id = c.id
          AND cp.user_id = auth.uid()
      ))
    )
  ORDER BY c.updated_at DESC NULLS LAST
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 100), 200));
$$;

REVOKE ALL ON FUNCTION public.get_forum_topics(integer) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_forum_topics(integer) TO authenticated;

COMMENT ON FUNCTION public.get_forum_topics(integer) IS
  'Forum unifié : Sujets kind=topic visibles par l''appelant (public=membre tenant, private/context=participant) + message_count. SECURITY DEFINER pour compter les messages (service_role) sans les exposer.';
