-- ─────────────────────────────────────────────────────────────────────────────
-- Vague 3 workflow praticien MEDOS — G1 : mapping formulaire → Roue Détox auto
--
-- Ajoute `wheel_mapping JSONB` sur `med_medical_forms`. Chaque template peut
-- déclarer comment ses réponses alimentent les 12 axes de la Roue Détox.
--
-- Structure attendue (validée côté service TS) :
-- {
--   "digestion": {
--     "reducers": [
--       { "type": "severity_to_wellness", "field": "bloating" },
--       { "type": "severity_to_wellness", "field": "nausea" },
--       { "type": "verbal_to_score", "field": "transit",
--         "map": {"regulier": 88, "irregulier": 45, "constipation": 25} }
--     ]
--   },
--   "sleep": { "reducers": [ ... ] },
--   ...12 axes...
-- }
--
-- Types de reducers :
--   • severity_to_wellness : sévérité 0-10 (haut=mauvais) → wellness 20-100
--     formule = max(20, 100 - sev*8)
--   • verbal_to_score : lookup dans un map, fallback 60
--   • count_penalty : compte les items d'un array, plafond = penalty*count
--     formule = max(30, base - min(cap, penalty * length))
--   • constant : score fixe (fallback)
--
-- Combine : moyenne des reducers du même axe. Si aucun reducer résout, score
-- par défaut = 60 (neutre — pas d'alerte, pas de faux positif).
--
-- Trigger côté service : à `submitFormResponse` / `submitMyFormResponse`, si
-- `wheel_mapping IS NOT NULL`, calcule les 12 scores et upsert dans
-- med_transformation_wheel avec source='form_response'. Idempotent (delete
-- ancienne source='form_response' pour ce patient+form avant insert).
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.med_medical_forms
  add column if not exists wheel_mapping jsonb;

comment on column public.med_medical_forms.wheel_mapping is
  'Mapping optionnel des réponses vers les 12 axes de la Roue Détox. '
  'Structure : { "<domain>": { "reducers": [{type, field, ...}] }, ... }. '
  'Types de reducers supportés : severity_to_wellness, verbal_to_score, '
  'count_penalty, constant. Si NULL, aucun calcul auto (comportement legacy).';
