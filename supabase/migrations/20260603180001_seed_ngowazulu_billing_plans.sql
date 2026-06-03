-- Seed des offres mentorat Ngowazulu dans billing_plans.
-- Aligné sur apps/app/src/config/ngowazuluMentoratOffers.js et sur le montant
-- serveur dans apps/api/src/checkout/offering-checkout.service.ts.
--
-- ⚠️ `supabase db push` est cassé sur ce projet → appliquer à la main dans le
--    SQL Editor du dashboard Supabase.
--
-- NB : la consultation (ngowazulu-consultation-90min) est un paiement ponctuel,
--      pas un abonnement ; billing_plans.interval_type n'accepte que
--      monthly/quarterly/yearly → la consultation est gérée comme dépôt one-off
--      (montant fourni), pas comme plan ici.

INSERT INTO public.billing_plans (slug, name, interval_type, price_amount, price_currency, active, meta)
VALUES
  ('ngowazulu-mentorat-1x-month',      'Mentorat Essentiel', 'monthly', 55.00,  'EUR', true,
   '{"pole":"ngowazulu","commercial_name":"Essentiel","sessions_per_month":1,"frequency":"1 rencontre / mois"}'::jsonb),
  ('ngowazulu-mentorat-1x-week',       'Mentorat Confort',   'monthly', 180.00, 'EUR', true,
   '{"pole":"ngowazulu","commercial_name":"Confort","sessions_per_month":4,"frequency":"1 rencontre / semaine"}'::jsonb),
  ('ngowazulu-mentorat-2x-week',       'Mentorat Intensif',  'monthly', 300.00, 'EUR', true,
   '{"pole":"ngowazulu","commercial_name":"Intensif","sessions_per_month":8,"frequency":"2 rencontres / semaine"}'::jsonb),
  ('ngowazulu-mentorat-urgent-3x-week','Mentorat Souverain', 'monthly', 500.00, 'EUR', true,
   '{"pole":"ngowazulu","commercial_name":"Souverain","sessions_per_month":12,"frequency":"jusqu''à 3 rencontres / semaine"}'::jsonb)
ON CONFLICT (slug) DO UPDATE SET
  name          = EXCLUDED.name,
  interval_type = EXCLUDED.interval_type,
  price_amount  = EXCLUDED.price_amount,
  price_currency= EXCLUDED.price_currency,
  active        = true,
  meta          = EXCLUDED.meta,
  updated_at    = now();
