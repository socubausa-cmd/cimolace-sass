/** Données du wizard installateur — aligné sur le cahier des charges HTML `cimolace-installer.html`. */

export const INSTALLER_ENGINES = [
  {
    id: 'commerce',
    icon: '💳',
    name: 'Virtuel-Mbolo Commerce Engine',
    fn: 'Vente · paiement · catalogue',
    desc: 'Connecté à votre boutique existante ou création landing + boutique. Stripe natif, abonnements, factures.',
  },
  {
    id: 'live',
    icon: '📡',
    name: 'LIRI Live Room Engine',
    fn: 'Live · broadcast · captation',
    desc: 'Multi-caméras, scénographie, chat, replay HD. Intégration /live ou sous-domaine.',
  },
  {
    id: 'school',
    icon: '📚',
    name: 'LIRI School Engine',
    fn: 'Cours · parcours · suivi',
    desc: 'Parcours, élèves, bulletins, devoirs. Routes /formations, /academy, etc.',
  },
  {
    id: 'creator',
    icon: '🎨',
    name: 'LIRI Creator Studio',
    fn: 'Production · contenu · IA',
    desc: 'Scripts IA, production, traduction, distribution.',
  },
  {
    id: 'booking',
    icon: '📅',
    name: 'Admin Booking Engine',
    fn: 'Calendrier · RDV · clients',
    desc: 'Widget ou page complète de réservation.',
  },
  {
    id: 'marketing',
    icon: '📈',
    name: 'Marketing Creator',
    fn: 'Pubs IA · funnels · email',
    desc: 'Campagnes et tunnels reliés à votre site.',
  },
];

export const INSTALLER_CONNECTION_MODES = [
  {
    id: 'subdomain',
    icon: '🔗',
    title: 'Sous-domaine dédié',
    example: 'live.votre-marque.com',
    desc: 'SSL automatique, DNS guidé. Le plus pro.',
  },
  {
    id: 'route',
    icon: '📍',
    title: 'Route sur votre site',
    example: 'votre-marque.com/live',
    desc: 'Reverse-proxy ou iframe selon votre stack.',
  },
  {
    id: 'button',
    icon: '🔘',
    title: 'Bouton intégré',
    example: 'snippet HTML',
    desc: 'Modal rapide, zéro DNS.',
  },
  {
    id: 'widget',
    icon: '🧩',
    title: 'Widget JavaScript',
    example: '<script>',
    desc: 'Embed configurable via data-*.',
  },
];

export const INSTALLER_PLANS = {
  engines: [
    { id: 'starter', name: 'Starter', price: 150, limit: '10K appels API/mois · 100 utilisateurs · 1 moteur', recommended: false },
    {
      id: 'pro',
      name: 'Pro',
      price: 200,
      limit: '100K appels API/mois · 1 000 utilisateurs · jusqu\'à 3 moteurs',
      recommended: true,
    },
    { id: 'elite', name: 'Elite', price: 300, limit: 'Illimité · multi-moteurs · SLA · white-label', recommended: false },
  ],
  os: [
    { id: 'starter', name: 'Starter', price: 150, limit: '1 OS · 100 utilisateurs/mois · hébergement CIMOLACE', recommended: false },
    {
      id: 'pro',
      name: 'Pro',
      price: 200,
      limit: '1 OS · 1 000 utilisateurs/mois · personnalisation marque',
      recommended: true,
    },
    {
      id: 'elite',
      name: 'Elite',
      price: 300,
      limit: 'OS multiples · illimité · hébergement dédié + SLA',
      recommended: false,
    },
  ],
};

export const INSTALLER_ADDONS = [
  { id: 'multilang', name: 'Multilingue (LIRI Multilang)', desc: 'Traduction live et replays 12+ langues', price: 30 },
  { id: 'whitelabel', name: 'White-label complet', desc: 'Sans mention CIMOLACE', price: 50 },
  { id: 'advancedAI', name: 'IA avancée (Brain Trinity)', desc: 'Agents Coach + Architecte enrichis', price: 40 },
  { id: 'mobile', name: 'App mobile sous votre marque', desc: 'iOS + Android à votre nom', price: 80 },
  { id: 'support', name: 'Support 24/7 + onboarding', desc: 'Account manager + intégration assistée', price: 50 },
];

export const INSTALLER_COLOR_PRESETS = ['#5b3df5', '#ff6b4a', '#2cc275', '#1a4f8f', '#a855f7', '#c9a227', '#d4395f', '#0a0a0f'];
