-- LIRI Brain — Conversations table (Phase 3)
-- Stores chat conversations per tenant per user with full message history

CREATE TABLE IF NOT EXISTS liri_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  model TEXT NOT NULL DEFAULT 'deepseek-chat',
  title TEXT NOT NULL DEFAULT 'Nouvelle conversation',
  messages_json JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_liri_conv_tenant ON liri_conversations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_liri_conv_user ON liri_conversations(tenant_id, user_id);
CREATE INDEX IF NOT EXISTS idx_liri_conv_updated ON liri_conversations(tenant_id, updated_at DESC);

ALTER TABLE liri_conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "LIRI conversations visibles par leur auteur" ON liri_conversations;
CREATE POLICY "LIRI conversations visibles par leur auteur" ON liri_conversations
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "LIRI conversations modifiables par leur auteur" ON liri_conversations;
CREATE POLICY "LIRI conversations modifiables par leur auteur" ON liri_conversations
  FOR ALL USING (user_id = auth.uid());
