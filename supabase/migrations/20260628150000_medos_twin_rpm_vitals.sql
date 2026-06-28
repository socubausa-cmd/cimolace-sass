-- ════════════════════════════════════════════════════════════════════════
-- MEDOS v2 — Bio Digital Twin · INGESTION RPM (Remote Patient Monitoring)
-- ════════════════════════════════════════════════════════════════════════
-- Évolution ADDITIVE. Permet aux constantes saisies par le patient depuis ses
-- appareils maison (tensiomètre, glucomètre, balance, oxymètre, fréquence
-- cardiaque) d'alimenter le jumeau au niveau CLINIQUE : les vitals de
-- med_health_entries sont projetés dans med_patient_biomarkers (codes
-- ci-dessous) puis scorés/alertés par le moteur déterministe.
--
-- 1) Référentiel : 6 biomarqueurs « constantes maison » (vitals) qui
--    manquaient à med_biomarker_refs. GLUCOSE existe déjà (glycémie à jeun)
--    et n'est PAS redéfini ici — blood_glucose s'y mappe directement.
-- 2) Provenance : colonne med_health_entries.source pour tracer l'origine
--    de la saisie ('home_device' | 'manual' | 'questionnaire' | 'import').
--    med_patient_biomarkers.source porte déjà la valeur 'home_device' SANS
--    contrainte CHECK (TEXT libre), donc rien à altérer côté biomarqueurs.
--
-- IDEMPOTENT : ON CONFLICT (code) DO NOTHING + ADD COLUMN IF NOT EXISTS.
-- ⚠️ MIGRATION NON APPLIQUÉE — à appliquer en prod (run-sql.js / db push).
-- Plages : indicatives, fonctionnelles. Statut : À VALIDER CLINIQUEMENT.
-- ════════════════════════════════════════════════════════════════════════

-- ── 1) Biomarqueurs « constantes maison » (vitals) ──────────────────────
-- higher_is_worse : BP/FC/température montent = pire (true) ; le poids n'a
-- pas de direction clinique universelle → organs vide (suivi/timeline, pas
-- de score d'organe ni de fausse pénalité). SpO2 (oxymètre) : plus bas = pire
-- (higher_is_worse=false), seuils respiratoires usuels.
INSERT INTO med_biomarker_refs
  (code, name_fr, category, dimension, unit, optimal_low, optimal_high, lab_low, lab_high, organs, higher_is_worse, function_fr, associated_symptoms)
VALUES
  ('BP_SYSTOLIC','Tension artérielle systolique','vital','metabolism','mmHg',90,120,90,140,'{heart,kidneys}',true,
    'Pression artérielle haute (systole). Mesure tensiomètre maison.','{cephalees,vertiges}'),
  ('BP_DIASTOLIC','Tension artérielle diastolique','vital','metabolism','mmHg',60,80,60,90,'{heart,kidneys}',true,
    'Pression artérielle basse (diastole). Mesure tensiomètre maison.','{cephalees}'),
  ('HEART_RATE','Fréquence cardiaque au repos','vital','cellular_energy','bpm',55,75,50,100,'{heart}',true,
    'Pouls au repos. Mesure oxymètre / cardiofréquencemètre / tensiomètre.','{palpitations,fatigue}'),
  ('SPO2','Saturation en oxygène (SpO2)','vital','cellular_energy','%',96,100,94,100,'{lungs,heart}',false,
    'Oxygénation du sang. Mesure oxymètre de pouls maison.','{essoufflement,fatigue}'),
  ('BODY_TEMP','Température corporelle','vital','inflammation','°C',36.3,37.2,35.5,37.5,'{immune}',true,
    'Température corporelle. Signal de fièvre / inflammation aiguë.','{fievre,frissons,fatigue}'),
  ('WEIGHT','Poids corporel','vital','metabolism','kg',NULL,NULL,NULL,NULL,'{}',true,
    'Poids mesuré sur balance maison. Suivi de tendance (pas de score d''organe).','{}')
ON CONFLICT (code) DO NOTHING;

-- Traductions EN (la colonne name_en existe depuis 20260608000004_medos_twin_i18n).
UPDATE med_biomarker_refs SET name_en='Systolic blood pressure'  WHERE code='BP_SYSTOLIC'  AND name_en IS NULL;
UPDATE med_biomarker_refs SET name_en='Diastolic blood pressure' WHERE code='BP_DIASTOLIC' AND name_en IS NULL;
UPDATE med_biomarker_refs SET name_en='Resting heart rate'       WHERE code='HEART_RATE'   AND name_en IS NULL;
UPDATE med_biomarker_refs SET name_en='Oxygen saturation (SpO2)' WHERE code='SPO2'         AND name_en IS NULL;
UPDATE med_biomarker_refs SET name_en='Body temperature'         WHERE code='BODY_TEMP'    AND name_en IS NULL;
UPDATE med_biomarker_refs SET name_en='Body weight'              WHERE code='WEIGHT'        AND name_en IS NULL;

-- ── 2) Provenance de la saisie de suivi ─────────────────────────────────
-- Trace l'origine d'une entrée med_health_entries. Défaut 'manual' pour ne
-- pas reclasser l'historique. Le pipeline RPM écrit 'home_device'.
ALTER TABLE med_health_entries
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual';

-- Note : pas de contrainte CHECK volontairement (valeurs ouvertes pour
-- accueillir de futurs connecteurs : 'apple_health','google_fit','withings'…).
COMMENT ON COLUMN med_health_entries.source IS
  'Origine de la saisie : manual | home_device | questionnaire | import | <connecteur>';
