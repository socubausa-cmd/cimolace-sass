import React, { useEffect, useState } from 'react';
import { impersonationStore } from '@/lib/auth-store';

/**
 * Route d'AMORÇAGE d'impersonation (§15) — ouverte dans un NOUVEL onglet par le
 * back-office. Lit le contexte signé côté serveur depuis le hash (#imp=<base64>),
 * le pose dans le sessionStorage de CET onglet (via impersonationStore), puis redirige
 * vers l'espace tenant. La session staff des autres onglets n'est jamais touchée.
 * Le hash n'est jamais envoyé au serveur (pas de fuite du token en logs/referrer).
 */
export default function ImpersonateBootstrap() {
  const [error, setError] = useState('');

  useEffect(() => {
    try {
      const m = String(window.location.hash || '').match(/imp=([^&]+)/);
      if (!m) { setError("Contexte d'impersonation manquant."); return; }
      const ctx = JSON.parse(decodeURIComponent(atob(m[1])));
      if (!ctx?.token || !ctx?.tenantSlug || !ctx?.expiresAt) {
        setError('Contexte invalide.'); return;
      }
      if (Date.parse(ctx.expiresAt) <= Date.now()) {
        setError('Session expirée avant ouverture.'); return;
      }
      impersonationStore.set(ctx);
      // Nettoie le hash (retire le token de la barre d'adresse) puis entre dans l'espace.
      // SÉCURITÉ : `to` vient d'un hash NON signé (contrôlé par l'appelant) → chemin INTERNE
      // strict uniquement : un seul '/' initial NON suivi de '/' ou '\' — sinon '//evil.com' ou
      // '/\evil.com' (URL protocol-relative) passeraient un simple startsWith('/') → open redirect.
      const rawTo = typeof ctx.to === 'string' ? ctx.to : '';
      const to = /^\/(?![/\\])/.test(rawTo) ? rawTo : '/liri';
      window.location.replace(to);
    } catch {
      setError("Impossible de démarrer l'impersonation.");
    }
  }, []);

  return (
    <div style={{
      minHeight: '100vh', display: 'grid', placeItems: 'center',
      background: '#0f1419', color: '#f4efe6',
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif', textAlign: 'center', padding: 24,
    }}>
      <div>
        {error ? (
          <>
            <p style={{ fontSize: 16, fontWeight: 600, margin: '0 0 8px', color: '#e07a63' }}>Impersonation impossible</p>
            <p style={{ color: '#aeb6bf', margin: 0 }}>{error}</p>
            <a href="/cimolace/admin" style={{ color: '#d8b468', display: 'inline-block', marginTop: 16 }}>Retour au back-office</a>
          </>
        ) : (
          <p style={{ color: '#aeb6bf' }}>Ouverture de l'espace tenant…</p>
        )}
      </div>
    </div>
  );
}
