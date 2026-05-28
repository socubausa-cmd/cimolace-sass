-- MEDOS — Messagerie sécurisée patient ↔ praticien
--
-- Modèle thread (conversation entre 1 patient et 1+ praticiens) +
-- messages append-only. Pas de suppression de message (audit médical).
-- Le patient peut joindre un fichier (référence dans med_attachments).

CREATE TABLE IF NOT EXISTS med_message_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES med_patients(id) ON DELETE CASCADE,

  subject TEXT,                                       -- objet libre
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','awaiting_patient','awaiting_staff','closed','archived')),
  priority TEXT NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('low','normal','high','urgent')),

  last_message_at TIMESTAMPTZ,
  last_message_by_role TEXT
    CHECK (last_message_by_role IS NULL
      OR last_message_by_role IN ('patient','practitioner','clinic_admin','system')),

  -- Assignation (1 praticien référent recommandé mais multi possible via med_thread_participants — non implémenté ici)
  assigned_practitioner_id UUID,

  closed_at TIMESTAMPTZ,
  closed_reason TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_med_threads_tenant ON med_message_threads(tenant_id);
CREATE INDEX IF NOT EXISTS idx_med_threads_patient
  ON med_message_threads(patient_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_med_threads_status
  ON med_message_threads(tenant_id, status, last_message_at DESC);

ALTER TABLE med_message_threads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_manage_threads" ON med_message_threads
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM tenant_memberships
      WHERE tenant_id = med_message_threads.tenant_id
        AND user_id = auth.uid()
        AND role IN ('owner','practitioner','clinic_admin','receptionist')
        AND status = 'active'
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM tenant_memberships
      WHERE tenant_id = med_message_threads.tenant_id
        AND user_id = auth.uid()
        AND role IN ('owner','practitioner','clinic_admin','receptionist')
        AND status = 'active'
    )
  );

CREATE POLICY "patient_read_own_threads" ON med_message_threads
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM med_patients
      WHERE id = med_message_threads.patient_id
        AND patient_user_id = auth.uid()
    )
  );

CREATE POLICY "patient_create_own_thread" ON med_message_threads
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM med_patients
      WHERE id = med_message_threads.patient_id
        AND patient_user_id = auth.uid()
    )
  );

CREATE POLICY "service_role_threads" ON med_message_threads
  TO service_role USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS med_threads_updated_at ON med_message_threads;
CREATE TRIGGER med_threads_updated_at
  BEFORE UPDATE ON med_message_threads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS med_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  thread_id UUID NOT NULL REFERENCES med_message_threads(id) ON DELETE CASCADE,

  sender_id UUID NOT NULL,
  sender_role TEXT NOT NULL
    CHECK (sender_role IN ('patient','practitioner','clinic_admin','receptionist','system')),

  body TEXT NOT NULL,
  attachment_ids UUID[] DEFAULT '{}',                 -- IDs dans med_attachments

  read_at TIMESTAMPTZ,
  read_by_user_id UUID,

  -- Pour les messages système (notifications RDV, rappels)
  is_system BOOLEAN NOT NULL DEFAULT false,
  system_event TEXT,                                  -- ex: 'appointment_confirmed', 'prescription_ready'
  system_meta JSONB,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_med_messages_tenant ON med_messages(tenant_id);
CREATE INDEX IF NOT EXISTS idx_med_messages_thread
  ON med_messages(thread_id, created_at);

ALTER TABLE med_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_read_messages" ON med_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM tenant_memberships
      WHERE tenant_id = med_messages.tenant_id
        AND user_id = auth.uid()
        AND role IN ('owner','practitioner','clinic_admin','receptionist')
        AND status = 'active'
    )
  );

CREATE POLICY "staff_send_messages" ON med_messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM tenant_memberships
      WHERE tenant_id = med_messages.tenant_id
        AND user_id = auth.uid()
        AND role IN ('owner','practitioner','clinic_admin','receptionist')
        AND status = 'active'
    )
  );

CREATE POLICY "patient_read_own_messages" ON med_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM med_message_threads t
      JOIN med_patients pat ON pat.id = t.patient_id
      WHERE t.id = med_messages.thread_id
        AND pat.patient_user_id = auth.uid()
    )
  );

CREATE POLICY "patient_send_own_messages" ON med_messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid()
    AND sender_role = 'patient'
    AND EXISTS (
      SELECT 1 FROM med_message_threads t
      JOIN med_patients pat ON pat.id = t.patient_id
      WHERE t.id = med_messages.thread_id
        AND pat.patient_user_id = auth.uid()
    )
  );

CREATE POLICY "service_role_messages" ON med_messages
  TO service_role USING (true) WITH CHECK (true);

-- No UPDATE/DELETE policy : append-only.
