-- MEDOS S0.2 — Templates de formulaires médicaux globaux
--
-- Objectif : seeder 5 modèles prêts à l'emploi, visibles par tous les tenants,
-- non éditables (sauf clone). Évite que chaque tenant doive recréer un
-- formulaire de consentement, un PHQ-9, un intake basique, etc.
--
-- Modèle : `tenant_id IS NULL` + `is_template = true` => template global.
-- Tout staff authentifié peut LIRE ces templates. Personne ne peut les
-- modifier (sauf service_role via migration).

-- 1. Autoriser tenant_id NULL pour les templates globaux
ALTER TABLE med_medical_forms
  ALTER COLUMN tenant_id DROP NOT NULL;

-- 2. Politique RLS dédiée : lecture des templates globaux pour tout staff
DROP POLICY IF EXISTS "any_staff_read_global_templates" ON med_medical_forms;
CREATE POLICY "any_staff_read_global_templates" ON med_medical_forms
  FOR SELECT USING (
    tenant_id IS NULL
    AND is_template = true
    AND EXISTS (
      SELECT 1 FROM tenant_memberships
      WHERE tenant_memberships.user_id = auth.uid()
        AND tenant_memberships.role IN (
          'owner','practitioner','clinic_admin','receptionist'
        )
        AND tenant_memberships.status = 'active'
    )
  );

-- 3. Empêcher tout INSERT/UPDATE/DELETE par utilisateur sur les templates globaux
DROP POLICY IF EXISTS "no_user_write_global_templates" ON med_medical_forms;
CREATE POLICY "no_user_write_global_templates" ON med_medical_forms
  FOR ALL USING (tenant_id IS NOT NULL) WITH CHECK (tenant_id IS NOT NULL);

-- 4. Seeds — 5 templates (idempotents via WHERE NOT EXISTS sur le titre)

-- 4.1 Consentement général
INSERT INTO med_medical_forms (tenant_id, title, description, category, fields, is_template)
SELECT NULL,
  'Consentement général de soins',
  'Formulaire de consentement éclairé pour soins et traitements standards.',
  'consent',
  '[
    {"key":"identity_confirmed","label":"Je confirme mon identité","type":"checkbox","required":true},
    {"key":"data_processing","label":"J''autorise le traitement de mes données médicales conformément à la RGPD","type":"checkbox","required":true},
    {"key":"share_with_practitioners","label":"J''autorise le partage de mes informations entre les praticiens du cabinet","type":"checkbox","required":true},
    {"key":"emergency_contact","label":"Personne à prévenir en cas d''urgence (nom et téléphone)","type":"text","required":true},
    {"key":"signature","label":"Signature","type":"signature","required":true}
  ]'::jsonb,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM med_medical_forms
  WHERE title = 'Consentement général de soins' AND tenant_id IS NULL
);

-- 4.2 Intake basique
INSERT INTO med_medical_forms (tenant_id, title, description, category, fields, is_template)
SELECT NULL,
  'Anamnèse — Premier rendez-vous',
  'Questionnaire d''admission standard à compléter avant la première consultation.',
  'intake',
  '[
    {"key":"reason_visit","label":"Motif de la consultation","type":"textarea","required":true},
    {"key":"current_treatments","label":"Traitements actuels (médicaments, suppléments)","type":"textarea"},
    {"key":"allergies","label":"Allergies connues","type":"textarea"},
    {"key":"chronic_conditions","label":"Maladies chroniques","type":"textarea"},
    {"key":"family_history","label":"Antécédents familiaux importants","type":"textarea"},
    {"key":"surgeries","label":"Chirurgies passées (avec dates)","type":"textarea"},
    {"key":"tobacco","label":"Tabac","type":"select","options":["non","occasionnel","régulier","ex-fumeur"]},
    {"key":"alcohol","label":"Alcool","type":"select","options":["non","occasionnel","régulier"]},
    {"key":"physical_activity","label":"Activité physique hebdomadaire","type":"select","options":["aucune","1-2h","3-5h","6h+"]}
  ]'::jsonb,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM med_medical_forms
  WHERE title = 'Anamnèse — Premier rendez-vous' AND tenant_id IS NULL
);

