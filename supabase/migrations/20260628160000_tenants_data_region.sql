-- ════════════════════════════════════════════════════════════════════════
-- MEDOS / Cimolace — FONDATION « region-ready » · DATA RESIDENCY MULTI-RÉGION
-- ════════════════════════════════════════════════════════════════════════
-- Évolution ADDITIVE et ZÉRO changement de comportement. Pose la colonne
-- `tenants.data_region` qui décrit OÙ résident les données d'un tenant. Tout
-- tenant existant prend la valeur par défaut 'global' → aucune bascule, le
-- code continue d'utiliser l'unique base Supabase actuelle (passthrough).
--
-- But : préparer le branchement d'une instance HDS/EEE (santé, France) pour
-- les futurs tenants français, SANS réarchitecturer maintenant. La colonne
-- est le seul prérequis schéma ; le MÉCANISME applicatif (RegionService +
-- SupabaseService.forRegion/forTenant) lit cette valeur pour router la
-- connexion. Aucun tenant n'est 'eu-hds' aujourd'hui.
--
-- Valeurs de `data_region` (TEXT libre, pas de CHECK pour accueillir de
-- futures régions sans migration) :
--   'global' = base Supabase mutualisée actuelle (DÉFAUT, comportement inchangé)
--   'eu-hds' = instance HDS française dédiée (hébergeur agréé Santé, EEE)
--              pour les patients FR ; à provisionner + env *_EU_HDS.
--   (autres) = toute future résidence régionale (ex: 'us', 'ca-qc'…).
--
-- IDEMPOTENT : ADD COLUMN IF NOT EXISTS.
-- ⚠️ MIGRATION NON APPLIQUÉE — à appliquer en prod (run-sql.js / db push).
-- ════════════════════════════════════════════════════════════════════════

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS data_region TEXT NOT NULL DEFAULT 'global';

COMMENT ON COLUMN tenants.data_region IS
  'Résidence des données du tenant. ''global'' = base Supabase mutualisée (défaut). ''eu-hds'' = instance HDS française dédiée (patients FR, hébergeur agréé Santé/EEE). Autres valeurs = futures régions. Lu par RegionService / SupabaseService.forTenant pour router la connexion ; ''global'' renvoie le client mutualisé existant (zéro changement).';
