/**
 * Accès au shell natif (Electron + preload LIRI_FULL_SYSTEM) depuis le renderer Vite.
 * En navigateur seul : pas d'injection — retour explicite pour l'UI.
 */

const EMBEDDED_APP_CTX_KEY = 'liri_embedded_app_ctx';

/** Mémorise une fenêtre verrouillée pour le contexte LONGIA (Studio / `longiaProCore`). */
export function persistEmbeddedAppLock(appName) {
  try {
    const name = String(appName || '').trim() || 'Application';
    sessionStorage.setItem(
      EMBEDDED_APP_CTX_KEY,
      JSON.stringify({ name, lockedAt: Date.now() }),
    );
  } catch {
    /* ignore */
  }
}

export function clearEmbeddedAppLock() {
  try {
    sessionStorage.removeItem(EMBEDDED_APP_CTX_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * @returns {{ embeddedControlActive: boolean; appName: string | null }}
 */
export function getEmbeddedAppContextForLongia() {
  if (typeof window === 'undefined') return { embeddedControlActive: false, appName: null };
  try {
    const raw = sessionStorage.getItem(EMBEDDED_APP_CTX_KEY);
    if (!raw) return { embeddedControlActive: false, appName: null };
    const o = JSON.parse(raw);
    if (!o || typeof o.lockedAt !== 'number') return { embeddedControlActive: false, appName: null };
    const maxAge = 24 * 60 * 60 * 1000;
    if (Date.now() - o.lockedAt > maxAge) {
      sessionStorage.removeItem(EMBEDDED_APP_CTX_KEY);
      return { embeddedControlActive: false, appName: null };
    }
    const name = typeof o.name === 'string' && o.name.trim() ? o.name.trim() : null;
    return { embeddedControlActive: true, appName: name };
  } catch {
    return { embeddedControlActive: false, appName: null };
  }
}

/**
 * API exposée par `electron/preload.ts` du pack LIRI_FULL_SYSTEM (`embeddedControlAPI`).
 */
export function getEmbeddedControlApi() {
  if (typeof window === 'undefined') return null;
  return window.embeddedControlAPI ?? null;
}

/**
 * @param {Record<string, unknown>} command
 * @returns {Promise<unknown>}
 */
export async function injectNativeCommand(command) {
  const api = getEmbeddedControlApi();
  if (api && typeof api.injectCommand === 'function') {
    return api.injectCommand(command);
  }
  const electron = typeof window !== 'undefined' ? window.electronAPI : null;
  if (electron && typeof electron.invoke === 'function') {
    try {
      return await electron.invoke('native-bridge:inject', command);
    } catch (e) {
      return { ok: false, reason: e?.message ? String(e.message) : String(e) };
    }
  }
  return { ok: false, reason: 'no_native_shell' };
}

export function hasNativeEmbeddedShell() {
  const api = getEmbeddedControlApi();
  if (api && typeof api.injectCommand === 'function') return true;
  const electron = typeof window !== 'undefined' ? window.electronAPI : null;
  return Boolean(electron && typeof electron.invoke === 'function');
}
