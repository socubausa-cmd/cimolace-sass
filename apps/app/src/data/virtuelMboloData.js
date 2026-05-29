/**
 * Data export pour Virtuel-Mbolo™
 * Document commercial complet des fonctionnalités
 * 
 * CIMOLACE - Solution e-commerce clé en main
 * "On ne vous crée pas une boutique. On vous installe un business."
 */

export const VIRTUEL_MBOLO_PLANS = {
  starter: {
    id: 'starter',
    name: 'Virtuel-Mbolo Starter',
    shortName: 'Starter',
    price: { monthly: 150, annual: 1500 },
    label: 'Lancer',
    color: '#06b6d4',
    description: 'Vous pouvez commencer à vendre sans gérer la technique.',
    tagline: 'Lancez votre business en ligne',
    promise: 'Une boutique professionnelle clé en main pour démarrer immédiatement.',
    features: {
      core: [
        { title: 'Boutique en ligne professionnelle', desc: 'Design premium, responsive, optimisé conversion', icon: 'Store' },
        { title: 'Catalogue produits illimité', desc: 'Ajoutez autant de produits que nécessaire', icon: 'Package' },
        { title: 'Pages produits optimisées', desc: 'SEO-friendly avec images, variantes, descriptions', icon: 'FileText' },
        { title: 'Panier et checkout', desc: 'Parcours d\'achat fluide et sécurisé', icon: 'ShoppingCart' },
        { title: 'Paiement en ligne intégré', desc: 'Stripe + Chariow (Mobile Money MTN/Orange)', icon: 'CreditCard' },
        { title: 'Gestion simple des commandes', desc: 'Suivi des commandes, statuts, notifications', icon: 'ClipboardList' },
      ],
      infrastructure: [
        { title: 'Hébergement sécurisé', desc: 'Serveurs cloud premium, uptime 99.9%', icon: 'Server' },
        { title: 'Maintenance technique', desc: 'Mises à jour automatiques, monitoring', icon: 'Settings' },
        { title: 'Support technique', desc: 'Assistance par email, réponse sous 24h', icon: 'Headphones' },
        { title: 'Mises à jour de sécurité', desc: 'Patches de sécurité automatiques', icon: 'Shield' },
        { title: 'Nom de domaine', desc: 'Votre domaine ou sous-domaine CIMOLACE', icon: 'Globe' },
        { title: 'Back-office sécurisé', desc: 'Interface admin protégée et intuitive', icon: 'Lock' },
      ],
    },
    targetAudience: [
      'Entrepreneurs débutants',
      'Vendeurs qui veulent se lancer rapidement',
      'Artisans et créateurs',
      'Petits commerçants',
    ],
    cta: 'Choisir Starter',
    popular: false,
  },

  pro: {
    id: 'pro',
    name: 'Virtuel-Mbolo Pro',
    shortName: 'Pro',
    price: { monthly: 200, annual: 2000 },
    label: 'Structurer',
    color: '#8b5cf6',
    description: 'À 200€, vous ne vendez plus dans le désordre. Vous pilotez votre business.',
    tagline: 'Structurez votre business comme un pro',
    promise: 'Un CRM, une facturation, des paiements échelonnés et des relances automatiques.',
    includesStarter: true,
    features: {
      crm: [
        { title: 'CRM client intégré', desc: 'Centralisez clients, commandes, paiements', icon: 'Users', details: ['Fiche client complète', 'Historique commandes', 'Historique paiements', 'Notes internes', 'Segmentation'] },
        { title: 'Chat client en direct', desc: 'Discutez avec vos visiteurs en temps réel', icon: 'MessageCircle', details: ['Messages temps réel', 'Historique conversations', 'Réponses rapides', 'Liens commande'] },
      ],
      ai: [
        { title: 'Assistant IA Business LIRI', desc: 'L\'IA LIRI vous aide à vendre', icon: 'Bot', details: ['Rédaction messages clients', 'Descriptions produits IA', 'Arguments de vente', 'Relances assistées'] },
        { title: 'Système d\'avis client', desc: 'Collectez les témoignages clients', icon: 'Star', details: ['Liens avis automatiques', 'Collecte témoignages', 'Preuve sociale', 'Affichage boutique'] },
      ],
      finance: [
        { title: 'Facturation automatique', desc: 'Factures et reçus générés auto', icon: 'Receipt', details: ['Factures auto', 'Reçus de paiement', 'Historique factures', 'Export comptable'] },
        { title: 'Comptabilité simple', desc: 'Suivez votre chiffre d\'affaires', icon: 'BarChart3', details: ['CA encaissé', 'Paiements à venir', 'Factures impayées', 'Historique financier'] },
        { title: 'Plan de paiement échelonné', desc: 'Vendez en plusieurs fois', icon: 'Percent', details: ['Acompte initial', 'Calendrier échéances', 'Montant payé/restant', 'Relances auto', 'Suivi dettes'] },
        { title: 'Devis en temps réel', desc: 'Calculez et envoyez des devis pros', icon: 'Calculator', details: ['Calcul instantané', 'Produits + services', 'Livraison + remises', 'Conversion paiement'] },
        { title: 'Relances automatiques', desc: 'Récupérez les ventes perdues', icon: 'RefreshCw', details: ['Paniers abandonnés', 'Factures impayées', 'Échéances retard', 'Demande avis'] },
      ],
    },
    targetAudience: [
      'Vendeurs établis',
      'Business qui veulent structurer',
      'Entrepreneurs avec volume de ventes',
      'Consultants et prestataires',
    ],
    cta: 'Choisir Pro',
    popular: true,
  },

  elite: {
    id: 'elite',
    name: 'Virtuel-Mbolo Elite',
    shortName: 'Elite',
    price: { monthly: 300, annual: 3000 },
    label: 'Scaler',
    color: '#f59e0b',
    description: 'À 300€, votre boutique devient un système de croissance complète.',
    tagline: 'Attirez, engagez, vendez et scalez',
    promise: 'Les moteurs de croissance LIRI : marketing IA, live selling, événements et communauté.',
    includesPro: true,
    features: {
      marketing: [
        { title: 'Moteur Marketing LIRI', desc: 'Créez des campagnes publicitaires auto', icon: 'Megaphone', details: ['Publicités auto-générées', 'Textes de vente IA', 'Hooks optimisés', 'Visuels multi-formats', 'A/B testing'] },
        { title: 'Créateur de Publicité IA', desc: 'Transformez produits en annonces', icon: 'Sparkles', details: ['Analyse produit IA', 'Ciblage automatique', 'Variations messages', 'CTAs optimisés', 'Multi-plateformes'] },
        { title: 'Funnel de Vente Complet', desc: 'Parcours de conversion optimisés', icon: 'TrendingUp', details: ['Pages d\'offre', 'Upsells intelligents', 'Cross-sells', 'Suivi conversion', 'Optimisation IA'] },
      ],
      live: [
        { title: 'Live Selling LIRI', desc: 'Vendez en direct comme TikTok Shop', icon: 'Video', details: ['Streaming HD', 'Interaction temps réel', 'Lien commande live', 'Démonstration produit', 'Replay auto'] },
        { title: 'Event & Calendar Engine', desc: 'Organisez événements commerciaux', icon: 'Calendar', details: ['Événements commerciaux', 'Ateliers produits', 'Réservations', 'Rappels auto', 'Suivi participants'] },
      ],
      community: [
        { title: 'Communauté Client', desc: 'Espace privé pour vos clients', icon: 'Users', details: ['Espace membres privé', 'Discussions', 'Contenus exclusifs', 'Feedback client', 'Fidélisation'] },
        { title: 'Analytics Avancé', desc: 'Comprenez votre business', icon: 'BarChart3', details: ['Sources de trafic', 'Conversion tracking', 'Panier moyen', 'Recommandations IA', 'Rapports auto'] },
        { title: 'IA Stratégique Business', desc: 'Assistant conseiller IA', icon: 'Bot', details: ['Suggestions campagnes', 'Optimisation offres', 'Conseils relances', 'Idées promotions', 'Analyse performances'] },
      ],
    },
    targetAudience: [
      'Marques en croissance',
      'Influenceurs qui vendent',
      'Agences e-commerce',
      'Entrepreneurs ambitieux',
    ],
    cta: 'Activer Elite',
    popular: false,
  },
};

