import { Capacitor } from '@capacitor/core';
import { activeTenantConfig as isnaTenantConfig } from '@/lib/tenant/activeTenantConfig';

const DEFAULT_EMULATOR_HOST = '10.0.2.2';

/** Sans VITE_APP_URL, l'app Capacitor (origine https://localhost) ne sert pas les Netlify Functions. */
const NATIVE_FALLBACK_SITE_ORIGIN = String(
  import.meta.env.VITE_SITE_ORIGIN ||
    isnaTenantConfig.branding.publicSiteOrigin ||
    `https://${isnaTenantConfig.branding.domain}`,
)
  .trim()
  .replace(/\/$/, '');

function isCapacitorLocalWebOrigin() {
  if (typeof window === 'undefined') return false;
  if (!Capacitor.isNativePlatform()) return false;
  try {
    const h = new URL(window.location.href).hostname;
    return h === 'localhost' || h === '127.0.0.1';
  } catch {
    return false;
  }
}

/** Page HTTPS (WebView Capacitor) + API en http:// → requêtes bloquées (mixed content). */
function isNativeMixedContent(pageProtocol, apiOriginUrl) {
  if (typeof window === 'undefined' || !Capacitor.isNativePlatform()) return false;
  if (pageProtocol !== 'https:') return false;
  try {
    return new URL(apiOriginUrl).protocol === 'http:';
  } catch {
    return false;
  }
}

let mixedContentWarned = false;

/**
 * Sur l'émulateur Android, `localhost` / `127.0.0.1` désignent l'émulateur lui‑même, pas le Mac.
 * Remplace l'hôte par l'alias vers la machine hôte (souvent 10.0.2.2).
 *
 * Sur **téléphone physique**, si ton API tourne sur le Mac, utilise plutôt `VITE_APP_URL=http://IP_LAN:8888`
 * (pas localhost). Pour la prod, `VITE_APP_URL=https://ton-domaine`.
 */
export function mapLocalhostToAndroidEmulatorHost(urlOrOrigin) {
  if (!urlOrOrigin || typeof urlOrOrigin !== 'string') return urlOrOrigin;
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') return urlOrOrigin;

  const override = String(import.meta.env.VITE_ANDROID_EMULATOR_HOST || '').trim();
  const host = override || DEFAULT_EMULATOR_HOST;

  try {
    const base = typeof window !== 'undefined' ? window.location.href : 'https://localhost/';
    const u = new URL(urlOrOrigin, base);
    if (u.hostname !== 'localhost' && u.hostname !== '127.0.0.1') return urlOrOrigin;
    u.hostname = host;
    return u.href.replace(/\/$/, '');
  } catch {
    return urlOrOrigin
      .replace(/\/\/localhost(?=[:/]|$)/gi, `//${host}`)
      .replace(/\/\/127\.0\.0\.1(?=[:/]|$)/gi, `//${host}`);
  }
}

/**
 * En dev navigateur, si .env impose `VITE_APP_URL=http://localhost:8888` mais que seul Vite tourne
 * (ex. :5173), les fetch partent vers :8888 → ERR_CONNECTION_REFUSED en boucle.
 * On préfère l'origine de la page : les appels `/.netlify/functions/*` passent par le proxy Vite.
 */
function shouldPreferPageOriginOverNetlifyDevEnv(fromEnv) {
  if (typeof window === 'undefined') return false;
  if (Capacitor.isNativePlatform()) return false;
  if (!import.meta.env.DEV) return false;
  if (!fromEnv) return false;
  try {
    const page = new URL(window.location.href);
    const api = new URL(fromEnv, page.href);
    const apiPort = api.port || (api.protocol === 'https:' ? '443' : '80');
    const pagePort = page.port || (page.protocol === 'https:' ? '443' : '80');
    const localHost = (h) => h === 'localhost' || h === '127.0.0.1';
    if (!localHost(api.hostname)) return false;
    return apiPort === '8888' && pagePort !== '8888';
  } catch {
    return false;
  }
}

/**
 * Page sur `netlify dev` local (:8888) mais `VITE_APP_URL` pointe vers un autre port local (ex. Vite :5173).
 * Tous les fetch vers `/.netlify/functions/*` doivent utiliser l'origine de la page.
 */
function shouldPreferPageOriginWhenNetlifyPageButOtherLocalDevPort(fromEnv) {
  if (typeof window === 'undefined') return false;
  if (Capacitor.isNativePlatform()) return false;
  if (!import.meta.env.DEV) return false;
  if (!fromEnv) return false;
  try {
    const page = new URL(window.location.href);
    const api = new URL(fromEnv, page.href);
    const apiPort = api.port || (api.protocol === 'https:' ? '443' : '80');
    const pagePort = page.port || (page.protocol === 'https:' ? '443' : '80');
    const localHost = (h) => h === 'localhost' || h === '127.0.0.1';
    if (!localHost(page.hostname)) return false;
    if (!localHost(api.hostname)) return false;
    return pagePort === '8888' && apiPort !== '8888';
  } catch {
    return false;
  }
}

