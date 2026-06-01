-- ============================================================================
-- Migration: Tables chat et messagerie
-- Date: 2026-05-21
--
-- Tables : chat_rooms, chat_room_members, chat_messages
--          conversations, conversation_participants, messages
--
-- Deux systèmes distincts :
--   - Chat Engine  : rooms publiques/privées dans l'app (communauté, cours)
--   - Messaging    : conversations privées 1-to-1 ou groupe (style DM)
-- ============================================================================

-- ══════════════════════════════════════════════════════════════════════════════
-- CHAT ENGINE
-- ══════════════════════════════════════════════════════════════════════════════

-- ── chat_rooms ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS chat_rooms (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  name            TEXT        NOT NULL,
  description     TEXT,
  type            TEXT        NOT NULL DEFAULT 'public'
                              CHECK (type IN ('public','private','course','support','direct')),
  slug            TEXT,

  is_archived     BOOLEAN     NOT NULL DEFAULT false,
  member_count    INT         NOT NULL DEFAULT 0,
  last_message_at TIMESTAMPTZ,
  metadata        JSONB       NOT NULL DEFAULT '{}',

  created_by      UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (tenant_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_chat_rooms_tenant  ON chat_rooms(tenant_id, type);
CREATE INDEX IF NOT EXISTS idx_chat_rooms_active  ON chat_rooms(tenant_id, is_archived) WHERE is_archived = false;

DROP TRIGGER IF EXISTS chat_rooms_updated_at ON chat_rooms;
CREATE TRIGGER chat_rooms_updated_at
  BEFORE UPDATE ON chat_rooms FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── chat_room_members ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS chat_room_members (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  room_id         UUID        NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
  user_id         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  role            TEXT        NOT NULL DEFAULT 'member'
                              CHECK (role IN ('owner','moderator','member')),
  is_muted        BOOLEAN     NOT NULL DEFAULT false,
  last_read_at    TIMESTAMPTZ,
  joined_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (room_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_chat_members_room ON chat_room_members(room_id);
CREATE INDEX IF NOT EXISTS idx_chat_members_user ON chat_room_members(user_id);

-- ── chat_messages ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS chat_messages (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  room_id         UUID        NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
  sender_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  content         TEXT        NOT NULL,
  message_type    TEXT        NOT NULL DEFAULT 'text'
                              CHECK (message_type IN ('text','image','file','system','emoji')),
  reply_to_id     UUID        REFERENCES chat_messages(id) ON DELETE SET NULL,

  is_edited       BOOLEAN     NOT NULL DEFAULT false,
  is_deleted      BOOLEAN     NOT NULL DEFAULT false,
  edited_at       TIMESTAMPTZ,
  reactions       JSONB       NOT NULL DEFAULT '{}',  -- {"👍": ["user_id1", ...]}
  attachments     JSONB       NOT NULL DEFAULT '[]',

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_room ON chat_messages(room_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_sender ON chat_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_visible ON chat_messages(room_id, created_at DESC)
  WHERE is_deleted = false;

-- ══════════════════════════════════════════════════════════════════════════════
-- MESSAGING PRIVÉ (DM / groupes)
-- ══════════════════════════════════════════════════════════════════════════════

-- ── conversations ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS conversations (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  title           TEXT,                            -- null pour les DM 1-to-1
  conv_type       TEXT        NOT NULL DEFAULT 'direct'
                              CHECK (conv_type IN ('direct','group','support')),
  is_archived     BOOLEAN     NOT NULL DEFAULT false,
  last_message_at TIMESTAMPTZ,
  metadata        JSONB       NOT NULL DEFAULT '{}',

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conversations_tenant ON conversations(tenant_id, last_message_at DESC);

DROP TRIGGER IF EXISTS conversations_updated_at ON conversations;
CREATE TRIGGER conversations_updated_at
  BEFORE UPDATE ON conversations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── conversation_participants ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS conversation_participants (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  conversation_id     UUID        NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id             UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  role                TEXT        NOT NULL DEFAULT 'member'
                                  CHECK (role IN ('admin','member')),
  is_muted            BOOLEAN     NOT NULL DEFAULT false,
  last_read_at        TIMESTAMPTZ,
  joined_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  left_at             TIMESTAMPTZ,

  UNIQUE (conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_conv_participants_user ON conversation_participants(user_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_conv_participants_conv ON conversation_participants(conversation_id);

-- ── messages ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS messages (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  conversation_id     UUID        NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id           UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  content             TEXT        NOT NULL,
  message_type        TEXT        NOT NULL DEFAULT 'text'
                                  CHECK (message_type IN ('text','image','file','system')),
  reply_to_id         UUID        REFERENCES messages(id) ON DELETE SET NULL,

  is_edited           BOOLEAN     NOT NULL DEFAULT false,
  is_deleted          BOOLEAN     NOT NULL DEFAULT false,
  edited_at           TIMESTAMPTZ,
  read_by             JSONB       NOT NULL DEFAULT '[]',   -- [user_id, ...]
  attachments         JSONB       NOT NULL DEFAULT '[]',

  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_conv    ON messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender  ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_visible ON messages(conversation_id, created_at DESC)
  WHERE is_deleted = false;

-- ── RLS ───────────────────────────────────────────────────────────────────

ALTER TABLE chat_rooms             ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_room_members      ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages          ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations          ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages               ENABLE ROW LEVEL SECURITY;

-- chat_rooms
DROP POLICY IF EXISTS "member_read_public_rooms" ON chat_rooms;
CREATE POLICY "member_read_public_rooms" ON chat_rooms FOR SELECT TO authenticated
  USING (type = 'public' AND EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.tenant_id = chat_rooms.tenant_id AND tm.user_id = auth.uid()));

DROP POLICY IF EXISTS "room_member_read_private" ON chat_rooms;
CREATE POLICY "room_member_read_private" ON chat_rooms FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM chat_room_members crm WHERE crm.room_id = chat_rooms.id AND crm.user_id = auth.uid()));

DROP POLICY IF EXISTS "admin_manage_rooms" ON chat_rooms;
CREATE POLICY "admin_manage_rooms" ON chat_rooms FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.tenant_id = chat_rooms.tenant_id AND tm.user_id = auth.uid() AND tm.role IN ('owner','admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.tenant_id = chat_rooms.tenant_id AND tm.user_id = auth.uid() AND tm.role IN ('owner','admin')));

DROP POLICY IF EXISTS "sr_chat_rooms" ON chat_rooms;
CREATE POLICY "sr_chat_rooms" ON chat_rooms FOR ALL TO service_role USING (true) WITH CHECK (true);

-- chat_room_members
DROP POLICY IF EXISTS "room_member_read_members" ON chat_room_members;
CREATE POLICY "room_member_read_members" ON chat_room_members FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM chat_room_members crm2 WHERE crm2.room_id = chat_room_members.room_id AND crm2.user_id = auth.uid()));

DROP POLICY IF EXISTS "sr_chat_members" ON chat_room_members;
CREATE POLICY "sr_chat_members" ON chat_room_members FOR ALL TO service_role USING (true) WITH CHECK (true);

-- chat_messages
DROP POLICY IF EXISTS "room_member_read_messages" ON chat_messages;
CREATE POLICY "room_member_read_messages" ON chat_messages FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM chat_room_members crm WHERE crm.room_id = chat_messages.room_id AND crm.user_id = auth.uid()));

DROP POLICY IF EXISTS "room_member_send_messages" ON chat_messages;
CREATE POLICY "room_member_send_messages" ON chat_messages FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid() AND EXISTS (SELECT 1 FROM chat_room_members crm WHERE crm.room_id = chat_messages.room_id AND crm.user_id = auth.uid()));

DROP POLICY IF EXISTS "sr_chat_messages" ON chat_messages;
CREATE POLICY "sr_chat_messages" ON chat_messages FOR ALL TO service_role USING (true) WITH CHECK (true);

-- conversations
DROP POLICY IF EXISTS "participant_read_convs" ON conversations;
CREATE POLICY "participant_read_convs" ON conversations FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM conversation_participants cp WHERE cp.conversation_id = conversations.id AND cp.user_id = auth.uid() AND cp.left_at IS NULL));

DROP POLICY IF EXISTS "sr_conversations" ON conversations;
CREATE POLICY "sr_conversations" ON conversations FOR ALL TO service_role USING (true) WITH CHECK (true);

-- conversation_participants
DROP POLICY IF EXISTS "participant_read_own" ON conversation_participants;
CREATE POLICY "participant_read_own" ON conversation_participants FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM conversation_participants cp2 WHERE cp2.conversation_id = conversation_participants.conversation_id AND cp2.user_id = auth.uid()));

