-- Knowledge base RAG — migration des Edge Functions V1 `embed-knowledge` /
-- `match_knowledge` vers NestJS. Les embeddings gte-small (384 dims) sont
-- générés côté API (transformers.js, Supabase/gte-small) — pas de Supabase.ai.
-- ⚠️ `supabase db push` est cassé sur ce projet → appliquer ce fichier À LA MAIN
--    dans le SQL Editor du dashboard. CREATE POLICY n'est pas idempotent d'où le
--    DROP POLICY IF EXISTS avant.

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS knowledge_base (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID REFERENCES tenants(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  topic       TEXT,
  content     TEXT NOT NULL,
  source      TEXT,
  embedding   VECTOR(384),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_knowledge_base_tenant ON knowledge_base(tenant_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_embedding
  ON knowledge_base USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

ALTER TABLE knowledge_base ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_full_kb_base" ON knowledge_base;
CREATE POLICY "service_role_full_kb_base" ON knowledge_base
  TO service_role USING (true) WITH CHECK (true);

-- Recherche par similarité cosinus. Noms de params compatibles avec le helper
-- Longia V1 (query_embedding / match_threshold / match_count) ; `p_tenant_id`
-- optionnel — la voie NestJS le passe TOUJOURS (isolation multi-tenant).
CREATE OR REPLACE FUNCTION match_knowledge(
  query_embedding VECTOR(384),
  match_threshold FLOAT DEFAULT 0.5,
  match_count     INT   DEFAULT 5,
  p_tenant_id     UUID  DEFAULT NULL
)
RETURNS TABLE (id UUID, title TEXT, topic TEXT, content TEXT, source TEXT, similarity FLOAT)
LANGUAGE sql STABLE
AS $$
  SELECT kb.id, kb.title, kb.topic, kb.content, kb.source,
         1 - (kb.embedding <=> query_embedding) AS similarity
  FROM knowledge_base kb
  WHERE kb.embedding IS NOT NULL
    AND (p_tenant_id IS NULL OR kb.tenant_id = p_tenant_id)
    AND 1 - (kb.embedding <=> query_embedding) > match_threshold
  ORDER BY kb.embedding <=> query_embedding
  LIMIT match_count;
$$;
