-- MEDOS — Programmes de soins (parcours patient guidés)
--
-- Un programme = parcours type (ex: "perte de poids 12 semaines", "post-op
-- genou", "gestion du stress"). Composé d'étapes (steps). Assigné à un
-- patient (enrollment) qui en suit la progression.

CREATE TABLE IF NOT EXISTS med_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'custom'
    CHECK (category IN (
      'weight_loss','detox','stress','post_op','chronic_disease',
      'fertility','pregnancy','nutrition','rehab','custom'
    )),
  duration_days INTEGER,                              -- durée totale prévue
  is_template BOOLEAN NOT NULL DEFAULT false,         -- modèle réutilisable
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,                                    -- praticien créateur
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_med_programs_tenant ON med_programs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_med_programs_category ON med_programs(tenant_id, category, is_active);

ALTER TABLE med_programs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_manage_programs" ON med_programs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM tenant_memberships
      WHERE tenant_id = med_programs.tenant_id
        AND user_id = auth.uid()
        AND role IN ('owner','practitioner','clinic_admin')
        AND status = 'active'
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM tenant_memberships
      WHERE tenant_id = med_programs.tenant_id
        AND user_id = auth.uid()
        AND role IN ('owner','practitioner','clinic_admin')
        AND status = 'active'
    )
  );

-- Policy patient (lecture des programmes assignés) → définie en fin de
-- fichier, après création de med_program_enrollments dont elle dépend.

CREATE POLICY "service_role_programs" ON med_programs
  TO service_role USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS med_programs_updated_at ON med_programs;
CREATE TRIGGER med_programs_updated_at
  BEFORE UPDATE ON med_programs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS med_program_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  program_id UUID NOT NULL REFERENCES med_programs(id) ON DELETE CASCADE,

  position INTEGER NOT NULL DEFAULT 0,
  title TEXT NOT NULL,
  description TEXT,
  step_type TEXT NOT NULL DEFAULT 'task'
    CHECK (step_type IN ('task','form','measurement','content','appointment','reminder')),
  due_after_days INTEGER NOT NULL DEFAULT 0,          -- jours après inscription
  -- Référence optionnelle vers un autre objet MEDOS
  linked_form_id UUID REFERENCES med_medical_forms(id) ON DELETE SET NULL,
  content_md TEXT,                                    -- markdown pour step_type='content'
  is_required BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_med_program_steps_tenant ON med_program_steps(tenant_id);
CREATE INDEX IF NOT EXISTS idx_med_program_steps_program ON med_program_steps(program_id, position);

ALTER TABLE med_program_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "steps_inherit_program_access" ON med_program_steps
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM tenant_memberships
      WHERE tenant_id = med_program_steps.tenant_id
        AND user_id = auth.uid()
        AND role IN ('owner','practitioner','clinic_admin')
        AND status = 'active'
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM tenant_memberships
      WHERE tenant_id = med_program_steps.tenant_id
        AND user_id = auth.uid()
        AND role IN ('owner','practitioner','clinic_admin')
        AND status = 'active'
    )
  );

-- Policy patient (lecture des steps des programmes assignés) → définie en
-- fin de fichier, après création de med_program_enrollments.

CREATE POLICY "service_role_program_steps" ON med_program_steps
  TO service_role USING (true) WITH CHECK (true);

-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS med_program_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  program_id UUID NOT NULL REFERENCES med_programs(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES med_patients(id) ON DELETE CASCADE,
  enrolled_by UUID NOT NULL,                          -- practitioner qui a inscrit
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','paused','completed','abandoned')),
  current_step_position INTEGER NOT NULL DEFAULT 0,
  completed_at TIMESTAMPTZ,
  progress_percent INTEGER NOT NULL DEFAULT 0
    CHECK (progress_percent BETWEEN 0 AND 100),
  notes TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (program_id, patient_id)
);

CREATE INDEX IF NOT EXISTS idx_med_enrollments_tenant ON med_program_enrollments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_med_enrollments_patient ON med_program_enrollments(patient_id, status);

ALTER TABLE med_program_enrollments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_manage_enrollments" ON med_program_enrollments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM tenant_memberships
      WHERE tenant_id = med_program_enrollments.tenant_id
        AND user_id = auth.uid()
        AND role IN ('owner','practitioner','clinic_admin')
        AND status = 'active'
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM tenant_memberships
      WHERE tenant_id = med_program_enrollments.tenant_id
        AND user_id = auth.uid()
        AND role IN ('owner','practitioner','clinic_admin')
        AND status = 'active'
    )
  );

CREATE POLICY "patient_read_own_enrollments" ON med_program_enrollments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM med_patients
      WHERE id = med_program_enrollments.patient_id
        AND patient_user_id = auth.uid()
    )
  );

CREATE POLICY "service_role_enrollments" ON med_program_enrollments
  TO service_role USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS med_enrollments_updated_at ON med_program_enrollments;
CREATE TRIGGER med_enrollments_updated_at
  BEFORE UPDATE ON med_program_enrollments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ──────────────────────────────────────────────────────────────────────────
-- Policies patient pour med_programs et med_program_steps
-- (définies ici car elles référencent med_program_enrollments créé ci-dessus)

CREATE POLICY "patient_read_assigned_programs" ON med_programs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM med_program_enrollments e
      JOIN med_patients pat ON pat.id = e.patient_id
      WHERE e.program_id = med_programs.id
        AND pat.patient_user_id = auth.uid()
    )
  );

CREATE POLICY "patient_read_steps_of_own_programs" ON med_program_steps
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM med_program_enrollments e
      JOIN med_patients pat ON pat.id = e.patient_id
      WHERE e.program_id = med_program_steps.program_id
        AND pat.patient_user_id = auth.uid()
    )
  );
