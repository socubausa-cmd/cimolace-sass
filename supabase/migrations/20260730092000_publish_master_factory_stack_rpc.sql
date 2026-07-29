-- ═══════════════════════════════════════════════════════════════════════════
-- MASTER FACTORY — publication ATOMIQUE de la pile blueprint + scènes +
-- prompteur + config d'une session live.
--
-- Pourquoi une RPC : l'API publiait ces 4 morceaux en 4 requêtes séparées —
-- un échec au milieu laissait une session à moitié équipée (blueprint sans
-- scènes, prompteur orphelin…). Ici tout vit dans la transaction implicite
-- de la fonction : la moindre erreur annule TOUT.
--
-- Concurrence : le SELECT … FOR UPDATE sur live_sessions sérialise les
-- publications simultanées sur la même session (la 2e attend la 1re, puis
-- voit son état final — donc pas de doublons de scènes hors p_replace).
-- Volontairement AUCUNE contrainte UNIQUE sur live_scenes : les données
-- historiques peuvent déjà être en doublon, l'atomicité + le verrou suffisent.
--
-- Contrat partagé avec l'agent API — ne pas changer la signature.
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
  -- 1) Verrou de session : sérialise les publications concurrentes et
  --    garantit que la session existe avant d'écrire quoi que ce soit.
  PERFORM 1 FROM public.live_sessions WHERE id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'session introuvable';
  END IF;

  -- 2) Blueprint : UNIQUE(live_session_id) sur live_blueprints → upsert.
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

  -- 3) Remplacement demandé : on purge scènes ET prompteur ensemble — jamais
  --    l'un sans l'autre (session_id du prompteur est un TEXT legacy).
  IF p_replace THEN
    DELETE FROM public.live_scenes WHERE live_session_id = p_session_id;
    DELETE FROM public.live_script_sections WHERE session_id = p_session_id::text;
  END IF;

  -- 4) Scènes : insérées seulement en remplacement OU sur une session encore
  --    vierge — un simple republish sans p_replace ne duplique rien.
  IF p_replace OR NOT EXISTS (
    SELECT 1 FROM public.live_scenes WHERE live_session_id = p_session_id
  ) THEN
    INSERT INTO public.live_scenes (
      live_session_id, name, scene_type, order_index, is_active, content_payload_json
    )
    SELECT
      p_session_id,
      COALESCE(s.value->>'name', 'Scène'),
      COALESCE(s.value->>'scene_type', 'camera_only'),
      COALESCE(NULLIF(s.value->>'order_index', '')::integer, s.ordinality::integer - 1),
      COALESCE(NULLIF(s.value->>'is_active', '')::boolean, false),
      COALESCE(s.value->'content_payload_json', '{}'::jsonb)
    FROM jsonb_array_elements(COALESCE(p_scenes, '[]'::jsonb))
      WITH ORDINALITY AS s(value, ordinality);
    GET DIAGNOSTICS v_scenes = ROW_COUNT;
  END IF;

  -- 5) Prompteur (live_script_sections) : même règle anti-doublon.
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

  -- 6) Patch de config (fusion superficielle jsonb — les clés du patch gagnent).
  UPDATE public.live_sessions
     SET config = COALESCE(config, '{}'::jsonb) || COALESCE(p_config_patch, '{}'::jsonb)
   WHERE id = p_session_id;

  -- 7) Compte rendu pour l'appelant.
  RETURN jsonb_build_object(
    'scenes_inserted',  v_scenes,
    'scripts_inserted', v_scripts
  );
END;
$$;

-- Droits : SECURITY DEFINER contourne la RLS → exécution réservée à l'API
-- (service_role). Aucun client authentifié ne doit pouvoir publier une pile.
REVOKE ALL ON FUNCTION public.publish_master_factory_stack(uuid, jsonb, jsonb, jsonb, jsonb, boolean)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.publish_master_factory_stack(uuid, jsonb, jsonb, jsonb, jsonb, boolean)
  TO service_role;
