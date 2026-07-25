import React, { useEffect, useState } from 'react';
import { Link2, Copy, Check, Plus, Power, Users, ChevronDown, ChevronRight } from 'lucide-react';
import { authStore } from '@/lib/auth-store';
import { resolveTenantSlug } from '@/lib/tenant/activeBranding';
import { inviteLinksApi } from '@/lib/api-v2';
import { isLaunchTrialActive, LAUNCH_TRIAL_ENDS_AT } from '@/lib/liri/memberTier';

/**
 * GÉNÉRATEUR DE LIEN D'INVITATION — back-office propriétaire. Affiche + copie le lien
 * que les nouveaux membres utilisent pour rejoindre l'école (`/rejoindre?org=<slug>`).
 *
 * REPLIABLE, fermé par défaut : inviter est une action PONCTUELLE, pas une information
 * de pilotage — le pavé déroulé monopolisait le haut de la Vue d'ensemble en permanence.
 * L'état est mémorisé (localStorage) pour ne pas se refermer à chaque visite.
 *
 * ⚠️ RIEN EN DUR ICI — Cimolace est multi-tenant :
 *  • la date de fin d'essai vient de `LAUNCH_TRIAL_ENDS_AT` (source unique), jamais
 *    réécrite dans la phrase — sinon le texte ment dès que la date bouge ;
 *  • le texte s'ADAPTE : une fois l'essai terminé, on ne promet plus la gratuité ;
 *  • pas de noms de produits d'un tenant (« Temple », « Academy ») : les autres écoles
 *    affichaient le vocabulaire de Prorascience ;
 *  • pas de repli `isna` / `prorascience.org` : un slug inconnu produisait un lien qui
 *    invitait chez UN AUTRE tenant. Fail-closed → on n'affiche pas de lien faux.
 */
const OPEN_KEY = 'liri.inviteCard.open';

export default function InviteLinkCard() {
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(() => {
    try { return window.localStorage.getItem(OPEN_KEY) === '1'; } catch { return false; }
  });

  const toggle = () => {
    setOpen((v) => {
      const next = !v;
      try { window.localStorage.setItem(OPEN_KEY, next ? '1' : '0'); } catch { /* privé/quota → simple oubli */ }
      return next;
    });
  };

  // Slug RÉEL du tenant courant. Aucun repli : sans slug, aucun lien n'est proposé.
  const slug = authStore.getTenantSlug?.() || resolveTenantSlug() || '';
  const origin = typeof window !== 'undefined' && window.location?.origin ? window.location.origin : '';
  const link = slug && origin ? `${origin}/rejoindre?org=${slug}` : '';

  const trialOn = isLaunchTrialActive();
  const trialEnd = Number.isFinite(LAUNCH_TRIAL_ENDS_AT)
    ? new Date(LAUNCH_TRIAL_ENDS_AT).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    : null;

  const copy = async () => {
    if (!link) return;
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
        borderRadius: 16, border: '1px solid rgba(217,119,87,.24)',
        background: 'linear-gradient(180deg, rgba(217,119,87,.09), rgba(217,119,87,.03))',
        padding: open ? 18 : '12px 14px', color: 'var(--lp-ink, #f5f1e9)',
        transition: 'padding .15s ease',
      }}
    >
      {/* En-tête = bouton de repli. Fermé, la carte tient sur UNE ligne. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          style={{
            display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0,
            background: 'none', border: 'none', padding: 0, cursor: 'pointer',
            color: 'inherit', font: 'inherit', textAlign: 'left',
          }}
        >
          <span style={{ display: 'grid', placeItems: 'center', height: 30, width: 30, borderRadius: 9, background: 'rgba(217,119,87,.16)', color: '#d97757', flexShrink: 0 }}>
            <Link2 size={16} />
          </span>
          <span style={{ fontWeight: 700, fontSize: 14.5 }}>Inviter des membres</span>
          <span style={{ opacity: 0.5, display: 'inline-flex' }}>
            {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </span>
        </button>
        {/* Replié : la copie reste à UN clic — on gagne la place sans perdre le geste. */}
        {!open && link && (
          <button
            type="button" onClick={copy}
            style={{
              flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 9,
              padding: '7px 12px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', border: 'none',
              background: copied ? 'rgba(91,122,82,.85)' : 'rgba(217,119,87,.9)', color: '#fff',
            }}
          >
            {copied ? <><Check size={14} /> Copié</> : <><Copy size={14} /> Copier le lien</>}
          </button>
        )}
      </div>

      {open && (
        <>
          <p style={{ fontSize: 12.8, opacity: 0.74, lineHeight: 1.45, margin: '12px 0 12px' }}>
            Partage ce lien pour faire rejoindre de nouveaux membres.{' '}
            {trialOn && trialEnd
              ? <>Jusqu'au <strong>{trialEnd}</strong>, ils ont un accès <strong>complet gratuit à tout</strong> (essai de lancement) ; ensuite ils choisissent leur forfait.</>
              : <>À l'inscription, ils choisissent leur forfait.</>}
          </p>

          {link ? (
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
          ) : (
            <p style={{ fontSize: 12.5, opacity: 0.7, margin: 0 }}>
              École non identifiée — impossible de composer un lien d'invitation fiable.
            </p>
          )}

          {/* ── Liens SUIVIS : plusieurs liens nommés (cohorte, campagne…), chacun avec
              compteur de jonctions. Lien = /rejoindre?org=slug&invite=CODE. ── */}
          {link && <TrackedInviteLinks baseLink={link} />}
        </>
      )}
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
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5, color: '#d97757' }}>
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
