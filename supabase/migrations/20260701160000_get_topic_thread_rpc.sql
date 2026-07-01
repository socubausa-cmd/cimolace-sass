-- ============================================================================
-- get_topic_thread(p_topic_id) — lit le FIL d'un Sujet (messages) pour l'afficher
-- au clic depuis le forum. Les `messages` sont en lecture service_role → cette
-- fonction SECURITY DEFINER les renvoie SI l'appelant peut voir le Sujet (mêmes
-- règles que get_forum_topics : public/context = membre du tenant ; private =
-- participant), en EXCLUANT les sentinelles techniques `__live_*`, avec le nom de
-- l'auteur (profiles) et un drapeau is_own.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_topic_thread(p_topic_id uuid)
RETURNS TABLE (
  message_id    uuid,
  sender_id     uuid,
  sender_name   text,
  sender_avatar text,
  subject       text,
  content       text,
  created_at    timestamptz,
  is_own        boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    m.id,
    m.sender_id,
    COALESCE(NULLIF(p.full_name, ''), NULLIF(p.name, ''), 'Membre') AS sender_name,
    p.avatar_url,
    m.subject,
    m.content,
    m.created_at,
    (m.sender_id = auth.uid()) AS is_own
  FROM public.messages m
  LEFT JOIN public.profiles p ON p.id = m.sender_id
  WHERE m.conversation_id = p_topic_id
    AND substr(COALESCE(m.subject, ''), 1, 2) <> '__'  -- masque les sentinelles
    AND EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = p_topic_id AND c.kind = 'topic'
        AND (
          (c.visibility IN ('public', 'context') AND EXISTS (
            SELECT 1 FROM public.tenant_memberships tm
            WHERE tm.tenant_id = c.tenant_id AND tm.user_id = auth.uid() AND tm.status = 'active'
          ))
          OR
          (c.visibility = 'private' AND EXISTS (
            SELECT 1 FROM public.conversation_participants cp
            WHERE cp.conversation_id = c.id AND cp.user_id = auth.uid()
          ))
        )
    )
  ORDER BY m.created_at ASC;
$$;

REVOKE ALL ON FUNCTION public.get_topic_thread(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_topic_thread(uuid) TO authenticated;

COMMENT ON FUNCTION public.get_topic_thread(uuid) IS
  'Fil (messages) d''un Sujet forum, visible par l''appelant (public/context=membre tenant, private=participant), sentinelles exclues, avec auteur. SECURITY DEFINER.';
