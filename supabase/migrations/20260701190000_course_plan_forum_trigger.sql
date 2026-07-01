-- ============================================================================
-- POINT 3 (auto) — La carte mentale d'un cours arrive dans le forum TOUTE SEULE.
-- ----------------------------------------------------------------------------
-- Pendant/après la post-production d'un contenu vidéo (formation_day_contents.data
-- reçoit `chapters`/`mindmap`), un trigger pousse le plan dans le Sujet forum du
-- cours. Version SYSTÈME (sans garde auth, comme post_live_replay_to_forum) car
-- déclenchée par un événement de données, pas par un utilisateur. Sender = créateur
-- du cours (fallback : un owner/admin du tenant). Idempotent (__course_plan__).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.post_course_plan_to_forum(p_course_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant uuid;
  v_title  text;
  v_owner  uuid;
  v_topic  uuid;
  v_n      int;
BEGIN
  SELECT tenant_id, COALESCE(NULLIF(title, ''), 'Cours'), created_by
    INTO v_tenant, v_title, v_owner
  FROM public.courses WHERE id = p_course_id;
  IF v_tenant IS NULL THEN RETURN; END IF;

  v_owner := COALESCE(v_owner, (
    SELECT user_id FROM public.tenant_memberships
    WHERE tenant_id = v_tenant AND role IN ('owner', 'admin') AND status = 'active'
    ORDER BY role LIMIT 1
  ));
  IF v_owner IS NULL THEN RETURN; END IF;

  SELECT id INTO v_topic
  FROM public.conversations
  WHERE kind = 'topic' AND context_type = 'video' AND context_id = p_course_id AND tenant_id = v_tenant
  LIMIT 1;
  IF v_topic IS NULL THEN
    INSERT INTO public.conversations (
      tenant_id, kind, type, name, subject, status, visibility, context_type, context_id, created_by, created_at, updated_at
    ) VALUES (
      v_tenant, 'topic', 'group', v_title, v_title, 'open', 'context', 'video', p_course_id, v_owner, now(), now()
    ) RETURNING id INTO v_topic;
  END IF;

  IF EXISTS (SELECT 1 FROM public.messages WHERE conversation_id = v_topic AND subject = '__course_plan__') THEN
    RETURN;  -- plan déjà posté
  END IF;

  INSERT INTO public.messages (tenant_id, conversation_id, sender_id, recipient_id, subject, content, created_at)
  SELECT
    v_tenant, v_topic, v_owner, NULL,
    '🗂️ Carte mentale — ' || COALESCE(NULLIF(dc.data->>'title', ''), v_title),
    (
      SELECT string_agg(
        '• ' || COALESCE(ch->>'label', 'Section') ||
        CASE WHEN (ch->>'startSeconds') ~ '^[0-9]+$'
             THEN ' (' || to_char(((ch->>'startSeconds')::int || ' seconds')::interval, 'MI:SS') || ')'
             ELSE '' END,
        E'\n' ORDER BY COALESCE(NULLIF(ch->>'startSeconds','')::int, 0)
      )
      FROM jsonb_array_elements(dc.data->'chapters') ch
    ),
    COALESCE(dc.created_at, now())
  FROM public.formation_day_contents dc
  JOIN public.formation_days  d ON d.id = dc.day_id
  JOIN public.formation_weeks w ON w.id = d.week_id
  JOIN public.modules         m ON m.id = w.module_id
  WHERE m.formation_id = p_course_id
    AND dc.type = 'video'
    AND jsonb_typeof(dc.data->'chapters') = 'array'
    AND jsonb_array_length(dc.data->'chapters') > 0;
  GET DIAGNOSTICS v_n = ROW_COUNT;

  IF v_n > 0 THEN
    INSERT INTO public.messages (tenant_id, conversation_id, sender_id, subject, content)
    VALUES (v_tenant, v_topic, v_owner, '__course_plan__', 'sentinelle plan');
    UPDATE public.conversations SET updated_at = now() WHERE id = v_topic;
  END IF;
END $$;

REVOKE ALL ON FUNCTION public.post_course_plan_to_forum(uuid) FROM public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.trg_day_content_to_forum()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_course uuid;
BEGIN
  IF NEW.type = 'video'
     AND jsonb_typeof(NEW.data->'chapters') = 'array'
     AND jsonb_array_length(NEW.data->'chapters') > 0 THEN
    BEGIN
      SELECT m.formation_id INTO v_course
      FROM public.formation_days  d
      JOIN public.formation_weeks w ON w.id = d.week_id
      JOIN public.modules         m ON m.id = w.module_id
      WHERE d.id = NEW.day_id;
      IF v_course IS NOT NULL THEN
        PERFORM public.post_course_plan_to_forum(v_course);
      END IF;
    EXCEPTION WHEN OTHERS THEN
      NULL;  -- ne jamais bloquer la sauvegarde de post-prod
    END;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS day_content_forum_plan ON public.formation_day_contents;
CREATE TRIGGER day_content_forum_plan
  AFTER INSERT OR UPDATE OF data, type ON public.formation_day_contents
  FOR EACH ROW EXECUTE FUNCTION public.trg_day_content_to_forum();

COMMENT ON FUNCTION public.post_course_plan_to_forum(uuid) IS
  'Pousse la carte mentale/plan d''un cours dans son Sujet forum (idempotent, sans garde auth — événement système). Appelée par le trigger sur formation_day_contents.';
