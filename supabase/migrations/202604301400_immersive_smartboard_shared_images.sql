-- Galerie « Images partagées » SmartBoard pour les sessions live immersives (messagerie)
ALTER TABLE public.immersive_live_sessions
  ADD COLUMN IF NOT EXISTS smartboard_shared_images_json JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.immersive_live_sessions.smartboard_shared_images_json IS
  'Tableau [{ "url", "label?" }] — galerie SmartBoard synchronisée hôte / invité.';
