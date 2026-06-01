-- Live chat invitations for immersive messaging
-- Allows sender -> receiver invitation, accept/decline/missed flow, and scheduling.

CREATE TABLE IF NOT EXISTS public.live_chat_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'declined', 'missed', 'ended')),
  scheduled_for TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_live_chat_invites_sender ON public.live_chat_invites(sender_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_live_chat_invites_receiver ON public.live_chat_invites(receiver_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_live_chat_invites_status ON public.live_chat_invites(status, scheduled_for);

ALTER TABLE public.live_chat_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "live_chat_invites_read" ON public.live_chat_invites;
DROP POLICY IF EXISTS "live_chat_invites_insert" ON public.live_chat_invites;
DROP POLICY IF EXISTS "live_chat_invites_update" ON public.live_chat_invites;
DROP POLICY IF EXISTS "live_chat_invites_delete" ON public.live_chat_invites;

CREATE POLICY "live_chat_invites_read" ON public.live_chat_invites
FOR SELECT TO authenticated
USING (sender_id = auth.uid() OR receiver_id = auth.uid());

CREATE POLICY "live_chat_invites_insert" ON public.live_chat_invites
FOR INSERT TO authenticated
WITH CHECK (sender_id = auth.uid() AND sender_id <> receiver_id);

CREATE POLICY "live_chat_invites_update" ON public.live_chat_invites
FOR UPDATE TO authenticated
USING (sender_id = auth.uid() OR receiver_id = auth.uid())
WITH CHECK (sender_id = auth.uid() OR receiver_id = auth.uid());

CREATE POLICY "live_chat_invites_delete" ON public.live_chat_invites
FOR DELETE TO authenticated
USING (sender_id = auth.uid());
