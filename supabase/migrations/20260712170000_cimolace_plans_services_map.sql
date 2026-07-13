-- 20260712170000_cimolace_plans_services_map.sql
-- Loop 3-offres, gap #1 : mapper les 12 plans VNP cimolace-* à leurs MOTEURS (billing_plans.features.services).
-- Sans ça, resolvePlanServices()=[] (features.services vide + plans absents de PLAN_SERVICE_MAP) → un paiement
-- abouti activerait 0 produit. Clés = apps/api/src/billing/plan-services.ts (LIRI_*/MEDOS_ENGINES). Cumulatif par palier.
-- Data pure, déterministe. Idempotent (écrase features.services). Tenant cimolace = 16ec05e1-f0e1-45fc-96d9-3a49ac84eed8.

DO $$
DECLARE cid uuid := '16ec05e1-f0e1-45fc-96d9-3a49ac84eed8';
BEGIN
  -- ÉCOLE (LIRI school, tiers cumulatifs = LIRI_STARTER/PRO/BUSINESS)
  UPDATE billing_plans SET features = coalesce(features,'{}'::jsonb) || jsonb_build_object('services',
    '["liri_brain","forum","chat_engine","calendar","notif_engine","email_engine","activity_stream","liri_live","course_builder","marketing_creator"]'::jsonb)
    WHERE tenant_id=cid AND key='cimolace-ecole-starter';
  UPDATE billing_plans SET features = coalesce(features,'{}'::jsonb) || jsonb_build_object('services',
    '["liri_brain","forum","chat_engine","calendar","notif_engine","email_engine","activity_stream","liri_live","course_builder","marketing_creator","liri_smartboard","liri_replay","liri_masterclass","studio_creator"]'::jsonb)
    WHERE tenant_id=cid AND key='cimolace-ecole-pro';
  UPDATE billing_plans SET features = coalesce(features,'{}'::jsonb) || jsonb_build_object('services',
    '["liri_brain","forum","chat_engine","calendar","notif_engine","email_engine","activity_stream","liri_live","course_builder","marketing_creator","liri_smartboard","liri_replay","liri_masterclass","studio_creator","liri_neuro_recall","workflow_engine","webhook_engine","stripe_connect","template_engine"]'::jsonb)
    WHERE tenant_id=cid AND key='cimolace-ecole-business';

  -- MEDOS (MEDOS_ENGINES ; téléconsult = liri_live à partir de Pro)
  UPDATE billing_plans SET features = coalesce(features,'{}'::jsonb) || jsonb_build_object('services',
    '["med_ehr","med_forms","calendar","notif_engine"]'::jsonb)
    WHERE tenant_id=cid AND key='cimolace-medos-sprout';
  UPDATE billing_plans SET features = coalesce(features,'{}'::jsonb) || jsonb_build_object('services',
    '["med_ehr","med_notes","med_prescriptions","med_forms","med_charting","calendar","notif_engine"]'::jsonb)
    WHERE tenant_id=cid AND key='cimolace-medos-solo';
  UPDATE billing_plans SET features = coalesce(features,'{}'::jsonb) || jsonb_build_object('services',
    '["med_ehr","med_notes","med_prescriptions","med_forms","med_charting","med_programs","med_health","liri_live","gdpr_engine","calendar","notif_engine"]'::jsonb)
    WHERE tenant_id=cid AND key='cimolace-medos-pro';
  UPDATE billing_plans SET features = coalesce(features,'{}'::jsonb) || jsonb_build_object('services',
    '["med_ehr","med_notes","med_prescriptions","med_forms","med_health","med_programs","med_charting","gdpr_engine","calendar","notif_engine","liri_live","webhook_engine","stripe_connect"]'::jsonb)
    WHERE tenant_id=cid AND key='cimolace-medos-clinic';

  -- BIEN-ÊTRE (coaching : programmes de soins + téléconsult + automatisations)
  UPDATE billing_plans SET features = coalesce(features,'{}'::jsonb) || jsonb_build_object('services',
    '["med_programs","med_health","med_forms","calendar","notif_engine"]'::jsonb)
    WHERE tenant_id=cid AND key='cimolace-bienetre-starter';
  UPDATE billing_plans SET features = coalesce(features,'{}'::jsonb) || jsonb_build_object('services',
    '["med_programs","med_health","med_forms","med_notes","liri_live","calendar","notif_engine","email_engine","stripe_connect","workflow_engine"]'::jsonb)
    WHERE tenant_id=cid AND key='cimolace-bienetre-pro';

  -- CRÉATEUR (studio live LIRI : live + VOD + monétisation)
  UPDATE billing_plans SET features = coalesce(features,'{}'::jsonb) || jsonb_build_object('services',
    '["liri_live","studio_creator","liri_replay","liri_brain","chat_engine","calendar","notif_engine","activity_stream"]'::jsonb)
    WHERE tenant_id=cid AND key='cimolace-createur-starter';
  UPDATE billing_plans SET features = coalesce(features,'{}'::jsonb) || jsonb_build_object('services',
    '["liri_live","studio_creator","liri_replay","liri_brain","chat_engine","calendar","notif_engine","activity_stream","liri_smartboard","marketing_creator","webhook_engine"]'::jsonb)
    WHERE tenant_id=cid AND key='cimolace-createur-pro';
  UPDATE billing_plans SET features = coalesce(features,'{}'::jsonb) || jsonb_build_object('services',
    '["liri_live","studio_creator","liri_replay","liri_brain","chat_engine","calendar","notif_engine","activity_stream","liri_smartboard","marketing_creator","webhook_engine","liri_neuro_recall","stripe_connect","template_engine","workflow_engine"]'::jsonb)
    WHERE tenant_id=cid AND key='cimolace-createur-business';
END $$;
