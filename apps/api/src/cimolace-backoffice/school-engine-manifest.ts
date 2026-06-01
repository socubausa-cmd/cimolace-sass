export type SchoolEngineTier = 'core' | 'recommended' | 'addon';
export type SchoolEngineReadiness = 'ready' | 'needs_provider' | 'needs_shell';

export interface SchoolEngineManifestEntry {
  key: string;
  label: string;
  tier: SchoolEngineTier;
  category: string;
  role: string;
  routes: string[];
  requiredProviders: string[];
  brandingZones: string[];
  shell: {
    layout: string;
    designSystem: string;
    tenantConfig: string[];
  };
  readiness: SchoolEngineReadiness;
  readinessNotes: string;
}

export const SCHOOL_ENGINE_MANIFEST: SchoolEngineManifestEntry[] = [
  {
    key: 'calendar',
    label: 'Calendrier école',
    tier: 'core',
    category: 'planning',
    role: 'Agenda, rendez-vous, événements et planification pédagogique.',
    routes: ['/booking', '/m/eleve/calendrier', '/t/:tenantSlug/admin'],
    requiredProviders: ['supabase'],
    brandingZones: ['memberApp', 'adminBackoffice'],
    shell: {
      layout: 'school-dashboard',
      designSystem: 'tenant-school-shell',
      tenantConfig: ['brand_colors', 'logo_url', 'metadata.branding'],
    },
    readiness: 'ready',
    readinessNotes: 'Fonctionnel comme moteur école, quotas à formaliser.',
  },
  {
    key: 'course_builder',
    label: 'Masterclass / Course Builder',
    tier: 'core',
    category: 'content',
    role: 'Création de formations, modules, leçons et masterclass pédagogiques.',
    routes: ['/course-builder', '/masterclass-factory', '/t/:tenantSlug/admin/courses'],
    requiredProviders: ['supabase', 'ai_provider_optional'],
    brandingZones: ['adminBackoffice', 'memberApp', 'publicVitrine'],
    shell: {
      layout: 'school-content-studio',
      designSystem: 'tenant-school-shell',
      tenantConfig: ['brand_colors', 'logo_url', 'primary_domain'],
    },
    readiness: 'needs_shell',
    readinessNotes: 'Moteurs présents, shell tenant unifié à terminer.',
  },
  {
    key: 'liri_live',
    label: 'LIRI Live / Arena immersive',
    tier: 'core',
    category: 'live_video',
    role: 'Classes live, live room, waiting room, interaction participant et expériences immersives.',
    routes: ['/lives', '/dev/liri-host-live', '/m/eleve/live'],
    requiredProviders: ['supabase', 'livekit'],
    brandingZones: ['liveStudio', 'memberApp'],
    shell: {
      layout: 'live-arena-shell',
      designSystem: 'tenant-live-shell',
      tenantConfig: ['brand_colors', 'logo_url', 'metadata.branding.zones.liveStudio'],
    },
    readiness: 'needs_provider',
    readinessNotes: 'LiveKit configuré localement, quotas/salles par tenant à formaliser.',
  },
  {
    key: 'liri_replay',
    label: 'Replay / Postproduction',
    tier: 'core',
    category: 'live_video',
    role: 'Replay enrichi, recordings, playback et postproduction vidéo.',
    routes: ['/replay', '/video-engine', '/m/eleve/replay'],
    requiredProviders: ['supabase_storage', 'livekit', 'video_provider_optional'],
    brandingZones: ['memberApp', 'adminBackoffice'],
    shell: {
      layout: 'media-library-shell',
      designSystem: 'tenant-school-shell',
      tenantConfig: ['brand_colors', 'logo_url'],
    },
    readiness: 'needs_provider',
    readinessNotes: 'Replay présent, provider stockage/vidéo et quotas à verrouiller.',
  },
  {
    key: 'liri_smartboard',
    label: 'SmartBoard Designer',
    tier: 'core',
    category: 'ia',
    role: 'Tableau pédagogique interactif, design de slides et scènes Konva.',
    routes: ['/smartboard', '/dashboard/tools/smartboard', '/studio/smartboard'],
    requiredProviders: ['supabase', 'ai_provider_optional'],
    brandingZones: ['adminBackoffice', 'liveStudio'],
    shell: {
      layout: 'designer-workbench-shell',
      designSystem: 'tenant-creative-shell',
      tenantConfig: ['brand_colors', 'logo_url', 'metadata.branding'],
    },
    readiness: 'needs_shell',
    readinessNotes: 'Designer puissant déjà présent, habillage tenant à unifier.',
  },
  {
    key: 'marketing_creator',
    label: 'Marketing Creator',
    tier: 'core',
    category: 'growth',
    role: 'Pages, bannières, popups, promotions, activation commerciale.',
    routes: ['/marketing', '/iri', '/cimolace/client/:slug'],
    requiredProviders: ['supabase'],
    brandingZones: ['publicVitrine', 'adminBackoffice'],
    shell: {
      layout: 'growth-dashboard-shell',
      designSystem: 'tenant-school-shell',
      tenantConfig: ['brand_colors', 'logo_url', 'primary_domain', 'contact_email'],
    },
    readiness: 'ready',
    readinessNotes: 'Disponible, templates marketing école à compléter.',
  },
  {
    key: 'studio_creator',
    label: 'Studio Creator LIRI',
    tier: 'recommended',
    category: 'live_video',
    role: 'Préparation studio, production live, assets, versions et scènes.',
    routes: ['/studio', '/studio/workspaces', '/dev/liri-host-live'],
    requiredProviders: ['supabase', 'livekit', 'ai_provider_optional'],
    brandingZones: ['liveStudio', 'adminBackoffice'],
    shell: {
      layout: 'creator-studio-shell',
      designSystem: 'tenant-creative-shell',
      tenantConfig: ['brand_colors', 'logo_url', 'metadata.branding.zones.liveStudio'],
    },
    readiness: 'needs_shell',
    readinessNotes: 'Moteur présent, packaging tenant école à finaliser.',
  },
  {
    key: 'liri_neuro_recall',
    label: 'LIRI Neuro Recall',
    tier: 'recommended',
    category: 'ia',
    role: 'Mémorisation, répétition espacée et révision des connaissances.',
    routes: ['/neuro-recall', '/m/eleve/neuro'],
    requiredProviders: ['supabase', 'ai_provider_optional'],
    brandingZones: ['memberApp'],
    shell: {
      layout: 'student-learning-shell',
      designSystem: 'tenant-school-shell',
      tenantConfig: ['brand_colors', 'logo_url'],
    },
    readiness: 'needs_shell',
    readinessNotes: 'Moteur activable, UX tenant élève à stabiliser.',
  },
  {
    key: 'pay_engine',
    label: 'Pay Engine',
    tier: 'recommended',
    category: 'payment',
    role: 'Inscriptions payantes, abonnements, factures et providers de paiement.',
    routes: ['/billing', '/checkout', '/pay-engine'],
    requiredProviders: ['stripe_or_mobile_money'],
    brandingZones: ['publicVitrine', 'memberApp'],
    shell: {
      layout: 'billing-shell',
      designSystem: 'tenant-school-shell',
      tenantConfig: ['brand_colors', 'logo_url', 'primary_domain'],
    },
    readiness: 'needs_provider',
    readinessNotes: 'Baseline Cimolace existe, paiement réel par école à configurer.',
  },
  {
    key: 'chat_engine',
    label: 'Chat Engine',
    tier: 'recommended',
    category: 'communication',
    role: 'Messagerie, échanges classe et communication directe.',
    routes: ['/chat-engine', '/messaging', '/m/eleve/messages'],
    requiredProviders: ['supabase_realtime'],
    brandingZones: ['memberApp', 'adminBackoffice'],
    shell: {
      layout: 'communication-shell',
      designSystem: 'tenant-school-shell',
      tenantConfig: ['brand_colors', 'logo_url'],
    },
    readiness: 'needs_shell',
    readinessNotes: 'Moteur présent, règles rôle/tenant à finaliser côté UI.',
  },
  {
    key: 'notif_engine',
    label: 'Notification Engine',
    tier: 'recommended',
    category: 'communication',
    role: 'Notifications produit, rappels live, alertes pédagogiques.',
    routes: ['/notifications'],
    requiredProviders: ['supabase', 'email_or_sms_optional'],
    brandingZones: ['memberApp', 'adminBackoffice'],
    shell: {
      layout: 'notification-center-shell',
      designSystem: 'tenant-school-shell',
      tenantConfig: ['brand_colors', 'logo_url'],
    },
    readiness: 'needs_provider',
    readinessNotes: 'Notifications présentes, providers email/SMS à prouver.',
  },
  {
    key: 'liri_masterclass',
    label: 'LIRI Masterclass Factory',
    tier: 'addon',
    category: 'ia',
    role: 'Génération assistée de masterclass complètes par IA.',
    routes: ['/masterclass-factory', '/dashboard/liri/orchestrator-live'],
    requiredProviders: ['ai_provider'],
    brandingZones: ['adminBackoffice'],
    shell: {
      layout: 'ai-production-shell',
      designSystem: 'tenant-creative-shell',
      tenantConfig: ['brand_colors', 'logo_url'],
    },
    readiness: 'needs_provider',
    readinessNotes: 'Moteur disponible comme addon, pas activé automatiquement dans le pack école actuel.',
  },
];

