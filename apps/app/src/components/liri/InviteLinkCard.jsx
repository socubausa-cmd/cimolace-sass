import React, { useEffect, useState } from 'react';
import { Link2, Copy, Check, Plus, Power, Users } from 'lucide-react';
import { authStore } from '@/lib/auth-store';
import { resolveTenantSlug } from '@/lib/tenant/activeBranding';
import { inviteLinksApi } from '@/lib/api-v2';

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

      {/* ── Liens SUIVIS (Studio monétisation) : plusieurs liens nommés (cohorte, campagne…),
          chacun avec compteur de jonctions. Lien = /rejoindre?org=slug&invite=CODE. ── */}
      <TrackedInviteLinks baseLink={link} />
    </div>
  );
}

function TrackedInviteLinks({ baseLink }) {
  const [rows, setRows] = useState([]);
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const [copiedId, setCopiedId] = useState(null);

  const load = () => inviteLinksApi.list().then((r) => setRows(Array.isArray(r) ? r : [])).catch(() => {});
  useEffect(() => { load(); }, []);

  const create = async () => {
    setBusy(true);
    try { await inviteLinksApi.create({ label: label.trim() || undefined }); setLabel(''); await load(); } catch { /* noop */ }
    setBusy(false);
  };

  const copyLink = async (r) => {
    try {
      await navigator.clipboard.writeText(`${baseLink}&invite=${r.code}`);
      setCopiedId(r.id); setTimeout(() => setCopiedId(null), 2000);
    } catch { /* noop */ }
  };

  return (
    <div style={{ marginTop: 16, borderTop: '1px solid rgba(245,244,238,.10)', paddingTop: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 12.5, fontWeight: 700, opacity: 0.85 }}>Liens suivis</span>
        <span style={{ fontSize: 11.5, opacity: 0.55 }}>— un lien par campagne/cohorte, avec compteur d'inscriptions</span>
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: rows.length ? 10 : 0 }}>
        <input
          value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Nom du lien (ex : Campagne WhatsApp août)"
          style={{ flex: 1, minWidth: 0, borderRadius: 10, border: '1px solid rgba(245,244,238,.14)', background: 'rgba(0,0,0,.22)', color: 'inherit', padding: '8px 11px', fontSize: 12.5 }}
        />
        <button type="button" onClick={create} disabled={busy}
          style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 10, padding: '8px 12px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', border: 'none', background: '#d97757', color: '#fff' }}>
          <Plus size={14} /> Créer
        </button>
      </div>
      {rows.map((r) => (
        <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', borderRadius: 10, background: 'rgba(0,0,0,.16)', marginBottom: 6, opacity: r.is_active ? 1 : 0.5 }}>
          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, fontWeight: 700 }}>{r.code}</span>
          <span style={{ fontSize: 12.2, opacity: 0.8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.label || 'Sans nom'}</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5, color: '#e6cc92' }}>
            <Users size={12} /> {r.uses || 0}
          </span>
          <span style={{ flex: 1 }} />
          <button type="button" onClick={() => copyLink(r)} title="Copier le lien"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, borderRadius: 8, padding: '5px 9px', fontSize: 11.5, fontWeight: 600, cursor: 'pointer', border: 'none', background: copiedId === r.id ? 'rgba(91,122,82,.85)' : 'rgba(245,244,238,.14)', color: '#fff' }}>
            {copiedId === r.id ? <Check size={13} /> : <Copy size={13} />}
          </button>
          <button type="button" onClick={() => inviteLinksApi.update(r.id, { isActive: !r.is_active }).then(load).catch(() => {})} title={r.is_active ? 'Désactiver' : 'Réactiver'}
            style={{ display: 'inline-flex', alignItems: 'center', borderRadius: 8, padding: '5px 9px', fontSize: 11.5, cursor: 'pointer', border: 'none', background: 'rgba(245,244,238,.10)', color: '#fff' }}>
            <Power size={13} />
          </button>
        </div>
      ))}
    </div>
  );
}
