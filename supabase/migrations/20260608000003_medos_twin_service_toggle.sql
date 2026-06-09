-- P2 — Chantier 4 : Marketplace tenant (toggle Twin)
-- Active par défaut le module 'twin' (Bio Digital Twin MedOS) sur tous les
-- tenants existants, pour ne rien casser. Les futurs tenants devront recevoir
-- la clé explicitement (provisioning code path).
--
-- La table tenant_services existe déjà (migration 20250510000006). On se
-- contente d'insérer la clé 'twin' avec ON CONFLICT DO NOTHING — un toggle
-- ultérieur (TwinEnabledGuard + admin endpoint) peut désactiver pour un tenant
-- donné sans toucher cette ligne.

INSERT INTO tenant_services (tenant_id, service_key, active, settings)
SELECT id, 'twin', true, '{}'::jsonb
FROM tenants
ON CONFLICT (tenant_id, service_key) DO NOTHING;

-- Index utile pour le lookup (tenant_id, service_key) déjà couvert par UNIQUE.
COMMENT ON COLUMN tenant_services.service_key
  IS 'Clé du moteur Cimolace activé pour le tenant. Valeurs notables : twin (Bio Digital Twin MedOS), med_ehr, med_charting, gdpr_engine, …';
