import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';

const AuthCallbackPage = () => {
  const location = useLocation();
  const [timedOut, setTimedOut] = useState(false);
  const [debugState, setDebugState] = useState('waiting_session');
  const redirectedRef = useRef(false);
  const debugEnabled = import.meta.env.DEV && import.meta.env.VITE_AUTH_DEBUG === 'true';
  const authFlow = String(import.meta.env.VITE_SUPABASE_AUTH_FLOW || 'pkce').toLowerCase();

  const hasCodeInUrl = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return !!params.get('code');
  }, [location.search]);
  const hasHashTokensInUrl = useMemo(() => {
    const hash = String(window.location.hash || '');
    let fallbackHash = '';
    if (!hash) {
      try {
        fallbackHash = String(window.sessionStorage.getItem('__isna_auth_callback_hash__') || '');
      } catch {
        fallbackHash = '';
      }
    }
    const effectiveHash = hash || fallbackHash;
    if (!effectiveHash || effectiveHash.length < 2) return false;
    const params = new URLSearchParams(effectiveHash.startsWith('#') ? effectiveHash.slice(1) : effectiveHash);
    return Boolean(params.get('access_token') && params.get('refresh_token'));
  }, [location.hash]);
  const isSafari = useMemo(() => {
    const ua = String(navigator.userAgent || '').toLowerCase();
    const isWebkit = ua.includes('safari') && !ua.includes('chrome') && !ua.includes('chromium');
    return isWebkit;
  }, []);

  const { siteOrigin, callbackUrl, isLocalDev } = useMemo(() => {
    if (typeof window === 'undefined') {
      return { siteOrigin: '', callbackUrl: '', isLocalDev: false };
    }
    const o = window.location.origin;
    const local =
      /^(https?:\/\/)(localhost|127\.0\.0\.1)(:\d+)?$/i.test(o) ||
      /^https?:\/\/192\.168\./i.test(o) ||
      /^https?:\/\/10\./i.test(o);
    return { siteOrigin: o, callbackUrl: `${o}/auth/callback`, isLocalDev: local };
  }, []);

  const nextPath = useMemo(() => {
    // Primary: localStorage key written by loginWithOAuth before redirect
    try {
      const stored = localStorage.getItem('oauth_next_path');
      if (stored && stored.startsWith('/')) {
        localStorage.removeItem('oauth_next_path');
        return stored;
      }
    } catch { /* ignore */ }
    try {
      const stored = sessionStorage.getItem('oauth_next_path');
      if (stored && stored.startsWith('/')) {
        sessionStorage.removeItem('oauth_next_path');
        return stored;
      }
    } catch { /* ignore */ }
    // Fallback: ?next= query param (legacy / direct link)
    const params = new URLSearchParams(location.search);
    const next = params.get('next');
    if (next && next.startsWith('/')) return next;
    return '/dashboard';
  }, [location.search]);

  useEffect(() => {
    if (debugEnabled) console.log('[AuthCallback] mounted, nextPath:', nextPath);

    const redirect = (reason) => {
      if (redirectedRef.current) return;
      redirectedRef.current = true;
      if (debugEnabled) console.log('[AuthCallback] redirect triggered, reason:', reason);
      setDebugState('session_ok_redirect');
      window.location.replace(nextPath);
    };

    // Hard timeout: if no session after 15s, show error
    const timeoutId = window.setTimeout(() => {
      if (redirectedRef.current) return;
      if (debugEnabled) console.log('[AuthCallback] timeout reached, no session found');
      setTimedOut(true);
      setDebugState('timeout');
    }, 15_000);

    // Safari / WebKit can occasionally miss Supabase's automatic implicit-flow session detection.
    // If tokens are present in the hash, establish the session explicitly as a fallback.
    let callbackHash = String(window.location.hash || '');
    if (!callbackHash) {
      try {
        callbackHash = String(window.sessionStorage.getItem('__isna_auth_callback_hash__') || '');
      } catch {
        callbackHash = '';
      }
    }
    const hashParams = new URLSearchParams(callbackHash.replace(/^#/, ''));
    const accessToken = hashParams.get('access_token');
    const refreshToken = hashParams.get('refresh_token');
    if (authFlow !== 'pkce' && accessToken && refreshToken) {
      setDebugState('setting_hash_session');
      const attemptSetSession = async (retries = 2) => {
        try {
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (debugEnabled) console.log('[AuthCallback] setSession(hash):', { user: !!data?.session?.user, error: error?.message });
          if (data?.session?.user) {
            try {
              window.sessionStorage.removeItem('__isna_auth_callback_hash__');
              window.sessionStorage.removeItem('__isna_auth_callback_search__');
            } catch {
              // ignore
            }
            window.clearTimeout(timeoutId);
            redirect('setSession(hash)');
            return;
          }
          if (error && retries > 0) {
            setDebugState('set_hash_session_retry');
            window.setTimeout(() => { attemptSetSession(retries - 1); }, 700);
          }
        } catch (e) {
          if (debugEnabled) console.warn('[AuthCallback] setSession(hash) error:', e?.message);
          if (retries > 0) {
            setDebugState('set_hash_session_retry_network');
            window.setTimeout(() => { attemptSetSession(retries - 1); }, 700);
          }
        }
      };
      attemptSetSession();
    }

    // PKCE only: explicitly exchange the code when present in URL.
    // In implicit flow there is no code exchange (tokens are in URL hash).
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (authFlow === 'pkce' && code) {
      setDebugState('exchanging_code');
      const attemptExchange = async (retries = 2) => {
        try {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          if (debugEnabled) console.log('[AuthCallback] exchangeCodeForSession:', { user: !!data?.session?.user, error: error?.message });
          if (data?.session?.user) {
            window.clearTimeout(timeoutId);
            redirect('exchangeCodeForSession');
            return;
          }
          if (error && retries > 0) {
            setDebugState('exchange_retry');
            window.setTimeout(() => { attemptExchange(retries - 1); }, 700);
          }
        } catch (e) {
          if (debugEnabled) console.warn('[AuthCallback] exchangeCodeForSession error:', e?.message);
          if (retries > 0) {
            setDebugState('exchange_retry_network');
            window.setTimeout(() => { attemptExchange(retries - 1); }, 700);
          }
        }
      };
      attemptExchange();
    }

    // Polling fallback every 500ms: handles race condition where SIGNED_IN
    // fired before our subscription was registered (exchange completed very fast)
    let pollId;
    const checkSession = async () => {
      if (redirectedRef.current) return;
      try {
        const { data } = await supabase.auth.getSession();
        if (debugEnabled) console.log('[AuthCallback] poll: session?', !!data?.session?.user);
        if (data?.session?.user) {
          window.clearTimeout(timeoutId);
          window.clearInterval(pollId);
          redirect('poll');
        }
      } catch (e) {
        if (debugEnabled) console.warn('[AuthCallback] getSession error:', e?.message);
      }
    };
    checkSession();
    pollId = window.setInterval(checkSession, 500);

    // onAuthStateChange: INITIAL_SESSION fires immediately on subscribe with
    // current session — catches case where exchange completed before subscription.
    // SIGNED_IN fires when detectSessionInUrl exchange completes after subscribe.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (debugEnabled) console.log('[AuthCallback] auth event:', event, 'session:', !!session?.user);
      if (
        (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') &&
        session?.user
      ) {
        window.clearTimeout(timeoutId);
        window.clearInterval(pollId);
        redirect(event);
      }
    });

    return () => {
      window.clearTimeout(timeoutId);
      window.clearInterval(pollId);
      subscription.unsubscribe();
    };
  }, [nextPath, debugEnabled]);

  return (
    <div className="min-h-screen bg-[#0F1419] text-white flex items-center justify-center p-6">
      <div className="max-w-md text-center">
        <div className="text-xl font-bold">Connexion en cours…</div>
        <div className="text-sm text-gray-400 mt-2">
          Nous finalisons votre authentification.
        </div>
        {debugEnabled ? (
          <div className="mt-3 inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-gray-300">
            debug: {debugState}
          </div>
        ) : null}
        {timedOut ? (
          <div className="text-sm text-gray-400 mt-4 space-y-2">
            {hasCodeInUrl || hasHashTokensInUrl ? (
              <>
                <p>La connexion n’a pas pu finaliser la session. Causes possibles :</p>
                <ul className="text-left list-disc list-inside max-w-sm mx-auto space-y-1">
                  <li>Utilisez le <strong>même onglet</strong> que pour démarrer la connexion</li>
                  <li>Vérifiez que les cookies ne sont pas bloqués</li>
                </ul>
                <p className="mt-3 text-left text-xs text-gray-300 max-w-sm mx-auto">
                  Dans Supabase → <strong>Authentication</strong> → <strong>URL Configuration</strong> →{' '}
                  <strong>Redirect URLs</strong>, la valeur à autoriser est <strong>celle de cette page</strong> (même hôte
                  et port que la barre d’adresse) :
                </p>
                <p className="mt-1 rounded-md border border-white/10 bg-black/30 px-2 py-1.5 text-left">
                  <code className="text-[11px] break-all text-amber-200/95">{callbackUrl || '—'}</code>
                </p>
                {isLocalDev ? (
                  <p className="mt-2 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-left text-xs text-amber-100/95">
                    En local, si le port de Vite change, ce lien change aussi : ajoutez <strong>exactement</strong> l’URL
                    ci-dessus dans les Redirect URLs (pas un autre port).
                  </p>
                ) : null}
                {isSafari ? (
                  <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100 text-left max-w-sm mx-auto">
                    <p className="font-semibold text-amber-200 mb-1">Safari détecté — vérifications rapides</p>
                    <ul className="list-disc list-inside space-y-1">
                      <li>Désactivez temporairement les bloqueurs de contenu / extensions privacy</li>
                      <li>Testez sans VPN / proxy et sans Relais privé iCloud</li>
                      <li>
                        Autorisez les cookies pour <code className="text-[11px] break-all">{siteOrigin || 'votre domaine'}</code> et{' '}
                        <code className="text-[11px]">supabase.co</code>
                      </li>
                      <li>Relancez la connexion dans ce même onglet</li>
                    </ul>
                  </div>
                ) : null}
              </>
            ) : (
              <p>Si rien ne se passe, retourne sur la page de connexion et réessaie.</p>
            )}
            <a
              href={`/login?next=${encodeURIComponent(nextPath)}`}
              className="inline-block mt-3 text-amber-400 hover:text-amber-300 underline"
            >
              Retour à la connexion
            </a>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="block mx-auto mt-2 text-gray-300 hover:text-white underline"
            >
              Réessayer dans cet onglet
            </button>
          </div>
        ) : null}
        {debugEnabled ? (
          <div className="text-xs text-gray-500 mt-2 break-all">{debugState}</div>
        ) : null}
      </div>
    </div>
  );
};

export default AuthCallbackPage;
