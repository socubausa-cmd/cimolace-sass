/**
 * TierAccessPanel — « Votre forfait & vos accès » pour un MEMBRE connecté (/liri/forfaits).
 * Deux blocs COMPACTS, orientés membre (≠ page marketing publique) :
 *   1. Votre forfait actuel + la matrice d'accès (✅ débloqué / 🔒 dès [palier]).
 *   2. Faire évoluer : les 4 cycles en cartes compactes (prix depuis billing_plans), le forfait
 *      actuel marqué, les autres → checkout. Académique = recommandé.
 * Piloté par useMemberEntitlements (axe membre) + billing_plans (prix = source de vérité).
 */
import { useEffect, useState } from 'react';
import { Check, Lock, Sparkles, ArrowRight, X } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { resolveTenantSlug } from '@/lib/tenant/activeBranding';
import { useMemberEntitlements } from '@/hooks/useMemberEntitlements';
import { CYCLE_KEYS, CYCLE_RANK, FEATURE_MIN_RANK } from '@/lib/liri/memberTier';

const GROUPS = [
  { title: 'Apprentissage', items: [
    ['coursReplay', 'Cours enregistrés — replay illimité'],
    ['coursLive', 'Cours EN DIRECT — temps réel, questions au professeur'],
    ['library', 'Bibliothèque & livres fondamentaux'],
  ] },
  { title: 'Accompagnement', items: [
    ['seancePrivee', 'Séances privées 1:1 incluses'],
    ['dmMentor', 'Messagerie directe avec un mentor'],
    ['mentorat', 'Parcours praticien — mentorat, stages'],
  ] },
  { title: 'Communauté & rituel', items: [
    ['forum', 'Forum & questions'],
    ['temple', 'Temple & cultes en direct'],
    ['cerclePraticien', 'Cercle des praticiens'],
  ] },
];

const CYCLE_HINT = {
  autonome:   { tag: 'Apprendre en autonomie · Temple inclus' },
  academique: { tag: 'Le cursus complet, en direct', recommended: true },
  prive:      { tag: 'Accompagnement rapproché · séances privées' },
  privilegie: { tag: 'Devenir praticien · mentorat & stages' },
};
const CYCLE_LABEL = { autonome: 'Autonome', academique: 'Académique', prive: 'Privé', privilegie: 'Privilégié' };

// Détail « En savoir plus » de chaque forfait.
const CYCLE_DETAIL = {
  autonome: {
    pitch: "Le socle de la Prorascience, en autonomie. Vous étudiez à votre rythme par les enregistrements, avec le Temple et les cultes en ligne.",
    forWhom: 'Pour qui veut découvrir le corpus, apprendre seul et pratiquer le rituel — sans accompagnement.',
  },
  academique: {
    pitch: "L'école en salle de classe. Le cursus complet et encadré, avec les cours EN DIRECT (temps réel, questions au professeur) et la préparation à l'initiation.",
    forWhom: 'Pour qui veut être encadré, suivre un parcours structuré et interagir en direct avec les enseignants.',
  },
  prive: {
    pitch: 'Un suivi personnel rapproché. Des séances privées 1:1 incluses et une messagerie directe avec un mentor, en petit comité.',
    forWhom: 'Pour qui veut un accompagnement individuel, des séances privées et un suivi personnalisé.',
  },
  privilegie: {
    pitch: 'Devenir praticien. Le mentorat souverain, la formation au métier (mage / ganga), les stages pratiques et le cercle des praticiens.',
    forWhom: "Pour qui veut EXERCER : apprendre le métier, être formé et rejoindre le cercle des praticiens.",
  },
};

// Liste plate de toutes les features (label + rang requis) — pour la vue détail.
const ALL_FEATURES = GROUPS.flatMap((g) => g.items.map(([key, text]) => ({ key, text, min: FEATURE_MIN_RANK[key] || 1 })));

