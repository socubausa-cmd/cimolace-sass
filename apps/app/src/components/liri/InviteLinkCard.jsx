import React, { useState } from 'react';
import { Link2, Copy, Check } from 'lucide-react';
import { authStore } from '@/lib/auth-store';
import { resolveTenantSlug } from '@/lib/tenant/activeBranding';

/**
 * GÉNÉRATEUR DE LIEN D'INVITATION — back-office PROPRIÉTAIRE. Affiche + copie le lien que les
 * nouveaux membres utilisent pour rejoindre l'école (`/rejoindre?org=<slug>`). Les invités ont un
 * ACCÈS COMPLET GRATUIT à tout jusqu'au 5 août 2026 (essai de lancement), puis choisissent leur
 * forfait (Autonome = Temple, Académique = Academy). Cf. memberTier.isLaunchTrialActive.
 */
export default function InviteLinkCard() {
  const [copied, setCopied] = useState(false);
  const slug = authStore.getTenantSlug?.() || resolveTenantSlug() || 'isna';
  const origin = typeof window !== 'undefined' && window.location?.origin
    ? window.location.origin
    : 'https://prorascience.org';
  const link = `${origin}/rejoindre?org=${slug}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      /* clipboard indisponible → l'utilisateur peut copier manuellement (champ sélectionnable) */
    }
  };

  return (
    <div
      style={{
        borderRadius: 16, border: '1px solid rgba(230,204,146,.28)',
        background: 'linear-gradient(180deg, rgba(230,204,146,.10), rgba(217,119,87,.05))',
        padding: 18, color: 'var(--lp-ink, #f5f1e9)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <span style={{ display: 'grid', placeItems: 'center', height: 34, width: 34, borderRadius: 10, background: 'rgba(230,204,146,.16)', color: '#e6cc92' }}>
          <Link2 size={18} />
        </span>
        <span style={{ fontWeight: 700, fontSize: 15 }}>Lien d'invitation</span>
      </div>
      <p style={{ fontSize: 12.8, opacity: 0.74, lineHeight: 1.45, margin: '0 0 12px' }}>
        Partage ce lien pour faire rejoindre de nouveaux membres. Jusqu'au <strong>5 août 2026</strong>,
        ils ont un accès <strong>complet gratuit à tout</strong> (essai) ; ensuite ils choisissent leur
        forfait (Autonome → Temple, ou Académique → toute l'Academy).
      </p>
      <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
        <input
          readOnly
          value={link}
          onFocus={(e) => e.currentTarget.select()}
          onClick={(e) => e.currentTarget.select()}
          aria-label="Lien d'invitation"
          style={{
            flex: 1, minWidth: 0, borderRadius: 10, border: '1px solid rgba(245,244,238,.14)',
            background: 'rgba(0,0,0,.22)', color: 'var(--lp-ink, #f5f1e9)',
            padding: '9px 12px', fontSize: 12.5, fontFamily: "'JetBrains Mono', monospace",
          }}
        />
        <button
          type="button"
          onClick={copy}
          style={{
            flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 10,
            padding: '9px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none',
            background: copied ? 'rgba(91,122,82,.85)' : '#d97757', color: '#fff',
            transition: 'background .15s ease',
          }}
        >
          {copied ? <><Check size={15} /> Copié</> : <><Copy size={15} /> Copier</>}
        </button>
      </div>
    </div>
  );
}
