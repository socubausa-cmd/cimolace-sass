-- ════════════════════════════════════════════════════════════════════════
-- MEDOS v2 — BIO DIGITAL TWIN AI · i18n (Phase 2 — Chantier 5)
-- ════════════════════════════════════════════════════════════════════════
-- Internationalisation du referentiel biomarqueurs/organes en anglais.
-- Migration ADDITIVE et IDEMPOTENTE. 100% ASCII (sans accents) pour
-- resister au collage et garantir la portabilite entre environnements.
--
-- Ajoute name_en / description_en a med_organs, et name_en a
-- med_biomarker_refs. Met a jour les seeds existants avec les traductions.
--
-- Le code biomarqueur (CRP_HS, TSH, ...) reste IDENTIQUE et sert de cle
-- naturelle multi-langue : seules name_en / description_en changent.
--
-- Strategie front : l'app passe ?lang=en a GET /med/twin/referential ;
-- le backend mappe alors name -> name_en quand lang='en'. Aucun switcher
-- UI obligatoire dans cette migration (fondation seulement).
-- ════════════════════════════════════════════════════════════════════════

-- ── COLONNES ANGLAISES ─────────────────────────────────────────────────
ALTER TABLE med_organs
  ADD COLUMN IF NOT EXISTS name_en TEXT,
  ADD COLUMN IF NOT EXISTS description_en TEXT;

ALTER TABLE med_biomarker_refs
  ADD COLUMN IF NOT EXISTS name_en TEXT;

-- ── TRADUCTIONS — 12 ORGANES ───────────────────────────────────────────
UPDATE med_organs SET name_en='Brain'              WHERE code='brain'        AND name_en IS NULL;
UPDATE med_organs SET name_en='Thyroid'            WHERE code='thyroid'      AND name_en IS NULL;
UPDATE med_organs SET name_en='Heart'              WHERE code='heart'        AND name_en IS NULL;
UPDATE med_organs SET name_en='Lungs'              WHERE code='lungs'        AND name_en IS NULL;
UPDATE med_organs SET name_en='Liver'              WHERE code='liver'        AND name_en IS NULL;
UPDATE med_organs SET name_en='Stomach'            WHERE code='stomach'      AND name_en IS NULL;
UPDATE med_organs SET name_en='Pancreas'           WHERE code='pancreas'     AND name_en IS NULL;
UPDATE med_organs SET name_en='Gut'                WHERE code='gut'          AND name_en IS NULL;
UPDATE med_organs SET name_en='Kidneys'            WHERE code='kidneys'      AND name_en IS NULL;
UPDATE med_organs SET name_en='Adrenal glands'     WHERE code='adrenals'     AND name_en IS NULL;
UPDATE med_organs SET name_en='Reproductive system'WHERE code='reproductive' AND name_en IS NULL;
UPDATE med_organs SET name_en='Immune system'      WHERE code='immune'       AND name_en IS NULL;

-- ── TRADUCTIONS — BIOMARQUEURS (>=60 codes traduits) ───────────────────
-- Foundation (~40 codes) couverts integralement + biomarqueurs etendus
-- les plus utilises en pratique clinique (NFS, ionogramme, lipides,
-- hormones, vitamines, methylation, inflammation, stress oxydatif).

-- Inflammation
UPDATE med_biomarker_refs SET name_en='High-sensitivity CRP'            WHERE code='CRP_HS'        AND name_en IS NULL;
UPDATE med_biomarker_refs SET name_en='Erythrocyte sedimentation rate'  WHERE code='ESR'           AND name_en IS NULL;
UPDATE med_biomarker_refs SET name_en='Fibrinogen'                      WHERE code='FIBRINOGEN'    AND name_en IS NULL;
UPDATE med_biomarker_refs SET name_en='Homocysteine'                    WHERE code='HOMOCYSTEINE'  AND name_en IS NULL;

