-- MEDOS — Invitations d'un PROCHE à une téléconsultation (+ consentement RGPD)
--
-- Un proche (membre de la famille) n'a PAS de compte tenant. Le praticien (host)
-- crée une invitation → lien non devinable (l'id = le token). Avant que le proche
-- puisse rejoindre et voir/échanger des données de santé, le PATIENT doit donner
-- son consentement explicite (RGPD), tracé ici (consent_by / consent_at).
--
-- Garde fail-closed : le token vidéo invité n'est délivré QUE si status='consented'
-- (appliqué côté service). La room LiveKit est la même que la session (externalRef).

CREATE TABLE IF NOT EXISTS med_teleconsult_invites (
  -- L'id EST le token d'invitation (UUID non devinable, porté dans le lien).
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES med_teleconsult_sessions(id) ON DELETE CASCADE,

  display_name TEXT NOT NULL DEFAULT 'Proche',
  relationship TEXT,                                  -- ex: « Conjoint », « Fille »

  status TEXT NOT NULL DEFAULT 'consent_requested'
    CHECK (status IN ('consent_requested','consented','denied','admitted','revoked')),

  -- RGPD : trace du consentement (qui a tranché, quand)
  consent_by UUID,                                    -- auth.uid() du patient
  consent_at TIMESTAMPTZ,

  created_by UUID NOT NULL,                            -- le praticien (host)
  joined_at TIMESTAMPTZ,                               -- 1ʳᵉ délivrance de token invité

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_med_tc_invites_session ON med_teleconsult_invites(session_id);
CREATE INDEX IF NOT EXISTS idx_med_tc_invites_tenant ON med_teleconsult_invites(tenant_id);

ALTER TABLE med_teleconsult_invites ENABLE ROW LEVEL SECURITY;

-- Le backend (service-role) gère tout ; l'accès réel est appliqué dans le service
-- (l'API tourne en service-role, la RLS ci-dessous est défense en profondeur).
CREATE POLICY "service_role_tc_invites" ON med_teleconsult_invites
  TO service_role USING (true) WITH CHECK (true);

-- Staff soignant : gestion des invitations de SON tenant.
CREATE POLICY "staff_manage_tc_invites" ON med_teleconsult_invites
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM tenant_memberships
      WHERE tenant_id = med_teleconsult_invites.tenant_id
        AND user_id = auth.uid()
        AND role IN ('owner','practitioner','clinic_admin','receptionist')
        AND status = 'active'
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM tenant_memberships
      WHERE tenant_id = med_teleconsult_invites.tenant_id
        AND user_id = auth.uid()
        AND role IN ('owner','practitioner','clinic_admin','receptionist')
        AND status = 'active'
    )
  );

-- Patient : lecture des invitations de SES sessions (pour le prompt de consentement).
CREATE POLICY "patient_read_tc_invites" ON med_teleconsult_invites
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM med_teleconsult_sessions s
      JOIN med_patients p ON p.id = s.patient_id
      WHERE s.id = med_teleconsult_invites.session_id
        AND p.patient_user_id = auth.uid()
    )
  );

DROP TRIGGER IF EXISTS med_tc_invites_updated_at ON med_teleconsult_invites;
CREATE TRIGGER med_tc_invites_updated_at
  BEFORE UPDATE ON med_teleconsult_invites
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
