-- 20260714150000_billing_webhook_events_grants.sql
-- Correctif revue chaînon (#11) : la table de dédup avait RLS ON sans GRANT → si le
-- client billing n'est pas service_role, l'INSERT de claim échoue → fail-open →
-- dédup neutralisée → risque de double provisioning. On calque billing_webhook_dlq :
-- service_role uniquement, jamais exposée au public.
REVOKE ALL ON public.billing_webhook_events FROM PUBLIC;
GRANT SELECT, INSERT, DELETE ON public.billing_webhook_events TO service_role;
