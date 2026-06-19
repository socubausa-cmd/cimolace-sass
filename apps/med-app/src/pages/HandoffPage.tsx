import { useEffect, useState } from 'react';
import { useSupabase } from '../lib/auth';

const API = import.meta.env.VITE_API_URL || 'http://localhost:4002';

/**
 * Cross-app SSO landing for the EMBEDDED practitioner dashboard. The tenant's
 * site (e.g. zahirwellness.com) loads this in an iframe with a one-time code
 * minted server-side (POST /v1/medos/embed/practitioner-token). We exchange
 * the code for the practitioner's session, setSession, and redirect to the
 * dashboard — so the practitioner is authenticated without ever leaving their
 * own site, and no token ever appears in a URL.
 */
export function HandoffPage() {
  const { supabase } = useSupabase();
  const [error, setError] = useState('');

  useEffect(() => {
    if (!supabase) return;
    (async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      let next = params.get('next') || '/dashboard';
      if (!next.startsWith('/') || next.startsWith('//')) next = '/dashboard';
      const tenant = params.get('tenant');
      if (tenant) localStorage.setItem('tenant_slug', tenant);
      if (!code) { setError('Lien de connexion invalide (code manquant).'); return; }
      try {
        const res = await fetch(API + '/auth/handoff/exchange', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code }),
        });
        if (!res.ok) throw new Error('Lien expiré ou déjà utilisé.');
        const t = await res.json();
        const tokens = t?.data || t;
        if (!tokens?.access_token || !tokens?.refresh_token) {
          throw new Error('Réponse de connexion invalide.');
        }
        const { error: sErr } = await supabase.auth.setSession({
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
        });
        if (sErr) throw sErr;
        // Drop the code from history, then full-load the dashboard so the app
        // re-bootstraps with the freshly-set session.
        window.history.replaceState({}, '', '/handoff');
        window.location.replace(next);
      } catch (e: any) {
        setError(e?.message || 'Échec de la connexion.');
      }
    })();
  }, [supabase]);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, background: 'var(--zw-bg)', padding: 24 }}>
      {!error ? (
        <>
          <div style={{ width: 36, height: 36, border: '3px solid var(--zw-border)', borderTopColor: 'var(--brand-primary, #10b981)', borderRadius: '50%', animation: 'hspin 0.8s linear infinite' }} />
          <p style={{ color: 'var(--zw-text-muted)', fontSize: 14 }}>Connexion à votre espace…</p>
          <style>{'@keyframes hspin{to{transform:rotate(360deg)}}'}</style>
        </>
      ) : (
        <div style={{ maxWidth: 360, textAlign: 'center', background: '#fff', border: '1px solid #fecaca', borderRadius: 12, padding: 20 }}>
          <p style={{ color: '#dc2626', fontWeight: 600, fontSize: 14, margin: 0 }}>{error}</p>
          <p style={{ color: 'var(--zw-text-faint)', fontSize: 12, marginTop: 8 }}>Relancez l'accès Nganga depuis votre site.</p>
        </div>
      )}
    </div>
  );
}
