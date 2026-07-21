-- ─────────────────────────────────────────────────────────────────────────────
-- CRM/Marketing — RÉCONCILIATION du schéma sur la PROD RÉELLE (source de vérité).
--
-- Contexte : la seule migration existante (20260521000034_marketing_crm.sql) définit
-- un schéma RICHE + des VUES marketing_campaigns/funnels/automations qui NE CORRESPOND
-- PAS à la prod. La prod (et le code MarketingAdvancedService, réconcilié le 2026-07-18)
-- utilise en réalité des TABLES minimales tenant-scopées. Résultat : aucune source de
-- vérité reproductible ; sur un env neuf, le code casserait (insert dans des vues +
-- colonnes inexistantes + CHECK status rejetant warm/hot/customer).
--
-- Cette migration rend le schéma REPRODUCTIBLE et cohérent avec la prod + le code, de
-- façon IDEMPOTENTE (no-op sur la prod, correction sur un env neuf). Aucune donnée touchée.
-- Appliquer HORS-BANDE (psql / SQL editor), jamais `supabase db push` (règle projet).
-- ─────────────────────────────────────────────────────────────────────────────

-- 1) Si un env neuf a créé marketing_* comme VUES (ancienne migration), on les retire
--    UNIQUEMENT si ce sont des vues (sur la prod ce sont des tables → aucune action).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'marketing_campaigns'  AND relkind = 'v') THEN DROP VIEW marketing_campaigns  CASCADE; END IF;
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'marketing_funnels'    AND relkind = 'v') THEN DROP VIEW marketing_funnels    CASCADE; END IF;
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'marketing_automations' AND relkind = 'v') THEN DROP VIEW marketing_automations CASCADE; END IF;
END $$;

-- 2) Tables RÉELLES (idempotent — no-op si déjà présentes en prod).
CREATE TABLE IF NOT EXISTS leads (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL,
  email      text,
  name       text DEFAULT '',
  source     text DEFAULT 'direct',
  status     text DEFAULT 'new',
  score      integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE (tenant_id, email)   -- cible du upsert onConflict(tenant_id,email) — miroir prod leads_tenant_id_email_key
);

CREATE TABLE IF NOT EXISTS marketing_campaigns (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL,
  name       text,
  type       text DEFAULT 'email',
  channel    text DEFAULT 'email',
  content    text DEFAULT '',
  status     text DEFAULT 'draft',
  started_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS marketing_funnels (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL,
  name       text,
  steps      jsonb DEFAULT '[]'::jsonb,
  status     text DEFAULT 'draft',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS marketing_automations (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL,
  name              text,
  trigger_condition text DEFAULT '',
  actions           jsonb DEFAULT '[]'::jsonb,
  status            text DEFAULT 'active',
  created_at        timestamptz DEFAULT now()
);

-- 3) Réconcilier une table `leads` HÉRITÉE de l'ancien schéma riche (env neuf) : garantir
--    les colonnes que le code utilise + relâcher le CHECK status (qui rejetait warm/hot/customer).
ALTER TABLE leads ADD COLUMN IF NOT EXISTS name   text    DEFAULT '';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS source text    DEFAULT 'direct';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS status text    DEFAULT 'new';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS score  integer DEFAULT 0;
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_status_check;   -- le code écrit new/warm/hot/customer/lost (texte libre)

-- 4) Index de scoping tenant (idempotent). Pour leads, on MIROITE l'index prod existant
--    idx_leads_tenant = (tenant_id, status) (même nom + même déf → no-op sur la prod).
CREATE INDEX IF NOT EXISTS idx_leads_tenant                 ON leads(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_tenant   ON marketing_campaigns(tenant_id);
CREATE INDEX IF NOT EXISTS idx_marketing_funnels_tenant     ON marketing_funnels(tenant_id);
CREATE INDEX IF NOT EXISTS idx_marketing_automations_tenant ON marketing_automations(tenant_id);
-- (L'unicité (tenant_id,email) est portée par la contrainte inline de la table leads ci-dessus.)

-- NB : RLS non touchée ici (l'API tourne en service_role + scoping .eq('tenant_id')). Un
-- durcissement RLS (policies tenant sur ces 4 tables) fera l'objet d'une migration dédiée.
