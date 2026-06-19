-- Email d'INVITATION à la programmation d'un live : colonne d'idempotence.
-- Miroir de live_sessions.reminder_sent_at (rappel 15 min avant). Utilisée par le
-- worker apps/worker/src/jobs/live-invitations.js : dès qu'un live programmé a des
-- élèves invités (live_session_participants role='student'), un email d'invitation
-- est enfilé une seule fois, puis invitations_sent_at est posé pour ne pas reboucler.

ALTER TABLE public.live_sessions
  ADD COLUMN IF NOT EXISTS invitations_sent_at TIMESTAMPTZ;

-- Index partiel : le worker ne scanne que les lives programmés pas encore notifiés.
CREATE INDEX IF NOT EXISTS idx_live_sessions_invitations_pending
  ON public.live_sessions (scheduled_at)
  WHERE status = 'scheduled' AND invitations_sent_at IS NULL;

-- Backfill anti-spam : les lives DÉJÀ programmés avant ce déploiement sont marqués
-- « invitation envoyée » pour ne PAS déclencher un envoi massif rétroactif au backlog.
-- Seuls les lives créés APRÈS cette migration enverront l'email d'invitation.
UPDATE public.live_sessions
   SET invitations_sent_at = now()
 WHERE status = 'scheduled'
   AND invitations_sent_at IS NULL;
