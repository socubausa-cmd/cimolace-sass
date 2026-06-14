import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { authStore } from '@/lib/auth-store';
import { getLoginEntryPath } from '@/lib/loginEntryPath';
import { DEFAULT_TENANT_SLUG } from '@/config/platform';
import { getCachedHostTenant } from '@/lib/tenantResolver';

const AuthContext = createContext({});
export const useAuth = () => useContext(AuthContext);

const fetchProfile = async (userId) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (error) {
    console.warn('[auth] profile fetch error:', error.message);
    return null;
  }
  return data;
};

const withTimeout = (promise, timeoutMs = 7000, fallback = null) => {
  let timeoutId;
  return Promise.race([
    promise,
    new Promise((resolve) => {
      timeoutId = window.setTimeout(() => resolve(fallback), timeoutMs);
    }),
  ]).finally(() => {
    if (timeoutId) window.clearTimeout(timeoutId);
  });
};

const ensureVisitorProfile = async (authUser) => {
  if (!authUser?.id) return null;
  const existing = await fetchProfile(authUser.id);
  if (existing?.id) {
    const role = String(existing.role || '').toLowerCase();
    if (!role) {
      await supabase
        .from('profiles')
        .update({ role: 'visitor' })
        .eq('id', authUser.id);
      return fetchProfile(authUser.id);
    }
    return existing;
  }

  const meta = authUser.user_metadata || {};
  const displayName =
    meta.full_name ||
    meta.name ||
    authUser.email?.split('@')[0] ||
    'Prospect';

  await supabase.from('profiles').upsert(
    {
      id: authUser.id,
      email: String(authUser.email || '').toLowerCase(),
      name: displayName,
      role: 'visitor',
      status: 'active',
    },
    { onConflict: 'id' }
  );

  return fetchProfile(authUser.id);
};

/**
 * Slug du tenant de l'école COURANTE (multi-tenant Cimolace), résolu de façon
 * synchrone : domaine custom en cache (tenantResolver) sinon tenant par défaut
 * (config/platform). Sert à rattacher un nouvel élève au bon tenant. On évite de
 * recoder 'isna' en dur — cf. docs/CIMOLACE_ARCHITECTURE.md §7.
 */
const resolveCurrentTenantSlug = () => {
  try {
    const host = typeof window !== 'undefined' ? window.location.hostname : '';
    const byHost = getCachedHostTenant(host);
    if (byHost) return byHost;
  } catch {
    // ignore — repli sur le tenant par défaut
  }
  return DEFAULT_TENANT_SLUG;
};

/**
 * Évite de rappeler la RPC plusieurs fois pour le même utilisateur pendant une
 * session (init + onAuthStateChange + login peuvent se déclencher d'affilée).
 * La RPC reste idempotente côté DB (ON CONFLICT DO NOTHING) ; ceci économise
 * juste des aller-retours réseau redondants.
 */
const studentMembershipEnsuredFor = new Set();

/**
 * Rattache l'utilisateur courant au tenant de l'école (role=student, idempotent)
 * via la RPC SECURITY DEFINER public.ensure_student_membership(p_slug).
 *
 * PRÉREQUIS DE TOUT LE RESTE : sans tenant_memberships active, l'élève ne lit
 * aucun contenu (RLS pédagogiques tenant-scoped) et ne peut pas demander de RDV.
 * tenant_memberships n'a PAS de policy INSERT 'authenticated' → on passe par la
 * RPC (supabase.rpc = vrai client Supabase dans supabaseCompat), jamais par un
 * .from('tenant_memberships').insert() (qui échouerait en RLS / partirait dans
 * l'API sans endpoint create).
 *
 * Fire-and-forget et silencieux : ne JAMAIS bloquer ni casser login/signup si la
 * RPC n'est pas encore déployée ou si le réseau échoue. Idempotent côté DB
 * (ON CONFLICT DO NOTHING) → un owner/teacher garde son rôle.
 */
