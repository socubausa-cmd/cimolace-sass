/**
 * Configuration de la plateforme Cimolace (SaaS).
 *
 * Cimolace est multi-tenant : `isna` n'est qu'un tenant parmi d'autres (le 1er).
 * Ce module centralise le **tenant par défaut** utilisé en dernier recours quand
 * on ne peut pas résoudre le tenant autrement (domaine, URL `/t/:slug`, session).
 *
 * Configurable via `VITE_DEFAULT_TENANT_SLUG` (défaut historique = `isna`).
 *
 * ⚠️ NE PAS recoder `'isna'` en dur ailleurs comme valeur de tenant par défaut —
 * importer `DEFAULT_TENANT_SLUG`. Voir docs/CIMOLACE_ARCHITECTURE.md §7.
 */
export const DEFAULT_TENANT_SLUG = String(
  import.meta.env.VITE_DEFAULT_TENANT_SLUG || 'isna',
)
  .trim()
  .toLowerCase();
