import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { getLoginEntryPath } from '@/lib/loginEntryPath';

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

const buildUser = (authUser, profile) => {
  if (!authUser) return null;
  const meta = authUser.user_metadata || {};
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
    role: profile?.role || meta.role || 'visitor',
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
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        setSession(currentSession);
        if (currentSession?.user) {
          const profile = await ensureVisitorProfile(currentSession.user);
          setUser(buildUser(currentSession.user, profile));
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
        setSession(newSession);
        if (newSession?.user) {
          const profile = await ensureVisitorProfile(newSession.user);
          setUser(buildUser(newSession.user, profile));
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
        try {
          const profile = await ensureVisitorProfile(data.session.user);
          setUser(buildUser(data.session.user, profile));
        } catch (e) {
          console.warn('[auth] login profile fetch:', e?.message || e);
          setUser(buildUser(data.session.user, null));
        }
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
    return { data, error: null };
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn('[auth] signOut error:', e?.message || e);
    }
    clearStaleOAuthState();
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
    supabase,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