const ensureStudentMembership = async (authUser) => {
  if (!authUser?.id) return;
  if (studentMembershipEnsuredFor.has(authUser.id)) return;
  studentMembershipEnsuredFor.add(authUser.id);
  const slug = resolveCurrentTenantSlug();
  if (!slug) return;
  try {
    const { error } = await supabase.rpc('ensure_student_membership', { p_slug: slug });
    if (error) {
      // Ne pas désactiver définitivement : permet un nouvel essai au prochain login.
      studentMembershipEnsuredFor.delete(authUser.id);
      console.warn('[auth] ensure_student_membership:', error.message);
    }
  } catch (e) {
    studentMembershipEnsuredFor.delete(authUser.id);
    console.warn('[auth] ensure_student_membership error:', e?.message || e);
  }
};

/** Vrai uniquement dans la coque élève /m/eleve (où le self-join student a un sens). */
const isEleveShellPath = () => {
  try {
    return String(window.location.pathname || '').startsWith('/m/eleve');
  } catch {
    return false;
  }
};

/**
 * Self-heal rattachement élève, GATÉ sur la coque /m/eleve : ne touche pas les
 * autres flux d'inscription (visiteur générique /signup, école /t/:slug/signup).
 * Fire-and-forget.
 */
const maybeEnsureStudentMembership = (authUser) => {
  if (!isEleveShellPath()) return;
  void ensureStudentMembership(authUser);
};

/**
 * Cache du dernier rôle FIABLE résolu par id utilisateur (rempli uniquement quand
 * un profil a réellement été chargé). Sert de filet anti-régression : si une relecture
 * du profil échoue/expire (Supabase froid, réseau lent → profile === null), on ne
 * rétrograde PAS un formateur/admin/owner/secretariat déjà connu vers 'visitor'.
 * Sécurité : un prospect sans rôle antérieur fiable reste 'visitor' (aucun gain d'accès).
 */
const lastKnownRoleById = new Map();

const buildUser = (authUser, profile) => {
  if (!authUser) return null;
  const meta = authUser.user_metadata || {};
  const profileRole = String(profile?.role || '').toLowerCase();
  if (profile?.id && profileRole) {
    lastKnownRoleById.set(authUser.id, profileRole);
  }
  // Repli quand le profil n'a pas pu être (re)chargé (timeout/erreur → profile null) :
  // réutiliser le dernier rôle fiable connu pour CE même utilisateur, sinon métadonnées,
  // sinon 'visitor'. Évite la redirection /prospect/entretien des formateurs sur fetch lent.
  const resolvedRole =
    profileRole ||
    lastKnownRoleById.get(authUser.id) ||
    String(meta.role || '').toLowerCase() ||
    (isDevCimolaceAdmin(authUser.email) ? 'admin' : 'visitor');
  return {
    id: authUser.id,
    email: authUser.email,
    name:
      profile?.name ||
      profile?.full_name ||
      meta.name ||
      meta.full_name ||
      authUser.email?.split('@')[0] ||
      '',
    role: resolvedRole,
    // Rôle DANS LE TENANT ACTIF (JWT app_metadata, posé à la création de session).
    // Un owner/practitioner d'un tenant (ex: zahirwellness) a un profiles.role GLOBAL
    // = 'visitor' ; ce champ porte son vrai rôle pour les gardes tenant-scoped (studio).
    tenant_role: String(authUser.app_metadata?.tenant_role || '').toLowerCase(),
    tenant_id: authUser.app_metadata?.tenant_id || null,
    metadata: profile?.metadata || {},
    cimolace_staff: Boolean(profile?.metadata?.cimolace_staff || meta.cimolace_staff || isDevCimolaceAdmin(authUser.email)),
    avatar_url: profile?.avatar_url || null,
    phone: profile?.phone || null,
    status: profile?.status || 'active',
    student_profile_completed: Boolean(profile?.student_profile_completed),
    student_profile_completed_at: profile?.student_profile_completed_at || null,
    city: profile?.city || null,
    region: profile?.region || null,
    country: profile?.country || null,
  };
};

const isDevCimolaceAdmin = (email) => (
  import.meta.env.DEV &&
  String(email || '').trim().toLowerCase() === 'cimolace-admin@prorascience.local'
);

