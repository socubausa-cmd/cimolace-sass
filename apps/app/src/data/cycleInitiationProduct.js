/**
 * Source unique : offre « Cycles d'initiation Prorascience » (forfaits, FAQ, marketing).
 */

export const INITIATION_PRODUCT_NAME = "Les Cycles d'Initiation Prorascience";

export const TIER_ORDER = { autonome: 1, academique: 2, prive: 3, privilegie: 4 };

/** Clés canoniques dans l'ordre de montée en gamme */
export const CANONICAL_CYCLE_KEYS = ['autonome', 'academique', 'prive', 'privilegie'];

export const CYCLE_SELECTOR_LABELS = {
  autonome: 'Autonome',
  academique: 'Académique',
  prive: 'Privé',
  privilegie: 'Privilégié',
};

export const CYCLE_MARKETING_CONTENT = {
  autonome: {
    tier: 1,
    heroImage: '/image-pro/forfaits-cycle-autonome-hero.png',
    heroImageAlt:
      'Représentation du cycle autonome : apprentissage seul, contenus et outils numériques, ambiance nocturne dorée.',
    headline: 'Cycle autonome',
    tierBadge: 'Entrée · accessible · scalable',
    positioning: 'Apprendre seul, à son rythme.',
    tagline: 'Apprenez. Comprenez. Avancez à votre rythme.',
    heroGoldLine: "LES CYCLES D'INITIATION PRORASCIENCE · NIVEAU D'ACCÈS 1",
    pitch:
      "Votre point d'entrée : contenus structurés, outils numériques et replays pour progresser sans contrainte de présence live. Idéal pour explorer la doctrine et construire des bases à votre cadence.",
    includes: [
      'Cours pré-enregistrés',
      'Smartboard interactif',
      'Replays des lives',
      'Progression libre',
    ],
    excludes: [
      'Pas de coaching',
      'Pas de live actif en groupe',
      'Pas de LIRI live',
      'Pas de suivi personnalisé',
    ],
    experience: [],
    objective: [],
    idealFor: ['Curieux et débutants', 'Profils indépendants', 'Budget et emploi du temps contraints'],
    nextTierKey: 'academique',
    testimonials: [
      { name: 'Sonia B.', text: "J'ai pu poser les bases sans la pression des créneaux imposés." },
      { name: 'Patrick E.', text: "Les replays et le smartboard m'ont permis d'avancer entre deux voyages." },
    ],
    /** Visuels hero : portraits libres Unsplash, prénoms fictifs */
    heroProfiles: [
      {
        name: 'Sonia B.',
        role: 'Consultante · Europe',
        quote: "J'ai pu poser les bases sans la pression des créneaux imposés.",
        image: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=120&h=120&fit=crop&crop=faces',
      },
      {
        name: 'Patrick E.',
        role: 'Entrepreneur · Afrique centrale',
        quote: "Les replays et le smartboard m'ont permis d'avancer entre deux voyages.",
        image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&h=120&fit=crop&crop=faces',
      },
      {
        name: 'Aminata D.',
        role: 'Étudiante autonome',
        quote: 'Le format solo m\'a permis de tester la doctrine avant de m\'engager sur un live.',
        image: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=120&h=120&fit=crop&crop=faces',
      },
      {
        name: 'Marc T.',
        role: 'À distance · Canada',
        quote: 'Les cours enregistrés sont clairs ; je progresse le soir après le travail.',
        image: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=120&h=120&fit=crop&crop=faces',
      },
    ],
    faq: [
      {
        q: "Qu'est-ce que le cycle autonome ?",
        a: "C'est le niveau d'entrée des Cycles d'initiation Prorascience : vous progressez seul, à votre rythme, avec des cours pré-enregistrés, un smartboard interactif et les replays des lives. Il est pensé pour être accessible, scalable et pour poser des bases solides avant d'aller plus loin.",
      },
      {
        q: 'Puis-je participer aux lives en direct ?',
        a: "Non : à ce niveau vous n'avez pas accès aux sessions live en groupe ni à LIRI en direct. Vous bénéficiez des enregistrements (replays) pour revisiter les enseignements quand vous le souhaitez.",
      },
      {
        q: "À quoi sert le smartboard interactif ?",
        a: "Il complète les cours : visualisation, schémas, interactions pédagogiques pour mieux structurer votre compréhension, comme un tableau intelligent numérique lié au parcours.",
      },
      {
        q: 'Un coach ou un tuteur me suit-il personnellement ?',
        a: "Non. Le cycle autonome n'inclut ni coaching individuel ni suivi personnalisé. C'est volontaire pour garder un prix et une charge adaptés à l'autonomie. Pour un cadre vivant et encadré, le niveau suivant est le cycle académique.",
      },
      {
        q: "Puis-je passer au cycle académique plus tard ?",
        a: "Oui. La montée en gamme est prévue : vous pouvez souscrire au cycle académique quand vous souhaitez intégrer les lives, LIRI et le coaching collectif. Le secrétariat peut vous orienter selon votre situation.",
      },
      {
        q: 'Ce niveau est-il fait pour moi ?',
        a: "Il convient surtout aux curieux et débutants, aux profils très indépendants, ou à ceux qui ont un budget ou un emploi du temps contraints et veulent d'abord explorer sans engagement de présence live.",
      },
    ],
  },
  academique: {
    tier: 2,
    heroImage: '/image-pro/forfaits-cycle-academique-hero.png',
    heroImageAlt:
      'Représentation du cycle académique : cohorte en immersion LIRI, écran et présence du transmetteur.',
    headline: 'Cycle académique',
    tierBadge: 'Cœur du produit · transformation réelle',
    positioning: 'Formation guidée et transformation.',
    tagline: "Vous n'apprenez plus seul. Vous êtes accompagné.",
    heroGoldLine: "LES CYCLES D'INITIATION PRORASCIENCE · NIVEAU D'ACCÈS 2",
    pitch:
      "Tout le socle autonome, plus le vivant : lives en groupe, calendrier structuré et LIRI — immersion initiatique à distance. C'est ici que le cadre et l'humain accélèrent la montée en compétence.",
    includes: [
      'Tout le cycle autonome',
      'Lives en groupe',
      'Pédagogie LIRI (immersion à distance)',
      'Calendrier structuré',
      'Progression encadrée',
      'Coaching collectif',
    ],
    excludes: [],
    experience: [
      'Rythme imposé par le calendrier',
      'Montée en compétence concrète',
      'Interaction humaine et outils numériques',
    ],
    objective: [],
    idealFor: ['Personnes sérieuses', 'Transformation profonde recherchée', 'Discipline et besoin de cadre'],
    nextTierKey: 'prive',
    testimonials: [
      { name: 'Mireille N.', text: 'Les lives et le cadre m\'ont enfin donné une méthode que je tiens dans la durée.' },
      { name: 'Arnaud K.', text: 'LIRI change la donne : on n\'est pas seul devant des vidéos.' },
    ],
    heroProfiles: [
      {
        name: 'Mireille N.',
        role: 'Cohorte académique · France',
        quote: 'Les lives et le cadre m\'ont enfin donné une méthode que je tiens dans la durée.',
        image: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=120&h=120&fit=crop&crop=faces',
      },
      {
        name: 'Arnaud K.',
        role: 'Professionnel en reconversion',
        quote: 'LIRI change la donne : on n\'est pas seul devant des vidéos.',
        image: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&h=120&fit=crop&crop=faces',
      },
      {
        name: 'Koumba S.',
        role: 'Élève ISNA · diaspora',
        quote: 'Le coaching collectif et le calendrier m\'obligent à la constance — c\'est ce qu\'il me fallait.',
        image: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&h=120&fit=crop&crop=faces',
      },
      {
        name: 'Jean-Pierre L.',
        role: 'Europe · lives hebdo',
        quote: 'On sent l\'institution derrière le discours, pas juste des contenus isolés.',
        image: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=120&h=120&fit=crop&crop=faces',
      },
    ],
    faq: [
      {
        q: "En quoi le cycle académique diffère-t-il de l'autonome ?",
        a: "Vous gardez tout le contenu autonome (cours, smartboard, replays) et vous ajoutez le vivant : lives en groupe, calendrier institutionnel, LIRI en immersion à distance, progression encadrée et coaching collectif. C'est le cœur du produit pour une transformation réelle dans le cadre.",
      },
      {
        q: "Qu'est-ce que LIRI concrètement ?",
        a: "LIRI est notre dispositif d'immersion initiatique à distance : classe immersive, présence du transmetteur, outils type smartboard et ressources pédagogiques pensées pour l'initiation, pas seulement pour du visionnage passif.",
      },
      {
        q: 'Le calendrier est-il imposé ?',
        a: "Oui, dans une logique académique : des créneaux et un rythme collectifs permettent la cohésion de la cohorte et une montée en compétence progressive. C'est le compromis entre structure et transformation.",
      },
      {
        q: "Comment fonctionne le coaching collectif ?",
        a: "Il s'agit d'accompagnement en groupe (questions, mise en perspective, devoirs de terrain) complémentaire aux cours et aux lives, sans remplacer le coaching individuel du cycle privé.",
      },
      {
        q: "Y a-t-il une dimension « outils / IA » ?",
        a: "L'expérience mêle interaction humaine (transmetteur, pairs) et outils numériques modernes au service de la pédagogie. Le détail dépend des modules et du calendrier en vigueur.",
      },
      {
        q: 'Quand envisager le cycle privé ?',
        a: "Lorsque votre situation exige de l'intimité, des séances dédiées ou un suivi spirituel plus serré (blocages profonds, cas complexes). Le cycle privé reprend tout l'académique et ajoute cette couche premium.",
      },
    ],
  },
  prive: {
    tier: 3,
    heroImage: '/image-pro/forfaits-cycle-prive-hero.png',
    heroImageAlt:
      'Représentation du cycle privé : accompagnement personnel et échange confidentiel, lumière chaude et or.',
    headline: 'Cycle privé',
    tierBadge: 'Premium · transformation intime',
    positioning: 'Accompagnement personnel.',
    tagline: 'Une guidance directe. Personnelle. Sans filtre.',
    heroGoldLine: "LES CYCLES D'INITIATION PRORASCIENCE · NIVEAU D'ACCÈS 3",
    pitch:
      "Tout l'académique, avec une couche d'intimité : coaching individuel, séances privées et ateliers adaptés à votre chemin. Pour les profils qui exigent précision, profondeur et réponse à la mesure.",
    includes: [
      "Tout le cycle académique",
      'Coaching individuel',
      'Séances privées',
      'Ateliers initiatiques personnalisés',
      'Suivi spirituel',
    ],
    excludes: [],
    experience: ['Intimité', 'Précision', 'Transformation accélérée'],
    objective: [],
    idealFor: ['Cas complexes', 'Blocages profonds', "Besoin d'attention directe"],
    nextTierKey: 'privilegie',
    testimonials: [
      { name: 'Céline M.', text: 'Enfin un espace où je peux nommer ce qui bloque, sans filtre.' },
      { name: 'Joël A.', text: 'Le mélange LIRI + séances privées m\'a fait franchir un cap.' },
    ],
    heroProfiles: [
      {
        name: 'Céline M.',
        role: 'Accompagnement privé',
        quote: 'Enfin un espace où je peux nommer ce qui bloque, sans filtre.',
        image: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=120&h=120&fit=crop&crop=faces',
      },
      {
        name: 'Joël A.',
        role: 'Blocages profonds',
        quote: 'Le mélange LIRI + séances privées m\'a fait franchir un cap.',
        image: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=120&h=120&fit=crop&crop=faces',
      },
      {
        name: 'Fatou K.',
        role: 'Suivi spirituel · Belgique',
        quote: 'La guidance individuelle m\'a aidée à relier ma vie quotidienne à la doctrine.',
        image: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=120&h=120&fit=crop&crop=faces',
      },
      {
        name: 'David R.',
        role: 'Cas complexe · ateliers perso',
        quote: 'Les ateliers taillés sur mesure ont débloqué ce que le groupe ne pouvait pas toucher.',
        image: 'https://images.unsplash.com/photo-1519345182560-3f2917c472ef?w=120&h=120&fit=crop&crop=faces',
      },
    ],
    faq: [
      {
        q: "Qu'apporte le cycle privé par rapport à l'académique ?",
        a: "Vous conservez tout le cycle académique (lives, LIRI, coaching collectif, etc.) et vous ajoutez le sur-mesure : coaching individuel, séances privées, ateliers initiatiques personnalisés et suivi spirituel. L'objectif est une transformation plus intime et ciblée.",
      },
      {
        q: 'À quoi ressemblent les séances privées ?',
        a: "Des temps dédiés entre vous et l'accompagnement prévu par l'école, pour travailler votre chemin, vos blocages et vos objectifs initiatiques dans un cadre confidentiel. La fréquence et le format sont définis selon le contrat et la disponibilité.",
      },
      {
        q: 'Les échanges sont-ils confidentiels ?',
        a: "Oui, le niveau privé est pensé pour une guidance directe et personnelle, dans le respect du cadre déontologique et institutionnel de l'ISNA / Prorascience.",
      },
      {
        q: "En quoi consiste le suivi spirituel ?",
        a: "Un accompagnement plus rapproché sur la dimension spirituelle et initiatique de votre parcours, en cohérence avec la doctrine enseignée — sans se substituer à une thérapie médicale conventionnelle.",
      },
      {
        q: 'Les ateliers personnalisés servent à quoi ?',
        a: "Ils adaptent la pratique et les exercices à votre réalité (rythme, thèmes, niveau) pour accélérer la précision et l'intégration du savoir.",
      },
      {
        q: 'Quand envisager le cycle privilégié ?',
        a: "Lorsque votre projet devient la transmission et l'exercice structuré (diagnostic, accompagnement de cas, supervision, projet de temple ou d'activité). Le cycle privilégié vise la professionnalisation.",
      },
    ],
  },
  privilegie: {
    tier: 4,
    heroImage: '/image-pro/forfaits-cycle-privilegie-hero.png',
    heroImageAlt:
      'Cycle privilégié : un maître pratique un soin en médecine traditionnelle pendant qu\'un apprenti observe et apprend le coaching au chevet.',
    headline: 'Cycle privilégié',
    tierBadge: 'Élite · professionnalisation',
    positioning: 'Devenir praticien.',
    tagline: 'Ne plus recevoir. Transmettre.',
    heroGoldLine: "LES CYCLES D'INITIATION PRORASCIENCE · NIVEAU D'ACCÈS 4",
    pitch:
      "Tout le privé, orienté métier de la transmission : diagnostic, traitement, accompagnement de cas, supervision et projet de temple ou d'activité. Pour ceux qui ne veulent plus seulement recevoir, mais incarner et transmettre.",
    includes: [
      'Tout le cycle privé',
      'Formation métier (praticien)',
      'Apprendre à diagnostiquer, traiter et accompagner',
      'Cas pratiques et supervision',
      'Création de temple / structuration d\'activité',
    ],
    excludes: [],
    experience: [],
    objective: ['Devenir ganga', 'Thérapeute initiatique', 'Maître spirituel / transmetteur'],
    idealFor: ['Vocation forte', 'Futur professionnel du soin et de la doctrine', 'Transmission comme projet de vie'],
    nextTierKey: null,
    testimonials: [
      { name: 'Ariane P.', text: 'On passe d\'élève à responsable de sa propre ligne de transmission.' },
      { name: 'Blaise T.', text: 'Les cas réels et la supervision m\'ont donné la confiance d\'exercer.' },
    ],
    heroProfiles: [
      {
        name: 'Ariane P.',
        role: 'Voie transmission · supervision',
        quote: 'On passe d\'élève à responsable de sa propre ligne de transmission.',
        image: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=120&h=120&fit=crop&crop=faces',
      },
      {
        name: 'Blaise T.',
        role: 'Médecine traditionnelle · cas pratiques',
        quote: 'Les cas réels et la supervision m\'ont donné la confiance d\'exercer.',
        image: 'https://images.unsplash.com/photo-1463453091185-61582044d556?w=120&h=120&fit=crop&crop=faces',
      },
      {
        name: 'Ibrahim M.',
        role: 'Projet temple & communauté',
        quote: 'Apprendre au chevet avec le maître m\'a montré ce qu\'est vraiment la transmission.',
        image: 'https://images.unsplash.com/photo-1507591064344-4c6ce005b128?w=120&h=120&fit=crop&crop=faces',
      },
      {
        name: 'Lucie V.',
        role: 'Future praticienne',
        quote: 'Le diagnostic, le traitement, l\'accompagnement : tout est structuré comme un métier.',
        image: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=120&h=120&fit=crop&crop=faces',
      },
    ],
    faq: [
      {
        q: "Quel est l'objectif du cycle privilégié ?",
        a: "Passer d'une logique d'élève à une logique de transmetteur : formation métier pour diagnostiquer, traiter et accompagner dans le cadre de la médecine traditionnelle et spirituelle enseignée, avec cas pratiques et supervision.",
      },
      {
        q: 'Comment la médecine traditionnelle est-elle abordée ?',
        a: "Par la théorie institutionnelle, la démonstration, l'observation (y compris au chevet dans une pédagogie de maître et d'apprenant) et la mise en situation encadrée. L'exercice réel reste soumis au cadre légal du pays où vous vous trouvez et aux règles fixées par l'école.",
      },
      {
        q: "Qu'est-ce que la supervision ?",
        a: "Un temps structuré où vos cas et votre posture de praticien sont revus avec un regard expérimenté, pour sécuriser la qualité de l'accompagnement et la cohérence doctrinale.",
      },
      {
        q: "Création de temple / structuration d'activité : que signifie-t-il ?",
        a: "Vous êtes accompagné pour penser un lieu, une communauté ou une activité professionnelle alignés avec la transmission — gouvernance, contenu, éthique et faisabilité, selon les modules prévus.",
      },
      {
        q: 'Ce niveau mène-t-il à un titre reconnu type « ganga » ou thérapeute ?',
        a: "La visée pédagogique est la maîtrise et la transmission dans la lignée enseignée. Les appellations et reconnaissances dépendent du parcours validé et des règles de l'institution ; ce n'est pas un diplôme d'État au sens classique.",
      },
      {
        q: 'Y a-t-il des prérequis ?',
        a: "Ce niveau s'adresse à des profils avec une vocation forte, souvent après validation des niveaux inférieurs ou sur dossier / entretien. Contactez le secrétariat pour une faisabilité personnalisée.",
      },
    ],
  },
};

