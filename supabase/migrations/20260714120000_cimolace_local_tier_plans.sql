-- 20260714120000_cimolace_local_tier_plans.sql
-- Tarification 3 offres — ÉTAGE LOCAL (voie B « double étage »). Fondation DORMANTE.
-- Ajoute la colonne offer_tier (taxonomie hosted/customized/integration, backfill 'hosted')
-- + 5 plans locaux (1/produit, hébergé-only, is_active=false, sans stripe_price_id → rien
-- ne peut débiter, invisible côté public). Tenant cimolace = 16ec05e1 (comme les 12 vitrine).
-- Idempotent (ADD COLUMN IF NOT EXISTS + ON CONFLICT (key) DO NOTHING). Réversible.
-- Décisions fondateur : Bien-être = is_active=false (4 SKU d'abord) ; Créateur = 49€/an + 5%.
-- ⚠️ XAF/XOF = zéro-décimale (price_xaf déjà en unités, PAS ×100). metadata jamais null.

-- 1) Colonne offer_tier (additif, non-bloquant : DEFAULT + backfill implicite sur l'existant)
ALTER TABLE public.billing_plans
  ADD COLUMN IF NOT EXISTS offer_tier text NOT NULL DEFAULT 'hosted';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'billing_plans_offer_tier_chk') THEN
    ALTER TABLE public.billing_plans
      ADD CONSTRAINT billing_plans_offer_tier_chk
      CHECK (offer_tier IN ('hosted', 'customized', 'integration'));
  END IF;
END $$;

-- 2) Les 5 plans locaux (tenant cimolace, offer_tier hosted, dormants)
INSERT INTO public.billing_plans
  (key, label, description, price_cents, currency, billing_cycle, features,
   stripe_price_id, is_active, tenant_id, category, sort_order, tagline, metadata,
   access_model, offer_tier)
VALUES
  ('cimolace-medos-solo-local',
   $l$MedOS Solo — Local$l$,
   $d$Téléconsultation + dossier pour un praticien solo, hébergé sous la marque Cimolace, paiement annuel mobile money. Plafonds : 1 praticien, 200 patients, 50 téléconsultations/mois.$d$,
   8900, 'EUR', 'yearly',
   '{"seats":1,"patients":200,"teleconsults_month":50,"ia_calls_month":200,"white_label":false,"custom_domain":false}'::jsonb,
   NULL, false, '16ec05e1-f0e1-45fc-96d9-3a49ac84eed8', 'cimolace-medos', 90,
   $t$Cabinet solo, à l'année$t$,
   '{"segment":"local","price_xaf":58000,"price_ngn":150000}'::jsonb,
   'paid', 'hosted'),

  ('cimolace-ecole-petite-local',
   $l$LIRI École Petite École — Local$l$,
   $d$LMS + live + IA pour une petite école, hébergé, à l'année ou en 3 termes. Plafonds : 80 élèves, 2 enseignants, 8h live/mois.$d$,
   17900, 'EUR', 'yearly',
   '{"seats":2,"students":80,"live_hours_month":8,"white_label":false,"custom_domain":false}'::jsonb,
   NULL, false, '16ec05e1-f0e1-45fc-96d9-3a49ac84eed8', 'cimolace-ecole', 91,
   $t$Petite école, annuel ou 3 termes$t$,
   '{"segment":"local","price_xaf":117000,"price_ngn":300000,"term_billing":true,"term_price_cents":6500,"terms":3}'::jsonb,
   'paid', 'hosted'),

  ('cimolace-createur-tremplin-local',
   $l$Créateur Tremplin — Local$l$,
   $d$Studio live + VOD, plancher 49€/an + 5% de commission sur contenus payants (frais mobile money en passthrough). Plafonds : 10 Go VOD, 5h live/mois.$d$,
   4900, 'EUR', 'yearly',
   '{"seats":1,"vod_gb":10,"live_hours_month":5,"white_label":false,"custom_domain":false}'::jsonb,
   NULL, false, '16ec05e1-f0e1-45fc-96d9-3a49ac84eed8', 'cimolace-createur', 92,
   $t$49€/an + 5% de commission$t$,
   '{"segment":"local","commission_bps":500,"passthrough_mm":true}'::jsonb,
   'paid', 'hosted'),

  ('cimolace-mbolo-marche-local',
   $l$mbolo Marché — Local$l$,
   $d$Boutique mbolo hébergée sous la marque Cimolace, 0€ + 5% de commission sur ventes (frais mobile money en passthrough). Plafond : 50 produits.$d$,
   0, 'EUR', 'yearly',
   '{"seats":1,"catalog_size":50,"white_label":false,"custom_domain":false}'::jsonb,
   NULL, false, '16ec05e1-f0e1-45fc-96d9-3a49ac84eed8', 'cimolace-mbolo', 93,
   $t$0€ + 5% de commission$t$,
   '{"segment":"local","commission_bps":500,"passthrough_mm":true}'::jsonb,
   'free', 'hosted'),

  ('cimolace-bienetre-coach-local',
   $l$Bien-être Coach Solo — Local$l$,
   $d$Coaching pour un praticien solo, hébergé, paiement annuel. Plafonds : 30 clients. Gardé dormant au lancement (décision : 4 SKU d'abord).$d$,
   5900, 'EUR', 'yearly',
   '{"seats":1,"clients":30,"white_label":false,"custom_domain":false}'::jsonb,
   NULL, false, '16ec05e1-f0e1-45fc-96d9-3a49ac84eed8', 'cimolace-bienetre', 94,
   $t$Coach solo, à l'année$t$,
   '{"segment":"local","price_xaf":39000,"price_ngn":100000,"launch":"held"}'::jsonb,
   'paid', 'hosted')
ON CONFLICT (key) DO NOTHING;
