/**
 * TierAccessPanel — « Vos forfaits & vos accès » pour un MEMBRE connecté (/liri/forfaits).
 *
 * SÉLECTEUR : on choisit un forfait dans un segmenteur → une fiche détaillée s'affiche
 * (à qui c'est destiné · tout l'accès · avantages · limites · réduction boutique) avec un CTA
 * « Payer » (checkout Stripe/Mobile Money) + un lien secondaire « Prendre rendez-vous ».
 * Puis une section « Cours par module » (boutique + événements) avec la grille de réductions.
 *
 * Piloté par useMemberEntitlements (forfait courant) + billing_plans (prix = source de vérité).
 * Contenu éditorial (Temple, parcours initiatique, sacerdoce…) = décision fondateur, ci-dessous.
 */
import { useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  Check, Sparkles, ArrowRight, CalendarClock, PhoneCall, BookOpenText, Video,
  CalendarDays, Users2, HeartHandshake, Crown, GraduationCap, Compass, MinusCircle,
  Flame, Moon, Ticket, ShoppingBag, Star, ShieldCheck, Target,
} from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { resolveTenantSlug } from '@/lib/tenant/activeBranding';
import { useMemberEntitlements } from '@/hooks/useMemberEntitlements';

const CYCLE_LABEL = { autonome: 'Autonome', academique: 'Académique', prive: 'Privé', privilegie: 'Privilégié' };
const CYCLE_ICON = { autonome: Compass, academique: GraduationCap, prive: HeartHandshake, privilegie: Crown };
const CYCLE_KICKER = {
  autonome: 'Le Temple, en autonomie',
  academique: 'Le parcours initiatique',
  prive: 'Accompagnement rapproché',
  privilegie: 'La voie du praticien',
};
// Réduction automatique sur les cours-modules (boutique) + événements, selon le forfait.
const DISCOUNTS = { autonome: 25, academique: 40, prive: 50, privilegie: 60 };
const RECOMMENDED = 'academique';
const ORDER = ['autonome', 'academique', 'prive', 'privilegie'];

// Fiche éditoriale de chaque forfait (à qui · accès · avantages · limites).
const PLAN = {
  autonome: {
    tagline: 'Le socle de la Prorascience, en autonomie — le Temple ouvert.',
    forWhom: "Pour qui veut découvrir le corpus et pratiquer le rituel, seul et à son rythme, sans accompagnement.",
    access: [
      { icon: CalendarDays, text: "Temple Ngowazulu — calendrier d'ouverture & de fermeture, 2 jours par mois" },
      { icon: BookOpenText, text: 'Documentation du culte & des enseignements' },
      { icon: Video, text: 'Vidéothèque du Temple' },
      { icon: Ticket, text: 'Événements du Temple' },
      { icon: Video, text: 'Cours enregistrés — replay illimité' },
      { icon: BookOpenText, text: 'Bibliothèque & livres fondamentaux' },
      { icon: Users2, text: 'Forum & questions' },
    ],
    avantages: ['Rythme totalement libre', 'Temple & cultes en ligne inclus', "Le tarif d'entrée le plus accessible"],
    limites: ['Pas de cours en direct ni de questions au professeur', 'Aucun accompagnement ni séance privée', 'Pas de parcours initiatique'],
  },
  academique: {
    tagline: "Le parcours initiatique — un an, jusqu'à devenir Initié.",
    forWhom: "Réservé à la Prorascience : pour qui veut suivre le cursus complet, encadré, et être initié au terme d'un an.",
    access: [
      { icon: Compass, text: "Parcours initiatique structuré sur 1 an → titre d'Initié" },
      { icon: Video, text: 'Cours EN DIRECT — temps réel, questions au professeur' },
      { icon: GraduationCap, text: "Préparation & validation de l'initiation" },
      { icon: Check, text: "Tout l'accès Autonome (Temple, replay, bibliothèque, forum)" },
    ],
    avantages: ['Encadrement et progression structurée', 'Interaction directe avec les enseignants', 'Aboutit à un statut : Initié'],
    limites: ["Engagement d'un an", 'Pas de séances privées 1:1 (→ Privé)', 'Ne forme pas au métier de praticien (→ Privilégié)'],
  },
  prive: {
    tagline: 'Accompagnement rapproché — pour traverser une période difficile.',
    forWhom: "Pour qui veut être assisté durant une période difficile : un apprentissage et un suivi individuel sur un emploi du temps qu'il définit lui-même.",
    access: [
      { icon: HeartHandshake, text: 'Séances privées 1:1 incluses' },
      { icon: Users2, text: 'Messagerie directe avec un mentor' },
      { icon: CalendarClock, text: 'Emploi du temps personnalisé — défini par vous, à votre rythme' },
      { icon: Compass, text: 'Apprentissage + suivi individuel' },
      { icon: Check, text: "Tout l'accès Académique (direct, initiation, Temple…)" },
    ],
    avantages: ['Attention directe et personnalisée', 'Calendrier à la carte, adapté à votre situation', 'Soutien pendant les moments difficiles'],
    limites: ['Ne forme pas au métier de praticien (→ Privilégié)', 'Tarif plus élevé (accompagnement individuel)'],
  },
  privilegie: {
    tagline: 'Devenir maître — la maîtrise du sacerdoce.',
    forWhom: 'Réservé aux praticiens : pour qui veut apprendre le métier de maître spirituel et maîtriser le sacerdoce.',
    access: [
      { icon: Crown, text: 'Formation au métier de maître spirituel (sacerdoce)' },
      { icon: Flame, text: 'Mentorat souverain & stages pratiques' },
      { icon: Users2, text: 'Cercle des praticiens' },
      { icon: Check, text: "Tout l'accès Privé (séances 1:1, suivi personnalisé…)" },
    ],
    avantages: ['Formation professionnelle complète au métier', 'Mentorat au plus haut niveau + stages', 'Réduction maximale (60 %) sur les modules & événements'],
    limites: ['Réservé aux profils à vocation de praticien', "Le niveau d'engagement et d'exigence le plus élevé"],
  },
};

