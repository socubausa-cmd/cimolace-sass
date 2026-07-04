-- Fiabilise la salle d'attente LIRI pour les sessions créées avec teacher_id
-- (legacy) ou host_user_id (modèle courant), et clôt toute attente à la fin.

CREATE OR REPLACE FUNCTION public.internal_live_session_teacher_id(p_session_id uuid)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
SET row_security = off
STABLE
AS $$
  SELECT COALESCE(teacher_id, host_user_id)
  FROM public.live_sessions
  WHERE id = p_session_id;
$$;

REVOKE ALL ON FUNCTION public.internal_live_session_teacher_id(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.internal_live_session_teacher_id(uuid)
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.close_live_waiting_room_on_session_end()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
BEGIN
  IF NEW.status IN ('ended', 'cancelled')
     AND OLD.status IS DISTINCT FROM NEW.status THEN
    UPDATE public.live_waiting_room_entries
    SET status = 'left'
    WHERE live_session_id = NEW.id
      AND status IN ('waiting', 'admitted');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_close_live_waiting_room_on_session_end
  ON public.live_sessions;
CREATE TRIGGER trg_close_live_waiting_room_on_session_end
AFTER UPDATE OF status ON public.live_sessions
FOR EACH ROW
EXECUTE FUNCTION public.close_live_waiting_room_on_session_end();
