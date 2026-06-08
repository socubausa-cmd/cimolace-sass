-- Nettoyage TTL des segments vision temporaires (Storage).
-- À planifier côté Supabase : Database → Cron ou Edge planifiée appelant la fonction RPC ou liri-vision-temp-sweep.

CREATE OR REPLACE FUNCTION public.sweep_liri_vision_temp_objects()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = storage, public
AS $$
DECLARE
  n integer;
BEGIN
  DELETE FROM storage.objects
  WHERE bucket_id = 'liri-vision-temp'
    AND created_at < now() - interval '7 days';
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN COALESCE(n, 0);
END;
$$;

COMMENT ON FUNCTION public.sweep_liri_vision_temp_objects() IS
  'Supprime les objets Storage du bucket liri-vision-temp plus vieux que 7 jours. Réservé service_role / tâches planifiées.';

REVOKE ALL ON FUNCTION public.sweep_liri_vision_temp_objects() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sweep_liri_vision_temp_objects() TO service_role;
