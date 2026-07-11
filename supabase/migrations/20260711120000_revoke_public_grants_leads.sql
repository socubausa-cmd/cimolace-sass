-- 20260711120000_revoke_public_grants_leads.sql
-- Sécurité (audit VNP #13) : retirer les privilèges DESTRUCTIFS/écriture publique sur les tables
-- de leads/analytics. Les écritures publiques passent EXCLUSIVEMENT par les edges service_role
-- (vnp / vnp-log) qui BYPASSENT grants + RLS → aucun impact fonctionnel. On applique le moindre
-- privilège : `anon` garde SELECT (gaté par RLS), `authenticated` perd DELETE/TRUNCATE.
-- Sans ça, une seule régression RLS donnerait à l'Internet anonyme le pouvoir de TRUNCATE/DELETE
-- des leads (PII). Idempotent (REVOKE d'un privilège absent = no-op).

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON vnp_booking_requests FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON contact_requests    FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON analytics_events     FROM anon;

REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER ON vnp_booking_requests FROM authenticated;
REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER ON contact_requests    FROM authenticated;
REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER ON analytics_events     FROM authenticated;