const clearStaleOAuthState = () => {
  try {
    const storages = [window.sessionStorage, window.localStorage].filter(Boolean);
    storages.forEach((st) => {
      try {
        for (let i = st.length - 1; i >= 0; i -= 1) {
          const k = st.key(i);
          if (!k) continue;
          // Supabase stores auth + PKCE flow state in keys containing 'sb-' and '-auth-token'
          if (k.includes('sb-') && k.includes('-auth-token')) {
            st.removeItem(k);
          }
          // Also clear transient PKCE flow keys
          if (k.includes('supabase') && (k.includes('pkce') || k.includes('code-verifier') || k.includes('oauth'))) {
            st.removeItem(k);
          }
        }
      } catch {
        // ignore
      }
    });
  } catch {
    // ignore
  }
};

const syncApiAuthToken = (session) => {
  try {
    authStore.setToken(session?.access_token || '');
  } catch {
    // ignore localStorage edge cases
  }
};

const readPersistedSupabaseSession = () => {
  try {
    const storage = window.localStorage;
    for (let i = 0; i < storage.length; i += 1) {
      const key = storage.key(i);
      if (!key || !key.startsWith('sb-') || !key.endsWith('-auth-token')) continue;
      const raw = storage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      const session = parsed?.currentSession || parsed;
      if (session?.access_token && session?.user) return session;
    }
  } catch {
    // ignore malformed/stale browser storage
  }
  return null;
};

