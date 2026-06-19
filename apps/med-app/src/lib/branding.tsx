import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

/**
 * Branding tenant — résolu via 3 sources, dans cet ordre :
 *
 *   1. `?tenant=<slug>` dans l'URL (lien d'invitation patient) → écrit dans
 *      localStorage pour persister entre rechargements.
 *   2. Sous-domaine du host (`zahir.patient.cimolace.space` → "zahir"). Le
 *      slug "patient" est ignoré pour ne pas matcher l'URL racine
 *      `patient.cimolace.space`.
 *   3. `localStorage.tenant_slug` posé lors d'une session précédente.
 *
 * Si l'un de ces 3 channels donne un slug, on fetch
 * `GET /tenants/by-slug/{slug}/branding` (PUBLIC, sans token) et on
 * applique. Sinon on garde les engine defaults.
 *
 * Une fois le branding pris, on injecte 3 CSS variables sur :root :
 *   --brand-primary       Main accent
 *   --brand-primary-soft  Same color with low alpha
 *   --brand-accent        Secondary accent or primary
 */

const API = import.meta.env.VITE_API_URL || 'http://localhost:4002';

export type Branding = {
  name: string;
  logoUrl: string | null;
  primary: string;
  accent: string;
  loading: boolean;
};

const ENGINE_DEFAULTS = {
  // Med-app engine identity — used until tenant branding loads. The doctor
  // surface keeps the MEDOS engine identity visible (Strategy C: 60% MEDOS,
  // 40% tenant) so practitioners working across multiple tenants have a
  // stable visual anchor. Tenant logo/name appear in the co-brand band.
  name: 'Nganga',
  logoUrl: null as string | null,
  primary: '#3b82f6',
  accent: '#0d9488',
};

/**
 * Tenant theme registry. A tenant with an entry gets a full visual re-skin —
 * the [data-zw-theme] attribute drives the CSS token overrides in index.css
 * (warm palette, sidebar, serif fonts) plus a brand primary/accent override.
 * Tenants without an entry render with the default MEDOS neutral theme.
 * (Long-term: serve this from the branding API alongside brand_colors.)
 */
const TENANT_THEMES: Record<string, { theme: string; primary: string; accent: string; logo?: string }> = {
  zahirwellness: { theme: 'zahir', primary: '#7a2a3b', accent: '#c9a96a', logo: '/brand/zahir-nahir-logo.png' },
};

const BrandingContext = createContext<Branding>({
  ...ENGINE_DEFAULTS,
  loading: true,
});

function addAlpha(hex: string, alpha: string): string {
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

/**
 * Resolve the tenant slug from URL → subdomain → localStorage.
 * Returns null if no tenant context can be inferred (root URL on
 * patient.cimolace.space with no query param).
 */
function resolveTenantSlug(): string | null {
  if (typeof window === 'undefined') return null;
  // 1. URL query param (priority — handles invitation links).
  const qp = new URLSearchParams(window.location.search).get('tenant');
  if (qp) {
    try {
      localStorage.setItem('tenant_slug', qp);
    } catch {
      /* ignore */
    }
    return qp;
  }
  // 2. Subdomain — e.g. zahir.patient.cimolace.space → "zahir"
  // We ignore the generic ones used as platform infrastructure.
  const host = window.location.hostname.split(':')[0].toLowerCase();
  const PLATFORM_HOSTS = new Set([
    'patient.cimolace.space',
    'med.cimolace.space',
    'app.cimolace.space',
    'cimolace.space',
    'localhost',
  ]);
  if (!PLATFORM_HOSTS.has(host)) {
    const parts = host.split('.');
    // {tenant}.patient.cimolace.space → tenant
    if (parts.length >= 4 && parts[1] === 'patient') {
      try {
        localStorage.setItem('tenant_slug', parts[0]);
      } catch {
        /* ignore */
      }
      return parts[0];
    }
  }
  // 3. localStorage (sticky from a previous visit / authenticated session).
  try {
    const stored = localStorage.getItem('tenant_slug');
    if (stored) return stored;
  } catch {
    /* ignore */
  }
  return null;
}

export function BrandingProvider({ children }: { children: ReactNode }) {
  const [branding, setBranding] = useState<Branding>({
    ...ENGINE_DEFAULTS,
    loading: true,
  });

  useEffect(() => {
    applyCssVars(branding);
  }, [branding]);

  useEffect(() => {
    let cancelled = false;
    const slug = resolveTenantSlug();
    const themeCfg = slug ? TENANT_THEMES[slug] : undefined;
    if (themeCfg && typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-zw-theme', themeCfg.theme);
    }
    if (!slug) {
      setBranding((b) => ({ ...b, loading: false }));
      return;
    }
    // PUBLIC endpoint — no Authorization header required. Works on the
    // login page before any auth.
    fetch(`${API}/tenants/by-slug/${encodeURIComponent(slug)}/branding`)
      .then((r) => (r.ok ? r.json() : null))
      .then((payload) => {
        if (cancelled || !payload) return;
        const t = payload?.data;
        if (!t) {
          // Slug invalide : on garde engine defaults
          setBranding((b) => ({ ...b, loading: false }));
          return;
        }
        const colors = (t.brand_colors || {}) as Record<string, string>;
        setBranding({
          name: t.name || ENGINE_DEFAULTS.name,
          logoUrl: themeCfg?.logo || t.logo_url || null,
          primary: themeCfg?.primary || colors.primary || ENGINE_DEFAULTS.primary,
          accent:
            themeCfg?.accent || colors.accent || colors.secondary || ENGINE_DEFAULTS.accent,
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
  }, []);

  return (
    <BrandingContext.Provider value={branding}>
      {children}
    </BrandingContext.Provider>
  );
}

/** Read the active branding. */
export function useBranding(): Branding {
  return useContext(BrandingContext);
}
