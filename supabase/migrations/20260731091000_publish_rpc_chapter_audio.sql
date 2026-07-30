-- ═══════════════════════════════════════════════════════════════════════════
-- MASTER FACTORY — la publication atomique transporte désormais le chapitre,
-- le mode de rendu et la narration de chaque scène.
--
-- Suite de 20260730092000 : même signature, même sémantique transactionnelle
-- (verrou FOR UPDATE, purge conjointe scènes+prompteur, anti-doublon, fusion
-- de config). Seule l'insertion des scènes change : elle renseigne les trois
-- colonnes créées par 20260731090000 au lieu de les laisser à NULL.
--
-- COALESCE sur content_payload_json : si l'appelant n'envoie pas encore les
-- champs à plat, on les récupère dans le JSON de la scène — un déploiement API
-- en retard ne fait donc pas perdre le chapitre.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.publish_master_factory_stack(
  p_session_id   uuid,
  p_blueprint    jsonb,
  p_scenes       jsonb,
  p_scripts      jsonb,
  p_config_patch jsonb,
  p_replace      boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_scenes  integer := 0;
  v_scripts integer := 0;
BEGIN
  -- 1) Verrou de session : sérialise les publications concurrentes.
  PERFORM 1 FROM public.live_sessions WHERE id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'session introuvable';
  END IF;

  -- 2) Blueprint : UNIQUE(live_session_id) → upsert.
  IF p_blueprint IS NOT NULL AND jsonb_typeof(p_blueprint) = 'object' THEN
    INSERT INTO public.live_blueprints (
      live_session_id, outline_json, goals_json, key_points_json,
      private_notes, estimated_duration_minutes, blueprint_score
    )
    VALUES (
      p_session_id,
      COALESCE(p_blueprint->'outline_json', '{}'::jsonb),
      COALESCE(p_blueprint->'goals_json', '{}'::jsonb),
      COALESCE(p_blueprint->'key_points_json', '[]'::jsonb),
      NULLIF(p_blueprint->>'private_notes', ''),
      NULLIF(p_blueprint->>'estimated_duration_minutes', '')::integer,
      NULLIF(p_blueprint->>'blueprint_score', '')::numeric
    )
    ON CONFLICT (live_session_id) DO UPDATE SET
      outline_json               = EXCLUDED.outline_json,
      goals_json                 = EXCLUDED.goals_json,
      key_points_json            = EXCLUDED.key_points_json,
      private_notes              = EXCLUDED.private_notes,
      estimated_duration_minutes = EXCLUDED.estimated_duration_minutes,
      blueprint_score            = EXCLUDED.blueprint_score,
      updated_at                 = now();
  END IF;

  -- 3) Remplacement : scènes ET prompteur ensemble, jamais l'un sans l'autre.
  IF p_replace THEN
    DELETE FROM public.live_scenes WHERE live_session_id = p_session_id;
    DELETE FROM public.live_script_sections WHERE session_id = p_session_id::text;
  END IF;

  -- 4) Scènes — avec chapitre, mode de rendu et narration.
  IF p_replace OR NOT EXISTS (
    SELECT 1 FROM public.live_scenes WHERE live_session_id = p_session_id
  ) THEN
    INSERT INTO public.live_scenes (
      live_session_id, name, scene_type, order_index, is_active,
      content_payload_json, chapter_id, render_mode, audio_url
    )
    SELECT
      p_session_id,
      COALESCE(s.value->>'name', 'Scène'),
      COALESCE(s.value->>'scene_type', 'camera_only'),
      COALESCE(NULLIF(s.value->>'order_index', '')::integer, s.ordinality::integer - 1),
      COALESCE(NULLIF(s.value->>'is_active', '')::boolean, false),
      COALESCE(s.value->'content_payload_json', '{}'::jsonb),
      COALESCE(
        NULLIF(s.value->>'chapter_id', '')::integer,
        NULLIF(s.value->'content_payload_json'->>'chapter_id', '')::integer
      ),
      -- Un mode hors vocabulaire est ramené à NULL : la contrainte CHECK
      -- rejetterait toute la transaction, et perdre la publication entière
      -- pour une étiquette invalide serait pire que retomber sur le défaut.
      NULLIF(
        CASE
          WHEN COALESCE(
                 s.value->>'render_mode',
                 s.value->'content_payload_json'->>'render_mode'
               ) IN ('progressive', 'instant', 'spotlight')
          THEN COALESCE(
                 s.value->>'render_mode',
                 s.value->'content_payload_json'->>'render_mode'
               )
          ELSE NULL
        END, ''),
      NULLIF(
        COALESCE(
          s.value->>'audio_url',
          s.value->'content_payload_json'->>'audio_url'
        ), '')
    FROM jsonb_array_elements(COALESCE(p_scenes, '[]'::jsonb))
      WITH ORDINALITY AS s(value, ordinality);
    GET DIAGNOSTICS v_scenes = ROW_COUNT;
  END IF;

  -- 5) Prompteur : inchangé.
  IF p_replace OR NOT EXISTS (
    SELECT 1 FROM public.live_script_sections WHERE session_id = p_session_id::text
  ) THEN
    INSERT INTO public.live_script_sections (
      session_id, created_by, slide_index, order_index, title, content, master_agent
    )
    SELECT
      p_session_id::text,
      NULLIF(s.value->>'created_by', '')::uuid,
      NULLIF(s.value->>'slide_index', '')::integer,
      COALESCE(NULLIF(s.value->>'order_index', '')::integer, s.ordinality::integer - 1),
      NULLIF(s.value->>'title', ''),
      COALESCE(s.value->>'content', ''),
      s.value->'master_agent'
    FROM jsonb_array_elements(COALESCE(p_scripts, '[]'::jsonb))
      WITH ORDINALITY AS s(value, ordinality);
    GET DIAGNOSTICS v_scripts = ROW_COUNT;
  END IF;

  -- 6) Patch de config (fusion superficielle — les clés du patch gagnent).
  UPDATE public.live_sessions
     SET config = COALESCE(config, '{}'::jsonb) || COALESCE(p_config_patch, '{}'::jsonb)
   WHERE id = p_session_id;

  RETURN jsonb_build_object(
    'scenes_inserted',  v_scenes,
    'scripts_inserted', v_scripts
  );
END;
$$;

REVOKE ALL ON FUNCTION public.publish_master_factory_stack(uuid, jsonb, jsonb, jsonb, jsonb, boolean)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.publish_master_factory_stack(uuid, jsonb, jsonb, jsonb, jsonb, boolean)
  TO service_role;
