-- Magic links LiveKit single-use : ajout de used_at sur les deux tables de jetons opaques.
-- Le code applicatif fait un UPDATE atomique avec WHERE used_at IS NULL pour garantir
-- qu'un même lien ne peut être échangé qu'une seule fois (race-condition safe).

ALTER TABLE public.live_mobile_camera_tokens
  ADD COLUMN IF NOT EXISTS used_at TIMESTAMPTZ NULL;

CREATE INDEX IF NOT EXISTS idx_live_mobile_camera_tokens_unused
  ON public.live_mobile_camera_tokens(token)
  WHERE used_at IS NULL;

ALTER TABLE public.immersive_live_companion_tokens
  ADD COLUMN IF NOT EXISTS used_at TIMESTAMPTZ NULL;

CREATE INDEX IF NOT EXISTS idx_immersive_companion_tokens_unused
  ON public.immersive_live_companion_tokens(token)
  WHERE used_at IS NULL;

COMMENT ON COLUMN public.live_mobile_camera_tokens.used_at IS
  'Date d''échange du jeton contre un JWT LiveKit. NULL = inutilisé. Marqué côté handler livekit-mobile-camera-exchange via UPDATE WHERE used_at IS NULL.';

COMMENT ON COLUMN public.immersive_live_companion_tokens.used_at IS
  'Date d''échange du jeton contre un JWT LiveKit. NULL = inutilisé. Marqué côté handler immersive-livekit-companion-exchange via UPDATE WHERE used_at IS NULL.';
