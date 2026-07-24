-- ═════════════════════════════════════════════════════════════════════════════
-- PLAFONDS DE PLAN — MedOS (patients) & Mbolo (catalogue).
--
-- L'enforcement est DÉJÀ branché et déployé :
--   • MedOS  : medos.service.ts:264 → assertWithinCap('patients', count med_patients hors archived/deceased)
--   • Mbolo  : mbolo.service.ts:228  → assertWithinCap('catalog_size', count mbolo_products actifs)
-- Il ne manquait que les CHIFFRES. Comme pour École, application OPT-IN par tenant
-- (metadata.billing.enforce_caps ; défaut OFF = grandfather → aucun client existant
-- bloqué, ex. zahirwellness). Clés PLATES dans features (features.patients / features.catalog_size).
-- Aucun déploiement requis (code d'enforcement déjà live). Appliqué hors-bande via psql.
-- ═════════════════════════════════════════════════════════════════════════════

-- MedOS — patients par palier (Clinic = illimité → pas de cap)
update public.billing_plans set features = coalesce(features,'{}'::jsonb) || jsonb_build_object('patients', 10)
  where key = 'cimolace-medos-sprout';
update public.billing_plans set features = coalesce(features,'{}'::jsonb) || jsonb_build_object('patients', 50)
  where key in ('cimolace-medos-solo', 'cimolace-medos-solo-local');
update public.billing_plans set features = coalesce(features,'{}'::jsonb) || jsonb_build_object('patients', 300)
  where key = 'cimolace-medos-pro';

-- Mbolo — taille du catalogue (produits actifs)
update public.billing_plans set features = coalesce(features,'{}'::jsonb) || jsonb_build_object('catalog_size', 50)
  where key = 'cimolace-mbolo-marche-local';

-- Contrôle
select key, features->'patients' as patients_cap, features->'catalog_size' as catalog_cap
from public.billing_plans
where key like 'cimolace-medos-%' or key like 'cimolace-mbolo-%'
order by key;
