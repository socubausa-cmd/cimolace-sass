-- email_queue.retry_count — permet au worker de RÉESSAYER un envoi Resend en
-- échec transitoire (réseau, 429, 5xx) au lieu de le marquer 'failed' définitivement.
-- 100 % additif.
ALTER TABLE email_queue ADD COLUMN IF NOT EXISTS retry_count INTEGER NOT NULL DEFAULT 0;