/**
 * `http://localhost:8888` et `http://127.0.0.1:8888` sont deux origines distinctes : cookies Supabase + fetch
 * vers `VITE_APP_URL` peuvent échouer (« Failed to fetch ») si la page Playwright est sur l'une et l'API sur l'autre.
 */
function shouldPreferPageOriginWhenLoopbackHostMismatch(fromEnv) {
  if (typeof window === 'undefined') return false;
  if (Capacitor.isNativePlatform()) return false;
  if (!import.meta.env.DEV) return false;
  if (!fromEnv) return false;
  try {
    const page = new URL(window.location.href);
    const api = new URL(fromEnv, page.href);
    const loop = (h) => h === 'localhost' || h === '127.0.0.1' || h === '[::1]';
    if (!loop(page.hostname) || !loop(api.hostname)) return false;
    if (page.hostname === api.hostname) return false;
    const pagePort = page.port || (page.protocol === 'https:' ? '443' : '80');
    const apiPort = api.port || (api.protocol === 'https:' ? '443' : '80');
    return page.protocol === api.protocol && pagePort === apiPort;
  } catch {
    return false;
  }
}

/**
 * Base d'URL pour appels vers Netlify Functions / API locale depuis l'app.
 */
export function resolveApiOrigin() {
  const fromEnv = String(import.meta.env.VITE_APP_URL || '').trim().replace(/\/$/, '');
  if (shouldPreferPageOriginOverNetlifyDevEnv(fromEnv)) {
    return mapLocalhostToAndroidEmulatorHost(window.location.origin).replace(/\/$/, '');
  }
  if (shouldPreferPageOriginWhenNetlifyPageButOtherLocalDevPort(fromEnv)) {
    return mapLocalhostToAndroidEmulatorHost(window.location.origin).replace(/\/$/, '');
  }
  if (shouldPreferPageOriginWhenLoopbackHostMismatch(fromEnv)) {
    return mapLocalhostToAndroidEmulatorHost(window.location.origin).replace(/\/$/, '');
  }
  let origin;
  if (fromEnv) {
    origin = mapLocalhostToAndroidEmulatorHost(fromEnv).replace(/\/$/, '');
  } else if (isCapacitorLocalWebOrigin() && NATIVE_FALLBACK_SITE_ORIGIN) {
    origin = NATIVE_FALLBACK_SITE_ORIGIN;
  } else {
    const base =
      typeof window !== 'undefined' ? window.location.origin : 'http://localhost:8888';
    origin = mapLocalhostToAndroidEmulatorHost(base).replace(/\/$/, '');
  }

  if (
    typeof window !== 'undefined' &&
    isNativeMixedContent(window.location.protocol, origin) &&
    NATIVE_FALLBACK_SITE_ORIGIN
  ) {
    if (!mixedContentWarned) {
      mixedContentWarned = true;
      try {
        console.warn(
          '[LIRI] API locale en HTTP alors que la WebView est en HTTPS — mixed content bloqué. ' +
            'Utilisation de VITE_SITE_ORIGIN pour les fonctions Netlify. ' +
            'Pour du dev local : npm run cap:sync:android-http (schéma http) ou servez l\'API en HTTPS.',
        );
      } catch {
        /* ignore */
      }
    }
    return NATIVE_FALLBACK_SITE_ORIGIN;
  }

  return origin;
}

/**
 * Sur Capacitor, les `fetch('/.netlify/functions/...')` visent sinon https://localhost (inexistant).
 */
export function rewriteNetlifyFunctionsFetchInput(input) {
  if (!Capacitor.isNativePlatform()) return input;

  const origin = resolveApiOrigin();

  const rewriteUrl = (urlStr) => {
    if (!urlStr || typeof urlStr !== 'string') return urlStr;
    if (urlStr.startsWith('/.netlify/functions/')) {
      return `${origin}${urlStr}`;
    }
    try {
      const u = new URL(urlStr, typeof window !== 'undefined' ? window.location.href : 'https://localhost/');
      if (!u.pathname.startsWith('/.netlify/functions/')) return urlStr;
      const h = u.hostname;
      if (h === 'localhost' || h === '127.0.0.1') {
        return `${origin}${u.pathname}${u.search}`;
      }
    } catch {
      /* ignore */
    }
    return urlStr;
  };

  if (typeof input === 'string') {
    const out = rewriteUrl(input);
    return out === input ? input : out;
  }
  if (typeof Request !== 'undefined' && input instanceof Request) {
    const out = rewriteUrl(input.url);
    if (out !== input.url) {
      return new Request(out, input);
    }
  }
  return input;
}
