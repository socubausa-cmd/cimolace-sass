import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSupabase } from '../lib/auth';
import { useBranding } from '../lib/branding';
import { Heart, ShieldCheck, CheckCircle2 } from 'lucide-react';

// Cible du lien de récupération Supabase (resetPasswordForEmail → redirectTo).
// Le client Supabase (detectSessionInUrl) établit une session "recovery" à
// partir du hash de l'URL ; on l'utilise pour poser le nouveau mot de passe.
// White-label : marque tenant, aucune mention MEDOS/Cimolace.
export function ResetPassword() {
  const { supabase, session, loading } = useSupabase();
  const branding = useBranding();
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  // Laisse au client Supabase le temps de parser le hash de récupération.
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setReady(true), 1200);
    return () => clearTimeout(t);
  }, []);

  const hasRecovery =
    !!session ||
    (typeof window !== 'undefined' &&
      window.location.hash.includes('type=recovery'));

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: 12,
    border: '1px solid #e2e8f0',
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
    if (!supabase) {
      setError('Service indisponible.');
      return;
    }
    setBusy(true);
    try {
      const { error: uErr } = await supabase.auth.updateUser({ password });
      if (uErr) throw uErr;
      setDone(true);
    } catch (err: any) {
      setError(
        err?.message ||
          "Le lien est invalide ou a expiré. Redemandez un lien depuis la page de connexion.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f8fafc',
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
            {done ? 'Mot de passe modifié' : 'Nouveau mot de passe'}
          </h1>
          <p style={{ color: '#64748b', marginTop: 4 }}>{branding.name}</p>
        </div>

        {done ? (
          <div style={{ textAlign: 'center' }}>
            <CheckCircle2
              size={48}
              color="var(--brand-primary)"
              style={{ margin: '0 auto 12px' }}
            />
            <p style={{ color: '#334155', fontSize: 14, lineHeight: 1.5 }}>
              Votre mot de passe a été mis à jour.
            </p>
            <button
              onClick={() => navigate('/dashboard')}
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
              }}
            >
              Aller à mon espace
            </button>
          </div>
        ) : !hasRecovery && ready && !loading ? (
          <div
            style={{
              background: '#fef2f2',
              color: '#dc2626',
              padding: 12,
              borderRadius: 8,
              fontSize: 13,
              lineHeight: 1.5,
            }}
          >
            Lien de réinitialisation invalide ou expiré. Ouvrez le lien depuis
            l'e-mail reçu, ou redemandez-en un depuis la page de connexion.
          </div>
        ) : (
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
                color: '#64748b',
                fontSize: 13,
                marginBottom: 16,
                lineHeight: 1.5,
              }}
            >
              Choisissez un nouveau mot de passe pour votre espace.
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
                disabled={busy}
                style={{
                  width: '100%',
                  padding: 12,
                  background: 'var(--brand-primary)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  fontSize: 15,
                  fontWeight: 600,
                  cursor: busy ? 'wait' : 'pointer',
                  opacity: busy ? 0.7 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                <ShieldCheck size={18} />{' '}
                {busy ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
