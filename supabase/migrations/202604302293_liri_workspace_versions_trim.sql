-- Conserver au plus 30 snapshots par workspace (évite croissance illimitée de liri_course_workspace_versions).

CREATE OR REPLACE FUNCTION public.liri_workspace_versions_trim()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.liri_course_workspace_versions v
  WHERE v.workspace_id = NEW.workspace_id
    AND v.id NOT IN (
      SELECT s.id
      FROM public.liri_course_workspace_versions s
      WHERE s.workspace_id = NEW.workspace_id
      ORDER BY s.created_at DESC
      LIMIT 30
    );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_liri_workspace_versions_trim ON public.liri_course_workspace_versions;
CREATE TRIGGER trg_liri_workspace_versions_trim
  AFTER INSERT ON public.liri_course_workspace_versions
  FOR EACH ROW
  EXECUTE FUNCTION public.liri_workspace_versions_trim();

COMMENT ON FUNCTION public.liri_workspace_versions_trim() IS
  'Après chaque insert de version, supprime les entrées au-delà des 30 plus récentes pour ce workspace.';
