import { useState } from 'react';
import { useAuth } from '../lib/auth';
import { useBranding } from '../lib/branding';
import { LogIn } from 'lucide-react';

// Logo Google officiel (4 couleurs) — inline pour éviter une dépendance asset.
function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.71-1.57 2.68-3.89 2.68-6.62z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.02-3.7H.96v2.33A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.98 10.72a5.41 5.41 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.02-2.33z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.02 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
    </svg>
  );
}

export function LoginPage() {
  const { signIn, signUp, signInWithGoogle, resetPassword, loading } = useAuth();
  const branding = useBranding();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setInfo('');
    try {
      if (isSignUp) await signUp(email, password);
      else await signIn(email, password);
    } catch (err: any) {
      setError(err.message || "Erreur d'authentification");
    }
  };

  const onGoogle = async () => {
    setError(''); setInfo('');
    setBusy(true);
    try {
      await signInWithGoogle();
      // redirection navigateur ; rien à faire de plus
    } catch (err: any) {
      setError(err.message || 'Connexion Google indisponible');
      setBusy(false);
    }
  };

  const onForgot = async () => {
    setError(''); setInfo('');
    if (!email) {
      setError("Entrez d'abord votre email, puis cliquez « Mot de passe oublié ».");
      return;
    }
    setBusy(true);
    try {
      await resetPassword(email);
      setInfo(`Un email de réinitialisation a été envoyé à ${email}. Vérifiez votre boîte (et les spams).`);
    } catch (err: any) {
      setError(err.message || "Impossible d'envoyer l'email de réinitialisation");
    } finally {
      setBusy(false);
    }
  };

  // The login page is the first contact — use tenant logo if available so
  // the user feels at home (Strategy C: tenant-first on entry surface).
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--zw-bg)',
      }}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 16,
          padding: 40,
          width: 400,
          boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          {branding.logoUrl ? (
            <img
              src={branding.logoUrl}
              alt={branding.name}
              style={{ height: 48, objectFit: 'contain' }}
            />
          ) : (
            <img src="/brand/nganga-logo.png" alt="Nganga" style={{ height: 84, objectFit: 'contain' }} />
          )}
          <h1 style={{ fontSize: 24, fontWeight: 700, marginTop: 12 }}>
            Nganga
          </h1>
          <p style={{ color: 'var(--zw-text-muted)', marginTop: 4 }}>
            {isSignUp ? 'Créer mon compte praticien' : 'Espace praticien'}
            {' · '}
            <span style={{ color: 'var(--brand-primary)', fontWeight: 600 }}>
              {branding.name}
            </span>
          </p>
        </div>
        {error && (
          <div
            style={{
              background: '#fef2f2',
              color: '#dc2626',
              padding: 10,
              borderRadius: 8,
              marginBottom: 16,
              fontSize: 13,
            }}
          >
            {error}
          </div>
        )}
        {info && (
          <div
            style={{
              background: '#f0fdf4',
              color: '#16a34a',
              padding: 10,
              borderRadius: 8,
              marginBottom: 16,
              fontSize: 13,
            }}
          >
            {info}
          </div>
        )}

        {/* Connexion Google — chemin sans mot de passe, recommandé */}
        <button
          type="button"
          onClick={onGoogle}
          disabled={busy || loading}
          style={{
            width: '100%',
            padding: 12,
            background: '#fff',
            color: '#1f2937',
            border: '1px solid var(--zw-border)',
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 600,
            cursor: busy ? 'default' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            opacity: busy ? 0.7 : 1,
          }}
        >
          <GoogleMark /> Se connecter avec Google
        </button>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            margin: '18px 0',
            color: 'var(--zw-text-faint)',
            fontSize: 12,
          }}
        >
          <span style={{ flex: 1, height: 1, background: 'var(--zw-border)' }} />
          ou
          <span style={{ flex: 1, height: 1, background: 'var(--zw-border)' }} />
        </div>

        <form onSubmit={submit}>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            type="email"
            required
            style={{
              width: '100%',
              padding: 12,
              border: '1px solid var(--zw-border)',
              borderRadius: 8,
              fontSize: 14,
              marginBottom: 12,
              boxSizing: 'border-box',
            }}
          />
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mot de passe"
            type="password"
            required
            minLength={6}
            style={{
              width: '100%',
              padding: 12,
              border: '1px solid var(--zw-border)',
              borderRadius: 8,
              fontSize: 14,
              marginBottom: isSignUp ? 20 : 8,
              boxSizing: 'border-box',
            }}
          />
          {!isSignUp && (
            <div style={{ textAlign: 'right', marginBottom: 16 }}>
              <button
                type="button"
                onClick={onForgot}
                disabled={busy}
                style={{
                  color: 'var(--brand-primary)',
                  fontSize: 13,
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                Mot de passe oublié ?
              </button>
            </div>
          )}
          <button
            type="submit"
            disabled={loading || busy}
            style={{
              width: '100%',
              padding: 12,
              background: 'var(--brand-primary)',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              fontSize: 15,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            <LogIn size={18} /> {isSignUp ? 'Créer mon compte' : 'Se connecter'}
          </button>
        </form>
        <p
          style={{
            textAlign: 'center',
            marginTop: 16,
            fontSize: 13,
            color: 'var(--zw-text-muted)',
          }}
        >
          {isSignUp ? 'Déjà un compte ?' : 'Pas encore de compte ?'}{' '}
          <button
            onClick={() => { setIsSignUp(!isSignUp); setError(''); setInfo(''); }}
            style={{
              color: 'var(--brand-primary)',
              fontWeight: 600,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            {isSignUp ? 'Se connecter' : 'Créer un compte'}
          </button>
        </p>
      </div>
    </div>
  );
}