const MODULE_EXAMPLES = [
  { icon: Flame, text: 'Libation — 3 jours' },
  { icon: Moon, text: 'Interprétation des songes' },
];

const RDV_URL = '/liri/rendez-vous';
const BOUTIQUE_URL = '/liri/marche';

export default function TierAccessPanel() {
  const { label, cycle, isStaff, hasForfait } = useMemberEntitlements();
  const [plans, setPlans] = useState([]);
  const [selected, setSelected] = useState(null);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    let alive = true;
    supabase.from('billing_plans')
      .select('key,price_cents,currency,is_active')
      .eq('is_active', true).order('price_cents', { ascending: true })
      .then(({ data }) => {
        if (!alive) return;
        const m = (data || [])
          .filter((p) => /^(autonome|academique|prive|privilegie)-monthly$/.test(String(p.key || '').toLowerCase()))
          .map((p) => ({ cycle: String(p.key).toLowerCase().replace(/-monthly$/, ''), key: p.key, price: Math.round(Number(p.price_cents || 0) / 100) }));
        setPlans(m);
      });
    return () => { alive = false; };
  }, []);

  // Sélection par défaut = forfait courant, sinon le recommandé.
  useEffect(() => {
    if (!selected) setSelected(cycle && ORDER.includes(cycle) ? cycle : RECOMMENDED);
  }, [cycle, selected]);

  const priceOf = useMemo(() => {
    const map = {};
    plans.forEach((p) => { map[p.cycle] = p.price; });
    return map;
  }, [plans]);

  if (!hasForfait) return null; // le mur d'upgrade gère le cas sans forfait

  const slug = resolveTenantSlug();
  const checkout = (key) => (slug ? `/t/${slug}/paiement?plan=${encodeURIComponent(key)}&type=subscription` : '/liri/forfaits');

  const sel = selected && ORDER.includes(selected) ? selected : RECOMMENDED;
  const d = PLAN[sel];
  const SelIcon = CYCLE_ICON[sel] || Sparkles;
  const selPrice = priceOf[sel];
  const selKey = `${sel}-monthly`;
  const isCurrentSel = sel === cycle;

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-8">
      {/* En-tête : forfait courant */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#e58a5f]">Vos forfaits</p>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-white">Choisissez votre voie</h1>
        </div>
        <div className="rounded-full border border-white/12 bg-[#2a2724] px-3.5 py-1.5 text-[12px] text-white/70">
          Forfait actuel · <span className="font-semibold text-white">{isStaff ? 'Accès équipe' : (label || 'Membre')}</span>
        </div>
      </div>

      {/* SÉLECTEUR — 4 forfaits */}
      <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {ORDER.map((key) => {
          const Icon = CYCLE_ICON[key];
          const active = key === sel;
          const current = key === cycle;
          const price = priceOf[key];
          return (
            <button
              key={key}
              type="button"
              onClick={() => setSelected(key)}
              aria-pressed={active}
              className={`group relative flex flex-col items-start gap-1 rounded-2xl border px-3.5 py-3 text-left transition-all duration-200 ${
                active
                  ? 'border-[#d97757] bg-[#d97757]/[0.12] shadow-[0_10px_30px_-12px_rgba(217,119,87,0.55)]'
                  : 'border-white/10 bg-[#2a2724] hover:border-white/25 hover:bg-[#312d29]'
              }`}
            >
              {key === RECOMMENDED && (
                <span className="absolute -top-2 right-2.5 rounded-full bg-[#e6cc92] px-2 py-0.5 text-[8.5px] font-bold uppercase tracking-wide text-[#231208]">
                  ★ Conseillé
                </span>
              )}
              <span className={`flex h-8 w-8 items-center justify-center rounded-xl border ${active ? 'border-[#d97757]/50 bg-[#d97757]/15 text-[#e58a5f]' : 'border-white/10 bg-black/20 text-white/60 group-hover:text-white/80'}`}>
                <Icon className="h-4 w-4" />
              </span>
              <span className="mt-1 flex w-full items-center gap-1.5 text-[13px] font-bold text-white">
                {CYCLE_LABEL[key]}
                {current && <Check className="h-3.5 w-3.5 text-[#d97757]" aria-label="forfait actuel" />}
              </span>
              <span className="text-[11px] font-medium tabular-nums text-white/55">
                {price != null ? <>{price} €<span className="text-white/35">/mois</span></> : 'Sur demande'}
              </span>
            </button>
          );
        })}
      </div>

      {/* FICHE DÉTAILLÉE du forfait sélectionné */}
      <motion.div
        key={sel}
        initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="mt-4 overflow-hidden rounded-3xl border border-white/10 bg-[#221f1c]"
      >
        {/* bandeau titre */}
        <div className="relative flex flex-wrap items-start justify-between gap-4 border-b border-white/10 bg-gradient-to-br from-[#2a201a] via-[#221f1c] to-[#221f1c] p-6 sm:p-7">
          <div className="pointer-events-none absolute -right-8 -top-10 h-40 w-40 rounded-full bg-[#d97757]/10 blur-3xl" />
          <div className="relative min-w-0">
            <div className="flex items-center gap-2.5">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#d97757]/40 bg-[#d97757]/12 text-[#e58a5f]">
                <SelIcon className="h-5 w-5" />
              </span>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#e58a5f]">{CYCLE_KICKER[sel]}</p>
                <h2 className="text-2xl font-black leading-tight text-white">{CYCLE_LABEL[sel]}</h2>
              </div>
            </div>
            <p className="mt-3 max-w-xl text-[15px] font-medium leading-snug text-white/90">{d.tagline}</p>
          </div>
          <div className="relative shrink-0 text-right">
            {selPrice != null ? (
              <p className="text-3xl font-black tabular-nums text-white">
                {selPrice} €<span className="text-sm font-normal text-white/45">/mois</span>
              </p>
            ) : (
              <p className="text-lg font-bold text-white/80">Sur demande</p>
            )}
            <span className="mt-1.5 inline-flex items-center gap-1.5 rounded-full border border-[#d97757]/35 bg-[#d97757]/10 px-2.5 py-1 text-[11px] font-semibold text-[#e58a5f]">
              <Star className="h-3 w-3" /> −{DISCOUNTS[sel]} % boutique & événements
            </span>
          </div>
        </div>

        <div className="p-6 sm:p-7">
          {/* À qui c'est destiné */}
          <div className="flex items-start gap-2.5 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <Target className="mt-0.5 h-5 w-5 shrink-0 text-[#d97757]" />
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-white/45">À qui c'est destiné</p>
              <p className="mt-1 text-[14px] leading-relaxed text-white/85">{d.forWhom}</p>
            </div>
          </div>

          {/* Accès complet */}
          <div className="mt-6">
            <p className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-white/50">
              <Sparkles className="h-4 w-4 text-[#d97757]" /> Tout ce que vous débloquez
            </p>
            <div className="grid gap-2.5 sm:grid-cols-2">
              {d.access.map((a) => {
                const Ico = a.icon || Check;
                return (
                  <div key={a.text} className="flex items-start gap-3 rounded-xl border border-white/8 bg-[#2a2724] p-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#d97757]/12 text-[#d97757]">
                      <Ico className="h-4 w-4" />
                    </span>
                    <span className="text-[13px] leading-snug text-white/88">{a.text}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Avantages / Limites */}
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.05] p-4">
              <p className="mb-2.5 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-emerald-300/95">
                <Check className="h-4 w-4" /> Avantages
              </p>
              <ul className="space-y-2">
                {d.avantages.map((t) => (
                  <li key={t} className="flex items-start gap-2 text-[13px] leading-snug text-white/85">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />{t}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-rose-400/18 bg-rose-500/[0.04] p-4">
              <p className="mb-2.5 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-rose-200/85">
                <MinusCircle className="h-4 w-4" /> Limites de ce palier
              </p>
              <ul className="space-y-2">
                {d.limites.map((t) => (
                  <li key={t} className="flex items-start gap-2 text-[13px] leading-snug text-white/70">
                    <MinusCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-300/80" />{t}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* CTA : Payer (principal) + Prendre rendez-vous (secondaire) */}
          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
            {isStaff ? (
              <span className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#d97757]/40 px-5 py-3 text-sm font-semibold text-[#e58a5f]">
                <ShieldCheck className="h-4 w-4" /> Accès équipe — tout débloqué
              </span>
            ) : isCurrentSel ? (
              <span className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#d97757]/45 bg-[#d97757]/[0.08] px-5 py-3 text-sm font-bold text-[#e58a5f]">
                <Check className="h-4 w-4" /> C'est votre forfait actuel
              </span>
            ) : selPrice != null ? (
              <a
                href={checkout(selKey)}
                className="group inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#d97757] px-5 py-3 text-sm font-bold text-white shadow-lg shadow-[#d97757]/25 transition-colors hover:bg-[#c9673f] sm:flex-none sm:min-w-[240px]"
              >
                <Sparkles className="h-4 w-4" /> Payer — passer à {CYCLE_LABEL[sel]} · {selPrice} €/mois
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </a>
            ) : null}

            <a
              href={RDV_URL}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 px-5 py-3 text-sm font-semibold text-white/85 transition-colors hover:bg-white/[0.06]"
            >
              <PhoneCall className="h-4 w-4 text-[#d97757]" /> Prendre rendez-vous
            </a>
          </div>
          <p className="mt-3 flex items-center gap-1.5 text-[11px] text-white/40">
            <ShieldCheck className="h-3.5 w-3.5" /> Paiement sécurisé — carte (Stripe) ou Mobile Money · trimestre & année proposés au paiement.
          </p>
        </div>
      </motion.div>

      {/* COURS PAR MODULE — boutique + événements + grille de réductions */}
      <div className="mt-6 rounded-3xl border border-white/10 bg-[#2a2724] p-6 sm:p-7">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[#d97757]/35 bg-[#d97757]/12 text-[#d97757]">
            <ShoppingBag className="h-5 w-5" />
          </span>
          <div>
            <h3 className="text-lg font-bold text-white">Cours par module — renforcer une capacité</h3>
            <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-white/60">
              Ce ne sont pas des programmes, mais des <span className="text-white/85">compétences mystiques précises</span>,
              à l'unité — disponibles dans la boutique et lors des événements.
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {MODULE_EXAMPLES.map((m) => {
            const Ico = m.icon;
            return (
              <span key={m.text} className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-black/20 px-3 py-1.5 text-[12px] text-white/80">
                <Ico className="h-3.5 w-3.5 text-[#d97757]" /> {m.text}
              </span>
            );
          })}
          <span className="inline-flex items-center rounded-full border border-white/10 px-3 py-1.5 text-[12px] text-white/40">et bien d'autres…</span>
        </div>

        {/* Grille de réductions par forfait */}
        <div className="mt-5">
          <p className="mb-2.5 text-[11px] font-bold uppercase tracking-wider text-white/45">Votre réduction automatique</p>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {ORDER.map((key) => {
              const active = key === sel;
              const current = key === cycle;
              return (
                <div
                  key={key}
                  className={`rounded-2xl border p-3.5 text-center ${
                    active ? 'border-[#d97757]/55 bg-[#d97757]/[0.1]' : 'border-white/10 bg-black/20'
                  }`}
                >
                  <p className="text-[12px] font-semibold text-white/75">{CYCLE_LABEL[key]}</p>
                  <p className={`mt-0.5 text-2xl font-black tabular-nums ${active ? 'text-[#e58a5f]' : 'text-white'}`}>
                    −{DISCOUNTS[key]}<span className="text-sm font-bold">%</span>
                  </p>
                  {current && <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#d97757]">Le vôtre</p>}
                </div>
              );
            })}
          </div>
        </div>

        <a
          href={BOUTIQUE_URL}
          className="mt-5 inline-flex items-center gap-2 rounded-xl border border-white/20 px-4 py-2.5 text-sm font-semibold text-white/85 transition-colors hover:bg-white/[0.06]"
        >
          <ShoppingBag className="h-4 w-4 text-[#d97757]" /> Explorer les modules dans la boutique
          <ArrowRight className="h-4 w-4" />
        </a>
      </div>
    </div>
  );
}