/** FAQ transversale (contrats, paiement, montée en gamme) */
export const INITIATION_GENERAL_FAQ = [
  {
    q: "Qu'est-ce qu'un « cycle » par rapport à un contrat ?",
    a: "Le cycle définit le niveau d'accès à l'initiation (autonome → académique → privé → privilégié). Le contrat (mensuel, trimestriel ou annuel) définit la façon dont vous réglez cet accès dans le temps.",
  },
  {
    q: 'Puis-je changer de niveau en cours de parcours ?',
    a: "Oui, la montée en gamme est possible : vous réglez la différence selon les règles en vigueur au moment du changement. Le secrétariat et la page forfaits vous indiquent le niveau supérieur adapté.",
  },
  {
    q: 'Les contrats mensuel, trimestriel et annuel diffèrent-ils sur le fond ?',
    a: "Non sur le contenu du niveau choisi : c'est la même offre. La différence est financière et d'engagement (souvent une économie sur les durées plus longues).",
  },
  {
    q: "Puis-je être remboursé si je me trompe de niveau ?",
    a: "Les règles légales de rétractation s'appliquent lorsque c'est pertinent (notamment pour les contenus numériques). Au-delà, les conditions précises figurent dans les CGV et le contrat de formation ; en cas de doute, écrivez au secrétariat avant de valider le paiement.",
  },
  {
    q: "Un entretien est-il obligatoire avant de souscrire ?",
    a: "Pour certains niveaux ou profils, un rendez-vous conseiller peut être recommandé ou requis afin d'aligner votre ambition (initiation, transformation, intimité, transmission) avec le bon cycle.",
  },
  {
    q: 'Où puis-je comparer les niveaux et les prix ?',
    a: "Sur la page forfaits : vous sélectionnez un cycle, consultez la fiche détaillée (inclus / non inclus, idéal pour) puis réservez le contrat qui vous convient.",
  },
];

