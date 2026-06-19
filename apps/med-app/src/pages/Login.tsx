import { useState } from 'react';
import { useAuth } from '../lib/auth';
import { useBranding } from '../lib/branding';
import { LogIn } from 'lucide-react';

export function LoginPage() {
  const { signIn, signUp, loading } = useAuth();
  const branding = useBranding();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      if (isSignUp) await signUp(email, password);
      else await signIn(email, password);
    } catch (err: any) {
      setError(err.message || "Erreur d'authentification");
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
              marginBottom: 20,
              boxSizing: 'border-box',
            }}
          />
          <button
            type="submit"
            disabled={loading}
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
            onClick={() => setIsSignUp(!isSignUp)}
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