export const SETUP_CONFIG = {
  name: 'Frais de configuration & propriété',
  price: 500,
  currency: 'EUR',
  description: 'Installation complète de votre système commercial personnalisé',
  includes: [
    'Installation de l\'instance client',
    'Configuration de la boutique',
    'Adaptation du modèle au métier',
    'Configuration des produits et catégories',
    'Configuration des paiements (Stripe + Chariow)',
    'Configuration du back-office',
    'Mise en ligne sur votre espace',
    'Activation de l\'abonnement choisi',
    'Maintenance initiale et tests',
    'Récupération/adaptation si base existante (type Zahir)',
  ],
  deliveryTime: '5-7 jours ouvrés',
  paymentTerms: 'Paiement unique avant démarrage',
};

export const COMPARISON_TABLE = [
  { feature: 'Boutique en ligne', starter: true, pro: true, elite: true },
  { feature: 'Catalogue produits', starter: true, pro: true, elite: true },
  { feature: 'Paiement en ligne', starter: true, pro: true, elite: true },
  { feature: 'Hébergement sécurisé', starter: true, pro: true, elite: true },
  { feature: 'Maintenance', starter: true, pro: true, elite: true },
  { feature: 'CRM client', starter: false, pro: true, elite: true },
  { feature: 'Chat client', starter: false, pro: true, elite: true },
  { feature: 'Assistant IA', starter: false, pro: true, elite: true },
  { feature: 'Avis clients', starter: false, pro: true, elite: true },
  { feature: 'Facturation auto', starter: false, pro: true, elite: true },
  { feature: 'Comptabilité', starter: false, pro: true, elite: true },
  { feature: 'Paiement échelonné', starter: false, pro: true, elite: true },
  { feature: 'Devis temps réel', starter: false, pro: true, elite: true },
  { feature: 'Relances auto', starter: false, pro: true, elite: true },
  { feature: 'Marketing IA', starter: false, pro: false, elite: true },
  { feature: 'Publicité IA', starter: false, pro: false, elite: true },
  { feature: 'Funnel de vente', starter: false, pro: false, elite: true },
  { feature: 'Live Selling', starter: false, pro: false, elite: true },
  { feature: 'Événements', starter: false, pro: false, elite: true },
  { feature: 'Communauté', starter: false, pro: false, elite: true },
  { feature: 'Analytics avancé', starter: false, pro: false, elite: true },
];

