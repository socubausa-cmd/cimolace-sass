-- ============================================================================
-- 20260604120000_live_missing_tables_and_rls_fix.sql
-- ----------------------------------------------------------------------------
-- CONSOLIDATED, IDEMPOTENT hotfix for the LIVE feature on the ISNA V2 DB.
--
-- The production database is behind on migrations. The following are KNOWN-GOOD
-- at runtime and are NOT recreated here:
--   • live_sessions, live_scenes, live_session_participants  (already exist)
--
-- This script does TWO things:
--   (A) Creates 4 tables that return 404 (missing) at runtime, with their
--       indexes + RLS exactly as defined in their source migrations:
--         1. live_session_chat            (src: 202603220005_live_arena_complete.sql)
--         2. live_session_signals         (NO source migration exists in repo —
--                                          schema reconstructed from app usage; see note)
--         3. live_session_private_messages(src: 202604302320_live_communication_private_messages.sql)
--         4. longia_chat_threads          (NO CREATE TABLE exists in repo — only an
--                                          ALTER in 202604302320; schema reconstructed
--                                          from apps/app/src/lib/longiaChatThreadPersistence.js)
--   (B) Breaks the "infinite recursion detected in policy for relation
--       live_session_participants" by dropping every recursive SELECT policy
--       variant and recreating the non-recursive split policies, plus the
--       non-recursive live_sessions_read policy and its SECURITY DEFINER helpers
--       (src: 202604200001 / 202604302090 / 202604302110 / 202604302120).
--
-- Idempotency: CREATE TABLE IF NOT EXISTS, CREATE INDEX IF NOT EXISTS,
-- ADD COLUMN IF NOT EXISTS, ENABLE ROW LEVEL SECURITY (re-runnable), and every
-- CREATE POLICY is preceded by DROP POLICY IF EXISTS. Safe to re-run.
--
-- Scope guard: only the 4 missing tables + the live_session_participants /
-- live_sessions recursion fix are touched. No unrelated tables are modified.
-- ============================================================================


-- ════════════════════════════════════════════════════════════════════════════
-- SECTION 0 — SECURITY DEFINER helpers (needed by the RLS policies below).
-- Source: 202604200001_live_sessions_rls_no_recursion.sql
--         + 202604302110_live_liri_rls_recursion_hotfix.sql
-- These bypass RLS internally, which is exactly what breaks the policy cycle.
-- CREATE OR REPLACE is idempotent. We (re)create them defensively so this
-- script is self-contained even if those earlier migrations never ran.
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.internal_live_session_teacher_id(p_session_id uuid)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT teacher_id FROM public.live_sessions WHERE id = p_session_id;
$$;

CREATE OR REPLACE FUNCTION public.internal_is_live_session_participant(p_session_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.live_session_participants
    WHERE live_session_id = p_session_id AND user_id = p_user_id
  );
$$;