export function cycleContent(cycle) {
  if (!cycle) return CYCLE_MARKETING_CONTENT.academique;
  const key = String(cycle.key || '').toLowerCase();
  if (CYCLE_MARKETING_CONTENT[key]) return CYCLE_MARKETING_CONTENT[key];
  if (key.includes('privile')) return CYCLE_MARKETING_CONTENT.privilegie;
  if (key.includes('prive')) return CYCLE_MARKETING_CONTENT.prive;
  if (key.includes('autonom')) return CYCLE_MARKETING_CONTENT.autonome;
  return CYCLE_MARKETING_CONTENT.academique;
}

export function marketingForCycleKey(keyLike) {
  const key = String(keyLike || '').toLowerCase();
  if (CYCLE_MARKETING_CONTENT[key]) return CYCLE_MARKETING_CONTENT[key];
  if (key.includes('privile')) return CYCLE_MARKETING_CONTENT.privilegie;
  if (key.includes('prive')) return CYCLE_MARKETING_CONTENT.prive;
  if (key.includes('autonom')) return CYCLE_MARKETING_CONTENT.autonome;
  return CYCLE_MARKETING_CONTENT.academique;
}

export function normalizeCycleQueryParam(raw) {
  const v = String(raw || '').toLowerCase().trim();
  if (v === 'all' || v === 'tous' || v === '') return 'all';
  if (CYCLE_MARKETING_CONTENT[v]) return v;
  if (v.includes('privile')) return 'privilegie';
  if (v.includes('prive')) return 'prive';
  if (v.includes('autonom')) return 'autonome';
  if (v.includes('academ')) return 'academique';
  return 'all';
}
