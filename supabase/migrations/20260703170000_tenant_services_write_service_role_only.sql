-- ─────────────────────────────────────────────────────────────────────────────
-- SÉCURITÉ — Ferme le bypass paywall sur tenant_services
--
-- Avant : la policy « Tenant services modifiable par owner/admin » (cmd=ALL,
-- owner/admin du tenant) laissait un owner INSERT/UPDATE tenant_services
-- DIRECTEMENT via PostgREST → auto-activer n'importe quel moteur GRATUITEMENT
-- (contourne l'API + le gating d'abonnement). Least-privilege : les écritures
-- LÉGITIMES passent TOUTES par l'API (service_role, qui bypasse la RLS) ;
-- vérifié repo-wide : AUCUNE écriture directe tenant_services côté client
-- (apps/app, apps/mobile, edge functions, tools).
--
-- Après : on supprime la policy d'écriture owner/admin. La LECTURE membre reste
-- ouverte via « Tenant services visible par membres » (SELECT, membres actifs) —
-- un owner est membre actif, donc AUCUNE régression de lecture. Seul le
-- service_role (API) peut désormais écrire. Réversible : recréer la policy.
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Tenant services modifiable par owner/admin" ON tenant_services;

-- (Optionnel, explicite) garantir que la lecture membre existe bien.
DROP POLICY IF EXISTS "Tenant services visible par membres" ON tenant_services;
CREATE POLICY "Tenant services visible par membres" ON tenant_services
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tenant_memberships
      WHERE tenant_memberships.tenant_id = tenant_services.tenant_id
        AND tenant_memberships.user_id = auth.uid()
        AND tenant_memberships.status = 'active'
    )
  );
