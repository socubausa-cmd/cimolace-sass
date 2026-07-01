-- ============================================================================
-- POINT 3 — La CARTE MENTALE / le plan d'un cours vidéo arrive dans le forum.
-- ----------------------------------------------------------------------------
-- La post-production d'un cours vidéo produit, dans formation_day_contents.data
-- (jsonb), un `mindmap` (arbre {label,children}) et des `chapters`
-- ({label,startSeconds,endSeconds}) = le mindmap linéarisé, plus lisible. Cette
-- RPC pousse ce plan dans le Sujet forum du cours (context_type='course'), pour
-- que « ce que la post-prod produit » soit aussi dans le forum, à côté des lives.
--
-- Chaîne prod : formation_day_contents.day_id → formation_days.week_id →
-- formation_weeks.module_id → modules.formation_id (= courses.id).
--
-- Garde encadrant (owner/admin/practitioner) + SECURITY DEFINER + idempotent
-- (sentinelle __course_plan__). Le sender est l'appelant (encadrant).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.consolidate_course_to_forum(p_course_id uuid)
RETURNS TABLE (topic_id uuid, posted integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant uuid;
  v_title  text;
  v_owner  uuid;
  v_topic  uuid;
  v_posted int := 0;
  v_n      int;
BEGIN
  SELECT tenant_id, COALESCE(NULLIF(title, ''), 'Cours')
    INTO v_tenant, v_title
  FROM public.courses WHERE id = p_course_id;
  IF v_tenant IS NULL THEN RETURN; END IF;

  -- Garde : appelant = encadrant actif du tenant.
  IF NOT EXISTS (
    SELECT 1 FROM public.tenant_memberships tm
    WHERE tm.tenant_id = v_tenant AND tm.user_id = auth.uid()
      AND tm.status = 'active' AND tm.role IN ('owner', 'admin', 'practitioner')
  ) THEN
    RAISE EXCEPTION 'Consolidation réservée à un encadrant du tenant';
  END IF;
  v_owner := auth.uid();

  -- Sujet du cours (get-or-create).
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

  -- 🗂️ Plan / carte mentale : un message par contenu vidéo, listant ses chapitres
  -- (label + timestamp) — le mindmap linéarisé, lisible.
  IF NOT EXISTS (SELECT 1 FROM public.messages WHERE conversation_id = v_topic AND subject = '__course_plan__') THEN
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
      v_posted := v_posted + v_n;
    END IF;
  END IF;

  UPDATE public.conversations SET updated_at = now() WHERE id = v_topic;
  RETURN QUERY SELECT v_topic, v_posted;
END $$;

REVOKE ALL ON FUNCTION public.consolidate_course_to_forum(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.consolidate_course_to_forum(uuid) TO authenticated;

COMMENT ON FUNCTION public.consolidate_course_to_forum(uuid) IS
  'Pousse le plan/carte mentale (chapitres des contenus vidéo post-produits) dans le Sujet forum du cours. Garde encadrant, idempotent (__course_plan__), SECURITY DEFINER.';