const getSupabaseSessionWithTimeout = async (timeoutMs = 2500) => {
  let timeoutId;
  try {
    return await Promise.race([
      supabase.auth.getSession(),
      new Promise((resolve) => {
        timeoutId = window.setTimeout(() => resolve({ data: { session: null }, error: null, timedOut: true }), timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) window.clearTimeout(timeoutId);
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Hard timeout: if Supabase never responds, unblock the app after 10s
    const safetyTimer = window.setTimeout(() => {
      setLoading(false);
    }, 10000);

    // Get initial session
    const initSession = async () => {
      try {
        const { data: { session } } = await getSupabaseSessionWithTimeout();
        const currentSession = session || readPersistedSupabaseSession();
        setSession(currentSession);
        syncApiAuthToken(currentSession);
        if (currentSession?.user) {
          const profile = await withTimeout(ensureVisitorProfile(currentSession.user));
          setUser(buildUser(currentSession.user, profile));
          // Self-heal (coque élève only) : rattache l'élève au tenant courant s'il
          // ne l'est pas encore (inscriptions antérieures orphelines). Idempotent.
          maybeEnsureStudentMembership(currentSession.user);
        }
      } catch (err) {
        console.warn('[auth] init error:', err.message);
      } finally {
        window.clearTimeout(safetyTimer);
        setLoading(false);
      }
    };
    initSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      try {
        const effectiveSession =
          newSession ||
          (event === 'SIGNED_OUT' ? null : readPersistedSupabaseSession());
        setSession(effectiveSession);
        syncApiAuthToken(effectiveSession);
        if (effectiveSession?.user) {
          const profile = await withTimeout(ensureVisitorProfile(effectiveSession.user));
          setUser(buildUser(effectiveSession.user, profile));
          // Couvre l'inscription Google élève (session établie via AuthCallbackPage
          // → redirige vers /m/eleve → SIGNED_IN ici) ET le self-heal au 1er login.
          // Gaté sur la coque /m/eleve, idempotent, fire-and-forget.
          if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'USER_UPDATED') {
            maybeEnsureStudentMembership(effectiveSession.user);
          }
        } else {
          setUser(null);
        }
      } catch (err) {
        console.warn('[auth] onAuthStateChange handler error:', err?.message || err);
      } finally {
        setLoading(false);
      }
    });

    return () => { subscription.unsubscribe(); window.clearTimeout(safetyTimer); };
  }, []);

  const login = async (email, password) => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: String(email || '').trim(),
        password: String(password || '').trim(),
      });
      if (authError) {
        setError(authError.message);
        return { data: null, error: authError };
      }
      // Remplir user/session ici : sinon navigate(/dashboard) arrive avant onAuthStateChange
      // et ProtectedRoute voit encore user=null → renvoi immédiat vers /login (surtout sur mobile).
      if (data?.session?.user) {
        setSession(data.session);
        syncApiAuthToken(data.session);
        try {
          const profile = await withTimeout(ensureVisitorProfile(data.session.user));
          setUser(buildUser(data.session.user, profile));
        } catch (e) {
          console.warn('[auth] login profile fetch:', e?.message || e);
          setUser(buildUser(data.session.user, null));
        }
        // Self-heal au login (coque élève only) : un élève inscrit avant ce
        // correctif (membership orpheline) est rattaché ici. Idempotent.
        maybeEnsureStudentMembership(data.session.user);
      }
      return { data, error: null };
    } catch (err) {
      const msg = err?.message || 'Erreur réseau. Vérifiez votre connexion.';
      setError(msg);
      return { data: null, error: { message: msg } };
    } finally {
      setLoading(false);
    }
  };

  const signup = async (email, password, metadata = {}) => {
    setLoading(true);
    setError(null);
    const { data, error: authError } = await supabase.auth.signUp({
      email: String(email || '').trim(),
      password: String(password || '').trim(),
      options: { data: metadata },
    });
    setLoading(false);
    if (authError) {
      setError(authError.message);
      return { data: null, error: authError };
    }
    // NB : le rattachement tenant (role=student) n'est PAS fait ici à dessein.
    // signup() est partagé par plusieurs flux (élève /m/eleve, visiteur générique
    // /signup → role:'visitor' + choix de forfait, école /t/:slug/signup qui a déjà
    // son propre join via POST /tenants/:slug/join). Rattacher tout le monde au
    // tenant par défaut casserait ces autres flux. Le rattachement élève est :
    //  • explicite côté écran d'inscription élève (EleveSignupMobile), et
    //  • auto en self-heal mais UNIQUEMENT dans la coque /m/eleve (cf.
    //    maybeEnsureStudentMembership ci-dessous + onAuthStateChange/login/init).
    return { data, error: null };
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn('[auth] signOut error:', e?.message || e);
    }
    clearStaleOAuthState();
    syncApiAuthToken(null);
    setUser(null);
    setSession(null);
    try {
      window.location.replace(getLoginEntryPath());
    } catch {
      // ignore
    }
  };

  const resetPassword = async (email) => {
    const trimmed = String(email || '').trim();
    if (!trimmed) return { error: { message: 'Email requis' } };
    let options;
    try {
      if (typeof window !== 'undefined' && window.location?.origin) {
        options = { redirectTo: `${window.location.origin}/update-password` };
      }
    } catch {
      /* ignore */
    }
    const { error: err } = await supabase.auth.resetPasswordForEmail(trimmed, options);
    return { error: err };
  };

  const updatePassword = async (newPassword) => {
    const { error: err } = await supabase.auth.updateUser({ password: newPassword });
    return { error: err };
  };

  const loginWithOAuth = async (provider, nextPath = '/dashboard') => {
    setLoading(true);
    setError(null);
    // Store nextPath in localStorage so AuthCallbackPage can read it after redirect.
    // We do NOT put ?next= in redirectTo because Supabase validates the redirect_uri
    // against its allowlist exact-match (query params make it fail with 401).
    try { localStorage.setItem('oauth_next_path', nextPath); } catch { /* ignore */ }
    try { sessionStorage.setItem('oauth_next_path', nextPath); } catch { /* ignore */ }
    const redirectTo = `${window.location.origin}/auth/callback`;
    const { data, error: authError } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo,
        // On contrôle nous‑mêmes la redirection pour éviter les aller‑retour visuels.
        skipBrowserRedirect: true,
      },
    });
    if (authError) {
      setLoading(false);
      setError(authError.message);
      return { data: null, error: authError };
    }
    if (data?.url) {
      // Redirige immédiatement le navigateur vers Google (ou la page OAuth) en une seule transition.
      window.location.assign(data.url);
      // On garde loading=true jusqu'à la navigation pour éviter le clignotement de l'écran login.
      return { data, error: null };
    }
    setLoading(false);
    return { data, error: null };
  };

  const refreshProfile = useCallback(async () => {
    try {
      const { data: { session: s } } = await supabase.auth.getSession();
      if (!s?.user) return;
      setSession(s);
      const profile = await ensureVisitorProfile(s.user);
      setUser(buildUser(s.user, profile));
    } catch (e) {
      console.warn('[auth] refreshProfile:', e?.message || e);
    }
  }, []);

  const value = {
    user,
    session,
    loading,
    error,
    signup,
    login,
    loginWithOAuth,
    logout,
    resetPassword,
    updatePassword,
    refreshProfile,
    ensureStudentMembership,
    supabase,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
