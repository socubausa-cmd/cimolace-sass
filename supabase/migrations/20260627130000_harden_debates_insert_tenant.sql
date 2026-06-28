-- ════════════════════════════════════════════════════════════════════
-- DURCISSEMENT INSERT débats : un user ne peut créer un débat QUE dans son
-- tenant (empêche de taguer un débat au tenant d'un autre = pollution/spoof).
-- Avant : `debates_insert_auth` WITH CHECK (true). Le client ne pose NI tenant_id
-- NI created_by → trigger les remplit depuis auth.uid() ; WITH CHECK valide le scope.
-- Appliqué prod 2026-06-27 (run-sql.js) ; ce fichier = trace versionnée.
-- Complète 20260627120000_fix_rls_cross_tenant_forum_debates.sql (lecture scopée).
-- ════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION debates_fill_owner_tenant() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.created_by IS NULL THEN NEW.created_by := auth.uid(); END IF;
  IF NEW.tenant_id IS NULL THEN
    SELECT m.tenant_id INTO NEW.tenant_id FROM tenant_memberships m
      WHERE m.user_id = auth.uid() AND m.status = 'active' LIMIT 1;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_debates_fill_owner_tenant ON debates;
CREATE TRIGGER trg_debates_fill_owner_tenant BEFORE INSERT ON debates
  FOR EACH ROW EXECUTE FUNCTION debates_fill_owner_tenant();

DROP POLICY IF EXISTS debates_insert_auth ON debates;
CREATE POLICY debates_insert_auth ON debates FOR INSERT
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM tenant_memberships WHERE user_id = auth.uid() AND status = 'active'));
