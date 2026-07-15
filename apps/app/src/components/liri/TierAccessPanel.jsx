/**
 * TierAccessPanel — « Votre forfait & vos accès » pour un MEMBRE connecté (/liri/forfaits).
 * Deux blocs COMPACTS, orientés membre (≠ page marketing publique) :
 *   1. Votre forfait actuel + la matrice d'accès (✅ débloqué / 🔒 dès [palier]).
 *   2. Faire évoluer : les 4 cycles en cartes compactes (prix depuis billing_plans), le forfait
 *      actuel marqué, les autres → checkout. Académique = recommandé.
 * Piloté par useMemberEntitlements (axe membre) + billing_plans (prix = source de vérité).
 */
import { useEffect, useState } from 'react';
import { Check, Lock, Sparkles, ArrowRight } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { resolveTenantSlug } from '@/lib/tenant/activeBranding';
import { useMemberEntitlements } from '@/hooks/useMemberEntitlements';
import { CYCLE_KEYS } from '@/lib/liri/memberTier';

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

export default function TierAccessPanel() {
  const { label, cycle, isStaff, hasForfait, upsellFor } = useMemberEntitlements();
  const [plans, setPlans] = useState([]);

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
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-white/40">Paiement sécurisé — carte (Stripe) ou Mobile Money. Trimestre &amp; année proposés au paiement.</p>
        </div>
      )}
    </div>
  );
}
