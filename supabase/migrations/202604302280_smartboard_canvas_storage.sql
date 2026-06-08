-- Bucket Storage : images du studio SmartBoard (Capture Studio / canevas 1037×750).
-- Chemins : {auth.uid()}/{uuid}.{ext} — lecture publique (URL dans slides), écriture limitée au propriétaire.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
SELECT
  'smartboard-canvas',
  'smartboard-canvas',
  true,
  10485760,
  ARRAY[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/svg+xml'
  ]::text[]
WHERE NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'smartboard-canvas');

-- Lecture : bucket public — nécessaire pour afficher les <img> sans jeton (slides, enregistrement)
DROP POLICY IF EXISTS "smartboard_canvas_select_all" ON storage.objects;
CREATE POLICY "smartboard_canvas_select_all"
ON storage.objects
FOR SELECT
USING (bucket_id = 'smartboard-canvas');

DROP POLICY IF EXISTS "smartboard_canvas_insert_own" ON storage.objects;
CREATE POLICY "smartboard_canvas_insert_own"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'smartboard-canvas'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "smartboard_canvas_update_own" ON storage.objects;
CREATE POLICY "smartboard_canvas_update_own"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'smartboard-canvas'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'smartboard-canvas'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "smartboard_canvas_delete_own" ON storage.objects;
CREATE POLICY "smartboard_canvas_delete_own"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'smartboard-canvas'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
