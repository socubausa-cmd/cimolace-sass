-- ─────────────────────────────────────────────────────────────────────────────
-- tenant_invitations — mise à niveau pour les CODES OTP d'accès élève (L5).
-- La table prod était MINIMALE (id, tenant_id, email, role, token, status,
-- created_at) : la migration d'origine (CREATE IF NOT EXISTS) a été sautée car la
-- table préexistait. On ajoute ADDITIVEMENT les colonnes manquantes + on élargit
-- le CHECK role à 'student'/'teacher'/'secretariat'/'patient'. 100 % non destructif.
--
-- Sémantique OTP : `token` = sha256(code 8 car.) — le code lui-même n'est JAMAIS
-- stocké (envoyé par email seulement). `attempts` = compteur d'échecs (lockout à 5).
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE tenant_invitations ADD COLUMN IF NOT EXISTS expires_at  TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days');
ALTER TABLE tenant_invitations ADD COLUMN IF NOT EXISTS attempts    INTEGER     NOT NULL DEFAULT 0;
ALTER TABLE tenant_invitations ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ;
ALTER TABLE tenant_invitations ADD COLUMN IF NOT EXISTS invited_by  TEXT;
ALTER TABLE tenant_invitations ADD COLUMN IF NOT EXISTS updated_at  TIMESTAMPTZ NOT NULL DEFAULT now();

-- Élargit le CHECK role (le nom de contrainte peut varier selon l'historique) :
-- on retire toute contrainte CHECK portant sur `role`, puis on la recrée large.
DO $$
DECLARE cname text;
BEGIN
  SELECT conname INTO cname
  FROM pg_constraint
  WHERE conrelid = 'tenant_invitations'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%role%';
  IF cname IS NOT NULL THEN
    EXECUTE 'ALTER TABLE tenant_invitations DROP CONSTRAINT ' || quote_ident(cname);
  END IF;
  ALTER TABLE tenant_invitations
    ADD CONSTRAINT tenant_invitations_role_check
    CHECK (role IN ('owner','admin','member','viewer','student','teacher','secretariat','patient'));
END $$;

-- Élargit aussi le CHECK status pour tolérer 'sent'/'opened'/'locked' (patron MEDOS + lockout).
DO $$
DECLARE cname text;
BEGIN
  SELECT conname INTO cname
  FROM pg_constraint
  WHERE conrelid = 'tenant_invitations'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%status%';
  IF cname IS NOT NULL THEN
    EXECUTE 'ALTER TABLE tenant_invitations DROP CONSTRAINT ' || quote_ident(cname);
  END IF;
  ALTER TABLE tenant_invitations
    ADD CONSTRAINT tenant_invitations_status_check
    CHECK (status IN ('pending','sent','opened','accepted','expired','cancelled','locked'));
END $$;

CREATE INDEX IF NOT EXISTS idx_tenant_invitations_email_pending
  ON tenant_invitations(tenant_id, lower(email))
  WHERE status IN ('pending','sent','opened');
