/**
 * LiriUpgradeWall — mur d'upgrade rendu EN PLACE quand un tenant SANS forfait LIRI atteint
 * une route LIRI gatée (cf. ProtectedLiriRoute / LiriAccessGate).
 *
 * Remplace l'ancienne FUITE `Navigate → /cimolace/billing?upgrade=liri` (audit cloison
 * 3-realms, racine ② — LIRI ne doit JAMAIS pointer vers /cimolace/*). La facturation reste
 * DANS le realm LIRI, sur le host neutre, avec la peau chaude du portail (LiriPortalShell).
 *
 * Réutilise le MÊME flux de paiement, éprouvé, que la facturation Cimolace :
 *   - Carte (Stripe) : tenantPortalApi.subscribe(key) → billingApi.cardCheckout(sub.id) → redirect.
 *   - Mobile Money (PawaPay) : MobileMoneyModal partagé (subscribe pawapay → collect → poll).
 * Les forfaits viennent de tenantPortalApi.marketplace(), filtrés sur la grille LIRI (`liri_*`).
 * Le tenant est résolu par l'intercepteur X-Tenant-Slug (authStore) — comme tout appel LIRI.
 */
import { useEffect, useState } from 'react';
import { CreditCard, Smartphone, Check, Loader2, Sparkles, ShieldCheck, AlertCircle } from 'lucide-react';
import { LiriPortalShell } from '@/components/liri/LiriPortalShell';
import MobileMoneyModal from '@/components/billing/MobileMoneyModal';
import { billingApi, tenantPortalApi } from '@/lib/api';

// Devises sans centime (montant déjà en unité entière — pas de /100).
const ZERO_DECIMAL_CUR = new Set(['XAF', 'XOF', 'XPF', 'JPY', 'KRW', 'VND', 'CLP', 'RWF', 'BIF', 'GNF', 'DJF', 'KMF', 'UGX']);
const eur = (cents, cur = 'EUR') => {
  const c = String(cur || 'EUR').toUpperCase();
  const value = ZERO_DECIMAL_CUR.has(c) ? (Number(cents) || 0) : (Number(cents) || 0) / 100;
  try { return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: c }).format(value); }
  catch { return `${value.toLocaleString('fr-FR')} ${c}`; }
};
// Indices de présentation par forfait LIRI (badge / mise en avant / accroche).
const PLAN_HINTS = {
  liri_start: { tagline: 'Lancez vos lives sans limite' },
  liri_business: { badge: 'Recommandé', highlight: true, tagline: 'Pour les organisations qui grandissent' },
  liri_entreprise: { tagline: 'Puissance maximale, accompagnement dédié' },
};
// Humaniseur générique (features = tableau de strings, chaîne, ou objet de limites/booléens).
function humanizeFeatures(features) {
  if (!features) return [];
  if (Array.isArray(features)) return features.filter(Boolean).flatMap((x) => (typeof x === 'string' ? x.split(/[\s,;]+/).filter(Boolean) : [String(x)]));
  if (typeof features === 'string') return features.split(/[\s,;]+/).filter(Boolean);
  if (typeof features === 'object') {
    return Object.entries(features).flatMap(([k, v]) => {
      if (v === false || v == null || k === 'forfait') return [];
      const label = k.replace(/_/g, ' ');
      if (v === true) return [label];
      if (v === -1) return [`${label} : illimité`];
      return [`${label} : ${v}`];
    });
  }
  return [];
}

