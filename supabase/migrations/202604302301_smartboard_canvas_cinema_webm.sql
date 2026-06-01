-- Clips cinéma pédagogique (WebM) — après création du bucket `smartboard-canvas` (202604302280).
-- Chemins : {auth.uid()}/cinema-{uuid}.webm — mêmes politiques RLS que les images.

UPDATE storage.buckets
SET
  file_size_limit = GREATEST(COALESCE(file_size_limit, 0), 52428800),
  allowed_mime_types = ARRAY[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/svg+xml',
    'video/webm'
  ]::text[]
WHERE id = 'smartboard-canvas';