export const SCHOOL_BASE_ENGINES = SCHOOL_ENGINE_MANIFEST.filter(
  (engine) => engine.tier === 'core',
).map((engine) => engine.key);

export const SCHOOL_RECOMMENDED_ENGINES = SCHOOL_ENGINE_MANIFEST.filter(
  (engine) => engine.tier === 'core' || engine.tier === 'recommended',
).map((engine) => engine.key);

// ── Limites par plan Cimolace École ─────────────────────────────────────────

export interface SchoolPlanLimits {
  maxStudents: number;       // Max étudiants inscrits simultanément
  maxCourses: number;        // Max cours publiés
  maxLivesPerMonth: number;  // Max sessions live par mois (-1 = illimité)
  maxStorageGb: number;      // Stockage vidéo/fichiers en Go
  whiteLabel: boolean;       // Branding personnalisé complet
  neuroRecall: boolean;      // Accès moteur IA Neuro Recall
  apiAccess: boolean;        // Accès API externe
}

export const SCHOOL_PLAN_LIMITS: Record<string, SchoolPlanLimits> = {
  starter: {
    maxStudents: 50,
    maxCourses: 10,
    maxLivesPerMonth: 4,
    maxStorageGb: 5,
    whiteLabel: false,
    neuroRecall: false,
    apiAccess: false,
  },
  pro: {
    maxStudents: 500,
    maxCourses: 100,
    maxLivesPerMonth: -1,
    maxStorageGb: 50,
    whiteLabel: false,
    neuroRecall: true,
    apiAccess: false,
  },
  business: {
    maxStudents: 2000,
    maxCourses: -1,
    maxLivesPerMonth: -1,
    maxStorageGb: 500,
    whiteLabel: true,
    neuroRecall: true,
    apiAccess: true,
  },
  school: {
    // Plan par défaut (rétrocompatibilité) — équivalent Pro
    maxStudents: 500,
    maxCourses: 100,
    maxLivesPerMonth: -1,
    maxStorageGb: 50,
    whiteLabel: false,
    neuroRecall: true,
    apiAccess: false,
  },
};

