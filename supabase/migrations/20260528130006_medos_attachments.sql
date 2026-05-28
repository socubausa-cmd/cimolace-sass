-- MEDOS — Pièces jointes / fichiers médicaux
--
-- Stocke les métadonnées des fichiers (PDF, images, audio, vidéo). Le
-- binaire vit dans Supabase Storage (ou S3 selon config). Référence
-- générique via owner_type / owner_id pour pouvoir attacher à un patient,
-- une note, une prescription, un message, etc.

CREATE TABLE IF NOT EXISTS med_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Référence polymorphique vers l'entité MEDOS propriétaire
  owner_type TEXT NOT NULL
    CHECK (owner_type IN (
      'patient','note','prescription','message','program',
      'lab_result','health_entry','form_response'
    )),
  owner_id UUID NOT NULL,

  -- Patient concerné (toujours rempli, sert aux contrôles d'accès patient)
  patient_id UUID NOT NULL REFERENCES med_patients(id) ON DELETE CASCADE,

  -- Métadonnées fichier
  file_name TEXT NOT NULL,
  file_size_bytes BIGINT NOT NULL,
  mime_type TEXT NOT NULL,
  checksum_sha256 TEXT,                               -- pour intégrité

  -- Stockage
  storage_bucket TEXT NOT NULL DEFAULT 'medos',       -- bucket Supabase Storage
  storage_path TEXT NOT NULL,                         -- chemin dans le bucket

  -- Sécurité / accès
  is_phi BOOLEAN NOT NULL DEFAULT true,               -- Protected Health Info ?
  visible_to_patient BOOLEAN NOT NULL DEFAULT false,  -- partagé avec le patient ?
  uploaded_by UUID NOT NULL,
  uploaded_by_role TEXT NOT NULL
    CHECK (uploaded_by_role IN ('practitioner','clinic_admin','receptionist','patient','system')),

  -- Catégorisation médicale (pour filtrage)
  category TEXT
    CHECK (category IS NULL OR category IN (
      'lab_result','imaging','prescription_pdf','consent_pdf',
      'identity_doc','insurance','meal_photo','self_exam','other'
    )),
  description TEXT,
  taken_at TIMESTAMPTZ,                               -- date de l'acte (différente de upload)

  -- Cycle de vie
  is_archived BOOLEAN NOT NULL DEFAULT false,
  archived_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,                             -- soft delete (RGPD)

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_med_attachments_tenant ON med_attachments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_med_attachments_owner
  ON med_attachments(owner_type, owner_id);
CREATE INDEX IF NOT EXISTS idx_med_attachments_patient
  ON med_attachments(patient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_med_attachments_category
  ON med_attachments(patient_id, category)
  WHERE deleted_at IS NULL;

ALTER TABLE med_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_manage_attachments" ON med_attachments
  FOR ALL USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM tenant_memberships
      WHERE tenant_id = med_attachments.tenant_id
        AND user_id = auth.uid()
        AND role IN ('owner','practitioner','clinic_admin','receptionist')
        AND status = 'active'
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM tenant_memberships
      WHERE tenant_id = med_attachments.tenant_id
        AND user_id = auth.uid()
        AND role IN ('owner','practitioner','clinic_admin','receptionist')
        AND status = 'active'
    )
  );

CREATE POLICY "patient_read_shared_attachments" ON med_attachments
  FOR SELECT USING (
    deleted_at IS NULL
    AND visible_to_patient = true
    AND EXISTS (
      SELECT 1 FROM med_patients
      WHERE id = med_attachments.patient_id
        AND patient_user_id = auth.uid()
    )
  );

CREATE POLICY "patient_upload_own_attachments" ON med_attachments
  FOR INSERT WITH CHECK (
    uploaded_by_role = 'patient'
    AND uploaded_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM med_patients
      WHERE id = med_attachments.patient_id
        AND patient_user_id = auth.uid()
    )
  );

CREATE POLICY "service_role_attachments" ON med_attachments
  TO service_role USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS med_attachments_updated_at ON med_attachments;
CREATE TRIGGER med_attachments_updated_at
  BEFORE UPDATE ON med_attachments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