-- 4.3 Post-consultation
INSERT INTO med_medical_forms (tenant_id, title, description, category, fields, is_template)
SELECT NULL,
  'Suivi post-consultation',
  'Auto-évaluation patient après une consultation, à envoyer 48h après le RDV.',
  'followup',
  '[
    {"key":"feeling_better","label":"Vous sentez-vous mieux qu''avant la consultation ?","type":"select","options":["beaucoup mieux","un peu mieux","pareil","un peu moins bien","beaucoup moins bien"],"required":true},
    {"key":"side_effects","label":"Avez-vous noté des effets secondaires ?","type":"textarea"},
    {"key":"compliance","label":"Suivez-vous le traitement comme prescrit ?","type":"select","options":["oui complètement","majoritairement","partiellement","non"]},
    {"key":"questions","label":"Avez-vous des questions pour votre praticien ?","type":"textarea"},
    {"key":"next_appointment","label":"Souhaitez-vous un rendez-vous de suivi ?","type":"select","options":["oui rapidement","oui dans quelques semaines","non"]}
  ]'::jsonb,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM med_medical_forms
  WHERE title = 'Suivi post-consultation' AND tenant_id IS NULL
);

-- 4.4 PHQ-9 (dépression)
INSERT INTO med_medical_forms (tenant_id, title, description, category, fields, is_template)
SELECT NULL,
  'PHQ-9 — Évaluation de l''humeur',
  'Patient Health Questionnaire-9. Échelle validée pour l''évaluation de la dépression.',
  'assessment',
  '[
    {"key":"q1","label":"Peu d''intérêt ou de plaisir à faire les choses","type":"select","options":["jamais (0)","plusieurs jours (1)","plus de la moitié des jours (2)","presque tous les jours (3)"],"required":true},
    {"key":"q2","label":"Tristesse, déprime, désespoir","type":"select","options":["jamais (0)","plusieurs jours (1)","plus de la moitié des jours (2)","presque tous les jours (3)"],"required":true},
    {"key":"q3","label":"Difficultés à s''endormir ou à rester endormi, ou sommeil excessif","type":"select","options":["jamais (0)","plusieurs jours (1)","plus de la moitié des jours (2)","presque tous les jours (3)"],"required":true},
    {"key":"q4","label":"Fatigue ou manque d''énergie","type":"select","options":["jamais (0)","plusieurs jours (1)","plus de la moitié des jours (2)","presque tous les jours (3)"],"required":true},
    {"key":"q5","label":"Manque d''appétit ou trop manger","type":"select","options":["jamais (0)","plusieurs jours (1)","plus de la moitié des jours (2)","presque tous les jours (3)"],"required":true},
    {"key":"q6","label":"Mauvaise opinion de soi-même, sentiment d''échec","type":"select","options":["jamais (0)","plusieurs jours (1)","plus de la moitié des jours (2)","presque tous les jours (3)"],"required":true},
    {"key":"q7","label":"Difficultés à se concentrer","type":"select","options":["jamais (0)","plusieurs jours (1)","plus de la moitié des jours (2)","presque tous les jours (3)"],"required":true},
    {"key":"q8","label":"Lenteur ou agitation observable par autrui","type":"select","options":["jamais (0)","plusieurs jours (1)","plus de la moitié des jours (2)","presque tous les jours (3)"],"required":true},
    {"key":"q9","label":"Pensées qu''il vaudrait mieux mourir","type":"select","options":["jamais (0)","plusieurs jours (1)","plus de la moitié des jours (2)","presque tous les jours (3)"],"required":true,"warning":"Une réponse > 0 nécessite une évaluation immédiate par un praticien"}
  ]'::jsonb,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM med_medical_forms
  WHERE title = 'PHQ-9 — Évaluation de l''humeur' AND tenant_id IS NULL
);

-- 4.5 Nutrition / journal alimentaire
INSERT INTO med_medical_forms (tenant_id, title, description, category, fields, is_template)
SELECT NULL,
  'Journal alimentaire — 24h',
  'Reconstitution des prises alimentaires sur les 24 dernières heures.',
  'assessment',
  '[
    {"key":"breakfast","label":"Petit-déjeuner (heure, aliments, boissons)","type":"textarea"},
    {"key":"lunch","label":"Déjeuner (heure, aliments, boissons)","type":"textarea"},
    {"key":"dinner","label":"Dîner (heure, aliments, boissons)","type":"textarea"},
    {"key":"snacks","label":"Encas et grignotages (heures et contenu)","type":"textarea"},
    {"key":"water_liters","label":"Quantité d''eau bue (litres)","type":"number"},
    {"key":"alcohol_units","label":"Unités d''alcool consommées","type":"number"},
    {"key":"caffeine_cups","label":"Café/thé/boissons caféinées (nombre)","type":"number"},
    {"key":"observations","label":"Observations particulières (faim, satiété, émotions liées)","type":"textarea"}
  ]'::jsonb,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM med_medical_forms
  WHERE title = 'Journal alimentaire — 24h' AND tenant_id IS NULL
);
