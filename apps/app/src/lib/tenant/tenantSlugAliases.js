const TENANT_SLUG_ALIASES = {
  prorascience: 'isna',
};

export function canonicalTenantSlug(slug) {
  const normalized = String(slug || '').trim().toLowerCase();
  return TENANT_SLUG_ALIASES[normalized] || normalized;
}

export function tenantSlugMatches(actual, expected) {
  const a = canonicalTenantSlug(actual);
  const e = canonicalTenantSlug(expected);
  return Boolean(a && e && a === e);
}

export function publicTenantSlug(slug) {
  const normalized = String(slug || '').trim().toLowerCase();
  return normalized || slug;
}
