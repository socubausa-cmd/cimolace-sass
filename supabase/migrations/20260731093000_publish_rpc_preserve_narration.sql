-- ═══════════════════════════════════════════════════════════════════════════
-- MASTER FACTORY — la republication ne doit plus DÉTRUIRE la narration.
--
-- Défaut constaté le 2026-07-31 (perte de données silencieuse) : republier un
-- projet (p_replace = true, ce que fait tout import depuis l'arène) supprimait
-- les scènes puis les réinsérait avec `audio_url` issu du payload, c'est-à-dire
-- TOUJOURS NULL. Résultat : les MP3 de narration restaient orphelins dans le
-- bucket et le direct redevenait muet, sans aucun message. Un enseignant qui
-- avait narré 12 scènes perdait tout son travail en un clic.
--
-- Correction : avant la purge, on mémorise l'audio existant par `order_index`
-- (la seule clé stable entre deux publications d'un même projet), puis on le
-- réapplique aux scènes réinsérées quand le payload n'en fournit pas.
-- `p_reset_audio` permet de demander explicitement l'oubli (nouveau contenu).
--
-- Le reste est identique à 20260731091000 : verrou FOR UPDATE, purge conjointe
-- scènes+prompteur, anti-doublon, fusion de config. Signature INCHANGÉE pour
-- l'appelant historique ; `p_reset_audio` a une valeur par défaut.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.publish_master_factory_stack(
  p_session_id   uuid,
  p_blueprint    jsonb,
  p_scenes       jsonb,
  p_scripts      jsonb,
  p_config_patch jsonb,
  p_replace      boolean,
  p_reset_audio  boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_scenes    integer := 0;
  v_scripts   integer := 0;
  v_preserved integer := 0;
BEGIN
  PERFORM 1 FROM public.live_sessions WHERE id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'session introuvable';
  END IF;

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

  -- Mémoire de la narration existante, AVANT toute suppression. Table temporaire
  -- liée à la transaction : elle disparaît avec elle, y compris en cas d'échec.
  CREATE TEMP TABLE IF NOT EXISTS _mf_audio_carry (
    order_index integer PRIMARY KEY,
    audio_url   text
  ) ON COMMIT DROP;
  -- `WHERE true` explicite : la garde « safe update » de Supabase refuse un
  -- DELETE sans clause WHERE, y compris sur une table temporaire.
  DELETE FROM _mf_audio_carry WHERE true;

  IF NOT p_reset_audio THEN
    INSERT INTO _mf_audio_carry (order_index, audio_url)
    SELECT order_index, audio_url
      FROM public.live_scenes
     WHERE live_session_id = p_session_id
       AND audio_url IS NOT NULL
       AND order_index IS NOT NULL
    ON CONFLICT (order_index) DO NOTHING;
    SELECT count(*) INTO v_preserved FROM _mf_audio_carry;
  END IF;

  IF p_replace THEN
    DELETE FROM public.live_scenes WHERE live_session_id = p_session_id;
    DELETE FROM public.live_script_sections WHERE session_id = p_session_id::text;
  END IF;

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
      NULLIF(
        CASE
          WHEN COALESCE(s.value->>'render_mode', s.value->'content_payload_json'->>'render_mode')
               IN ('progressive', 'instant', 'spotlight')
          THEN COALESCE(s.value->>'render_mode', s.value->'content_payload_json'->>'render_mode')
          ELSE NULL
        END, ''),
      -- Priorité au payload ; à défaut, la narration déjà produite pour ce rang.
      COALESCE(
        NULLIF(COALESCE(s.value->>'audio_url', s.value->'content_payload_json'->>'audio_url'), ''),
        (SELECT c.audio_url FROM _mf_audio_carry c
          WHERE c.order_index = COALESCE(NULLIF(s.value->>'order_index', '')::integer, s.ordinality::integer - 1))
      )
    FROM jsonb_array_elements(COALESCE(p_scenes, '[]'::jsonb))
      WITH ORDINALITY AS s(value, ordinality);
    GET DIAGNOSTICS v_scenes = ROW_COUNT;
  END IF;

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

  UPDATE public.live_sessions
     SET config = COALESCE(config, '{}'::jsonb) || COALESCE(p_config_patch, '{}'::jsonb)
   WHERE id = p_session_id;

  RETURN jsonb_build_object(
    'scenes_inserted',   v_scenes,
    'scripts_inserted',  v_scripts,
    'audio_preserved',   v_preserved
  );
END;
$$;

REVOKE ALL ON FUNCTION public.publish_master_factory_stack(uuid, jsonb, jsonb, jsonb, jsonb, boolean, boolean)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.publish_master_factory_stack(uuid, jsonb, jsonb, jsonb, jsonb, boolean, boolean)
  TO service_role;

-- ⚠️ La version à 6 arguments doit DISPARAÎTRE : avec un 7e paramètre à valeur
-- par défaut, PostgreSQL préfère la surcharge exacte quand l'appelant passe
-- 6 arguments — l'API aurait donc continué d'utiliser l'ancienne fonction et de
-- perdre la narration à chaque republication.
DROP FUNCTION IF EXISTS public.publish_master_factory_stack(uuid, jsonb, jsonb, jsonb, jsonb, boolean);
