-- =============================================================================
-- 20260613150000_live_realtime_publication.sql
-- =============================================================================
-- Bug confirmé le 2026-06-13 (test E2E) : la salle d'attente de l'arène host ne
-- se met jamais à jour en direct. Cause racine : les hooks front s'abonnent à ces
-- tables via `postgres_changes`, MAIS elles ne sont pas dans la publication
-- Postgres `supabase_realtime` → aucun event WAL n'est émis vers Realtime.
--
-- État prod avant migration : la publication ne contenait que 7 tables
--   (live_session_chat, live_session_signals, live_neuronq_questions,
--    live_script_sections, live_session_private_messages, live_chat_invites,
--    immersive_live_signals).
--
-- Cette migration ajoute les 12 tables du domaine live RÉELLEMENT écoutées via
-- `postgres_changes` côté `apps/app` et qui existent en DB. Elle règle aussi la
-- REPLICA IDENTITY : `FULL` sur les tables dont un listener écoute les DELETE
-- (`event: '*'`) avec un filtre sur une colonne NON-PK (live_session_id,
-- debate_id, user_id, session_id...). Sans `FULL`, le old-record d'un DELETE ne
-- contient que la PK → le filtre Realtime ne matche pas → l'event est perdu.
--
-- Idempotente, atomique (un seul bloc DO), et tolérante : une table absente est
-- ignorée (RAISE NOTICE) au lieu de faire échouer la migration.
--
-- NB RLS : Realtime applique la RLS de la table sous le JWT de l'abonné. Ces
-- tables ont déjà une policy SELECT scoping au tenant/session (cf. migrations RLS
-- live récentes) — l'ajout à la publication est la pièce manquante.
-- =============================================================================

DO $$
DECLARE
  t text;
  -- Tables à publier (écoutées via postgres_changes, existantes en prod) :
  publish_tables text[] := ARRAY[
    'live_waiting_room_entries',
    'live_sessions',
    'live_scenes',
    'debates',
    'debate_votes',
    'live_visibility_rules',
    'live_session_proctor_camera_events',
    'live_neuro_recall_state',
    'live_session_guest_notes',
    'live_questions',
    'live_invitations',
    'immersive_live_sessions'
  ];
  -- Sous-ensemble nécessitant REPLICA IDENTITY FULL (DELETE filtrés sur non-PK) :
  full_identity_tables text[] := ARRAY[
    'live_waiting_room_entries',
    'live_scenes',
    'debate_votes',
    'live_session_proctor_camera_events',
    'live_session_guest_notes',
    'live_questions',
    'live_invitations',
    'immersive_live_sessions'
  ];
BEGIN
  FOREACH t IN ARRAY publish_tables LOOP
    -- La table doit exister (relation ordinaire) dans le schéma public.
    IF NOT EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = t AND c.relkind = 'r'
    ) THEN
      RAISE NOTICE 'live_realtime_publication: table % absente → ignorée', t;
      CONTINUE;
    END IF;

    -- Ajout à la publication si pas déjà membre.
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
      RAISE NOTICE 'live_realtime_publication: supabase_realtime += %', t;
    END IF;

    -- REPLICA IDENTITY FULL si la table en a besoin (idempotent).
    IF t = ANY(full_identity_tables) THEN
      EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL', t);
    END IF;
  END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- À NOTER (bug distinct, hors périmètre de cette migration) : 5 tables sont
-- écoutées via postgres_changes par le front mais N'EXISTENT PAS en DB prod —
-- leur realtime est donc cassée pour une autre raison (feature non migrée ou nom
-- erroné). Ne PAS les ajouter ici (ALTER PUBLICATION échouerait) :
--   - debate_rounds            (useLiveHostDebateArena, LiveArenaPage)
--   - debate_ai_reports        (useLiveHostDebateArena)
--   - immersive_live_chat_messages (MessagingPage)
--   - live_notifications       (probable nom erroné → notifications ?)
--   - privileged_seats         (probable nom erroné → privileged_links ?)
-- -----------------------------------------------------------------------------