REVOKE ALL ON FUNCTION public.internal_live_session_teacher_id(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.internal_live_session_teacher_id(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.internal_is_live_session_participant(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.internal_is_live_session_participant(uuid, uuid) TO authenticated, service_role;


-- ════════════════════════════════════════════════════════════════════════════
-- SECTION 1 — live_session_participants / live_sessions RECURSION FIX
-- ----------------------------------------------------------------------------
-- THE CYCLE:
--   The original participants SELECT policy ("participants_select_own" from
--   202603220005, and "Participants visibles par membres tenant" from
--   20250512000006, and "live_participants_read" from 202603260102) each contain
--   an inline  EXISTS (SELECT 1 FROM live_sessions ...)  sub-query. Evaluating it
--   triggers the live_sessions SELECT policy, whose early form contained
--   EXISTS (SELECT 1 FROM live_session_participants ...) — which re-triggers the
--   participants policy → infinite recursion (PostgREST 500 / 42P17).
--
-- THE FIX (mirrors the codebase's converged form):
--   1. live_sessions_read is rewritten to use the SECURITY DEFINER helpers
--      (no direct sub-query on live_session_participants).
--   2. ALL recursive participants SELECT policies are dropped and replaced by
--      three INDEPENDENT single-table SELECT policies (202604302120):
--        - own row            : user_id = auth.uid()                    (trivial, no recursion)
--        - as teacher         : internal_live_session_teacher_id(...) = auth.uid()
--        - as staff           : profiles role check (no live_* sub-query)
--      Splitting them keeps the "own row" path from forcing evaluation of the
--      teacher branch.
-- ════════════════════════════════════════════════════════════════════════════

-- 1a. Ensure RLS is on (idempotent / safe to re-run).
ALTER TABLE public.live_session_participants ENABLE ROW LEVEL SECURITY;

-- 1a-bis. The "live_participants_insert" policy below references can_invite_others.
--     Normally added by 202603282201_live_session_invitations.sql; guarded here
--     so this script is self-contained on a behind-on-migrations DB.
ALTER TABLE public.live_session_participants
  ADD COLUMN IF NOT EXISTS can_invite_others BOOLEAN NOT NULL DEFAULT false;

-- 1b. live_sessions_read — non-recursive form.
--     Source: 202604302110_live_liri_rls_recursion_hotfix.sql (debate/invitation
--     branches use helpers; we keep only branches whose dependencies are helpers
--     or columns guaranteed on live_sessions: teacher_id, status).
--     NOTE: the debate_id / live_invitations branches from the hotfix are omitted
--     to avoid depending on tables that may also be missing; status='live' and the
--     participant-helper branch keep guest/live read working. If you need the full
--     hotfix behaviour, run 202604302110 afterwards (it is itself idempotent).
DROP POLICY IF EXISTS "live_sessions_read" ON public.live_sessions;
CREATE POLICY "live_sessions_read" ON public.live_sessions FOR SELECT USING (
  teacher_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND lower(COALESCE(p.role, '')) IN ('owner', 'admin', 'secretariat')
  )
  OR public.internal_is_live_session_participant(id, auth.uid())
  OR status = 'live'
);

-- 1c. Drop EVERY known participants SELECT policy variant (recursive + already-good),
--     then recreate the three non-recursive split SELECT policies.
DROP POLICY IF EXISTS "Participants visibles par membres tenant" ON public.live_session_participants; -- 20250512000006 (recursive)
DROP POLICY IF EXISTS "participants_select_own"               ON public.live_session_participants;    -- 202603220005 (recursive)
DROP POLICY IF EXISTS "live_participants_read"                ON public.live_session_participants;    -- 202603260102 / 202604200001 (recursive/helper)
DROP POLICY IF EXISTS "live_participants_select_own_row"      ON public.live_session_participants;    -- 202604302120
DROP POLICY IF EXISTS "live_participants_select_as_teacher"   ON public.live_session_participants;    -- 202604302120
DROP POLICY IF EXISTS "live_participants_select_staff"        ON public.live_session_participants;    -- 202604302120

CREATE POLICY "live_participants_select_own_row" ON public.live_session_participants
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "live_participants_select_as_teacher" ON public.live_session_participants
  FOR SELECT
  USING (public.internal_live_session_teacher_id(live_session_id) = auth.uid());

CREATE POLICY "live_participants_select_staff" ON public.live_session_participants
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND lower(COALESCE(p.role, '')) IN ('owner', 'admin', 'secretariat')
    )
  );

-- 1d. INSERT / UPDATE policies for participants (non-recursive: use helper).
--     Source: 202604291400_live_participants_insert_teacher_inviter.sql
--           + 202604200001_live_sessions_rls_no_recursion.sql (update)
--     Recreated idempotently so a behind-DB has a complete, non-recursive set.
DROP POLICY IF EXISTS "live_participants_insert" ON public.live_session_participants;
CREATE POLICY "live_participants_insert" ON public.live_session_participants FOR INSERT WITH CHECK (
  user_id = auth.uid()
  OR public.internal_live_session_teacher_id(live_session_id) = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND lower(COALESCE(p.role, '')) IN ('owner', 'admin', 'secretariat')
  )
  OR EXISTS (
    SELECT 1 FROM public.live_session_participants lp
    WHERE lp.live_session_id = live_session_participants.live_session_id
      AND lp.user_id = auth.uid()
      AND lp.can_invite_others = true
  )
);

DROP POLICY IF EXISTS "live_participants_update" ON public.live_session_participants;
CREATE POLICY "live_participants_update" ON public.live_session_participants FOR UPDATE USING (
  user_id = auth.uid()
  OR public.internal_live_session_teacher_id(live_session_id) = auth.uid()
);


