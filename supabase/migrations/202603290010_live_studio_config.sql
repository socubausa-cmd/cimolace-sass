-- ============================================================
-- PRORASCIENCE — Studio Live : config étendue
-- ============================================================

-- Colonne config JSONB pour toutes les options du wizard
ALTER TABLE public.live_sessions ADD COLUMN IF NOT EXISTS config JSONB DEFAULT '{}';

-- Statut draft pour brouillons
DO $$
BEGIN
  ALTER TABLE public.live_sessions DROP CONSTRAINT IF EXISTS live_sessions_status_check;
  ALTER TABLE public.live_sessions ADD CONSTRAINT live_sessions_status_check
    CHECK (status IN ('draft', 'scheduled', 'live', 'ended', 'cancelled'));
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Colonnes optionnelles pour compatibilité
ALTER TABLE public.live_sessions ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.live_sessions ADD COLUMN IF NOT EXISTS cover_image_url TEXT;
ALTER TABLE public.live_sessions ADD COLUMN IF NOT EXISTS duration_minutes INT DEFAULT 60;

CREATE INDEX IF NOT EXISTS idx_live_sessions_status_draft ON public.live_sessions(status) WHERE status = 'draft';

COMMENT ON COLUMN public.live_sessions.config IS 'Configuration étendue du Studio Live (sécurité, salle virtuelle, IA, etc.)';
