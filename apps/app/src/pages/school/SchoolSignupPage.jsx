/**
 * Page d'inscription étudiant pour une école spécifique.
 * Route : /t/:tenantSlug/signup
 *
 * Étapes :
 * 1. Créer un compte (si pas encore inscrit)
 * 2. Rejoindre automatiquement le tenant de l'école
 * 3. Rediriger vers /t/:tenantSlug/courses
 */
import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useTenantBranding } from '@/hooks/useTenantBranding';
import { startGoogleOAuth } from '@/lib/googleOAuth';
import { authStore } from '@/lib/auth-store';
import { getApiBaseUrl } from '@/lib/apiBase';

async function autoJoinTenant(tenantSlug) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const token = authStore.getToken();
    if (token) {
      try {
        const res = await fetch(`${getApiBaseUrl()}/tenants/${encodeURIComponent(tenantSlug)}/join`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        });
        if (res.ok || res.status === 409) return;
      } catch {}
    }
    await new Promise((r) => setTimeout(r, 200));
  }
}

export default function SchoolSignupPage() {
  const { tenantSlug } = useParams();
  const navigate = useNavigate();
  const { signup, login, supabase } = useAuth();
  const { branding } = useTenantBranding();

  const [step, setStep] = useState('form'); // 'form' | 'success'
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', password: '', confirmPassword: '' });
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');

  const accent = branding?.accentColor ?? '#d97757';
  const schoolName = branding?.name ?? tenantSlug ?? 'Mon École';
  const logo = branding?.logo ?? null;

  const handleSignup = async (e) => {
    e.preventDefault();
    setError('');

    if (form.password !== form.confirmPassword) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }
    if (form.password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères.');
      return;
    }

    setLoading(true);
    try {
      const { error: signupError } = await signup(form.email, form.password, {
        first_name: form.firstName,
        last_name: form.lastName,
        display_name: `${form.firstName} ${form.lastName}`.trim(),
        tenant_slug: tenantSlug,
      });

      if (signupError) {
        if (signupError.message?.includes('already registered')) {
          // Compte existant → tenter la connexion directe
          const { error: loginError } = await login(form.email, form.password);
          if (loginError) {
            setError('Ce compte existe déjà. Vérifiez votre mot de passe ou connectez-vous.');
            return;
          }
        } else {
          setError(signupError.message ?? "Erreur lors de l'inscription.");
          return;
        }
      }

      authStore.setTenantSlug(tenantSlug);
      await autoJoinTenant(tenantSlug);
      setStep('success');
      setTimeout(() => navigate(`/t/${tenantSlug}/courses`), 2500);
    } catch (err) {
      setError(err?.message ?? "Erreur inattendue.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignup = async () => {
    setError('');
    setGoogleLoading(true);
    try {
      const redirectTo = `${window.location.origin}/cimolace/auth/google/callback?tenant=${encodeURIComponent(tenantSlug)}`;
      const { error: authError } = await startGoogleOAuth(supabase, {
        redirectTo,
        tenantSlug,
      });
      if (authError) {
        setError(authError.message ?? 'Connexion Google indisponible.');
        setGoogleLoading(false);
      }
      // startGoogleOAuth redirige via window.location.assign
    } catch (err) {
      setError(err?.message ?? 'Erreur Google OAuth');
      setGoogleLoading(false);
    }
  };

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  if (step === 'success') {
    return (
      <div style={{
        minHeight: '100vh', background: '#262624',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px',
        fontFamily: "'Inter', system-ui, sans-serif",
      }}>
        <div style={{ textAlign: 'center', maxWidth: '380px' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎉</div>
          <h2 style={{ color: '#f0f6fc', fontSize: '22px', fontWeight: 800, margin: '0 0 8px' }}>
            Bienvenue dans {schoolName} !
          </h2>
          <p style={{ color: '#8b949e', fontSize: '14px', margin: '0 0 24px' }}>
            Votre compte est créé. Redirection vers les cours…
          </p>
          <div style={{ width: '32px', height: '32px', border: `3px solid ${accent}33`, borderTopColor: accent, borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto' }} />
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      </div>
    );
  }

  const inputStyle = {
    width: '100%', padding: '10px 14px', borderRadius: '8px',
    border: '1px solid #21262d', background: '#262624',
    color: '#f0f6fc', fontSize: '14px', outline: 'none', boxSizing: 'border-box',
  };

  const labelStyle = {
    color: '#8b949e', fontSize: '12px', fontWeight: 600,
    display: 'block', marginBottom: '6px',
  };

  return (
    <div style={{
      minHeight: '100vh', background: '#262624',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px', fontFamily: "'Inter', system-ui, sans-serif",
    }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      <div style={{
        width: '100%', maxWidth: '440px',
        background: '#161b22', border: '1px solid #21262d',
        borderTop: `3px solid ${accent}`, borderRadius: '16px',
        padding: '36px', boxShadow: '0 24px 48px rgba(0,0,0,0.4)',
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          {logo ? (
            <img src={logo} alt={schoolName} style={{ height: '44px', objectFit: 'contain', marginBottom: '10px' }} />
          ) : (
            <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: `${accent}22`, border: `2px solid ${accent}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', margin: '0 auto 10px' }}>🎓</div>
          )}
          <h1 style={{ color: '#f0f6fc', fontSize: '20px', fontWeight: 800, margin: '0 0 4px' }}>
            Rejoindre {schoolName}
          </h1>
          <p style={{ color: '#8b949e', fontSize: '13px', margin: 0 }}>Créez votre compte étudiant</p>
        </div>

        {/* Error */}
        {error && (
          <div style={{ marginBottom: '18px', padding: '10px 14px', borderRadius: '8px', background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171', fontSize: '13px' }}>
            {error}
          </div>
        )}

        {/* Google */}
        <button
          onClick={handleGoogleSignup}
          disabled={googleLoading}
          style={{
            width: '100%', padding: '11px', borderRadius: '8px',
            border: '1px solid #21262d', background: '#f8fafc',
            color: '#0f172a', fontSize: '14px', fontWeight: 600,
            cursor: googleLoading ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
            marginBottom: '16px', opacity: googleLoading ? 0.7 : 1,
          }}
        >
          {googleLoading ? (
            <div style={{ width: '14px', height: '14px', border: '2px solid #e8cabb', borderTopColor: '#d97757', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
          ) : (
            <svg width="18" height="18" viewBox="0 0 18 18">
              <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
              <path d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05"/>
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z" fill="#EA4335"/>
            </svg>
          )}
          Continuer avec Google
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <div style={{ flex: 1, height: '1px', background: '#21262d' }} />
          <span style={{ color: '#4b5563', fontSize: '12px' }}>ou</span>
          <div style={{ flex: 1, height: '1px', background: '#21262d' }} />
        </div>

        {/* Form */}
        <form onSubmit={handleSignup} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={labelStyle}>Prénom</label>
              <input type="text" value={form.firstName} onChange={set('firstName')} placeholder="Ex : Fatima" required style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Nom</label>
              <input type="text" value={form.lastName} onChange={set('lastName')} placeholder="Ex : Diallo" required style={inputStyle} />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Email</label>
            <input type="email" value={form.email} onChange={set('email')} placeholder="votre@email.com" required style={inputStyle} />
          </div>

          <div>
            <label style={labelStyle}>Mot de passe</label>
            <input type="password" value={form.password} onChange={set('password')} placeholder="8 caractères minimum" required minLength={8} style={inputStyle} />
          </div>

          <div>
            <label style={labelStyle}>Confirmer le mot de passe</label>
            <input type="password" value={form.confirmPassword} onChange={set('confirmPassword')} placeholder="••••••••" required style={inputStyle} />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: '4px', padding: '12px', borderRadius: '8px', border: 'none',
              background: loading ? `${accent}60` : accent,
              color: '#fff', fontSize: '14px', fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            }}
          >
            {loading ? (
              <><div style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />Création du compte…</>
            ) : "S'inscrire gratuitement"}
          </button>
        </form>

        <p style={{ textAlign: 'center', color: '#4b5563', fontSize: '12px', marginTop: '20px', marginBottom: 0 }}>
          Déjà inscrit ?{' '}
          <Link to={`/t/${tenantSlug}/login`} style={{ color: accent, textDecoration: 'none', fontWeight: 600 }}>
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  );
}
