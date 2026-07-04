import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { setActiveTenantId, setAuthToken, TENANT_SLUG } from './liri-api';
import { supabase } from './supabase';

interface AuthValue {
  session: Session | null;
  loading: boolean;
  email: string | null;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
}

const AuthCtx = createContext<AuthValue | null>(null);

export function useAuth(): AuthValue {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error('useAuth doit être utilisé dans <AuthProvider>');
  return ctx;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const syncTenant = async (next: Session | null) => {
      if (!next) {
        setActiveTenantId(null);
        return;
      }
      const { data } = await supabase
        .from('tenant_memberships')
        .select('tenant_id,tenants!inner(slug)')
        .eq('user_id', next.user.id)
        .eq('status', 'active')
        .eq('tenants.slug', TENANT_SLUG)
        .maybeSingle();
      if (active) setActiveTenantId(data?.tenant_id);
    };
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setAuthToken(data.session?.access_token ?? null);
      void syncTenant(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setAuthToken(next?.access_token ?? null);
      void syncTenant(next);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthValue>(
    () => ({
      session,
      loading,
      email: session?.user?.email ?? null,
      signIn: async (email, password) => {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        return error ? { error: error.message } : {};
      },
      signOut: async () => {
        await supabase.auth.signOut();
      },
    }),
    [session, loading],
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}