DROP POLICY IF EXISTS "sr_conv_participants" ON conversation_participants;
CREATE POLICY "sr_conv_participants" ON conversation_participants FOR ALL TO service_role USING (true) WITH CHECK (true);

-- messages
DROP POLICY IF EXISTS "participant_read_messages" ON messages;
CREATE POLICY "participant_read_messages" ON messages FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM conversation_participants cp WHERE cp.conversation_id = messages.conversation_id AND cp.user_id = auth.uid() AND cp.left_at IS NULL));

DROP POLICY IF EXISTS "participant_send_messages" ON messages;
CREATE POLICY "participant_send_messages" ON messages FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid() AND EXISTS (SELECT 1 FROM conversation_participants cp WHERE cp.conversation_id = messages.conversation_id AND cp.user_id = auth.uid() AND cp.left_at IS NULL));

DROP POLICY IF EXISTS "sr_messages" ON messages;
CREATE POLICY "sr_messages" ON messages FOR ALL TO service_role USING (true) WITH CHECK (true);

COMMENT ON TABLE chat_rooms             IS 'Salons de chat communautaires (public, privé, cours, support).';
COMMENT ON TABLE chat_room_members      IS 'Membres d''un salon de chat avec rôle et état de lecture.';
COMMENT ON TABLE chat_messages          IS 'Messages d''un salon de chat avec réactions et pièces jointes.';
COMMENT ON TABLE conversations          IS 'Conversations privées (DM 1-to-1 ou groupes).';
COMMENT ON TABLE conversation_participants IS 'Participants à une conversation privée.';
COMMENT ON TABLE messages               IS 'Messages d''une conversation privée.';
