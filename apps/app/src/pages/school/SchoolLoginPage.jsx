/**
 * Page de connexion tenant-aware pour les écoles.
 * Route : /t/:tenantSlug/login
 *
 * - Affiche le branding de l'école (logo, couleur)
 * - Google OAuth avec `redirectTo` incluant ?tenant=slug
 * - Après callback, l'utilisateur est renvoyé sur /t/:tenantSlug/admin
 */
import { useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useTenantBranding } from '@/hooks/useTenantBranding';
import { authStore } from '@/lib/auth-store';
import { getApiBaseUrl } from '@/lib/apiBase';

const ADMIN_ROLES = new Set(['owner', 'admin', 'teacher', 'secretariat']);

async function fetchTenantRole(tenantSlug) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const token = authStore.getToken();
    if (token) {
      try {
        const res = await fetch(`${getApiBaseUrl()}/tenants/mine`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const body = await res.json().catch(() => []);
          const list = Array.isArray(body) ? body : (Array.isArray(body?.data) ? body.data : []);
          const match = list.find(
            (t) =>
              String(t.slug || t.tenants?.slug || '').toLowerCase() === String(tenantSlug).toLowerCase(),
          );
          if (match) return String(match.role || '').toLowerCase();
        }
      } catch {}
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  return 'student';
}

export default function SchoolLoginPage() {
  const { tenantSlug } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login, loginWithOAuth } = useAuth();

  // Destination post-login imposée par le flux de création d'org (public-site passe
  // ?next=<next_url backend>, ex. /liri pour LIRI) — pour que les DEUX portails de
  // création (cimolace.space/onboarding ET liri.cimolace.space/creer-organisation)
  // atterrissent au MÊME endroit. Validée : chemin interne seulement (anti open-redirect).
  const nextRaw = searchParams.get('next') || '';
  const safeNext = nextRaw.startsWith('/') && !nextRaw.startsWith('//') && !nextRaw.includes('://') ? nextRaw : null;
  const { branding } = useTenantBranding();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');

  const accent = branding?.accentColor ?? '#7c3aed';
  // Prefer branding.name from DB; if still the generic FALLBACK, use URL slug
  const brandingName = branding?.name;
  const isFallback = !brandingName || brandingName === 'Mon École';
  const schoolName = isFallback ? (tenantSlug ?? 'Mon École') : brandingName;
  const logo = branding?.logo ?? null;

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { error: authError } = await login(email, password);
      if (authError) {
        setError(authError.message ?? 'Email ou mot de passe incorrect');
        return;
      }
      authStore.setTenantSlug(tenantSlug);
      // Destination imposée par le flux d'onboarding (ex. /liri) → prime sur le défaut.
      if (safeNext) {
        navigate(safeNext);
        return;
      }
      const role = await fetchTenantRole(tenantSlug);
      if (ADMIN_ROLES.has(role)) {
        navigate(`/t/${tenantSlug}/admin`);
      } else {
        navigate(`/t/${tenantSlug}/courses`);
      }
    } catch (err) {
      setError(err?.message ?? 'Erreur de connexion');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    setGoogleLoading(true);
    try {
      // Flux Google STANDARD Supabase (provider natif) — fiable, identique à /login.
      // redirectTo = /auth/callback, déjà autorisé dans Supabase (uri_allow_list) pour
      // prorascience.org + app.cimolace.space. Le flux white-label per-tenant
      // (edge function oauth-initiate) reste déployé mais requiert son secret Google
      // (PLATFORM_GOOGLE_CLIENT_SECRET) — bascule possible plus tard sans casser celui-ci.
      authStore.setTenantSlug(tenantSlug);
      const { error: oauthError } = await loginWithOAuth('google', `/t/${tenantSlug}/courses`);
      if (oauthError) {
        setError(oauthError.message ?? 'Connexion Google indisponible.');
        setGoogleLoading(false);
      }
      // Sinon : redirection vers Google en cours (loginWithOAuth → window.location.assign).
    } catch (err) {
      setError(err?.message ?? 'Erreur Google OAuth');
      setGoogleLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0d1117',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px',
      fontFamily: "'Inter', system-ui, sans-serif",
    }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      <div style={{
        width: '100%', maxWidth: '420px',
        background: '#161b22',
        border: '1px solid #21262d',
        borderTop: `3px solid ${accent}`,
        borderRadius: '16px',
        padding: '40px 36px',
        boxShadow: '0 24px 48px rgba(0,0,0,0.4)',
      }}>
        {/* Logo + name */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          {logo ? (
            <img
              src={logo}
              alt={schoolName}
              style={{ height: '48px', objectFit: 'contain', marginBottom: '12px' }}
            />
          ) : (
            <div style={{
              width: '48px', height: '48px', borderRadius: '12px',
              background: accent + '22', border: `2px solid ${accent}44`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '22px', margin: '0 auto 12px',
            }}>
              🎓
            </div>
          )}
          <h1 style={{ color: '#f0f6fc', fontSize: '20px', fontWeight: 800, margin: 0 }}>
            {schoolName}
          </h1>
          <p style={{ color: '#8b949e', fontSize: '13px', marginTop: '6px' }}>
            Connexion à votre espace
          </p>
        </div>

        {/* Error */}
        {error && (
          <div style={{
            marginBottom: '20px', padding: '10px 14px', borderRadius: '8px',
            background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.25)',
            color: '#f87171', fontSize: '13px',
          }}>
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ color: '#8b949e', fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="votre@email.com"
              required
              style={{
                width: '100%', padding: '10px 14px', borderRadius: '8px',
                border: '1px solid #21262d', background: '#0d1117',
                color: '#f0f6fc', fontSize: '14px', outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div>
            <label style={{ color: '#8b949e', fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
              Mot de passe
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              style={{
                width: '100%', padding: '10px 14px', borderRadius: '8px',
                border: '1px solid #21262d', background: '#0d1117',
                color: '#f0f6fc', fontSize: '14px', outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: '4px', padding: '12px', borderRadius: '8px', border: 'none',
              background: loading ? accent + '60' : accent,
              color: '#fff', fontSize: '14px', fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            }}
          >
            {loading ? (
              <>
                <div style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                Connexion…
              </>
            ) : 'Se connecter'}
          </button>
        </form>

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '20px 0' }}>
          <div style={{ flex: 1, height: '1px', background: '#21262d' }} />
          <span style={{ color: '#4b5563', fontSize: '12px' }}>ou</span>
          <div style={{ flex: 1, height: '1px', background: '#21262d' }} />
        </div>

        {/* Google */}
        <button
          onClick={handleGoogleLogin}
          disabled={googleLoading}
          style={{
            width: '100%', padding: '11px', borderRadius: '8px',
            border: '1px solid #21262d', background: '#f8fafc',
            color: '#0f172a', fontSize: '14px', fontWeight: 600,
            cursor: googleLoading ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
            opacity: googleLoading ? 0.7 : 1,
          }}
        >
          {googleLoading ? (
            <div style={{ width: '14px', height: '14px', border: '2px solid #c7d2fe', borderTopColor: '#4f46e5', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
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

        {/* Back link */}
        <div style={{ textAlign: 'center', marginTop: '24px' }}>
          <a
            href={`/t/${tenantSlug}`}
            style={{ color: '#4b5563', fontSize: '12px', textDecoration: 'none' }}
          >
            ← Retour à l'accueil de l'école
          </a>
        </div>
      </div>
    </div>
  );
}
