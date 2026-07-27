import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { PORTAL_URL, setActiveTenantId, setAuthToken, TENANT_SLUG } from './liri-api';
import { supabase } from './supabase';

interface AuthValue {
  session: Session | null;
  loading: boolean;
  email: string | null;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  resetPassword: (email: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
}

/**
 * Supabase renvoie ses erreurs d'authentification en ANGLAIS. Les laisser passer
 * telles quelles affichait « Invalid login credentials » au milieu d'une app
 * entièrement française — constaté sur émulateur.
 *
 * On traduit les cas courants et on garde le message d'origine en dernier
 * recours : mieux vaut un texte anglais qu'un « une erreur est survenue » qui
 * n'apprend rien à l'utilisateur.
 */
export function messageAuth(raw?: string): string {
  const m = String(raw ?? '').toLowerCase();
  if (m.includes('invalid login credentials')) return 'E-mail ou mot de passe incorrect.';
  if (m.includes('email not confirmed')) return "Cette adresse n'est pas encore confirmée. Vérifie ta boîte mail.";
  if (m.includes('too many requests') || m.includes('rate limit')) return 'Trop de tentatives. Réessaie dans quelques minutes.';
  if (m.includes('user not found')) return 'Aucun compte pour cette adresse.';
  if (m.includes('network') || m.includes('fetch')) return 'Connexion impossible. Vérifie ton réseau.';
  return raw || 'Connexion impossible.';
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
        return error ? { error: messageAuth(error.message) } : {};
      },
      /**
       * Envoie le lien de réinitialisation. Une app mobile n'a pas d'origine
       * HTTP : on renvoie vers la page /update-password du portail web, celle
       * que le web utilise déjà.
       */
      resetPassword: async (email) => {
        const trimmed = String(email ?? '').trim();
        if (!trimmed) return { error: 'Renseigne ton adresse e-mail d’abord.' };
        const { error } = await supabase.auth.resetPasswordForEmail(trimmed, {
          redirectTo: `${PORTAL_URL}/update-password`,
        });
        return error ? { error: messageAuth(error.message) } : {};
      },
      signOut: async () => {
        await supabase.auth.signOut();
      },
    }),
    [session, loading],
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}
