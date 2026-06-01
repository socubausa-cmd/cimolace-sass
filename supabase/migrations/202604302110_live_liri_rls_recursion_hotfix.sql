-- Hotfix 500 PostgREST (live_invitations, live_visibility_rules, live_waiting_room_entries, live_sessions embeds).
-- Cause : boucles RLS live_sessions ↔ live_invitations ↔ live_visibility_rules (sous-requêtes EXISTS sur l’autre table).
-- + branche débat : EXISTS sur debate_participants ré-applique des politiques qui ré-entrent sur live_sessions.
--
-- Inclut les helpers DebateCore (internal_debate_*) pour que live_sessions_read ne dépende pas de 202604302095 seul.
-- Colonnes API : évite « column does not exist » sur schémas partiels.

-- ─── Helpers SECURITY DEFINER (recréés = idempotent) ─────────────────────────
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

CREATE OR REPLACE FUNCTION public.internal_live_session_status(p_session_id uuid)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT status FROM public.live_sessions WHERE id = p_session_id;
$$;

CREATE OR REPLACE FUNCTION public.internal_user_has_live_invitation(p_session_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.live_invitations
    WHERE live_session_id = p_session_id
      AND user_id = p_user_id
      AND status IN ('pending', 'sent', 'seen', 'accepted')
  );
$$;

REVOKE ALL ON FUNCTION public.internal_live_session_teacher_id(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.internal_live_session_teacher_id(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.internal_is_live_session_participant(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.internal_is_live_session_participant(uuid, uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.internal_live_session_status(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.internal_live_session_status(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.internal_user_has_live_invitation(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.internal_user_has_live_invitation(uuid, uuid) TO authenticated, service_role;

-- ─── DebateCore (évite 500 si 202604302095 pas encore appliqué ; idempotent) ─
CREATE OR REPLACE FUNCTION public.internal_debate_moderator_id(p_debate_id uuid)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT moderator_id FROM public.debates WHERE id = p_debate_id;
$$;

CREATE OR REPLACE FUNCTION public.internal_user_is_debate_participant(p_debate_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.debate_participants
    WHERE debate_id = p_debate_id AND user_id = p_user_id
  );
$$;

REVOKE ALL ON FUNCTION public.internal_debate_moderator_id(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.internal_debate_moderator_id(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.internal_user_is_debate_participant(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.internal_user_is_debate_participant(uuid, uuid) TO authenticated, service_role;

-- ─── Colonnes souvent requises par l’app (embeds / studio) ─────────────────
ALTER TABLE public.live_sessions ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;
ALTER TABLE public.live_sessions ADD COLUMN IF NOT EXISTS debate_id UUID;
ALTER TABLE public.live_sessions ADD COLUMN IF NOT EXISTS preparation_status TEXT DEFAULT 'draft';
ALTER TABLE public.live_sessions ADD COLUMN IF NOT EXISTS production_live_type TEXT;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'debates'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'live_sessions'
      AND c.conname = 'live_sessions_debate_id_fkey'
  ) THEN
    BEGIN
      ALTER TABLE public.live_sessions
        ADD CONSTRAINT live_sessions_debate_id_fkey
        FOREIGN KEY (debate_id) REFERENCES public.debates(id) ON DELETE SET NULL;
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;

-- ─── live_sessions : pas de sous-requête directe sur debate_participants / live_invitations ─
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

-- ─── live_invitations ────────────────────────────────────────────────────────
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

-- ─── live_notifications (insert référençait live_sessions en EXISTS) ─────────
DROP POLICY IF EXISTS "live_notifications_insert" ON public.live_notifications;
CREATE POLICY "live_notifications_insert" ON public.live_notifications FOR INSERT WITH CHECK (
  public.internal_live_session_teacher_id(live_session_id) = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND lower(COALESCE(p.role, '')) IN ('owner', 'admin', 'secretariat')
  )
);

-- ─── debates / debate_participants (re-synchronise avec 202604302095 si jamais appliqué) ─
DO $deb$
BEGIN
  IF to_regclass('public.debates') IS NOT NULL AND to_regclass('public.debate_participants') IS NOT NULL THEN
  EXECUTE $pol$
    DROP POLICY IF EXISTS "debates_select" ON public.debates;
    CREATE POLICY "debates_select" ON public.debates FOR SELECT USING (
      moderator_id = auth.uid()
      OR public.internal_user_is_debate_participant(id, auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND lower(COALESCE(p.role, '')) IN ('owner', 'admin')
      )
    );
    DROP POLICY IF EXISTS "debate_participants_select" ON public.debate_participants;
    CREATE POLICY "debate_participants_select" ON public.debate_participants FOR SELECT USING (
      public.internal_debate_moderator_id(debate_participants.debate_id) = auth.uid()
      OR public.internal_user_is_debate_participant(debate_participants.debate_id, auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND lower(COALESCE(p.role, '')) IN ('owner', 'admin')
      )
    );
    DROP POLICY IF EXISTS "debate_participants_insert" ON public.debate_participants;
    CREATE POLICY "debate_participants_insert" ON public.debate_participants FOR INSERT WITH CHECK (
      public.internal_debate_moderator_id(debate_id) = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND lower(COALESCE(p.role, '')) IN ('owner', 'admin')
      )
    );
    DROP POLICY IF EXISTS "debate_participants_update" ON public.debate_participants;
    CREATE POLICY "debate_participants_update" ON public.debate_participants FOR UPDATE USING (
      user_id = auth.uid()
      OR public.internal_debate_moderator_id(debate_participants.debate_id) = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND lower(COALESCE(p.role, '')) IN ('owner', 'admin')
      )
    );
    DROP POLICY IF EXISTS "debate_participants_delete" ON public.debate_participants;
    CREATE POLICY "debate_participants_delete" ON public.debate_participants FOR DELETE USING (
      public.internal_debate_moderator_id(debate_participants.debate_id) = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND lower(COALESCE(p.role, '')) IN ('owner', 'admin')
      )
    );
  $pol$;
  END IF;
END
$deb$;
