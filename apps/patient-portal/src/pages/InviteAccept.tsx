import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useBranding } from '../lib/branding';
import { Heart, ShieldCheck, LogIn, CheckCircle2 } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:4002';

// Acceptation d'invitation patient (Strategy B, white-label) : le patient
// arrive via le lien envoyé par son praticien (…/invite/accept?token=…),
// choisit son mot de passe, et son accès est activé. Aucune mention de
// MEDOS/Cimolace : il croit être sur le portail de son cabinet.
export function InviteAccept() {
  const branding = useBranding();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [doneEmail, setDoneEmail] = useState<string | null>(null);
  const [done, setDone] = useState(false);

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
    if (password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères.');
      return;
    }
    if (password !== confirm) {
      setError('Les deux mots de passe ne correspondent pas.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API}/med/invitations-public/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg =
          (body && (body.message || body.error)) ||
          "Le lien d'invitation est invalide ou a expiré.";
        throw new Error(Array.isArray(msg) ? msg.join(', ') : msg);
      }
      setDoneEmail((body && body.email) || null);
      setDone(true);
    } catch (err: any) {
      setError(err.message || 'Activation impossible.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#fafaf8',
        padding: 16,
      }}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 16,
          padding: 40,
          width: 420,
          maxWidth: '100%',
          boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          {branding.logoUrl ? (
            <img
              src={branding.logoUrl}
              alt={branding.name}
              style={{ height: 56, objectFit: 'contain' }}
            />
          ) : (
            <Heart size={40} color="var(--brand-primary)" />
          )}
          <h1 style={{ fontSize: 22, fontWeight: 700, marginTop: 12 }}>
            {done ? 'Espace activé' : 'Activer mon espace'}
          </h1>
          <p style={{ color: '#8a8580', marginTop: 4 }}>{branding.name}</p>
        </div>

        {!token && !done && (
          <div
            style={{
              background: '#fef2f2',
              color: '#dc2626',
              padding: 12,
              borderRadius: 8,
              fontSize: 13,
            }}
          >
            Lien d'invitation incomplet. Demandez un nouveau lien à votre
            praticien.
          </div>
        )}

        {done ? (
          <div style={{ textAlign: 'center' }}>
            <CheckCircle2
              size={48}
              color="var(--brand-primary)"
              style={{ margin: '0 auto 12px' }}
            />
            <p style={{ color: '#3a3632', fontSize: 14, lineHeight: 1.5 }}>
              Votre mot de passe est défini. Vous pouvez maintenant vous
              connecter
              {doneEmail ? (
                <>
                  {' '}
                  avec l'adresse <strong>{doneEmail}</strong>
                </>
              ) : null}
              .
            </p>
            <button
              onClick={() => navigate('/connexion')}
              style={{
                width: '100%',
                marginTop: 18,
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
              <LogIn size={18} /> Me connecter
            </button>
          </div>
        ) : (
          token && (
            <>
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
              <p
                style={{
                  color: '#8a8580',
                  fontSize: 13,
                  marginBottom: 16,
                  lineHeight: 1.5,
                }}
              >
                Choisissez un mot de passe pour accéder à votre espace de suivi.
              </p>
              <form onSubmit={submit}>
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Nouveau mot de passe"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  style={inputStyle}
                />
                <input
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Confirmer le mot de passe"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  style={{ ...inputStyle, marginBottom: 20 }}
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
                    cursor: loading ? 'wait' : 'pointer',
                    opacity: loading ? 0.7 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                  }}
                >
                  <ShieldCheck size={18} />{' '}
                  {loading ? 'Activation…' : 'Activer mon espace'}
                </button>
              </form>
            </>
          )
        )}
      </div>
    </div>
  );
}
