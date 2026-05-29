export const cimolaceHeroMetrics = [
  { value: '35', label: 'moteurs catalogue' },
  { value: '7', label: 'infrastructures metier' },
  { value: '1', label: 'socle multi-tenant' },
];

export const cimolacePrimaryEngines = [
  {
    name: 'LIRI Live Engine',
    category: 'Live',
    status: 'Pret',
    accent: '#ff6b4a',
    summary: 'Diffuse des classes, emissions et evenements avec phases, roles, permissions, chat et replay.',
    capabilities: ['LiveKit realtime', 'phases sceniques', 'replay enrichi'],
  },
  {
    name: 'SmartBoard Designer',
    category: 'Studio',
    status: 'Pret',
    accent: '#1a4f8f',
    summary: 'Cree tableaux, slides, annotations et supports synchronisables avec un cours live ou une masterclass.',
    capabilities: ['canvas Konva', 'slides visuelles', 'annotations live'],
  },
  {
    name: 'Masterclass Factory',
    category: 'Education IA',
    status: 'Beta',
    accent: '#8b5cf6',
    summary: 'Transforme un texte source en parcours, segments, scripts, supports et exercices pedagogiques.',
    capabilities: ['pipeline cours', 'scripts IA', 'supports exportables'],
  },
  {
    name: 'Creator Studio',
    category: 'Creation',
    status: 'Beta',
    accent: '#ec4899',
    summary: 'Rassemble script, tournage, tableau, contenu, documents, publication et campagnes dans un studio unique.',
    capabilities: ['proshell createur', 'prompteur', 'exports contenus'],
  },
  {
    name: 'Video PostProduction',
    category: 'Audio/video',
    status: 'Beta',
    accent: '#06b6d4',
    summary: 'Nettoie, chapitre, sous-titre et transforme un live ou une video brute en actif reutilisable.',
    capabilities: ['chapitrage', 'sous-titres', 'exports multi-format'],
  },
  {
    name: 'Pay Engine',
    category: 'Paiement',
    status: 'Pret',
    accent: '#2cc275',
    summary: 'Relie abonnements, paiements, factures, acomptes, mobile money et suivi commercial.',
    capabilities: ['Stripe', 'CinetPay', 'facturation tenant'],
  },
  {
    name: 'Marketing Creator',
    category: 'Growth',
    status: 'Pret',
    accent: '#f59e0b',
    summary: 'Transforme cours, offres et produits en pages, campagnes, hooks, messages et relances.',
    capabilities: ['pages de vente', 'emails', 'campagnes'],
  },
  {
    name: 'Brain Trinity',
    category: 'IA',
    status: 'Prototype',
    accent: '#64748b',
    summary: 'Orchestre les agents IA pour assister live, support, contenu, coaching et operations.',
    capabilities: ['routing IA', 'memoire contexte', 'assistants metier'],
  },
];

export const cimolaceOperatingSystems = [
  {
    name: 'School OS',
    promise: "L'ecole numerique complete, prete a enseigner.",
    engines: ['School Engine', 'LIRI Live', 'SmartBoard'],
    accent: '#1a4f8f',
  },
  {
    name: 'Commerce OS',
    promise: 'Vendre produits, services, abonnements et contenus avec paiement et CRM.',
    engines: ['Pay Engine', 'CRM Hub', 'Marketing Creator'],
    accent: '#2cc275',
  },
  {
    name: 'Creator OS',
    promise: 'Produire, monter, publier, traduire et monetiser depuis un seul studio.',
    engines: ['Creator Studio', 'PostProduction', 'Multilang'],
    accent: '#a855f7',
  },
  {
    name: 'Business OS',
    promise: 'Rendez-vous, programmes, paiements, documents et suivi client.',
    engines: ['Booking', 'Smart Secretariat', 'DocumentCoach'],
    accent: '#111827',
  },
  {
    name: 'Media OS',
    promise: 'Plateaux live, debats, replays, archives et distribution multilingue.',
    engines: ['DebateCore', 'Media Room', 'LIRI Live'],
    accent: '#ff6b4a',
  },
  {
    name: 'MedOS',
    promise: 'Infrastructure sante tenant-aware pour dossiers, notes et programmes de soin.',
    engines: ['Med EHR', 'Med Notes', 'GDPR Engine'],
    accent: '#0f766e',
  },
];

export const cimolaceArchitectureBlocks = [
  { label: 'Web', value: 'Vercel', detail: 'landing, backoffice, tenants' },
  { label: 'API', value: 'Cloud Run', detail: 'NestJS, moteurs, CORS' },
  { label: 'Data/Auth', value: 'Supabase', detail: 'Postgres, Auth, RLS' },
  { label: 'Live', value: 'LiveKit', detail: 'WebRTC, rooms, participants' },
  { label: 'Tenant', value: 'Services activables', detail: 'catalogue, quotas, branding' },
];

export const cimolaceSchoolProof = [
  'Tenant modele ISNA / Prorascience',
  'Template school et moteurs actifs',
  'Live classes avec SmartBoard',
  'Replay, cours, marketing et calendrier',
  'Branding tenant: logo, couleurs, domaine',
];
