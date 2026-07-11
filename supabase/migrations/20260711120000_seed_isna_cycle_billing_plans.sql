-- Seed IDEMPOTENT des 12 plans « cycle » d'initiation ISNA/Prorascience
-- (autonome | academique | prive | privilegie) × (monthly | quarterly | yearly).
--
-- POURQUOI : ForfaitsPage.jsx (le checkout /forfaits) ne liste QUE les billing_plans dont la
-- clé matche /^(autonome|academique|prive|privilegie)-/. Ces 12 lignes existent en PROD (insérées
-- à la main), mais AUCUNE migration ne les crée : la migration 20260620140000_billing_plans_catalog
-- ne fait que des UPDATE (elle suppose les lignes présentes). Sur un environnement neuf, ces UPDATE
-- sont des no-op → ForfaitsPage tombe sur ses `fallbackPlans` (XAF, non payables) et affiche
-- « Indisponible ». Ce fichier rend le seed reproductible.
--
-- Additif & rejouable : ON CONFLICT (key) DO NOTHING (index unique billing_plans_key_key).
-- En PROD, où les lignes existent déjà, cette migration est un NO-OP total (aucun prix touché).
--
-- Montants = copie EXACTE de la prod (price_cents, EUR). stripe_price_id volontairement NULL :
-- il n'y en a aucun en base — le checkout résout le prix depuis price_cents (offering-checkout).
-- Le câblage Stripe (price ids) reste une étape séparée, hors de ce seed.
--
-- Doit tourner APRÈS 20260620140000 (colonnes tenant_id/category/sort_order/tagline/metadata) et
-- 20260620150000 (colonne access_model NOT NULL DEFAULT 'paid') : ce timestamp les suit.

INSERT INTO public.billing_plans
  (tenant_id, key, label, description, price_cents, currency, billing_cycle,
   features, is_active, category, sort_order, tagline, metadata, access_model, stripe_price_id)
VALUES
  ('4f6faaa8-43a0-46d6-b98a-99ea1154f9ea', 'autonome-monthly',     'Cycle Autonome',   NULL,   2900, 'EUR', 'monthly',   '{}'::jsonb, true, 'cycle', 1, 'Apprenez à votre rythme.',            '{}'::jsonb, 'paid', NULL),
  ('4f6faaa8-43a0-46d6-b98a-99ea1154f9ea', 'autonome-quarterly',   'Cycle Autonome',   NULL,   7800, 'EUR', 'quarterly', '{}'::jsonb, true, 'cycle', 1, 'Apprenez à votre rythme.',            '{}'::jsonb, 'paid', NULL),
  ('4f6faaa8-43a0-46d6-b98a-99ea1154f9ea', 'autonome-yearly',      'Cycle Autonome',   NULL,  27800, 'EUR', 'yearly',    '{}'::jsonb, true, 'cycle', 1, 'Apprenez à votre rythme.',            '{}'::jsonb, 'paid', NULL),
  ('4f6faaa8-43a0-46d6-b98a-99ea1154f9ea', 'academique-monthly',   'Cycle Académique', NULL,   7900, 'EUR', 'monthly',   '{}'::jsonb, true, 'cycle', 2, 'Vous n''apprenez plus seul.',         '{}'::jsonb, 'paid', NULL),
  ('4f6faaa8-43a0-46d6-b98a-99ea1154f9ea', 'academique-quarterly', 'Cycle Académique', NULL,  21300, 'EUR', 'quarterly', '{}'::jsonb, true, 'cycle', 2, 'Vous n''apprenez plus seul.',         '{}'::jsonb, 'paid', NULL),
  ('4f6faaa8-43a0-46d6-b98a-99ea1154f9ea', 'academique-yearly',    'Cycle Académique', NULL,  75800, 'EUR', 'yearly',    '{}'::jsonb, true, 'cycle', 2, 'Vous n''apprenez plus seul.',         '{}'::jsonb, 'paid', NULL),
  ('4f6faaa8-43a0-46d6-b98a-99ea1154f9ea', 'prive-monthly',        'Cycle Privé',      NULL,  19900, 'EUR', 'monthly',   '{}'::jsonb, true, 'cycle', 3, 'Une guidance directe et personnelle.','{}'::jsonb, 'paid', NULL),
  ('4f6faaa8-43a0-46d6-b98a-99ea1154f9ea', 'prive-quarterly',      'Cycle Privé',      NULL,  53700, 'EUR', 'quarterly', '{}'::jsonb, true, 'cycle', 3, 'Une guidance directe et personnelle.','{}'::jsonb, 'paid', NULL),
  ('4f6faaa8-43a0-46d6-b98a-99ea1154f9ea', 'prive-yearly',         'Cycle Privé',      NULL, 191000, 'EUR', 'yearly',    '{}'::jsonb, true, 'cycle', 3, 'Une guidance directe et personnelle.','{}'::jsonb, 'paid', NULL),
  ('4f6faaa8-43a0-46d6-b98a-99ea1154f9ea', 'privilegie-monthly',   'Cycle Privilégié', NULL,  39000, 'EUR', 'monthly',   '{}'::jsonb, true, 'cycle', 4, 'Ne plus recevoir. Transmettre.',      '{}'::jsonb, 'paid', NULL),
  ('4f6faaa8-43a0-46d6-b98a-99ea1154f9ea', 'privilegie-quarterly', 'Cycle Privilégié', NULL, 105300, 'EUR', 'quarterly', '{}'::jsonb, true, 'cycle', 4, 'Ne plus recevoir. Transmettre.',      '{}'::jsonb, 'paid', NULL),
  ('4f6faaa8-43a0-46d6-b98a-99ea1154f9ea', 'privilegie-yearly',    'Cycle Privilégié', NULL, 374400, 'EUR', 'yearly',    '{}'::jsonb, true, 'cycle', 4, 'Ne plus recevoir. Transmettre.',      '{}'::jsonb, 'paid', NULL)
ON CONFLICT (key) DO NOTHING;
