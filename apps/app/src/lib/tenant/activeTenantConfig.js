/**
 * ═══════════════════════════════════════════════════════════════
 * CONFIG DU TENANT ACTIF — seam unique
 * ───────────────────────────────────────────────────────────────
 * C'est le SEUL endroit de l'app qui importe une config tenant en dur.
 * Tout le reste du code importe `activeTenantConfig` depuis ce module,
 * jamais `@/tenants/isna/...` directement.
 *
 * Aujourd'hui : retourne la config du tenant FONDATEUR (ISNA) par défaut.
 * Demain : c'est ici qu'on branchera la résolution runtime par tenant
 * (host → slug → config/branding du tenant courant), sans toucher aux
 * ~65 fichiers consommateurs.
 *
 * Cimolace est multi-tenant ; ISNA n'est qu'un tenant.
 * Cf. docs/CIMOLACE_ARCHITECTURE_SOURCE_OF_TRUTH.md
 * ═══════════════════════════════════════════════════════════════
 */
import { isnaTenantConfig } from '@/tenants/isna/tenant.config';

/** Config du tenant fondateur, utilisée comme défaut tant que la résolution
 *  runtime par tenant n'est pas branchée ici. */
export const FOUNDER_TENANT_CONFIG = isnaTenantConfig;

/** Config du tenant actuellement actif (défaut = fondateur). */
export const activeTenantConfig = FOUNDER_TENANT_CONFIG;

export default activeTenantConfig;
