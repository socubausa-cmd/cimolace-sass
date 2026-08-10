-- ─────────────────────────────────────────────────────────────────────────────
-- SONDES AU NIVEAU PLATEFORME — `client_id` devient facultatif.
--
-- `cimolace_provider_health_checks` a été conçue pour la santé des fournisseurs
-- D'UN CLIENT : `client_id` y est NOT NULL. L'écran Infrastructure sonde
-- l'infrastructure de la PLATEFORME (Railway, Vercel, Supabase…), qui
-- n'appartient à aucun client — chaque insertion échouait donc sur la contrainte.
--
-- Plutôt qu'une seconde table qui ferait doublon, on relâche la contrainte :
--   client_id NULL  = sonde plateforme (Cimolace elle-même)
--   client_id posé  = sonde d'un tenant, comportement d'origine inchangé
--
-- Relâchement de contrainte : aucune ligne existante n'est invalidée.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.cimolace_provider_health_checks
  alter column client_id drop not null;

comment on column public.cimolace_provider_health_checks.client_id is
  'NULL = sonde de l''infrastructure PLATEFORME (écran Infrastructure). Renseigné = sonde des fournisseurs d''un tenant.';
