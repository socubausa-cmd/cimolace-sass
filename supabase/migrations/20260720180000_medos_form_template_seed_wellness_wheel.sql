-- ─────────────────────────────────────────────────────────────────────────────
-- Seed template global « Bilan bien-être 12 axes » avec wheel_mapping natif.
--
-- Ce template DÉMO prouve le mécanisme d'auto-remplissage de la Roue Détox à
-- partir d'un formulaire (Vague 3 / G1). Le praticien peut :
--   1. L'assigner à un patient via POST /med/forms/:id/assign
--   2. Ou l'attacher à une invitation via form_template_ids (G2)
-- À la soumission, applyWheelMappingIfAny détecte le wheel_mapping et INSERT
-- 12 lignes med_transformation_wheel source='form_response' pour ce patient.
--
-- Le vrai formulaire Vitalis Détox 5 sections (utilisé sur zahirwellness.com)
-- passe par un autre pont — POST /v1/medos/embed/import-vitalis-bilan — pour
-- ne pas obliger la patiente à se re-connecter sur le portail MEDOS.
-- ─────────────────────────────────────────────────────────────────────────────

insert into public.med_medical_forms (
  tenant_id, title, description, category, fields, is_template,
  wheel_mapping
)
select
  null,
  'Bilan bien-être 12 axes (démo)',
  'Auto-évaluation rapide sur les 12 axes de la Roue Détox. Notez chaque item de 0 (aucun problème) à 10 (très marqué). Le résultat alimente automatiquement votre Roue Détox et le tableau de bord de votre praticien.',
  'assessment',
  '[
    {"id":"digestion","label":"Troubles digestifs (ballonnements, reflux, transit)","type":"number","min":0,"max":10,"required":true},
    {"id":"sleep","label":"Difficultés de sommeil (endormissement, réveils)","type":"number","min":0,"max":10,"required":true},
    {"id":"stress","label":"Niveau de stress ressenti","type":"number","min":0,"max":10,"required":true},
    {"id":"fatigue","label":"Fatigue générale","type":"number","min":0,"max":10,"required":true},
    {"id":"inflammation","label":"Douleurs articulaires ou musculaires","type":"number","min":0,"max":10,"required":true},
    {"id":"immunity","label":"Fréquence des infections (rhume, angine…)","type":"number","min":0,"max":10,"required":true},
    {"id":"metabolism","label":"Difficulté à gérer votre poids","type":"number","min":0,"max":10,"required":true},
    {"id":"hormones","label":"Déséquilibres hormonaux (cycles, peau, humeur cyclique)","type":"number","min":0,"max":10,"required":true},
    {"id":"physical_activity","label":"Manque d''activité physique","type":"number","min":0,"max":10,"required":true},
    {"id":"cognition","label":"Brouillard mental, difficultés de concentration","type":"number","min":0,"max":10,"required":true},
    {"id":"environment","label":"Exposition à un environnement pollué (urbain, professionnel)","type":"number","min":0,"max":10,"required":true},
    {"id":"emotions","label":"Baisse de moral, anxiété","type":"number","min":0,"max":10,"required":true}
  ]'::jsonb,
  true,
  '{
    "digestion":         {"reducers":[{"type":"severity_to_wellness","field":"digestion"}]},
    "sleep":             {"reducers":[{"type":"severity_to_wellness","field":"sleep"}]},
    "stress":            {"reducers":[{"type":"severity_to_wellness","field":"stress"}]},
    "energy":            {"reducers":[{"type":"severity_to_wellness","field":"fatigue"}]},
    "inflammation":      {"reducers":[{"type":"severity_to_wellness","field":"inflammation"}]},
    "immunity":          {"reducers":[{"type":"severity_to_wellness","field":"immunity"}]},
    "metabolism":        {"reducers":[{"type":"severity_to_wellness","field":"metabolism"}]},
    "hormones":          {"reducers":[{"type":"severity_to_wellness","field":"hormones"}]},
    "physical_activity": {"reducers":[{"type":"severity_to_wellness","field":"physical_activity"}]},
    "cognition":         {"reducers":[{"type":"severity_to_wellness","field":"cognition"}]},
    "environment":       {"reducers":[{"type":"severity_to_wellness","field":"environment"}]},
    "emotions":          {"reducers":[{"type":"severity_to_wellness","field":"emotions"}]}
  }'::jsonb
where not exists (
  select 1 from public.med_medical_forms
  where tenant_id is null
    and title = 'Bilan bien-être 12 axes (démo)'
);
