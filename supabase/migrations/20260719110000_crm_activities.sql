-- ─────────────────────────────────────────────────────────────────────────────
-- CRM — TIMELINE D'ACTIVITÉS (Vague 4, brique #1). Journal tenant-scopé des événements
-- CRM (deal créé/déplacé/gagné/perdu, note ajoutée, contact/société créés, lead converti).
-- Alimente une timeline par entité + un flux récent. Mêmes conventions que les autres
-- tables crm_* : tenant_id + FK tenants CASCADE, RLS deny-by-default (API service_role).
-- Appliquer HORS-BANDE (psql), jamais `supabase db push`. Idempotente.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS crm_activities (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  entity_type text CHECK (entity_type IN ('contact','company','deal','lead')),
  entity_id   uuid,
  type        text NOT NULL,          -- deal_created | deal_stage_moved | deal_won | deal_lost | deal_deleted | note_added | contact_created | company_created | lead_converted | ...
  title       text NOT NULL DEFAULT '',
  meta        jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor_id    uuid,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Flux récent global + timeline par entité.
CREATE INDEX IF NOT EXISTS idx_crm_activities_tenant ON crm_activities(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_activities_entity ON crm_activities(tenant_id, entity_type, entity_id, created_at DESC);

ALTER TABLE crm_activities ENABLE ROW LEVEL SECURITY;