export const FAQ_DATA = [
  {
    question: 'Est-ce que les 500€ de configuration sont obligatoires ?',
    answer: 'Oui, les 500€ sont les frais de configuration et propriété uniques. Ils couvrent l\'installation complète de votre système, l\'adaptation à votre activité, la configuration des paiements, la mise en ligne et les tests avant livraison.',
  },
  {
    question: 'Est-ce que je peux changer de forfait plus tard ?',
    answer: 'Oui, vous pouvez monter de gamme à tout moment. Passer de Starter à Pro ou à Elite débloque instantanément les nouvelles fonctionnalités. La facturation s\'ajuste automatiquement.',
  },
  {
    question: 'Quelle est la différence entre Virtuel-Mbolo et Zahir ?',
    answer: 'Zahir est un client existant qui a servi de modèle pour créer Virtuel-Mbolo™. Virtuel-Mbolo est la solution standardisée que CIMOLACE commercialise pour tous les entrepreneurs.',
  },
  {
    question: 'La maintenance est-elle incluse ?',
    answer: 'Oui, la maintenance technique, les mises à jour de sécurité et le support sont inclus selon votre forfait. L\'hébergement sécurisé est inclus dans tous les forfaits.',
  },
  {
    question: 'Puis-je vendre en live avec Virtuel-Mbolo ?',
    answer: 'Oui, le Live Selling est inclus dans le forfait Elite. Vous pouvez organiser des sessions de vente en direct avec présentation produit, interaction client et lien de commande pendant le live.',
  },
  {
    question: 'Les paiements échelonnés sont-ils inclus ?',
    answer: 'Oui, le plan de paiement échelonné avec suivi des échéances et relances automatiques est inclus à partir du forfait Pro.',
  },
  {
    question: 'Quels moyens de paiement sont acceptés ?',
    answer: 'Virtuel-Mbolo intègre Stripe (cartes bancaires, SEPA, wallets) et Chariow (Mobile Money MTN/Orange, USSD) pour couvrir tous les clients, en Afrique et internationalement.',
  },
  {
    question: 'Combien de temps avant d\'être en ligne ?',
    answer: 'Après paiement des frais de configuration, votre boutique est livrée sous 5-7 jours ouvrés. Ce délai inclut l\'installation, la configuration, les tests et la mise en ligne.',
  },
  {
    question: 'Puis-je exporter mes données ?',
    answer: 'Oui, vous restez propriétaire de vos données (produits, clients, commandes). Vous pouvez les exporter à tout moment en format CSV ou Excel.',
  },
  {
    question: 'Y a-t-il un engagement ?',
    answer: 'Les forfaits mensuels sont sans engagement (résilisable avec 30 jours de préavis). Les forfaits annuels sont engagés pour 12 mois avec 2 mois offerts.',
  },
];

