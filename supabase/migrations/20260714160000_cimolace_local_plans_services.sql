-- 20260714160000_cimolace_local_plans_services.sql
-- Correctif revue #17 : les 5 plans LOCAUX avaient features.services vide → un achat
-- local provisionnait 0 moteur (tenant vide). On ajoute les moteurs du palier d'ENTRÉE
-- correspondant (les PLAFONDS déjà dans features limitent l'usage, pas le jeu de moteurs).
-- Merge jsonb || → préserve les caps (seats/patients/…) + white_label/custom_domain.
-- Idempotent. is_active reste inchangé (dormant tant que le front/mobile-money n'est pas prêt).
DO $$
DECLARE cid uuid := '16ec05e1-f0e1-45fc-96d9-3a49ac84eed8';
BEGIN
  UPDATE billing_plans SET features = coalesce(features,'{}'::jsonb) || jsonb_build_object('services',
    '["med_ehr","med_notes","med_prescriptions","med_forms","med_charting","calendar","notif_engine"]'::jsonb)
    WHERE tenant_id=cid AND key='cimolace-medos-solo-local';

  UPDATE billing_plans SET features = coalesce(features,'{}'::jsonb) || jsonb_build_object('services',
    '["liri_brain","forum","chat_engine","calendar","notif_engine","email_engine","activity_stream","liri_live","course_builder","marketing_creator"]'::jsonb)
    WHERE tenant_id=cid AND key='cimolace-ecole-petite-local';

  UPDATE billing_plans SET features = coalesce(features,'{}'::jsonb) || jsonb_build_object('services',
    '["liri_live","studio_creator","liri_replay","liri_brain","chat_engine","calendar","notif_engine","activity_stream"]'::jsonb)
    WHERE tenant_id=cid AND key='cimolace-createur-tremplin-local';

  UPDATE billing_plans SET features = coalesce(features,'{}'::jsonb) || jsonb_build_object('services',
    '["med_programs","med_health","med_forms","calendar","notif_engine"]'::jsonb)
    WHERE tenant_id=cid AND key='cimolace-bienetre-coach-local';

  UPDATE billing_plans SET features = coalesce(features,'{}'::jsonb) || jsonb_build_object('services',
    '["pay_engine","cinetpay","sms_engine","whatsapp_engine","notif_engine"]'::jsonb)
    WHERE tenant_id=cid AND key='cimolace-mbolo-marche-local';
END $$;
