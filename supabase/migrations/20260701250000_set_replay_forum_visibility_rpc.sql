-- ============================================================================
-- LOT 3 — Publier le replay au forum en PUBLIC ou PRIVÉ (fin de post-production).
-- ----------------------------------------------------------------------------
-- Le Sujet forum d'un live est créé en visibility='context' (visible par tout
-- membre actif du tenant = forum communautaire). En fin de post-prod, l'encadrant
-- doit pouvoir :
--   • PUBLIC  → visibility='public'  : le Sujet reste dans le forum communautaire.
--   • PRIVÉ   → visibility='private' : le Sujet sort du forum communautaire et
--               n'est visible que par ses participants. Pour ne pas l'orpheliner,
--               on garantit l'encadrant (auth.uid()) + l'hôte du live en participants.
--
-- La VIDÉO elle-même reste accessible via get_replay_room (garde membre tenant) —
-- la visibilité ne pilote QUE le référencement/lecture dans le forum.
-- SECURITY DEFINER : conversations/messages sont écrits en service_role. Garde
-- encadrant (owner/admin/practitioner), même que request_replay_postprod.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.set_replay_forum_visibility(p_session_id uuid, p_visibility text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant uuid;
  v_host   uuid;
  v_title  text;
  v_topic  uuid;
BEGIN
  IF p_visibility NOT IN ('public', 'private') THEN
    RAISE EXCEPTION 'Visibilité invalide (public|private)';
  END IF;

  SELECT tenant_id, COALESCE(host_user_id, teacher_id), COALESCE(NULLIF(title, ''), 'Live')
    INTO v_tenant, v_host, v_title
  FROM public.live_sessions WHERE id = p_session_id;
  IF v_tenant IS NULL THEN RAISE EXCEPTION 'Live introuvable'; END IF;

  -- Garde encadrant du tenant.
  IF NOT EXISTS (
    SELECT 1 FROM public.tenant_memberships tm
    WHERE tm.tenant_id = v_tenant AND tm.user_id = auth.uid()
      AND tm.status = 'active' AND tm.role IN ('owner', 'admin', 'practitioner')
  ) THEN
    RAISE EXCEPTION 'Réservé à un encadrant du tenant';
  END IF;

  -- Sujet du live (get-or-create, même forme que le trigger replay).
  SELECT id INTO v_topic
  FROM public.conversations
  WHERE kind = 'topic' AND context_type = 'live' AND context_id = p_session_id AND tenant_id = v_tenant
  LIMIT 1;
  IF v_topic IS NULL THEN
    INSERT INTO public.conversations (
      tenant_id, kind, type, name, subject, status, visibility, context_type, context_id, created_by, created_at, updated_at
    ) VALUES (
      v_tenant, 'topic', 'group', v_title, v_title, 'open', p_visibility, 'live', p_session_id, COALESCE(v_host, auth.uid()), now(), now()
    ) RETURNING id INTO v_topic;
  ELSE
    UPDATE public.conversations SET visibility = p_visibility, updated_at = now() WHERE id = v_topic;
  END IF;

  -- En PRIVÉ : garantir encadrant + hôte en participants (sinon le Sujet devient
  -- invisible pour tout le monde dans le forum). En PUBLIC : rien à faire.
  IF p_visibility = 'private' THEN
    INSERT INTO public.conversation_participants (tenant_id, conversation_id, user_id)
    SELECT v_tenant, v_topic, s.u
    FROM (SELECT auth.uid() AS u UNION SELECT v_host) s
    WHERE s.u IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.conversation_participants cp
        WHERE cp.conversation_id = v_topic AND cp.user_id = s.u
      );
  END IF;

  RETURN jsonb_build_object('topic_id', v_topic, 'visibility', p_visibility);
END $$;

REVOKE ALL ON FUNCTION public.set_replay_forum_visibility(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.set_replay_forum_visibility(uuid, text) TO authenticated;

COMMENT ON FUNCTION public.set_replay_forum_visibility(uuid, text) IS
  'Lot 3 : publie le Sujet forum d''un live en public|private (fin de post-prod). Garde encadrant. En privé, ajoute encadrant+hôte en participants. SECURITY DEFINER.';

-- ----------------------------------------------------------------------------
-- get_replay_room v2 : renvoie en plus l'état forum (topic_id + visibility), le
-- droit de gestion (can_manage = encadrant ?) et workflow_status, pour que la
-- salle de replay affiche le bon état des contrôles encadrant.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_replay_room(p_session_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'session', jsonb_build_object(
      'id', ls.id,
      'title', ls.title,
      'started_at', ls.started_at,
      'cover_image_url', ls.cover_image_url
    ),
    'state', CASE WHEN st.live_session_id IS NULL THEN NULL ELSE jsonb_build_object(
      'live_session_id', st.live_session_id,
      'replay_public_url', st.replay_public_url,
      'chapters', st.chapters,
      'transcript_text', st.transcript_text,
      'replay_poster_url', st.replay_poster_url,
      'workflow_status', st.workflow_status
    ) END,
    'forum', (
      SELECT jsonb_build_object('topic_id', c.id, 'visibility', c.visibility)
      FROM public.conversations c
      WHERE c.kind = 'topic' AND c.context_type = 'live' AND c.context_id = ls.id AND c.tenant_id = ls.tenant_id
      LIMIT 1
    ),
    'can_manage', EXISTS (
      SELECT 1 FROM public.tenant_memberships tm
      WHERE tm.tenant_id = ls.tenant_id AND tm.user_id = auth.uid()
        AND tm.status = 'active' AND tm.role IN ('owner', 'admin', 'practitioner')
    )
  )
  FROM public.live_sessions ls
  LEFT JOIN public.live_neuro_recall_state st ON st.live_session_id = ls.id
  WHERE ls.id = p_session_id
    AND EXISTS (
      SELECT 1 FROM public.tenant_memberships tm
      WHERE tm.tenant_id = ls.tenant_id AND tm.user_id = auth.uid() AND tm.status = 'active'
    );
$$;

REVOKE ALL ON FUNCTION public.get_replay_room(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_replay_room(uuid) TO authenticated;

COMMENT ON FUNCTION public.get_replay_room(uuid) IS
  'Salle de replay v2 : session + état recall + forum (topic_id, visibility) + can_manage (encadrant) + workflow_status. SECURITY DEFINER, garde membre tenant.';
