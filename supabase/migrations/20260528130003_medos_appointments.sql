-- MEDOS — Rendez-vous + disponibilités praticien
--
-- Modèle simple : un praticien définit des plages de disponibilité
-- (récurrentes ou ponctuelles). Les patients voient les créneaux libres et
-- prennent RDV. Une réservation est confirmée puis peut être réalisée /
-- annulée / no-show.

CREATE TABLE IF NOT EXISTS med_practitioner_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  practitioner_id UUID NOT NULL,

  -- Plage récurrente (weekday + hours) OU ponctuelle (specific_date)
  weekday INTEGER CHECK (weekday IS NULL OR weekday BETWEEN 0 AND 6),   -- 0=dim ... 6=sam
  specific_date DATE,                                  -- pour exceptions ou créneaux uniques
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  slot_duration_minutes INTEGER NOT NULL DEFAULT 30,
  buffer_minutes INTEGER NOT NULL DEFAULT 0,           -- pause entre 2 RDV
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Exactement un des deux : weekday OU specific_date
  CHECK ((weekday IS NOT NULL) <> (specific_date IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS idx_med_availability_tenant ON med_practitioner_availability(tenant_id);
CREATE INDEX IF NOT EXISTS idx_med_availability_practitioner
  ON med_practitioner_availability(practitioner_id, is_active);

ALTER TABLE med_practitioner_availability ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_manage_own_availability" ON med_practitioner_availability
  FOR ALL USING (
    practitioner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM tenant_memberships
      WHERE tenant_id = med_practitioner_availability.tenant_id
        AND user_id = auth.uid()
        AND role IN ('owner','clinic_admin','receptionist')
        AND status = 'active'
    )
  ) WITH CHECK (
    practitioner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM tenant_memberships
      WHERE tenant_id = med_practitioner_availability.tenant_id
        AND user_id = auth.uid()
        AND role IN ('owner','clinic_admin','receptionist')
        AND status = 'active'
    )
  );

CREATE POLICY "patient_read_availability" ON med_practitioner_availability
  FOR SELECT USING (
    is_active = true
    AND EXISTS (
      SELECT 1 FROM tenant_memberships
      WHERE tenant_id = med_practitioner_availability.tenant_id
        AND user_id = auth.uid()
        AND role = 'patient'
        AND status = 'active'
    )
  );

CREATE POLICY "service_role_availability" ON med_practitioner_availability
  TO service_role USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS med_availability_updated_at ON med_practitioner_availability;
CREATE TRIGGER med_availability_updated_at
  BEFORE UPDATE ON med_practitioner_availability
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS med_appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES med_patients(id) ON DELETE CASCADE,
  practitioner_id UUID NOT NULL,

  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 30,

  appointment_type TEXT NOT NULL DEFAULT 'in_person'
    CHECK (appointment_type IN ('in_person','teleconsult','phone','home_visit')),
  reason TEXT,                                        -- motif fourni par le patient

  status TEXT NOT NULL DEFAULT 'requested'
    CHECK (status IN (
      'requested','confirmed','rescheduled','cancelled','completed','no_show'
    )),

  -- Notes internes praticien (non visibles patient)
  internal_notes TEXT,

  -- Tarification (optionnelle, peut être gérée par module billing)
  price_cents INTEGER,
  currency TEXT,
  payment_status TEXT
    CHECK (payment_status IS NULL
      OR payment_status IN ('unpaid','pending','paid','refunded','waived')),

  confirmed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  completed_at TIMESTAMPTZ,

  -- Liens vers les ressources créées en aval
  consultation_note_id UUID REFERENCES med_consultation_notes(id) ON DELETE SET NULL,
  teleconsult_session_id UUID,                        -- FK soft (table créée juste après)

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_med_appointments_tenant ON med_appointments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_med_appointments_practitioner
  ON med_appointments(practitioner_id, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_med_appointments_patient
  ON med_appointments(patient_id, scheduled_at DESC);
CREATE INDEX IF NOT EXISTS idx_med_appointments_status
  ON med_appointments(tenant_id, status, scheduled_at);

ALTER TABLE med_appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_manage_appointments" ON med_appointments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM tenant_memberships
      WHERE tenant_id = med_appointments.tenant_id
        AND user_id = auth.uid()
        AND role IN ('owner','practitioner','clinic_admin','receptionist')
        AND status = 'active'
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM tenant_memberships
      WHERE tenant_id = med_appointments.tenant_id
        AND user_id = auth.uid()
        AND role IN ('owner','practitioner','clinic_admin','receptionist')
        AND status = 'active'
    )
  );

CREATE POLICY "patient_read_own_appointments" ON med_appointments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM med_patients
      WHERE id = med_appointments.patient_id
        AND patient_user_id = auth.uid()
    )
  );

CREATE POLICY "patient_request_appointment" ON med_appointments
  FOR INSERT WITH CHECK (
    status = 'requested'
    AND EXISTS (
      SELECT 1 FROM med_patients
      WHERE id = med_appointments.patient_id
        AND patient_user_id = auth.uid()
    )
  );

CREATE POLICY "service_role_appointments" ON med_appointments
  TO service_role USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS med_appointments_updated_at ON med_appointments;
CREATE TRIGGER med_appointments_updated_at
  BEFORE UPDATE ON med_appointments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
