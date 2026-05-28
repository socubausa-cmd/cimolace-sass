-- MEDOS audit log : autoriser resource_id NULL pour logger les lectures de
-- collections (GET /med/patients, GET /med/forms) qui ne ciblent pas une
-- ressource précise.
--
-- Sans ça, le MedAuditInterceptor ne peut pas tracer les listes — or RGPD
-- demande de tracer aussi les accès aux index de dossiers.

ALTER TABLE med_audit_log
  ALTER COLUMN resource_id DROP NOT NULL;

-- Index complémentaire pour requêter par action (utile pour rapports RGPD)
CREATE INDEX IF NOT EXISTS idx_med_audit_action
  ON med_audit_log(tenant_id, action, created_at DESC);
