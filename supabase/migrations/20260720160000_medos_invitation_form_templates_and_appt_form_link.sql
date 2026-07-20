-- ─────────────────────────────────────────────────────────────────────────────
-- Vague 2 workflow praticien MEDOS — deux ajouts additifs
--
--  G2. med_patient_invitations.form_template_ids  (uuid[])
--      Liste optionnelle de templates de formulaires à assigner AUTOMATIQUEMENT
--      au patient dès qu'il accepte l'invitation. Rend l'onboarding 1 clic :
--      le praticien coche « bilan Vitalis + consentement » à la création de
--      l'invitation, le patient les trouve prêts à remplir à son 1er login.
--
--  G4. med_appointments.form_response_id  (uuid FK)
--      Permet de lier un RDV à une réponse de formulaire spécifique — le
--      praticien ouvre la consultation avec le contexte du bilan pré-chargé
--      (« consultation basée sur ce bilan »).
--
-- Colonnes ajoutées non-nulles-avec-défaut évitées : NULL = comportement
-- actuel préservé. Aucune migration de données nécessaire.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.med_patient_invitations
  add column if not exists form_template_ids uuid[];

comment on column public.med_patient_invitations.form_template_ids is
  'Templates de formulaires (med_medical_forms.id) à assigner automatiquement '
  'au patient à l''acceptation de l''invitation. NULL = aucun.';

alter table public.med_appointments
  add column if not exists form_response_id uuid references public.med_form_responses(id) on delete set null;

create index if not exists med_appointments_form_response_id_idx
  on public.med_appointments (form_response_id)
  where form_response_id is not null;

comment on column public.med_appointments.form_response_id is
  'Optionnel — RDV programmé « à partir de » cette réponse de formulaire. '
  'Permet au praticien d''ouvrir la consultation avec le bilan pré-chargé.';