export default function TierAccessPanel() {
  const { label, cycle, isStaff, hasForfait, upsellFor } = useMemberEntitlements();
  const [plans, setPlans] = useState([]);
  const [detailCycle, setDetailCycle] = useState(null); // « En savoir plus » : cycle affiché en détail

  useEffect(() => {
    let alive = true;
    supabase.from('billing_plans')
      .select('key,price_cents,currency,is_active')
      .eq('is_active', true).order('price_cents', { ascending: true })
      .then(({ data }) => {
        if (!alive) return;
        const m = (data || [])
          .filter((p) => /^(autonome|academique|prive|privilegie)-monthly$/.test(String(p.key || '').toLowerCase()))
          .map((p) => ({ cycle: String(p.key).toLowerCase().replace(/-monthly$/, ''), key: p.key, price: Math.round(Number(p.price_cents || 0) / 100) }))
          .sort((a, b) => CYCLE_KEYS.indexOf(a.cycle) - CYCLE_KEYS.indexOf(b.cycle));
        setPlans(m);
      });
    return () => { alive = false; };
  }, []);

  if (!hasForfait) return null; // le mur d'upgrade gère le cas sans forfait

  const slug = resolveTenantSlug();
  const checkout = (key) => (slug ? `/t/${slug}/paiement?plan=${encodeURIComponent(key)}&type=subscription` : '/liri/forfaits');

  return (
    <div className="mx-auto w-full max-w-4xl px-5 py-8 sm:px-8">
      {/* 1 — VOTRE FORFAIT + matrice */}
      <div className="rounded-2xl border border-white/10 bg-[#2a2724] p-6 sm:p-7">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#e58a5f]">Votre forfait</p>
        <h2 className="mt-1 text-xl font-bold text-white">{isStaff ? 'Accès équipe — tout débloqué' : (label || 'Membre')}</h2>

        <div className="mt-6 grid gap-6 sm:grid-cols-3">
          {GROUPS.map((g) => (
            <div key={g.title}>
              <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-white/45">{g.title}</p>
              <ul className="space-y-2.5">
                {g.items.map(([key, text]) => {
                  const u = upsellFor(key);
                  const unlocked = isStaff || !u.locked;
                  return (
                    <li key={key} className="flex items-start gap-2.5 text-[13px] leading-snug">
                      {unlocked
                        ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#d97757]" />
                        : <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-white/30" />}
                      <span className={unlocked ? 'text-white/85' : 'text-white/45'}>
                        {text}
                        {!unlocked && u.minCycleLabel && <span className="ml-1 text-[#e58a5f]">· dès {u.minCycleLabel}</span>}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* 2 — FAIRE ÉVOLUER : les 4 cycles en cartes compactes */}
      {!isStaff && plans.length > 0 && (
        <div className="mt-6">
          <h3 className="mb-3 text-[11px] font-bold uppercase tracking-[0.16em] text-white/45">Faire évoluer votre forfait</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {plans.map((p) => {
              const isCurrent = p.cycle === cycle;
              const hint = CYCLE_HINT[p.cycle] || {};
              return (
                <div key={p.key}
                  className={`relative flex flex-col rounded-xl border p-4 ${
                    isCurrent ? 'border-[#d97757]/55 bg-[#d97757]/[0.07]'
                      : hint.recommended ? 'border-[#e6cc92]/35 bg-[rgba(0,0,0,0.16)]'
                      : 'border-white/10 bg-[rgba(0,0,0,0.16)]'}`}>
                  {hint.recommended && !isCurrent && (
                    <span className="absolute -top-2 left-4 rounded-full bg-[#e6cc92] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[#231208]">Recommandé</span>
                  )}
                  <p className="font-bold text-white">{CYCLE_LABEL[p.cycle]}</p>
                  <p className="mt-0.5 min-h-[2.4em] text-[11px] leading-snug text-white/50">{hint.tag}</p>
                  <p className="mt-2 text-lg font-black text-white">{p.price} €<span className="text-xs font-normal text-white/45">/mois</span></p>
                  {isCurrent ? (
                    <span className="mt-3 inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#d97757]/40 px-3 py-2 text-xs font-semibold text-[#e58a5f]">
                      <Check className="h-3.5 w-3.5" /> Forfait actuel
                    </span>
                  ) : (
                    <a href={checkout(p.key)}
                      className="mt-3 inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#d97757] px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-[#c9673f]">
                      <Sparkles className="h-3.5 w-3.5" /> Passer <ArrowRight className="h-3.5 w-3.5" />
                    </a>
                  )}
                  <button type="button" onClick={() => setDetailCycle(p.cycle)}
                    className="mt-2 text-[11px] text-white/45 underline underline-offset-2 transition-colors hover:text-white/75">
                    En savoir plus
                  </button>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-white/40">Paiement sécurisé — carte (Stripe) ou Mobile Money. Trimestre &amp; année proposés au paiement.</p>
        </div>
      )}

      {/* « En savoir plus » — détail complet d'un forfait */}
      {detailCycle && (() => {
        const r = CYCLE_RANK[detailCycle] || 0;
        const d = CYCLE_DETAIL[detailCycle] || {};
        const p = plans.find((x) => x.cycle === detailCycle);
        const isCurrent = detailCycle === cycle;
        const included = ALL_FEATURES.filter((f) => r >= f.min);
        const locked = ALL_FEATURES.filter((f) => r < f.min);
        return (
          <div className="fixed inset-0 z-[130] flex items-center justify-center overflow-y-auto bg-black/60 p-4" onClick={() => setDetailCycle(null)} role="dialog" aria-modal="true">
            <div className="my-8 w-full max-w-lg rounded-2xl border border-white/10 bg-[#221f1c] p-6 sm:p-7" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#e58a5f]">Forfait{isCurrent ? ' · le vôtre' : ''}</p>
                  <h3 className="mt-1 text-2xl font-black text-white">{CYCLE_LABEL[detailCycle]}</h3>
                  {p && <p className="mt-0.5 text-lg font-bold text-white">{p.price} €<span className="text-xs font-normal text-white/45">/mois</span></p>}
                </div>
                <button type="button" onClick={() => setDetailCycle(null)} aria-label="Fermer" className="rounded-full border border-white/15 p-1.5 text-white/60 transition-colors hover:text-white"><X className="h-4 w-4" /></button>
              </div>
              {d.pitch && <p className="mt-4 text-sm leading-relaxed text-white/80">{d.pitch}</p>}
              {d.forWhom && <p className="mt-2 text-[13px] italic leading-relaxed text-white/55">{d.forWhom}</p>}
              <div className="mt-5">
                <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-white/45">Ce qui est inclus</p>
                <ul className="space-y-1.5">
                  {included.map((f) => (
                    <li key={f.key} className="flex items-start gap-2 text-[13px] text-white/85"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#d97757]" />{f.text}</li>
                  ))}
                </ul>
              </div>
              {locked.length > 0 && (
                <div className="mt-4">
                  <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-white/35">Aux paliers supérieurs</p>
                  <ul className="space-y-1.5">
                    {locked.map((f) => (
                      <li key={f.key} className="flex items-start gap-2 text-[13px] text-white/40"><Lock className="mt-0.5 h-3 w-3 shrink-0" /><span>{f.text} <span className="text-[#e58a5f]/70">· dès {CYCLE_LABEL[CYCLE_KEYS.find((c) => CYCLE_RANK[c] >= f.min)]}</span></span></li>
                    ))}
                  </ul>
                </div>
              )}
              {!isCurrent && p && (
                <a href={checkout(p.key)} className="mt-6 flex items-center justify-center gap-2 rounded-xl bg-[#d97757] px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#c9673f]">
                  <Sparkles className="h-4 w-4" /> Passer à {CYCLE_LABEL[detailCycle]} · {p.price} €/mois <ArrowRight className="h-4 w-4" />
                </a>
              )}
              {isCurrent && <p className="mt-6 text-center text-xs text-white/45">C'est votre forfait actuel.</p>}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