-- Metabolic
UPDATE med_biomarker_refs SET name_en='Fasting glucose'                 WHERE code='GLUCOSE'       AND name_en IS NULL;
UPDATE med_biomarker_refs SET name_en='Glycated hemoglobin (HbA1c)'     WHERE code='HBA1C'         AND name_en IS NULL;
UPDATE med_biomarker_refs SET name_en='Fasting insulin'                 WHERE code='INSULIN'       AND name_en IS NULL;
UPDATE med_biomarker_refs SET name_en='HOMA-IR'                         WHERE code='HOMA_IR'       AND name_en IS NULL;
UPDATE med_biomarker_refs SET name_en='Fructosamine'                    WHERE code='FRUCTOSAMINE'  AND name_en IS NULL;
UPDATE med_biomarker_refs SET name_en='C-peptide'                       WHERE code='C_PEPTIDE'     AND name_en IS NULL;

-- Lipid panel
UPDATE med_biomarker_refs SET name_en='Triglycerides'                   WHERE code='TRIGLYCERIDES' AND name_en IS NULL;
UPDATE med_biomarker_refs SET name_en='HDL cholesterol'                 WHERE code='HDL'           AND name_en IS NULL;
UPDATE med_biomarker_refs SET name_en='LDL cholesterol'                 WHERE code='LDL'           AND name_en IS NULL;
UPDATE med_biomarker_refs SET name_en='TG/HDL ratio'                    WHERE code='TG_HDL'        AND name_en IS NULL;
UPDATE med_biomarker_refs SET name_en='Apolipoprotein B'                WHERE code='APOB'          AND name_en IS NULL;
UPDATE med_biomarker_refs SET name_en='Total cholesterol'               WHERE code='CHOLESTEROL_TOTAL' AND name_en IS NULL;
UPDATE med_biomarker_refs SET name_en='Non-HDL cholesterol'             WHERE code='NON_HDL_CHOL'  AND name_en IS NULL;
UPDATE med_biomarker_refs SET name_en='Lipoprotein(a)'                  WHERE code='LP_A'          AND name_en IS NULL;
UPDATE med_biomarker_refs SET name_en='Apolipoprotein A1'               WHERE code='APOA1'         AND name_en IS NULL;

-- Liver panel
UPDATE med_biomarker_refs SET name_en='ALT (SGPT)'                      WHERE code='ALT'           AND name_en IS NULL;
UPDATE med_biomarker_refs SET name_en='AST (SGOT)'                      WHERE code='AST'           AND name_en IS NULL;
UPDATE med_biomarker_refs SET name_en='Gamma-GT'                        WHERE code='GGT'           AND name_en IS NULL;
UPDATE med_biomarker_refs SET name_en='Alkaline phosphatase'            WHERE code='ALP'           AND name_en IS NULL;
UPDATE med_biomarker_refs SET name_en='Total bilirubin'                 WHERE code='BILIRUBIN'     AND name_en IS NULL;
UPDATE med_biomarker_refs SET name_en='Albumin'                         WHERE code='ALBUMIN'       AND name_en IS NULL;
UPDATE med_biomarker_refs SET name_en='Total protein'                   WHERE code='TOTAL_PROTEIN' AND name_en IS NULL;
UPDATE med_biomarker_refs SET name_en='Direct bilirubin'                WHERE code='BILIRUBIN_DIRECT' AND name_en IS NULL;

-- Kidney panel
UPDATE med_biomarker_refs SET name_en='Creatinine'                      WHERE code='CREATININE'    AND name_en IS NULL;
UPDATE med_biomarker_refs SET name_en='Urea'                            WHERE code='UREA'          AND name_en IS NULL;
UPDATE med_biomarker_refs SET name_en='Estimated GFR'                   WHERE code='EGFR'          AND name_en IS NULL;
UPDATE med_biomarker_refs SET name_en='Uric acid'                       WHERE code='URIC_ACID'     AND name_en IS NULL;
UPDATE med_biomarker_refs SET name_en='Cystatin C'                      WHERE code='CYSTATIN_C'    AND name_en IS NULL;
UPDATE med_biomarker_refs SET name_en='Microalbuminuria'                WHERE code='MICROALBUMINURIA' AND name_en IS NULL;
UPDATE med_biomarker_refs SET name_en='Blood urea nitrogen'             WHERE code='BUN'           AND name_en IS NULL;

