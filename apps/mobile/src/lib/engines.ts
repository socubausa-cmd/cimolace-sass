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
  { key: 'live-host', label: 'Régie live (hôte)', icon: 'radio', category: 'live', status: 'done', route: '/live-host', webRef: '/lives/:id/host · LiveHostMobileShell', backend: 'LiveKit (multicam) + data channels sb/chat/qa/mod' },
  { key: 'live-room', label: 'Salle live (élève)', icon: 'video', category: 'live', status: 'done', route: '/live-room', webRef: '/lives/:id/classroom', backend: 'LiveKit + data channel (sb/chat)' },
  { key: 'live-list', label: 'Lives & replays', icon: 'list', category: 'live', status: 'done', route: '/lives', webRef: '/dashboard/lives', backend: '/lives' },
  { key: 'waiting-room', label: 'Salle d’attente', icon: 'clock', category: 'live', status: 'done', route: '/waiting-room', webRef: '/dev LiveWaitingRoomMaquette' },

  // ── STUDIO / CRÉATION ──────────────────────────────────────────────────
  { key: 'studio-hub', label: 'Studio', icon: 'grid', category: 'studio', status: 'done', route: '/studio', webRef: '/studio/liri' },
  { key: 'smartboard', label: 'Smartboard', icon: 'edit-3', category: 'studio', status: 'done', route: '/smartboard', webRef: '/studio/smartboard (Konva)', backend: 'Skia + liri_course_workspaces (cloud + local)' },
  { key: 'masterclass', label: 'Masterclass Factory', icon: 'award', category: 'studio', status: 'done', route: '/creer-masterclass', webRef: '/dev MasterclassFactoryV2 (pipeline 8 étapes IA)', backend: '/liri/masterclass-factory/generate' },
  { key: 'course-builder', label: 'Créer un cours', icon: 'book', category: 'studio', status: 'done', route: '/creer-formation', webRef: '/studio/liri/cours', backend: '/courses + /modules + /lessons' },
  { key: 'masterscript', label: 'Masterscript', icon: 'file-text', category: 'studio', status: 'done', route: '/masterscript', webRef: 'scripts pédagogiques' },
  { key: 'export-center', label: 'Export Center', icon: 'download', category: 'studio', status: 'done', route: '/export', webRef: '/studio/export-center', backend: '/liri/export' },
  { key: 'orchestrator-live', label: 'Orchestrateur live', icon: 'sliders', category: 'studio', status: 'done', route: '/orchestrator-live', webRef: '/dev OrchestratorLiveV2', backend: 'session + régie LiveKit' },

  // ── APPRENTISSAGE ──────────────────────────────────────────────────────
  { key: 'brain', label: 'LIRI Brain (IA)', icon: 'zap', category: 'apprentissage', status: 'done', route: '/brain', webRef: '/dashboard/liri', backend: '/liri/brain/chat (SSE)' },
  { key: 'neuron', label: 'Neuron / NeuroRecall', icon: 'layers', category: 'apprentissage', status: 'done', route: '/neuro-recall', webRef: 'EleveNeuronScreen', backend: '/liri/neuron' },
  { key: 'arena', label: 'Arena', icon: 'flag', category: 'apprentissage', status: 'done', route: '/arena/[sessionId]', webRef: 'LiveArenaPage', backend: 'LiveKit + débat/votes/NeuronQ (Supabase realtime)' },
  { key: 'bibliotheque', label: 'Bibliothèque', icon: 'book-open', category: 'apprentissage', status: 'done', route: '/bibliotheque', webRef: 'BibliothequePage', backend: '/replay + /courses' },
  { key: 'forum', label: 'Forum', icon: 'message-square', category: 'apprentissage', status: 'done', route: '/forum', webRef: 'CommunityChatPage', backend: 'forum_topics (Supabase)' },

  // ── VIE SCOLAIRE ───────────────────────────────────────────────────────
  { key: 'vie-scolaire', label: 'Vie scolaire', icon: 'clipboard', category: 'vie-scolaire', status: 'done', route: '/vie-scolaire', webRef: 'EleveVieScolaireScreen', backend: 'Supabase RLS' },
  { key: 'notes', label: 'Notes', icon: 'bar-chart-2', category: 'vie-scolaire', status: 'done', route: '/vie-scolaire', webRef: 'EleveEtudiantNotesScreen', backend: 'grades (Supabase)' },
  { key: 'absences', label: 'Absences', icon: 'user-x', category: 'vie-scolaire', status: 'done', route: '/vie-scolaire', webRef: 'EleveEtudiantAbsencesScreen', backend: 'attendance (Supabase)' },
  { key: 'evaluations', label: 'Évaluations', icon: 'check-square', category: 'vie-scolaire', status: 'done', route: '/vie-scolaire', webRef: 'EleveEtudiantEvaluationsScreen', backend: 'evaluations (Supabase)' },
  { key: 'documents', label: 'Documents', icon: 'folder', category: 'vie-scolaire', status: 'done', route: '/vie-scolaire', webRef: 'EleveEtudiantDocumentsScreen', backend: 'documents (Supabase)' },
  { key: 'agenda', label: 'Agenda', icon: 'calendar', category: 'vie-scolaire', status: 'done', route: '/vie-scolaire', webRef: 'EleveAgendaScreen', backend: 'agenda_events (Supabase)' },

  // ── COMMUNICATION ──────────────────────────────────────────────────────
  { key: 'messages', label: 'Messagerie', icon: 'send', category: 'communication', status: 'done', route: '/messages', webRef: 'MessagingPage', backend: 'messages + profiles (Supabase)' },
  { key: 'notifications', label: 'Notifications', icon: 'bell', category: 'communication', status: 'done', route: '/notifications', webRef: 'NotificationCenter', backend: 'notifications (Supabase RLS)' },
  { key: 'profil', label: 'Profil élève', icon: 'user', category: 'communication', status: 'done', route: '/profil', webRef: 'EleveProfileScreen', backend: 'student_progress (Supabase)' },

  // ── COMMERCE ───────────────────────────────────────────────────────────
  { key: 'forfaits', label: 'Forfaits', icon: 'layers', category: 'commerce', status: 'done', route: '/commerce', webRef: 'EleveForfaitsScreen', backend: '/liri/plans' },
  { key: 'boutique', label: 'Boutique', icon: 'shopping-bag', category: 'commerce', status: 'done', route: '/commerce', webRef: 'EleveBoutiqueSacreeScreen', backend: '/liri/shop' },
  { key: 'checkout', label: 'Paiement', icon: 'credit-card', category: 'commerce', status: 'done', route: '/commerce', webRef: 'EleveBillingCheckoutScreen', backend: '/offering-checkout/mobile-money (PawaPay) + carte web' },

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
