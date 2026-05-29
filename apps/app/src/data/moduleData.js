export const moduleF2Data = {
  id: "F2",
  code: "F2",
  title: "Cosmogonie Africaine",
  type: "Fondamental",
  trimester: "1 - Fondements Cosmologiques",
  duration_weeks: 4,
  duration_hours: 28,
  level: "Débutant",
  status: "Active",
  description: "Ce module explore les fondements de la cosmogonie africaine, détaillant la structure de l'univers, de la 'Potentia Prima' à la manifestation matérielle. Il offre une compréhension approfondie des forces vibratoires (Vibratinium) et des entités cosmiques (Rimseas) qui régissent notre réalité.",
  professor: {
    name: "Pr. Kimbembe",
    title: "Grand Maître Cosmologue",
    avatar: "https://images.unsplash.com/photo-1531384441138-2736e62e0919?w=200&h=200&fit=crop"
  },
  schedule: "Mercredi 18h - 20h",
  location: "Amphithéâtre A",
  dates: "15 Jan - 11 Fév 2025",
  rating: 4.9,
  reviews_count: 342,
  recommendation_rate: 98,
  objectives: [
    {
      id: 1,
      title: "Potentia Prima",
      description: "Comprendre l'état primordial de l'univers avant la manifestation, la source de toute énergie et conscience.",
      bloom_level: "Compréhension"
    },
    {
      id: 2,
      title: "Vibratinium",
      description: "Maîtriser les concepts de fréquences vibratoires fondamentales qui structurent la matière et l'esprit.",
      bloom_level: "Analyse"
    },
    {
      id: 3,
      title: "Les Rimseas",
      description: "Identifier et classifier les 12 Rimseas majeurs, leurs fonctions et leurs interactions dans le cosmos.",
      bloom_level: "Connaissance"
    },
    {
      id: 4,
      title: "Fusion Cosmique",
      description: "Analyser le processus de fusion entre l'esprit et la matière à travers les 7 densités d'existence.",
      bloom_level: "Synthèse"
    },
    {
      id: 5,
      title: "Manifestation Progressive",
      description: "Appliquer les lois de la manifestation pour comprendre l'évolution de la conscience.",
      bloom_level: "Application"
    }
  ],
  weeks: [
    {
      number: 1,
      title: "Potentia Prima",
      duration: "7 heures",
      description: "Exploration de l'origine absolue et du vide quantique primordial.",
      topics: [
        "Le Vide Absolu et la Conscience Latente",
        "L'Ère du Silence: Avant le Premier Verbe",
        "La Singularité Primordiale",
        "Introduction à la Métaphysique Africaine"
      ],
      resources: [
        { title: "Le Kybalion Décrypté (Chap 1)", type: "PDF", duration: "45 min" },
        { title: "Origines de l'Univers", type: "Video", duration: "1h 15m" },
        { title: "Le Concept de Dieu en Afrique", type: "Article", duration: "20 min" },
        { title: "Méditation sur le Vide", type: "Audio", duration: "30 min" }
      ],
      exercises: [
        "Dissertation: Le paradoxe du néant (1000 mots)",
        "Quiz: Terminologie primordiale"
      ]
    },
    {
      number: 2,
      title: "Vibratinium",
      duration: "7 heures",
      description: "Étude des fréquences constitutives de la réalité et de la matière.",
      topics: [
        "Les 7 Fréquences Fondamentales",
        "Cymatique et Géométrie Sacrée",
        "La Parole Créatrice (Nommo)",
        "Résonance et Dissonance Cosmique"
      ],
      resources: [
        { title: "Tableau des Fréquences", type: "PDF", duration: "15 min" },
        { title: "La Danse des Particules", type: "Video", duration: "55 min" },
        { title: "Le Son qui Crée", type: "Audio", duration: "45 min" }
      ],
      exercises: [
        "Laboratoire: Visualisation cymatique",
        "Analyse de spectre vibratoire"
      ]
    },
    {
      number: 3,
      title: "Les Rimseas",
      duration: "7 heures",
      description: "Classification des forces intelligentes et architectes de l'univers.",
      topics: [
        "Hiérarchie des 12 Rimseas Majeurs",
        "Rimseas Constructeurs vs Destructeurs",
        "Invocation et Alliance (Théorie)",
        "Le Rimsea Personnel"
      ],
      resources: [
        { title: "Encyclopédie des Rimseas", type: "PDF", duration: "2h" },
        { title: "Interview avec un Gardien", type: "Video", duration: "40 min" }
      ],
      exercises: [
        "Cartographie des influences Rimseiques",
        "Quiz: Identification des sigils"
      ]
    },
    {
      number: 4,
      title: "Fusion Cosmique",
      duration: "7 heures",
      description: "L'intégration de la conscience dans la matière et les cycles évolutifs.",
      topics: [
        "Les 7 Stades de Manifestation",
        "Densités de Conscience (1D à 7D)",
        "Cycles Cosmiques (Yugas et Ères)",
        "L'Homme comme Microcosme"
      ],
      resources: [
        { title: "L'Échelle de Jacob Africaine", type: "Article", duration: "30 min" },
        { title: "Schéma des Densités", type: "PDF", duration: "10 min" },
        { title: "Finalité de l'Évolution", type: "Video", duration: "1h" }
      ],
      exercises: [
        "Projet Final: Modèle cosmologique personnel",
        "Examen Blanc"
      ]
    }
  ],
  evaluations: {
    continuous: [
      { name: "Participation Active", weight: "20%", criteria: "Présence et interaction" },
      { name: "Exercices Hebdomadaires", weight: "30%", criteria: "Qualité et ponctualité" },
      { name: "Quiz de Connaissances", weight: "20%", criteria: "Moyenne des 4 quiz" }
    ],
    final: [
      { name: "Essai Final", weight: "20%", criteria: "2000-2500 mots, analyse profonde" },
      { name: "Présentation Orale", weight: "10%", criteria: "15 min, clarté et maîtrise" }
    ]
  },
  prerequisites: [
    "Validation du Module F1 (Fondements)",
    "Notions de base en cosmologie (recommandé)"
  ],
  related_modules: ["F3", "F4", "F5"],
  reviews: [
    { id: 1, user: "Jean M.", date: "2024-12-10", rating: 5, comment: "Une révélation absolue. Le concept de Potentia Prima a changé ma vie." },
    { id: 2, user: "Sarah L.", date: "2024-11-22", rating: 5, comment: "Pr. Kimbembe est passionnant. Contenu dense mais accessible." },
    { id: 3, user: "Marc D.", date: "2024-10-05", rating: 4, comment: "Très complet, demande beaucoup de travail personnel." },
    { id: 4, user: "Lucie P.", date: "2024-09-18", rating: 5, comment: "Les exercices sur le Vibratinium sont incroyables." },
    { id: 5, user: "Thomas R.", date: "2024-08-30", rating: 5, comment: "Indispensable pour comprendre la suite du cursus." }
  ]
};

