-- ============================================================================
-- 20260604130000_live_participants_policy_recursion_followup.sql
-- ----------------------------------------------------------------------------
-- Follow-up to 20260604120000: the SELECT path was fixed, but an INSERT/UPSERT
-- on live_session_participants STILL raised 42P17 "infinite recursion detected
-- in policy for relation live_session_participants".
--
-- Cause: several INSERT policies coexist on the table (re-defined across
-- 202603220005 / 202603260102 / 202603281200 / 202604291400 / 20260604120000),
-- and at least one branch evaluates a sub-query against live_session_participants
-- (or live_sessions) during the INSERT WITH CHECK, re-entering the policy stack.
--
-- Fix: drop EVERY policy currently on live_session_participants (dynamically, so
-- no unknown/leftover name survives) and recreate a MINIMAL, non-recursive set
-- that only ever uses:
--   • user_id = auth.uid()                                   (trivial own-row)
--   • public.internal_live_session_teacher_id(...) = auth.uid()  (SECURITY DEFINER → bypasses RLS)
--   • a profiles role check                                  (no live_* sub-query)
-- None of these re-enter live_session_participants or live_sessions policies, so
-- the cycle cannot form. The host self-registration upsert
-- ({live_session_id,user_id,role,joined_at,left_at}, onConflict live_session_id,user_id)
-- passes via "user_id = auth.uid()".
--
-- Idempotent: the dynamic drop + recreate is fully re-runnable.
-- Depends on the SECURITY DEFINER helper internal_live_session_teacher_id(uuid)
-- created in 20260604120000 (recreated here defensively).
-- ============================================================================

-- Defensive: ensure the helper exists (no-op if 20260604120000 already ran).
CREATE OR REPLACE FUNCTION public.internal_live_session_teacher_id(p_session_id uuid)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT teacher_id FROM public.live_sessions WHERE id = p_session_id;
$$;
REVOKE ALL ON FUNCTION public.internal_live_session_teacher_id(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.internal_live_session_teacher_id(uuid) TO authenticated, service_role;

ALTER TABLE public.live_session_participants ENABLE ROW LEVEL SECURITY;

-- 1. Drop EVERY existing policy on live_session_participants (clears any leftover
--    recursive variant, whatever its name).
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'live_session_participants'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.live_session_participants', pol.policyname);
  END LOOP;
END $$;

-- 2. Recreate the minimal, non-recursive policy set.

-- SELECT — own row (trivial, no recursion).
CREATE POLICY "lsp_select_own_row" ON public.live_session_participants
  FOR SELECT USING (user_id = auth.uid());

-- SELECT — the session teacher sees all rows (helper bypasses RLS).
CREATE POLICY "lsp_select_as_teacher" ON public.live_session_participants
  FOR SELECT USING (public.internal_live_session_teacher_id(live_session_id) = auth.uid());

-- SELECT — staff (owner/admin/secretariat) read, no live_* sub-query.
CREATE POLICY "lsp_select_staff" ON public.live_session_participants
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND lower(COALESCE(p.role, '')) IN ('owner', 'admin', 'secretariat')
    )
  );

-- INSERT — register self, OR the teacher adds a participant. NO sub-query on
-- live_session_participants (that was the recursion source).
CREATE POLICY "lsp_insert" ON public.live_session_participants
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    OR public.internal_live_session_teacher_id(live_session_id) = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND lower(COALESCE(p.role, '')) IN ('owner', 'admin', 'secretariat')
    )
  );

-- UPDATE — own row (mark left_at, etc.) or the teacher.
CREATE POLICY "lsp_update" ON public.live_session_participants
  FOR UPDATE USING (
    user_id = auth.uid()
    OR public.internal_live_session_teacher_id(live_session_id) = auth.uid()
  );

-- ============================================================================
-- END 20260604130000_live_participants_policy_recursion_followup.sql
-- ============================================================================
