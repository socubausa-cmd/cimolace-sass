import { Feather } from '@expo/vector-icons';

/**
 * ORCHESTRATEUR DE PARITÉ — source de vérité unique des « moteurs » LIRI et de
 * leur état de portage natif (apps/mobile) par rapport au web (apps/app).
 *
 * Cf. NATIVE_PARITY_ORCHESTRATOR.md (racine apps/mobile) pour le détail web↔natif.
 * `apps/app` (portail web) reste la RÉFÉRENCE en lecture seule.
 *
 * status :
 *   'done'    → parité atteinte en natif
 *   'partial' → écran natif présent mais incomplet vs web
 *   'todo'    → absent en natif, à créer
 */
export type EngineStatus = 'done' | 'partial' | 'todo';
export type EngineCategory =
  | 'live'
  | 'studio'
  | 'apprentissage'
  | 'vie-scolaire'
  | 'communication'
  | 'commerce'
  | 'accueil';

export interface Engine {
  key: string;
  label: string;
  icon: React.ComponentProps<typeof Feather>['name'];
  category: EngineCategory;
  status: EngineStatus;
  /** Route Expo native si elle existe (sinon undefined). */
  route?: string;
  /** Référence web (route/fichier) pour le portage. */
  webRef: string;
  /** Backend principal. */
  backend?: string;
  /** Ce qui reste à faire pour la parité. */
  gap?: string;
}

