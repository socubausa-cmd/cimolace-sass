-- Migration: live_sessions full schema + supporting tables
-- Adds missing columns to live_sessions and creates live_invitations,
-- live_visibility_rules, live_waiting_room_entries tables.
-- Applied: 2026-05-28

-- ─── 1. live_sessions — add missing columns ───────────────────────────────────
ALTER TABLE live_sessions ADD COLUMN IF NOT EXISTS teacher_id UUID REFERENCES auth.users(id);
ALTER TABLE live_sessions ADD COLUMN IF NOT EXISTS cover_image_url TEXT;
ALTER TABLE live_sessions ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;
ALTER TABLE live_sessions ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ;
ALTER TABLE live_sessions ADD COLUMN IF NOT EXISTS session_type TEXT NOT NULL DEFAULT 'class'
  CHECK (session_type IN ('class', 'webinar', 'masterclass', 'coaching', 'workshop', 'evaluation'));
ALTER TABLE live_sessions ADD COLUMN IF NOT EXISTS formation_id UUID;
ALTER TABLE live_sessions ADD COLUMN IF NOT EXISTS video_room_url TEXT;
ALTER TABLE live_sessions ADD COLUMN IF NOT EXISTS video_room_id TEXT;
ALTER TABLE live_sessions ADD COLUMN IF NOT EXISTS config JSONB DEFAULT '{}';
ALTER TABLE live_sessions ADD COLUMN IF NOT EXISTS debate_id UUID;
ALTER TABLE live_sessions ADD COLUMN IF NOT EXISTS video_provider TEXT DEFAULT 'livekit';

-- Sync teacher_id from host_user_id for existing rows
UPDATE live_sessions SET teacher_id = host_user_id WHERE teacher_id IS NULL AND host_user_id IS NOT NULL;

-- ─── 2. live_visibility_rules ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS live_visibility_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  live_session_id UUID NOT NULL REFERENCES live_sessions(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES tenants(id),
  is_public BOOLEAN NOT NULL DEFAULT FALSE,
  target_roles TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_live_visibility_session ON live_visibility_rules(live_session_id);
CREATE INDEX IF NOT EXISTS idx_live_visibility_public ON live_visibility_rules(is_public) WHERE is_public = TRUE;

ALTER TABLE live_visibility_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY live_visibility_select ON live_visibility_rules
  FOR SELECT TO authenticated
  USING (
    is_public = TRUE
    OR tenant_id IN (
      SELECT tenant_id FROM tenant_memberships
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- ─── 3. live_invitations ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS live_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  live_session_id UUID NOT NULL REFERENCES live_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invitation_type TEXT NOT NULL DEFAULT 'student'
    CHECK (invitation_type IN ('student', 'guest', 'vip', 'co_host')),
  status TEXT NOT NULL DEFAULT 'sent'
    CHECK (status IN ('pending', 'sent', 'seen', 'accepted', 'declined', 'expired')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(live_session_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_live_invitations_user ON live_invitations(user_id);
CREATE INDEX IF NOT EXISTS idx_live_invitations_session ON live_invitations(live_session_id);

ALTER TABLE live_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY live_inv_select ON live_invitations
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY live_inv_update ON live_invitations
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ─── 4. live_waiting_room_entries ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS live_waiting_room_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  live_session_id UUID NOT NULL REFERENCES live_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'waiting'
    CHECK (status IN ('waiting', 'admitted', 'rejected', 'left')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(live_session_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_live_waiting_user ON live_waiting_room_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_live_waiting_session ON live_waiting_room_entries(live_session_id);

ALTER TABLE live_waiting_room_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY waiting_room_select ON live_waiting_room_entries
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- ─── 5. immersive_live_sessions (si absente) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS immersive_live_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT,
  host_user_id UUID NOT NULL REFERENCES auth.users(id),
  guest_user_id UUID REFERENCES auth.users(id),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'ended')),
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_immersive_host ON immersive_live_sessions(host_user_id);
CREATE INDEX IF NOT EXISTS idx_immersive_guest ON immersive_live_sessions(guest_user_id);

ALTER TABLE immersive_live_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY immersive_select ON immersive_live_sessions
  FOR SELECT TO authenticated
  USING (host_user_id = auth.uid() OR guest_user_id = auth.uid());

-- ─── 6. live_neuro_recall_state (si absente) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS live_neuro_recall_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  live_session_id UUID NOT NULL REFERENCES live_sessions(id) ON DELETE CASCADE UNIQUE,
  workflow_status TEXT NOT NULL DEFAULT 'draft_generated'
    CHECK (workflow_status IN ('draft_generated', 'pending_review', 'approved', 'published', 'rejected')),
  replay_public_url TEXT,
  postproduction_content_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE live_neuro_recall_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY neuro_recall_select ON live_neuro_recall_state
  FOR SELECT TO authenticated
  USING (TRUE);
