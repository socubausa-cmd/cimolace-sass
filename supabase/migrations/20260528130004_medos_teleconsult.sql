-- MEDOS — Sessions de téléconsultation (LiveKit)
--
-- Une session = un appel vidéo lié à un appointment. Track les join/leave,
-- l'enregistrement (si activé et consenti), la qualité, les éventuels
-- problèmes techniques. Le room LiveKit lui-même est créé applicativement.

CREATE TABLE IF NOT EXISTS med_teleconsult_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES med_appointments(id) ON DELETE SET NULL,
  patient_id UUID NOT NULL REFERENCES med_patients(id) ON DELETE CASCADE,
  practitioner_id UUID NOT NULL,

  -- LiveKit room metadata
  livekit_room_name TEXT NOT NULL,                    -- ex: "tenant_zahir_room_42"
  livekit_room_sid TEXT,                              -- SID retourné par LiveKit

  status TEXT NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled','active','ended','cancelled','failed')),

  practitioner_joined_at TIMESTAMPTZ,
  practitioner_left_at TIMESTAMPTZ,
  patient_joined_at TIMESTAMPTZ,
  patient_left_at TIMESTAMPTZ,

  duration_seconds INTEGER,                           -- calculé à la fin

  -- Enregistrement (off par défaut, consentement explicite requis)
  recording_consented BOOLEAN NOT NULL DEFAULT false,
  recording_url TEXT,
  recording_duration_seconds INTEGER,

  -- Qualité technique
  connection_quality TEXT
    CHECK (connection_quality IS NULL
      OR connection_quality IN ('good','degraded','poor','unknown')),
  technical_issues TEXT,

  ended_reason TEXT
    CHECK (ended_reason IS NULL
      OR ended_reason IN ('normal','timeout','network','manual','error')),

  -- Note rapide post-consultation (saisie immédiate, peut alimenter une vraie note)
  quick_note TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_med_teleconsult_tenant ON med_teleconsult_sessions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_med_teleconsult_appointment ON med_teleconsult_sessions(appointment_id);
CREATE INDEX IF NOT EXISTS idx_med_teleconsult_room ON med_teleconsult_sessions(livekit_room_name);

ALTER TABLE med_teleconsult_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_manage_teleconsult" ON med_teleconsult_sessions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM tenant_memberships
      WHERE tenant_id = med_teleconsult_sessions.tenant_id
        AND user_id = auth.uid()
        AND role IN ('owner','practitioner','clinic_admin','receptionist')
        AND status = 'active'
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM tenant_memberships
      WHERE tenant_id = med_teleconsult_sessions.tenant_id
        AND user_id = auth.uid()
        AND role IN ('owner','practitioner','clinic_admin','receptionist')
        AND status = 'active'
    )
  );

CREATE POLICY "patient_read_own_teleconsult" ON med_teleconsult_sessions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM med_patients
      WHERE id = med_teleconsult_sessions.patient_id
        AND patient_user_id = auth.uid()
    )
  );

CREATE POLICY "service_role_teleconsult" ON med_teleconsult_sessions
  TO service_role USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS med_teleconsult_updated_at ON med_teleconsult_sessions;
CREATE TRIGGER med_teleconsult_updated_at
  BEFORE UPDATE ON med_teleconsult_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
