-- ═════════════════════════════════════════════════════════════════════════════
-- PLAFONDS DE PLAN — palier École (nombre d'élèves).
--
-- Grille fondateur (validée) : plus le palier est élevé, plus le plafond d'élèves
-- l'est. `capBreached` lit `features.students` (clé PLATE dans features). L'application
-- est OPT-IN par tenant (`metadata.billing.enforce_caps`) → défaut OFF = grandfather :
-- ces plafonds ne bloquent QUE les nouveaux tenants achetés (enforce_caps=true), jamais
-- un client existant. Point d'application déjà branché : inscription élève
-- (offering-checkout.service.ts → assertWithinCap('students', count tenant_memberships)).
--
-- MedOS (patients) & Mbolo (catalogue) : caps NON définis ici — ils seront posés EN MÊME
-- TEMPS que le branchement de leur point de création (createPatient/createProduct), pour
-- ne jamais donner un faux sentiment d'enforcement. Appliqué hors-bande via psql.
-- ═════════════════════════════════════════════════════════════════════════════

update public.billing_plans set features = coalesce(features, '{}'::jsonb) || jsonb_build_object('students', 50)
  where key = 'cimolace-ecole-petite-local';
update public.billing_plans set features = coalesce(features, '{}'::jsonb) || jsonb_build_object('students', 100)
  where key = 'cimolace-ecole-starter';
update public.billing_plans set features = coalesce(features, '{}'::jsonb) || jsonb_build_object('students', 400)
  where key = 'cimolace-ecole-pro';
update public.billing_plans set features = coalesce(features, '{}'::jsonb) || jsonb_build_object('students', 1000)
  where key = 'cimolace-ecole-business';

-- Contrôle
select key, features->'students' as students_cap
from public.billing_plans where key like 'cimolace-ecole-%' order by key;
