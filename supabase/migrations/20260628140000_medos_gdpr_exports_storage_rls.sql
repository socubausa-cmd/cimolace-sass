-- =========================================================================
-- MEDOS RGPD - RLS Storage pour les exports RGPD (Article 20).
-- =========================================================================
-- Le worker (apps/worker/src/jobs/gdpr-export.ts) genere les exports RGPD au
-- format JSON (+ PDF recapitulatif) et les uploade dans le bucket prive deja
-- existant `medos`, sous le prefix:
--     gdpr-exports/{tenant_id}/{patient_id}/{export_id}.{json|pdf}
--
-- Le worker utilise le service-role, qui BYPASSE la RLS (upload + signed URL
-- 7 jours). Le patient telecharge ensuite via l'URL signee (file_url stocke
-- dans med_gdpr_exports). Ces policies ne sont donc PAS necessaires au bon
-- fonctionnement, mais ajoutent une defense-en-profondeur si un membre du
-- tenant tentait de lister/lire ces objets directement (authenticated).
--
-- Le bucket `medos` est deja cree (cf. twin lab docs). Cette migration ne
-- touche QUE les policies RLS de storage.objects pour le prefix gdpr-exports/.
-- 100% additif, idempotent. NON APPLIQUEE (a appliquer cote DB par l'owner).
-- =========================================================================

-- Lecture: seuls les membres actifs du tenant peuvent lire les exports de leur
-- tenant. Le patient lui-meme passe par l'URL signee (service-role), pas par
-- cette policy. Le service-role bypass tout.
DROP POLICY IF EXISTS "gdpr_exports_tenant_select" ON storage.objects;
CREATE POLICY "gdpr_exports_tenant_select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'medos'
    AND (storage.foldername(name))[1] = 'gdpr-exports'
    AND EXISTS (
      SELECT 1 FROM tenant_memberships tm
      WHERE tm.user_id = auth.uid()
        AND tm.tenant_id::text = (storage.foldername(name))[2]
        AND tm.status = 'active'
        AND tm.role IN ('owner', 'clinic_admin')
    )
  );

-- Pas de policy INSERT/UPDATE/DELETE pour authenticated: la generation est
-- reservee au worker (service-role). Un client ne doit jamais ecrire un
-- export RGPD lui-meme.

-- =========================================================================
-- Verification (no-op si OK).
-- =========================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'gdpr_exports_tenant_select'
  ) THEN
    RAISE EXCEPTION 'Policy gdpr_exports_tenant_select manquante';
  END IF;
END $$;
