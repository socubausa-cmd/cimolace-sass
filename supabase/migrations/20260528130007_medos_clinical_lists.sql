-- MEDOS — Listes cliniques structurées
--
-- Données médicales transversales par patient :
--   - allergies (médicaments, alimentaires, environnementales)
--   - traitements actuels (médicaments en cours)
--   - problèmes/diagnostics actifs
--   - vaccinations
--   - résultats d'examens biologiques
--
-- Ces listes sont essentielles à la sécurité du patient et à l'IA charting
-- (Claude utilise ces données pour suggérer des contre-indications).

-- ─── Allergies ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS med_allergies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES med_patients(id) ON DELETE CASCADE,

  substance TEXT NOT NULL,                            -- ex: "Pénicilline"
  category TEXT NOT NULL
    CHECK (category IN ('drug','food','environmental','animal','other')),
  reaction TEXT,                                      -- ex: "urticaire, œdème de Quincke"
  severity TEXT NOT NULL DEFAULT 'unknown'
    CHECK (severity IN ('mild','moderate','severe','anaphylaxis','unknown')),
  onset_date DATE,
  notes TEXT,

  -- Source de l'information
  recorded_by UUID NOT NULL,
  recorded_by_role TEXT NOT NULL
    CHECK (recorded_by_role IN ('practitioner','clinic_admin','patient','system')),

  is_active BOOLEAN NOT NULL DEFAULT true,
  verified_by_practitioner BOOLEAN NOT NULL DEFAULT false,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_med_allergies_tenant ON med_allergies(tenant_id);
CREATE INDEX IF NOT EXISTS idx_med_allergies_patient
  ON med_allergies(patient_id, is_active);

ALTER TABLE med_allergies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_manage_allergies" ON med_allergies
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM tenant_memberships
      WHERE tenant_id = med_allergies.tenant_id
        AND user_id = auth.uid()
        AND role IN ('owner','practitioner','clinic_admin')
        AND status = 'active'
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM tenant_memberships
      WHERE tenant_id = med_allergies.tenant_id
        AND user_id = auth.uid()
        AND role IN ('owner','practitioner','clinic_admin')
        AND status = 'active'
    )
  );

CREATE POLICY "patient_manage_own_allergies" ON med_allergies
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM med_patients
      WHERE id = med_allergies.patient_id
        AND patient_user_id = auth.uid()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM med_patients
      WHERE id = med_allergies.patient_id
        AND patient_user_id = auth.uid()
    )
  );

CREATE POLICY "service_role_allergies" ON med_allergies
  TO service_role USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS med_allergies_updated_at ON med_allergies;
CREATE TRIGGER med_allergies_updated_at
  BEFORE UPDATE ON med_allergies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── Médicaments actifs ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS med_medications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES med_patients(id) ON DELETE CASCADE,
  prescription_id UUID REFERENCES med_prescriptions(id) ON DELETE SET NULL,

  drug_name TEXT NOT NULL,
  drug_code TEXT,                                     -- ATC ou interne
  dosage TEXT NOT NULL,
  frequency TEXT NOT NULL,
  route TEXT,
  start_date DATE NOT NULL,
  end_date DATE,                                      -- NULL = en cours
  indication TEXT,                                    -- raison de la prescription

  is_active BOOLEAN NOT NULL DEFAULT true,
  is_self_reported BOOLEAN NOT NULL DEFAULT false,    -- déclaré par patient vs prescrit
  notes TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_med_medications_tenant ON med_medications(tenant_id);
CREATE INDEX IF NOT EXISTS idx_med_medications_patient
  ON med_medications(patient_id, is_active);

ALTER TABLE med_medications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_manage_medications" ON med_medications
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM tenant_memberships
      WHERE tenant_id = med_medications.tenant_id
        AND user_id = auth.uid()
        AND role IN ('owner','practitioner','clinic_admin')
        AND status = 'active'
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM tenant_memberships
      WHERE tenant_id = med_medications.tenant_id
        AND user_id = auth.uid()
        AND role IN ('owner','practitioner','clinic_admin')
        AND status = 'active'
    )
  );

CREATE POLICY "patient_read_own_medications" ON med_medications
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM med_patients
      WHERE id = med_medications.patient_id
        AND patient_user_id = auth.uid()
    )
  );

CREATE POLICY "patient_declare_self_medications" ON med_medications
  FOR INSERT WITH CHECK (
    is_self_reported = true
    AND EXISTS (
      SELECT 1 FROM med_patients
      WHERE id = med_medications.patient_id
        AND patient_user_id = auth.uid()
    )
  );

CREATE POLICY "service_role_medications" ON med_medications
  TO service_role USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS med_medications_updated_at ON med_medications;
CREATE TRIGGER med_medications_updated_at
  BEFORE UPDATE ON med_medications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── Problèmes / diagnostics actifs ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS med_problems (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES med_patients(id) ON DELETE CASCADE,

  label TEXT NOT NULL,                                -- ex: "Diabète de type 2"
  icd10_code TEXT,                                    -- ex: "E11.9"
  category TEXT NOT NULL DEFAULT 'chronic'
    CHECK (category IN ('chronic','acute','resolved','symptom','risk_factor')),
  severity TEXT
    CHECK (severity IS NULL OR severity IN ('mild','moderate','severe','critical')),
  onset_date DATE,
  resolved_date DATE,
  notes TEXT,
  diagnosed_by UUID,
  is_active BOOLEAN NOT NULL DEFAULT true,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_med_problems_tenant ON med_problems(tenant_id);
CREATE INDEX IF NOT EXISTS idx_med_problems_patient ON med_problems(patient_id, is_active);

ALTER TABLE med_problems ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_manage_problems" ON med_problems
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM tenant_memberships
      WHERE tenant_id = med_problems.tenant_id
        AND user_id = auth.uid()
        AND role IN ('owner','practitioner','clinic_admin')
        AND status = 'active'
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM tenant_memberships
      WHERE tenant_id = med_problems.tenant_id
        AND user_id = auth.uid()
        AND role IN ('owner','practitioner','clinic_admin')
        AND status = 'active'
    )
  );

