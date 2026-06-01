-- ============================================================
-- PRORASCIENCE — Invitations sessions live + droits membres
-- ============================================================

-- 1) live_session_invitations
CREATE TABLE IF NOT EXISTS public.live_session_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  live_session_id UUID NOT NULL REFERENCES public.live_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  invited_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(live_session_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_live_invitations_session ON public.live_session_invitations(live_session_id);
CREATE INDEX IF NOT EXISTS idx_live_invitations_user ON public.live_session_invitations(user_id);

-- 2) can_invite_others sur participants (modérateurs/membres peuvent inviter)
ALTER TABLE public.live_session_participants
  ADD COLUMN IF NOT EXISTS can_invite_others BOOLEAN NOT NULL DEFAULT false;

-- 3) RLS live_session_invitations
ALTER TABLE public.live_session_invitations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "live_invitations_read" ON public.live_session_invitations;
DROP POLICY IF EXISTS "live_invitations_insert" ON public.live_session_invitations;
DROP POLICY IF EXISTS "live_invitations_update" ON public.live_session_invitations;

CREATE POLICY "live_invitations_read" ON public.live_session_invitations FOR SELECT USING (
  user_id = auth.uid()
  OR invited_by = auth.uid()
  OR EXISTS (SELECT 1 FROM public.live_sessions ls WHERE ls.id = live_session_id AND ls.teacher_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND lower(COALESCE(p.role,'')) IN ('owner','admin','secretariat'))
);

CREATE POLICY "live_invitations_insert" ON public.live_session_invitations FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.live_sessions ls WHERE ls.id = live_session_id AND ls.teacher_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.live_session_participants lp WHERE lp.live_session_id = live_session_id AND lp.user_id = auth.uid() AND lp.can_invite_others = true)
  OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND lower(COALESCE(p.role,'')) IN ('owner','admin','secretariat'))
);

CREATE POLICY "live_invitations_update" ON public.live_session_invitations FOR UPDATE USING (
  user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.live_sessions ls WHERE ls.id = live_session_id AND ls.teacher_id = auth.uid())
);

COMMENT ON TABLE public.live_session_invitations IS 'Invitations aux sessions live. Membres avec can_invite_others peuvent inviter.';
