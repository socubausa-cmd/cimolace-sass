-- =========================================================================
-- MEDOS v2 - Bio Digital Twin - Storage PDF + Audit trail bilans
-- =========================================================================
-- Etend med_lab_documents avec les metadonnees du fichier source (PDF/image)
-- conserve dans le bucket Supabase Storage `medos`, prefix `twin-lab/`.
-- Chemin canonique: twin-lab/{tenant_id}/{patient_id}/{doc_id}.{ext}
-- Le service-role API uploade et signe les URLs (TTL 5 min). RLS publique
-- bloque l'acces direct. 100% ASCII, additif, idempotent.
-- =========================================================================

ALTER TABLE med_lab_documents
  ADD COLUMN IF NOT EXISTS storage_path TEXT,
  ADD COLUMN IF NOT EXISTS mime_type TEXT,
  ADD COLUMN IF NOT EXISTS file_size_bytes BIGINT,
  ADD COLUMN IF NOT EXISTS original_filename TEXT,
  ADD COLUMN IF NOT EXISTS page_count INT,
  ADD COLUMN IF NOT EXISTS uploaded_by UUID,
  ADD COLUMN IF NOT EXISTS extraction_path TEXT;

COMMENT ON COLUMN med_lab_documents.storage_path IS 'Chemin dans bucket Supabase Storage `medos`. NULL pour anciens documents texte-only.';
COMMENT ON COLUMN med_lab_documents.mime_type IS 'application/pdf, image/jpeg, image/png, image/webp, image/gif';
COMMENT ON COLUMN med_lab_documents.file_size_bytes IS 'Taille du buffer original en bytes (max 10 Mo).';
COMMENT ON COLUMN med_lab_documents.original_filename IS 'Nom de fichier cote utilisateur (audit trail).';
COMMENT ON COLUMN med_lab_documents.page_count IS 'Nombre de pages pour PDF (NULL pour images).';
COMMENT ON COLUMN med_lab_documents.uploaded_by IS 'auth.users.id de l agent qui a uploade.';
COMMENT ON COLUMN med_lab_documents.extraction_path IS 'pdf_text | image_vision | pasted_text — pour analytics.';

CREATE INDEX IF NOT EXISTS idx_med_lab_documents_storage_path
  ON med_lab_documents(storage_path)
  WHERE storage_path IS NOT NULL;

-- =========================================================================
-- Bucket Storage `medos` deja cree, on s'assure juste qu'il est prive et
-- pose des policies RLS strictes sur le prefix twin-lab/.
--
-- IMPORTANT: la creation/maj du bucket est faite via Management API (cote
-- agent), pas via cette migration (Postgres direct ne peut pas creer un
-- bucket). Cette migration ne touche que les policies RLS de storage.objects.
-- =========================================================================

-- Lecture: seuls les membres du tenant peuvent lister/lire les objets
-- twin-lab/{tenant_id}/... Le service-role bypass tout (utilise pour signed URLs).
DROP POLICY IF EXISTS "twin_lab_tenant_select" ON storage.objects;
CREATE POLICY "twin_lab_tenant_select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'medos'
    AND (storage.foldername(name))[1] = 'twin-lab'
    AND EXISTS (
      SELECT 1 FROM tenant_memberships tm
      WHERE tm.user_id = auth.uid()
        AND tm.tenant_id::text = (storage.foldername(name))[2]
        AND tm.status = 'active'
    )
  );

-- Insertion: meme regle.
DROP POLICY IF EXISTS "twin_lab_tenant_insert" ON storage.objects;
CREATE POLICY "twin_lab_tenant_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'medos'
    AND (storage.foldername(name))[1] = 'twin-lab'
    AND EXISTS (
      SELECT 1 FROM tenant_memberships tm
      WHERE tm.user_id = auth.uid()
        AND tm.tenant_id::text = (storage.foldername(name))[2]
        AND tm.status = 'active'
    )
  );

-- Suppression: meme regle (GDPR/oubli).
DROP POLICY IF EXISTS "twin_lab_tenant_delete" ON storage.objects;
CREATE POLICY "twin_lab_tenant_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'medos'
    AND (storage.foldername(name))[1] = 'twin-lab'
    AND EXISTS (
      SELECT 1 FROM tenant_memberships tm
      WHERE tm.user_id = auth.uid()
        AND tm.tenant_id::text = (storage.foldername(name))[2]
        AND tm.status = 'active'
    )
  );

-- =========================================================================
-- Verification (no-op si tout est OK).
-- =========================================================================
DO $$
DECLARE
  has_storage_path BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'med_lab_documents' AND column_name = 'storage_path'
  ) INTO has_storage_path;
  IF NOT has_storage_path THEN
    RAISE EXCEPTION 'Migration twin lab storage: colonne storage_path manquante';
  END IF;
END $$;