CREATE POLICY "patient_read_own_problems" ON med_problems
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM med_patients
      WHERE id = med_problems.patient_id
        AND patient_user_id = auth.uid()
    )
  );

CREATE POLICY "service_role_problems" ON med_problems
  TO service_role USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS med_problems_updated_at ON med_problems;
CREATE TRIGGER med_problems_updated_at
  BEFORE UPDATE ON med_problems
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── Vaccinations ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS med_immunizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES med_patients(id) ON DELETE CASCADE,

  vaccine_name TEXT NOT NULL,                         -- ex: "COVID-19 Pfizer"
  vaccine_code TEXT,                                  -- code CVX ou national
  administered_on DATE NOT NULL,
  dose_number INTEGER,                                -- 1, 2, 3, rappel...
  lot_number TEXT,
  administered_by UUID,
  site TEXT,                                          -- ex: "deltoïde gauche"
  notes TEXT,

  next_due_on DATE,                                   -- rappel attendu
  is_self_reported BOOLEAN NOT NULL DEFAULT false,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_med_immunizations_tenant ON med_immunizations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_med_immunizations_patient
  ON med_immunizations(patient_id, administered_on DESC);

ALTER TABLE med_immunizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_manage_immunizations" ON med_immunizations
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM tenant_memberships
      WHERE tenant_id = med_immunizations.tenant_id
        AND user_id = auth.uid()
        AND role IN ('owner','practitioner','clinic_admin')
        AND status = 'active'
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM tenant_memberships
      WHERE tenant_id = med_immunizations.tenant_id
        AND user_id = auth.uid()
        AND role IN ('owner','practitioner','clinic_admin')
        AND status = 'active'
    )
  );

CREATE POLICY "patient_read_own_immunizations" ON med_immunizations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM med_patients
      WHERE id = med_immunizations.patient_id
        AND patient_user_id = auth.uid()
    )
  );

CREATE POLICY "service_role_immunizations" ON med_immunizations
  TO service_role USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS med_immunizations_updated_at ON med_immunizations;
CREATE TRIGGER med_immunizations_updated_at
  BEFORE UPDATE ON med_immunizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── Résultats de biologie ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS med_lab_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES med_patients(id) ON DELETE CASCADE,
  prescribed_by UUID,                                 -- praticien qui a demandé l'examen

  test_name TEXT NOT NULL,                            -- ex: "Glycémie à jeun"
  test_code TEXT,                                     -- LOINC ou code labo
  panel TEXT,                                         -- ex: "Bilan sanguin", "Bilan thyroïdien"

  taken_at TIMESTAMPTZ NOT NULL,                      -- date du prélèvement
  reported_at TIMESTAMPTZ NOT NULL,                   -- date du résultat
  lab_name TEXT,

  -- Résultat
  value_numeric NUMERIC,
  value_text TEXT,                                    -- pour résultats qualitatifs
  unit TEXT,                                          -- ex: "g/L", "mmol/L"
  reference_low NUMERIC,
  reference_high NUMERIC,
  reference_text TEXT,                                -- ex: "Négatif"
  flag TEXT                                           -- H/L/N (high/low/normal)
    CHECK (flag IS NULL OR flag IN ('N','L','H','LL','HH','A')),

  interpretation TEXT,                                -- commentaire praticien
  attachment_id UUID REFERENCES med_attachments(id) ON DELETE SET NULL,  -- PDF brut

  visible_to_patient BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_med_lab_results_tenant ON med_lab_results(tenant_id);
CREATE INDEX IF NOT EXISTS idx_med_lab_results_patient
  ON med_lab_results(patient_id, taken_at DESC);
CREATE INDEX IF NOT EXISTS idx_med_lab_results_panel
  ON med_lab_results(patient_id, panel, taken_at DESC);

ALTER TABLE med_lab_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_manage_lab_results" ON med_lab_results
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM tenant_memberships
      WHERE tenant_id = med_lab_results.tenant_id
        AND user_id = auth.uid()
        AND role IN ('owner','practitioner','clinic_admin')
        AND status = 'active'
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM tenant_memberships
      WHERE tenant_id = med_lab_results.tenant_id
        AND user_id = auth.uid()
        AND role IN ('owner','practitioner','clinic_admin')
        AND status = 'active'
    )
  );

CREATE POLICY "patient_read_visible_lab_results" ON med_lab_results
  FOR SELECT USING (
    visible_to_patient = true
    AND EXISTS (
      SELECT 1 FROM med_patients
      WHERE id = med_lab_results.patient_id
        AND patient_user_id = auth.uid()
    )
  );

CREATE POLICY "service_role_lab_results" ON med_lab_results
  TO service_role USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS med_lab_results_updated_at ON med_lab_results;
CREATE TRIGGER med_lab_results_updated_at
  BEFORE UPDATE ON med_lab_results
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
