import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

interface AuthState {
  supabase: SupabaseClient | null;
  user: any | null;
  session: any | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  supabase: null, user: null, session: null, loading: true,
  signIn: async () => {}, signUp: async () => {},
  signInWithGoogle: async () => {}, resetPassword: async () => {},
  signOut: async () => {},
});

export function SupabaseProvider({ children, url, anonKey }: { children: ReactNode; url: string; anonKey: string }) {
  const [supabase] = useState(() => createClient(url, anonKey));
  const [user, setUser] = useState<any>(null);
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Persist the access token under the key every page reads for its API
  // calls (`localStorage.getItem('supabase_token')`). Without this, a logged-in
  // user still sends an empty Bearer → every MEDOS API call 401s. Works for
  // ALL sign-in paths (password, Google OAuth, magic link, recovery, refresh)
  // because it hooks the session, not the login form.
  const syncToken = (s: any) => {
    const tok = s?.access_token;
    if (tok) localStorage.setItem('supabase_token', tok);
    else localStorage.removeItem('supabase_token');
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      syncToken(s); setSession(s); setUser(s?.user ?? null); setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      syncToken(s); setSession(s); setUser(s?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, [supabase]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };
  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
  };
  // Google OAuth — on revient sur l'app (origin + ?tenant=… préservé) ; la
  // session est posée par detectSessionInUrl puis captée par onAuthStateChange.
  const signInWithGoogle = async () => {
    const redirectTo = `${window.location.origin}/${window.location.search}`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    });
    if (error) throw error;
  };
  // Mot de passe oublié — envoie le mail de réinitialisation ; le lien renvoie
  // sur /reset-password (route rendue avant le gate d'auth dans App.tsx).
  const resetPassword = async (email: string) => {
    const redirectTo = `${window.location.origin}/reset-password${window.location.search}`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) throw error;
  };
  const signOut = async () => { await supabase.auth.signOut(); };

  return (
    <AuthContext.Provider value={{ supabase, user, session, loading, signIn, signUp, signInWithGoogle, resetPassword, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useSupabase() { return useContext(AuthContext); }

export function useAuth() {
  const { user, session, loading, signIn, signUp, signInWithGoogle, resetPassword, signOut } = useSupabase();
  return { user, session, loading, isAuthenticated: !!user, signIn, signUp, signInWithGoogle, resetPassword, signOut };
}
