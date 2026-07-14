const TENANT_SLUG_ALIASES: Record<string, string> = {
  prorascience: 'isna',
};

export function canonicalTenantSlug(slug?: string | null): string {
  const normalized = String(slug ?? '').trim().toLowerCase();
  return TENANT_SLUG_ALIASES[normalized] ?? normalized;
}
