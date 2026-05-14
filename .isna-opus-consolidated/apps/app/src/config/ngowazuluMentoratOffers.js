/**
 * Offres mentorat NGOWAZULU — libellés commerciaux + copy (durée 1 mois, fréquence au choix).
 * Les slugs correspondent à billing_plans.
 */
export const ngowazuluMentoratOffers = [
  {
    slug: 'ngowazulu-mentorat-1x-month',
    commercialName: 'Essentiel',
    subtitle: 'Rythme patrimonial',
    priceLabel: '55 EUR / mois',
    priceAmount: 55,
    frequencyShort: '1 rencontre / mois',
    sessionsPerMonth: 1,
    accent: 'from-emerald-500/20 to-emerald-900/10 border-emerald-500/25',
    badgeClass: 'bg-emerald-500/15 text-emerald-200 border-emerald-500/30',
    detailIntro:
      'Contrat d’un mois renouvelable : vous choisissez ce rythme pour une présence régulière mais espacée du maître.',
    bullets: [
      'Idéal pour stabilisation, suivi de fond ou budget maîtrisé.',
      'La fréquence des rencontres est celle du contrat ; le calendrier précis se valide avec le temple.',
    ],
  },
  {
    slug: 'ngowazulu-mentorat-1x-week',
    commercialName: 'Confort',
    subtitle: 'Accompagnement hebdomadaire',
    priceLabel: '180 EUR / mois',
    priceAmount: 180,
    frequencyShort: '1 rencontre / semaine',
    sessionsPerMonth: 4,
    accent: 'from-[#D4AF37]/15 to-amber-900/10 border-[#D4AF37]/30',
    badgeClass: 'bg-[#D4AF37]/15 text-[#D4AF37] border-[#D4AF37]/35',
    detailIntro:
      'Un mois d’accompagnement avec une séance par semaine : filet de protection et ajustements réguliers.',
    bullets: [
      'Adapté aux périodes de fragilité ou aux blocages récurrents.',
      'Chaque cycle facturé couvre un mois ; vous restez libre de changer de palier ensuite.',
    ],
  },
  {
    slug: 'ngowazulu-mentorat-2x-week',
    commercialName: 'Intensif',
    subtitle: 'Veille renforcée',
    priceLabel: '300 EUR / mois',
    priceAmount: 300,
    frequencyShort: '2 rencontres / semaine',
    sessionsPerMonth: 8,
    accent: 'from-orange-500/20 to-red-900/10 border-orange-500/30',
    badgeClass: 'bg-orange-500/15 text-orange-200 border-orange-500/35',
    detailIntro:
      'Deux passages par semaine pour des cas exigeant une lecture fine (songes, aura, atmosphère).',
    bullets: [
      'Pensé pour les dynamiques lourdes ou les transitions critiques.',
      'Toujours un contrat mensuel : la densité change, pas la durée de facturation.',
    ],
  },
  {
    slug: 'ngowazulu-mentorat-urgent-3x-week',
    commercialName: 'Souverain',
    subtitle: 'Urgence & protection maximale',
    priceLabel: '500 EUR / mois',
    priceAmount: 500,
    frequencyShort: 'Jusqu’à 3 rencontres / semaine',
    sessionsPerMonth: 12,
    accent: 'from-red-600/25 to-red-950/20 border-red-500/40',
    badgeClass: 'bg-red-500/20 text-red-200 border-red-500/40',
    detailIntro:
      'Tutelle rapprochée pour les situations d’urgence spirituelle : jusqu’à trois séances par semaine selon validation du maître.',
    bullets: [
      'Activation prioritaire du protocole et du protectorat.',
      'Même logique : un mois par paiement, fréquence la plus élevée de la gamme.',
    ],
  },
];

export function getNgowazuluMentoratOffer(slug) {
  return ngowazuluMentoratOffers.find((o) => o.slug === slug) || null;
}

/** Quota de rencontres prévues par période (mois de contrat), selon le slug billing_plans. */
export function getSessionsQuotaForSlug(slug) {
  const o = getNgowazuluMentoratOffer(slug);
  return o?.sessionsPerMonth ?? null;
}

export const NGOWAZULU_SESSION_TYPE_LABELS = {
  mentorat_meeting: 'Rencontre mentorat',
  iri_immersive: 'Atelier IRI (immersif)',
  prayer_workshop: 'Atelier prière',
};
