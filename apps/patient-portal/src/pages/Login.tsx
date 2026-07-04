import { useState } from 'react';
import { useAuth, useSupabase } from '../lib/auth';
import { useBranding } from '../lib/branding';
import { Heart, LogIn, MailCheck } from 'lucide-react';

// Strategy B login surface — the patient should believe they're on the
// tenant's own portal. Logo prominent, color = brand_primary, no MEDOS
// mention here. The "Mon espace" label is generic enough to feel native.
export function PatientLogin() {
  const { signIn, signUp, loading } = useAuth();
  const { supabase } = useSupabase();
  const branding = useBranding();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [forgot, setForgot] = useState(false);
  const [sent, setSent] = useState(false);

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: 12,
    border: '1px solid #ece7e1',
    borderRadius: 8,
    fontSize: 14,
    marginBottom: 12,
    boxSizing: 'border-box',
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      if (forgot) {
        if (!supabase) throw new Error('Service indisponible.');
        const { error: rErr } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin + '/reset-password',
        });
        if (rErr) throw rErr;
        setSent(true);
        return;
      }
      if (isSignUp) await signUp(email, password);
      else await signIn(email, password);
    } catch (err: any) {
      setError(err.message || 'Erreur');
    }
  };

  const linkBtn: React.CSSProperties = {
    color: 'var(--brand-primary)',
    fontWeight: 600,
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 0,
    fontSize: 13,
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#fafaf8',
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
              style={{ height: 56, objectFit: 'contain' }}
            />
          ) : (
            <Heart size={40} color="var(--brand-primary)" />
          )}
          <h1 style={{ fontSize: 24, fontWeight: 700, marginTop: 12 }}>
            {forgot ? 'Mot de passe oublié' : 'Espace patient'}
          </h1>
          <p style={{ color: '#8a8580', marginTop: 4 }}>{branding.name}</p>
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

        {forgot && sent ? (
          <div style={{ textAlign: 'center' }}>
            <MailCheck
              size={44}
              color="var(--brand-primary)"
              style={{ margin: '0 auto 12px' }}
            />
            <p style={{ color: '#3a3632', fontSize: 14, lineHeight: 1.5 }}>
              Si un compte existe pour <strong>{email}</strong>, un lien de
              réinitialisation vient d'être envoyé. Vérifiez votre boîte mail.
            </p>
            <button
              onClick={() => {
                setForgot(false);
                setSent(false);
                setError('');
              }}
              style={{ ...linkBtn, marginTop: 18 }}
            >
              Retour à la connexion
            </button>
          </div>
        ) : (
          <>
            {forgot && (
              <p
                style={{
                  color: '#8a8580',
                  fontSize: 13,
                  marginBottom: 16,
                  lineHeight: 1.5,
                }}
              >
                Saisissez votre adresse e-mail : nous vous enverrons un lien pour
                choisir un nouveau mot de passe.
              </p>
            )}
            <form onSubmit={submit}>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                type="email"
                required
                style={inputStyle}
              />
              {!forgot && (
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mot de passe"
                  type="password"
                  required
                  minLength={6}
                  style={{ ...inputStyle, marginBottom: 20 }}
                />
              )}
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
                  marginTop: forgot ? 8 : 0,
                }}
              >
                <LogIn size={18} />{' '}
                {forgot
                  ? 'Envoyer le lien'
                  : isSignUp
                    ? 'Créer mon espace'
                    : 'Accéder'}
              </button>
            </form>

            {forgot ? (
              <p style={{ textAlign: 'center', marginTop: 16 }}>
                <button
                  onClick={() => {
                    setForgot(false);
                    setError('');
                  }}
                  style={linkBtn}
                >
                  Retour à la connexion
                </button>
              </p>
            ) : (
              <>
                {!isSignUp && (
                  <p style={{ textAlign: 'center', marginTop: 14 }}>
                    <button
                      onClick={() => {
                        setForgot(true);
                        setError('');
                      }}
                      style={linkBtn}
                    >
                      Mot de passe oublié ?
                    </button>
                  </p>
                )}
                <p
                  style={{
                    textAlign: 'center',
                    marginTop: 12,
                    fontSize: 13,
                    color: '#8a8580',
                  }}
                >
                  {isSignUp ? 'Déjà un espace ?' : 'Première visite ?'}{' '}
                  <button
                    onClick={() => setIsSignUp(!isSignUp)}
                    style={{ ...linkBtn, fontSize: 13 }}
                  >
                    {isSignUp ? 'Se connecter' : 'Créer'}
                  </button>
                </p>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