-- Thyroid
UPDATE med_biomarker_refs SET name_en='TSH'                             WHERE code='TSH'           AND name_en IS NULL;
UPDATE med_biomarker_refs SET name_en='Free T4'                         WHERE code='FT4'           AND name_en IS NULL;
UPDATE med_biomarker_refs SET name_en='Free T3'                         WHERE code='FT3'           AND name_en IS NULL;
UPDATE med_biomarker_refs SET name_en='Anti-TPO antibodies'             WHERE code='ANTI_TPO'      AND name_en IS NULL;
UPDATE med_biomarker_refs SET name_en='Reverse T3'                      WHERE code='REVERSE_T3'    AND name_en IS NULL;
UPDATE med_biomarker_refs SET name_en='Anti-thyroglobulin antibodies'   WHERE code='ANTI_TG'       AND name_en IS NULL;

-- Adrenal
UPDATE med_biomarker_refs SET name_en='Morning cortisol'                WHERE code='CORTISOL_AM'   AND name_en IS NULL;
UPDATE med_biomarker_refs SET name_en='DHEA sulfate'                    WHERE code='DHEAS'         AND name_en IS NULL;
UPDATE med_biomarker_refs SET name_en='Evening cortisol'                WHERE code='CORTISOL_PM'   AND name_en IS NULL;
UPDATE med_biomarker_refs SET name_en='ACTH'                            WHERE code='ACTH'          AND name_en IS NULL;

-- Hematology
UPDATE med_biomarker_refs SET name_en='Hemoglobin'                      WHERE code='HEMOGLOBIN'    AND name_en IS NULL;
UPDATE med_biomarker_refs SET name_en='Ferritin'                        WHERE code='FERRITIN'      AND name_en IS NULL;
UPDATE med_biomarker_refs SET name_en='Serum iron'                      WHERE code='IRON'          AND name_en IS NULL;
UPDATE med_biomarker_refs SET name_en='Transferrin saturation'          WHERE code='TRANSFERRIN_SAT' AND name_en IS NULL;
UPDATE med_biomarker_refs SET name_en='Red blood cells'                 WHERE code='ERYTHROCYTES'  AND name_en IS NULL;
UPDATE med_biomarker_refs SET name_en='Hematocrit'                      WHERE code='HEMATOCRIT'    AND name_en IS NULL;
UPDATE med_biomarker_refs SET name_en='Mean corpuscular volume'         WHERE code='MCV'           AND name_en IS NULL;
UPDATE med_biomarker_refs SET name_en='Platelets'                       WHERE code='PLATELETS'     AND name_en IS NULL;
UPDATE med_biomarker_refs SET name_en='White blood cells'               WHERE code='WBC'           AND name_en IS NULL;

-- Electrolytes
UPDATE med_biomarker_refs SET name_en='Sodium'                          WHERE code='SODIUM'        AND name_en IS NULL;
UPDATE med_biomarker_refs SET name_en='Potassium'                       WHERE code='POTASSIUM'     AND name_en IS NULL;
UPDATE med_biomarker_refs SET name_en='Chloride'                        WHERE code='CHLORIDE'      AND name_en IS NULL;
UPDATE med_biomarker_refs SET name_en='Bicarbonate'                     WHERE code='BICARBONATE'   AND name_en IS NULL;
UPDATE med_biomarker_refs SET name_en='Calcium'                         WHERE code='CALCIUM'       AND name_en IS NULL;
UPDATE med_biomarker_refs SET name_en='Phosphorus'                      WHERE code='PHOSPHORUS'    AND name_en IS NULL;

