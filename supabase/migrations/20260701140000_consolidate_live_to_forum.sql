-- ============================================================================
-- consolidate_live_to_forum(p_live_id) — AGRÈGE tout ce qu'un live produit dans
-- son Sujet forum (conversations kind='topic', context_type='live').
-- ----------------------------------------------------------------------------
-- Objectif (user) : « tout ce que recall fait doit être dans le forum » — un live
-- regroupe, dans SON fil, l'ensemble de ses productions :
--   • 📝 Récap IA        (live_session_summaries.ai_summary + live_neuro_recall_reports + live_sessions.summary)
--   • ❓ Questions NeuronQ (live_neuronq_questions)
--   • ❓ Questions du live (live_questions, + réponse éventuelle)
--   • 💬 Chat du live     (live_session_chat + live_chat_messages)
--   • ▶️ Replay           (live_recordings.output_url / storage_filepath)
--   • 🧾 Transcript       (live_sessions.transcript)
--
-- Chaque bloc a une SENTINELLE de subject (`__live_*`) → idempotent et ré-exécutable.
-- La sentinelle n'est posée QUE si le bloc a effectivement produit ≥1 message :
-- ainsi une production asynchrone (replay finalisé plus tard) sera bien reprise au
-- prochain passage. Le chat réutilise la sentinelle historique
-- `__live_consolidated__:<id>` (compat avec publishLiveTopic côté API).
--
-- SÉCURITÉ : SECURITY DEFINER (écrit dans messages = service_role) + GARDE : seul un
-- ENCADRANT actif du tenant du live (owner/admin/practitioner) peut consolider —
-- réplique la garde `isStaffRole` de publishLiveTopic. Filtre tenant = pas de fuite.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.consolidate_live_to_forum(p_live_id uuid)
RETURNS TABLE (topic_id uuid, posted integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant uuid;
  v_host   uuid;
  v_title  text;
  v_topic  uuid;
  v_posted int := 0;
  v_n      int;
  v_tmp    int;
  v_chat_sentinel text;
BEGIN
  -- 1) Live → tenant, host (sender des messages « système »), titre.
  SELECT tenant_id,
         COALESCE(host_user_id, teacher_id),
         COALESCE(NULLIF(title, ''), 'Live')
    INTO v_tenant, v_host, v_title
  FROM public.live_sessions
  WHERE id = p_live_id;

  IF v_tenant IS NULL THEN
    RETURN;  -- live inconnu → rien
  END IF;

  -- 2) GARDE : appelant = encadrant actif du tenant (comme publishLiveTopic).
  IF NOT EXISTS (
    SELECT 1 FROM public.tenant_memberships tm
    WHERE tm.tenant_id = v_tenant
      AND tm.user_id  = auth.uid()
      AND tm.status   = 'active'
      AND tm.role IN ('owner', 'admin', 'practitioner')
  ) THEN
    RAISE EXCEPTION 'Consolidation réservée à un encadrant du tenant';
  END IF;

  -- 3) Sujet du live (get-or-create). Un seul par (tenant,'live',live_id).
  SELECT id INTO v_topic
  FROM public.conversations
  WHERE kind = 'topic' AND context_type = 'live'
    AND context_id = p_live_id AND tenant_id = v_tenant
  LIMIT 1;

  IF v_topic IS NULL THEN
    INSERT INTO public.conversations (
      tenant_id, kind, type, name, subject, status, visibility,
      context_type, context_id, created_by, created_at, updated_at
    ) VALUES (
      v_tenant, 'topic', 'group', v_title, v_title, 'open', 'context',
      'live', p_live_id, v_host, now(), now()
    ) RETURNING id INTO v_topic;
  END IF;

  -- Sender « système » : host, sinon créateur du Sujet. Sans lui, pas de post possible.
  v_host := COALESCE(v_host, (SELECT created_by FROM public.conversations WHERE id = v_topic));
  IF v_host IS NULL THEN
    RETURN QUERY SELECT v_topic, 0;
    RETURN;
  END IF;

  -- 4) 📝 RÉCAP (summaries + recall_reports + sessions.summary).
  --    On évite le doublon avec le récap posté par l'edge neuro-recall-bootstrap
  --    (préfixe '📋 Récap').
  IF NOT EXISTS (SELECT 1 FROM public.messages WHERE conversation_id = v_topic AND subject = '__live_recap__')
     AND NOT EXISTS (SELECT 1 FROM public.messages WHERE conversation_id = v_topic AND content ILIKE '📋 Récap%')
  THEN
    v_n := 0;
    INSERT INTO public.messages (tenant_id, conversation_id, sender_id, recipient_id, subject, content, created_at)
    SELECT v_tenant, v_topic, v_host, NULL, '📝 Récap du live', s.ai_summary, COALESCE(s.created_at, now())
    FROM public.live_session_summaries s
    WHERE s.session_id = p_live_id::text AND COALESCE(s.ai_summary, '') <> '';
    GET DIAGNOSTICS v_tmp = ROW_COUNT; v_n := v_n + v_tmp;

    INSERT INTO public.messages (tenant_id, conversation_id, sender_id, recipient_id, subject, content, created_at)
    SELECT v_tenant, v_topic, v_host, NULL, '📝 ' || COALESCE(NULLIF(r.title, ''), 'Point clé'), r.content, COALESCE(r.created_at, now())
    FROM public.live_neuro_recall_reports r
    WHERE r.live_session_id = p_live_id AND COALESCE(r.content, '') <> '';
    GET DIAGNOSTICS v_tmp = ROW_COUNT; v_n := v_n + v_tmp;

    INSERT INTO public.messages (tenant_id, conversation_id, sender_id, recipient_id, subject, content, created_at)
    SELECT v_tenant, v_topic, v_host, NULL, '📝 Récap du live', ls.summary, now()
    FROM public.live_sessions ls
    WHERE ls.id = p_live_id AND COALESCE(ls.summary, '') <> ''
      AND NOT EXISTS (SELECT 1 FROM public.live_session_summaries s2 WHERE s2.session_id = p_live_id::text AND COALESCE(s2.ai_summary,'') <> '');
    GET DIAGNOSTICS v_tmp = ROW_COUNT; v_n := v_n + v_tmp;

    IF v_n > 0 THEN
      INSERT INTO public.messages (tenant_id, conversation_id, sender_id, subject, content)
      VALUES (v_tenant, v_topic, v_host, '__live_recap__', 'sentinelle recap');
      v_posted := v_posted + v_n;
    END IF;
  END IF;

  -- 5) ❓ Questions NeuronQ (live_neuronq_questions) au nom de leur auteur.
  IF NOT EXISTS (SELECT 1 FROM public.messages WHERE conversation_id = v_topic AND subject = '__live_neuronq__') THEN
    INSERT INTO public.messages (tenant_id, conversation_id, sender_id, recipient_id, subject, content, created_at)
    SELECT v_tenant, v_topic, COALESCE(q.user_id, v_host), NULL, '❓ Question (NeuronQ)',
           COALESCE(NULLIF(q.reformulated_text, ''), q.raw_text), COALESCE(q.created_at, now())
    FROM public.live_neuronq_questions q
    WHERE q.live_session_id = p_live_id
      AND COALESCE(NULLIF(q.reformulated_text, ''), q.raw_text, '') <> '';
    GET DIAGNOSTICS v_n = ROW_COUNT;
    IF v_n > 0 THEN
      INSERT INTO public.messages (tenant_id, conversation_id, sender_id, subject, content)
      VALUES (v_tenant, v_topic, v_host, '__live_neuronq__', 'sentinelle neuronq');
      v_posted := v_posted + v_n;
    END IF;
  END IF;

  -- 6) ❓ Questions du live (live_questions, + réponse éventuelle).
  IF NOT EXISTS (SELECT 1 FROM public.messages WHERE conversation_id = v_topic AND subject = '__live_questions__') THEN
    INSERT INTO public.messages (tenant_id, conversation_id, sender_id, recipient_id, subject, content, created_at)
    SELECT v_tenant, v_topic, COALESCE(q.user_id, v_host), NULL, '❓ Question',
           q.content || CASE WHEN COALESCE(q.answer, '') <> '' THEN E'\n\n↳ ' || q.answer ELSE '' END,
           COALESCE(q.created_at, now())
    FROM public.live_questions q
    WHERE q.live_session_id = p_live_id AND COALESCE(q.content, '') <> '';
    GET DIAGNOSTICS v_n = ROW_COUNT;
    IF v_n > 0 THEN
      INSERT INTO public.messages (tenant_id, conversation_id, sender_id, subject, content)
      VALUES (v_tenant, v_topic, v_host, '__live_questions__', 'sentinelle questions');
      v_posted := v_posted + v_n;
    END IF;
  END IF;

  -- 7) 💬 Chat du live (live_session_chat + live_chat_messages). Réutilise la
  --    sentinelle historique de publishLiveTopic pour éviter tout doublon.
  v_chat_sentinel := '__live_consolidated__:' || p_live_id::text;
  IF NOT EXISTS (SELECT 1 FROM public.messages WHERE conversation_id = v_topic AND subject = v_chat_sentinel) THEN
    v_n := 0;
    INSERT INTO public.messages (tenant_id, conversation_id, sender_id, recipient_id, subject, content, created_at)
    SELECT v_tenant, v_topic, ch.user_id, NULL, '', ch.message, ch.created_at
    FROM public.live_session_chat ch
    WHERE ch.live_session_id = p_live_id AND COALESCE(ch.message, '') <> '' AND ch.user_id IS NOT NULL;
    GET DIAGNOSTICS v_tmp = ROW_COUNT; v_n := v_n + v_tmp;

    INSERT INTO public.messages (tenant_id, conversation_id, sender_id, recipient_id, subject, content, created_at)
    SELECT v_tenant, v_topic, cm.user_id, NULL, '', cm.content, cm.created_at
    FROM public.live_chat_messages cm
    WHERE cm.live_session_id = p_live_id AND COALESCE(cm.content, '') <> '' AND cm.user_id IS NOT NULL;
    GET DIAGNOSTICS v_tmp = ROW_COUNT; v_n := v_n + v_tmp;

    IF v_n > 0 THEN
      INSERT INTO public.messages (tenant_id, conversation_id, sender_id, subject, content)
      VALUES (v_tenant, v_topic, v_host, v_chat_sentinel, 'sentinelle chat');
      v_posted := v_posted + v_n;
    END IF;
  END IF;

  -- 8) ▶️ Replay (live_recordings). Lien = output_url sinon storage_filepath.
  IF NOT EXISTS (SELECT 1 FROM public.messages WHERE conversation_id = v_topic AND subject = '__live_replay__') THEN
    INSERT INTO public.messages (tenant_id, conversation_id, sender_id, recipient_id, subject, content, created_at)
    SELECT v_tenant, v_topic, v_host, NULL, '▶️ Replay',
           'Replay disponible' ||
           CASE WHEN rec.duration_seconds IS NOT NULL THEN ' (' || rec.duration_seconds || ' s)' ELSE '' END ||
           E'\n' || COALESCE(rec.output_url, rec.storage_filepath),
           COALESCE(rec.completed_at, rec.created_at, now())
    FROM public.live_recordings rec
    WHERE rec.live_session_id = p_live_id
      AND COALESCE(rec.output_url, rec.storage_filepath) IS NOT NULL;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    IF v_n > 0 THEN
      INSERT INTO public.messages (tenant_id, conversation_id, sender_id, subject, content)
      VALUES (v_tenant, v_topic, v_host, '__live_replay__', 'sentinelle replay');
      v_posted := v_posted + v_n;
    END IF;
  END IF;

  -- 9) 🧾 Transcript brut (live_sessions.transcript).
  IF NOT EXISTS (SELECT 1 FROM public.messages WHERE conversation_id = v_topic AND subject = '__live_transcript__') THEN
    INSERT INTO public.messages (tenant_id, conversation_id, sender_id, recipient_id, subject, content, created_at)
    SELECT v_tenant, v_topic, v_host, NULL, '🧾 Transcript', ls.transcript, now()
    FROM public.live_sessions ls
    WHERE ls.id = p_live_id AND COALESCE(ls.transcript, '') <> '';
    GET DIAGNOSTICS v_n = ROW_COUNT;
    IF v_n > 0 THEN
      INSERT INTO public.messages (tenant_id, conversation_id, sender_id, subject, content)
      VALUES (v_tenant, v_topic, v_host, '__live_transcript__', 'sentinelle transcript');
      v_posted := v_posted + v_n;
    END IF;
  END IF;

  -- 10) Remonter le Sujet dans le listing.
  UPDATE public.conversations SET updated_at = now() WHERE id = v_topic;

  RETURN QUERY SELECT v_topic, v_posted;
END $$;

REVOKE ALL ON FUNCTION public.consolidate_live_to_forum(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.consolidate_live_to_forum(uuid) TO authenticated;

COMMENT ON FUNCTION public.consolidate_live_to_forum(uuid) IS
  'Agrège toutes les productions d''un live (récap, NeuronQ, questions, chat, replay, transcript) dans son Sujet forum. Idempotent (sentinelles __live_*), garde encadrant, SECURITY DEFINER.';
