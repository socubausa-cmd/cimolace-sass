-- =========================================================================
-- MEDOS v2 - Bio Digital Twin - SEED DEMO (3 patients, profils contrastes)
-- Scores d'organes PRE-CALCULES par le moteur deterministe v1.
-- 100% ASCII (immune aux problemes d'encodage du collage).
-- Tenant zahirwellness (1896be98-0d36-4044-bf37-0f1a26f5c363). IDEMPOTENT : purge puis reinsere.
-- =========================================================================

-- Purge des demos precedents (match par date de naissance = robuste meme si
-- les noms ont ete corrompus a un collage anterieur). Cascade -> donnees liees.
DELETE FROM med_patients
 WHERE tenant_id = '1896be98-0d36-4044-bf37-0f1a26f5c363'
   AND first_name IN ('Amina','Karim','Sophie')
   AND date_of_birth IN ('1979-04-12','1972-09-03','1986-02-21');

DO $$
DECLARE pid uuid;
BEGIN
  INSERT INTO med_patients (tenant_id, patient_user_id, first_name, last_name, gender, date_of_birth, consent_given, status)
    VALUES ('1896be98-0d36-4044-bf37-0f1a26f5c363', gen_random_uuid(), 'Amina', 'Demo-Inflammatoire', 'female', '1979-04-12', true, 'active')
    RETURNING id INTO pid;

  INSERT INTO med_patient_biomarkers (tenant_id, patient_id, biomarker_code, value, unit_raw, flag, source) VALUES
      ('1896be98-0d36-4044-bf37-0f1a26f5c363', pid, 'CRP_HS', 8, 'mg/L', 'critical', 'manual'),
      ('1896be98-0d36-4044-bf37-0f1a26f5c363', pid, 'ESR', 25, 'mm/h', 'critical', 'manual'),
      ('1896be98-0d36-4044-bf37-0f1a26f5c363', pid, 'FERRITIN', 280, 'ng/mL', 'high', 'manual'),
      ('1896be98-0d36-4044-bf37-0f1a26f5c363', pid, 'ANTI_TPO', 60, 'UI/mL', 'critical', 'manual'),
      ('1896be98-0d36-4044-bf37-0f1a26f5c363', pid, 'HOMOCYSTEINE', 14, 'umol/L', 'high', 'manual'),
      ('1896be98-0d36-4044-bf37-0f1a26f5c363', pid, 'URIC_ACID', 6.5, 'mg/dL', 'high', 'manual'),
      ('1896be98-0d36-4044-bf37-0f1a26f5c363', pid, 'FIBRINOGEN', 3.9, 'g/L', 'high', 'manual'),
      ('1896be98-0d36-4044-bf37-0f1a26f5c363', pid, 'VIT_D', 24, 'ng/mL', 'critical', 'manual');

  INSERT INTO med_organ_scores (tenant_id, patient_id, organ_code, score, color, dimensions, contributing_biomarkers, confidence) VALUES
      ('1896be98-0d36-4044-bf37-0f1a26f5c363', pid, 'brain', 58, 'orange', '{"oxidative_stress":88,"cellular_energy":70}'::jsonb, '[{"code":"VIT_D","name_fr":"Vitamine D (25-OH)","value":24,"flag":"critical","penalty":30,"dimension":"cellular_energy"},{"code":"HOMOCYSTEINE","name_fr":"Homocysteine","value":14,"flag":"high","penalty":12,"dimension":"oxidative_stress"}]'::jsonb, 0.5),
      ('1896be98-0d36-4044-bf37-0f1a26f5c363', pid, 'thyroid', 70, 'yellow', '{"inflammation":70}'::jsonb, '[{"code":"ANTI_TPO","name_fr":"Anticorps anti-TPO","value":60,"flag":"critical","penalty":30,"dimension":"inflammation"}]'::jsonb, 0.25),
      ('1896be98-0d36-4044-bf37-0f1a26f5c363', pid, 'heart', 34, 'red', '{"inflammation":46,"oxidative_stress":88}'::jsonb, '[{"code":"CRP_HS","name_fr":"CRP ultrasensible","value":8,"flag":"critical","penalty":30,"dimension":"inflammation"},{"code":"HOMOCYSTEINE","name_fr":"Homocysteine","value":14,"flag":"high","penalty":12,"dimension":"oxidative_stress"},{"code":"URIC_ACID","name_fr":"Acide urique","value":6.5,"flag":"high","penalty":12,"dimension":"inflammation"},{"code":"FIBRINOGEN","name_fr":"Fibrinogene","value":3.9,"flag":"high","penalty":12,"dimension":"inflammation"}]'::jsonb, 1),
      ('1896be98-0d36-4044-bf37-0f1a26f5c363', pid, 'liver', 88, 'green', '{"inflammation":88}'::jsonb, '[{"code":"FERRITIN","name_fr":"Ferritine","value":280,"flag":"high","penalty":12,"dimension":"inflammation"}]'::jsonb, 0.25),
      ('1896be98-0d36-4044-bf37-0f1a26f5c363', pid, 'gut', 70, 'yellow', '{"inflammation":70}'::jsonb, '[{"code":"CRP_HS","name_fr":"CRP ultrasensible","value":8,"flag":"critical","penalty":30,"dimension":"inflammation"}]'::jsonb, 0.25),
      ('1896be98-0d36-4044-bf37-0f1a26f5c363', pid, 'kidneys', 88, 'green', '{"inflammation":88}'::jsonb, '[{"code":"URIC_ACID","name_fr":"Acide urique","value":6.5,"flag":"high","penalty":12,"dimension":"inflammation"}]'::jsonb, 0.25),
      ('1896be98-0d36-4044-bf37-0f1a26f5c363', pid, 'immune', 0, 'red', '{"inflammation":0,"cellular_energy":70}'::jsonb, '[{"code":"CRP_HS","name_fr":"CRP ultrasensible","value":8,"flag":"critical","penalty":30,"dimension":"inflammation"},{"code":"ESR","name_fr":"Vitesse de sedimentation","value":25,"flag":"critical","penalty":30,"dimension":"inflammation"},{"code":"ANTI_TPO","name_fr":"Anticorps anti-TPO","value":60,"flag":"critical","penalty":30,"dimension":"inflammation"},{"code":"VIT_D","name_fr":"Vitamine D (25-OH)","value":24,"flag":"critical","penalty":30,"dimension":"cellular_energy"},{"code":"FERRITIN","name_fr":"Ferritine","value":280,"flag":"high","penalty":12,"dimension":"inflammation"},{"code":"FIBRINOGEN","name_fr":"Fibrinogene","value":3.9,"flag":"high","penalty":12,"dimension":"inflammation"}]'::jsonb, 1);

  INSERT INTO med_alerts (tenant_id, patient_id, kind, severity, message_fr, evidence, status) VALUES
      ('1896be98-0d36-4044-bf37-0f1a26f5c363', pid, 'chronic_inflammation', 'warning', 'Signaux d''inflammation systemique (CRP + ferritine/VS). Rechercher la source inflammatoire.', '[{"code":"CRP_HS","value":8,"flag":"critical"},{"code":"FERRITIN","value":280,"flag":"high"},{"code":"ESR","value":25,"flag":"critical"}]'::jsonb, 'open'),
      ('1896be98-0d36-4044-bf37-0f1a26f5c363', pid, 'deficiency', 'info', 'Carence(s) possible(s) : VIT_D. A correler aux symptomes.', '[{"code":"VIT_D","value":24,"flag":"critical"}]'::jsonb, 'open');

  INSERT INTO med_transformation_wheel (tenant_id, patient_id, domain, score, source) VALUES
      ('1896be98-0d36-4044-bf37-0f1a26f5c363', pid, 'inflammation', 30, 'questionnaire'),
      ('1896be98-0d36-4044-bf37-0f1a26f5c363', pid, 'immunity', 40, 'questionnaire'),
      ('1896be98-0d36-4044-bf37-0f1a26f5c363', pid, 'energy', 45, 'questionnaire'),
      ('1896be98-0d36-4044-bf37-0f1a26f5c363', pid, 'stress', 50, 'questionnaire');

  INSERT INTO med_health_events (tenant_id, patient_id, event_type, title, occurred_at) VALUES
      ('1896be98-0d36-4044-bf37-0f1a26f5c363', pid, 'illness', 'Poussee inflammatoire chronique', '2025-11-10');
END $$;

DO $$
DECLARE pid uuid;
BEGIN
  INSERT INTO med_patients (tenant_id, patient_user_id, first_name, last_name, gender, date_of_birth, consent_given, status)
    VALUES ('1896be98-0d36-4044-bf37-0f1a26f5c363', gen_random_uuid(), 'Karim', 'Demo-Metabolique', 'male', '1972-09-03', true, 'active')
    RETURNING id INTO pid;

  INSERT INTO med_patient_biomarkers (tenant_id, patient_id, biomarker_code, value, unit_raw, flag, source) VALUES
      ('1896be98-0d36-4044-bf37-0f1a26f5c363', pid, 'GLUCOSE', 110, 'mg/dL', 'critical', 'manual'),
      ('1896be98-0d36-4044-bf37-0f1a26f5c363', pid, 'HBA1C', 6, '%', 'critical', 'manual'),
      ('1896be98-0d36-4044-bf37-0f1a26f5c363', pid, 'HOMA_IR', 3.2, 'index', 'critical', 'manual'),
      ('1896be98-0d36-4044-bf37-0f1a26f5c363', pid, 'INSULIN', 18, 'uUI/mL', 'high', 'manual'),
      ('1896be98-0d36-4044-bf37-0f1a26f5c363', pid, 'TRIGLYCERIDES', 180, 'mg/dL', 'critical', 'manual'),
      ('1896be98-0d36-4044-bf37-0f1a26f5c363', pid, 'HDL', 35, 'mg/dL', 'critical', 'manual'),
      ('1896be98-0d36-4044-bf37-0f1a26f5c363', pid, 'LDL', 145, 'mg/dL', 'critical', 'manual'),
      ('1896be98-0d36-4044-bf37-0f1a26f5c363', pid, 'TG_HDL', 5.1, 'ratio', 'critical', 'manual'),
      ('1896be98-0d36-4044-bf37-0f1a26f5c363', pid, 'ALT', 50, 'U/L', 'high', 'manual'),
      ('1896be98-0d36-4044-bf37-0f1a26f5c363', pid, 'GGT', 60, 'U/L', 'high', 'manual');

  INSERT INTO med_organ_scores (tenant_id, patient_id, organ_code, score, color, dimensions, contributing_biomarkers, confidence) VALUES
      ('1896be98-0d36-4044-bf37-0f1a26f5c363', pid, 'heart', 0, 'red', '{"metabolism":0}'::jsonb, '[{"code":"TRIGLYCERIDES","name_fr":"Triglycerides","value":180,"flag":"critical","penalty":30,"dimension":"metabolism"},{"code":"HDL","name_fr":"HDL cholesterol","value":35,"flag":"critical","penalty":30,"dimension":"metabolism"},{"code":"LDL","name_fr":"LDL cholesterol","value":145,"flag":"critical","penalty":30,"dimension":"metabolism"},{"code":"TG_HDL","name_fr":"Ratio TG/HDL","value":5.1,"flag":"critical","penalty":30,"dimension":"metabolism"}]'::jsonb, 1),
      ('1896be98-0d36-4044-bf37-0f1a26f5c363', pid, 'liver', 0, 'red', '{"metabolism":0,"hormones":88,"toxicity":76}'::jsonb, '[{"code":"GLUCOSE","name_fr":"Glycemie a jeun","value":110,"flag":"critical","penalty":30,"dimension":"metabolism"},{"code":"HOMA_IR","name_fr":"HOMA-IR","value":3.2,"flag":"critical","penalty":30,"dimension":"metabolism"},{"code":"TRIGLYCERIDES","name_fr":"Triglycerides","value":180,"flag":"critical","penalty":30,"dimension":"metabolism"},{"code":"HDL","name_fr":"HDL cholesterol","value":35,"flag":"critical","penalty":30,"dimension":"metabolism"},{"code":"LDL","name_fr":"LDL cholesterol","value":145,"flag":"critical","penalty":30,"dimension":"metabolism"},{"code":"TG_HDL","name_fr":"Ratio TG/HDL","value":5.1,"flag":"critical","penalty":30,"dimension":"metabolism"},{"code":"INSULIN","name_fr":"Insuline a jeun","value":18,"flag":"high","penalty":12,"dimension":"hormones"},{"code":"ALT","name_fr":"ALAT (SGPT)","value":50,"flag":"high","penalty":12,"dimension":"toxicity"},{"code":"GGT","name_fr":"Gamma-GT","value":60,"flag":"high","penalty":12,"dimension":"toxicity"}]'::jsonb, 1),
      ('1896be98-0d36-4044-bf37-0f1a26f5c363', pid, 'pancreas', 0, 'red', '{"metabolism":10,"hormones":88}'::jsonb, '[{"code":"GLUCOSE","name_fr":"Glycemie a jeun","value":110,"flag":"critical","penalty":30,"dimension":"metabolism"},{"code":"HBA1C","name_fr":"Hemoglobine glyquee","value":6,"flag":"critical","penalty":30,"dimension":"metabolism"},{"code":"HOMA_IR","name_fr":"HOMA-IR","value":3.2,"flag":"critical","penalty":30,"dimension":"metabolism"},{"code":"INSULIN","name_fr":"Insuline a jeun","value":18,"flag":"high","penalty":12,"dimension":"hormones"}]'::jsonb, 1);

  INSERT INTO med_alerts (tenant_id, patient_id, kind, severity, message_fr, evidence, status) VALUES
      ('1896be98-0d36-4044-bf37-0f1a26f5c363', pid, 'metabolic_syndrome', 'warning', 'Faisceau evocateur d''un syndrome metabolique (resistance insulinique + dyslipidemie). A explorer cliniquement.', '[{"code":"HOMA_IR","value":3.2,"flag":"critical"},{"code":"TRIGLYCERIDES","value":180,"flag":"critical"},{"code":"HDL","value":35,"flag":"critical"},{"code":"HBA1C","value":6,"flag":"critical"}]'::jsonb, 'open'),
      ('1896be98-0d36-4044-bf37-0f1a26f5c363', pid, 'metabolic_risk', 'info', 'Indice de risque metabolique precoce (ratio TG/HDL ou glycemie). Surveillance recommandee.', '[{"code":"TG_HDL","value":5.1,"flag":"critical"},{"code":"GLUCOSE","value":110,"flag":"critical"}]'::jsonb, 'open');

  INSERT INTO med_transformation_wheel (tenant_id, patient_id, domain, score, source) VALUES
      ('1896be98-0d36-4044-bf37-0f1a26f5c363', pid, 'metabolism', 35, 'questionnaire'),
      ('1896be98-0d36-4044-bf37-0f1a26f5c363', pid, 'energy', 40, 'questionnaire'),
      ('1896be98-0d36-4044-bf37-0f1a26f5c363', pid, 'digestion', 55, 'questionnaire'),
      ('1896be98-0d36-4044-bf37-0f1a26f5c363', pid, 'physical_activity', 45, 'questionnaire');

  INSERT INTO med_health_events (tenant_id, patient_id, event_type, title, occurred_at) VALUES
      ('1896be98-0d36-4044-bf37-0f1a26f5c363', pid, 'diet_change', 'Regime hyperglucidique prolonge', '2025-06-01');
END $$;

DO $$
DECLARE pid uuid;
BEGIN
  INSERT INTO med_patients (tenant_id, patient_user_id, first_name, last_name, gender, date_of_birth, consent_given, status)
    VALUES ('1896be98-0d36-4044-bf37-0f1a26f5c363', gen_random_uuid(), 'Sophie', 'Demo-Thyroide', 'female', '1986-02-21', true, 'active')
    RETURNING id INTO pid;

  INSERT INTO med_patient_biomarkers (tenant_id, patient_id, biomarker_code, value, unit_raw, flag, source) VALUES
      ('1896be98-0d36-4044-bf37-0f1a26f5c363', pid, 'TSH', 5.5, 'mUI/L', 'critical', 'manual'),
      ('1896be98-0d36-4044-bf37-0f1a26f5c363', pid, 'FT4', 11, 'pmol/L', 'critical', 'manual'),
      ('1896be98-0d36-4044-bf37-0f1a26f5c363', pid, 'FT3', 3, 'pmol/L', 'critical', 'manual'),
      ('1896be98-0d36-4044-bf37-0f1a26f5c363', pid, 'ANTI_TPO', 80, 'UI/mL', 'critical', 'manual'),
      ('1896be98-0d36-4044-bf37-0f1a26f5c363', pid, 'FERRITIN', 25, 'ng/mL', 'critical', 'manual'),
      ('1896be98-0d36-4044-bf37-0f1a26f5c363', pid, 'VIT_D', 20, 'ng/mL', 'critical', 'manual'),
      ('1896be98-0d36-4044-bf37-0f1a26f5c363', pid, 'B12', 280, 'pg/mL', 'low', 'manual'),
      ('1896be98-0d36-4044-bf37-0f1a26f5c363', pid, 'MAGNESIUM', 1.7, 'mg/dL', 'low', 'manual');

  INSERT INTO med_organ_scores (tenant_id, patient_id, organ_code, score, color, dimensions, contributing_biomarkers, confidence) VALUES
      ('1896be98-0d36-4044-bf37-0f1a26f5c363', pid, 'brain', 16, 'red', '{"hormones":70,"cellular_energy":46}'::jsonb, '[{"code":"TSH","name_fr":"TSH","value":5.5,"flag":"critical","penalty":30,"dimension":"hormones"},{"code":"VIT_D","name_fr":"Vitamine D (25-OH)","value":20,"flag":"critical","penalty":30,"dimension":"cellular_energy"},{"code":"B12","name_fr":"Vitamine B12","value":280,"flag":"low","penalty":12,"dimension":"cellular_energy"},{"code":"MAGNESIUM","name_fr":"Magnesium erythrocytaire","value":1.7,"flag":"low","penalty":12,"dimension":"cellular_energy"}]'::jsonb, 1),
      ('1896be98-0d36-4044-bf37-0f1a26f5c363', pid, 'thyroid', 0, 'red', '{"hormones":10,"inflammation":70}'::jsonb, '[{"code":"TSH","name_fr":"TSH","value":5.5,"flag":"critical","penalty":30,"dimension":"hormones"},{"code":"FT4","name_fr":"T4 libre","value":11,"flag":"critical","penalty":30,"dimension":"hormones"},{"code":"FT3","name_fr":"T3 libre","value":3,"flag":"critical","penalty":30,"dimension":"hormones"},{"code":"ANTI_TPO","name_fr":"Anticorps anti-TPO","value":80,"flag":"critical","penalty":30,"dimension":"inflammation"}]'::jsonb, 1),
      ('1896be98-0d36-4044-bf37-0f1a26f5c363', pid, 'heart', 88, 'green', '{"cellular_energy":88}'::jsonb, '[{"code":"MAGNESIUM","name_fr":"Magnesium erythrocytaire","value":1.7,"flag":"low","penalty":12,"dimension":"cellular_energy"}]'::jsonb, 0.25),
      ('1896be98-0d36-4044-bf37-0f1a26f5c363', pid, 'liver', 70, 'yellow', '{"inflammation":70}'::jsonb, '[{"code":"FERRITIN","name_fr":"Ferritine","value":25,"flag":"critical","penalty":30,"dimension":"inflammation"}]'::jsonb, 0.25),
      ('1896be98-0d36-4044-bf37-0f1a26f5c363', pid, 'immune', 0, 'red', '{"inflammation":40,"cellular_energy":58}'::jsonb, '[{"code":"ANTI_TPO","name_fr":"Anticorps anti-TPO","value":80,"flag":"critical","penalty":30,"dimension":"inflammation"},{"code":"FERRITIN","name_fr":"Ferritine","value":25,"flag":"critical","penalty":30,"dimension":"inflammation"},{"code":"VIT_D","name_fr":"Vitamine D (25-OH)","value":20,"flag":"critical","penalty":30,"dimension":"cellular_energy"},{"code":"B12","name_fr":"Vitamine B12","value":280,"flag":"low","penalty":12,"dimension":"cellular_energy"}]'::jsonb, 1);

  INSERT INTO med_alerts (tenant_id, patient_id, kind, severity, message_fr, evidence, status) VALUES
      ('1896be98-0d36-4044-bf37-0f1a26f5c363', pid, 'deficiency', 'warning', 'Carence(s) possible(s) : VIT_D, B12, FERRITIN, MAGNESIUM. A correler aux symptomes.', '[{"code":"VIT_D","value":20,"flag":"critical"},{"code":"B12","value":280,"flag":"low"},{"code":"FERRITIN","value":25,"flag":"critical"},{"code":"MAGNESIUM","value":1.7,"flag":"low"}]'::jsonb, 'open');

  INSERT INTO med_transformation_wheel (tenant_id, patient_id, domain, score, source) VALUES
      ('1896be98-0d36-4044-bf37-0f1a26f5c363', pid, 'hormones', 35, 'questionnaire'),
      ('1896be98-0d36-4044-bf37-0f1a26f5c363', pid, 'energy', 40, 'questionnaire'),
      ('1896be98-0d36-4044-bf37-0f1a26f5c363', pid, 'cognition', 50, 'questionnaire'),
      ('1896be98-0d36-4044-bf37-0f1a26f5c363', pid, 'emotions', 55, 'questionnaire');

  INSERT INTO med_health_events (tenant_id, patient_id, event_type, title, occurred_at) VALUES
      ('1896be98-0d36-4044-bf37-0f1a26f5c363', pid, 'stress', 'Burn-out professionnel', '2025-09-15');
END $$;
