-- ============================================================================
-- MEDOS / Nganga — Assignation ciblée de formulaires
-- ----------------------------------------------------------------------------
-- Permet d'envoyer un formulaire PRÉCIS à un patient PRÉCIS (au lieu que tous
-- les formulaires du cabinet soient visibles par tous les patients) + suivre
-- le statut (à remplir → rempli). Une assignation est complétée quand le
-- patient soumet une réponse au formulaire.
-- ============================================================================

CREATE TABLE IF NOT EXISTS med_form_assignments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  form_id      UUID NOT NULL REFERENCES med_medical_forms(id) ON DELETE CASCADE,
  patient_id   UUID NOT NULL REFERENCES med_patients(id) ON DELETE CASCADE,
  status       TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','completed','cancelled')),
  note         TEXT,
  assigned_by  UUID,
  assigned_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  response_id  UUID REFERENCES med_form_responses(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- une seule assignation active par (tenant, formulaire, patient)
  UNIQUE (tenant_id, form_id, patient_id)
);

CREATE INDEX IF NOT EXISTS idx_med_fa_tenant  ON med_form_assignments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_med_fa_patient ON med_form_assignments(patient_id, status);
CREATE INDEX IF NOT EXISTS idx_med_fa_form    ON med_form_assignments(form_id);

ALTER TABLE med_form_assignments ENABLE ROW LEVEL SECURITY;

-- Le staff du tenant lit les assignations de son cabinet
CREATE POLICY "staff_read_assignments" ON med_form_assignments
  FOR SELECT USING (
    EXISTS(SELECT 1 FROM tenant_memberships
      WHERE tenant_id = med_form_assignments.tenant_id
        AND user_id = auth.uid()
        AND role IN ('owner','practitioner','clinic_admin','receptionist')
        AND status = 'active')
  );

-- Le staff (rôles décisionnaires) crée / modifie / annule
CREATE POLICY "staff_manage_assignments" ON med_form_assignments
  FOR ALL USING (
    EXISTS(SELECT 1 FROM tenant_memberships
      WHERE tenant_id = med_form_assignments.tenant_id
        AND user_id = auth.uid()
        AND role IN ('owner','practitioner','clinic_admin','receptionist')
        AND status = 'active')
  ) WITH CHECK (
    EXISTS(SELECT 1 FROM tenant_memberships
      WHERE tenant_id = med_form_assignments.tenant_id
        AND user_id = auth.uid()
        AND role IN ('owner','practitioner','clinic_admin','receptionist')
        AND status = 'active')
  );

-- Le patient lit SES propres assignations
CREATE POLICY "patient_read_own_assignments" ON med_form_assignments
  FOR SELECT USING (
    EXISTS(SELECT 1 FROM med_patients
      WHERE med_patients.id = med_form_assignments.patient_id
        AND med_patients.patient_user_id = auth.uid())
  );

DROP TRIGGER IF EXISTS med_form_assignments_updated_at ON med_form_assignments;
CREATE TRIGGER med_form_assignments_updated_at
  BEFORE UPDATE ON med_form_assignments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