export default function LiriUpgradeWall() {
  const [plans, setPlans] = useState(null); // null = chargement
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null);
  const [mmPlan, setMmPlan] = useState(null); // forfait dont le modal Mobile Money est ouvert

  useEffect(() => {
    let alive = true;
    tenantPortalApi.marketplace()
      .then((mk) => {
        if (!alive) return;
        const arr = Array.isArray(mk) ? mk : (mk?.plans || mk?.data || []);
        setPlans(arr.filter((p) => String(p?.key || '').startsWith('liri_')));
      })
      .catch(() => { if (alive) { setPlans([]); setError('Impossible de charger les forfaits pour le moment. Réessaie dans un instant.'); } });
    return () => { alive = false; };
  }, []);

  const subscribeCard = async (planKey) => {
    setBusy(`sub-${planKey}`); setError(null);
    try {
      const sub = await tenantPortalApi.subscribe(planKey);
      const { url } = await billingApi.cardCheckout(sub.id);
      if (url) { window.location.href = url; return; }
      setError('Abonnement créé, mais le paiement carte n’a pas démarré. Réessaie ou passe par Mobile Money.');
    } catch (e) {
      setError(e?.response?.data?.message || e?.message || 'Souscription impossible.');
    } finally { setBusy(null); }
  };

  return (
    <LiriPortalShell active="compte">
      <div className="h-full min-h-0 overflow-y-auto overflow-x-hidden" style={{ background: 'var(--base)' }}>
        <div className="mx-auto w-full max-w-5xl px-5 py-8 sm:px-8">
          {/* En-tête */}
          <div className="text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#d97757]/30 bg-[#d97757]/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-[#e58a5f]">
              <Sparkles size={13} /> Forfaits LIRI
            </span>
            <h1 className="lp-ink mt-4 text-[1.9rem] font-extrabold leading-tight sm:text-[2.25rem]">Passez à la pleine puissance</h1>
            <p className="lp-muted mx-auto mt-3 max-w-xl text-sm leading-relaxed">
              Lives illimités, replay, smartboard IA et tous les moteurs LIRI. Choisissez votre forfait — le paiement se fait ici, dans votre portail.
            </p>
          </div>

          {error && (
            <div className="mx-auto mt-6 flex max-w-xl items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/[0.08] px-4 py-3 text-sm text-red-200">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
            </div>
          )}

          {/* Grille des forfaits */}
          {plans === null ? (
            <div className="flex items-center justify-center py-24"><Loader2 className="h-7 w-7 animate-spin text-[#d97757]" /></div>
          ) : plans.length === 0 ? (
            <p className="lp-muted mt-16 text-center text-sm">Aucun forfait LIRI disponible pour le moment. Contactez le support.</p>
          ) : (
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {plans.map((p) => {
                const hint = PLAN_HINTS[p.key] || {};
                const feats = humanizeFeatures(p.features);
                const oneTime = (p.billing_cycle || 'monthly') === 'one_time';
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
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="lp-ink truncate font-bold">{p.label || p.key}</p>
                        {(hint.tagline || p.tagline) && <p className="mt-0.5 text-[11px] text-[#e0926a]/90">{hint.tagline || p.tagline}</p>}
                      </div>
                      {p.subscribed && <span className="shrink-0 whitespace-nowrap rounded-full border border-green-500/30 bg-green-500/15 px-2 py-0.5 text-[11px] text-green-400">Souscrit</span>}
                    </div>
                    {p.description && <p className="lp-muted mt-1.5 text-xs">{p.description}</p>}
                    <div className="mt-3 flex flex-wrap items-end gap-2">
                      <div className="lp-ink text-[1.9rem] font-black leading-none tracking-tight">{eur(p.price_cents, p.currency)}</div>
                      <div className="lp-faint mb-1 text-xs">/ {oneTime ? 'paiement unique' : 'mois'}</div>
                    </div>
                    {feats.length > 0 && (
                      <ul className="mt-4 flex-1 space-y-2 border-t border-[rgba(245,244,238,0.08)] pt-4">
                        {feats.slice(0, 8).map((f, i) => (
                          <li key={i} className="lp-muted flex items-start gap-2 text-[13px]"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#d97757]" /><span className="min-w-0 break-words">{f}</span></li>
                        ))}
                        {feats.length > 8 && <li className="lp-faint pl-[22px] text-xs">+ {feats.length - 8} autres</li>}
                      </ul>
                    )}
                    <button
                      disabled={p.subscribed || busy === `sub-${p.key}`}
                      onClick={() => subscribeCard(p.key)}
                      className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-[#d97757] px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#c9673f] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {busy === `sub-${p.key}` ? <Loader2 className="h-4 w-4 animate-spin" /> : p.subscribed ? <Check className="h-4 w-4" /> : <CreditCard className="h-4 w-4" />}
                      {p.subscribed ? 'Déjà actif' : (oneTime ? 'Commander' : 'Payer par carte')}
                    </button>
                    {!oneTime && !p.subscribed && (
                      <button
                        onClick={() => setMmPlan(p)}
                        className="mt-2 flex items-center justify-center gap-2 rounded-xl border border-[#e6b878]/40 px-4 py-2 text-[13px] font-semibold text-[#e6b878] transition-colors hover:bg-[#e6b878]/[0.08]"
                      >
                        <Smartphone className="h-4 w-4" /> Mobile Money (Afrique)
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <p className="lp-faint mt-6 flex flex-wrap items-center justify-center gap-1.5 text-center text-xs">
            <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-[#e6b878]" /> Carte (Stripe) ou Mobile Money (PawaPay) · Conforme RGPD · Paiement 100 % dans votre portail LIRI.
          </p>
        </div>

        {mmPlan && (
          <MobileMoneyModal
            plan={mmPlan}
            onClose={() => setMmPlan(null)}
            onPaid={() => { if (typeof window !== 'undefined') window.location.reload(); }}
          />
        )}
      </div>
    </LiriPortalShell>
  );
}
