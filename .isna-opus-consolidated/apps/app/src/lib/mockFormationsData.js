export const formationsData = {
  packages: [
    {
      id: 'academique',
      title: 'Cycle Académique',
      badge: 'Académie+',
      subtitle: 'Formation collective structuree — Fondation Manikongo',
      color: 'blue',
      icon: '🎓',
      paymentLinks: {
        full: 'https://www.paypal.com/webapps/billing/plans/subscribe?plan_id=P-6AB32324V8105984CNDSUHFY',
        quarterly: 'https://www.paypal.com/webapps/billing/plans/subscribe?plan_id=P-35U402664Y213560FNDSUIHA',
        monthly: 'https://www.paypal.com/webapps/billing/plans/subscribe?plan_id=P-2MW16994L1352452FNDSUMDQ',
      },
      pricing: {
        registration: '100€',
        full: { amount: '800€', original: '1 000€', note: '–20 %' },
        quarterly: { amount: '300€', period: '/trimestre', note: '–10 %' },
        monthly: { amount: '111€', period: '/mois' },
      },
      conditions: "Frais de configuration spirituelle de 100€ obligatoires avant activation.",
      targetAudience:
        "Formation collective destinée aux débutants et chercheurs spirituels souhaitant s'initier aux sciences nocturnes dans un cadre académique structuré.",
      inclusions: [
        'Formation complète (PDF + vidéos + classes virtuelles)',
        'Classes collectives et échanges entre élèves',
        'Certification ISNA officielle',
        "Accès à la communauté d'apprentissage",
      ],
      exclusions: ['Aucun coaching individuel', 'Aucun montorat'],
      implications: "Cadre académique structuré, sans encadrement individuel.",
      advice: "Idéal pour commencer et construire une base solide.",
      avantages: [
        'Prix le plus accessible de tous les cycles',
        'Formation structurée avec un programme clair et progressif',
        'Certification ISNA reconnue à la fin du parcours',
        'Communauté d\'apprentissage pour échanger avec d\'autres élèves',
        'Idéal pour découvrir les sciences nocturnes sans engagement lourd',
      ],
      inconvenients: [
        'Aucun suivi individuel — vous avancez seul dans le groupe',
        'Pas de coaching personnalisé ni de retour sur votre progression',
        'Pas d\'accès aux rituels initiatiques ou à l\'accompagnement spirituel',
        'Rythme collectif qui peut ne pas convenir à tous les profils',
      ]
    },
    {
      id: 'prive',
      title: 'Cycle Privé',
      badge: 'Académie Pro',
      subtitle: 'Formation complete + coaching individuel personnalise',
      color: 'yellow',
      icon: '🔑',
      paymentLinks: {
        full: 'https://www.paypal.com/webapps/billing/plans/subscribe?plan_id=P-7FM46383VW175615TNDST3SI',
        quarterly: 'https://www.paypal.com/webapps/billing/plans/subscribe?plan_id=P-58R7081856980690PNDSUCSQ',
        monthly: 'https://www.paypal.com/webapps/billing/plans/subscribe?plan_id=P-5KJ996894B4423330NDSUD5Y',
      },
      pricing: {
        registration: '100€',
        full: { amount: '1 600€', original: '2 000€', note: '–20 %' },
        quarterly: { amount: '600€', period: '/trimestre', note: '–10 %' },
        monthly: { amount: '222€', period: '/mois' },
      },
      conditions: "Frais de configuration spirituelle de 100€ obligatoires avant activation.",
      targetAudience:
        "Formation avec coaching individuel destinée aux élèves cherchant un suivi personnel et un encadrement adapté à leur vibration.",
      inclusions: [
        'Formation complète',
        'Coaching spirituel personnalisé',
        'Accès privilégié à la communauté ISNA',
        'Suivi personnel par un formateur qualifié',
      ],
      exclusions: ['Pas de montorat sacerdotal direct'],
      implications: "Suivi individuel, sans montorat sacerdotal complet.",
      advice: "Pour avancer avec un cadre personnel et structuré.",
      avantages: [
        'Coaching spirituel personnalisé adapté à votre vibration',
        'Suivi individuel régulier par un formateur qualifié',
        'Formation complète avec accès à tous les contenus académiques',
        'Accès privilégié à la communauté ISNA et aux échanges privés',
        'Progression encadrée à votre rythme personnel',
      ],
      inconvenients: [
        'Pas de montorat sacerdotal direct (pas d\'intervention spirituelle pour vous)',
        'Tarif plus élevé que le cycle académique',
        'Le coaching reste limité aux sessions programmées',
        'Pas d\'accès au Temple NGOWAZULU ni aux rituels sacrés',
      ]
    },
    {
      id: 'privilegie',
      title: 'Cycle Privilégié',
      badge: 'Mentorat',
      subtitle: 'Formation complete + coaching + montorat sacerdotal',
      color: 'red',
      icon: '🛡️',
      paymentLinks: {
        full: 'https://www.paypal.com/webapps/billing/plans/subscribe?plan_id=P-856428692C539973YNDSTLDY',
        quarterly: 'https://www.paypal.com/webapps/billing/plans/subscribe?plan_id=P-7BA47657JS118483VNDSTFNY',
        monthly: 'https://www.paypal.com/webapps/billing/plans/subscribe?plan_id=P-23B992359F884121FNDTAGRY',
      },
      pricing: {
        registration: '100€',
        full: { amount: '2 000€', original: '2 500€' },
        quarterly: { amount: '750€', period: '/trimestre', note: '–10 %' },
        monthly: { amount: '278€', period: '/mois' },
      },
      conditions:
        "Sélection sur dossier vibratoire uniquement. Frais de configuration spirituelle de 100€ obligatoires avant activation.",
      targetAudience:
        "Destiné aux disciples appelés à exercer un sacerdoce et bénéficier de l'accompagnement spirituel total du 5ᵉ Manikongo.",
      inclusions: [
        'Montorat sacerdotal complet par le 5ᵉ Manikongo',
        'Coaching spirituel en situation réelle',
        'Accès exclusif au Temple NGOWAZULU',
        'Participation aux rituels initiatiques sacrés',
        "Transmission directe de l'héritage spirituel",
        "Intervention en cas d'attaque mystique ou blocage karmique",
      ],
      exclusions: ['Sur dossier uniquement'],
      implications: "Voie sacerdotale exigeante et hautement encadrée.",
      advice: "Pour ceux qui sont appelés à un engagement total.",
      avantages: [
        'Montorat sacerdotal complet par le 5ᵉ Manikongo en personne',
        'Accès exclusif au Temple NGOWAZULU et aux rituels initiatiques',
        'Intervention directe en cas d\'attaque mystique ou blocage karmique',
        'Transmission directe de l\'héritage spirituel ancestral',
        'Accompagnement total : formation + coaching + protection spirituelle',
        'Le cycle le plus complet et le plus puissant de l\'ISNA',
      ],
      inconvenients: [
        'Sélection sur dossier vibratoire — accès non garanti',
        'Tarif le plus élevé de tous les cycles',
        'Engagement total exigé — pas adapté aux curieux occasionnels',
        'Voie sacerdotale exigeante qui demande discipline et dévouement',
      ]
    },
    {
      id: 'autonome',
      title: 'Cycle Autonome',
      badge: 'Académique',
      subtitle: 'Formation libre — Etude independante sans encadrement',
      color: 'purple',
      icon: '🧘',
      paymentLinks: {
        full: 'https://www.paypal.com/webapps/billing/plans/subscribe?plan_id=P-9GS10471Y7294070WNDTAWGA',
        quarterly: 'https://www.paypal.com/webapps/billing/plans/subscribe?plan_id=P-9KG99602V9040501VNDTAWZI',
        monthly: 'https://www.paypal.com/webapps/billing/plans/subscribe?plan_id=P-6MB80065WT3023740NDTAXMI',
      },
      pricing: {
        registration: '100€',
        full: { amount: '400€', original: '500€' },
        quarterly: { amount: '150€', period: '/trimestre', note: '–10 %' },
        monthly: { amount: '55€', period: '/mois' },
      },
      conditions: "Frais de configuration spirituelle de 100€ obligatoires avant activation.",
      targetAudience:
        "Formation libre destinée aux chercheurs indépendants souhaitant étudier à leur rythme sans encadrement.",
      inclusions: [
        'Accès immédiat à tous les cours PDF et audios',
        'Étude libre et flexible',
        "Possibilité d'évolution vers les cycles supérieurs",
        "Autonomie complète dans l'apprentissage",
      ],
      exclusions: ['Aucun suivi', 'Aucun coaching', "Aucun rituel d'accompagnement"],
      implications: "Autonomie totale : progression libre.",
      advice: "Pour étudier librement à votre rythme.",
      avantages: [
        'Le tarif le plus bas de tous les cycles',
        'Accès immédiat à tous les cours PDF et audios',
        'Liberté totale : étudiez quand vous voulez, où vous voulez',
        'Aucune contrainte de calendrier ni de présence obligatoire',
        'Possibilité d\'évoluer vers un cycle supérieur à tout moment',
      ],
      inconvenients: [
        'Aucun suivi, aucun coaching, aucun encadrement',
        'Pas de certification ISNA à la fin du parcours',
        'Pas d\'accès aux classes virtuelles ni aux ateliers pratiques',
        'Risque de stagnation sans accompagnement ni évaluation',
        'Pas de communauté ni d\'échanges avec les autres élèves',
      ]
    }
  ],
  combo: {
    id: 'combo_pro_montorat',
    title: 'Académique Pro + Montorat',
    pricing: {
      monthly: '480€',
      monthlySaving: '76€/mois',
      trimester: '1 350€',
      trimesterSaving: '150€',
      full: '3 600€',
      fullSaving: '400€',
      registration: '100€'
    },
    targetAudience: "Ceux qui veulent l'excellence technique ET la puissance spirituelle.",
    description: "Le summum de l'expérience Prorascience. Vous développez votre expertise professionnelle tout en étant soutenu, protégé et guidé spirituellement.",
    principle: "Le Pro vous donne les outils pour agir sur les autres. Le Montorat vous donne la force intérieure pour supporter cette charge.",
    inclusions: [
      "Double Cursus Complet (Pro + Montorat)",
      "Double Certification possible",
      "Priorité absolue sur tous les événements",
      "Mentorat hybride (Technique & Spirituel)",
      "Accès intégral à toutes les ressources de l'école"
    ],
    conditions: "Validation stricte par les fondateurs. Places limitées."
  },
  comparison: {
    categories: [
      {
        title: "🟦 CONTENUS ACADÉMIQUES",
        items: [
          { label: "Accès aux cours enregistrés", values: [true, true, true, true] },
          { label: "Classes virtuelles (Live)", values: [false, true, true, true] },
          { label: "Accès aux Replays", values: [true, true, true, true] },
          { label: "Supports PDF & Documents", values: [true, true, true, true] },
          { label: "Quiz & Évaluations auto.", values: [true, true, true, true] },
          { label: "Suivi académique automatisé", values: [true, true, true, true] }
        ]
      },
      {
        title: "🟨 CONTENUS ATELIERS",
        items: [
          { label: "Ateliers pratiques en direct", values: [false, true, true, false] },
          { label: "Vidéos tutoriels techniques", values: [false, true, true, false] },
          { label: "Démonstrations rituelles", values: [false, true, true, true] },
          { label: "Techniques opératives", values: [false, true, true, true] },
          { label: "Protocoles d'application", values: [false, true, true, true] }
        ]
      },
      {
        title: "🟥 CONTENUS COACHING",
        items: [
          { label: "Coaching de groupe mensuel", values: [false, false, true, false] },
          { label: "Séances de supervision", values: [false, false, true, false] },
          { label: "Transmission des clés métiers", values: [false, false, true, false] },
          { label: "Entraînement supervisé", values: [false, false, true, false] },
          { label: "Formation business/installation", values: [false, false, true, false] },
          { label: "Apprendre à intervenir sur autrui", values: [false, false, true, false] }
        ]
      },
      {
        title: "🟪 CONTENUS MONTORAT",
        items: [
          { label: "Diagnostic spirituel personnel", values: [false, false, false, true] },
          { label: "Assistance spirituelle active", values: [false, false, false, true] },
          { label: "Interventions rituelles pour vous", values: [false, false, false, true] },
          { label: "Protection & veille énergétique", values: [false, false, false, true] },
          { label: "Résolution de blocages profonds", values: [false, false, false, true] },
          { label: "Accès au Mentor attitré", values: [false, false, false, true] },
          { label: "Intervention à votre place (si besoin)", values: [false, false, false, true] }
        ]
      }
    ]
  }
};