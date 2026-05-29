import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

/**
 * Branding tenant — pulled from `GET /tenants/current` at mount.
 *
 * Why a dedicated provider instead of just reading from useAuth: branding
 * needs to be available BEFORE auth completes (login page itself needs the
 * tenant logo). The provider falls back to MEDOS defaults until the API
 * call resolves.
 *
 * The provider injects 3 CSS variables on `:root` so any CSS module / inline
 * style can pick them up via `var(--brand-primary)`:
 *
 *   --brand-primary       Main accent (sidebar, buttons, focus rings)
 *   --brand-primary-soft  Same color with low alpha (hover bg, focus ring)
 *   --brand-accent        Secondary accent if defined, falls back to primary
 *
 * Plus the metadata via the `useBranding()` hook for non-color rendering
 * (logo URL, tenant display name).
 */

const API = import.meta.env.VITE_API_URL || 'http://localhost:4002';

export type Branding = {
  /** Display name of the tenant (e.g. "Zahir Wellness") */
  name: string;
  /** Logo URL or null — fall back to the engine's default icon */
  logoUrl: string | null;
  /** Hex color string with leading # */
  primary: string;
  /** Optional secondary accent — same shape as primary */
  accent: string;
  /** True while the initial fetch is in flight */
  loading: boolean;
};

const ENGINE_DEFAULTS = {
  // Patient-portal engine identity — used until tenant branding loads. The
  // patient surface targets 100% tenant white-label (no Cimolace, no MEDOS
  // visible to the patient). The teal default approximates a clinical,
  // calm palette so the pre-branding flash looks intentional rather than
  // broken — but it's overridden as soon as /tenants/current resolves.
  name: 'Mon espace',
  logoUrl: null as string | null,
  primary: '#0d9488',
  accent: '#0f766e',
};

const BrandingContext = createContext<Branding>({
  ...ENGINE_DEFAULTS,
  loading: true,
});

function addAlpha(hex: string, alpha: string): string {
  // Inputs like "#3b82f6" → "#3b82f633" for soft variants.
  if (!hex || hex[0] !== '#') return hex;
  if (hex.length === 7) return hex + alpha;
  if (hex.length === 4) {
    const r = hex[1];
    const g = hex[2];
    const b = hex[3];
    return `#${r}${r}${g}${g}${b}${b}${alpha}`;
  }
  return hex;
}

function applyCssVars(b: Branding) {
  const root = document.documentElement.style;
  root.setProperty('--brand-primary', b.primary);
  root.setProperty('--brand-primary-soft', addAlpha(b.primary, '33'));
  root.setProperty('--brand-accent', b.accent);
}

export function BrandingProvider({
  children,
  tenantSlug,
}: {
  children: ReactNode;
  /**
   * The tenant slug used as `X-Tenant-Slug` header. Read from localStorage
   * by callers (set during login). When missing we keep engine defaults
   * silently — no error.
   */
  tenantSlug?: string;
}) {
  const [branding, setBranding] = useState<Branding>({
    ...ENGINE_DEFAULTS,
    loading: true,
  });

  useEffect(() => {
    applyCssVars(branding);
  }, [branding]);

  useEffect(() => {
    let cancelled = false;
    const token = localStorage.getItem('supabase_token');
    const slug = tenantSlug || localStorage.getItem('tenant_slug') || '';
    if (!token || !slug) {
      setBranding((b) => ({ ...b, loading: false }));
      return;
    }
    fetch(`${API}/tenants/current`, {
      headers: { Authorization: `Bearer ${token}`, 'X-Tenant-Slug': slug },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((payload) => {
        if (cancelled || !payload) return;
        const t = payload?.data || payload;
        const colors = (t?.brand_colors || {}) as Record<string, string>;
        setBranding({
          name: t?.name || ENGINE_DEFAULTS.name,
          logoUrl: t?.logo_url || null,
          primary: colors.primary || ENGINE_DEFAULTS.primary,
          accent:
            colors.accent || colors.secondary || ENGINE_DEFAULTS.accent,
          loading: false,
        });
      })
      .catch(() => {
        if (!cancelled) {
          setBranding((b) => ({ ...b, loading: false }));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [tenantSlug]);

  return (
    <BrandingContext.Provider value={branding}>
      {children}
    </BrandingContext.Provider>
  );
}

/**
 * Read the active branding. Falls back to engine defaults if no provider
 * (so legacy pages still render).
 */
export function useBranding(): Branding {
  return useContext(BrandingContext);
}
