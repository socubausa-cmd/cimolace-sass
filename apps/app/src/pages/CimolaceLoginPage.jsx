import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import {
  GraduationCap, Stethoscope, ShoppingBag, Zap,
  ArrowRight, Shield, Globe,
} from 'lucide-react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { authStore } from '@/lib/auth-store';
import { startGoogleOAuth } from '@/lib/googleOAuth';

const DEV_CIMOLACE_EMAIL    = 'cimolace-admin@prorascience.local';
const DEV_CIMOLACE_PASSWORD = 'CimolaceDev2026';

const PRODUCTS = [
  { icon: GraduationCap, label: 'École',     desc: 'ISNA · 11 moteurs · Live, cours, IA',   color: '#10b981' },
  { icon: Stethoscope,   label: 'MedOS',     desc: 'EHR · praticiens · patients · prescriptions', color: '#3b82f6' },
  { icon: ShoppingBag,   label: 'Mbolo',     desc: 'Commerce · catalogue · paiements',      color: '#f59e0b' },
  { icon: Zap,           label: 'Community', desc: 'Forum · messagerie · événements',       color: '#8b5cf6' },
];

export default function CimolaceLoginPage() {
  const [isLoading, setIsLoading]         = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [error, setError]                 = useState('');
  const isDev = import.meta.env.DEV;

  const { login, supabase } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();
  const sp        = new URLSearchParams(location.search || '');
  const redirect  = sp.get('redirect') || sp.get('next') || '/cimolace/admin';
  const urlError  = sp.get('error');

  const handleSubmit = async ({ email, password }) => {
    setError('');
    setIsLoading(true);
    try {
      const { error: authError } = await login(email, password);
      if (authError) throw authError;
      authStore.setTenantSlug('isna');
      navigate(redirect, { replace: true });
    } catch (err) {
      const raw  = err?.msg || err?.message || err?.error_description || (typeof err === 'string' ? err : null);
      const code = err?.code ?? err?.status;
      const detail = raw?.trim() || 'Email ou mot de passe incorrect.';
      setError(
        code === 500 || /unexpected_failure/i.test(detail)
          ? `${detail} — Vérifiez le projet Supabase (non en pause).`
          : detail,
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    setIsGoogleLoading(true);
    try {
      const { error: authError } = await startGoogleOAuth(supabase, {
        redirectTo: `${window.location.origin}/cimolace/auth/google/callback`,
        // Pas de tenantSlug = flux opérateur Cimolace
      });
      if (authError) throw authError;
      // startGoogleOAuth redirige via window.location.assign — on garde le loader
    } catch (err) {
      const raw = err?.msg || err?.message || err?.error_description;
      setError(raw?.trim() || 'Connexion Google indisponible.');
      setIsGoogleLoading(false);
    }
  };

  const fillDev = () => {
    const form = document.querySelector('[data-cimolace-login-form]');
    if (!form) return;
    form.email.value    = DEV_CIMOLACE_EMAIL;
    form.password.value = DEV_CIMOLACE_PASSWORD;
  };

  const resetSession = async () => {
    setError('');
    try { await supabase.auth.signOut({ scope: 'local' }); } catch {}
    for (const s of [localStorage, sessionStorage]) {
      for (let i = s.length - 1; i >= 0; i--) {
        const k = s.key(i);
        if (k && (k.includes('sb-') || k.includes('supabase') || k.includes('auth'))) s.removeItem(k);
      }
    }
    setError('Session réinitialisée — reconnectez-vous.');
  };

  return (
    <>
      <Helmet>
        <title>Connexion Opérateur — CIMOLACE</title>
        <meta name="description" content="Accédez à l'infrastructure intelligente CIMOLACE." />
        <meta name="robots" content="noindex" />
      </Helmet>

      <div style={{ minHeight: '100vh', display: 'flex', background: '#0d1117' }}>

        {/* ── Left panel — branding ── */}
        <div style={{
          width: '420px', flexShrink: 0,
          background: 'linear-gradient(160deg, #0d1117 0%, #12101e 60%, #0f0c1e 100%)',
          borderRight: '1px solid #21262d',
          display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
          padding: '48px 40px',
          position: 'relative', overflow: 'hidden',
        }} className="hidden lg:flex">

          {/* subtle glow */}
          <div style={{
            position: 'absolute', top: '-80px', left: '-80px',
            width: '360px', height: '360px', borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(124,58,237,0.12) 0%, transparent 70%)',
            pointerEvents: 'none',
          }} />

          {/* logo */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '48px' }}>
              <div style={{
                width: '36px', height: '36px', borderRadius: '8px',
                background: 'rgba(124,58,237,0.20)', border: '1px solid rgba(124,58,237,0.4)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Globe size={18} color="#8b5cf6" strokeWidth={2} />
              </div>
              <span style={{ color: '#f0f6fc', fontSize: '18px', fontWeight: 800, letterSpacing: '0.06em' }}>CIMOLACE</span>
            </div>

            <h2 style={{ color: '#f0f6fc', fontSize: '28px', fontWeight: 800, lineHeight: 1.25, marginBottom: '12px' }}>
              Infrastructure<br />intelligente pour<br />l'Afrique
            </h2>
            <p style={{ color: '#8b949e', fontSize: '14px', lineHeight: 1.6, marginBottom: '40px' }}>
              Une plateforme. Plusieurs intelligences.<br />
              Construis, automatise et fais évoluer<br />ton infrastructure avec un seul outil.
            </p>

            {/* Products */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {PRODUCTS.map(({ icon: Icon, label, desc, color }) => (
                <div key={label} style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '12px 14px',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: '8px',
                }}>
                  <div style={{
                    width: '32px', height: '32px', borderRadius: '7px', flexShrink: 0,
                    background: `${color}18`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Icon size={16} color={color} strokeWidth={1.8} />
                  </div>
                  <div>
                    <div style={{ color: '#f0f6fc', fontSize: '13px', fontWeight: 600 }}>{label}</div>
                    <div style={{ color: '#6e7681', fontSize: '11px', marginTop: '1px' }}>{desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* footer */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Shield size={12} color="#6e7681" />
            <span style={{ color: '#6e7681', fontSize: '11px' }}>Infrastructure sécurisée · Données en Afrique</span>
          </div>
        </div>

        {/* ── Right panel — form ── */}
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '40px 24px',
        }}>
          <div style={{ width: '100%', maxWidth: '400px' }}>

            {/* Mobile logo */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '36px' }} className="lg:hidden">
              <Globe size={20} color="#8b5cf6" />
              <span style={{ color: '#f0f6fc', fontSize: '18px', fontWeight: 800, letterSpacing: '0.06em' }}>CIMOLACE</span>
            </div>

            <div style={{ marginBottom: '32px' }}>
              <h1 style={{ color: '#f0f6fc', fontSize: '24px', fontWeight: 800, marginBottom: '6px' }}>
                Accéder à la plateforme
              </h1>
              <p style={{ color: '#8b949e', fontSize: '14px' }}>
                Espace opérateur · Backoffice Cimolace
              </p>
            </div>

            {/* Alerts */}
            {urlError === 'forbidden' && (
              <div style={{
                padding: '12px 14px', borderRadius: '8px', marginBottom: '16px',
                background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.30)',
                color: '#fbbf24', fontSize: '13px',
              }}>
                Ce compte n'a pas les droits opérateur CIMOLACE.
              </div>
            )}
            {error && (
              <div style={{
                padding: '12px 14px', borderRadius: '8px', marginBottom: '16px',
                background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.30)',
                color: '#f87171', fontSize: '13px',
              }}>
                {error}
              </div>
            )}

            {/* Form */}
            <form
              data-cimolace-login-form
              onSubmit={(e) => {
                e.preventDefault();
                handleSubmit({ email: e.target.email.value, password: e.target.password.value });
              }}
              style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}
            >
              <div>
                <label style={{ display: 'block', color: '#8b949e', fontSize: '12px', fontWeight: 600, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Email
                </label>
                <input
                  name="email" type="email" required
                  placeholder="admin@cimolace.com"
                  style={{
                    width: '100%', padding: '11px 14px',
                    background: '#161b22', border: '1px solid #21262d',
                    borderRadius: '8px', color: '#f0f6fc', fontSize: '14px',
                    outline: 'none', boxSizing: 'border-box',
                    transition: 'border-color 0.15s ease',
                  }}
                  onFocus={e => e.target.style.borderColor = '#7c3aed'}
                  onBlur={e => e.target.style.borderColor = '#21262d'}
                />
              </div>
              <div>
                <label style={{ display: 'block', color: '#8b949e', fontSize: '12px', fontWeight: 600, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Mot de passe
                </label>
                <input
                  name="password" type="password" required
                  placeholder="••••••••"
                  style={{
                    width: '100%', padding: '11px 14px',
                    background: '#161b22', border: '1px solid #21262d',
                    borderRadius: '8px', color: '#f0f6fc', fontSize: '14px',
                    outline: 'none', boxSizing: 'border-box',
                    transition: 'border-color 0.15s ease',
                  }}
                  onFocus={e => e.target.style.borderColor = '#7c3aed'}
                  onBlur={e => e.target.style.borderColor = '#21262d'}
                />
              </div>
              <button
                type="submit" disabled={isLoading}
                style={{
                  width: '100%', padding: '12px',
                  background: isLoading ? '#5b21b6' : '#7c3aed',
                  border: 'none', borderRadius: '8px',
                  color: '#fff', fontSize: '14px', fontWeight: 700,
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  transition: 'background 0.18s ease',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                }}
                onMouseEnter={e => { if (!isLoading) e.target.style.background = '#6d28d9'; }}
                onMouseLeave={e => { if (!isLoading) e.target.style.background = '#7c3aed'; }}
              >
                {isLoading ? (
                  <>
                    <div style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                    Connexion…
                  </>
                ) : (
                  <>Accéder à la plateforme <ArrowRight size={15} /></>
                )}
              </button>
            </form>

            {/* Divider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
              <div style={{ flex: 1, height: '1px', background: '#21262d' }} />
              <span style={{ color: '#6e7681', fontSize: '12px' }}>ou</span>
              <div style={{ flex: 1, height: '1px', background: '#21262d' }} />
            </div>

            {/* Google */}
            <button
              onClick={handleGoogleLogin} disabled={isGoogleLoading}
              style={{
                width: '100%', padding: '11px',
                background: '#f8fafc', border: 'none', borderRadius: '8px',
                color: '#0d1117', fontSize: '14px', fontWeight: 600,
                cursor: isGoogleLoading ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                transition: 'background 0.15s ease',
                opacity: isGoogleLoading ? 0.7 : 1,
              }}
              onMouseEnter={e => { if (!isGoogleLoading) e.currentTarget.style.background = '#e2e8f0'; }}
              onMouseLeave={e => { if (!isGoogleLoading) e.currentTarget.style.background = '#f8fafc'; }}
            >
              {isGoogleLoading ? (
                <div style={{ width: '16px', height: '16px', border: '2px solid #94a3b8', borderTopColor: '#0d1117', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
              )}
              Continuer avec Google
            </button>

            {/* Dev panel */}
            {isDev && (
              <div style={{
                marginTop: '24px', padding: '14px 16px',
                background: 'rgba(124,58,237,0.06)', border: '1px solid rgba(124,58,237,0.20)',
                borderRadius: '8px',
              }}>
                <div style={{ color: '#c4b5fd', fontSize: '12px', fontWeight: 700, marginBottom: '8px' }}>Dev — compte local</div>
                <div style={{ color: '#8b949e', fontSize: '11px', marginBottom: '2px' }}>{DEV_CIMOLACE_EMAIL}</div>
                <div style={{ color: '#8b949e', fontSize: '11px', marginBottom: '12px' }}>{DEV_CIMOLACE_PASSWORD}</div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button type="button" onClick={fillDev} style={{
                    flex: 1, padding: '7px 12px', borderRadius: '6px',
                    background: '#7c3aed', border: 'none', color: '#fff',
                    fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                  }}>Remplir</button>
                  <button type="button" onClick={resetSession} style={{
                    flex: 1, padding: '7px 12px', borderRadius: '6px',
                    background: 'transparent', border: '1px solid #30363d', color: '#8b949e',
                    fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                  }}>Réinitialiser session</button>
                </div>
              </div>
            )}

            <div style={{ marginTop: '24px', textAlign: 'center' }}>
              <Link to="/cimolace" style={{ color: '#6e7681', fontSize: '12px', textDecoration: 'none' }}>
                ← Retour à l'accueil Cimolace
              </Link>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (min-width: 1024px) { .hidden.lg\\:flex { display: flex !important; } }
        .lg\\:hidden { display: none !important; }
        @media (max-width: 1023px) { .lg\\:hidden { display: flex !important; } .hidden.lg\\:flex { display: none !important; } }
      `}</style>
    </>
  );
}