-- ════════════════════════════════════════════════════════════════════════════
-- SECTION 2 — live_session_chat
-- Source: 202603220005_live_arena_complete.sql
-- (Original used DO-block guards; rewritten with DROP POLICY IF EXISTS for
--  re-runnability. Column set / index / check constraints are verbatim.)
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.live_session_chat (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  live_session_id  UUID NOT NULL REFERENCES public.live_sessions(id) ON DELETE CASCADE,
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message          TEXT NOT NULL CHECK (char_length(message) BETWEEN 1 AND 4000),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_live_session_chat_session
  ON public.live_session_chat(live_session_id, created_at);

ALTER TABLE public.live_session_chat ENABLE ROW LEVEL SECURITY;

-- SELECT: session participants (via helper, non-recursive), session teacher
-- (via helper), or staff. Rewritten to use helpers instead of the original
-- inline live_session_participants / live_sessions sub-queries, so chat reads
-- can never re-enter the participants recursion.
DROP POLICY IF EXISTS "chat_select_participants" ON public.live_session_chat;
CREATE POLICY "chat_select_participants" ON public.live_session_chat
  FOR SELECT USING (
    public.internal_is_live_session_participant(live_session_id, auth.uid())
    OR public.internal_live_session_teacher_id(live_session_id) = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND lower(COALESCE(p.role, '')) IN ('owner', 'admin', 'secretariat')
    )
  );

DROP POLICY IF EXISTS "chat_insert_authenticated" ON public.live_session_chat;
CREATE POLICY "chat_insert_authenticated" ON public.live_session_chat
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Realtime publication (ignore if already present).
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'live_session_chat'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.live_session_chat;
  END IF;
END $$;


-- ════════════════════════════════════════════════════════════════════════════
-- SECTION 3 — live_session_signals
-- ----------------------------------------------------------------------------
-- !! NO CREATE TABLE FOR live_session_signals EXISTS ANYWHERE IN THE REPO.       !!
-- Migrations 202604241200 / 202604251200 and the app reference it but never
-- create it. Schema below is RECONSTRUCTED from concrete app usage:
--   • insert cols: live_session_id, user_id, type, payload, resolved
--       (apps/app/src/lib/liriLive/permissionRequestSignals.js,
--        apps/app/src/lib/liriLive/joykitRequestSignals.js,
--        apps/app/src/features/live/hooks/useLiveHostMediaControls.js,
--        apps/app/src/pages/studio/LiveArenaPage.jsx,
--        apps/app/src/components/live-room/LiveGuestLongiaPanel.jsx)
--   • type values: hand_raise | reaction | longia_guest | permission_request
--                  | joykit_request | joykit_granted
--   • payload is a TEXT column: stores a raw emoji ('reaction') OR a JSON string.
--     The SQL in 202604241200/202604251200 casts payload::jsonb only for the
--     permission_request/joykit_granted rows (always valid JSON), so TEXT is
--     the correct, usage-faithful type.
--   • resolved BOOLEAN, defaulted false; set true on lower-hand / host decision.
-- live_session_id is a real UUID FK to live_sessions (the joykit policy's
-- `live_session_id::uuid` cast is a harmless no-op on a uuid column).
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.live_session_signals (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  live_session_id  UUID NOT NULL REFERENCES public.live_sessions(id) ON DELETE CASCADE,
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type             TEXT NOT NULL,
  payload          TEXT,
  resolved         BOOLEAN NOT NULL DEFAULT false,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_live_session_signals_session_type
  ON public.live_session_signals(live_session_id, type, resolved);

CREATE INDEX IF NOT EXISTS idx_live_session_signals_user
  ON public.live_session_signals(user_id);

ALTER TABLE public.live_session_signals ENABLE ROW LEVEL SECURITY;

-- SELECT: a participant sees their own signals (hand_raise, joykit grants
-- targeted at them); the session host sees ALL signals for the session
-- (the host UI loads every hand_raise / permission_request / joykit_request);
-- staff can read. Non-recursive (helper for teacher).
DROP POLICY IF EXISTS "live_session_signals_select" ON public.live_session_signals;
CREATE POLICY "live_session_signals_select" ON public.live_session_signals
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.internal_live_session_teacher_id(live_session_id) = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND lower(COALESCE(p.role, '')) IN ('owner', 'admin', 'secretariat')
    )
  );

