-- MEDOS téléconsult — invitations enrichies : EMAIL du concerné + MEMBRE du tenant.
--
-- Avant : on n'invitait qu'un « proche » (nom + lien de parenté), lien copié à la
-- main. Désormais on peut :
--   (a) inviter un PROCHE : nom + EMAIL → il reçoit le lien par email ; rejoint
--       APRÈS consentement RGPD du patient (fail-closed inchangé) ;
--   (b) inviter un MEMBRE du tenant (compte existant, soignant) : invited_user_id →
--       admis d'office (status='consented' à la création, secret médical) + email.
--
-- `email_status` trace le résultat de l'envoi (sent | failed | disabled | skipped)
-- pour que l'UI sache s'il faut proposer le lien à copier en repli.

ALTER TABLE med_teleconsult_invites
  ADD COLUMN IF NOT EXISTS invited_email TEXT,
  ADD COLUMN IF NOT EXISTS invited_user_id UUID,
  ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'proche',
  ADD COLUMN IF NOT EXISTS email_status TEXT;

-- CHECK idempotent sur le type d'invité.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'med_tc_invites_kind_chk') THEN
    ALTER TABLE med_teleconsult_invites
      ADD CONSTRAINT med_tc_invites_kind_chk CHECK (kind IN ('proche','member'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_med_tc_invites_user ON med_teleconsult_invites(invited_user_id);