-- Vitamins / minerals
UPDATE med_biomarker_refs SET name_en='Vitamin B12'                     WHERE code='B12'           AND name_en IS NULL;
UPDATE med_biomarker_refs SET name_en='Folate'                          WHERE code='FOLATE'        AND name_en IS NULL;
UPDATE med_biomarker_refs SET name_en='Vitamin D (25-OH)'               WHERE code='VIT_D'         AND name_en IS NULL;
UPDATE med_biomarker_refs SET name_en='Red blood cell magnesium'        WHERE code='MAGNESIUM'     AND name_en IS NULL;
UPDATE med_biomarker_refs SET name_en='Zinc'                            WHERE code='ZINC'          AND name_en IS NULL;
UPDATE med_biomarker_refs SET name_en='Vitamin A'                       WHERE code='VIT_A'         AND name_en IS NULL;
UPDATE med_biomarker_refs SET name_en='Vitamin E'                       WHERE code='VIT_E'         AND name_en IS NULL;
UPDATE med_biomarker_refs SET name_en='Vitamin C'                       WHERE code='VIT_C'         AND name_en IS NULL;
UPDATE med_biomarker_refs SET name_en='Vitamin B6'                      WHERE code='VIT_B6'        AND name_en IS NULL;
UPDATE med_biomarker_refs SET name_en='Selenium'                        WHERE code='SELENIUM'      AND name_en IS NULL;
UPDATE med_biomarker_refs SET name_en='Copper'                          WHERE code='COPPER'        AND name_en IS NULL;
UPDATE med_biomarker_refs SET name_en='Iodine (urinary)'                WHERE code='IODINE_URINE'  AND name_en IS NULL;

-- Sex hormones
UPDATE med_biomarker_refs SET name_en='Total testosterone'              WHERE code='TESTOSTERONE'  AND name_en IS NULL;
UPDATE med_biomarker_refs SET name_en='Estradiol'                       WHERE code='ESTRADIOL'     AND name_en IS NULL;
UPDATE med_biomarker_refs SET name_en='Progesterone'                    WHERE code='PROGESTERONE'  AND name_en IS NULL;
UPDATE med_biomarker_refs SET name_en='Luteinizing hormone'             WHERE code='LH'            AND name_en IS NULL;
UPDATE med_biomarker_refs SET name_en='Follicle-stimulating hormone'    WHERE code='FSH'           AND name_en IS NULL;
UPDATE med_biomarker_refs SET name_en='SHBG'                            WHERE code='SHBG'          AND name_en IS NULL;
UPDATE med_biomarker_refs SET name_en='Prolactin'                       WHERE code='PROLACTIN'     AND name_en IS NULL;
UPDATE med_biomarker_refs SET name_en='Anti-Mullerian hormone'          WHERE code='AMH'           AND name_en IS NULL;

-- Cardiovascular
UPDATE med_biomarker_refs SET name_en='NT-proBNP'                       WHERE code='NT_PROBNP'     AND name_en IS NULL;
UPDATE med_biomarker_refs SET name_en='High-sensitivity troponin'       WHERE code='TROPONIN_HS'   AND name_en IS NULL;
UPDATE med_biomarker_refs SET name_en='Lp-PLA2'                         WHERE code='LP_PLA2'       AND name_en IS NULL;

-- Inflammation / cytokines
UPDATE med_biomarker_refs SET name_en='Interleukin-6'                   WHERE code='IL6'           AND name_en IS NULL;
UPDATE med_biomarker_refs SET name_en='TNF-alpha'                       WHERE code='TNF_ALPHA'     AND name_en IS NULL;
UPDATE med_biomarker_refs SET name_en='Neutrophil-to-lymphocyte ratio'  WHERE code='NLR_RATIO'     AND name_en IS NULL;

-- Methylation / oxidative stress
UPDATE med_biomarker_refs SET name_en='Methylmalonic acid'              WHERE code='MMA'           AND name_en IS NULL;
UPDATE med_biomarker_refs SET name_en='Reduced glutathione'             WHERE code='GSH'           AND name_en IS NULL;
UPDATE med_biomarker_refs SET name_en='Coenzyme Q10'                    WHERE code='COQ10'         AND name_en IS NULL;

-- Digestive markers
UPDATE med_biomarker_refs SET name_en='Calprotectin'                    WHERE code='CALPROTECTIN'  AND name_en IS NULL;
UPDATE med_biomarker_refs SET name_en='Zonulin'                         WHERE code='ZONULIN'       AND name_en IS NULL;
UPDATE med_biomarker_refs SET name_en='Fecal elastase'                  WHERE code='FECAL_ELASTASE' AND name_en IS NULL;

-- Adipokines
UPDATE med_biomarker_refs SET name_en='Leptin'                          WHERE code='LEPTIN'        AND name_en IS NULL;
UPDATE med_biomarker_refs SET name_en='Adiponectin'                     WHERE code='ADIPONECTIN'   AND name_en IS NULL;
