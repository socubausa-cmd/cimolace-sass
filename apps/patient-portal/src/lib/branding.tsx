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
  // Patient-portal engine identity — used until tenant branding loads. The
  // patient surface targets 100% tenant white-label (no Cimolace, no MEDOS
  // visible to the patient). The teal default approximates a clinical,
  // calm palette so the pre-branding flash looks intentional rather than
  // broken — but it's overridden as soon as the tenant lookup resolves.
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
 * Cimolace platform hosts — these serve the multi-tenant app generically,
 * so they are NOT treated as a tenant's own white-label domain. Anything
 * NOT in this set (and not a `*.patient.cimolace.space` subdomain) is
 * considered an Enterprise custom host resolved server-side by hostname.
 */
const PLATFORM_HOSTS = new Set([
  'patient.cimolace.space',
  'med.cimolace.space',
  'app.cimolace.space',
  'cimolace.space',
  'localhost',
  '127.0.0.1',
]);

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

/**
 * Decide WHICH public branding endpoint to hit:
 *   • by-slug  — when a slug is known from URL / subdomain / localStorage
 *     (Cimolace-hosted tenants, invitation links).
 *   • by-host  — Enterprise white-label: served on the tenant's own domain
 *     (e.g. patient.zahirwellness.com) where the URL carries no slug, so the
 *     tenant (and its slug) are resolved server-side from the hostname.
 * Returns null when there's no tenant context at all (root platform host).
 */
function resolveBrandingSource(): { url: string; fromHost: boolean } | null {
  if (typeof window === 'undefined') return null;
  const slug = resolveTenantSlug();
  if (slug) {
    return {
      url: `${API}/tenants/by-slug/${encodeURIComponent(slug)}/branding`,
      fromHost: false,
    };
  }
  const host = window.location.hostname.split(':')[0].toLowerCase();
  if (!PLATFORM_HOSTS.has(host)) {
    return {
      url: `${API}/tenants/by-host/${encodeURIComponent(host)}/branding`,
      fromHost: true,
    };
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
    const source = resolveBrandingSource();
    if (!source) {
      setBranding((b) => ({ ...b, loading: false }));
      return;
    }
    // PUBLIC endpoint — no Authorization header required. Works on the
    // login page before any auth.
    fetch(source.url)
      .then((r) => (r.ok ? r.json() : null))
      .then((payload) => {
        if (cancelled || !payload) return;
        const t = payload?.data;
        if (!t) {
          // Slug / host inconnu : on garde engine defaults
          setBranding((b) => ({ ...b, loading: false }));
          return;
        }
        // White-label custom host: the slug was unknown from the URL, so
        // persist the server-resolved one — authenticated API calls read
        // localStorage.tenant_slug to send the X-Tenant-Slug header.
        if (source.fromHost && t.slug) {
          try {
            localStorage.setItem('tenant_slug', t.slug);
          } catch {
            /* ignore */
          }
        }
        const colors = (t.brand_colors || {}) as Record<string, string>;
        setBranding({
          name: t.name || ENGINE_DEFAULTS.name,
          logoUrl: t.logo_url || null,
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
