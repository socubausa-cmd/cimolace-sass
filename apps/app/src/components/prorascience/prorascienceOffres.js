/**
 * SOURCE UNIQUE des offres affichées sur le site public prorascience.org.
 *
 * ⛔ CONTRAINTE : aucun montant n'est écrit ici.
 *  - Les 4 cycles École sont LUS dans `billing_plans` (mêmes clés que /forfaits et que l'OS) ;
 *    tant que la lecture n'a pas abouti, on n'affiche AUCUN prix (mieux vaut un vide qu'un
 *    prix qui diverge de ce que Stripe encaisse).
 *  - La gamme Temple (mentorats) est dérivée de `@/config/ngowazuluMentoratOffers` : ce fichier
 *    porte déjà slugs + montants, on ne recopie donc pas une seconde fois les chiffres.
 *
 * PIÈGE connu (signalé, non corrigeable ici) : le serveur court-circuite billing_plans pour les
 * slugs mentorat (NGOWAZULU_PLAN_AMOUNTS_EUR_CENTS dans offering-checkout.service.ts). Le prix
 * affiché vient donc de la même famille de constantes que le prix facturé, mais pas de la base.
 */
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { ngowazuluMentoratOffers } from '@/config/ngowazuluMentoratOffers';

export const CONSULTATION_PLAN_SLUG = 'ngowazulu-consultation-90min';

// Le checkout éprouvé est /paiement (alias racine du domaine propre, cf. route App.jsx).
// ⚠️ On n'ajoute PAS `next=reserver` : la cible /reserver n'existe pas en route racine
// (elle 404 sur prorascience.org). Tant que la route manque, on ne promet pas de créneau.
export function cheminPaiement({ plan, type, label, priceLabel }) {
  const params = new URLSearchParams();
  params.set('plan', plan);
  if (type) params.set('type', type);
  if (label) params.set('label', label);
  if (priceLabel) params.set('priceLabel', priceLabel);
  return `/paiement?${params.toString()}`;
}

export const CHEMIN_CONSULTATION = cheminPaiement({
  plan: CONSULTATION_PLAN_SLUG,
  type: 'consultation',
  label: 'Consultation 90 min',
});

// Chemins réels (routes existantes) vers les services annoncés par le site.
export const CHEMIN_CONTACT = '/nous-contacter';
export const CHEMIN_FORFAITS = '/forfaits';
export const CHEMIN_BOUTIQUE = '/boutique-sacree';
export const CHEMIN_SERVICES_TEMPLE = '/services-spirituels';

// « Pour qui » de chaque cycle — miroir de CYCLE_META (CimolaceCreationAgent.jsx) pour que le
// site et l'OS disent la même chose. Aucun prix ici : uniquement le positionnement.
export const CYCLE_META = {
  autonome: { name: 'Autonome', pourQui: 'Apprendre en autonomie — Temple & cultes inclus.' },
  academique: { name: 'Académique', pourQui: 'Le cursus complet, encadré par l’équipe.' },
  prive: { name: 'Privé', pourQui: 'Accompagnement rapproché, en petit comité.' },
  privilegie: { name: 'Privilégié', pourQui: 'Pour ceux qui veulent pratiquer — mentorat souverain.' },
};

const ORDRE_CYCLES = ['autonome', 'academique', 'prive', 'privilegie'];

/**
 * Lit les 4 cycles mensuels dans billing_plans (même requête que l'OS : source de vérité).
 * Retourne { chargement, cycles, indisponible } — `indisponible` = on affiche le cycle SANS prix.
 */
export function useCyclesEcole() {
  const [etat, setEtat] = useState({ chargement: true, cycles: [], indisponible: false });

  useEffect(() => {
    let vivant = true;
    (async () => {
      try {
        const { data, error } = await supabase
          .from('billing_plans')
          .select('key,label,price_cents,currency,is_active')
          .eq('is_active', true)
          .order('price_cents', { ascending: true });
        if (error) throw error;
        const cycles = (data || [])
          .filter((p) => /^(autonome|academique|prive|privilegie)-monthly$/.test(String(p.key || '').toLowerCase()))
          .map((p) => {
            const cle = String(p.key).toLowerCase().replace(/-monthly$/, '');
            return {
              key: p.key,
              cycle: cle,
              label: p.label || CYCLE_META[cle]?.name || cle,
              prix: Math.round(Number(p.price_cents || 0) / 100),
              devise: p.currency || 'EUR',
              pourQui: CYCLE_META[cle]?.pourQui || '',
            };
          })
          .sort((a, b) => ORDRE_CYCLES.indexOf(a.cycle) - ORDRE_CYCLES.indexOf(b.cycle));
        if (!vivant) return;
        setEtat({ chargement: false, cycles, indisponible: cycles.length === 0 });
      } catch {
        if (vivant) setEtat({ chargement: false, cycles: [], indisponible: true });
      }
    })();
    return () => { vivant = false; };
  }, []);

  return etat;
}

/** Cycles « secours » SANS prix : on nomme les 4 chemins même si la base ne répond pas. */
export const CYCLES_SANS_PRIX = ORDRE_CYCLES.map((cle) => ({
  key: `${cle}-monthly`,
  cycle: cle,
  label: `Cycle ${CYCLE_META[cle].name}`,
  prix: null,
  devise: 'EUR',
  pourQui: CYCLE_META[cle].pourQui,
}));

/**
 * Gamme Temple (mentorats) — dérivée de ngowazuluMentoratOffers : nom, sous-titre, fréquence et
 * montant viennent du fichier de configuration, pas d'une seconde copie littérale.
 */
export const OFFRES_MENTORAT = ngowazuluMentoratOffers.map((o) => ({
  slug: o.slug,
  nom: `Mentorat ${o.commercialName}`,
  sousTitre: o.subtitle,
  prix: String(o.priceAmount),
  frequence: o.frequencyShort,
  bullets: o.bullets,
  intro: o.detailIntro,
}));
