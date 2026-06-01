-- ═══════════════════════════════════════════════════════════════
-- Durcissement multi-tenant — sous-tables Live & Debate
-- ═══════════════════════════════════════════════════════════════
-- Ajoute `cimolace_tenant_id` (FK + index) sur les tables qui orbitent autour
-- de `live_sessions` ou `debate_*`, puis backfill conservateur :
--   1) si la ligne réfère à un live_session, on copie le tenant de la session ;
--   2) sinon on retombe sur le tenant slug='isna' (déploiement actuel).
--
-- Recette idempotente : à chaque déploiement, l’ALTER + INDEX + UPDATE peuvent
-- être rejoués. Aucune RLS modifiée ici (chaque module a la sienne).

DO $$
DECLARE
  v_table TEXT;
  v_link  TEXT;  -- nom de colonne fk vers live_sessions (NULL si pas de lien direct)
  v_default_tenant UUID;
BEGIN
  SELECT id INTO v_default_tenant
  FROM public.cimolace_tenants
  WHERE lower(trim(slug)) = 'isna'
  LIMIT 1;
  IF v_default_tenant IS NULL THEN
    SELECT id INTO v_default_tenant
    FROM public.cimolace_tenants
    WHERE status = 'active'
    ORDER BY created_at ASC
    LIMIT 1;
  END IF;

  -- (table, colonne FK live_sessions) ; NULL si pas de lien direct.
  FOR v_table, v_link IN
    SELECT * FROM (VALUES
      ('live_recordings',                  'session_id'),
      ('live_webhook_events',              NULL),
      ('live_questions',                   'session_id'),
      ('live_session_questions',           'session_id'),
      ('live_session_answers',             'session_id'),
      ('live_session_chat',                'session_id'),
      ('live_session_participants',        'session_id'),
      ('live_session_invitations',         'session_id'),
      ('live_session_summaries',           'session_id'),
      ('live_session_signals',             'session_id'),
      ('live_session_reports',             'session_id'),
      ('live_session_private_messages',    'session_id'),
      ('live_session_guest_notes',         'session_id'),
      ('live_session_proctor_consents',    'session_id'),
      ('live_session_proctor_camera_events','session_id'),
      ('live_script_sections',             'session_id'),
      ('live_summaries',                   'session_id'),
      ('live_transcripts',                 'session_id'),
      ('live_mindmaps',                    'session_id'),
      ('live_blueprints',                  NULL),
      ('live_scenes',                      'session_id'),
      ('live_contents',                    'session_id'),
      ('live_chat_invites',                'session_id'),
      ('live_invitations',                 'session_id'),
      ('live_visibility_rules',            'session_id'),
      ('live_waiting_room_entries',        'session_id'),
      ('live_notifications',               'session_id'),
      ('live_mobile_camera_tokens',        'session_id'),
      ('live_neuronq_questions',           'session_id'),
      ('live_neuro_recall_state',          'session_id'),
      ('live_neuro_flashcards',            'session_id'),
      ('live_neuro_recall_reports',        'session_id'),
      ('live_neuro_user_progress',         NULL),
      ('debate_invitations',               'session_id'),
      ('debate_votes',                     'session_id'),
      ('debate_ai_reports',                'session_id'),
      ('debate_participants',              'session_id'),
      ('debate_rounds',                    'session_id')
    ) AS t(name, link)
  LOOP
    -- 1) Saute si la table n’existe pas dans ce schéma (compat selon historique).
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = v_table
    ) THEN
      CONTINUE;
    END IF;

    -- 2) Ajoute la colonne FK si manquante.
    EXECUTE format(
      'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS cimolace_tenant_id UUID '
      'REFERENCES public.cimolace_tenants(id) ON DELETE SET NULL',
      v_table
    );

    -- 3) Index dédié (idempotent).
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS idx_%I_cimolace_tenant_id '
      'ON public.%I(cimolace_tenant_id)',
      v_table, v_table
    );

    -- 4) Backfill via la session si possible.
    IF v_link IS NOT NULL
       AND EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = v_table AND column_name = v_link
       )
    THEN
      EXECUTE format(
        'UPDATE public.%I AS x '
        'SET cimolace_tenant_id = ls.cimolace_tenant_id '
        'FROM public.live_sessions ls '
        'WHERE ls.id = x.%I '
        '  AND x.cimolace_tenant_id IS NULL '
        '  AND ls.cimolace_tenant_id IS NOT NULL',
        v_table, v_link
      );
    END IF;

    -- 5) Fallback tenant par défaut (si tenant unique connu).
    IF v_default_tenant IS NOT NULL THEN
      EXECUTE format(
        'UPDATE public.%I SET cimolace_tenant_id = $1 WHERE cimolace_tenant_id IS NULL',
        v_table
      ) USING v_default_tenant;
    END IF;
  END LOOP;
END $$;
