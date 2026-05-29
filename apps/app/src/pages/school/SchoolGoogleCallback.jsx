/**
 * Page de callback OAuth Google pour les tenants.
 * Route : /t/:tenantSlug/auth/callback
 *
 * L'edge function oauth-callback redirige ici avec les tokens dans le hash :
 *   #access_token=...&refresh_token=...&expires_in=3600&token_type=bearer
 *
 * Cette page :
 *  1. Lit les tokens depuis window.location.hash
 *  2. Appelle supabase.auth.setSession({ access_token, refresh_token })
 *  3. Détermine le rôle de l'utilisateur dans le tenant
 *  4. Redirige vers /t/:slug/admin (staff) ou /student-school-life/dashboard (élève)
 *
 * En cas d'erreur URL (?error=xxx), affiche un message clair.
 */

import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import { authStore } from '@/lib/auth-store';
import { getApiBaseUrl } from '@/lib/apiBase';

const ADMIN_ROLES = new Set(['owner', 'admin', 'teacher', 'secretariat', 'creator']);

const ERROR_MESSAGES = {
  google_denied: 'Connexion Google annulée.',
  invalid_state: 'Session expirée. Veuillez réessayer.',
  state_expired: 'Session expirée. Veuillez réessayer.',
  token_exchange_failed: 'Erreur d\'échange de tokens avec Google.',
  userinfo_failed: 'Impossible de récupérer le profil Google.',
  no_email: 'Votre compte Google ne possède pas d\'adresse e-mail.',
  user_error: 'Erreur lors de la création du compte.',
  session_failed: 'Impossible de créer la session. Réessayez.',
  oauth_not_configured: 'Google OAuth non configuré pour cette école.',
  no_tokens: 'Tokens manquants dans la réponse.',
  set_session_failed: 'Erreur lors de l\'activation de la session.',
  callback_failed: 'Erreur inattendue. Veuillez réessayer.',
};

function parseHashTokens(hash) {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  const params = new URLSearchParams(raw);
  return {
    access_token: params.get('access_token') || '',
    refresh_token: params.get('refresh_token') || '',
    expires_in: parseInt(params.get('expires_in') || '3600', 10),
    return_to: params.get('return_to') || '',
  };
}

async function fetchTenantRole(tenantSlug, token) {
  for (let attempt = 0; attempt < 8; attempt++) {
    if (token) {
      try {
        const res = await fetch(`${getApiBaseUrl()}/tenants/mine`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const body = await res.json().catch(() => []);
          const list = Array.isArray(body) ? body : (Array.isArray(body?.data) ? body.data : []);
          const match = list.find(
            (t) => String(t.slug || t.tenants?.slug || '').toLowerCase() === tenantSlug.toLowerCase(),
          );
          if (match) return String(match.role || '').toLowerCase();
        }
      } catch { /* ignore */ }
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  return 'student';
}

export default function SchoolGoogleCallback() {
  const { tenantSlug } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState('loading'); // 'loading' | 'error'
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    let cancelled = false;

    const handleCallback = async () => {
      // ── 1. Vérifier les erreurs URL (?error=xxx depuis oauth-callback) ────
      const urlError = searchParams.get('error');
      if (urlError) {
        const msg = ERROR_MESSAGES[urlError] || 'Erreur de connexion Google.';
        if (!cancelled) {
          setErrorMsg(msg);
          setStatus('error');
          setTimeout(() => navigate(`/t/${tenantSlug}/login?error=${urlError}`, { replace: true }), 3000);
        }
        return;
      }

      // ── 2. Lire les tokens depuis le hash URL ─────────────────────────────
      const { access_token, refresh_token, return_to } = parseHashTokens(window.location.hash);

      // Nettoyer le hash de l'URL immédiatement (sécurité — pas de tokens dans l'historique)
      if (window.history.replaceState) {
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      }

      if (!access_token) {
        if (!cancelled) {
          setErrorMsg(ERROR_MESSAGES.no_tokens);
          setStatus('error');
          setTimeout(() => navigate(`/t/${tenantSlug}/login?error=no_tokens`, { replace: true }), 3000);
        }
        return;
      }

      // ── 3. Activer la session dans Supabase ───────────────────────────────
      const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
        access_token,
        refresh_token,
      });

      if (sessionError || !sessionData?.session) {
        console.error('[SchoolGoogleCallback] setSession error:', sessionError?.message);
        if (!cancelled) {
          setErrorMsg(ERROR_MESSAGES.set_session_failed);
          setStatus('error');
          setTimeout(() => navigate(`/t/${tenantSlug}/login?error=set_session_failed`, { replace: true }), 3000);
        }
        return;
      }

      // ── 4. Synchroniser authStore ─────────────────────────────────────────
      authStore.setToken(sessionData.session.access_token || '');
      authStore.setTenantSlug(tenantSlug);

      // ── 5. Déterminer le rôle dans le tenant ──────────────────────────────
      const role = await fetchTenantRole(tenantSlug, sessionData.session.access_token);

      if (cancelled) return;

      // ── 6. Rediriger selon le rôle ────────────────────────────────────────
      if (return_to) {
        navigate(decodeURIComponent(return_to), { replace: true });
      } else if (ADMIN_ROLES.has(role)) {
        navigate(`/t/${tenantSlug}/admin`, { replace: true });
      } else {
        navigate('/student-school-life/dashboard', { replace: true });
      }
    };

    handleCallback();
    return () => { cancelled = true; };
  }, [tenantSlug, navigate, searchParams]);

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0d1117',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'Inter', system-ui, sans-serif",
    }}>
      <div style={{ textAlign: 'center' }}>
        {status === 'error' ? (
          <>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
            <p style={{ color: '#f87171', fontSize: '18px', fontWeight: 600 }}>
              Erreur de connexion
            </p>
            <p style={{ color: '#8b949e', fontSize: '14px', marginTop: '8px', maxWidth: '320px' }}>
              {errorMsg}
            </p>
            <p style={{ color: '#4b5563', fontSize: '12px', marginTop: '16px' }}>
              Redirection en cours…
            </p>
          </>
        ) : (
          <>
            <div style={{
              width: '48px', height: '48px',
              border: '4px solid rgba(124, 58, 237, 0.3)',
              borderTopColor: '#7c3aed',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
              margin: '0 auto 16px',
            }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
            <p style={{ color: '#f0f6fc', fontSize: '16px', fontWeight: 500 }}>
              Connexion avec Google…
            </p>
            <p style={{ color: '#8b949e', fontSize: '13px', marginTop: '8px' }}>
              Vérification de vos accès
            </p>
          </>
        )}
      </div>
    </div>
  );
}