export const TARGET_AUDIENCES = [
  {
    icon: 'Store',
    title: 'Entrepreneurs',
    description: 'Vous lancez votre activité et avez besoin d\'une infrastructure professionnelle clé en main.',
  },
  {
    icon: 'Award',
    title: 'Marques',
    description: 'Vous voulez professionnaliser votre présence en ligne avec une boutique complète et scalable.',
  },
  {
    icon: 'RefreshCw',
    title: 'Boutiques existantes',
    description: 'Vous avez déjà une activité mais manquez d\'outils pour gérer efficacement les commandes et clients.',
  },
  {
    icon: 'Package',
    title: 'Vendeurs produits physiques',
    description: 'Vous vendez des produits et avez besoin de logistique, stock et suivi de commandes.',
  },
  {
    icon: 'Headphones',
    title: 'Vendeurs de services',
    description: 'Vous vendez des services, consultations ou formations avec réservation et paiement échelonné.',
  },
  {
    icon: 'Users',
    title: 'Agences',
    description: 'Vous voulez offrir à vos clients un e-commerce clé en main, hébergé et maintenu.',
  },
];

export const MARKET_COMPARISON = {
  separateTools: [
    { name: 'Shopify ou équivalent', price: '~30€/mois' },
    { name: 'Applications paiement', price: '~20€/mois' },
    { name: 'CRM séparé', price: '~50€/mois' },
    { name: 'Outil facturation', price: '~15€/mois' },
    { name: 'Outil calendrier', price: '~10€/mois' },
    { name: 'Outil marketing', price: '~50€/mois' },
    { name: 'Live streaming', price: '~20€/mois' },
    { name: 'Outil communauté', price: '~30€/mois' },
    { name: 'Tunnel de vente', price: '~40€/mois' },
    { name: 'Développeur/maintenance', price: 'Variable' },
  ],
  totalRange: '200€ à 400€/mois + complexité',
  virtuelMbolo: {
    starter: '150€/mois tout inclus',
    pro: '200€/mois tout inclus',
    elite: '300€/mois tout inclus',
  },
  savings: 'Jusqu\'à 100€/mois d\'économie + temps gagné',
};

export const CTA_LINKS = {
  main: '/cimolace/solutions/virtuel-mbolo',
  starter: '/cimolace/solutions/virtuel-mbolo/starter',
  pro: '/cimolace/solutions/virtuel-mbolo/pro',
  elite: '/cimolace/solutions/virtuel-mbolo/elite',
  configurator: '/cimolace/configurateur',
  contact: '/cimolace/contact',
};

export const BRANDING = {
  name: 'Virtuel-Mbolo™',
  tagline: 'La solution e-commerce clé en main, hébergée et gérée pour vous.',
  headline: 'On ne vous crée pas une boutique. On vous installe un business.',
  company: 'CIMOLACE',
  parentCompany: 'CIMOLACE',
  modelClient: 'Zahir',
};

export default {
  plans: VIRTUEL_MBOLO_PLANS,
  setup: SETUP_CONFIG,
  comparison: COMPARISON_TABLE,
  faq: FAQ_DATA,
  audiences: TARGET_AUDIENCES,
  marketComparison: MARKET_COMPARISON,
  cta: CTA_LINKS,
  branding: BRANDING,
};
