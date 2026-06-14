-- ============================================================================
-- Migration: provisioning LIRI — plans add-ons + backfill tenant_services + grandfather
-- Date: 2026-06-14
--
-- ⚠️ À NE PAS APPLIQUER SANS VALIDATION. Cette migration accompagne le code de
--    provisioning (billing.service.provisionPlanServices + manifeste
--    plan-services.ts) et le GATE DUR du portail LIRI (ProtectedLiriRoute sur
--    /studio et /liri).
--
-- ⚠️ ORDRE DE DÉPLOIEMENT : appliquer CETTE migration AVANT (ou avec) le déploiement
--    du gate front. Sinon ISNA et les tenants déjà payants — qui n'ont pas encore de
--    lignes tenant_services — seraient verrouillés hors du portail (faux négatif).
--
-- Modèle commercial (décision 2026-06-14) : PACKS (starter/pro/business, medos,
-- zahir-forfait) + ADD-ONS à la carte (addon_liri_live = cœur « concurrent Zoom »,
-- addon_liri_brain, addon_mbolo, addon_medos).
--
-- Ce que fait la migration :
--   1) Ajoute les plans ADD-ONS dans billing_plans (achetables en marketplace).
--   2) Seede features.services sur les packs au format objet (starter/pro/business).
--   3) BACKFILL tenant_services pour TOUS les abonnements actifs (applique le mapping
--      rétroactivement → aucun payeur existant verrouillé par le gate dur).
--   4) GRANDFATHER ISNA (1er tenant LIRI, référencé par slug='isna' = donnée) : active
--      ses moteurs LIRI → il passe le gate sans hardcoder ISNA dans le code.
--
-- Le gate front autorise si (moteur LIRI actif) OU (abonnement actif). Activer les
-- tenant_services suffit donc à grandfather/backfill sans toucher billing_subscriptions.
-- ============================================================================

BEGIN;

-- Mapping plan → moteurs, miroir de apps/api/src/billing/plan-services.ts
-- (duplication assumée : SQL one-off pour le backfill ≠ logique runtime TS).
CREATE TEMP TABLE _plan_svc (key text PRIMARY KEY, svcs jsonb) ON COMMIT DROP;
INSERT INTO _plan_svc (key, svcs) VALUES
  ('starter',        '["liri_brain","forum","chat_engine","calendar","notif_engine","email_engine","activity_stream","liri_live","course_builder","marketing_creator"]'::jsonb),
  ('pro',            '["liri_brain","forum","chat_engine","calendar","notif_engine","email_engine","activity_stream","liri_live","course_builder","marketing_creator","liri_smartboard","liri_replay","liri_masterclass","studio_creator"]'::jsonb),
  ('business',       '["liri_brain","forum","chat_engine","calendar","notif_engine","email_engine","activity_stream","liri_live","course_builder","marketing_creator","liri_smartboard","liri_replay","liri_masterclass","studio_creator","liri_neuro_recall","workflow_engine","webhook_engine","stripe_connect","template_engine"]'::jsonb),
  ('medos_standard', '["med_ehr","med_notes","med_prescriptions","med_forms","med_health","med_programs","med_charting","gdpr_engine","calendar","notif_engine"]'::jsonb),
  ('zahir-forfait',  '["med_ehr","med_notes","med_prescriptions","med_forms","med_health","med_programs","med_charting","gdpr_engine","calendar","notif_engine","pay_engine","cinetpay","sms_engine","whatsapp_engine","liri_live","liri_brain"]'::jsonb),
  ('addon_liri_live','["liri_live","liri_replay","studio_creator","liri_brain","forum","chat_engine","calendar","notif_engine","email_engine","activity_stream"]'::jsonb),
  ('addon_liri_brain','["liri_brain","liri_masterclass","liri_smartboard","liri_neuro_recall"]'::jsonb),
  ('addon_mbolo',    '["pay_engine","cinetpay","sms_engine","whatsapp_engine","notif_engine"]'::jsonb),
  ('addon_medos',    '["med_ehr","med_notes","med_prescriptions","med_forms","med_health","med_programs","med_charting","gdpr_engine","calendar","notif_engine"]'::jsonb);

-- ── 1) Plans ADD-ONS à la carte (achetables) ────────────────────────────────
INSERT INTO billing_plans (key, label, description, price_cents, currency, billing_cycle, features, is_active) VALUES
  ('addon_liri_live',  'LIRI Live',      'Lives + replay + studio + IA (visioconférence type Zoom)', 2900, 'EUR', 'monthly',
    jsonb_build_object('addon', true, 'services', (SELECT svcs FROM _plan_svc WHERE key='addon_liri_live')), true),
  ('addon_liri_brain', 'LIRI Brain',     'IA conversationnelle + masterclass + smartboard + neuro-recall', 1900, 'EUR', 'monthly',
    jsonb_build_object('addon', true, 'services', (SELECT svcs FROM _plan_svc WHERE key='addon_liri_brain')), true),
  ('addon_mbolo',      'Mbolo Boutique', 'Paiement + mobile money + SMS/WhatsApp', 1900, 'EUR', 'monthly',
    jsonb_build_object('addon', true, 'services', (SELECT svcs FROM _plan_svc WHERE key='addon_mbolo')), true),
  ('addon_medos',      'MEDOS',          'Dossiers patients + notes SOAP + ordonnances + RGPD', 3500, 'EUR', 'monthly',
    jsonb_build_object('addon', true, 'services', (SELECT svcs FROM _plan_svc WHERE key='addon_medos')), true)
ON CONFLICT (key) DO UPDATE SET
  label = EXCLUDED.label, description = EXCLUDED.description, price_cents = EXCLUDED.price_cents,
  currency = EXCLUDED.currency, billing_cycle = EXCLUDED.billing_cycle,
  features = EXCLUDED.features, is_active = EXCLUDED.is_active;

-- ── 2) Seeder features.services sur les packs au format OBJET (merge non destructif) ──
-- (medos_standard=tableau / zahir-forfait=booléens : laissés tels quels — le code TS
--  PLAN_SERVICE_MAP les couvre en repli, et le backfill ci-dessous via _plan_svc aussi.)
UPDATE billing_plans bp
   SET features = coalesce(bp.features, '{}'::jsonb) || jsonb_build_object('services', ps.svcs)
  FROM _plan_svc ps
 WHERE bp.key = ps.key
   AND bp.key IN ('starter','pro','business')
   AND jsonb_typeof(bp.features) = 'object';

-- ── 3) BACKFILL : activer les moteurs des abonnements ACTIFS existants ───────
INSERT INTO tenant_services (tenant_id, service_key, active)
SELECT DISTINCT bs.tenant_id, svc.service_key, true
  FROM billing_subscriptions bs
  JOIN _plan_svc ps ON ps.key = bs.plan_id
  CROSS JOIN LATERAL jsonb_array_elements_text(ps.svcs) AS svc(service_key)
 WHERE bs.status = 'active'
ON CONFLICT (tenant_id, service_key) DO UPDATE SET active = true;

-- ── 4) GRANDFATHER ISNA (1er tenant LIRI ; slug='isna' = donnée, pas du code) ─
INSERT INTO tenant_services (tenant_id, service_key, active)
SELECT t.id, svc.service_key, true
  FROM tenants t
  CROSS JOIN LATERAL jsonb_array_elements_text((SELECT svcs FROM _plan_svc WHERE key='business')) AS svc(service_key)
 WHERE lower(t.slug) = 'isna'
ON CONFLICT (tenant_id, service_key) DO UPDATE SET active = true;

COMMIT;
