ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

UPDATE tenants
SET metadata = jsonb_set(
  COALESCE(metadata, '{}'::jsonb),
  '{branding}',
  COALESCE(metadata->'branding', '{}'::jsonb),
  true
)
WHERE metadata IS NULL OR metadata->'branding' IS NULL;
