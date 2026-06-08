-- Compteurs présence live immersif (messagerie LIRI) + trigger sur fin de session
-- Utilisés pour l’indicateur UX live_regularite côté app.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS live_immersive_session_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS live_immersive_last_at timestamptz;

COMMENT ON COLUMN public.profiles.live_immersive_session_count IS
  'Nombre de sessions immersive_live_sessions terminées (status ended) comptabilisées pour ce profil.';
COMMENT ON COLUMN public.profiles.live_immersive_last_at IS
  'Horodatage de la dernière session immersive comptabilisée.';

CREATE OR REPLACE FUNCTION public.bump_profile_live_immersive_stats(p_user_id uuid, p_ended_at timestamptz)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id IS NULL THEN
    RETURN;
  END IF;
  UPDATE public.profiles
  SET
    live_immersive_session_count = COALESCE(live_immersive_session_count, 0) + 1,
    live_immersive_last_at = COALESCE(p_ended_at, now())
  WHERE id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_immersive_live_sessions_bump_regularity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.status = 'ended'
     AND (OLD.status IS DISTINCT FROM 'ended') THEN
    PERFORM public.bump_profile_live_immersive_stats(NEW.host_user_id, NEW.ended_at);
    PERFORM public.bump_profile_live_immersive_stats(NEW.guest_user_id, NEW.ended_at);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_immersive_live_sessions_live_regularity ON public.immersive_live_sessions;
CREATE TRIGGER trg_immersive_live_sessions_live_regularity
  AFTER UPDATE OF status ON public.immersive_live_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_immersive_live_sessions_bump_regularity();
