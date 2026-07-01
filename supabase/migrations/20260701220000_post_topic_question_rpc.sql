-- Poser une question (avec clip optionnel) dans le Sujet forum d'un live/cours.
-- SECURITY DEFINER (messages = service_role) ; garde : membre actif du tenant.
-- Le clip (début/fin en secondes) est préfixé au contenu (⏱️ [MM:SS–MM:SS]).
CREATE OR REPLACE FUNCTION public.post_topic_question(
  p_context_type text,
  p_context_id   uuid,
  p_question     text,
  p_clip_start   numeric DEFAULT NULL,
  p_clip_end     numeric DEFAULT NULL,
  p_is_public    boolean DEFAULT true
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant uuid;
  v_topic  uuid;
  v_uid    uuid;
  v_clip   text;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentification requise'; END IF;
  IF COALESCE(NULLIF(trim(p_question), ''), NULL) IS NULL THEN RAISE EXCEPTION 'Question vide'; END IF;

  IF p_context_type = 'live' THEN
    SELECT tenant_id INTO v_tenant FROM public.live_sessions WHERE id = p_context_id;
  ELSE
    SELECT tenant_id INTO v_tenant FROM public.courses WHERE id = p_context_id;
  END IF;
  IF v_tenant IS NULL THEN RAISE EXCEPTION 'Contexte introuvable'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.tenant_memberships tm
    WHERE tm.tenant_id = v_tenant AND tm.user_id = v_uid AND tm.status = 'active'
  ) THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;

  SELECT id INTO v_topic
  FROM public.conversations
  WHERE kind = 'topic' AND context_type = p_context_type AND context_id = p_context_id AND tenant_id = v_tenant
  LIMIT 1;
  IF v_topic IS NULL THEN
    INSERT INTO public.conversations (tenant_id, kind, type, name, subject, status, visibility, context_type, context_id, created_by, created_at, updated_at)
    VALUES (v_tenant, 'topic', 'group', 'Sujet', 'Sujet', 'open', 'context', p_context_type, p_context_id, v_uid, now(), now())
    RETURNING id INTO v_topic;
  END IF;

  INSERT INTO public.conversation_participants (tenant_id, conversation_id, user_id, joined_at)
  VALUES (v_tenant, v_topic, v_uid, now())
  ON CONFLICT (conversation_id, user_id) DO NOTHING;

  v_clip := CASE
    WHEN p_clip_start IS NOT NULL AND p_clip_end IS NOT NULL
    THEN '⏱️ [' || to_char((p_clip_start || ' seconds')::interval, 'MI:SS') || '–' || to_char((p_clip_end || ' seconds')::interval, 'MI:SS') || '] '
    ELSE '' END;

  INSERT INTO public.messages (tenant_id, conversation_id, sender_id, recipient_id, subject, content, created_at)
  VALUES (v_tenant, v_topic, v_uid, NULL,
          '❓ Question' || CASE WHEN p_is_public THEN '' ELSE ' (privée)' END,
          v_clip || trim(p_question), now());

  UPDATE public.conversations SET updated_at = now() WHERE id = v_topic;
  RETURN v_topic;
END $$;

REVOKE ALL ON FUNCTION public.post_topic_question(text, uuid, text, numeric, numeric, boolean) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.post_topic_question(text, uuid, text, numeric, numeric, boolean) TO authenticated;
