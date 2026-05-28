-- MEDOS — Prescriptions / Ordonnances
--
-- Tables : med_prescriptions (entête) + med_prescription_items (lignes médicaments).
-- Une prescription "draft" peut être modifiée. Une prescription "signed" est immuable.
-- Numérotation par tenant (ex: ZAH-2026-00042) générée applicativement.

CREATE TABLE IF NOT EXISTS med_prescriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES med_patients(id) ON DELETE CASCADE,
  practitioner_id UUID NOT NULL,
  consultation_note_id UUID REFERENCES med_consultation_notes(id) ON DELETE SET NULL,

  prescription_number TEXT,                          -- ex: ZAH-2026-00042
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  validity_days INTEGER NOT NULL DEFAULT 90,         -- durée légale de validité
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','signed','dispensed','cancelled')),

  patient_instructions TEXT,                         -- conseils généraux au patient
  practitioner_notes TEXT,                           -- notes praticien (non visible patient)

  signed_at TIMESTAMPTZ,
  signature_hash TEXT,                               -- hash SHA-256 du contenu signé
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT,

  pdf_url TEXT,                                      -- généré au moment de la signature
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_med_prescriptions_tenant ON med_prescriptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_med_prescriptions_patient ON med_prescriptions(patient_id, issued_at DESC);
CREATE INDEX IF NOT EXISTS idx_med_prescriptions_practitioner ON med_prescriptions(practitioner_id, issued_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_med_prescriptions_number
  ON med_prescriptions(tenant_id, prescription_number)
  WHERE prescription_number IS NOT NULL;

ALTER TABLE med_prescriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_manage_prescriptions" ON med_prescriptions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM tenant_memberships
      WHERE tenant_id = med_prescriptions.tenant_id
        AND user_id = auth.uid()
        AND role IN ('owner','practitioner','clinic_admin')
        AND status = 'active'
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM tenant_memberships
      WHERE tenant_id = med_prescriptions.tenant_id
        AND user_id = auth.uid()
        AND role IN ('owner','practitioner','clinic_admin')
        AND status = 'active'
    )
  );

CREATE POLICY "patient_read_own_prescriptions" ON med_prescriptions
  FOR SELECT USING (
    status IN ('signed','dispensed')
    AND EXISTS (
      SELECT 1 FROM med_patients
      WHERE med_patients.id = med_prescriptions.patient_id
        AND med_patients.patient_user_id = auth.uid()
    )
  );

CREATE POLICY "service_role_prescriptions" ON med_prescriptions
  TO service_role USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS med_prescriptions_updated_at ON med_prescriptions;
CREATE TRIGGER med_prescriptions_updated_at
  BEFORE UPDATE ON med_prescriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ──────────────────────────────────────────────────────────────────────────
-- Lignes de prescription (un médicament par ligne)

CREATE TABLE IF NOT EXISTS med_prescription_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  prescription_id UUID NOT NULL REFERENCES med_prescriptions(id) ON DELETE CASCADE,

  position INTEGER NOT NULL DEFAULT 0,                -- ordre d'affichage
  drug_name TEXT NOT NULL,                            -- ex: "Paracétamol 1000mg"
  drug_code TEXT,                                     -- ATC ou code interne
  dosage TEXT NOT NULL,                               -- ex: "1 comprimé"
  frequency TEXT NOT NULL,                            -- ex: "3 fois par jour"
  duration TEXT NOT NULL,                             -- ex: "5 jours"
  route TEXT,                                         -- ex: "oral", "IV", "topique"
  quantity TEXT,                                      -- ex: "1 boîte de 16"
  notes TEXT,                                         -- ex: "à prendre pendant les repas"
  is_substitutable BOOLEAN NOT NULL DEFAULT true,     -- ND : non substituable (médecin)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_med_prescription_items_tenant ON med_prescription_items(tenant_id);
CREATE INDEX IF NOT EXISTS idx_med_prescription_items_prescription
  ON med_prescription_items(prescription_id, position);

ALTER TABLE med_prescription_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "items_inherit_prescription_access" ON med_prescription_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM med_prescriptions p
      WHERE p.id = med_prescription_items.prescription_id
        AND EXISTS (
          SELECT 1 FROM tenant_memberships
          WHERE tenant_id = p.tenant_id
            AND user_id = auth.uid()
            AND role IN ('owner','practitioner','clinic_admin')
            AND status = 'active'
        )
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM med_prescriptions p
      WHERE p.id = med_prescription_items.prescription_id
        AND EXISTS (
          SELECT 1 FROM tenant_memberships
          WHERE tenant_id = p.tenant_id
            AND user_id = auth.uid()
            AND role IN ('owner','practitioner','clinic_admin')
            AND status = 'active'
        )
    )
  );

CREATE POLICY "patient_read_own_prescription_items" ON med_prescription_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM med_prescriptions p
      JOIN med_patients pat ON pat.id = p.patient_id
      WHERE p.id = med_prescription_items.prescription_id
        AND p.status IN ('signed','dispensed')
        AND pat.patient_user_id = auth.uid()
    )
  );

CREATE POLICY "service_role_prescription_items" ON med_prescription_items
  TO service_role USING (true) WITH CHECK (true);
