/**
 * Aliases de slugs tenants — permet à un tenant historique d'être reconnu
 * sous un autre nom sans dupliquer la ligne en base.
 *
 * Ex : le tenant `prorascience` est physiquement stocké sous `isna` (fusion
 * historique). Toute résolution passant par un des alias renvoie le slug
 * canonique. Utilisé par `TenantService.resolveTenant()` avant lookup DB.
 *
 * NB — le fichier `dist/tenant/tenant-slug-aliases.js` compilé était présent
 * en prod mais le source `.ts` manquait de main (régression git). On restaure
 * le source pour que `nest build` (qui wipe dist avant de recompiler) ne
 * casse pas le déploiement Railway.
 */
const TENANT_SLUG_ALIASES: Record<string, string> = {
  prorascience: 'isna',
};

export function canonicalTenantSlug(slug: unknown): string {
  const normalized = String(slug ?? '').trim().toLowerCase();
  return TENANT_SLUG_ALIASES[normalized] ?? normalized;
}
