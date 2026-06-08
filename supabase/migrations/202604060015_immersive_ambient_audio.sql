-- Fonds sonores d’ambiance (MP3) pour le studio préparatoire et le live immersif
ALTER TABLE public.immersive_live_sessions
  ADD COLUMN IF NOT EXISTS ambient_tracks_json JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.immersive_live_sessions.ambient_tracks_json IS
  'Liste [{ "url", "label", "volume" }] — atmosphère de salle (boucle / lecture de fond).';

ALTER TABLE public.live_sessions
  ADD COLUMN IF NOT EXISTS ambient_tracks_json JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.live_sessions.ambient_tracks_json IS
  'Idem — live production (studio préparation).';