export const ENGINES: Engine[] = [
  // ── LIVE ───────────────────────────────────────────────────────────────
  { key: 'live-host', label: 'Régie live (hôte)', icon: 'radio', category: 'live', status: 'partial', route: '/live-host', webRef: '/lives/:id/host · LiveHostMobileShell', backend: 'LiveKit (multicam) + data channels sb/chat/qa/mod', gap: 'Modération avancée, multilangue et synchronisation complète des panneaux web.' },
  { key: 'live-room', label: 'Salle live (élève)', icon: 'video', category: 'live', status: 'partial', route: '/live-room', webRef: '/lives/:id/classroom', backend: 'LiveKit + data channel (sb/chat)', gap: 'Overlays, annotations et modes réseau faible du web à compléter.' },
  { key: 'live-list', label: 'Lives & replays', icon: 'list', category: 'live', status: 'done', route: '/lives', webRef: '/dashboard/lives', backend: '/lives' },
  { key: 'waiting-room', label: 'Salle d’attente', icon: 'clock', category: 'live', status: 'partial', route: '/waiting-room', webRef: '/dev LiveWaitingRoomMaquette', gap: 'UI locale; admission et état serveur temps réel manquants.' },

  // ── STUDIO / CRÉATION ──────────────────────────────────────────────────
  { key: 'studio-hub', label: 'Studio', icon: 'grid', category: 'studio', status: 'partial', route: '/studio', webRef: '/studio/liri', gap: 'Studio Image et Import IA absents.' },
  { key: 'smartboard', label: 'Smartboard', icon: 'edit-3', category: 'studio', status: 'partial', route: '/smartboard', webRef: '/studio/smartboard (Konva)', backend: 'Skia + liri_course_workspaces (cloud + local)', gap: 'Outils et calques avancés du web à porter.' },
  { key: 'masterclass', label: 'Masterclass Factory', icon: 'award', category: 'studio', status: 'partial', route: '/creer-masterclass', webRef: '/dev MasterclassFactoryV2 (pipeline 8 étapes IA)', backend: '/masterclass-factory/generate', gap: 'Pipeline web en huit étapes non reproduit.' },
  { key: 'course-builder', label: 'Créer un cours', icon: 'book', category: 'studio', status: 'partial', route: '/creer-formation', webRef: '/studio/formation (OwnerFormationBuilder) → /liri/formations (OS)', backend: 'courses + modules/formation_weeks/formation_days/formation_day_contents (Supabase, RLS) — visible natif+web', gap: 'Éditeur avancé (quiz structuré, upload médias, mindmap) à compléter ; lecteur natif OK.' },
  { key: 'masterscript', label: 'Masterscript', icon: 'file-text', category: 'studio', status: 'done', route: '/masterscript', webRef: 'scripts pédagogiques' },
  { key: 'export-center', label: 'Export Center', icon: 'download', category: 'studio', status: 'todo', route: '/export', webRef: '/studio/export-center', gap: 'Écran de sélection uniquement; aucun pipeline serveur branché.' },
  { key: 'orchestrator-live', label: 'Orchestrateur live', icon: 'sliders', category: 'studio', status: 'partial', route: '/orchestrator-live', webRef: '/dev OrchestratorLiveV2', backend: 'session + régie LiveKit', gap: 'Sélecteur de source local; synchro multi-source incomplète.' },

  // ── APPRENTISSAGE ──────────────────────────────────────────────────────
  { key: 'brain', label: 'LIRI Brain (IA)', icon: 'zap', category: 'apprentissage', status: 'done', route: '/brain', webRef: '/dashboard/liri', backend: '/liri/brain/chat (SSE)' },
  { key: 'neuron', label: 'Neuron / NeuroRecall', icon: 'layers', category: 'apprentissage', status: 'done', route: '/neuro-recall', webRef: 'EleveNeuronScreen', backend: '/liri/neuron' },
  { key: 'arena', label: 'Arena', icon: 'flag', category: 'apprentissage', status: 'partial', route: '/arena/[sessionId]', webRef: 'LiveArenaPage', backend: 'LiveKit + débat/votes/NeuronQ (Supabase realtime)', gap: 'Workflow hôte et rapports avancés à compléter.' },
  { key: 'bibliotheque', label: 'Bibliothèque', icon: 'book-open', category: 'apprentissage', status: 'partial', route: '/bibliotheque', webRef: 'BibliothequePage', backend: '/replay + /courses', gap: 'Détail cours, téléchargements et lecture exhaustive absents.' },
  { key: 'forum', label: 'Forum', icon: 'message-square', category: 'apprentissage', status: 'partial', route: '/forum', webRef: 'CommunityChatPage', backend: 'forum_topics (Supabase)', gap: 'Fil détaillé, réponses et modération à porter.' },

  // ── VIE SCOLAIRE ───────────────────────────────────────────────────────
  { key: 'vie-scolaire', label: 'Vie scolaire', icon: 'clipboard', category: 'vie-scolaire', status: 'partial', route: '/vie-scolaire', webRef: 'EleveVieScolaireScreen', backend: 'Supabase RLS', gap: 'Contrats alignés; vues détaillées et actions du web restent à porter.' },
  { key: 'notes', label: 'Notes', icon: 'bar-chart-2', category: 'vie-scolaire', status: 'partial', route: '/vie-scolaire', webRef: 'EleveEtudiantNotesScreen', backend: 'student_evaluations (Supabase)', gap: 'Classement, filtres et bulletin détaillé absents.' },
  { key: 'absences', label: 'Absences', icon: 'user-x', category: 'vie-scolaire', status: 'partial', route: '/vie-scolaire', webRef: 'EleveEtudiantAbsencesScreen', backend: 'attendance_records (Supabase)', gap: 'Justificatifs et workflow de validation absents.' },
  { key: 'evaluations', label: 'Évaluations', icon: 'check-square', category: 'vie-scolaire', status: 'partial', route: '/vie-scolaire', webRef: 'EleveEtudiantEvaluationsScreen', backend: 'student_evaluations (Supabase)', gap: 'Vue détaillée et contexte formation absents.' },
  { key: 'documents', label: 'Documents', icon: 'folder', category: 'vie-scolaire', status: 'partial', route: '/vie-scolaire', webRef: 'EleveEtudiantDocumentsScreen', backend: 'certificates + student_live_reports (Supabase)', gap: 'Téléchargement et catégories avancées à compléter.' },
  { key: 'agenda', label: 'Agenda', icon: 'calendar', category: 'vie-scolaire', status: 'partial', route: '/vie-scolaire', webRef: 'EleveAgendaScreen', backend: 'school_events + school_calendar + annual_program_weeks', gap: 'Calendrier annuel et interactions détaillées absents.' },

  // ── COMMUNICATION ──────────────────────────────────────────────────────
  { key: 'messages', label: 'Messagerie', icon: 'send', category: 'communication', status: 'partial', route: '/messages', webRef: 'MessagingPage', backend: '/messaging/*', gap: 'API et polling alignés; nouveau destinataire, groupes et temps réel push à compléter.' },
  { key: 'notifications', label: 'Notifications', icon: 'bell', category: 'communication', status: 'done', route: '/notifications', webRef: 'NotificationCenter', backend: 'notifications (Supabase RLS)' },
  { key: 'profil', label: 'Profil élève', icon: 'user', category: 'communication', status: 'partial', route: '/profil', webRef: 'EleveProfileScreen', backend: 'student_progress (Supabase)', gap: 'Réalisations et plusieurs menus restent incomplets.' },

  // ── COMMERCE ───────────────────────────────────────────────────────────
  { key: 'forfaits', label: 'Forfaits', icon: 'layers', category: 'commerce', status: 'partial', route: '/commerce', webRef: 'EleveForfaitsScreen', gap: 'Catalogue et tarifs encore embarqués localement.' },
  { key: 'boutique', label: 'Boutique', icon: 'shopping-bag', category: 'commerce', status: 'partial', route: '/commerce', webRef: 'EleveBoutiqueSacreeScreen', gap: 'Catalogue dynamique et droits après achat à brancher.' },
  { key: 'checkout', label: 'Paiement', icon: 'credit-card', category: 'commerce', status: 'partial', route: '/commerce', webRef: 'EleveBillingCheckoutScreen', backend: '/offering-checkout/mobile-money (PawaPay) + carte web', gap: 'Mobile Money branché; confirmation, carte native et catalogue dynamique incomplets.' },

  // ── ACCUEIL ────────────────────────────────────────────────────────────
  { key: 'home', label: 'Accueil', icon: 'home', category: 'accueil', status: 'done', route: '/', webRef: 'EleveHomeScreen', backend: '/growth/stats + /lives' },
  { key: 'integrations', label: 'Intégrations (clés API)', icon: 'key', category: 'accueil', status: 'done', route: '/integrations', webRef: 'API keys', backend: '/tenants/api-keys' },
];

export const CATEGORY_LABEL: Record<EngineCategory, string> = {
  live: 'Live',
  studio: 'Studio & création',
  apprentissage: 'Apprentissage',
  'vie-scolaire': 'Vie scolaire',
  communication: 'Communication',
  commerce: 'Commerce',
  accueil: 'Accueil',
};

export const STATUS_META: Record<EngineStatus, { label: string; color: string }> = {
  done: { label: 'Natif', color: '#34D399' },
  partial: { label: 'Partiel', color: '#FCD34D' },
  todo: { label: 'À faire', color: '#9CA3AF' },
};

export const parityStats = () => {
  const done = ENGINES.filter((e) => e.status === 'done').length;
  const partial = ENGINES.filter((e) => e.status === 'partial').length;
  const todo = ENGINES.filter((e) => e.status === 'todo').length;
  return { done, partial, todo, total: ENGINES.length };
};
