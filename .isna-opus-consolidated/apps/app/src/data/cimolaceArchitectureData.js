/**
 * Contenu vitrine « Architecture technique » CIMOLACE (page /cimolace/architecture).
 * Aligné sur le livrable HTML prototype ; infra nommée selon le stack déployé (Netlify).
 */

export const CIMOLACE_ARCHITECTURE_ENGINES = [
  {
    id: 'live',
    name: 'LIRI Live Engine',
    icon: '📡',
    function: 'Live temps réel',
    color: '#ff6b4a',
    description:
      'Diffusion broadcast multi-caméras, gestion des phases (waiting / live / ended), sièges scéniques, captation HD, mains levées, whispers privés, permissions granulaires par action.',
    tech: ['LiveKit (WebRTC)', 'Supabase Realtime', 'MediaRecorder API'],
  },
  {
    id: 'school',
    name: 'School Engine',
    icon: '📚',
    function: 'Gestion cours et apprentissage',
    color: '#1a4f8f',
    description:
      'Parcours scolaires structurés, suivi élève par compétence, bulletins, espace parent, devoirs avec correction IA assistée, flashcards et révisions espacées.',
    tech: ['Supabase (PostgreSQL)', 'OpenAI GPT-4o', 'SM-2 / FSRS algo'],
  },
  {
    id: 'commerce',
    name: 'Commerce Engine',
    icon: '💳',
    function: 'Vente et paiement',
    color: '#2cc275',
    description:
      'Catalogue universel (produits, services, abonnements, formations), paiements Stripe natifs, facturation automatique, CRM unifié, gestion stocks et abonnements récurrents.',
    tech: ['Stripe API', 'Supabase', 'Resend (factures)'],
  },
  {
    id: 'marketing',
    name: 'Marketing Engine',
    icon: '📈',
    function: 'Acquisition et rétention',
    color: '#5b3df5',
    description:
      'Pubs IA multi-plateformes (Facebook, TikTok, YouTube, Google), email automation, segments comportementaux, A/B testing intégré, tracking conversion UTM.',
    tech: ['OpenAI GPT-4o', 'DALL-E', 'Marketing APIs', 'Resend'],
  },
  {
    id: 'studio',
    name: 'Creator Studio',
    icon: '🎨',
    function: 'Production de contenu',
    color: '#a855f7',
    description:
      'Studio ProShell IDE, SmartBoard Compositor (Konva), VideoPostProd browser-side, MasterScript Live, DocumentCoach AI, traduction Multilang. L\'arsenal du créateur.',
    tech: ['Konva.js', 'FFmpeg WASM', 'Web Audio API', 'OpenAI'],
  },
  {
    id: 'admin',
    name: 'Admin Engine',
    icon: '⚙️',
    function: 'Organisation et orchestration',
    color: '#1f2937',
    description:
      'Gestion utilisateurs, rôles (RBAC), permissions, équipes, multi-tenancy. Orchestration des pipelines IA. Couche transversale d\'assistants routée de façon contrôlée.',
    tech: ['Supabase Auth', 'Row-Level Security', 'OpenAI Routing'],
  },
];

/** Activation par défaut des moteurs par OS (vertical métier). */
export const CIMOLACE_ENGINE_OS_MAP = {
  temple: { live: 1, school: 0, commerce: 1, marketing: 0, studio: 1, admin: 1 },
  school: { live: 1, school: 1, commerce: 0, marketing: 0, studio: 1, admin: 1 },
  'school-live': { live: 1, school: 0, commerce: 0, marketing: 0, studio: 1, admin: 1 },
  commerce: { live: 0, school: 0, commerce: 1, marketing: 1, studio: 0, admin: 1 },
  creator: { live: 0, school: 0, commerce: 1, marketing: 1, studio: 1, admin: 1 },
  business: { live: 1, school: 0, commerce: 1, marketing: 1, studio: 0, admin: 1 },
  media: { live: 1, school: 0, commerce: 0, marketing: 1, studio: 1, admin: 1 },
};

export const CIMOLACE_MANAGED_SERVICES = [
  { name: 'Supabase', role: 'Base de données + Realtime + Auth + Storage', tech: 'PostgreSQL · WebSocket · S3' },
  { name: 'LiveKit', role: 'WebRTC mesh, audio/vidéo/screen tracks', tech: 'SFU · WebRTC · Edge' },
  { name: 'Netlify', role: 'Edge, CDN, fonctions serverless, CI/CD', tech: 'Functions · Edge · Builds' },
  { name: 'OpenAI', role: 'Modèles IA : GPT-4o, GPT-4o-mini, Whisper, DALL-E', tech: 'API · Streaming SSE' },
  { name: 'Stripe', role: 'Paiements, abonnements, factures, multi-devises', tech: 'API · Webhooks · Connect' },
  { name: 'Resend', role: 'Email transactionnel et marketing', tech: 'SMTP · Templates · Webhooks' },
  { name: 'Cloudflare', role: 'CDN, DNS, protection DDoS, WAF', tech: 'Anycast · Workers · Rules' },
  { name: 'Sentry', role: 'Monitoring erreurs, performance, observabilité', tech: 'JS · Server · Transactions' },
];

export const CIMOLACE_SECURITY_PILLARS = [
  {
    num: '01',
    title: 'Séparation des données',
    body:
      'Chaque client (tenant) dispose de son propre espace de données isolé. Aucun croisement possible entre tenants, même en cas de compromission applicative.',
    tech: 'Multi-schema PostgreSQL · Tenant-aware queries',
  },
  {
    num: '02',
    title: 'Système de rôles RBAC',
    body:
      'Permissions granulaires par utilisateur, par rôle, par ressource. Admin, créateur, éditeur, membre — chaque action est gardée par des contrôles explicites.',
    tech: 'Supabase Auth · Row-Level Security · Policies',
  },
  {
    num: '03',
    title: 'Isolation tenant native',
    body:
      'Row-Level Security PostgreSQL au niveau base de données. Une requête ne voit que les lignes du tenant courant — aucune fuite par défaut.',
    tech: 'PG RLS · JWT claims · Audit logs',
  },
];

export const CIMOLACE_SCALE_PILLARS = [
  {
    num: '01',
    title: 'Multi-tenant native',
    body:
      'Un seul déploiement CIMOLACE héberge des milliers de clients. Aucun fork, aucune duplication de code, mises à jour mutualisées.',
    tech: 'Tenant-per-row · Shared infrastructure',
  },
  {
    num: '02',
    title: 'Modules activables',
    body:
      'Vous payez ce que vous utilisez. Un client Temple OS n\'active pas Commerce Engine. Coût marginal d\'un module = 0 quand non utilisé.',
    tech: 'Feature flags · Module loaders',
  },
  {
    num: '03',
    title: 'Auto-scaling',
    body:
      'Fonctions Netlify et edge qui absorbent les pics. Supabase pour la donnée. LiveKit pour distribuer les sessions sur la SFU mondiale.',
    tech: 'Netlify · Supabase autoscale · LiveKit SFU',
  },
];

export function engineColumnTitle(engine) {
  return engine.name.replace(/\sEngine\s*$/i, '').replace(/^LIRI\s+/i, '').replace(/\sStudio\s*$/i, '');
}
