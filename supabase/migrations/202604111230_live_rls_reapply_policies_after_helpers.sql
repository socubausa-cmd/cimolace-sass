-- Ré-applique les politiques RLS du hotfix 202604302110 si seules les fonctions
-- 202604302314 (row_security=off) ont été exécutées à la main : sans ces DROP/CREATE
-- POLICY, les anciennes règles (ex. smart_entry_liri) gardent des EXISTS directs sur
-- live_sessions → boucle 42P17 avec live_invitations / visibility / waiting_room / embeds.
--
-- + Évite un scan direct sur live_sessions dans live_neuronq_select (302070).

CREATE OR REPLACE FUNCTION public.internal_live_session_debate_id(p_session_id uuid)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
SET row_security = off
STABLE
AS $$
  SELECT debate_id FROM public.live_sessions WHERE id = p_session_id;
$$;

REVOKE ALL ON FUNCTION public.internal_live_session_debate_id(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.internal_live_session_debate_id(uuid) TO authenticated, service_role;

-- ─── live_sessions ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "live_sessions_read" ON public.live_sessions;
CREATE POLICY "live_sessions_read" ON public.live_sessions FOR SELECT USING (
  teacher_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
    AND lower(COALESCE(p.role, '')) IN ('owner', 'admin', 'secretariat')
  )
  OR public.internal_is_live_session_participant(id, auth.uid())
  OR public.internal_user_has_live_invitation(id, auth.uid())
  OR (
    debate_id IS NOT NULL
    AND public.internal_user_is_debate_participant(debate_id, auth.uid())
  )
  OR status = 'live'
);

-- ─── live_visibility_rules ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "visibility_rules_read" ON public.live_visibility_rules;
CREATE POLICY "visibility_rules_read" ON public.live_visibility_rules FOR SELECT USING (
  public.internal_live_session_teacher_id(live_session_id) = auth.uid()
  OR public.internal_user_has_live_invitation(live_session_id, auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND lower(COALESCE(p.role, '')) IN ('owner', 'admin', 'secretariat')
  )
  OR public.internal_live_session_status(live_session_id) = 'live'
);

DROP POLICY IF EXISTS "visibility_rules_write" ON public.live_visibility_rules;
CREATE POLICY "visibility_rules_write" ON public.live_visibility_rules FOR ALL USING (
  public.internal_live_session_teacher_id(live_session_id) = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND lower(COALESCE(p.role, '')) IN ('owner', 'admin', 'secretariat')
  )
) WITH CHECK (
  public.internal_live_session_teacher_id(live_session_id) = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND lower(COALESCE(p.role, '')) IN ('owner', 'admin', 'secretariat')
  )
);

-- ─── live_invitations ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "live_invitations_read" ON public.live_invitations;
CREATE POLICY "live_invitations_read" ON public.live_invitations FOR SELECT USING (
  user_id = auth.uid()
  OR public.internal_live_session_teacher_id(live_session_id) = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND lower(COALESCE(p.role, '')) IN ('owner', 'admin', 'secretariat')
  )
);

DROP POLICY IF EXISTS "live_invitations_insert" ON public.live_invitations;
CREATE POLICY "live_invitations_insert" ON public.live_invitations FOR INSERT WITH CHECK (
  public.internal_live_session_teacher_id(live_session_id) = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND lower(COALESCE(p.role, '')) IN ('owner', 'admin', 'secretariat')
  )
);

DROP POLICY IF EXISTS "live_invitations_update" ON public.live_invitations;
CREATE POLICY "live_invitations_update" ON public.live_invitations FOR UPDATE USING (
  user_id = auth.uid()
  OR public.internal_live_session_teacher_id(live_session_id) = auth.uid()
);

-- ─── live_waiting_room_entries ───────────────────────────────────────────────
DROP POLICY IF EXISTS "waiting_room_read" ON public.live_waiting_room_entries;
CREATE POLICY "waiting_room_read" ON public.live_waiting_room_entries FOR SELECT USING (
  user_id = auth.uid()
  OR public.internal_live_session_teacher_id(live_session_id) = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND lower(COALESCE(p.role, '')) IN ('owner', 'admin', 'secretariat')
  )
);

DROP POLICY IF EXISTS "waiting_room_update" ON public.live_waiting_room_entries;
CREATE POLICY "waiting_room_update" ON public.live_waiting_room_entries FOR UPDATE USING (
  user_id = auth.uid()
  OR public.internal_live_session_teacher_id(live_session_id) = auth.uid()
);

-- ─── live_notifications (insert) ─────────────────────────────────────────────
DROP POLICY IF EXISTS "live_notifications_insert" ON public.live_notifications;
CREATE POLICY "live_notifications_insert" ON public.live_notifications FOR INSERT WITH CHECK (
  public.internal_live_session_teacher_id(live_session_id) = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND lower(COALESCE(p.role, '')) IN ('owner', 'admin', 'secretariat')
  )
);

-- ─── live_neuronq_questions : plus de JOIN direct sur live_sessions ─────────
DO $neuron$
BEGIN
  IF to_regclass('public.live_neuronq_questions') IS NOT NULL THEN
    EXECUTE $pol$
      DROP POLICY IF EXISTS "live_neuronq_select" ON public.live_neuronq_questions;
      CREATE POLICY "live_neuronq_select" ON public.live_neuronq_questions
        FOR SELECT TO authenticated
        USING (
          user_id = auth.uid()
          OR public.internal_live_session_teacher_id(live_session_id) = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid()
              AND lower(COALESCE(p.role, '')) IN ('owner', 'admin', 'secretariat')
          )
          OR (
            public.internal_live_session_debate_id(live_session_id) IS NOT NULL
            AND public.internal_user_is_debate_participant(
              public.internal_live_session_debate_id(live_session_id),
              auth.uid()
            )
          )
        );
    $pol$;
  END IF;
END
$neuron$;
