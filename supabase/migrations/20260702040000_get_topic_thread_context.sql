-- get_topic_thread v2 — ajoute context_type + context_id (source du Sujet) pour
-- que le fil sache que c'est un live + QUELLE session → construire le lien
-- « Revoir dans la salle de révision » (/…/replay/:sessionId) plutôt qu'un lecteur
-- vidéo inline concurrent. Changement de signature → DROP + recreate.
DROP FUNCTION IF EXISTS public.get_topic_thread(uuid);

CREATE OR REPLACE FUNCTION public.get_topic_thread(p_topic_id uuid)
RETURNS TABLE (
  message_id    uuid,
  sender_id     uuid,
  sender_name   text,
  sender_avatar text,
  subject       text,
  content       text,
  created_at    timestamptz,
  is_own        boolean,
  context_type  text,
  context_id    uuid
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
    (m.sender_id = auth.uid()) AS is_own,
    c.context_type,
    c.context_id
  FROM public.messages m
  LEFT JOIN public.profiles p ON p.id = m.sender_id
  JOIN public.conversations c ON c.id = m.conversation_id AND c.kind = 'topic'
  WHERE m.conversation_id = p_topic_id
    AND substr(COALESCE(m.subject, ''), 1, 2) <> '__'
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
  ORDER BY m.created_at ASC;
$$;

REVOKE ALL ON FUNCTION public.get_topic_thread(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_topic_thread(uuid) TO authenticated;
