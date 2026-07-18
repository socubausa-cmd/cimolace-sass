import React, { useEffect, useState, useCallback } from 'react';
import { impersonationStore } from '@/lib/auth-store';

/**
 * Bannière persistante d'IMPERSONATION ENCADRÉE (§15).
 * Visible sur TOUTE page de l'onglet où une impersonation est active : rappelle en
 * permanence à l'opérateur qu'il agit en tant que tenant, affiche le motif, un compte
 * à rebours (sortie automatique à l'expiration) et un bouton « Quitter » immédiat.
 * Monté une seule fois en tête de l'app. Ne rend rien hors impersonation.
 */
function fmt(ms) {
  if (ms <= 0) return '0:00';
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export default function ImpersonationBanner() {
  const [ctx, setCtx] = useState(() => impersonationStore.get());
  const [remaining, setRemaining] = useState(0);

  const quit = useCallback(() => {
    impersonationStore.clear();
    setCtx(null);
    // Onglet ouvert par script → on tente de le fermer ; sinon retour au back-office.
    setTimeout(() => {
      try { window.close(); } catch { /* noop */ }
      if (!window.closed) window.location.assign('/cimolace/admin');
    }, 30);
  }, []);

  useEffect(() => {
    if (!ctx) return undefined;
    const tick = () => {
      const rem = Date.parse(ctx.expiresAt) - Date.now();
      setRemaining(rem);
      if (rem <= 0) quit(); // sortie automatique à l'expiration
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [ctx, quit]);

  if (!ctx) return null;

  const warn = remaining <= 60_000; // dernière minute → accent plus urgent
  return (
    <div
      role="alert"
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 2147483000,
        display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
        padding: '9px 16px', color: '#2a1608',
        fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif', fontSize: 13.5,
        background: warn
          ? 'linear-gradient(90deg,#f2b13c,#e0742f)'
          : 'linear-gradient(90deg,#e9c877,#d99a3c)',
        borderBottom: '1px solid rgba(0,0,0,.18)',
        boxShadow: '0 2px 10px rgba(0,0,0,.18)',
      }}
    >
      <span aria-hidden="true" style={{ fontSize: 15 }}>👁️</span>
      <span style={{ fontWeight: 700 }}>
        Vous agissez en tant que&nbsp;
        <span style={{ textDecoration: 'underline' }}>{ctx.tenantName || ctx.tenantSlug}</span>
      </span>
      <span style={{ opacity: 0.85 }}>motif&nbsp;: <em>{ctx.reason}</em></span>
      <span
        style={{
          fontVariantNumeric: 'tabular-nums', fontWeight: 700,
          padding: '2px 9px', borderRadius: 999,
          background: 'rgba(255,255,255,.55)',
        }}
      >
        expire dans {fmt(remaining)}
      </span>
      <button
        type="button"
        onClick={quit}
        style={{
          marginLeft: 'auto', cursor: 'pointer', border: 'none',
          background: '#2a1608', color: '#f7e9d5', fontWeight: 700, fontSize: 12.5,
          padding: '6px 14px', borderRadius: 8,
        }}
      >
        Quitter l'impersonation
      </button>
    </div>
  );
}
