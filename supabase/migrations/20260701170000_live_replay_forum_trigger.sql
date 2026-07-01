-- ============================================================================
-- POINT 2 — Le REPLAY (egress asynchrone) arrive dans le forum tout seul.
-- ----------------------------------------------------------------------------
-- Le replay d'un live est finalisé APRÈS la fin de session (egress LiveKit →
-- live_recordings.output_url/storage_filepath). Au moment de la consolidation en
-- fin de live, il n'existe pas encore. Ce trigger poste le message ▶️ Replay dans
-- le Sujet du live dès que l'enregistrement est prêt.
--
-- La fonction NE PORTE PAS de garde auth.uid() (contrairement à
-- consolidate_live_to_forum) : elle est déclenchée par un ÉVÉNEMENT SYSTÈME
-- (webhook egress / worker, en service_role, sans utilisateur). Elle n'est donc
-- PAS exposée à `authenticated` — seul le trigger l'appelle. Idempotente
-- (sentinelle `__live_replay__`). Tolérante aux erreurs : n'échoue jamais l'UPDATE
-- de live_recordings (sinon on casserait le pipeline d'enregistrement).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.post_live_replay_to_forum(p_live_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant uuid;
  v_host   uuid;
  v_title  text;
  v_topic  uuid;
  v_n      int;
BEGIN
  SELECT tenant_id, COALESCE(host_user_id, teacher_id), COALESCE(NULLIF(title, ''), 'Live')
    INTO v_tenant, v_host, v_title
  FROM public.live_sessions WHERE id = p_live_id;
  IF v_tenant IS NULL THEN RETURN; END IF;

  -- Sujet du live (get-or-create).
  SELECT id INTO v_topic
  FROM public.conversations
  WHERE kind = 'topic' AND context_type = 'live' AND context_id = p_live_id AND tenant_id = v_tenant
  LIMIT 1;
  IF v_topic IS NULL THEN
    INSERT INTO public.conversations (
      tenant_id, kind, type, name, subject, status, visibility, context_type, context_id, created_by, created_at, updated_at
    ) VALUES (
      v_tenant, 'topic', 'group', v_title, v_title, 'open', 'context', 'live', p_live_id, v_host, now(), now()
    ) RETURNING id INTO v_topic;
  END IF;

  v_host := COALESCE(v_host, (SELECT created_by FROM public.conversations WHERE id = v_topic));
  IF v_host IS NULL THEN RETURN; END IF;

  IF EXISTS (SELECT 1 FROM public.messages WHERE conversation_id = v_topic AND subject = '__live_replay__') THEN
    RETURN;  -- déjà posté
  END IF;

  INSERT INTO public.messages (tenant_id, conversation_id, sender_id, recipient_id, subject, content, created_at)
  SELECT v_tenant, v_topic, v_host, NULL, '▶️ Replay',
         'Replay disponible' ||
         CASE WHEN rec.duration_seconds IS NOT NULL THEN ' (' || rec.duration_seconds || ' s)' ELSE '' END ||
         E'\n' || COALESCE(rec.output_url, rec.storage_filepath),
         COALESCE(rec.completed_at, rec.created_at, now())
  FROM public.live_recordings rec
  WHERE rec.live_session_id = p_live_id
    AND COALESCE(rec.output_url, rec.storage_filepath) IS NOT NULL
  ORDER BY rec.completed_at DESC NULLS LAST
  LIMIT 1;
  GET DIAGNOSTICS v_n = ROW_COUNT;

  IF v_n > 0 THEN
    INSERT INTO public.messages (tenant_id, conversation_id, sender_id, subject, content)
    VALUES (v_tenant, v_topic, v_host, '__live_replay__', 'sentinelle replay');
    UPDATE public.conversations SET updated_at = now() WHERE id = v_topic;
  END IF;
END $$;

REVOKE ALL ON FUNCTION public.post_live_replay_to_forum(uuid) FROM public, anon, authenticated;

-- Trigger : à chaque enregistrement prêt (output_url/storage_filepath renseigné),
-- pousse le replay dans le forum. Tolérant : toute erreur est avalée pour ne JAMAIS
-- faire échouer l'écriture de live_recordings (pipeline egress).
CREATE OR REPLACE FUNCTION public.trg_live_recording_to_forum()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(NEW.output_url, NEW.storage_filepath) IS NOT NULL THEN
    BEGIN
      PERFORM public.post_live_replay_to_forum(NEW.live_session_id);
    EXCEPTION WHEN OTHERS THEN
      NULL;  -- ne jamais bloquer le pipeline d'enregistrement
    END;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS live_recording_forum_replay ON public.live_recordings;
CREATE TRIGGER live_recording_forum_replay
  AFTER INSERT OR UPDATE OF output_url, storage_filepath, status ON public.live_recordings
  FOR EACH ROW EXECUTE FUNCTION public.trg_live_recording_to_forum();

COMMENT ON FUNCTION public.post_live_replay_to_forum(uuid) IS
  'Poste le ▶️ Replay d''un live dans son Sujet forum (idempotent). Appelée par le trigger sur live_recordings — PAS de garde auth (événement système), non exposée à authenticated.';
