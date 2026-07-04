-- Fermeture automatique des téléconsults abandonnées (hôte parti sans « Terminer »).
-- Le sweep backend (TeleconsultService.sweepAbandoned, cron 2 min) arme ce chrono
-- à la première détection d'absence de l'hôte dans la room LiveKit, le remet à
-- NULL si l'hôte revient, et termine la session d'office (ended_reason='timeout')
-- après 5 min d'absence continue — les invités voient « Consultation terminée ».
ALTER TABLE med_teleconsult_sessions
  ADD COLUMN IF NOT EXISTS host_absent_since TIMESTAMPTZ;