export const moduleY2Data = {
  id: "P4",
  code: "P4",
  title: "Grands Rites Africains",
  type: "Pratique",
  trimester: "4 - Pratique Avancée",
  duration_weeks: 6,
  duration_hours: 42,
  price: 0,
  access_level: "Académique",
  mentor_required: true,
  status: "Active",
  description: "Ce module pratique plonge les étudiants dans l'exécution cérémonielle des grands rites. Il nécessite une préparation intérieure rigoureuse et un accompagnement par un mentor agréé.",
  professor: {
    name: "Mme. Diop",
    title: "Grande Prêtresse",
    avatar: "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=200&h=200&fit=crop"
  },
  objectives: [
    { id: 1, title: "Maîtrise Rituelle", description: "Exécuter les gestes sacrés avec précision.", bloom_level: "Application" },
    { id: 2, title: "Canalisation", description: "Maintenir un état de transe contrôlée.", bloom_level: "Synthèse" }
  ],
  weeks: [
    { number: 1, title: "Purification", duration: "10h", topics: ["Jeûne", "Ablutions"], resources: [] },
    { number: 2, title: "Invocation", duration: "10h", topics: ["Verbe", "Son"], resources: [] }
  ],
  evaluations: {
    continuous: [{ name: "Pratique Supervisée", weight: "50%" }],
    final: [{ name: "Grand Rite de Passage", weight: "50%" }]
  }
};