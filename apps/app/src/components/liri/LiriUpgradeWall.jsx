/**
 * LiriUpgradeWall — mur d'upgrade rendu DANS le realm LIRI (jamais de saut vers /cimolace/*).
 * Remplace l'ancienne FUITE `Navigate → /cimolace/billing?upgrade=liri` (audit cloison 3-realms).
 *
 * DEUX modes de présentation :
 *   - PAGE (défaut) : rendu par le gate (ProtectedLiriRoute/LiriAccessGate) quand un MEMBRE
 *     connecté SANS forfait atteint une route gatée → plein écran dans LiriPortalShell.
 *   - MODAL (`asModal` + `onClose`) : ouvert PAR-DESSUS par un CTA « Passer au complet » pour
 *     un user free-tier qui PASSE le gate (bannière palier, panneau NeuroInk…). Rendu hors du
 *     shell → couleurs EXPLICITES (text-white sur #262624), pas de dépendance aux classes lp-*.
 *
 * SOURCE = les CYCLES du tenant lus depuis `billing_plans` (`*-monthly`, prix = source de vérité),
 * EXACTEMENT comme ForfaitsPage et le panneau forfaits de l'OS. Chaque carte mène au checkout
 * ÉPROUVÉ `/t/:slug/paiement` (Stripe + Mobile Money + checkout invité) — jamais le flux SaaS
 * niveau-tenant. Slug résolu dynamiquement (resolveTenantSlug), jamais « isna » en dur.
 */
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Loader2, Sparkles, ShieldCheck, AlertCircle, X, ArrowRight } from 'lucide-react';
import { LiriPortalShell } from '@/components/liri/LiriPortalShell';
import { supabase } from '@/lib/customSupabaseClient';
import { resolveTenantSlug } from '@/lib/tenant/activeBranding';

// Devises sans centime (montant déjà en unité entière — pas de /100).
const ZERO_DECIMAL_CUR = new Set(['XAF', 'XOF', 'XPF', 'JPY', 'KRW', 'VND', 'CLP', 'RWF', 'BIF', 'GNF', 'DJF', 'KMF', 'UGX']);
const eur = (cents, cur = 'EUR') => {
  const c = String(cur || 'EUR').toUpperCase();
  const value = ZERO_DECIMAL_CUR.has(c) ? (Number(cents) || 0) : (Number(cents) || 0) / 100;
  try { return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: c }).format(value); }
  catch { return `${value.toLocaleString('fr-FR')} ${c}`; }
};

// Positionnement des 4 cycles (mêmes accroches que le comparateur + le panneau de l'OS).
const CYCLE_HINTS = {
  autonome:   { tagline: 'Apprendre en autonomie — Temple & cultes inclus.' },
  academique: { badge: 'Le plus choisi', highlight: true, tagline: 'Le cursus complet, encadré par l’équipe.' },
  prive:      { tagline: 'Accompagnement rapproché, en petit comité.' },
  privilegie: { tagline: 'Pour ceux qui veulent pratiquer — mentorat souverain.' },
};
const cycleKeyOf = (key) => String(key || '').toLowerCase().replace(/-(monthly|quarterly|yearly)$/, '');

