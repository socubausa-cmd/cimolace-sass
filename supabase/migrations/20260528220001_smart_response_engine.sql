-- ═════════════════════════════════════════════════════════════════════════════
-- LIRI Smart Response Engine — chatbot IA secrétariat avec knowledge base
--
-- Architecture :
--   1. response_knowledge_entries (KB) — articles structurés (titre, contenu, intents, keywords)
--   2. conversation_threads (EXISTE) — fil de discussion visiteur/équipe
--   3. conversation_messages (EXISTE) — messages du fil
--   4. response_intents — taxonomie des intents détectés
--   5. response_engine_logs — log par requête (intent, score, route, latence)
--   6. response_engine_followups — relances programmées
-- ═════════════════════════════════════════════════════════════════════════════

-- 1) Knowledge base — articles utilisés pour la Q&A IA
CREATE TABLE IF NOT EXISTS response_knowledge_entries (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID REFERENCES tenants(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  content       TEXT NOT NULL,
  source_label  TEXT DEFAULT 'manual',
  source_url    TEXT,
  intents       TEXT[] DEFAULT '{}',
  keywords      TEXT[] DEFAULT '{}',
  language      TEXT DEFAULT 'fr',
  priority      INT NOT NULL DEFAULT 50,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  embedding     VECTOR(384),                   -- gte-small embeddings pour RAG
  created_by    UUID,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_response_kb_tenant ON response_knowledge_entries(tenant_id);
CREATE INDEX IF NOT EXISTS idx_response_kb_active ON response_knowledge_entries(is_active, priority DESC);
CREATE INDEX IF NOT EXISTS idx_response_kb_intents ON response_knowledge_entries USING gin(intents);

-- 2) Intents — taxonomie pour la détection
CREATE TABLE IF NOT EXISTS response_intents (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID REFERENCES tenants(id) ON DELETE CASCADE,
  key           TEXT NOT NULL,                  -- 'pricing', 'enrollment', 'support'
  label         TEXT NOT NULL,
  keywords      TEXT[] DEFAULT '{}',
  parent_intent UUID REFERENCES response_intents(id),
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, key)
);

-- 3) Logs Q&A
CREATE TABLE IF NOT EXISTS response_engine_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID REFERENCES tenants(id) ON DELETE CASCADE,
  thread_id       UUID,
  intent          TEXT,
  message         TEXT,
  matched_kb_id   UUID REFERENCES response_knowledge_entries(id) ON DELETE SET NULL,
  match_score     NUMERIC(6,3),
  route           TEXT,                          -- 'auto_reply' | 'escalation' | 'followup'
  qualified_lead  BOOLEAN DEFAULT false,
  latency_ms      INT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_response_logs_tenant ON response_engine_logs(tenant_id, created_at DESC);

-- 4) Followups (relances programmées)
CREATE TABLE IF NOT EXISTS response_engine_followups (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID REFERENCES tenants(id) ON DELETE CASCADE,
  thread_id     UUID NOT NULL,
  scheduled_at  TIMESTAMPTZ NOT NULL,
  fired_at      TIMESTAMPTZ,
  reason        TEXT,
  template      TEXT,
  payload       JSONB DEFAULT '{}',
  status        TEXT NOT NULL DEFAULT 'pending',  -- pending | fired | cancelled
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_response_followups_pending
  ON response_engine_followups(scheduled_at)
  WHERE status = 'pending';

-- RLS
ALTER TABLE response_knowledge_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE response_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE response_engine_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE response_engine_followups ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "service_role_full_kb" ON response_knowledge_entries TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "service_role_full_intents" ON response_intents TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "service_role_full_re_logs" ON response_engine_logs TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "service_role_full_followups" ON response_engine_followups TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

COMMENT ON TABLE response_knowledge_entries IS
  'Knowledge base LIRI Smart Response — articles utilisés pour la Q&A IA secrétariat';
