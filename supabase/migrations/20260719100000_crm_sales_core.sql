-- ─────────────────────────────────────────────────────────────────────────────
-- CRM — CŒUR SALES (Vague 2). Schéma inspiré d'Atomic CRM (MIT) mais RÉ-ARCHITECTURÉ
-- pour Cimolace : multi-tenant strict (tenant_id partout + FK tenants ON DELETE CASCADE),
-- RLS activée (deny-by-default : ces tables ne sont touchées QUE par l'API NestJS en
-- service_role, qui bypass la RLS et scope via .eq('tenant_id') ; anon/authenticated →
-- 0 ligne, jamais de fuite inter-tenant). Aucune donnée existante touchée (tables neuves).
--
-- Différences vs Atomic : pas de config singleton (CHECK id=1) → tout est tenant-scopé ;
-- pas d'accès direct-Supabase (Atomic parle PostgREST) → API applicative uniquement ;
-- lien `crm_contacts.lead_id → leads` pour convertir un lead du Growth Engine en contact.
--
-- Appliquer HORS-BANDE (psql / SQL editor), jamais `supabase db push` (règle projet).
-- Idempotente (CREATE ... IF NOT EXISTS). Ordre : entités → index → RLS → trigger updated_at.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1) ENTITÉS ──────────────────────────────────────────────────────────────────

-- Sociétés (comptes / organisations)
CREATE TABLE IF NOT EXISTS crm_companies (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name        text NOT NULL,
  website     text,
  industry    text,
  size        text,           -- '1-10','11-50','51-200',...
  phone       text,
  address     text,
  city        text,
  country     text,
  description text,
  owner_id    uuid,           -- membre du tenant référent (pas de FK dure : users côté auth)
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Contacts (personnes), rattachés optionnellement à une société et à un lead d'origine
CREATE TABLE IF NOT EXISTS crm_contacts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  company_id  uuid REFERENCES crm_companies(id) ON DELETE SET NULL,
  lead_id     uuid REFERENCES leads(id) ON DELETE SET NULL,   -- conversion Growth Engine → CRM
  first_name  text,
  last_name   text,
  email       text,
  phone       text,
  title       text,           -- poste / fonction
  status      text NOT NULL DEFAULT 'active',   -- active / archived
  source      text,           -- lead / import / manual / ...
  owner_id    uuid,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Pipelines (un tenant peut en avoir plusieurs)
CREATE TABLE IF NOT EXISTS crm_pipelines (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name        text NOT NULL,
  is_default  boolean NOT NULL DEFAULT false,
  position    integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Étapes du kanban (colonnes ordonnées, par pipeline)
CREATE TABLE IF NOT EXISTS crm_stages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  pipeline_id     uuid NOT NULL REFERENCES crm_pipelines(id) ON DELETE CASCADE,
  name            text NOT NULL,
  position        integer NOT NULL DEFAULT 0,
  win_probability integer NOT NULL DEFAULT 0,   -- 0..100
  is_won          boolean NOT NULL DEFAULT false,
  is_lost         boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Opportunités (deals)
CREATE TABLE IF NOT EXISTS crm_deals (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  pipeline_id         uuid NOT NULL REFERENCES crm_pipelines(id) ON DELETE CASCADE,
  stage_id            uuid REFERENCES crm_stages(id) ON DELETE SET NULL,
  company_id          uuid REFERENCES crm_companies(id) ON DELETE SET NULL,
  contact_id          uuid REFERENCES crm_contacts(id) ON DELETE SET NULL,
  title               text NOT NULL,
  amount              numeric(14,2) NOT NULL DEFAULT 0,
  currency            text NOT NULL DEFAULT 'EUR',
  status              text NOT NULL DEFAULT 'open',   -- open / won / lost
  expected_close_date date,
  position            integer NOT NULL DEFAULT 0,     -- ordre dans la colonne kanban
  owner_id            uuid,
  closed_at           timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- Notes (polymorphes : contact / company / deal)
CREATE TABLE IF NOT EXISTS crm_notes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  entity_type text NOT NULL CHECK (entity_type IN ('contact','company','deal')),
  entity_id   uuid NOT NULL,
  author_id   uuid,
  body        text NOT NULL DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Tâches (todos), optionnellement rattachées à une entité
CREATE TABLE IF NOT EXISTS crm_tasks (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  entity_type  text CHECK (entity_type IN ('contact','company','deal')),
  entity_id    uuid,
  title        text NOT NULL,
  due_date     date,
  status       text NOT NULL DEFAULT 'open',   -- open / done
  assignee_id  uuid,
  created_at   timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

-- Étiquettes + jointure polymorphe
CREATE TABLE IF NOT EXISTS crm_tags (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name       text NOT NULL,
  color      text NOT NULL DEFAULT '#64748b',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);

CREATE TABLE IF NOT EXISTS crm_taggables (
  tag_id      uuid NOT NULL REFERENCES crm_tags(id) ON DELETE CASCADE,
  entity_type text NOT NULL CHECK (entity_type IN ('contact','company','deal')),
  entity_id   uuid NOT NULL,
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  PRIMARY KEY (tag_id, entity_type, entity_id)
);

-- 2) INDEX (scoping tenant + lookups fréquents) ───────────────────────────────
CREATE INDEX IF NOT EXISTS idx_crm_companies_tenant     ON crm_companies(tenant_id);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_tenant      ON crm_contacts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_company     ON crm_contacts(company_id);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_lead        ON crm_contacts(lead_id);
CREATE INDEX IF NOT EXISTS idx_crm_pipelines_tenant     ON crm_pipelines(tenant_id);
CREATE INDEX IF NOT EXISTS idx_crm_stages_pipeline      ON crm_stages(pipeline_id, position);
CREATE INDEX IF NOT EXISTS idx_crm_deals_tenant         ON crm_deals(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_crm_deals_pipeline_stage ON crm_deals(pipeline_id, stage_id, position);
CREATE INDEX IF NOT EXISTS idx_crm_notes_entity         ON crm_notes(tenant_id, entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_crm_tasks_tenant         ON crm_tasks(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_crm_taggables_entity     ON crm_taggables(tenant_id, entity_type, entity_id);

-- 3) RLS (deny-by-default ; service_role bypasse et scope via .eq('tenant_id')) ─
--    Activer sans policy permissive = anon/authenticated obtiennent 0 ligne. Un
--    durcissement par policy membership (auth.uid()→tenant_memberships) pourra être
--    ajouté si un accès direct-Supabase est un jour introduit.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'crm_companies','crm_contacts','crm_pipelines','crm_stages','crm_deals',
    'crm_notes','crm_tasks','crm_tags','crm_taggables'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
  END LOOP;
END $$;

-- 4) updated_at auto (fonction dédiée pour ne pas collisionner un helper global) ─
CREATE OR REPLACE FUNCTION crm_set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$ LANGUAGE plpgsql;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['crm_companies','crm_contacts','crm_deals'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%1$s_updated_at ON %1$s;', t);
    EXECUTE format(
      'CREATE TRIGGER trg_%1$s_updated_at BEFORE UPDATE ON %1$s
         FOR EACH ROW EXECUTE FUNCTION crm_set_updated_at();', t);
  END LOOP;
END $$;