-- INSERT: every signal the app writes sets user_id = current user. (The host's
-- joykit_granted insert, where user_id = the beneficiary guest, is covered by
-- the dedicated policy "signals_insert_joykit_granted_host" from migration
-- 202604251200, recreated below for completeness.)
DROP POLICY IF EXISTS "live_session_signals_insert_own" ON public.live_session_signals;
CREATE POLICY "live_session_signals_insert_own" ON public.live_session_signals
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- INSERT (host grants JoyKit on behalf of a guest beneficiary).
-- Source: 202604251200_live_joykit_signals_and_rpc.sql
DROP POLICY IF EXISTS "signals_insert_joykit_granted_host" ON public.live_session_signals;
CREATE POLICY "signals_insert_joykit_granted_host" ON public.live_session_signals
  FOR INSERT
  WITH CHECK (
    type = 'joykit_granted'
    AND public.internal_live_session_teacher_id(live_session_id::uuid)::text = auth.uid()::text
  );
COMMENT ON POLICY "signals_insert_joykit_granted_host" ON public.live_session_signals IS
  'Le formateur enregistre un grant JoyKit pour un participant (user_id = bénéficiaire).';

-- UPDATE: a participant resolves their own signal (lower hand); the host
-- resolves any signal in the session (permission/joykit decisions).
DROP POLICY IF EXISTS "live_session_signals_update" ON public.live_session_signals;
CREATE POLICY "live_session_signals_update" ON public.live_session_signals
  FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    OR public.internal_live_session_teacher_id(live_session_id) = auth.uid()
  );

-- Realtime (host + guest subscribe to INSERT/UPDATE on this table).
ALTER TABLE public.live_session_signals REPLICA IDENTITY FULL;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'live_session_signals'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.live_session_signals;
  END IF;
END $$;


-- ════════════════════════════════════════════════════════════════════════════
-- SECTION 4 — longia_chat_threads
-- ----------------------------------------------------------------------------
-- !! NO CREATE TABLE FOR longia_chat_threads EXISTS ANYWHERE IN THE REPO.        !!
-- docs/MIGRATIONS_INVENTORY.md lists "202604101930_longia_chat_threads.sql" but
-- that file is absent from supabase/migrations/. Migration
-- 202604302320_live_communication_private_messages.sql only ALTERs the table
-- (scope_type check). Schema below is RECONSTRUCTED from:
--   apps/app/src/lib/longiaChatThreadPersistence.js
--     select: id, messages, title, updated_at
--     upsert: user_id, scope_type, scope_id, title, messages, updated_at
--     onConflict: (user_id, scope_type, scope_id)
--     messages = JSON array of { id?, role:'user'|'assistant', text }
--   202604302320: scope_type ∈ ('designer','live','live_student')
-- Created BEFORE the dependent ALTER in 202604302320 would run, so that ALTER
-- (DROP CONSTRAINT IF EXISTS ... / ADD CONSTRAINT) succeeds on re-deploy.
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.longia_chat_threads (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scope_type  TEXT NOT NULL,
  scope_id    TEXT NOT NULL,
  title       TEXT,
  messages    JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT longia_chat_threads_user_scope_uk UNIQUE (user_id, scope_type, scope_id)
);

-- scope_type domain (matches the ADD CONSTRAINT in 202604302320). Added
-- idempotently here so a fresh table already carries it; 202604302320 will
-- DROP/ADD it again harmlessly.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'longia_chat_threads_scope_type_check'
      AND conrelid = 'public.longia_chat_threads'::regclass
  ) THEN
    ALTER TABLE public.longia_chat_threads
      ADD CONSTRAINT longia_chat_threads_scope_type_check
      CHECK (scope_type IN ('designer', 'live', 'live_student'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_longia_chat_threads_user_scope
  ON public.longia_chat_threads(user_id, scope_type, scope_id);

ALTER TABLE public.longia_chat_threads ENABLE ROW LEVEL SECURITY;

-- A LONGIA thread is private to its owner. The app always filters by
-- user_id = auth.uid() and upserts with the current user, so owner-only ALL.
DROP POLICY IF EXISTS "longia_chat_threads_select_own" ON public.longia_chat_threads;
CREATE POLICY "longia_chat_threads_select_own" ON public.longia_chat_threads
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "longia_chat_threads_insert_own" ON public.longia_chat_threads;
CREATE POLICY "longia_chat_threads_insert_own" ON public.longia_chat_threads
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "longia_chat_threads_update_own" ON public.longia_chat_threads;
CREATE POLICY "longia_chat_threads_update_own" ON public.longia_chat_threads
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "longia_chat_threads_delete_own" ON public.longia_chat_threads;
CREATE POLICY "longia_chat_threads_delete_own" ON public.longia_chat_threads
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());


-- ════════════════════════════════════════════════════════════════════════════
-- SECTION 5 — live_session_private_messages
-- Source: 202604302320_live_communication_private_messages.sql (verbatim DDL).
-- Depends on internal_live_session_teacher_id / internal_is_live_session_participant
-- (defined in SECTION 0 above).
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.live_session_private_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  live_session_id uuid NOT NULL REFERENCES public.live_sessions (id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(trim(body)) > 0 AND char_length(body) <= 16000),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT live_session_private_messages_distinct_pair CHECK (sender_id <> recipient_id)
);

