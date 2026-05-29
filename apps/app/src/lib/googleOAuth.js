/**
 * Helper Google OAuth pour le flux multi-tenant Cimolace.
 *
 * Responsabilités :
 *  - Stocker le tenant slug en sessionStorage avant la redirection OAuth (fallback)
 *  - Appeler supabase.auth.signInWithOAuth avec skipBrowserRedirect: true
 *  - Rediriger vers data.url
 *  - Afficher des erreurs claires (provider non configuré, réseau, etc.)
 *
 * Aucun secret Google n'est exposé dans le frontend.
 *
 * ── URLs de callback attendues (à allowlist dans Supabase Dashboard > Authentication > Redirect URLs) ──
 *
 *   Production :
 *     https://cimolace.space/auth/callback
 *     https://cimolace.space/cimolace/auth/google/callback
 *
 *   Développement local :
 *     http://localhost:5173/auth/callback
 *     http://localhost:5173/cimolace/auth/google/callback
 *
 * ── Flux de redirection ──
 *
 *   Opérateur Cimolace :
 *     /cimolace/login → Google → /cimolace/auth/google/callback → /cimolace/admin
 *
 *   Membre école (owner/admin/teacher/secretariat/creator) :
 *     /t/:slug/login → Google → /cimolace/auth/google/callback?tenant=:slug → /t/:slug/admin
 *
 *   Élève / membre standard :
 *     /t/:slug/login → Google → /cimolace/auth/google/callback?tenant=:slug → /student-school-life/dashboard
 *
 *   Non-membre du tenant :
 *     /t/:slug/login → Google → /cimolace/auth/google/callback?tenant=:slug → /t/:slug/login?error=not_member
 */

const OAUTH_TENANT_KEY = 'cimolace_oauth_tenant';

// URL de l'edge function oauth-initiate (Supabase Functions)
const OAUTH_INITIATE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/oauth-initiate`;

/** Stocke le tenant slug en sessionStorage (fallback si Supabase perd le query param). */
export function storeOAuthTenant(tenantSlug) {
  if (!tenantSlug) return;
  try {
    sessionStorage.setItem(OAUTH_TENANT_KEY, String(tenantSlug).trim().toLowerCase());
  } catch { /* ignore */ }
}

/** Récupère le tenant slug stocké avant le départ OAuth. */
export function getStoredOAuthTenant() {
  try {
    return sessionStorage.getItem(OAUTH_TENANT_KEY) || '';
  } catch {
    return '';
  }
}

/** Nettoie le tenant slug stocké après utilisation. */
export function clearStoredOAuthTenant() {
  try {
    sessionStorage.removeItem(OAUTH_TENANT_KEY);
  } catch { /* ignore */ }
}

/**
 * Démarre le flux Google OAuth.
 *
 * @param {object} supabase - Client Supabase (auth uniquement)
 * @param {object} opts
 * @param {string} opts.redirectTo - URL de callback complète
 * @param {string} [opts.tenantSlug] - Slug du tenant (optionnel, pour opérateur Cimolace)
 * @returns {Promise<{data: object|null, error: Error|null}>}
 */
export async function startGoogleOAuth(supabase, { redirectTo, tenantSlug }) {
  // Préserver le tenant slug en sessionStorage (fallback si le query param est perdu)
  if (tenantSlug) {
    storeOAuthTenant(tenantSlug);
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      skipBrowserRedirect: true,
    },
  });

  if (error) {
    const msg = String(error.message || '');
    if (/provider.*not.*enabled|provider.*not.*configured|not.*enabled/i.test(msg)) {
      return {
        data: null,
        error: new Error(
          'Google Auth n\'est pas configuré sur ce projet Supabase. ' +
          'Activez le provider Google dans Supabase Dashboard > Authentication > Providers.'
        ),
      };
    }
    return { data: null, error };
  }

  if (!data?.url) {
    return {
      data: null,
      error: new Error('Impossible d\'obtenir l\'URL de connexion Google. Vérifiez la configuration Supabase.'),
    };
  }

  // Redirection immédiate vers Google
  window.location.assign(data.url);
  return { data, error: null };
}

/**
 * Démarre le flux Google OAuth custom (per-tenant) via l'edge function oauth-initiate.
 *
 * Utilisé depuis SchoolLoginPage pour les tenants qui ont configuré leurs propres
 * credentials Google OAuth (affichage de leur nom d'appli sur l'écran de consentement).
 *
 * @param {object} opts
 * @param {string} opts.tenantSlug - Slug du tenant
 * @param {string} [opts.anonKey] - Clé anon Supabase (pour authentifier l'appel)
 * @param {string} [opts.returnTo] - URL de retour après connexion (optionnel)
 * @returns {Promise<{error: Error|null}>}
 */
export async function startTenantGoogleOAuth({ tenantSlug, anonKey, returnTo }) {
  if (!tenantSlug) {
    return { error: new Error('tenantSlug requis') };
  }

  try {
    const headers = {
      'Content-Type': 'application/json',
    };

    // Authentification minimale avec la clé anon publique
    const key = anonKey || import.meta.env.VITE_SUPABASE_ANON_KEY || '';
    if (key) {
      headers['apikey'] = key;
      headers['Authorization'] = `Bearer ${key}`;
    }

    const res = await fetch(OAUTH_INITIATE_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        tenant_slug: tenantSlug,
        return_to: returnTo || '',
      }),
    });

    const body = await res.json().catch(() => ({}));

    if (!res.ok) {
      const code = body?.code || 'oauth_error';
      const msg = body?.error || `Erreur OAuth (${res.status})`;

      // Cas particulier : OAuth non configuré pour ce tenant
      if (code === 'oauth_not_configured' || res.status === 404) {
        return {
          error: new Error(
            'Google OAuth n\'est pas encore configuré pour cette école. ' +
            'Utilisez votre adresse e-mail / mot de passe, ou contactez votre administrateur.'
          ),
          code,
        };
      }

      return { error: new Error(msg), code };
    }

    const redirectUrl = body?.redirect_url;
    if (!redirectUrl) {
      return { error: new Error('URL de redirection Google manquante.') };
    }

    // Stocker le tenant en sessionStorage (fallback)
    storeOAuthTenant(tenantSlug);

    // Rediriger vers Google
    window.location.assign(redirectUrl);
    return { error: null };
  } catch (err) {
    return { error: new Error(err?.message || 'Erreur réseau lors de l\'initiation OAuth') };
  }
}
