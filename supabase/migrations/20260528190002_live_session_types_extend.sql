-- Étend les valeurs autorisées pour live_sessions.session_type
-- pour supporter tous les verticaux LIRI (MedOS, Mbolo, École, etc.)

-- 1. Supprimer l'ancienne contrainte CHECK
ALTER TABLE live_sessions
  DROP CONSTRAINT IF EXISTS live_sessions_session_type_check;

-- 2. Recréer avec toutes les valeurs LIRI
ALTER TABLE live_sessions
  ADD CONSTRAINT live_sessions_session_type_check
  CHECK (session_type IN (
    'class',        -- Cours en ligne (École)
    'workshop',     -- Atelier
    'webinar',      -- Conférence large audience
    'consultation', -- Rendez-vous médical (MedOS)
    'debate',       -- Débat / panel
    'commercial',   -- Live commerce (Virtuel Mbolo)
    'masterclass'   -- Formation premium
  ));

COMMENT ON COLUMN live_sessions.session_type IS
  'Type de session LIRI : class | workshop | webinar | consultation | debate | commercial | masterclass';
