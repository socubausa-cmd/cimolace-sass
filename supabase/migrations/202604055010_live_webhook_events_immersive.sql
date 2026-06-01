-- ─── Phase 7 — Webhook LiveKit immersif ────────────────────────────────────
-- Étend live_webhook_events pour référencer aussi immersive_live_sessions,
-- et ajoute une colonne session_type pour distinguer les deux systèmes.

ALTER TABLE public.live_webhook_events
  ADD COLUMN IF NOT EXISTS immersive_live_session_id UUID
    REFERENCES public.immersive_live_sessions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS session_type TEXT DEFAULT 'production'
    CHECK (session_type IN ('production', 'immersive'));

CREATE INDEX IF NOT EXISTS idx_live_webhook_events_immersive_session
  ON public.live_webhook_events(immersive_live_session_id)
  WHERE immersive_live_session_id IS NOT NULL;

-- Vue pratique pour le monitoring : sessions immersives fantômes
-- (active depuis plus d'1h sans activité webhook récente)
CREATE OR REPLACE VIEW public.stale_immersive_sessions AS
  SELECT
    ils.id,
    ils.conversation_key,
    ils.host_user_id,
    ils.status,
    ils.started_at,
    ils.updated_at,
    EXTRACT(EPOCH FROM (now() - COALESCE(ils.started_at, ils.created_at))) / 3600 AS hours_active
  FROM public.immersive_live_sessions ils
  WHERE ils.status = 'active'
    AND COALESCE(ils.started_at, ils.created_at) < now() - INTERVAL '2 hours';

COMMENT ON VIEW public.stale_immersive_sessions IS
  'Sessions immersives actives depuis plus de 2h — candidates à la clôture automatique.';
