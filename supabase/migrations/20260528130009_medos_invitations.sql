-- MEDOS — Invitations patient
--
-- Un praticien crée un dossier patient SANS user Supabase (le patient n'a
-- pas encore de compte). On génère un token d'invitation à envoyer par
-- email/SMS. Le patient clique, crée son compte, on lie patient_user_id.

CREATE TABLE IF NOT EXISTS med_patient_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES med_patients(id) ON DELETE CASCADE,

  -- Token d'invitation (hash stocké, valeur brute envoyée une fois)
  token_hash TEXT NOT NULL UNIQUE,
  token_prefix TEXT NOT NULL,                         -- ex: "inv_zahir_a1b2" affiché à l'opérateur

  -- Cible
  invited_email TEXT,
  invited_phone TEXT,
  invited_name TEXT NOT NULL,

  -- Cycle de vie
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','sent','opened','accepted','expired','cancelled')),
  sent_at TIMESTAMPTZ,
  sent_via TEXT
    CHECK (sent_via IS NULL OR sent_via IN ('email','sms','whatsapp','manual')),
  opened_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  accepted_by_user_id UUID,                           -- user_id Supabase créé à l'acceptation
  cancelled_at TIMESTAMPTZ,

  expires_at TIMESTAMPTZ NOT NULL,                    -- typiquement +7 jours
  resent_count INTEGER NOT NULL DEFAULT 0,
  last_resent_at TIMESTAMPTZ,

  created_by UUID NOT NULL,
  custom_message TEXT,                                -- message du praticien

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Au moins un canal de contact
  CHECK (invited_email IS NOT NULL OR invited_phone IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_med_invitations_tenant ON med_patient_invitations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_med_invitations_patient ON med_patient_invitations(patient_id);
CREATE INDEX IF NOT EXISTS idx_med_invitations_status
  ON med_patient_invitations(tenant_id, status, expires_at)
  WHERE status IN ('pending','sent','opened');
CREATE INDEX IF NOT EXISTS idx_med_invitations_hash ON med_patient_invitations(token_hash);

ALTER TABLE med_patient_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_manage_invitations" ON med_patient_invitations
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM tenant_memberships
      WHERE tenant_id = med_patient_invitations.tenant_id
        AND user_id = auth.uid()
        AND role IN ('owner','practitioner','clinic_admin','receptionist')
        AND status = 'active'
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM tenant_memberships
      WHERE tenant_id = med_patient_invitations.tenant_id
        AND user_id = auth.uid()
        AND role IN ('owner','practitioner','clinic_admin','receptionist')
        AND status = 'active'
    )
  );

-- Le service_role gère l'acceptation (lookup token → mise à jour)
CREATE POLICY "service_role_invitations" ON med_patient_invitations
  TO service_role USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS med_invitations_updated_at ON med_patient_invitations;
CREATE TRIGGER med_invitations_updated_at
  BEFORE UPDATE ON med_patient_invitations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