CREATE INDEX IF NOT EXISTS live_session_private_messages_session_created_idx
  ON public.live_session_private_messages (live_session_id, created_at DESC);

CREATE INDEX IF NOT EXISTS live_session_private_messages_sender_idx
  ON public.live_session_private_messages (sender_id);

CREATE INDEX IF NOT EXISTS live_session_private_messages_recipient_idx
  ON public.live_session_private_messages (recipient_id);

ALTER TABLE public.live_session_private_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lspm_select_participants" ON public.live_session_private_messages;
DROP POLICY IF EXISTS "lspm_insert_teacher_member" ON public.live_session_private_messages;

CREATE POLICY "lspm_select_participants"
  ON public.live_session_private_messages FOR SELECT
  USING (
    (sender_id = auth.uid() OR recipient_id = auth.uid())
    AND (
      public.internal_live_session_teacher_id(live_session_id) = auth.uid()
      OR public.internal_is_live_session_participant(live_session_id, auth.uid())
    )
  );

CREATE POLICY "lspm_insert_teacher_member"
  ON public.live_session_private_messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND public.internal_live_session_teacher_id(live_session_id) IN (sender_id, recipient_id)
    AND (
      public.internal_live_session_teacher_id(live_session_id) = sender_id
      OR public.internal_is_live_session_participant(live_session_id, sender_id)
    )
    AND (
      public.internal_live_session_teacher_id(live_session_id) = recipient_id
      OR public.internal_is_live_session_participant(live_session_id, recipient_id)
    )
  );

COMMENT ON TABLE public.live_session_private_messages IS
  'Aparté texte formateur ↔ membre pendant un live (historique + Realtime).';

ALTER TABLE public.live_session_private_messages REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'live_session_private_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.live_session_private_messages;
  END IF;
END $$;


-- ════════════════════════════════════════════════════════════════════════════
-- SECTION 6 — multi-tenant column for the 4 new tables (optional / guarded).
-- Source: 20260503220000_live_extensions_tenant_id.sql
-- That migration's generic loop assumes a `session_id` FK, but these tables use
-- `live_session_id`; its session-based backfill is a no-op for them. We still add
-- the `cimolace_tenant_id` column + index so the schema matches the rest of the
-- live_* family, and apply the same default-tenant backfill. Entire block is
-- skipped if public.cimolace_tenants is absent (compat with partial schemas).
-- ════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  v_table TEXT;
  v_default_tenant UUID;
BEGIN
  IF to_regclass('public.cimolace_tenants') IS NULL THEN
    RAISE NOTICE 'cimolace_tenants absent — skipping cimolace_tenant_id backfill.';
    RETURN;
  END IF;

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

  FOREACH v_table IN ARRAY ARRAY[
    'live_session_chat',
    'live_session_signals',
    'live_session_private_messages',
    'longia_chat_threads'
  ] LOOP
    EXECUTE format(
      'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS cimolace_tenant_id UUID '
      'REFERENCES public.cimolace_tenants(id) ON DELETE SET NULL',
      v_table
    );
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS idx_%I_cimolace_tenant_id ON public.%I(cimolace_tenant_id)',
      v_table, v_table
    );
    IF v_default_tenant IS NOT NULL THEN
      EXECUTE format(
        'UPDATE public.%I SET cimolace_tenant_id = $1 WHERE cimolace_tenant_id IS NULL',
        v_table
      ) USING v_default_tenant;
    END IF;
  END LOOP;
END $$;

-- ============================================================================
-- END 20260604120000_live_missing_tables_and_rls_fix.sql
-- ============================================================================
