-- Jetons opaques pour caméra mobile (QR) — session classroom LIRI → /live/mobile-camera
CREATE TABLE IF NOT EXISTS public.live_mobile_camera_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  live_session_id UUID NOT NULL REFERENCES public.live_sessions(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_live_mobile_camera_tokens_session
  ON public.live_mobile_camera_tokens(live_session_id);

CREATE INDEX IF NOT EXISTS idx_live_mobile_camera_tokens_expires
  ON public.live_mobile_camera_tokens(expires_at);

ALTER TABLE public.live_mobile_camera_tokens ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.live_mobile_camera_tokens IS
  'Jetons opaques pour /live/mobile-camera — échange Netlify contre JWT LiveKit (identity liri_mobile_*). Accès client refusé ; service_role uniquement.';
