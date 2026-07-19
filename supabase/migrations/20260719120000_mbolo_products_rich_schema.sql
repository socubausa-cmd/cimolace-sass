-- ─────────────────────────────────────────────────────────────────────────────
-- mbolo_products : enrichissement pour PARITÉ avec le modèle produit zahirwellness.
--
-- Contexte : consolidation sur UN seul moteur commerce (l'API Cimolace). Le
-- back-office storefront administre désormais son catalogue via /v1/mbolo/admin/*
-- (clé `mba_`, tenant-scopée). Le schéma mbolo_products d'origine (name/prix/stock/
-- images) ne portait PAS les champs riches de l'admin zahir → on les ajoute en
-- colonnes JSONB additives (aucune perte, aucune réécriture des lignes existantes).
--
-- Idempotent (ADD COLUMN IF NOT EXISTS) — rejouable sans risque.
-- Appliqué HORS-BANDE via psql (jamais `supabase db push`).
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.mbolo_products
  ADD COLUMN IF NOT EXISTS name_en       text,
  ADD COLUMN IF NOT EXISTS name_fr       text,
  ADD COLUMN IF NOT EXISTS visibility    text  NOT NULL DEFAULT 'public',
  ADD COLUMN IF NOT EXISTS pricing       jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS inventory     jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS logistics     jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS merchandising jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS meta          jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.mbolo_products.name_en       IS 'Nom EN (name reste le nom canonique/legacy)';
COMMENT ON COLUMN public.mbolo_products.name_fr       IS 'Nom FR (name reste le nom canonique/legacy)';
COMMENT ON COLUMN public.mbolo_products.visibility    IS 'public | draft | private (étend is_active)';
COMMENT ON COLUMN public.mbolo_products.pricing       IS 'Multi-devise: {usd,eur,xaf, compareAt:{usd,eur}} — étend price_cents/currency';
COMMENT ON COLUMN public.mbolo_products.inventory     IS 'Stock par entrepôt {france,usa} + seuils {lowStockThreshold}';
COMMENT ON COLUMN public.mbolo_products.logistics     IS 'Transport: poids/dimensions/flags (fragile,liquide...)/shippingClass';
COMMENT ON COLUMN public.mbolo_products.merchandising IS 'Campagne featured (titres, cta, dates, badge, featuredOrder)';
COMMENT ON COLUMN public.mbolo_products.meta          IS 'Posologie, warnings, form, durée, capsules, négociation';
