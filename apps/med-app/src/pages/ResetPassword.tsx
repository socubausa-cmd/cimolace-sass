import { useState, useEffect } from 'react';
import { useSupabase } from '../lib/auth';
import { useBranding } from '../lib/branding';
import { KeyRound } from 'lucide-react';

/**
 * Page de définition d'un nouveau mot de passe après le lien « mot de passe
 * oublié ». Le client Supabase (detectSessionInUrl) pose une session de
 * récupération depuis le hash de l'URL ; on attend cette session avant
 * d'autoriser `updateUser({ password })`. Rendue AVANT le gate d'auth dans
 * App.tsx (par pathname) pour ne pas rediriger l'utilisateur vers /dashboard
 * avant qu'il ait choisi son mot de passe.
 */
export function ResetPasswordPage() {
  const { supabase } = useSupabase();
  const branding = useBranding();
  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;
    // La session de récupération peut arriver via getSession (déjà parsée) ou
    // via l'événement PASSWORD_RECOVERY / SIGNED_IN émis au parse du hash.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return;
      if (session) { setHasSession(true); setReady(true); }
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (cancelled) return;
      if (session) { setHasSession(true); setReady(true); }
    });
    // Filet de sécurité : si rien après 2,5s, on considère le lien invalide.
    const t = setTimeout(() => { if (!cancelled) setReady(true); }, 2500);
    return () => { cancelled = true; subscription.unsubscribe(); clearTimeout(t); };
  }, [supabase]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 6) { setError('Le mot de passe doit faire au moins 6 caractères.'); return; }
    if (password !== confirm) { setError('Les deux mots de passe ne correspondent pas.'); return; }
    if (!supabase) { setError('Client indisponible.'); return; }
    setBusy(true);
    try {
      const { error: err } = await supabase.auth.updateUser({ password });
      if (err) throw err;
      setDone(true);
      // Petit délai pour afficher la confirmation, puis on entre dans l'app.
      setTimeout(() => {
        window.location.href = `/dashboard${window.location.search}`;
      }, 1200);
    } catch (err: any) {
      setError(err.message || 'Échec de la mise à jour du mot de passe.');
    } finally {
      setBusy(false);
    }
  };

  const card = (children: React.ReactNode) => (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--zw-bg)' }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 40, width: 400, boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          {branding.logoUrl
            ? <img src={branding.logoUrl} alt={branding.name} style={{ height: 48, objectFit: 'contain' }} />
            : <img src="/brand/nganga-logo.png" alt="Nganga" style={{ height: 84, objectFit: 'contain' }} />}
          <h1 style={{ fontSize: 22, fontWeight: 700, marginTop: 12 }}>Nouveau mot de passe</h1>
          <p style={{ color: 'var(--zw-text-muted)', marginTop: 4, fontSize: 14 }}>
            <span style={{ color: 'var(--brand-primary)', fontWeight: 600 }}>{branding.name}</span>
          </p>
        </div>
        {children}
      </div>
    </div>
  );

  if (!ready) {
    return card(<p style={{ textAlign: 'center', color: 'var(--zw-text-faint)' }}>Vérification du lien…</p>);
  }

  if (!hasSession) {
    return card(
      <div>
        <div style={{ background: '#fef2f2', color: '#dc2626', padding: 12, borderRadius: 8, fontSize: 13, marginBottom: 16 }}>
          Ce lien de réinitialisation est invalide ou a expiré.
        </div>
        <a href={`/${window.location.search}`} style={{
          display: 'block', textAlign: 'center', padding: 12, background: 'var(--brand-primary)',
          color: '#fff', borderRadius: 8, fontWeight: 600, textDecoration: 'none', fontSize: 14,
        }}>Retour à la connexion</a>
      </div>
    );
  }

  if (done) {
    return card(
      <div style={{ background: '#f0fdf4', color: '#16a34a', padding: 12, borderRadius: 8, fontSize: 14, textAlign: 'center' }}>
        Mot de passe mis à jour. Connexion en cours…
      </div>
    );
  }

  return card(
    <form onSubmit={submit}>
      {error && (
        <div style={{ background: '#fef2f2', color: '#dc2626', padding: 10, borderRadius: 8, marginBottom: 16, fontSize: 13 }}>{error}</div>
      )}
      <input
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Nouveau mot de passe"
        type="password"
        required
        minLength={6}
        style={{ width: '100%', padding: 12, border: '1px solid var(--zw-border)', borderRadius: 8, fontSize: 14, marginBottom: 12, boxSizing: 'border-box' }}
      />
      <input
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        placeholder="Confirmer le mot de passe"
        type="password"
        required
        minLength={6}
        style={{ width: '100%', padding: 12, border: '1px solid var(--zw-border)', borderRadius: 8, fontSize: 14, marginBottom: 20, boxSizing: 'border-box' }}
      />
      <button
        type="submit"
        disabled={busy}
        style={{
          width: '100%', padding: 12, background: 'var(--brand-primary)', color: '#fff', border: 'none',
          borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: busy ? 'default' : 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: busy ? 0.7 : 1,
        }}
      >
        <KeyRound size={18} /> Définir le mot de passe
      </button>
    </form>
  );
}