export default function LiriUpgradeWall({ asModal = false, onClose } = {}) {
  const navigate = useNavigate();
  const [plans, setPlans] = useState(null); // null = chargement
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    supabase
      .from('billing_plans')
      .select('key,label,description,price_cents,currency,billing_cycle,is_active')
      .eq('is_active', true)
      .order('price_cents', { ascending: true })
      .then(({ data, error: err }) => {
        if (!alive) return;
        if (err) { setPlans([]); setError('Impossible de charger les forfaits pour le moment. Réessaie dans un instant.'); return; }
        const cycles = (data || []).filter((p) => /^(autonome|academique|prive|privilegie)-monthly$/.test(String(p?.key || '').toLowerCase()));
        setPlans(cycles);
      });
    return () => { alive = false; };
  }, []);

  // Choisir un cycle → checkout membre ÉPROUVÉ /t/:slug/paiement (carte + Mobile Money + invité).
  const chooseCycle = (planKey) => {
    setError(null);
    const slug = resolveTenantSlug();
    if (!slug) { setError('Espace introuvable — réessaie dans un instant.'); return; }
    if (asModal && onClose) onClose();
    navigate(`/t/${slug}/paiement?plan=${encodeURIComponent(planKey)}&type=subscription`);
  };

  // Contenu commun aux deux modes (couleurs EXPLICITES → valides in-shell ET en modal).
  const body = (
    <div className="mx-auto w-full max-w-5xl px-5 py-8 sm:px-8">
      {/* En-tête */}
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[#d97757]/30 bg-[#d97757]/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-[#e58a5f]">
          <Sparkles size={13} /> Votre accès
        </span>
        <h1 className="mt-4 text-[1.9rem] font-extrabold leading-tight text-white sm:text-[2.25rem]">Choisissez votre forfait</h1>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-white/70">
          Quatre chemins, quatre niveaux d’accès. Votre espace s’ouvre dès la souscription — le paiement se fait ici, en toute sécurité.
        </p>
      </div>

      {error && (
        <div className="mx-auto mt-6 flex max-w-xl items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/[0.08] px-4 py-3 text-sm text-red-200">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      {/* Grille des cycles */}
      {plans === null ? (
        <div className="flex items-center justify-center py-24"><Loader2 className="h-7 w-7 animate-spin text-[#d97757]" /></div>
      ) : plans.length === 0 ? (
        <p className="mt-16 text-center text-sm text-white/70">Aucun forfait disponible pour le moment. Contactez le support.</p>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {plans.map((p) => {
            const cyc = cycleKeyOf(p.key);
            const hint = CYCLE_HINTS[cyc] || {};
            return (
              <div
                key={p.key}
                className={`relative flex flex-col rounded-2xl border p-6 transition-colors ${
                  hint.highlight
                    ? 'border-[#d97757]/50 bg-[#d97757]/[0.07] ring-1 ring-[#d97757]/25 shadow-[0_10px_44px_-16px_rgba(217,119,87,0.5)]'
                    : 'border-[rgba(245,244,238,0.10)] bg-[rgba(0,0,0,0.16)] hover:border-[rgba(245,244,238,0.2)]'
                }`}
              >
                {hint.badge && (
                  <span className="absolute -top-2.5 left-6 flex items-center gap-1 rounded-full bg-[#d97757] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm">
                    <Sparkles className="h-3 w-3" />{hint.badge}
                  </span>
                )}
                <p className="truncate font-bold text-white">{p.label || p.key}</p>
                <p className="mt-0.5 min-h-[2.4em] text-[11px] leading-snug text-[#e0926a]/90">{hint.tagline || p.description || ''}</p>
                <div className="mt-3 flex flex-wrap items-end gap-2">
                  <div className="text-[1.9rem] font-black leading-none tracking-tight text-white">{eur(p.price_cents, p.currency)}</div>
                  <div className="mb-1 text-xs text-white/45">/ mois</div>
                </div>
                <button
                  onClick={() => chooseCycle(p.key)}
                  className="mt-5 flex items-center justify-center gap-2 rounded-xl bg-[#d97757] px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#c9673f]"
                >
                  Choisir ce forfait <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <p className="mt-6 flex flex-wrap items-center justify-center gap-1.5 text-center text-xs text-white/45">
        <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-[#e6b878]" /> Carte (Stripe) ou Mobile Money (PawaPay) · Conforme RGPD · Trimestre &amp; année proposés au paiement.
      </p>
    </div>
  );

  // MODE MODAL : overlay plein écran PAR-DESSUS, via un PORTAIL vers document.body — pour
  // échapper à tout ancêtre `transform`/`overflow` (ex. live-room) qui rognerait un fixed.
  if (asModal) {
    return createPortal(
      <div className="fixed inset-0 z-[120] overflow-y-auto" style={{ background: '#262624' }} role="dialog" aria-modal="true" aria-label="Forfaits">
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer"
          className="fixed right-4 top-4 z-10 rounded-full border border-[rgba(245,244,238,0.2)] bg-black/25 p-2 text-white/70 transition-colors hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>
        {body}
      </div>,
      document.body,
    );
  }

  // MODE PAGE : plein écran dans le shell du portail (bg chaud fourni par le shell).
  return (
    <LiriPortalShell active="reglages">
      <div className="h-full min-h-0 overflow-y-auto overflow-x-hidden" style={{ background: 'var(--base)' }}>
        {body}
      </div>
    </LiriPortalShell>
  );
}
