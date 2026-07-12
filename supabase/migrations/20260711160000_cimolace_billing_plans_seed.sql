-- 20260711160000_cimolace_billing_plans_seed.sql
-- Seed du CATALOGUE tarifaire Cimolace (tenant `cimolace`) = grille VITRINE par infrastructure
-- (source vérité apps/public-site/src/app/pricing/page.tsx). Décision fondateur 2026-07-11.
-- ⚠️ stripe_price_id = NULL : les prix ne sont PAS « achetables » via Stripe tant que le fondateur
-- n'a pas créé les prix dans son compte Stripe (action financière) puis rempli stripe_price_id.
-- Data-driven : comble le trou audit « prix Cimolace pas en DB ». Idempotent (ON CONFLICT (key)).

INSERT INTO public.billing_plans
  (tenant_id, key, label, description, price_cents, currency, billing_cycle, category, tagline, sort_order, is_active, stripe_price_id, metadata)
VALUES
  -- École
  ((SELECT id FROM tenants WHERE slug='cimolace'), 'cimolace-ecole-starter',  'École — Starter',  'Lives + cours + SmartBoard IA, 50 étudiants, 1 live/mois, replay 7 jours.', 7900,  'EUR', 'monthly', 'cimolace-ecole', 'Formateur solo', 11, true, NULL, '{}'::jsonb),
  ((SELECT id FROM tenants WHERE slug='cimolace'), 'cimolace-ecole-pro',      'École — Pro',      'Lives illimités, replay permanent, 500 étudiants, support prioritaire.',    19900, 'EUR', 'monthly', 'cimolace-ecole', 'École établie',  12, true, NULL, '{"popular": true}'::jsonb),
  ((SELECT id FROM tenants WHERE slug='cimolace'), 'cimolace-ecole-business', 'École — Business', 'White Label, Neuro Recall IA, 2 000 étudiants, API, account manager.',      34900, 'EUR', 'monthly', 'cimolace-ecole', 'Institut',       13, true, NULL, '{}'::jsonb),
  -- MedOS
  ((SELECT id FROM tenants WHERE slug='cimolace'), 'cimolace-medos-sprout', 'MedOS — Sprout', 'Dossiers patients, 3 patients, 1 formulaire, support email.',                     0,    'EUR', 'monthly', 'cimolace-medos', 'Pour démarrer',   21, true, NULL, '{}'::jsonb),
  ((SELECT id FROM tenants WHERE slug='cimolace'), 'cimolace-medos-solo',   'MedOS — Solo',   'Notes SOAP + IA, ordonnances PDF, 50 patients, 20 consultations IA/mois.',        2500, 'EUR', 'monthly', 'cimolace-medos', 'Praticien solo',  22, true, NULL, '{"popular": true}'::jsonb),
  ((SELECT id FROM tenants WHERE slug='cimolace'), 'cimolace-medos-pro',    'MedOS — Pro',    'Téléconsultation HD, programmes de soins, journal santé, 200 patients.',          4900, 'EUR', 'monthly', 'cimolace-medos', 'Cabinet établi',  23, true, NULL, '{}'::jsonb),
  ((SELECT id FROM tenants WHERE slug='cimolace'), 'cimolace-medos-clinic', 'MedOS — Clinic', 'Patients illimités, White Label, multi-praticiens, API, account manager.',       9900, 'EUR', 'monthly', 'cimolace-medos', 'Clinique / groupe', 24, true, NULL, '{}'::jsonb),
  -- Bien-être
  ((SELECT id FROM tenants WHERE slug='cimolace'), 'cimolace-bienetre-starter', 'Bien-être — Starter', 'Programmes de soins, formulaires, journal de suivi, 20 clients.',            2900, 'EUR', 'monthly', 'cimolace-bienetre', 'Coach débutant', 31, true, NULL, '{}'::jsonb),
  ((SELECT id FROM tenants WHERE slug='cimolace'), 'cimolace-bienetre-pro',     'Bien-être — Pro',     'Téléconsultation HD, automatisations email/SMS, paiements, 100 clients.',    7900, 'EUR', 'monthly', 'cimolace-bienetre', 'Coach pro',      32, true, NULL, '{"popular": true}'::jsonb),
  -- Créateur
  ((SELECT id FROM tenants WHERE slug='cimolace'), 'cimolace-createur-starter',  'Créateur — Starter',  'Studio live, monétisation directe, 100 abonnés, VOD 30 jours, chat.',       4900,  'EUR', 'monthly', 'cimolace-createur', 'Créateur émergent', 41, true, NULL, '{}'::jsonb),
  ((SELECT id FROM tenants WHERE slug='cimolace'), 'cimolace-createur-pro',      'Créateur — Pro',      'VOD illimitée, abonnés illimités, API personnalisée, support prioritaire.', 14900, 'EUR', 'monthly', 'cimolace-createur', 'Créateur pro',      42, true, NULL, '{"popular": true}'::jsonb),
  ((SELECT id FROM tenants WHERE slug='cimolace'), 'cimolace-createur-business', 'Créateur — Business', 'White Label, multi-créateurs, régie pub intégrée, account manager.',        29900, 'EUR', 'monthly', 'cimolace-createur', 'Studio / réseau',   43, true, NULL, '{}'::jsonb)
ON CONFLICT (key) DO NOTHING;
