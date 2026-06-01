-- Liens QR / téléphone pour rejoindre une session immersive LiveKit sans compte (Cam 2 + écran)
CREATE TABLE IF NOT EXISTS public.immersive_live_companion_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  live_session_id UUID NOT NULL REFERENCES public.immersive_live_sessions(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_immersive_companion_tokens_session
  ON public.immersive_live_companion_tokens(live_session_id);

CREATE INDEX IF NOT EXISTS idx_immersive_companion_tokens_expires
  ON public.immersive_live_companion_tokens(expires_at);

ALTER TABLE public.immersive_live_companion_tokens ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.immersive_live_companion_tokens IS
  'Jetons opaques pour /live/phone — échange serveur contre JWT LiveKit (identity companion_*). Accès client refusé ; service_role uniquement.';
