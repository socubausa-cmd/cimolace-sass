import React, { Suspense, lazy, useEffect, useState } from 'react';
import ErrorBoundary from '@/components/ErrorBoundary';
import TenantFavicon from '@/components/TenantFavicon';
import { DEFAULT_TENANT_SLUG } from '@/config/platform';
import { getCachedHostTenant, isPlatformOrDevHost } from '@/lib/tenantResolver';
import { resolveRequiresStudentDossier } from '@/lib/tenant/activeTenantConfig';
import { canonicalTenantSlug } from '@/lib/tenant/tenantSlugAliases';
import { joinApi } from '@/lib/api-v2';
import { authStore } from '@/lib/auth-store';
import LiveHostPage from '@/pages/liri/LiveHostPage';
import ConsultationRoom from '@/pages/liri/ConsultationRoom';
import HandoffPage from '@/pages/HandoffPage';

/** Redirige "/" vers la bonne destination selon le contexte :
 *  1. access_token dans le hash (magic link / recovery) → /auth/callback
 *  2. domaine custom d'un tenant → sa vitrine /t/:slug
 *  3. cimolace.space (SaaS racine) → back-office plateforme /cimolace
 *  4. prorascience.org apex → vitrine publique du tenant ISNA /t/isna
 *  5. tout autre host → /login
 *  Cimolace est la plateforme ; ISNA n'est qu'un tenant. Cf. CIMOLACE_ARCHITECTURE_SOURCE_OF_TRUTH.md.
 */
// P5 — bascule prorascience.org → Cimolace OS (realm isolé). Flip fondateur CONFIRMÉ (2026-07-06) :
// l'OS est le DÉFAUT sur prorascience.org (le MÊME moteur rend le site fondateur, données prorascience).
// KILL-SWITCH instantané = `?os=0` / `?os=off` → maquettes, SANS redéploiement. Rollback total =
// repasser OS_DEFAULT_ON à false + redéployer. `?os=isna` / `?os=1` = forçage explicite. Le flag env
// `VITE_PRORASCIENCE_OS==='0'` désactive aussi (si un jour injecté). N'affecte QUE le host prorascience.org.
const OS_DEFAULT_ON = true; // ← rollback total : mettre à false + redéployer
function prorascienceOsEnabled() {
  if (typeof window === 'undefined') return false;
  try {
    const q = new URLSearchParams(window.location.search).get('os');
    if (q === '0' || q === 'off') return false;       // kill-switch instantané → maquettes
    if (q === 'isna' || q === '1') return true;        // forçage explicite → OS
  } catch { /* noop */ }
  if (import.meta.env.VITE_PRORASCIENCE_OS === '0') return false; // kill par env (si dispo)
  return OS_DEFAULT_ON;
}

// ════════════════════════════════════════════════════════════════════════════════════════════
// ⛔ RÈGLE DE ROUTAGE DÉFINITIVE — CHAQUE ADRESSE VA À SON PORTAIL. NE JAMAIS MÉLANGER LES PORTAILS.
// ────────────────────────────────────────────────────────────────────────────────────────────
// Un host = UN realm. INTERDIT : qu'un host tombe par DÉFAUT sur le portail d'un autre (c'est ce
// bug — liri.cimolace.space qui rendait l'assistant OS — qui a coûté du temps). Le fallback
// « host inconnu → OS » est BANNI. `HOST_PORTAL` est la SOURCE UNIQUE de vérité : tout le routage
// racine (`RootRedirect`, `isCimolaceAssistantRoot`) passe par `resolveHostPortal()`.
//
// 👉 POUR TOUT AGENT / DEV : une NOUVELLE adresse publique DOIT être déclarée EXPLICITEMENT dans
//    `HOST_PORTAL` ci-dessous. Ne route JAMAIS un host « par défaut » vers un portail de marque.
//
// Realms : 'cimolace-os' (assistant SaaS) · 'liri' (portail LIRI hébergé) · 'prorascience'
//          (OS realm du tenant isna) · 'tenant' (domaine custom d'un tenant, résolu dynamiquement).
// ════════════════════════════════════════════════════════════════════════════════════════════
const HOST_PORTAL = {
  // Cimolace OS (assistant / SaaS)
  'cimolace.space': 'cimolace-os',
  'www.cimolace.space': 'cimolace-os',
  'app.cimolace.space': 'cimolace-os',
  // Portail LIRI (back-office hébergé, « 2 portes »)
  'liri.cimolace.space': 'liri',
  'www.liri.cimolace.space': 'liri',
  // OS realm du fondateur (tenant isna)
  'prorascience.org': 'prorascience',
  'www.prorascience.org': 'prorascience',
};

// Résout LE portail d'un host. Aucune supposition de marque : une adresse publique inconnue est
// PRÉSUMÉE domaine custom d'un tenant (→ sa propre vitrine, JAMAIS l'OS ni LIRI). Seuls les hosts
// de preview/dev tombent sur le bac à sable OS. Ainsi un host ne « vole » jamais le portail d'un autre.
function resolveHostPortal(host) {
  const h = String(host || (typeof window !== 'undefined' ? window.location.hostname : '')).toLowerCase();
  if (HOST_PORTAL[h]) return HOST_PORTAL[h];                 // adresse officielle déclarée (source unique)
  if (getCachedHostTenant(h)) return 'tenant';               // domaine custom d'un tenant (cache hydraté)
  if (h.endsWith('-cimolace.vercel.app')) return 'cimolace-os'; // preview Vercel = bac à sable OS
  if (isPlatformOrDevHost(h)) return 'cimolace-os';          // localhost / *.local / *.cimolace.space non déclaré (dev)
  return 'tenant';                                           // adresse publique inconnue → PRÉSUMÉE tenant (jamais une marque)
}

// LOT C — l'assistant immersif est-il l'entrée à la RACINE `/` pour ce host ? (host Cimolace SaaS :
// ni tenant custom, ni prorascience, ni callback OAuth). Sert à masquer le header/DiscoveryChat au `/`.
function isCimolaceAssistantRoot(pathname) {
  if (typeof window === 'undefined') return false;
  if (pathname !== '/') return false;
  if (window.location.hash.includes('access_token')) return false;
  // Header/DiscoveryChat masqués UNIQUEMENT quand la racine est un OS immersif (source unique HOST_PORTAL) :
  //  - portail 'cimolace-os' (assistant) ; - 'prorascience' quand l'OS est actif (sinon maquettes = header visible).
  const portal = resolveHostPortal(window.location.hostname);
  if (portal === 'prorascience') return prorascienceOsEnabled();
  return portal === 'cimolace-os';
}

function RootRedirect() {
  const hash = typeof window !== 'undefined' ? window.location.hash : '';
  const host = typeof window !== 'undefined' ? window.location.hostname.toLowerCase() : '';
  if (hash.includes('access_token')) return <Navigate to="/auth/callback" replace />;
  // ⛔ SOURCE UNIQUE — chaque adresse va à SON portail (jamais de mélange). Cf. HOST_PORTAL / resolveHostPortal.
  switch (resolveHostPortal(host)) {
    case 'prorascience':
      // Realm du fondateur (tenant isna) : l'OS par défaut ; ?os=0 → maquettes figées du fondateur.
      return prorascienceOsEnabled()
        ? <CimolaceCreationAgent tenantSlug={DEFAULT_TENANT_SLUG} />
        : <TenantVitrineHome slug={DEFAULT_TENANT_SLUG} />;
    case 'liri':
      // Portail LIRI hébergé (« 2 portes » Créer / Rejoindre + Se connecter).
      return <LiriLandingPage />;
    case 'tenant':
      // Domaine custom d'un tenant → SA vitrine (URL propre, sans /t/:slug ; générique si cache froid).
      return <TenantVitrineHome slug={getCachedHostTenant(host) || undefined} />;
    case 'cimolace-os':
    default:
      // Assistant immersif Cimolace rendu au root (URL reste `/`). Back-office /cimolace, funnel
      // /creer-organisation et /login restent accessibles EN DIRECT.
      return <CimolaceCreationAgent />;
  }
}

// DEV PREVIEW — composant sans auth
const SmartboardKonvaEditorV1 = lazy(() => import('@/features/smartboard-konva-editor/SmartboardKonvaEditorV1'));
function DevSmartboardPreview() {
  return <div className="flex h-screen flex-col overflow-hidden bg-[#080a0f]"><SmartboardKonvaEditorV1 className="min-h-0 flex-1" /></div>;
}
const StudioSmartboardKonvaPageLazy = lazy(() => import('@/pages/studio-creator/studio/StudioSmartboardKonvaPage'));

// Tenant routing — défaut tenant CENTRALISÉ (config/platform, VITE_DEFAULT_TENANT_SLUG).
// Cimolace est multi-tenant ; isna n'est qu'un tenant. Voir docs/CIMOLACE_ARCHITECTURE.md §7.
const TENANT_SLUG = DEFAULT_TENANT_SLUG;
const TENANT_ADMIN_PATH = `/t/${TENANT_SLUG}/admin`;
const TENANT_COURSES_PATH = `/t/${TENANT_SLUG}/admin/courses`;
const TENANT_STUDENTS_PATH = `/t/${TENANT_SLUG}/admin/students`;
const TENANT_SETTINGS_PATH = `/t/${TENANT_SLUG}/admin/settings`;
/** Aligné sur les redirections sous-domaine ; toute variante `/t/:slug/admin/settings` est gérée par la Route SPA. */
const TENANT_ADMIN_SETTINGS_PATH_RE = /^\/t\/[^/]+\/admin\/settings$/;
/** Callback OAuth Google custom — route publique (unauthenticated redirect from edge function). */
const TENANT_OAUTH_CALLBACK_PATH_RE = /^\/t\/[^/]+\/auth\/callback$/;
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Outlet,
  useLocation,
  Navigate,
  useParams,
  useSearchParams,
  useNavigate,
} from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/** Domaine racine marque (hors sous-domaines réservés). */
const PRORASCIENCE_ROOT = 'prorascience.org';
const CIMOLACE_PUBLIC_HOSTS = new Set([
  'cimolace.space',
  'www.cimolace.space',
]);
const queryClient = new QueryClient();

/** Sous-domaines qui ne sont pas des slugs tenant. */
const PRORASCIENCE_RESERVED_SUBDOMAINS = new Set([
  'www',
  'cimolace',
  'app',
  'api',
  'mail',
  'ftp',
  'cdn',
  'staging',
  'dev',
  'preview',
]);

/**
 * Routage domaine prod : CIMOLACE = produit principal ; ISNA et autres = tenants (/t/:slug).
 * — cimolace.prorascience.org : chemins sous /cimolace/…
 * — prorascience.org | www : la racine / → /cimolace
 * — {slug}.prorascience.org (slug non réservé) : la racine / → /t/{slug}/admin
 */
function CimolaceDomainHandler() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const host = (window.location.hostname || '').toLowerCase();
    const path = location.pathname || '/';
    // La query (?plan=…) + le hash DOIVENT survivre au strip /t/isna, sinon les
    // CTA de paiement /t/isna/paiement?plan=X perdent leurs params.
    const search = location.search || '';
    const hash = location.hash || '';

    // Dev local : ne pas imposer la prod
    if (
      host === 'localhost'
      || host === '127.0.0.1'
      || host.endsWith('.local')
    ) {
      return;
    }

    // LOT C — Domaine officiel CIMOLACE : la racine ouvre désormais l'ASSISTANT IMMERSIF (rendu par
    // RootRedirect au `/`). On NE redirige PLUS `/` vers /cimolace ; le back-office /cimolace/* reste
    // accessible en direct.
    if (CIMOLACE_PUBLIC_HOSTS.has(host) || host.endsWith('-cimolace.vercel.app')) {
      return;
    }

    // Hôte dédié vitrine Cimolace
    if (host === `cimolace.${PRORASCIENCE_ROOT}`) {
      if (path === '/' || path === '') {
        navigate('/cimolace', { replace: true });
      } else if (!path.startsWith('/cimolace')) {
        navigate(`/cimolace${path}`, { replace: true });
      }
      return;
    }

    // Apex + www prorascience.org → vitrine publique ISNA (tenant client)
    if (host === PRORASCIENCE_ROOT || host === `www.${PRORASCIENCE_ROOT}`) {
      // prorascience.org = domaine PROPRE du tenant ISNA → URLs propres, jamais /t/isna visible.
      // On STRIPE le préfixe /t/isna de toute URL (anciens liens, bookmarks) → chemin propre.
      // La racine '/' rend la vitrine via RootRedirect ; /login,/signup,/forfaits,/admin… = routes propres existantes.
      if (path === '/t/isna' || path === '/t/isna/') {
        navigate('/' + search + hash, { replace: true });
      } else if (path.startsWith('/t/isna/')) {
        navigate((path.slice('/t/isna'.length) || '/') + search + hash, { replace: true });
      } else if (path === '/formations' || path === '/catalogue') {
        navigate('/forfaits', { replace: true });
      }
      return;
    }

    // Sous-domaine tenant : isna.prorascience.org → /t/isna/admin
    if (host.endsWith(`.${PRORASCIENCE_ROOT}`)) {
      const sub = host.slice(0, -(PRORASCIENCE_ROOT.length + 1));
      if (!sub || PRORASCIENCE_RESERVED_SUBDOMAINS.has(sub)) {
        return;
      }
      if (path === '/' || path === '') {
        navigate(`/t/${sub}/admin`, { replace: true });
      }
    }
  }, [location.pathname, navigate]);

  return null;
}

import { Toaster } from '@/components/ui/toaster';
import { AuthProvider } from '@/contexts/SupabaseAuthContext';
import { VitrineContactEmailProvider } from '@/contexts/VitrineContactEmailContext';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { DataSyncProvider } from '@/contexts/DataSyncContext';
import { CartProvider } from '@/hooks/useCart';
import { MessagingProvider } from '@/contexts/MessagingContext';
import { NotificationProvider } from '@/contexts/NotificationContext';
import { DemoModeProvider } from '@/contexts/DemoModeContext';
import DemoModeGuard from '@/components/demo/DemoModeGuard';
import ProtectedRoute from '@/components/ProtectedRoute';
import TenantProtectedRoute from '@/components/TenantProtectedRoute';
import ImmersiveBootLoader from '@/components/liri/ImmersiveBootLoader';
import ProtectedRoleRoute from '@/components/ProtectedRoleRoute';
import ProtectedSubscriptionRoute from '@/components/ProtectedSubscriptionRoute';
import ProtectedLiriRoute from '@/components/ProtectedLiriRoute';
import { BillingProvider, useBilling } from '@/contexts/BillingContext';
const GraceBanner = lazy(() => import('@/components/billing/GraceBanner'));
const DiscoveryChat = lazy(() => import('@/components/booking/DiscoveryChat').then((m) => ({ default: m.DiscoveryChat })));

const Header = lazy(() => import('@/components/Header'));
import ProtectedOwnerRoute from '@/components/ProtectedOwnerRoute';
const ShoppingCart = lazy(() => import('@/components/ecommerce/ShoppingCart'));
const LiveAlertBanner = lazy(() => import('@/components/liri/live/LiveAlertBanner'));
// Coque mobile « type app » (MobileReelsShell) SUPPRIMÉE : LIRI = web responsive + natif Expo.
import { isSupabaseConfigured } from '@/lib/supabase';

// --- Core Pages ---
const OwnerFormationBuilder = lazy(() => import('@/components/school/formations/OwnerFormationBuilder'));
const CreatorDashboardShell = lazy(() => import('@/pages/creator/CreatorDashboardShell'));
const CoursePlayerInterface = lazy(() => import('@/components/school/formations/CoursePlayerInterface'));
const MasterclassRoomPage = lazy(() => import('@/pages/school/MasterclassRoomPage'));
const MasterclassesListPage = lazy(() => import('@/pages/school/MasterclassesListPage'));
const ClassesAdminPage = lazy(() => import('@/pages/school/ClassesAdminPage'));
const CourseUnlockAdminPage = lazy(() => import('@/pages/school/CourseUnlockAdminPage'));
const StudentNotebook = lazy(() => import('@/components/school/student/StudentNotebook'));
const PublicFormationsPage = lazy(() => import('@/pages/school/PublicFormationsPage'));
const FormationDetailPage = lazy(() => import('@/pages/school/FormationDetailPage'));
const LivesLibraryPage = lazy(() => import('@/pages/liri/LivesLibraryPage'));
const MessagingPage = lazy(() => import('@/pages/MessagingPage'));

// --- Classroom Pages ---
const ClassroomPage = lazy(() => import('@/pages/school/ClassroomPage'));
const ClassroomArchivePage = lazy(() => import('@/pages/school/ClassroomArchivePage'));
const LiveClassesPage = lazy(() => import('@/pages/school/LiveClassesPage'));
const LiveClassroomPage = lazy(() => import('@/pages/school/LiveClassroomPage'));
const VideoFormationsPage = lazy(() => import('@/pages/school/VideoFormationsPage'));
const VideoPlayerPage = lazy(() => import('@/pages/VideoPlayerPage'));
const FormationForumPage = lazy(() => import('@/pages/school/FormationForumPage'));
const LessonPlayerPage = lazy(() => import('@/pages/school/LessonPlayerPage'));
const KnowledgeBaseManager = lazy(() => import('@/pages/KnowledgeBaseManager')); // --- Student School Life (NEW) ---
const StudentSchoolLifePage = lazy(() => import('@/pages/school/student-school-life/StudentSchoolLifePage'));
const StudentWeeklySchedulePage = lazy(() => import('@/pages/school/student-school-life/StudentWeeklySchedulePage'));
// Provider de thème de l'espace élève (student-school-life). Sert à FORCER le CLAIR sur les
// routes standalone hors-shell (ex. /student-school-life/semaine-courante) : ces pages sont
// désormais host-aware (défaut SOMBRE = portail LIRI), donc le clair legacy est opt-in ici.
import { SslThemeProvider } from '@/pages/school/student-school-life/sslTheme';
const StudentDashboardPage = lazy(() => import('@/pages/school/StudentDashboardPage'));
// ISNA Academy embarqué dans LIRI : pages école montées sous /liri/* (LiriSchoolShell).
const LiriSchoolShell = lazy(() => import('@/pages/liri/LiriSchoolShell'));
const StudentFormationsPage = lazy(() => import('@/pages/school/student-school-life/StudentFormationsPage'));
// « Mes formations » rendu par le moteur OS Cimolace (immersif, branché sur les données de cours).
const StudentFormationsOsPage = lazy(() => import('@/pages/school/student-school-life/StudentFormationsOsPage'));
const StudentAgendaPage = lazy(() => import('@/pages/school/student-school-life/StudentAgendaPage'));
const StudentNotesPage = lazy(() => import('@/pages/school/student-school-life/StudentNotesPage'));
// Hub « Mes notes » (prise de notes multi-source) — remplace le bulletin sur /liri/notes ;
// le bulletin/grades vit désormais dans « Évals ».
const StudentNotesHubPage = lazy(() => import('@/pages/school/student-school-life/StudentNotesHubPage'));
const StudentEvaluationsPage = lazy(() => import('@/pages/school/student-school-life/StudentEvaluationsPage'));
const StudentAbsencesPage = lazy(() => import('@/pages/school/student-school-life/StudentAbsencesPage'));
const StudentDocumentsPage = lazy(() => import('@/pages/school/student-school-life/StudentDocumentsPage'));
const StudentProfilePage = lazy(() => import('@/pages/school/student-school-life/StudentProfilePage'));
const StudentNeuroRecallPage = lazy(() => import('@/pages/school/student-school-life/StudentNeuroRecallPage'));
const LiriBookReaderPage = lazy(() => import('@/pages/liri/LiriBookReaderPage'));
const StudentEnrollmentOnboardingPage = lazy(() => import('@/pages/school/student-school-life/StudentEnrollmentOnboardingPage'));
const OnboardingPage = lazy(() => import('@/pages/OnboardingPage'));
const NgowazuluIntakePage = lazy(() => import('@/pages/ngowazulu/NgowazuluIntakePage'));
const NgowazuluTemplePage = lazy(() => import('@/pages/ngowazulu/NgowazuluTemplePage'));
const ProspectInterviewLoungePage = lazy(() => import('@/pages/ProspectInterviewLoungePage')); // --- New Formation & Pricing Pages ---
const FormationsPage = lazy(() => import('@/pages/school/FormationsPage')); // New Page
const HomePage = lazy(() => import('@/pages/HomePage'));
const LandingPage = lazy(() => import('@/pages/LandingPage'));
const MaquetteHero04 = lazy(() => import('@/pages/MaquetteHero04'));
const MaquetteCosmos = lazy(() => import('@/pages/MaquetteCosmos'));
const MaquetteFondateur = lazy(() => import('@/pages/MaquetteFondateur'));
const MaquetteMission = lazy(() => import('@/pages/MaquetteMission'));
const MaquetteProgramme = lazy(() => import('@/pages/MaquetteProgramme'));
const MaquetteTemple = lazy(() => import('@/pages/MaquetteTemple'));
const MaquetteEcole = lazy(() => import('@/pages/MaquetteEcole'));

// ── Vitrines tenant (multi-tenant) ──────────────────────────────────────────
// Un tenant peut avoir une vitrine narrative dédiée ; sinon on rend la vitrine
// générique (SchoolVitrineTenantPage). `isna` = vitrine PRORASCIENCE (Maquette*).
// Le ROUTAGE devient générique (/t/:slug) ; le CONTENU reste propre au tenant.
// Pour un nouveau tenant à vitrine dédiée : ajouter une entrée ici (zéro route en dur).
// Cf. docs/CIMOLACE_ARCHITECTURE.md §7.
const TENANT_VITRINES = {
  isna: {
    home: MaquetteHero04,
    pages: {
      ecole: MaquetteEcole,
      temple: MaquetteTemple,
      programme: MaquetteProgramme,
      mission: MaquetteMission,
      fondateur: MaquetteFondateur,
      doctrine: MaquetteCosmos,
    },
  },
};
TENANT_VITRINES.prorascience = TENANT_VITRINES.isna;

function TenantVitrineHome({ slug: slugProp } = {}) {
  const { tenantSlug } = useParams();
  const slug = canonicalTenantSlug(slugProp || tenantSlug);
  const Comp = TENANT_VITRINES[slug]?.home;
  return Comp ? <Comp /> : <SchoolVitrineTenantPage />;
}

function TenantVitrinePage({ slug: slugProp, page: pageProp } = {}) {
  const { tenantSlug, vitrinePage } = useParams();
  const slug = canonicalTenantSlug(slugProp || tenantSlug);
  const page = String(pageProp || vitrinePage || '').toLowerCase();
  const entry = TENANT_VITRINES[slug];
  const Comp = entry?.pages?.[page];
  // Domaine custom (slug forcé via prop) : pas de retour vers /t/:slug → racine propre.
  return Comp ? <Comp /> : <Navigate to={slugProp ? '/' : `/t/${tenantSlug}`} replace />;
}
const PublicHomePage = lazy(() => import('@/pages/PublicHomePage'));
import { ELEVE_MOBILE } from '@/lib/eleveMobileRoutes';
const PublicIsnaPage = lazy(() => import('@/pages/PublicIsnaPage'));
const PublicNgowazuluPage = lazy(() => import('@/pages/PublicNgowazuluPage'));
const AppMemberAccessPage = lazy(() => import('@/pages/AppMemberAccessPage'));

// --- CIMOLACE Back-Office & Client Dashboard ---
const CimolaceAdminDashboard = lazy(() => import('@/pages/cimolace/admin/index'));
const CimolaceAdminClients = lazy(() => import('@/pages/cimolace/admin/clients/index'));
const CimolaceAdminClientDetail = lazy(() => import('@/pages/cimolace/admin/clients/[id]'));
const CimolaceAdminSites = lazy(() => import('@/pages/cimolace/admin/sites/index'));
const CimolaceAdminBilling = lazy(() => import('@/pages/cimolace/admin/billing/index'));
const CimolaceAdminSupport = lazy(() => import('@/pages/cimolace/admin/support/index'));
const CimolaceClientDashboard = lazy(() => import('@/pages/cimolace/client/[clientSlug]/index'));
/** Anciennes URL `/m/liri/post-live/:sessionId` → fiche fin de session app élève */
function LiriLegacyPostLiveBySessionRedirect() {
  const { sessionId } = useParams();
  const to = sessionId
    ? `${ELEVE_MOBILE.liveTermine}?${new URLSearchParams({ session: String(sessionId) })}`
    : ELEVE_MOBILE.liveTermine;
  return <Navigate to={to} replace />;
}

// --- Mobile Élève (LIRI Student native app) ---
const EleveHomeScreen = lazy(() => import('@/pages/school/eleve-mobile/EleveHomeScreen'));
const EleveLiveScreen = lazy(() => import('@/pages/school/eleve-mobile/EleveLiveScreen'));
const EleveLiveLoadingScreen = lazy(() => import('@/pages/school/eleve-mobile/EleveLiveLoadingScreen'));
const EleveLiveAccessDeniedScreen = lazy(() => import('@/pages/school/eleve-mobile/EleveLiveAccessDeniedScreen'));
const EleveLiveTermineScreen = lazy(() => import('@/pages/school/eleve-mobile/EleveLiveTermineScreen'));
const EleveLiveWaitingScreen = lazy(() => import('@/pages/school/eleve-mobile/EleveLiveWaitingScreen'));
const EleveLiveSessionChatScreen = lazy(() => import('@/pages/school/eleve-mobile/EleveLiveSessionChatScreen'));
const EleveLiveRoomShellMaquette = lazy(() => import('@/pages/school/eleve-mobile/EleveLiveRoomShellMaquette'));
const EleveLiveRoomImmersiveAlpha = lazy(() => import('@/pages/school/eleve-mobile/EleveLiveRoomImmersiveAlpha'));
const LiriMobileHostView = lazy(() => import('@/pages/school/eleve-mobile/LiriMobileHostView'));
const EleveCoursePage = lazy(() => import('@/pages/school/eleve-mobile/EleveCoursePage'));
const EleveBillingCheckoutScreen = lazy(() => import('@/pages/school/eleve-mobile/EleveBillingCheckoutScreen'));
const EleveCheckoutSuccessScreen = lazy(() => import('@/pages/school/eleve-mobile/EleveCheckoutSuccessScreen'));
const EleveBibliothequeScreen = lazy(() => import('@/pages/school/eleve-mobile/EleveBibliothequeScreen'));
const EleveCommunauteScreen = lazy(() => import('@/pages/school/eleve-mobile/EleveCommunauteScreen'));
const EleveProfileScreen = lazy(() => import('@/pages/school/eleve-mobile/EleveProfileScreen'));
const EleveClasseScreen = lazy(() => import('@/pages/school/eleve-mobile/EleveClasseScreen'));
const EleveMessagesScreen = lazy(() => import('@/pages/school/eleve-mobile/EleveMessagesScreen'));
const EleveMessagesNewScreen = lazy(() => import('@/pages/school/eleve-mobile/EleveMessagesNewScreen'));
const EleveMessageThreadScreen = lazy(() => import('@/pages/school/eleve-mobile/EleveMessageThreadScreen'));
const EleveNeuronScreen = lazy(() => import('@/pages/school/eleve-mobile/EleveNeuronScreen'));
const EleveReplaysScreen = lazy(() => import('@/pages/school/eleve-mobile/EleveReplaysScreen'));
const EleveAgendaScreen = lazy(() => import('@/pages/school/eleve-mobile/EleveAgendaScreen'));
const EleveCalendrierAnnuelScreen = lazy(() => import('@/pages/school/eleve-mobile/EleveCalendrierAnnuelScreen'));
const EleveEspaceEnLigneScreen = lazy(() => import('@/pages/school/eleve-mobile/EleveEspaceEnLigneScreen'));
const EleveEtudiantDashboardScreen = lazy(() => import('@/pages/school/eleve-mobile/etudiantParity/EleveEtudiantDashboardScreen'));
const EleveEtudiantFormationsScreen = lazy(() => import('@/pages/school/eleve-mobile/etudiantParity/EleveEtudiantFormationsScreen'));
const EleveEtudiantEvaluationsScreen = lazy(() => import('@/pages/school/eleve-mobile/etudiantParity/EleveEtudiantEvaluationsScreen'));
const EleveEtudiantNotesScreen = lazy(() => import('@/pages/school/eleve-mobile/etudiantParity/EleveEtudiantNotesScreen'));
const EleveEtudiantAbsencesScreen = lazy(() => import('@/pages/school/eleve-mobile/etudiantParity/EleveEtudiantAbsencesScreen'));
const EleveEtudiantDocumentsScreen = lazy(() => import('@/pages/school/eleve-mobile/etudiantParity/EleveEtudiantDocumentsScreen'));
const EleveVieScolaireLayout = lazy(() => import('@/pages/school/eleve-mobile/vieScolaire/EleveVieScolaireLayout'));
const EleveVieScolaireApercuTab = lazy(() => import('@/pages/school/eleve-mobile/vieScolaire/EleveVieScolaireApercuTab'));
const EleveVieScolaireCalendrierTab = lazy(() => import('@/pages/school/eleve-mobile/vieScolaire/EleveVieScolaireCalendrierTab'));
const EleveVieScolaireResultatsTab = lazy(() => import('@/pages/school/eleve-mobile/vieScolaire/EleveVieScolaireResultatsTab'));
const EleveVieScolaireAnnoncesTab = lazy(() => import('@/pages/school/eleve-mobile/vieScolaire/EleveVieScolaireAnnoncesTab'));
const EleveModulesForfaitsScreen = lazy(() => import('@/pages/school/eleve-mobile/EleveModulesForfaitsScreen'));
const EleveModulesScreen = lazy(() => import('@/pages/school/eleve-mobile/EleveModulesScreen'));
const EleveForfaitsScreen = lazy(() => import('@/pages/school/eleve-mobile/EleveForfaitsScreen'));
const EleveBoutiqueSacreeScreen = lazy(() => import('@/pages/school/eleve-mobile/EleveBoutiqueSacreeScreen'));
const EleveProrascienceVitrineScreen = lazy(() => import('@/pages/school/eleve-mobile/EleveProrascienceVitrineScreen'));
const Ecoles21SciencesMobileScreen = lazy(() => import('@/pages/school/eleve-mobile/Ecoles21SciencesMobileScreen'));
const VitrineAboutMobileScreen = lazy(() => import('@/pages/school/eleve-mobile/ProrascienceVitrineMobileScreens').then(m => ({ default: m.VitrineAboutMobileScreen })));
const VitrineCoachingMobileScreen = lazy(() => import('@/pages/school/eleve-mobile/ProrascienceVitrineMobileScreens').then(m => ({ default: m.VitrineCoachingMobileScreen })));
const VitrineCoachingVsMentoratMobileScreen = lazy(() => import('@/pages/school/eleve-mobile/ProrascienceVitrineMobileScreens').then(m => ({ default: m.VitrineCoachingVsMentoratMobileScreen })));
const VitrineCommunauteMobileScreen = lazy(() => import('@/pages/school/eleve-mobile/ProrascienceVitrineMobileScreens').then(m => ({ default: m.VitrineCommunauteMobileScreen })));
const VitrineContactMobileScreen = lazy(() => import('@/pages/school/eleve-mobile/ProrascienceVitrineMobileScreens').then(m => ({ default: m.VitrineContactMobileScreen })));
const VitrineEquipeMobileScreen = lazy(() => import('@/pages/school/eleve-mobile/ProrascienceVitrineMobileScreens').then(m => ({ default: m.VitrineEquipeMobileScreen })));
const VitrineFaqMobileScreen = lazy(() => import('@/pages/school/eleve-mobile/ProrascienceVitrineMobileScreens').then(m => ({ default: m.VitrineFaqMobileScreen })));
const VitrineFondateurMobileScreen = lazy(() => import('@/pages/school/eleve-mobile/ProrascienceVitrineMobileScreens').then(m => ({ default: m.VitrineFondateurMobileScreen })));
const VitrineForfaitsMobileScreen = lazy(() => import('@/pages/school/eleve-mobile/ProrascienceVitrineMobileScreens').then(m => ({ default: m.VitrineForfaitsMobileScreen })));
const VitrineFormationsMobileScreen = lazy(() => import('@/pages/school/eleve-mobile/ProrascienceVitrineMobileScreens').then(m => ({ default: m.VitrineFormationsMobileScreen })));
const VitrineMentoratMobileScreen = lazy(() => import('@/pages/school/eleve-mobile/ProrascienceVitrineMobileScreens').then(m => ({ default: m.VitrineMentoratMobileScreen })));
const EleveChooseAccountTypeScreen = lazy(() => import('@/pages/school/eleve-mobile/EleveChooseAccountTypeScreen'));
const EleveAppointmentRequestScreen = lazy(() => import('@/pages/school/eleve-mobile/EleveAppointmentRequestScreen'));
const EleveVersionScreen = lazy(() => import('@/pages/school/eleve-mobile/EleveVersionScreen'));
const VersionPage = lazy(() => import('@/pages/VersionPage'));
const EleveConnectionWelcome = lazy(() => import('@/pages/school/eleve-mobile/connection/EleveConnectionWelcome'));
const EleveConnectionLien = lazy(() => import('@/pages/school/eleve-mobile/connection/EleveConnectionLien'));
const EleveConnectionCode = lazy(() => import('@/pages/school/eleve-mobile/connection/EleveConnectionCode'));
const EleveSignupMobile = lazy(() => import('@/pages/school/eleve-mobile/connection/EleveSignupMobile'));
const EleveNotificationsScreen = lazy(() => import('@/pages/school/eleve-mobile/EleveNotificationsScreen'));
import EleveNoStudioGuard from '@/components/eleve-mobile/EleveNoStudioGuard';
const EleveMobileRouteShell = lazy(() => import('@/components/eleve-mobile/EleveMobileRouteShell'));

// ── LIRI Embed (iframe, pas de shell, pas d'auth) ─────────────────────────────
const LiveEmbedPage = lazy(() => import('@/pages/embed/LiveEmbedPage'));
const LiveEmbedStudioPage = lazy(() => import('@/pages/embed/LiveEmbedStudioPage'));
const MboloStorefrontEmbedPage = lazy(() => import('@/pages/embed/MboloStorefrontEmbedPage'));

// --- Other Pages ---
const NotificationCenter = lazy(() => import('@/pages/NotificationCenter'));
const NotificationSettings = lazy(() => import('@/pages/NotificationSettings'));
const SupportPage = lazy(() => import('@/pages/SupportPage'));
const StudentSessionBooking = lazy(() => import('@/pages/school/StudentSessionBooking'));
const StudentWorkshopRegistration = lazy(() => import('@/pages/school/StudentWorkshopRegistration'));
const ReportsPage = lazy(() => import('@/pages/ReportsPage'));
const SettingsPage = lazy(() => import('@/pages/SettingsPage'));
const TwoFASetupPage = lazy(() => import('@/pages/TwoFASetupPage'));
const StudentCertificatesPage = lazy(() => import('@/pages/school/StudentCertificatesPage')); // --- Existing Pages ---
const SecretariatPage = lazy(() => import('@/pages/SecretariatPage'));
const SchoolVitrinePage = lazy(() => import('@/pages/school/SchoolVitrinePage'));
const SchoolVitrineTenantPage = lazy(() => import('@/pages/school/SchoolVitrineTenantPage'));
const PaiementPage = lazy(() => import('@/pages/school/PaiementPage'));
const TenantServicesVitrine = lazy(() => import('@/pages/marketplace/TenantServicesVitrine'));
const TenantReservationPage = lazy(() => import('@/pages/marketplace/TenantReservationPage'));
const ActivateAccountPage = lazy(() => import('@/pages/school/ActivateAccountPage'));
const LiveJoinPage = lazy(() => import('@/pages/school/LiveJoinPage'));
const LiveJoinLinksPage = lazy(() => import('@/pages/school/LiveJoinLinksPage'));
const SchoolBillingPage = lazy(() => import('@/pages/school/SchoolBillingPage'));
const SchoolGoogleCallback = lazy(() => import('@/pages/school/SchoolGoogleCallback'));
const SchoolAdminDashboard = lazy(() => import('@/pages/school/SchoolAdminDashboard'));
const SchoolCoursesPage = lazy(() => import('@/pages/school/SchoolCoursesPage'));
const TenantAdminLivesPage = lazy(() => import('@/pages/tenant/TenantAdminLivesPage'));
const TenantAdminSmartboardPage = lazy(() => import('@/pages/tenant/TenantAdminSmartboardPage'));
const TenantAdminMarketingPage = lazy(() => import('@/pages/tenant/TenantAdminMarketingPage'));
const TenantAdminStudioPage = lazy(() => import('@/pages/tenant/TenantAdminStudioPage'));
const TenantAdminNeuroRecallPage = lazy(() => import('@/pages/tenant/TenantAdminNeuroRecallPage'));
const TenantAdminAiBillingPage = lazy(() => import('@/pages/tenant/TenantAdminAiBillingPage'));
const TenantAdminCalendarPage = lazy(() => import('@/pages/tenant/TenantAdminCalendarPage'));
const TenantAdminChatPage = lazy(() => import('@/pages/tenant/TenantAdminChatPage'));
const TenantAdminNotificationsPage = lazy(() => import('@/pages/tenant/TenantAdminNotificationsPage'));
const ProrascienceCommercialPage = lazy(() => import('@/pages/ProrascienceCommercialPage'));
const CimolaceLanding = lazy(() => import('@/pages/CimolaceLanding'));
const CimolaceOsDetail = lazy(() => import('@/pages/CimolaceOsDetail'));
const CimolaceLoginPage = lazy(() => import('@/pages/CimolaceLoginPage'));
const CimolaceAboutPage = lazy(() => import('@/pages/CimolaceAboutPage'));
const CimolaceSolutionsPage = lazy(() => import('@/pages/CimolaceSolutionsPage'));
const CimolaceSolutionDetailPage = lazy(() => import('@/pages/CimolaceSolutionDetailPage'));
const CimolaceSolutionStoryPage = lazy(() => import('@/pages/CimolaceSolutionStoryPage'));
const VirtuelMboloPage = lazy(() => import('@/pages/cimolace/VirtuelMboloPage'));
const VirtuelMboloStarterPage = lazy(() => import('@/pages/cimolace/VirtuelMboloStarterPage'));
const VirtuelMboloProPage = lazy(() => import('@/pages/cimolace/VirtuelMboloProPage'));
const VirtuelMboloElitePage = lazy(() => import('@/pages/cimolace/VirtuelMboloElitePage'));
const VirtuelMboloPaymentPage = lazy(() => import('@/pages/cimolace/VirtuelMboloPaymentPage'));
const VirtuelMboloPaymentSuccessPage = lazy(() => import('@/pages/cimolace/VirtuelMboloPaymentSuccessPage'));
const VirtuelMboloDashboardPage = lazy(() => import('@/pages/cimolace/VirtuelMboloDashboardPage'));
const VirtuelMboloBookingPage = lazy(() => import('@/pages/cimolace/VirtuelMboloBookingPage'));
const VirtuelMboloSubscriptionPage = lazy(() => import('@/pages/cimolace/VirtuelMboloSubscriptionPage'));
const CimolaceBillingDashboardPage = lazy(() => import('@/pages/cimolace/CimolaceBillingDashboardPage'));
const CimolaceConfigurator = lazy(() => import('@/pages/CimolaceConfigurator'));
const CimolaceRouter = lazy(() => import('@/components/cimolace/CimolaceRouter'));
const ProrascienceAppleStoryLandingLazy = lazy(() => import('@/pages/ProrascienceAppleStoryLanding'));
const ProrascienceAppleStoryV3Lazy = lazy(() => import('@/pages/ProrascienceAppleStoryV3'));
const IsnaProPage = lazy(() => import('@/pages/IsnaProPage'));
const LoginPage = lazy(() => import('@/pages/LoginPage'));
const SignupPage = lazy(() => import('@/pages/SignupPage'));
const OnboardingOrgPage = lazy(() => import('@/pages/OnboardingOrgPage'));
const CimolaceCreationAgent = lazy(() => import('@/pages/CimolaceCreationAgent'));
const LiriLandingPage = lazy(() => import('@/pages/LiriLandingPage'));
const JoinOrgPage = lazy(() => import('@/pages/JoinOrgPage'));
const ForgotPasswordPage = lazy(() => import('@/pages/ForgotPasswordPage'));
const UpdatePasswordPage = lazy(() => import('@/pages/UpdatePasswordPage'));
const OwnerDashboard = lazy(() => import('@/pages/OwnerDashboard'));
// Sous-pages du forum riche (mêmes composants que l'espace élève) pour l'admin.
const ForumThreadPage = lazy(() => import('@/pages/school/student-school-life/ForumThreadPage'));
const ForumNewQuestionPage = lazy(() => import('@/pages/school/student-school-life/ForumNewQuestionPage'));
// Redirige /owner-dashboard/forum → onglet forum EN PRÉSERVANT la query (?ctab, ?to) :
// le bouton « Discuter » d'un fil peut ainsi ouvrir l'onglet Messagerie du shell avec le destinataire.
function OwnerForumIndexRedirect() {
  const [sp] = useSearchParams();
  const q = sp.toString();
  return <Navigate to={`/owner-dashboard?tab=forum${q ? `&${q}` : ''}`} replace />;
}
// Back-office UNIFIÉ : /owner-dashboard (vieux shell séparé « style isna ») → onglet
// École du portail LIRI (/liri/ecole), en préservant la query (?tab=…&finance=…).
// Le back-office est désormais embarqué dans le portail → on ne monte plus le shell séparé.
function OwnerDashboardLegacyRedirect() {
  const [sp] = useSearchParams();
  const q = sp.toString();
  return <Navigate to={`/liri/ecole${q ? `?${q}` : ''}`} replace />;
}

// RETRAIT ACADEMY (tâche E) : l'ancien back-office `/t/:slug/admin*` (shell séparé
// « Administration École ») est REMPLACÉ par le portail LIRI. `/liri/ecole` rend le
// MÊME moteur (OwnerDashboardBody, ~24 onglets) → parité totale. On redirige donc toute
// la surface `/t/:slug/admin*` vers l'onglet équivalent de `/liri/ecole` (?tab=<id>).
// Une seule route `/t/:slug/admin/*` couvre le landing + tous les sous-chemins (RRv6).
const ACADEMY_TAB_MAP = {
  '': 'dashboard',
  billing: 'payments',
  'ai-billing': 'payments',
  settings: 'settings',
  members: 'users',
  students: 'users',
  courses: 'formations',
  'parcours-scolaires': 'school-life',
  calendar: 'school-life',
  chat: 'forum',
  notifications: 'notifications',
};
function AcademyToLiriRedirect() {
  const params = useParams();
  const sub = String(params['*'] || '').split('/')[0];
  const tab = ACADEMY_TAB_MAP[sub] || 'dashboard';
  return <Navigate to={tab === 'dashboard' ? '/liri/ecole' : `/liri/ecole?tab=${tab}`} replace />;
}

// FORFAITS : l'ancienne vitrine standalone « Prorascience PORTAIL » (/forfaits) est retirée.
//  • MEMBRE connecté → forfaits DANS le portail LIRI (/liri/forfaits, coque + rail), en
//    préservant ?plan= (présélection depuis l'agent immersif).
//  • VISITEUR → on rend les MÊMES offres mais SANS le header vitrine « PORTAIL » (retiré via
//    hideHeaderRoutes) : page focalisée conversion + checkout invité intact. La découverte des
//    forfaits pour un visiteur se fait dans l'agent immersif (prorascience.org).
function ForfaitsGateRedirect() {
  const { user, loading } = useAuth();
  const [sp] = useSearchParams();
  const q = sp.toString();
  if (loading) return <div style={{ minHeight: '100vh', background: '#262624' }} />;
  if (user) return <Navigate to={`/liri/forfaits${q ? `?${q}` : ''}`} replace />;
  return <ForfaitsPage />;
}

// NGOWAZULU standalone → portail LIRI (retrait Academy). Le Temple (/ngowazulu) était déjà
// membre-only → redirection directe vers /liri/temple (en préservant la section). La Boutique
// (/boutique-sacree) est publique → membre vers /liri/boutique, visiteur garde la page publique.
function NgowazuluTempleRedirect() {
  const { section } = useParams();
  return <Navigate to={section ? `/liri/temple/${section}` : '/liri/temple'} replace />;
}
function BoutiqueGateRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ minHeight: '100vh', background: '#262624' }} />;
  if (user) return <Navigate to="/liri/boutique" replace />;
  return <BoutiquePage />;
}

// /student-school-life = ancien espace élève « legacy » (mêmes composants que /liri les enveloppe).
// On le retire du WEB en mappant chaque onglet vers son équivalent /liri (y compris les 4 ex-orphelines
// qui ont désormais un home /liri). VARIANT MOBILE NATIF (`VITE_APP_VARIANT=eleve`) : on GARDE l'espace
// legacy — l'app hardcode ces chemins (EleveMobileRouteShell). Onglets sans équivalent (forum/formation,
// forum/topic) → rendu legacy conservé (fail-safe, aucune perte).
const SSLIFE_SIMPLE = {
  '': '/liri', dashboard: '/liri', formations: '/liri/formations', agenda: '/liri/agenda',
  evaluations: '/liri/evaluations', notes: '/liri/notes', absences: '/liri/absences',
  documents: '/liri/documents', 'vie-scolaire': '/liri/vie-scolaire', profile: '/liri/profil',
  'neuro-recall': '/liri/neuro-recall', 'bibliotheque-ressources': '/liri/bibliotheque-ressources',
};
function sslifeTarget(splat) {
  const parts = String(splat || '').split('/').filter(Boolean);
  const p0 = parts[0] || 'dashboard';
  const rest = parts.slice(1).join('/');
  if (!rest && SSLIFE_SIMPLE[p0] !== undefined) return SSLIFE_SIMPLE[p0];
  if (p0 === 'cours' && rest) return `/liri/cours/${rest}`;
  if (p0 === 'bibliotheque') return rest ? `/liri/bibliotheque/${rest}` : '/liri/bibliotheque';
  if (p0 === 'forum') {
    if (!rest) return '/liri/forum';
    if (rest === 'new') return '/liri/forum/new';
    if (rest.startsWith('thread/')) return `/liri/forum/${rest}`;
    return null; // forum/formation, forum/topic : pas d'équivalent /liri → garder legacy
  }
  return null;
}
function StudentSchoolLifeGate() {
  const params = useParams();
  if (import.meta.env.VITE_APP_VARIANT === 'eleve') return <StudentSchoolLifePage />;
  const target = sslifeTarget(params['*']);
  if (target) return <Navigate to={target} replace />;
  return <StudentSchoolLifePage />;
}
// Le Montage post-prod appartient au STUDIO LIRI (dans le portail). L'ancienne route
// /owner-dashboard/* résout le tenant et renvoie vers son domaine (ex. prorascience.org
// = chrome ISNA Academy externe) → on redirige vers /studio, en préservant le contentId.
function OwnerPostProdRedirect() {
  const { contentId } = useParams();
  const [sp] = useSearchParams();
  const q = sp.toString();
  return <Navigate to={`/studio/post-production/${contentId}${q ? `?${q}` : ''}`} replace />;
}
const TenantAdminPayoutSettingsPage = lazy(() => import('@/pages/tenant/TenantAdminPayoutSettingsPage'));
const TenantMembersPage = lazy(() => import('@/pages/tenant/TenantMembersPage'));
const ClientProfilePage = lazy(() => import('@/components/accompaniment/ClientProfilePage'));
const ProductsPage = lazy(() => import('@/pages/ProductsPage'));
const ProductDetailPage = lazy(() => import('@/pages/ProductDetailPage'));
const CheckoutSuccessPage = lazy(() => import('@/pages/CheckoutSuccessPage'));
const IsnaProductsIndexPage = lazy(() => import('@/pages/IsnaProductsIndexPage'));
const IsnaProductStoryPage = lazy(() => import('@/pages/IsnaProductStoryPage'));

// Legacy Pages
const CurriculumPage = lazy(() => import('@/pages/CurriculumPage'));
const ModuleDetailPage = lazy(() => import('@/pages/ModuleDetailPage')); 
const MentoringPage = lazy(() => import('@/pages/MentoringPage'));
const CoachingPage = lazy(() => import('@/pages/CoachingPage'));
const MentoringVsCoachingPage = lazy(() => import('@/pages/MentoringVsCoachingPage'));
const EcolesProrasciencePage = lazy(() => import('@/pages/EcolesProrasciencePage'));
const DoctrinePedagogiquePage = lazy(() => import('@/pages/DoctrinePedagogiquePage'));
const OrigineAppelPage = lazy(() => import('@/pages/OrigineAppelPage'));
const FondDeToutPage = lazy(() => import('@/pages/FondDeToutPage'));
const DialoguePhysiquePage = lazy(() => import('@/pages/DialoguePhysiquePage'));
const OntodynamiquePage = lazy(() => import('@/pages/OntodynamiquePage'));
const BibliothequePage = lazy(() => import('@/pages/BibliothequePage'));
const LibraryPage = lazy(() => import('@/pages/LibraryPage'));
const ManuelInitiatiqueBrisDeSortPage = lazy(() => import('@/pages/ManuelInitiatiqueBrisDeSortPage'));
const CommunautePage = lazy(() => import('@/pages/CommunautePage'));
const AuthCallbackPage = lazy(() => import('@/pages/AuthCallbackPage'));
const PedagogicalFollowUpPage = lazy(() => import('@/pages/PedagogicalFollowUpPage'));
const EmotionalSupportPage = lazy(() => import('@/pages/EmotionalSupportPage'));
const SchoolLifePage = lazy(() => import('@/pages/school/SchoolLifePage'));
const ResourcesPage = lazy(() => import('@/pages/ResourcesPage'));
const FormationCatalogPage = lazy(() => import('@/pages/school/FormationCatalogPage'));
const FormationRegistrationPage = lazy(() => import('@/pages/school/FormationRegistrationPage'));
const MyFormationsPage = lazy(() => import('@/pages/school/MyFormationsPage'));
const BillingPage = lazy(() => import('@/pages/BillingPage'));
const ForfaitsPage = lazy(() => import('@/pages/ForfaitsPage'));
const PaymentActionPage = lazy(() => import('@/pages/PaymentActionPage'));
const MyProfilePage = lazy(() => import('@/pages/MyProfilePage'));
const EditProfilePage = lazy(() => import('@/pages/EditProfilePage'));
const SettingsPageUserProfile = lazy(() => import('@/pages/SettingsPage'));
const CertificatesPage = lazy(() => import('@/pages/school/CertificatesPage'));
const BillingCheckoutPage = lazy(() => import('@/pages/BillingCheckoutPage'));
const LicenseActivationPage = lazy(() => import('@/pages/LicenseActivationPage'));
const RedeemPrivilegedLinkPage = lazy(() => import('@/pages/RedeemPrivilegedLinkPage'));
const DashboardInfrastructure = lazy(() => import('@/pages/DashboardInfrastructure').then((m) => ({ default: m.DashboardInfrastructure })));
const DashboardInfrastructures = lazy(() => import('@/pages/DashboardInfrastructures').then((m) => ({ default: m.DashboardInfrastructures })));
const MedosDashboard = lazy(() => import('@/pages/MedosDashboard').then((m) => ({ default: m.MedosDashboard })));
const MedosPatients = lazy(() => import('@/pages/MedosPatients').then((m) => ({ default: m.MedosPatients })));
const MedosPatientDetail = lazy(() => import('@/pages/MedosPatientDetail').then((m) => ({ default: m.MedosPatientDetail })));
const MedosPatientPortal = lazy(() => import('@/pages/MedosPatientPortal').then((m) => ({ default: m.MedosPatientPortal })));
const MboloCatalog = lazy(() => import('@/pages/MboloCatalog').then((m) => ({ default: m.MboloCatalog })));
const MboloOrders = lazy(() => import('@/pages/MboloOrders').then((m) => ({ default: m.MboloOrders })));
const TenantBillingPage = lazy(() => import('@/pages/TenantBillingPage').then((m) => ({ default: m.TenantBillingPage })));
const TenantPayoutsPage = lazy(() => import('@/pages/TenantPayoutsPage').then((m) => ({ default: m.TenantPayoutsPage })));
const AboutProrascience = lazy(() => import('@/pages/AboutProrascience'));
const FounderAboutPage = lazy(() => import('@/pages/FounderAboutPage'));
const TeamPage = lazy(() => import('@/pages/TeamPage'));
const FAQPage = lazy(() => import('@/pages/FAQPage'));
const ContactPage = lazy(() => import('@/pages/ContactPage'));
const TermsPage = lazy(() => import('@/pages/TermsPage'));
const PrivacyPage = lazy(() => import('@/pages/PrivacyPage'));
const LegalPage = lazy(() => import('@/pages/LegalPage'));
const CompanionCapturePage = lazy(() => import('@/pages/CompanionCapturePage'));
const ImmersivePhoneCompanionPage = lazy(() => import('@/pages/liri/live/ImmersivePhoneCompanionPage'));
const LiveMobileCameraPage = lazy(() => import('@/pages/liri/live/LiveMobileCameraPage'));
const BoutiquePage = lazy(() => import('@/pages/BoutiquePage'));
const MboloStorefrontPage = lazy(() => import('@/pages/MboloStorefrontPage'));
const ServicesSpirituelsPage = lazy(() => import('@/pages/ServicesSpirituelsPage'));
const CoursesPage = lazy(() => import('@/pages/school/CoursesPage'));
const TeachersPage = lazy(() => import('@/pages/school/TeachersPage'));
const HowItWorksPage = lazy(() => import('@/pages/HowItWorksPage'));
const CyclesDetailPage = lazy(() => import('@/pages/CyclesDetailPage'));
const AdminDashboardPage = lazy(() => import('@/pages/admin/AdminDashboard'));
const UsersAdminPage = lazy(() => import('@/pages/admin/UsersPage'));
const TenantAdminCoursesPage = lazy(() => import('@/pages/tenant/TenantAdminCoursesPage'));
const TenantAdminStudentsPage = lazy(() => import('@/pages/tenant/TenantAdminStudentsPage'));
const TenantAdminSchoolPathsPage = lazy(() => import('@/pages/tenant/TenantAdminSchoolPathsPage'));
const TenantAdminWeeklyProgramPage = lazy(() => import('@/pages/tenant/TenantAdminWeeklyProgramPage'));
const TenantCourseDetailPage = lazy(() => import('@/pages/tenant/TenantCourseDetailPage'));
const TenantAdminSettingsPage = lazy(() => import('@/pages/tenant/TenantAdminSettingsPage'));
const AuditLogsPage = lazy(() => import('@/pages/admin/AuditLogsPage'));
const AdminPaymentsPage = lazy(() => import('@/pages/admin/PaymentsPage'));
const AdminStudentsPage = lazy(() => import('@/pages/admin/StudentsPage'));
const AdminSettingsPage = lazy(() => import('@/pages/admin/SettingsPage'));
const AdminContentEditorPage = lazy(() => import('@/pages/admin/ContentEditor'));
const AdminBillingPage = lazy(() => import('@/pages/admin/BillingPage'));
const AdminIriBuilderPage = lazy(() => import('@/pages/admin/IriBuilderPage'));
const IriPublicPage = lazy(() => import('@/pages/public/IriPublicPage'));
const AdminCommunitiesPage = lazy(() => import('@/pages/admin/AdminCommunitiesPage'));
const AdminMarketingPage = lazy(() => import('@/pages/admin/AdminMarketingPage'));
const AdminTenantEmbedPage = lazy(() => import('@/pages/admin/AdminTenantEmbedPage'));
const AdminTenantBrandingPage = lazy(() => import('@/pages/admin/AdminTenantBrandingPage'));
const MarketingToolsSuitePage = lazy(() => import('@/pages/admin/MarketingToolsSuitePage'));
const CommunityListPage = lazy(() => import('@/pages/CommunityListPage'));
const CommunityChatPage = lazy(() => import('@/pages/CommunityChatPage'));
const RequestAppointmentPage = lazy(() => import('@/pages/RequestAppointmentPage'));
const LiriRendezVousPage = lazy(() => import('@/pages/liri/LiriRendezVousPage'));
const ImmersiveWaitingRoomPage = lazy(() => import('@/pages/ImmersiveWaitingRoomPage'));
const SatisfactionPage = lazy(() => import('@/pages/SatisfactionPage'));
const ModuleCatalogPageNew = lazy(() => import('@/pages/modules/ModuleCatalogPage'));
const ModuleCartPage = lazy(() => import('@/pages/modules/ModuleCartPage'));
const SecondYearCurriculumPage = lazy(() => import('@/pages/SecondYearCurriculumPage'));
const SecondYearCatalogPage = lazy(() => import('@/pages/SecondYearCatalogPage'));
const PracticeJournalPage = lazy(() => import('@/pages/PracticeJournalPage'));
const CreateOwnerAccountPage = lazy(() => import('@/pages/CreateOwnerAccountPage'));
const VerifyOwnerPage = lazy(() => import('@/pages/VerifyOwnerPage'));
const ChooseAccountTypePage = lazy(() => import('@/pages/ChooseAccountTypePage'));
const TeacherPortalPage = lazy(() => import('@/pages/school/teacher/TeacherPortalPage'));
const MasterclassFactoryPage = lazy(() => import('@/pages/tools/MasterclassFactoryPage'));
const MasterclassFactoryAnalysePage = lazy(() => import('@/pages/tools/MasterclassFactoryAnalysePage'));
const OrchestratorLiveDashboardPage = lazy(() => import('@/app/dashboard/liri/orchestrator-live/page'));
const SmartboardStreamingPage = lazy(() => import('@/app/dashboard/liri/smartboard-stream/page'));
// Chat LIRI Brain (multi-modèles + outils + conversations persistées). Export nommé → default pour lazy().
const DashboardLiri = lazy(() => import('@/pages/liri/DashboardLiri').then((m) => ({ default: m.DashboardLiri })));
// Portail LIRI — accueil/hub (rail Accueil/Lives/Forum/Studio/Biblio/Brain + stats live)
const LiriPortalPage = lazy(() => import('@/pages/liri/LiriPortalPage').then((m) => ({ default: m.LiriPortalPage })));
const LiriAccountPage = lazy(() => import('@/pages/liri/LiriAccountPage'));
const LiriServicesPage = lazy(() => import('@/pages/liri/LiriServicesPage'));
const LiriForfaitsPage = lazy(() => import('@/pages/liri/LiriForfaitsPage'));
const LiriTemplePage = lazy(() => import('@/pages/liri/LiriTemplePage'));
const LiriBoutiquePage = lazy(() => import('@/pages/liri/LiriBoutiquePage'));
const LiriContenuPage = lazy(() => import('@/pages/liri/LiriContenuPage'));
const LiriPagesPage = lazy(() => import('@/pages/liri/LiriPagesPage'));
const LiriFinancesPage = lazy(() => import('@/pages/liri/LiriFinancesPage'));
// Module ÉCOLE HORIZONTAL dans le portail LIRI (vertical = /t/:slug ; ici = app activable dans /liri)
const LiriEcolePage = lazy(() => import('@/pages/liri/LiriEcolePage'));
// Forum CONNECTÉ + messagerie immersive comme app du portail LIRI
const LiriForumPage = lazy(() => import('@/pages/liri/LiriForumPage'));
const LiriMessagesPage = lazy(() => import('@/pages/liri/LiriMessagesPage'));
const LiriStudioHub = lazy(() => import('@/pages/dev/LiriStudioHub'));
const LiriAdminShellDemo = lazy(() => import('@/pages/dev/LiriAdminShellDemo'));
const MasterclassFactoryV2 = lazy(() => import('@/pages/dev/MasterclassFactoryV2'));
const OrchestratorLiveV2 = lazy(() => import('@/pages/dev/OrchestratorLiveV2'));
const SmartboardStreamingV2 = lazy(() => import('@/pages/dev/SmartboardStreamingV2'));
const SmartboardToolPage = lazy(() => import('@/app/dashboard/tools/smartboard/page'));
const StudioRouter = lazy(() => import('@/pages/studio-creator/studio/StudioRouter'));
const StudioLiriRouter = lazy(() => import('@/pages/studio-creator/studio/StudioLiriRouter'));
const LiveHostPageNativeGate = lazy(() => import('@/components/eleve-mobile/LiveHostPageNativeGate'));
const LiveGuestPage = lazy(() => import('@/pages/liri/LiveGuestPage'));
const ProcheRoom = lazy(() => import('@/pages/liri/ProcheRoom'));
const LiveInvitePage = lazy(() => import('@/pages/liri/LiveInvitePage'));
const TeleconsultJoinPage = lazy(() => import('@/pages/liri/TeleconsultJoinPage'));
const DevLiriHostEntry = lazy(() => import('@/pages/dev/DevLiriHostEntry'));
const TableauVivantDemoPage = lazy(() => import('@/pages/dev/TableauVivantDemoPage'));
const CourseDemoPage = lazy(() => import('@/pages/dev/CourseDemoPage'));
// /precepteur = Le Précepteur DANS le cerveau immersif (coque partagée + présence + « parler à la présence »).
const PrecepteurDemoPage = lazy(() => import('@/pages/precepteur/PrecepteurImmersiveDemo'));
const PrecepteurCoursePage = lazy(() => import('@/pages/precepteur/PrecepteurCoursePage'));
// Le Précepteur ENVELOPPÉ dans le chrome du portail LIRI (LiriPortalShell, rail « École ») —
// même moteur (PrecepteurPlayer) que /precepteur, dual-mode démo + :masterclassId.
const LiriPrecepteurPage = lazy(() => import('@/pages/liri/LiriPrecepteurPage'));
const LiveWaitingRoomPage = lazy(() => import('@/pages/studio-creator/studio/LiveWaitingRoomPage'));
const LiveWaitingRoomMaquettePage = lazy(() => import('@/pages/dev/LiveWaitingRoomMaquettePage'));
const SecretariatPortalPage = lazy(() => import('@/pages/secretariat/SecretariatPortalPage'));
import { getEffectiveRole, hasMultiRoleAccess, getSelectedAccountRole } from '@/lib/accountRoleMode';
import { getChooseAccountTypePath } from '@/lib/chooseAccountTypePath';

// Error boundary qui intercepte les échecs de chargement de chunks lazy (typique Safari après un nouveau déploiement).
// Quand un chunk JS est introuvable le CDN retourne index.html (text/html) → Safari lance une TypeError.
// On force un rechargement de page une seule fois pour récupérer les bons hashes.
class LazyChunkErrorBoundary extends React.Component {
  state = { hasError: false, reloading: false };

  static getDerivedStateFromError(error) {
    if (LazyChunkErrorBoundary.isChunkError(error)) {
      return { hasError: true };
    }
    throw error;
  }

  static isChunkError(error) {
    const msg = error?.message || '';
    return (
      msg.includes('dynamically imported module') ||
      msg.includes('Failed to fetch') ||
      msg.includes('Loading chunk') ||
      error?.name === 'ChunkLoadError'
    );
  }

  componentDidCatch(error) {
    if (!LazyChunkErrorBoundary.isChunkError(error)) return;
    const FLAG = 'chunk_reload_v1';
    if (!sessionStorage.getItem(FLAG)) {
      sessionStorage.setItem(FLAG, '1');
      this.setState({ reloading: true });
      window.location.reload();
    }
  }

  render() {
    if (this.state.reloading) return null;
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-[calc(100dvh-5rem)] gap-4 text-white/60">
          <p className="text-sm">Une mise à jour est disponible.</p>
          <button
            className="text-xs px-4 py-2 rounded-lg border border-white/20 hover:bg-white/10 transition-colors"
            onClick={() => {
              sessionStorage.removeItem('chunk_reload_v1');
              window.location.reload();
            }}
          >
            Recharger la page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const PlaceholderPage = ({ title }) => (
  <div className="min-h-screen bg-[#262624] text-white flex items-center justify-center p-20 text-center">
    <div className="max-w-xl">
      <div className="w-24 h-1 bg-[#d97757] mx-auto rounded-full mb-8"></div>
      <h1 className="text-4xl md:text-5xl font-serif font-bold text-white mb-6">{title}</h1>
      <button onClick={() => window.history.back()} className="px-8 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-white transition-colors">
        Retour
      </button>
    </div>
  </div>
);

const PageLoader = () => (
  <div className="flex flex-1 min-h-[100dvh] w-full items-center justify-center bg-[#262624]">
    <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#d97757] border-t-transparent" />
  </div>
);

const LazyShell = ({ children }) => <Suspense fallback={null}>{children}</Suspense>;

// Cache module (par slug) du statut hébergé/embarqué — évite de re-résoudre à chaque
// passage dans DashboardRedirect. { embedded:boolean, primary_domain:string|null }.
const _embeddedHostCache = new Map();

const DashboardRedirect = () => {
  const { user, loading, tenantRole, supabase: authSupabase } = useAuth();
  const { loading: billingLoading, status, inGrace } = useBilling();
  const [slowLoad, setSlowLoad] = useState(false);
  // Garde-fou « embarqué » : un membre d'un tenant EMBARQUÉ (site propre) qui atterrit
  // CONNECTÉ sur le host NEUTRE LIRI est renvoyé vers SON domaine — jamais de contexte
  // tenant embarqué sur liri.cimolace.space (les deux mondes ne se rencontrent pas).
  const [embeddedGate, setEmbeddedGate] = useState(() => {
    try {
      const host = typeof window !== 'undefined' ? window.location.hostname : '';
      const slug = (authStore.getTenantSlug?.() || '').trim();
      return isPlatformOrDevHost(host) && slug ? 'pending' : 'clear';
    } catch { return 'clear'; }
  });

  useEffect(() => {
    let alive = true;
    const host = typeof window !== 'undefined' ? window.location.hostname : '';
    const slug = (authStore.getTenantSlug?.() || '').trim();
    if (!isPlatformOrDevHost(host) || !slug) { setEmbeddedGate('clear'); return; }
    const apply = (info) => {
      if (!alive) return;
      if (info?.embedded && info?.primary_domain) {
        setEmbeddedGate('redirecting');
        window.location.replace(`https://${info.primary_domain}`);
      } else {
        setEmbeddedGate('clear');
      }
    };
    const cached = _embeddedHostCache.get(slug);
    if (cached) { apply(cached); return () => { alive = false; }; }
    joinApi
      .resolveOrg(slug)
      .then((org) => {
        const info = { embedded: !!org?.embedded, primary_domain: org?.primary_domain || null };
        _embeddedHostCache.set(slug, info);
        apply(info);
      })
      .catch(() => { if (alive) setEmbeddedGate('clear'); });
    return () => { alive = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!loading && !billingLoading) return;
    const t = window.setTimeout(() => setSlowLoad(true), 12000);
    return () => window.clearTimeout(t);
  }, [loading, billingLoading]);

  useEffect(() => {
    if (!loading && !billingLoading) setSlowLoad(false);
  }, [loading, billingLoading]);

  if (loading || billingLoading) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center gap-6 bg-[#262624] p-6">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-[#d97757] border-t-transparent" />
        <p className="text-center text-sm text-gray-400">Chargement de votre espace…</p>
        {slowLoad && (
          <div className="max-w-sm rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-center">
            <p className="text-sm text-amber-200">
              La connexion prend plus de temps que prévu. Si le projet Supabase est en pause, réactivez-le depuis le dashboard Supabase.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-3 rounded-lg bg-[#d97757] px-4 py-2 text-sm font-medium text-black hover:bg-amber-500"
            >
              Réessayer
            </button>
          </div>
        )}
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;

  // Tenant embarqué + host neutre : on attend la résolution / on redirige vers le
  // domaine propre (cf. useEffect ci-dessus) avant tout routage par rôle.
  if (embeddedGate === 'pending' || embeddedGate === 'redirecting') {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#262624]">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-[#d97757] border-t-transparent" />
      </div>
    );
  }

  if (hasMultiRoleAccess(user) && !getSelectedAccountRole()) {
    return <Navigate to={getChooseAccountTypePath()} replace />;
  }

  const role = getEffectiveRole(user);
  const isPremiumActive = status === 'active' || (status === 'past_due' && inGrace);

  // Membre d'un tenant LIRI/MEDOS (owner/practitioner/… porté par le JWT `tenant_role`) avec un
  // rôle GLOBAL faible (visitor/student/vide) : router DIRECT sur le portail LIRI, quel que soit
  // ce rôle global. Sans ça, un owner dont `profiles.role` n'est pas exactement 'visitor' tombe
  // sur /forfaits — la bascule owner→/liri n'existait que dans le bloc `role === 'visitor'`.
  if (
    ['owner', 'admin', 'practitioner', 'clinic_admin'].includes(tenantRole) &&
    !['owner', 'admin', 'secretariat', 'teacher', 'creator'].includes(role)
  ) {
    return <Navigate to="/liri" replace />;
  }

  // Owner/admin → TOUJOURS le portail LIRI : le back-office école est embarqué dans
  // l'onglet École (/liri/ecole). Le vieux shell séparé /owner-dashboard est retiré → plus
  // de rechute « style isna », quel que soit le domaine. Le branding tenant (prorascience.org)
  // est porté par le shell du portail.
  if (role === 'owner' || role === 'admin') {
    return <Navigate to="/liri" replace />;
  }
  if (role === 'secretariat') return <Navigate to="/secretariat-space/dashboard" replace />;
  if (role === 'teacher') return <Navigate to="/teacher-space/dashboard" replace />;
  if (role === 'creator') return <Navigate to="/creator-dashboard" replace />;

  // Garde-fou « pas d'org » : user connecté SANS membership (tenantRole vide) sur host neutre LIRI
  // (aucun tenant résolu par le domaine) → /student-school-life/dashboard serait vide/cassé.
  // On l'envoie choisir/rejoindre une organisation. Les owners/membres de tenant sont déjà sortis
  // plus haut (tenantRole owner/admin/…) ou résolus par leur domaine custom (getCachedHostTenant ≠ '').
  if (!tenantRole && isPlatformOrDevHost(window.location.hostname) && !getCachedHostTenant(window.location.hostname)) {
    return <Navigate to="/rejoindre" replace />;
  }

  if (role === 'visitor') {
    // Membre d'un tenant LIRI/MedOS : rôle global faible 'visitor' mais vrai rôle dans
    // le JWT (tenant_role). Le « lancement » LIRI ouvre direct sur le home /liri (façon
    // Zoom), pas l'espace prospect école. Les écoles (owner/teacher/student GLOBAUX) ne
    // passent pas ici — elles ont déjà été routées plus haut. Loop-safe : la garde /liri
    // accepte ces tenant_role (allowTenantRole).
    if (['owner', 'admin', 'practitioner', 'clinic_admin'].includes(tenantRole)) {
      return <Navigate to="/liri" replace />;
    }
    if (resolveRequiresStudentDossier() && isPremiumActive && !user?.student_profile_completed) return <Navigate to="/onboarding/eleve" replace />;
    // Espace élève UNIFIÉ = le portail LIRI (/liri) : vue adaptative par rôle (Mes cours, Ma
    // semaine, Vie scolaire, Notes, Évals… via le rail `school:true`), plus riche que l'ancien
    // /student-school-life (legacy). La garde /liri (LiriAccessGate) laisse passer l'élève d'un
    // tenant qui A LIRI (isna grandfathered) et n'affiche le mur d'upgrade que pour un tenant sans.
    return <Navigate to="/liri" replace />;
  }

  if (resolveRequiresStudentDossier() && role === 'student' && isPremiumActive && !user?.student_profile_completed) {
    return <Navigate to="/onboarding/eleve" replace />;
  }
  if (role === 'student' && isPremiumActive && user?.student_profile_completed) {
    return <Navigate to="/liri" replace />;
  }

  // Espace élève unifié = portail LIRI (cf. plus haut). Même sans abonnement actif, on entre
  // dans /liri : la garde gère l'éligibilité (upgrade en douceur à l'intérieur si besoin).
  return <Navigate to="/liri" replace />;
};

// Helper component to redirect authenticated users away from login/signup
const RedirectIfAuthenticated = ({ children }) => {
  const { user, loading, supabase: authSupabase } = useAuth();
  const location = useLocation();
  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#262624]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#d97757] border-t-transparent" />
      </div>
    );
  }
  if (user) {
    const sp = new URLSearchParams(location.search || '');
    const redirect = sp.get('redirect') || sp.get('next');
    const isEleveLogin = location.pathname.startsWith(ELEVE_MOBILE.login);
    return <Navigate to={redirect || (isEleveLogin ? ELEVE_MOBILE.home : '/dashboard')} replace />;
  }
  return children;
};

const ProtectedStudentJourneyRoute = ({ children }) => {
  const { user, loading } = useAuth();
  const { loading: billingLoading, status, inGrace } = useBilling();

  if (loading || billingLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#262624]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#d97757] border-t-transparent" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  const role = String(getEffectiveRole(user) || '').toLowerCase();
  if (['owner', 'admin', 'secretariat', 'teacher', 'creator'].includes(role)) return children;

  const isPremiumActive = status === 'active' || (status === 'past_due' && inGrace);
  if (!isPremiumActive) return <Navigate to="/forfaits" replace />;
  if (resolveRequiresStudentDossier() && role === 'visitor' && !user?.student_profile_completed) {
    return <Navigate to="/onboarding/eleve" replace />;
  }
  return children;
};

const ProtectedImmersiveMessagingRoute = ({ children }) => {
  const { user, loading, tenantRole, supabase: authSupabase } = useAuth();
  const { loading: billingLoading, status, inGrace } = useBilling();
  const [checkingVisitorAccess, setCheckingVisitorAccess] = useState(false);
  const [visitorCanChat, setVisitorCanChat] = useState(false);

  useEffect(() => {
    let alive = true;
    const loadVisitorAccess = async () => {
      if (!user?.id) return;
      const role = String(getEffectiveRole(user) || '').toLowerCase();
      if (role !== 'visitor') {
        if (alive) setVisitorCanChat(false);
        return;
      }
      setCheckingVisitorAccess(true);
      try {
        const nowIso = new Date(Date.now() - 30 * 60 * 1000).toISOString();
        const { data } = await authSupabase
          .from('appointment_requests')
          .select('id')
          .eq('student_id', user.id)
          .eq('status', 'confirmed')
          .gte('scheduled_at', nowIso)
          .order('scheduled_at', { ascending: true })
          .limit(1);
        if (!alive) return;
        setVisitorCanChat((data || []).length > 0);
      } catch (err) {
        if (!alive) return;
        setVisitorCanChat(false);
        console.warn('[ProtectedImmersiveMessagingRoute] visitor access check failed:', err?.message || err);
      } finally {
        if (alive) setCheckingVisitorAccess(false);
      }
    };
    loadVisitorAccess();
    return () => {
      alive = false;
    };
  }, [user, authSupabase]);

  if (loading || billingLoading || checkingVisitorAccess) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#262624]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#d97757] border-t-transparent" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;

  const role = String(getEffectiveRole(user) || '').toLowerCase();
  const isStaffRole = ['owner', 'admin', 'secretariat', 'teacher', 'creator', 'commercial', 'support'].includes(role);
  const isPremiumActive = status === 'active' || (status === 'past_due' && inGrace);
  // Membre actif d'un tenant LIRI/École : son vrai rôle est dans le JWT (tenant_role), pas le
  // rôle global (souvent 'visitor'). La messagerie inter-membres est tenant-scoped (isolation
  // garantie côté API), donc tout membre d'un tenant école y a accès — y compris les ÉLÈVES
  // ('student'), qui peuvent ainsi écrire à leurs profs / au secrétariat. Additif → accès école inchangé.
  // NB : 'patient' (MEDOS) volontairement EXCLU de ce canal — la relation patient↔praticien a son
  // propre flux et on évite tout DM patient↔patient (confidentialité médicale).
  const isLiriMember = ['owner', 'admin', 'practitioner', 'clinic_admin', 'teacher', 'secretariat', 'student'].includes(tenantRole);
  if (isStaffRole || isPremiumActive || isLiriMember || (role === 'visitor' && visitorCanChat)) return children;

  return <Navigate to="/appointment/request?source=immersive-chat" replace />;
};

const LegacyCycleRedirect = () => {
  const { id } = useParams();
  return <Navigate to={`/secretariat-space/cycles/${id || 'disciple'}`} replace />;
};

const AppContent = () => {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const isImmersiveEmbed = searchParams.get('immersive_embed') === '1';
  // Pages EMBED (/embed/*) = iframe pristine sur un site tiers : aucun widget
  // global (DiscoveryChat, coque). Traitées comme immersive_embed=1.
  const isEmbedRoute = location.pathname.startsWith('/embed/');
  const { user } = useAuth();

  useEffect(() => {
    if (location.hash) return;
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [location.pathname, location.search, location.hash]);

  // Coque mobile « type app » (MobileReelsShell) SUPPRIMÉE définitivement : LIRI = WEB RESPONSIVE
  // + NATIF (Expo, apps/mobile). Plus aucune fausse coque à onglets par-dessus le web, quel que
  // soit le viewport. (Kill switch load-bearing ; le hook viewport et sa config deviennent morts.)
  const mobileReelsShellActive = false;

  /** Maquettes LIRI hôte : accessibles sans .env Supabase + shell plein écran (voir isLiveArenaRoute plus bas). */
  const isLiriHostDevPreviewRoute =
    location.pathname === '/dev'
    || location.pathname.startsWith('/dev/liri-host')
    || location.pathname.startsWith('/dev/liri')
    || location.pathname.startsWith('/dev/smartboard-designer')
    || location.pathname.startsWith('/dev/owner-shell')
    || location.pathname.startsWith('/dev/masterclass-factory');

  /**
   * Salle / cours live en maquette (UI seule) — mêmes écrans que l'app élève, sans dépendre d'un build avec Supabase
   * (démos web, partage de maquette, vitrine). Les autres `/m/eleve/*` restent bloqués sans API.
   * DEV uniquement : ces routes ne sont pas montées en prod (cf. <Route path="live/maquette"> gardé par import.meta.env.DEV),
   * donc aucun bypass Supabase ni vue hôte LIRI ne doit être exposé publiquement.
   */
  const isLiriEleveMaquetteRoute =
    import.meta.env.DEV && location.pathname.startsWith('/m/eleve/live/maquette');

  /**
   * Pages vitrine / marketing **sans** besoin d'API pour afficher l'écran (texte, images, liens).
   * Sans cela, un build Netlify sans `VITE_SUPABASE_*` bloquait **tout le site**, y compris l'accueil `/`.
   * Les parcours qui appellent l'auth ou la base peuvent montrer une erreur localisée, pas un écran global.
   */
  const path = location.pathname;
  const isPublicVitrineWithoutSupabaseConfig =
    path === '/'
    || path === '/landing'
    || path === '/version'
    || path === '/vitrine'
    || path === '/app'
    || path === '/isna' // Legacy ISNA route - will redirect to tenant system
    || path === '/temple-ngowazulu'
    || path.startsWith('/ecoles/prorascience')
    || path === '/ecoles/isna-pro' // Legacy ISNA route - will redirect to tenant system
    || path.startsWith('/a-propos')
    || path.startsWith('/cimolace')
    || path.startsWith('/dashboard/medos')
    || path === '/dashboard/infrastructure'
    || path === TENANT_ADMIN_PATH // New tenant admin route
    || path === TENANT_COURSES_PATH // New tenant courses route
    || path === TENANT_STUDENTS_PATH // New tenant students route
    || path === TENANT_SETTINGS_PATH // New tenant settings route (/t/isna/...)
    || TENANT_ADMIN_SETTINGS_PATH_RE.test(path) // /t/:tenantSlug/admin/settings
    || TENANT_OAUTH_CALLBACK_PATH_RE.test(path) // /t/:tenantSlug/auth/callback (OAuth Google custom)
    || [
        '/equipe',
        '/faq',
        '/nous-contacter',
        '/conditions-utilisation',
        '/politique-confidentialite',
        '/mentions-legales',
      ].includes(path);

  /** Web (`npm run build`) vs app LIRI (`VITE_APP_VARIANT=eleve` + `/m/eleve/*`) : ne pas mélanger les consignes. */
  const isEleveLiriContext =
    import.meta.env.VITE_APP_VARIANT === 'eleve' || location.pathname.startsWith('/m/eleve');

  if (
    !isSupabaseConfigured
    && !isLiriHostDevPreviewRoute
    && !isLiriEleveMaquetteRoute
    && !isPublicVitrineWithoutSupabaseConfig
  ) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#0a0908] px-6 text-center text-white">
        <p className="font-serif text-xl text-violet-200">Configuration Supabase absente</p>
        <p className="mt-3 max-w-md text-sm text-white/65">
          Cette page nécessite une appli liée à Supabase. Renseignez <code className="text-violet-200/90">VITE_SUPABASE_URL</code> et{' '}
          <code className="text-violet-200/90">VITE_SUPABASE_ANON_KEY</code> en local (fichier{' '}
          <code className="text-white/80">.env</code> / <code className="text-white/80">.env.local</code>, clés dans Supabase
          → Settings → API) ou côté <strong>Netlify</strong> (Site → Environment variables) puis <strong>redéployez</strong>.
          Évitez <code className="text-white/50">=REPLACE_ME</code> en fin de fichier. La <strong>vitrine</strong> (
          <code className="text-white/50">/</code> et <code className="text-white/50">/ecoles/prorascience</code>, etc.)
          s'affiche déjà sans ces variables.
        </p>
        {isEleveLiriContext ? (
          <p className="mt-3 max-w-md text-sm text-white/60">
            <span className="text-white/45">LIRI mobile (APK / iOS) :</span> après <code className="text-violet-200/90">.env.local</code>, lancez{' '}
            <code className="text-white/80">npm run build:eleve</code> puis{' '}
            <code className="text-white/80">npm run cap:sync:eleve:android</code> (ou <code className="text-white/80">:ios</code>
            ) et recompilez dans Android Studio / Xcode. Ne confondez pas avec le build <code className="text-white/50">web</code> seul.
          </p>
        ) : (
          <p className="mt-3 max-w-md text-sm text-white/50">
            Ce message sur le <strong>site web</strong> vient d'un déploiement sans ces variables côté Netlify (ou d\'un
            <code className="mx-0.5 text-white/60">.env.local</code> manquant en dev). L'app mobile LIRI utilise en plus{' '}
            <code className="mx-0.5 text-white/60">build:eleve</code> — inutile pour le navigateur.
          </p>
        )}
        <p className="mt-6 text-xs text-white/40">
          Maquettes UI sans backend (hôte studio) :{' '}
          <a href="/dev/liri-host-ui" className="text-violet-300/90 underline-offset-2 hover:underline">
            /dev/liri-host-ui
          </a>
          {' · '}
          <a href="/dev/liri-host-shell" className="text-violet-300/90 underline-offset-2 hover:underline">
            /dev/liri-host-shell
          </a>
          {' · '}
          <a href="/dev/owner-shell" className="text-violet-300/90 underline-offset-2 hover:underline">
            /dev/owner-shell
          </a>
        </p>
        {import.meta.env.DEV && (
          <p className="mt-3 text-xs text-white/40">
            Maquette salle <span className="text-white/55">élève</span> (LIVE + diapos, sans compte) :{' '}
            <a
              href="/m/eleve/live/maquette/host"
              className="text-violet-300/90 underline-offset-2 hover:underline"
            >
              /m/eleve/live/maquette/host
            </a>
            {isEleveLiriContext && !isLiriEleveMaquetteRoute ? (
              <span className="ml-1 text-emerald-400/90">— ouvrez ce lien : il fonctionne sans variables Supabase.</span>
            ) : null}
          </p>
        )}
      </div>
    );
  }

  const isAdminRoute = location.pathname.startsWith('/backend') ||
                       location.pathname.startsWith('/teacher-dashboard') ||
                       location.pathname.startsWith('/creator-dashboard') ||
                       location.pathname.startsWith('/dashboard/medos') ||
                       location.pathname === '/dashboard/infrastructure';
  const marketingShellRoutes = new Set([
    '/',
    '/landing',
    '/ecoles/prorascience',
    '/ecoles/prorascience-apple-story',
    '/ecoles/prorascience-apple-story-v3',
    '/ecoles/isna-pro', // Legacy ISNA route
    '/app',
    '/isna', // Legacy ISNA route
    '/temple-ngowazulu',
    '/a-propos',
    '/a-propos/fondateur',
    '/equipe',
    '/faq',
    TENANT_ADMIN_PATH, // New tenant admin route
    TENANT_COURSES_PATH, // New tenant courses route
    TENANT_STUDENTS_PATH, // New tenant students route
    TENANT_SETTINGS_PATH, // New tenant settings route
    '/nous-contacter',
    '/conditions-utilisation',
    '/politique-confidentialite',
    '/mentions-legales',
  ]);
  const isMarketingShellRoute =
    marketingShellRoutes.has(location.pathname) || TENANT_ADMIN_SETTINGS_PATH_RE.test(location.pathname);
  const isImmersiveHomeRoute = location.pathname === '/';

  const hideHeaderRoutes = [
    '/login',
    '/signup',
    '/forfaits',        // Forfaits retirés de la vitrine « PORTAIL » : membre → /liri/forfaits (coque LIRI),
                        // visiteur → page offres focalisée SANS l'ancien header Academy (agent immersif = découverte).
    '/paiement',        // Checkout focalisé : la page a son propre header minimal (« ← Retour »). Le bandeau
                        // « PORTAIL » (nav Formations/Boutique + sélecteur de rôle) juste avant de payer =
                        // chrome incohérent + fuite de confiance. Couvre /paiement et /paiements (custom domain
                        // strippe /t/:slug/paiement → /paiement). Le checkout INVITÉ reste intact.
    '/creer-organisation',
    '/precepteur',      // Le Précepteur = secteur FORMATION de Cimolace — immersif plein écran, aucun header
    '/rejoindre',
    '/choose-account-type', // sélecteur multi-rôles = page plein écran autonome (LiriWordmark) —
                            // JAMAIS le header vitrine « PORTAIL Formations… » (chrome Academy déprécié)
    '/auth/callback',
    '/creator-dashboard',
    '/teacher-dashboard',
    '/classroom/live/',
    '/classroom/video',
    '/studio',
    '/lives',           // Bibliothèque des Lives — APP du portail (LiriPortalShell), pas de header vitrine
    '/dashboard/liri',  // LIRI Brain — agent IA plein écran (univers dédié), pas de header vitrine
    '/dashboard/tools',
    '/dashboard/medos',
    '/dashboard/infrastructure',
    '/companion-capture',
    '/live/',
    '/dev/masterclass-factory',
    '/embed/',       // LIRI embed iframe — aucun shell
    '/handoff',      // handoff cross-domain (« Connexion à la salle ») — coque neutre, pas de shell école
    '/teleconsult',  // salle de téléconsultation MEDOS (plein écran immersif) — pas de shell portail :
                     // pendant le boot du handoff (MEDOS → app), on ne doit PAS voir le Header « …PORTAIL »
    '/liri',         // accueil LIRI standalone (LiriPortalShell a son propre topbar) — pas de header école.
                     // Le match `startsWith('/liri')` couvre AUSSI /liri/precepteur[/cours/:id] (Le Précepteur
                     // enveloppé dans LiriPortalShell) → pas de header vitrine ISNA par-dessus le shell LIRI.
    '/messages',     // messagerie immersive (page plein écran, embarquée dans LIRI) — pas de header école
    '/owner-dashboard', // back-office École : LiriDashboardShell est auto-suffisant (sidebar+topbar+user)
                        // et déjà brandé tenant (Prorascience). Le Header global = bandeau VITRINE du
                        // domaine tenant → « impression d'être ramené à la vitrine ». On le retire.
  ];

  // Routes live immersif — aucun shell app autour (plein écran total)
  const isLiveArenaRoute =
    location.pathname.startsWith('/studio/live-arena') ||
    location.pathname.startsWith('/live/') ||
isLiriHostDevPreviewRoute;

  /**
   * App mobile élève LIRI — pas de header Prorascience, menu web, bannière grâce, panier, alerte live, chat flottant.
   * Build `VITE_APP_VARIANT=eleve` : étendu à `/messages` (onglet Messages du shell LIRI).
   */
  const isEleveAppBuild = import.meta.env.VITE_APP_VARIANT === 'eleve';
  const isEleveMobileRoute =
    location.pathname.startsWith('/m/eleve') ||
    (isEleveAppBuild &&
      (location.pathname === '/messages' || location.pathname.startsWith('/messages/')));

  /* Hub /studio seul : <main> peut avoir hauteur 0 (LiveAlert + chat en position:fixed hors flux flex) → contenu clipé, fond noir. Même principe que l'arène live, sans s'appliquer à /studio/live ni au wizard (ils ont leur propre fixed). */
  const studioPathNorm = String(location.pathname || '/').replace(/\/+$/, '') || '/';
  const isStudioHubOnly = studioPathNorm === '/studio';
  
  const isCimolaceRoute = location.pathname.startsWith('/cimolace');
  // Salle de téléconsultation MEDOS (santé) : plein écran ISOLÉ — aucun chrome du
  // portail LIRI/école (bannières, panier, assistant, menu mobile) ne doit s'y
  // afficher, ni pendant l'appel ni sur l'écran de fin. Cloison [[cimolace]] santé.
  const isTeleconsultRoute = location.pathname.startsWith('/teleconsult');

  // Espace propriétaire (/owner-dashboard) : PAS d'entête globale (cf. hideHeaderRoutes). Sur un
  // domaine tenant (prorascience.org), le Header global = bandeau VITRINE → confusion « ramené à la
  // vitrine ». Le back-office a son propre shell (LiriDashboardShell : sidebar + topbar + user/logout),
  // déjà brandé tenant (Prorascience). prorascience.org ne doit jamais afficher la marque « LIRI ».

  /**
   * Espace élève (sidebar LIRI plein écran) — aucune barre globale au-dessus (sinon double header
   * empilé sur la sidebar). La page embarque son propre shell. (L'owner, lui, GARDE l'entête.)
   */
  const isStudentSpaceShell = /^\/student-school-life(\/|$)/.test(location.pathname || '/');

  /** Pages « maquette » narratives /t/isna : elles embarquent leur propre header (MaqNav) dans un overlay `fixed inset-0` → pas de header global (évite le flash de l'ancien nav au chargement + le rendu fantôme dessous). Match EXACT pour épargner /t/isna/courses, /login, /signup, /paiement, /admin… */
  const isMaquetteRoute = [
    '/t/isna',
    '/t/isna/ecole',
    '/t/isna/temple',
    '/t/isna/programme',
    '/t/isna/mission',
    '/t/isna/fondateur',
    '/t/isna/doctrine',
    // Domaine custom (prorascience.org) : mêmes pages vitrine en URL PROPRE.
    '/ecole', '/temple', '/programme', '/mission', '/fondateur', '/doctrine',
  ].includes((location.pathname || '/').replace(/\/+$/, '') || '/');

  // Forum back-office (admin : ?tab=forum + /owner-dashboard/forum/* ; secrétariat :
  // /secretariat-space/forum*) = MÊME expérience immersive que le forum élève → aucun
  // en-tête global (comme /student-school-life).
  const isDashForumImmersive =
    location.pathname.startsWith('/owner-dashboard/forum') ||
    (location.pathname === '/owner-dashboard' && searchParams.get('tab') === 'forum') ||
    location.pathname.startsWith('/secretariat-space/forum');

  // Lecteur de cours plein écran (/formation/:id/learn) — expérience immersive focalisée :
  // pas de header marketing global (il a son propre header minimal Retour / titre / Forum).
  const isCoursePlayerRoute = /^\/formation\/[^/]+\/learn\/?$/.test(location.pathname || '/');

  const shouldShowHeader =
    !isCoursePlayerRoute &&
    !isDashForumImmersive &&
    !isAdminRoute &&
    !isMarketingShellRoute &&
    !isLiveArenaRoute &&
    !isEleveMobileRoute &&
    !isStudentSpaceShell &&
    !hideHeaderRoutes.some(route => location.pathname.startsWith(route)) &&
    !mobileReelsShellActive &&
    !isCimolaceRoute &&
    !isCimolaceAssistantRoot(location.pathname) &&
    !isMaquetteRoute;
  const shouldOffsetMain =
    shouldShowHeader &&
    !isImmersiveHomeRoute &&
    !isImmersiveEmbed &&
    !isLiveArenaRoute &&
    !isEleveMobileRoute &&
    !isStudentSpaceShell &&
    !mobileReelsShellActive &&
    !isCimolaceRoute;

  const mainClassName = isLiveArenaRoute
    ? 'h-full min-h-[100dvh] overflow-y-auto'
    : isStudioHubOnly
      ? 'flex min-h-0 flex-1 flex-col overflow-hidden'
      : isEleveMobileRoute
        ? /* Même principe que le hub /studio : sans hauteur min explicite, flex-1 + min-h-0 peut laisser le <main> à 0px → écrans /m/eleve (dont Hub Live) invisibles. */
          'eleve-app-main flex min-h-[100dvh] flex-1 flex-col overflow-y-auto overflow-x-hidden'
        : [
            'flex-grow',
            isMarketingShellRoute ? 'min-h-[100dvh]' : '',
            mobileReelsShellActive
              ? 'pt-[calc(3rem+env(safe-area-inset-top))] pb-[calc(3.65rem+env(safe-area-inset-bottom))]'
              : '',
            !mobileReelsShellActive && shouldOffsetMain ? 'pt-20' : '',
          ]
            .filter(Boolean)
            .join(' ');

  const appShellClassName = isLiveArenaRoute
    ? 'fixed inset-0 overflow-hidden'
    : isStudioHubOnly
      ? 'fixed inset-0 flex flex-col overflow-hidden premium-app-shell'
      : isMarketingShellRoute
        ? 'flex flex-col min-h-screen marketing-public-shell'
        : isEleveMobileRoute
          ? 'flex min-h-[100dvh] flex-col overflow-hidden bg-[#0B0B0F]'
          : 'flex flex-col min-h-screen premium-app-shell';

  // CIMOLACE est un SaaS complètement isolé de Prorascience
  // NOTE: Early return retiré - utilisez le Router principal

  if (location.pathname === '/ecoles/prorascience-apple-story') {
    return (
      <div className="flex min-h-screen flex-col marketing-public-shell">
        {!isLiveArenaRoute && <GraceBanner />}
        {!isAdminRoute && !isImmersiveEmbed && !isEmbedRoute && !isLiveArenaRoute && <DiscoveryChat />}
        <main className="flex-grow min-h-[100dvh]">
          <React.Suspense fallback={<div className="flex min-h-[100dvh] items-center justify-center bg-[#f7f8fb] text-slate-500">Chargement…</div>}>
            <ProrascienceAppleStoryLandingLazy />
          </React.Suspense>
        </main>
        <Toaster />
      </div>
    );
  }

  if (location.pathname === '/ecoles/prorascience-apple-story-v3') {
    return (
      <div className="flex min-h-screen flex-col marketing-public-shell">
        {!isLiveArenaRoute && <GraceBanner />}
        {!isAdminRoute && !isImmersiveEmbed && !isEmbedRoute && !isLiveArenaRoute && <DiscoveryChat />}
        <main className="flex-grow min-h-[100dvh]">
          <React.Suspense fallback={<div className="flex min-h-[100dvh] items-center justify-center bg-[#06070c] text-white/60">Chargement…</div>}>
            <ProrascienceAppleStoryV3Lazy />
          </React.Suspense>
        </main>
        <Toaster />
      </div>
    );
  }

  return (
    <div className={appShellClassName}>
      {!isLiveArenaRoute && !isTeleconsultRoute && !isEleveMobileRoute && !isCimolaceRoute && !isAdminRoute && (
        <LazyShell>
          <GraceBanner />
        </LazyShell>
      )}
      {shouldShowHeader && (
        <LazyShell>
          <Header />
        </LazyShell>
      )}

      {!isLiveArenaRoute && !isTeleconsultRoute && !isEleveMobileRoute && !isCimolaceRoute && !isAdminRoute && (
        <LazyShell>
          <ShoppingCart />
        </LazyShell>
      )}
      {!isLiveArenaRoute && !isTeleconsultRoute && !isEleveMobileRoute && !isCimolaceRoute && !isAdminRoute && !isStudentSpaceShell && (
        <LazyShell>
          <LiveAlertBanner />
        </LazyShell>
      )}

      {/* Discovery Chat — pages publiques. Exclu de l'espace élève (collision avec le FAB de la sidebar) et des embeds. */}
      {/* CLOISON MEDOS : jamais l'assistant portail LIRI/prorascience par-dessus la
          salle de téléconsultation santé (`/teleconsult*`), ni pendant ni à la fin. */}
      {!isAdminRoute && !isImmersiveEmbed && !isEmbedRoute && !isLiveArenaRoute && !location.pathname.startsWith('/teleconsult') && !isEleveMobileRoute && !isCimolaceRoute && !isStudentSpaceShell && !location.pathname.startsWith('/creer-organisation/agent') && !isCimolaceAssistantRoot(location.pathname) && resolveHostPortal(window.location.hostname) !== 'prorascience' && (
        <LazyShell>
          <DiscoveryChat />
        </LazyShell>
      )}

      <main className={mainClassName}>
        <EleveNoStudioGuard>
        <LazyChunkErrorBoundary>
          <Suspense fallback={<PageLoader />}>
            <Routes>
          {/*
           * ── LIRI EMBED — iframe légère, aucun shell, aucune auth Supabase ────
           * Montée EN PREMIER pour court-circuiter tout le reste du shell.
           * Accessible depuis n'importe quel site via le widget liri-widget.js.
           */}
          <Route
            path="/embed/live/:sessionId"
            element={
              <Suspense fallback={
                <div style={{ minHeight: '100vh', background: '#0d1117', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ width: 36, height: 36, border: '3px solid #21262d', borderTop: '3px solid #7c3aed', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                </div>
              }>
                <LiveEmbedPage />
              </Suspense>
            }
          />
          {/* LIRI Embed Studio — créer une session depuis n'importe quel site */}
          <Route
            path="/embed/studio"
            element={
              <Suspense fallback={
                <div style={{ minHeight: '100vh', background: '#090e18' }} />
              }>
                <LiveEmbedStudioPage />
              </Suspense>
            }
          />
          {/* mbolo — boutique publique embarquable (catalogue lecture seule par slug) */}
          <Route
            path="/embed/boutique"
            element={
              <Suspense fallback={
                <div style={{ minHeight: '100vh', background: '#0f1419' }} />
              }>
                <MboloStorefrontEmbedPage />
              </Suspense>
            }
          />

          {/* CIMOLACE - SaaS complètement isolé - Router séparé, en dehors du main */}
          <Route path="/cimolace/*" element={<CimolaceRouter />} />
          {/* IRI — page dynamique par slug (tenant résolu par Host côté API) */}
          <Route path="/p/:slug" element={<IriPublicPage />} />

          <Route path="/subscribe" element={<Navigate to="/forfaits" replace />} />
          {/*
            Route racine "/" : apps/app est un dashboard, pas un site marketing.
            Le marketing Cimolace SaaS vit sur cimolace.space (apps/public-site).
            La home racine redirige vers login. Le marketing ISNA-Prorascience
            (ProrascienceCommercialPage) reste accessible via /ecoles/prorascience
            tant qu'ISNA n'a pas migré son Netlify vers Cimolace.
          */}
          <Route path="/" element={<RootRedirect />} />
          <Route path="/version" element={<VersionPage />} />
          <Route path="/dev" element={<Navigate to="/dev/liri-host-ui" replace />} />
          {/* DEV PREVIEW — routes sans auth AVANT le catch-all /dev/* */}
          {import.meta.env.DEV && (
            <Route path="/dev/smartboard" element={
              <React.Suspense fallback={<div className="flex h-screen items-center justify-center bg-[#080a0f] text-white">Chargement...</div>}>
                <DevSmartboardPreview />
              </React.Suspense>
            } />
          )}
          {import.meta.env.DEV && (
            <Route path="/dev/tableau-vivant" element={
              <React.Suspense fallback={<div className="flex h-screen items-center justify-center bg-[#080a0f] text-white">Chargement...</div>}>
                <TableauVivantDemoPage />
              </React.Suspense>
            } />
          )}
          {/* DEV — aperçu de « Mes formations » rendu par l'OS, SANS auth (preuve du branchement
              fetchStructure → contenu réel des cours studio). Retiré du build prod. */}
          {import.meta.env.DEV && (
            <Route path="/dev/os-formations" element={
              <React.Suspense fallback={<div className="flex h-screen items-center justify-center bg-[#262624] text-white/60">Chargement…</div>}>
                <StudentFormationsOsPage />
              </React.Suspense>
            } />
          )}
          {/* Cours-démo PUBLIC (watchable, sans auth) — le « prof virtuel » qui se joue seul */}
          <Route path="/cours-demo" element={
            <React.Suspense fallback={<div className="flex h-screen items-center justify-center bg-[#262624] text-white/60">Chargement du cours…</div>}>
              <CourseDemoPage />
            </React.Suspense>
          } />
          {/* LE PRÉCEPTEUR — cours numérique PERSISTÉ (masterclass par id) — même page, source backend */}
          <Route path="/precepteur/cours/:masterclassId" element={
            <React.Suspense fallback={<div className="flex h-screen items-center justify-center bg-[#262624] text-white/60">Chargement du cours…</div>}>
              <PrecepteurCoursePage />
            </React.Suspense>
          } />
          {/* LE PRÉCEPTEUR — cours numérique EXPORTÉ depuis la Masterclass Factory (route la plus spécifique en premier) */}
          <Route path="/precepteur/cours" element={
            <React.Suspense fallback={<div className="flex h-screen items-center justify-center bg-[#262624] text-white/60">Chargement du cours…</div>}>
              <PrecepteurCoursePage />
            </React.Suspense>
          } />
          {/* LE PRÉCEPTEUR — preuve immersive (leçon → croquis → atelier → analogie) */}
          <Route path="/precepteur" element={
            <React.Suspense fallback={<div className="flex h-screen items-center justify-center bg-[#262624] text-white/60">Chargement du Précepteur…</div>}>
              <PrecepteurDemoPage />
            </React.Suspense>
          } />
          {/* LE PRÉCEPTEUR DANS LE PORTAIL LIRI — PUBLIC (aucune garde, capturable déconnecté,
              exactement comme /precepteur). Enveloppé dans LiriPortalShell (fond chaud, rail « École »).
              Route la plus spécifique (:masterclassId) EN PREMIER. */}
          <Route path="/liri/precepteur/cours/:masterclassId" element={
            <React.Suspense fallback={<div className="flex h-screen items-center justify-center bg-[#262624] text-white/60">Chargement du cours…</div>}>
              <LiriPrecepteurPage />
            </React.Suspense>
          } />
          <Route path="/liri/precepteur" element={
            <React.Suspense fallback={<div className="flex h-screen items-center justify-center bg-[#262624] text-white/60">Chargement du Précepteur…</div>}>
              <LiriPrecepteurPage />
            </React.Suspense>
          } />
          {import.meta.env.DEV && (
            <Route path="/dev/liri/*" element={
              <React.Suspense fallback={<div className="flex h-screen items-center justify-center bg-[#262624] text-white/50 text-sm">Chargement LIRI…</div>}>
                <StudioLiriRouter />
              </React.Suspense>
            } />
          )}
<Route path="/dev/smartboard-designer" element={
              <React.Suspense fallback={<div className="flex h-screen items-center justify-center bg-[#262624] text-white/50 text-sm">Chargement Designer…</div>}>
                <StudioSmartboardKonvaPageLazy />
              </React.Suspense>
            } />
          {import.meta.env.DEV && (
            <Route
              path="/dev/masterclass-factory"
              element={<MasterclassFactoryPage />}
            />
          )}
          {import.meta.env.DEV && (
            <Route path="/dev/liri/orchestrator-live" element={<OrchestratorLiveDashboardPage />} />
          )}
          {import.meta.env.DEV && (
            <Route path="/dev/liri/smartboard-stream" element={<SmartboardStreamingPage />} />
          )}
          {/* ── LIRI Studio V2 — Hub + interfaces redesignées (accessibles en prod) ── */}
          <Route path="/dev/liri/studio"          element={<ErrorBoundary logTag="LiriStudioHub"         showDetailsInDev><LiriStudioHub /></ErrorBoundary>} />
          <Route path="/dev/liri/masterclass-v2"  element={<ErrorBoundary logTag="MasterclassFactoryV2"  showDetailsInDev><MasterclassFactoryV2 /></ErrorBoundary>} />
          <Route path="/dev/liri/orchestrator-v2" element={<ErrorBoundary logTag="OrchestratorLiveV2"    showDetailsInDev><OrchestratorLiveV2 /></ErrorBoundary>} />
          <Route path="/dev/liri/streaming-v2"    element={<ErrorBoundary logTag="SmartboardStreamingV2" showDetailsInDev><SmartboardStreamingV2 /></ErrorBoundary>} />
          <Route path="/dev/liri-admin-shell" element={<ErrorBoundary logTag="LiriAdminShellDemo" showDetailsInDev><LiriAdminShellDemo /></ErrorBoundary>} />
          <Route path="/dev/*" element={<DevLiriHostEntry />} />
          {/* LIRI mobile — UI dédiée, mêmes routes métier en cible */}
          {/* === App mobile « Élève » LIRI (sans Studio) — ErrorBoundary via layout */}
          <Route path="/m/eleve" element={<EleveMobileRouteShell />}>
            <Route path="connexion/lien" element={<EleveConnectionLien />} />
            <Route path="connexion/code" element={<EleveConnectionCode />} />
            <Route path="connexion" element={<EleveConnectionWelcome />} />
            <Route path="choisir-compte" element={
              <ProtectedRoute>
                <EleveChooseAccountTypeScreen />
              </ProtectedRoute>
            } />
            <Route path="login" element={
              <RedirectIfAuthenticated>
                <LoginPage />
              </RedirectIfAuthenticated>
            } />
            <Route path="signup" element={
              <RedirectIfAuthenticated>
                <EleveSignupMobile />
              </RedirectIfAuthenticated>
            } />
            <Route path="notifications" element={<EleveNotificationsScreen />} />
            <Route index element={<EleveHomeScreen />} />
            <Route path="live/loading" element={<EleveLiveLoadingScreen />} />
            <Route path="live/access-denied" element={<EleveLiveAccessDeniedScreen />} />
            <Route path="live/termine" element={<EleveLiveTermineScreen />} />
            <Route path="live/waiting" element={<EleveLiveWaitingScreen />} />
            <Route path="live/chat" element={<EleveLiveSessionChatScreen />} />
            {/* Maquettes live (UI seule, sans auth) — DEV uniquement : jamais montées en prod (pas de vue hôte LIRI exposée publiquement). */}
            {import.meta.env.DEV && (
              <Route path="live/maquette" element={<Outlet />}>
                <Route index element={<EleveLiveRoomShellMaquette />} />
                <Route path="alpha" element={<EleveLiveRoomImmersiveAlpha />} />
                <Route path="host" element={<LiriMobileHostView />} />
              </Route>
            )}
            <Route path="live" element={<EleveLiveScreen />} />
            <Route path="cours/:courseId" element={<EleveCoursePage />} />
            <Route path="billing/checkout/:id" element={<EleveBillingCheckoutScreen />} />
            <Route path="checkout-success" element={<EleveCheckoutSuccessScreen />} />
            <Route path="paiements/payer" element={
              <ProtectedRoute>
                <PaymentActionPage layout="eleve" />
              </ProtectedRoute>
            } />
            <Route path="bibliotheque" element={<EleveBibliothequeScreen />} />
            <Route path="en-ligne" element={<EleveEspaceEnLigneScreen />} />
            <Route path="etudiant" element={<EleveEtudiantDashboardScreen />} />
            <Route path="etudiant/formations" element={<EleveEtudiantFormationsScreen />} />
            <Route path="etudiant/evaluations" element={<EleveEtudiantEvaluationsScreen />} />
            <Route path="etudiant/notes" element={<EleveEtudiantNotesScreen />} />
            <Route path="etudiant/absences" element={<EleveEtudiantAbsencesScreen />} />
            <Route path="etudiant/documents" element={<EleveEtudiantDocumentsScreen />} />
            <Route path="communaute" element={<EleveCommunauteScreen />} />
            <Route path="profil" element={<EleveProfileScreen />} />
            <Route path="classe" element={<EleveClasseScreen />} />
            <Route path="messages/nouveau" element={<EleveMessagesNewScreen />} />
            <Route path="messages/:participantId" element={<EleveMessageThreadScreen />} />
            <Route path="messages" element={<EleveMessagesScreen />} />
            <Route path="neuron" element={<EleveNeuronScreen />} />
            <Route path="replays" element={<EleveReplaysScreen />} />
            <Route path="agenda" element={<EleveAgendaScreen />} />
            <Route path="calendrier-annuel" element={<EleveCalendrierAnnuelScreen />} />
            <Route
              path="vie-scolaire/portail"
              element={<Navigate to={ELEVE_MOBILE.enLigne} replace />}
            />
            <Route path="vie-scolaire" element={<EleveVieScolaireLayout />}>
              <Route index element={<EleveVieScolaireApercuTab />} />
              <Route path="calendrier" element={<EleveVieScolaireCalendrierTab />} />
              <Route path="resultats" element={<EleveVieScolaireResultatsTab />} />
              <Route path="annonces" element={<EleveVieScolaireAnnoncesTab />} />
            </Route>
            <Route path="rendez-vous" element={<EleveAppointmentRequestScreen />} />
            <Route path="modules" element={<EleveModulesScreen />} />
            <Route path="forfaits" element={<EleveForfaitsScreen />} />
            <Route path="modules-forfaits" element={<EleveModulesForfaitsScreen />} />
            <Route path="boutique" element={<EleveBoutiqueSacreeScreen />} />
            <Route path="prorascience/forfaits" element={<VitrineForfaitsMobileScreen />} />
            <Route path="prorascience/formations" element={<VitrineFormationsMobileScreen />} />
            <Route path="prorascience/a-propos" element={<VitrineAboutMobileScreen />} />
            <Route path="prorascience/accompagnement/mentorat" element={<VitrineMentoratMobileScreen />} />
            <Route path="prorascience/accompagnement/coaching" element={<VitrineCoachingMobileScreen />} />
            <Route
              path="prorascience/accompagnement/coaching-vs-mentorat"
              element={<VitrineCoachingVsMentoratMobileScreen />}
            />
            <Route path="prorascience/fondateur" element={<VitrineFondateurMobileScreen />} />
            <Route path="prorascience/equipe" element={<VitrineEquipeMobileScreen />} />
            <Route path="prorascience/faq" element={<VitrineFaqMobileScreen />} />
            <Route path="prorascience/contact" element={<VitrineContactMobileScreen />} />
            <Route path="prorascience/communaute" element={<VitrineCommunauteMobileScreen />} />
            <Route path="prorascience/les-21-sciences" element={<Ecoles21SciencesMobileScreen />} />
            <Route path="prorascience" element={<EleveProrascienceVitrineScreen />} />
            <Route path="version" element={<EleveVersionScreen />} />
          </Route>

          {/* Ancien parcours `/m/liri` → app élève unifiée (placeholders = écrans à re-designer dans le shell) */}
          <Route path="/m/liri" element={<Navigate to={ELEVE_MOBILE.home} replace />} />
          <Route path="/m/liri/courses" element={<Navigate to={ELEVE_MOBILE.bibliotheque} replace />} />
          <Route path="/m/liri/live" element={<Navigate to={ELEVE_MOBILE.live} replace />} />
          <Route path="/m/liri/calendar" element={<Navigate to={ELEVE_MOBILE.agenda} replace />} />
          <Route path="/m/liri/messages" element={<Navigate to={ELEVE_MOBILE.messages} replace />} />
          <Route path="/m/liri/client" element={<Navigate to={ELEVE_MOBILE.communaute} replace />} />
          <Route path="/m/liri/arena" element={<Navigate to={ELEVE_MOBILE.live} replace />} />
          <Route path="/m/liri/neuron" element={<Navigate to={ELEVE_MOBILE.neuron} replace />} />
          <Route path="/m/liri/post-live" element={<Navigate to={ELEVE_MOBILE.liveTermine} replace />} />
          <Route path="/m/liri/post-live/:sessionId" element={<LiriLegacyPostLiveBySessionRedirect />} />
          <Route path="/m/liri/shop" element={<Navigate to={ELEVE_MOBILE.shop} replace />} />
          <Route path="/m/liri/product/:id" element={<Navigate to={ELEVE_MOBILE.home} replace />} />
          <Route path="/m/liri/booking" element={<Navigate to={ELEVE_MOBILE.appointmentRequest} replace />} />
          <Route path="/m/liri/appointments" element={<Navigate to={ELEVE_MOBILE.agenda} replace />} />
          <Route path="/m/liri/orders" element={<Navigate to={ELEVE_MOBILE.bibliotheque} replace />} />
          <Route path="/m/liri/subscriptions" element={<Navigate to={ELEVE_MOBILE.forfaits} replace />} />
          <Route path="/m/liri/support" element={<Navigate to="/support" replace />} />
          <Route path="/m/liri/profile" element={<Navigate to={ELEVE_MOBILE.profile} replace />} />
          <Route path="/app" element={<AppMemberAccessPage />} />
          <Route path="/home" element={<Navigate to="/app" replace />} />
          <Route path="/landing" element={<LandingPage />} />
          {/* Maquettes portées en production : voir /t/isna et /t/isna/{ecole,temple,programme,mission,fondateur,doctrine} */}
          <Route path="/isna" element={<Navigate to={TENANT_ADMIN_PATH} replace />} /> {/* Legacy ISNA route - redirects to tenant system */}
          <Route path="/temple-ngowazulu" element={<PublicNgowazuluPage />} />
          <Route path="/vitrine" element={<SchoolVitrinePage />} />
          <Route path="/ecoles/prorascience" element={<ProrascienceCommercialPage />} />
          <Route path="/ecoles/prorascience-apple-story" element={
            <React.Suspense fallback={<div className="flex min-h-[100dvh] items-center justify-center bg-[#f7f8fb] text-slate-500">Chargement…</div>}>
              <ProrascienceAppleStoryLandingLazy />
            </React.Suspense>
          } />
          <Route path="/ecoles/prorascience-apple-story/" element={<Navigate to="/ecoles/prorascience-apple-story" replace />} />
          <Route path="/ecoles/apple-story" element={<Navigate to="/ecoles/prorascience-apple-story" replace />} />
          <Route path="/ecoles/prorascience-apple-story-v3" element={
            <React.Suspense fallback={<div className="flex min-h-[100dvh] items-center justify-center bg-[#06070c] text-white/60">Chargement…</div>}>
              <ProrascienceAppleStoryV3Lazy />
            </React.Suspense>
          } />
          <Route path="/ecoles/prorascience-apple-story-v3/" element={<Navigate to="/ecoles/prorascience-apple-story-v3" replace />} />
          <Route path="/ecoles/isna-pro" element={<Navigate to={TENANT_ADMIN_PATH} replace />} /> {/* Legacy ISNA route - redirects to tenant system */}
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <DashboardRedirect />
            </ProtectedRoute>
          } />
          <Route path="/dashboard/infrastructures" element={<DashboardInfrastructures />} />
          <Route path="/dashboard/infrastructure" element={<DashboardInfrastructure />} />
          <Route path="/dashboard/medos" element={<MedosDashboard />} />
          <Route path="/dashboard/medos/patients" element={<MedosPatients />} />
          <Route path="/dashboard/medos/patients/:id" element={<MedosPatientDetail />} />
          <Route path="/dashboard/medos/me" element={<MedosPatientPortal />} />
          <Route path="/dashboard/medos/me/notes" element={<MedosPatientPortal />} />
          <Route path="/dashboard/medos/me/record" element={<MedosPatientPortal />} />
          <Route path="/dashboard/medos/me/forms" element={<MedosPatientPortal />} />
          <Route path="/dashboard/medos/me/journal" element={<MedosPatientPortal />} />
          <Route path="/dashboard/medos/me/care" element={<MedosPatientPortal />} />
          <Route path="/dashboard/medos/me/exams" element={<MedosPatientPortal />} />
          <Route path="/dashboard/medos/me/prescriptions" element={<MedosPatientPortal />} />
          <Route path="/dashboard/medos/me/messages" element={<MedosPatientPortal />} />
          <Route path="/dashboard/mbolo" element={
            <ProtectedRoleRoute allowedRoles={['owner', 'admin']} allowTenantRole>
              <MboloCatalog />
            </ProtectedRoleRoute>
          } />
          <Route path="/dashboard/mbolo/orders" element={
            <ProtectedRoleRoute allowedRoles={['owner', 'admin']} allowTenantRole>
              <MboloOrders />
            </ProtectedRoleRoute>
          } />
          <Route path="/dashboard/billing" element={
            <ProtectedRoleRoute allowedRoles={['owner', 'admin']} allowTenantRole>
              <TenantBillingPage />
            </ProtectedRoleRoute>
          } />
          <Route path="/dashboard/payouts" element={
            <ProtectedRoleRoute allowedRoles={['owner', 'admin']} allowTenantRole>
              <TenantPayoutsPage />
            </ProtectedRoleRoute>
          } />
          <Route path="/dashboard/tools/masterclass-factory" element={
            <ProtectedRoleRoute allowedRoles={['teacher', 'admin', 'owner', 'secretariat']} allowTenantRole>
              <MasterclassFactoryPage />
            </ProtectedRoleRoute>
          } />
          <Route path="/dashboard/tools/masterclass-factory/analyse" element={
            <ProtectedRoleRoute allowedRoles={['teacher', 'admin', 'owner', 'secretariat']} allowTenantRole>
              <MasterclassFactoryAnalysePage />
            </ProtectedRoleRoute>
          } />
          <Route path="/dashboard/tools/smartboard" element={
            <ProtectedRoleRoute allowedRoles={['teacher', 'admin', 'owner', 'secretariat']} allowTenantRole>
              <SmartboardToolPage />
            </ProtectedRoleRoute>
          } />
          <Route path="/dashboard/liri/orchestrator-live" element={
            <ProtectedRoleRoute allowedRoles={['teacher', 'admin', 'owner', 'secretariat']} allowTenantRole>
              <OrchestratorLiveDashboardPage />
            </ProtectedRoleRoute>
          } />
          <Route path="/dashboard/liri/smartboard-stream" element={
            <ProtectedRoleRoute allowedRoles={['teacher', 'admin', 'owner', 'secretariat']} allowTenantRole>
              <SmartboardStreamingPage />
            </ProtectedRoleRoute>
          } />
          {/* Liri Brain — assistant IA conversationnel (multi-modèles). Nom canonique
              /liri/brain ; /dashboard/liri conservé en alias legacy (rétro-compat). */}
          <Route path="/liri/brain" element={
            <ProtectedRoleRoute allowedRoles={['teacher', 'admin', 'owner', 'secretariat']} allowTenantRole>
              <DashboardLiri />
            </ProtectedRoleRoute>
          } />
          <Route path="/dashboard/liri" element={
            <ProtectedRoleRoute allowedRoles={['teacher', 'admin', 'owner', 'secretariat']} allowTenantRole>
              <DashboardLiri />
            </ProtectedRoleRoute>
          } />
          <Route path="/liri" element={
            <ProtectedLiriRoute allowedRoles={['owner', 'admin', 'teacher', 'secretariat', 'student', 'practitioner', 'clinic_admin']} allowTenantRole>
              <LiriPortalPage />
            </ProtectedLiriRoute>
          } />
          {/* Gestion complète du compte tenant (profil, organisation, membres,
              facturation, encaissements, suppression) — hub du portail LIRI. */}
          <Route path="/liri/compte" element={
            <ProtectedLiriRoute allowedRoles={['owner', 'admin', 'teacher', 'secretariat', 'student', 'practitioner', 'clinic_admin']} allowTenantRole>
              <LiriAccountPage />
            </ProtectedLiriRoute>
          } />
          {/* « Mes finances » : solde encaissé (mobile money) + retrait vers Airtel/Moov
              via pawaPay. Mouvement d'argent réel → owner/admin uniquement. */}
          <Route path="/liri/finances" element={
            <ProtectedLiriRoute allowedRoles={['owner', 'admin']} allowTenantRole>
              <LiriFinancesPage />
            </ProtectedLiriRoute>
          } />
          {/* Module ÉCOLE HORIZONTAL : le back-office école monté DANS le portail LIRI
              (pour un tenant LIRI sans site vertical /t/:slug). */}
          {/* Onglet École = back-office complet (owner/admin) embarqué dans le portail.
              Restreint owner/admin : il expose Finances/Utilisateurs/Paramètres (anti-escalade). */}
          <Route path="/liri/ecole" element={
            <ProtectedLiriRoute allowedRoles={['owner', 'admin']} allowTenantRole>
              <LiriEcolePage />
            </ProtectedLiriRoute>
          } />
          {/* Services — catalogue vendable du tenant DANS le portail LIRI (remplace le
              « Catalogue & tarifs » d'Academy). Créateur only (owner/admin). */}
          <Route path="/liri/services" element={
            <ProtectedLiriRoute allowedRoles={['owner', 'admin']} allowTenantRole>
              <LiriServicesPage />
            </ProtectedLiriRoute>
          } />
          {/* Forfaits — cycles/offres du tenant DANS le portail LIRI (membres) : remplace l'ancienne
              vitrine standalone « Prorascience PORTAIL » (/forfaits). Visiteurs → agent immersif. */}
          <Route path="/liri/forfaits" element={
            <ProtectedLiriRoute allowedRoles={['owner', 'admin', 'teacher', 'secretariat', 'student', 'practitioner', 'clinic_admin']} allowTenantRole>
              <LiriForfaitsPage />
            </ProtectedLiriRoute>
          } />
          {/* Temple Ngowazulu (Pôle Temple) DANS le portail LIRI — 7 sections (tables ngowazulu_*).
              Membres. Remplace la page standalone /ngowazulu. */}
          <Route path="/liri/temple" element={
            <ProtectedLiriRoute allowedRoles={['owner', 'admin', 'teacher', 'secretariat', 'student', 'practitioner', 'clinic_admin']} allowTenantRole>
              <LiriTemplePage />
            </ProtectedLiriRoute>
          } />
          <Route path="/liri/temple/:section" element={
            <ProtectedLiriRoute allowedRoles={['owner', 'admin', 'teacher', 'secretariat', 'student', 'practitioner', 'clinic_admin']} allowTenantRole>
              <LiriTemplePage />
            </ProtectedLiriRoute>
          } />
          {/* Boutique Sacrée Ngowazulu DANS le portail LIRI. Remplace /boutique-sacree standalone. */}
          <Route path="/liri/boutique" element={
            <ProtectedLiriRoute allowedRoles={['owner', 'admin', 'teacher', 'secretariat', 'student', 'practitioner', 'clinic_admin']} allowTenantRole>
              <LiriBoutiquePage />
            </ProtectedLiriRoute>
          } />
          {/* Contenu du site — éditeur du KNOWLEDGE PACK OS (identité/fondateur/vision/offres/FAQ)
              que l'agent immersif Cimolace OS lit pour RENDRE le site public. Créateur only. */}
          <Route path="/liri/contenu" element={
            <ProtectedLiriRoute allowedRoles={['owner', 'admin']} allowTenantRole>
              <LiriContenuPage />
            </ProtectedLiriRoute>
          } />
          {/* Pages — éditeur no-code de pages du tenant DANS le portail LIRI (blocs → /iri/pages,
              publiées à <host>/p/:slug). Créateur only (owner/admin). */}
          <Route path="/liri/pages" element={
            <ProtectedLiriRoute allowedRoles={['owner', 'admin']} allowTenantRole>
              <LiriPagesPage />
            </ProtectedLiriRoute>
          } />
          <Route path="/liri/ecole/knowledge-base" element={
            <ProtectedLiriRoute allowedRoles={['owner', 'admin']} allowTenantRole>
              <KnowledgeBaseManager />
            </ProtectedLiriRoute>
          } />
          {/* Forum CONNECTÉ + messagerie immersive comme app du portail (au lieu de /dashboard).
              Splat /* pour garder les sous-pages (new / thread) dans le portail. */}
          <Route path="/liri/forum/*" element={
            <ProtectedLiriRoute allowedRoles={['owner', 'admin', 'teacher', 'secretariat', 'student', 'practitioner', 'clinic_admin']} allowTenantRole>
              <LiriForumPage />
            </ProtectedLiriRoute>
          } />
          {/* Messagerie immersive comme app du portail LIRI (shell du portail au lieu de la
              coque plein écran). Même garde d'accès que /messages (ProtectedImmersiveMessagingRoute). */}
          <Route path="/liri/messages" element={
            <ProtectedImmersiveMessagingRoute>
              <LiriMessagesPage />
            </ProtectedImmersiveMessagingRoute>
          } />

          {/* ═══ ISNA Academy EMBARQUÉ : les pages « Vie scolaire » de l'élève montées DANS
              le shell chaud du portail LIRI (LiriSchoolShell). Même garde que /liri/forum
              (student + créateurs, allowTenantRole). L'élève garde agenda/notes/cours/etc.
              sans jamais quitter LIRI. ═══ */}
          <Route path="/liri/semaine" element={<ProtectedLiriRoute allowedRoles={['owner', 'admin', 'teacher', 'secretariat', 'student', 'practitioner', 'clinic_admin']} allowTenantRole><LiriSchoolShell active="semaine"><StudentWeeklySchedulePage /></LiriSchoolShell></ProtectedLiriRoute>} />
          <Route path="/liri/formations" element={<ProtectedLiriRoute allowedRoles={['owner', 'admin', 'teacher', 'secretariat', 'student', 'practitioner', 'clinic_admin']} allowTenantRole><LiriSchoolShell active="formations"><StudentFormationsOsPage /></LiriSchoolShell></ProtectedLiriRoute>} />
          <Route path="/liri/vie-scolaire" element={<ProtectedLiriRoute allowedRoles={['owner', 'admin', 'teacher', 'secretariat', 'student', 'practitioner', 'clinic_admin']} allowTenantRole><LiriSchoolShell active="vie-scolaire"><SchoolLifePage embedded /></LiriSchoolShell></ProtectedLiriRoute>} />
          <Route path="/liri/agenda" element={<ProtectedLiriRoute allowedRoles={['owner', 'admin', 'teacher', 'secretariat', 'student', 'practitioner', 'clinic_admin']} allowTenantRole><LiriSchoolShell active="agenda"><StudentAgendaPage /></LiriSchoolShell></ProtectedLiriRoute>} />
          {/* Prise de rendez-vous EMBARQUÉE dans LIRI (anti-fuite : la version standalone /appointment/request est une page ISNA pleine). */}
          <Route path="/liri/rendez-vous" element={<ProtectedLiriRoute allowedRoles={['owner', 'admin', 'teacher', 'secretariat', 'student', 'practitioner', 'clinic_admin']} allowTenantRole><LiriRendezVousPage /></ProtectedLiriRoute>} />
          <Route path="/liri/notes" element={<ProtectedLiriRoute allowedRoles={['owner', 'admin', 'teacher', 'secretariat', 'student', 'practitioner', 'clinic_admin']} allowTenantRole><LiriSchoolShell active="notes"><StudentNotesHubPage /></LiriSchoolShell></ProtectedLiriRoute>} />
          <Route path="/liri/evaluations" element={<ProtectedLiriRoute allowedRoles={['owner', 'admin', 'teacher', 'secretariat', 'student', 'practitioner', 'clinic_admin']} allowTenantRole><LiriSchoolShell active="evaluations"><StudentEvaluationsPage /></LiriSchoolShell></ProtectedLiriRoute>} />
          <Route path="/liri/absences" element={<ProtectedLiriRoute allowedRoles={['owner', 'admin', 'teacher', 'secretariat', 'student', 'practitioner', 'clinic_admin']} allowTenantRole><LiriSchoolShell active="absences"><StudentAbsencesPage /></LiriSchoolShell></ProtectedLiriRoute>} />
          <Route path="/liri/bibliotheque" element={<ProtectedLiriRoute allowedRoles={['owner', 'admin', 'teacher', 'secretariat', 'student', 'practitioner', 'clinic_admin']} allowTenantRole><LiriSchoolShell active="biblio-eleve"><BibliothequePage embedded /></LiriSchoolShell></ProtectedLiriRoute>} />
          <Route path="/liri/documents" element={<ProtectedLiriRoute allowedRoles={['owner', 'admin', 'teacher', 'secretariat', 'student', 'practitioner', 'clinic_admin']} allowTenantRole><LiriSchoolShell active="documents"><StudentDocumentsPage /></LiriSchoolShell></ProtectedLiriRoute>} />
          <Route path="/liri/profil" element={<ProtectedLiriRoute allowedRoles={['owner', 'admin', 'teacher', 'secretariat', 'student', 'practitioner', 'clinic_admin']} allowTenantRole><LiriSchoolShell active="accueil"><StudentProfilePage /></LiriSchoolShell></ProtectedLiriRoute>} />
          {/* Homes /liri des 4 sous-fonctions autrefois orphelines de /student-school-life (lecteur cours,
              neuro-recall, lecteur livre, ressources) → plus rien n'est perdu au retrait de l'espace legacy. */}
          <Route path="/liri/cours/:courseId" element={<ProtectedLiriRoute allowedRoles={['owner', 'admin', 'teacher', 'secretariat', 'student', 'practitioner', 'clinic_admin']} allowTenantRole><LiriSchoolShell active="formations"><Suspense fallback={null}><TenantCourseDetailPage /></Suspense></LiriSchoolShell></ProtectedLiriRoute>} />
          <Route path="/liri/neuro-recall" element={<ProtectedLiriRoute allowedRoles={['owner', 'admin', 'teacher', 'secretariat', 'student', 'practitioner', 'clinic_admin']} allowTenantRole><LiriSchoolShell active="formations"><StudentNeuroRecallPage /></LiriSchoolShell></ProtectedLiriRoute>} />
          <Route path="/liri/bibliotheque/:bookId" element={<ProtectedLiriRoute allowedRoles={['owner', 'admin', 'teacher', 'secretariat', 'student', 'practitioner', 'clinic_admin']} allowTenantRole><LiriBookReaderPage /></ProtectedLiriRoute>} />
          <Route path="/liri/bibliotheque-ressources" element={<ProtectedLiriRoute allowedRoles={['owner', 'admin', 'teacher', 'secretariat', 'student', 'practitioner', 'clinic_admin']} allowTenantRole><LiriSchoolShell active="biblio-eleve"><LibraryPage embedded /></LiriSchoolShell></ProtectedLiriRoute>} />

          <Route path="/choose-account-type" element={
            <ProtectedRoute>
              <ChooseAccountTypePage />
            </ProtectedRoute>
          } />

          <Route path="/secretariat" element={
            <ProtectedRoleRoute allowedRoles={['secretariat', 'admin', 'owner']} allowTenantRole>
              <Navigate to="/secretariat-space/dashboard" replace />
            </ProtectedRoleRoute>
          } />
          <Route path="/secretariat-space" element={
            <ProtectedRoleRoute allowedRoles={['secretariat', 'admin', 'owner']} allowTenantRole>
              <Navigate to="/secretariat-space/dashboard" replace />
            </ProtectedRoleRoute>
          } />
          <Route path="/secretariat-space/*" element={
            <ProtectedRoleRoute allowedRoles={['secretariat', 'admin', 'owner']} allowTenantRole>
              <ErrorBoundary logTag="SecretariatPortal" showDetailsInDev>
                <SecretariatPortalPage />
              </ErrorBoundary>
            </ProtectedRoleRoute>
          } />
          
          <Route path="/login" element={
            <RedirectIfAuthenticated>
              <LoginPage />
            </RedirectIfAuthenticated>
          } />
          <Route path="/signup" element={
            <RedirectIfAuthenticated>
              <SignupPage />
            </RedirectIfAuthenticated>
          } />
          {/* Onboarding self-service LIRI — créer son organisation (POST /signup/tenant) */}
          <Route path="/creer-organisation" element={<OnboardingOrgPage />} />
          {/* Assistant conversationnel immersif (preview L1) — présence 5 états + parler-à-la-présence */}
          <Route path="/creer-organisation/agent" element={<CimolaceCreationAgent />} />
          {/* Rejoindre une organisation par slug (self-join) — accessible connecté OU non */}
          <Route path="/rejoindre" element={<JoinOrgPage />} />
          {/* Academy RETIRÉ : /prorascience allait vers l'ancien login Academy → portail LIRI. */}
          <Route path="/prorascience" element={<Navigate to="/liri" replace />} />
          {/* Alias publics — le lien "Inscription" du menu vitrine ne doit pas faire 404 */}
          <Route path="/inscription" element={<Navigate to="/signup" replace />} />
          <Route path="/register" element={<Navigate to="/signup" replace />} />
          
          <Route path="/isna/produits" element={<Navigate to={TENANT_COURSES_PATH} replace />} /> {/* Legacy ISNA route - redirects to tenant system */}
          <Route path="/isna/produits/:slug" element={<Navigate to={TENANT_COURSES_PATH} replace />} /> {/* Legacy ISNA route - redirects to tenant system */}
          <Route path="/products" element={<ProductsPage />} />
          <Route path="/boutique" element={<MboloStorefrontPage />} />
          {/* Boutique Sacrée : membre → /liri/boutique (portail) ; visiteur → page publique. */}
          <Route path="/boutique-sacree" element={<BoutiqueGateRedirect />} />
          <Route path="/services-spirituels" element={<ServicesSpirituelsPage />} />
          <Route path="/product/:id" element={<ProductDetailPage />} />
          <Route path="/checkout-success" element={<CheckoutSuccessPage />} />
          <Route path="/billing/checkout/:id" element={<BillingCheckoutPage />} />
          <Route path="/billing/activate-license" element={
            <ProtectedRoute>
              <LicenseActivationPage />
            </ProtectedRoute>
          } />
          <Route path="/redeem/:slug" element={<RedeemPrivilegedLinkPage />} />

          {/* === PUBLIC FORMATIONS & PRICING — pas de ProtectedRoute : le prospect doit voir les prix avant de s'inscrire === */}
          {/* Realm-neutre : /formations & /catalogue → liste publique (PublicFormationsPage via /formations/list). JAMAIS de redirection vers /t/:slug — sur le host neutre (liri.cimolace.space) ça basculerait le visiteur dans le tenant ISNA (fuite cross-realm ANY→ISNA). */}
          <Route path="/formations" element={<Navigate to="/formations/list" replace />} />
          <Route path="/forfaits" element={<ForfaitsGateRedirect />} />
          <Route path="/pricing" element={<Navigate to="/forfaits" replace />} />
          <Route path="/formation/:id/learn" element={
            <ProtectedRoute>
              <CoursePlayerInterface />
            </ProtectedRoute>
          } />
          <Route path="/formation/:id/forum" element={
            <ProtectedRoute>
              <FormationForumPage />
            </ProtectedRoute>
          } />
          <Route path="/formation/:id" element={<FormationDetailPage />} />
          <Route path="/masterclasses" element={
            <ProtectedRoute>
              <MasterclassesListPage />
            </ProtectedRoute>
          } />
          <Route path="/classes" element={
            <ProtectedRoute>
              <ClassesAdminPage />
            </ProtectedRoute>
          } />
          <Route path="/cours/:courseId/deblocage" element={
            <ProtectedRoute>
              <CourseUnlockAdminPage />
            </ProtectedRoute>
          } />
          <Route path="/masterclass/:masterclassId" element={
            <ProtectedRoute>
              <MasterclassRoomPage />
            </ProtectedRoute>
          } />
          <Route path="/formations/list" element={<PublicFormationsPage />} />
          <Route path="/cours-publics" element={<Navigate to="/formations/list" replace />} />

          <Route path="/catalogue" element={<Navigate to="/formations/list" replace />} /> {/* alias realm-neutre — cf. /formations ci-dessus */}

          <Route path="/create-owner-account" element={<CreateOwnerAccountPage />} />
          <Route path="/verify-owner" element={<VerifyOwnerPage />} />
          <Route path="/contact" element={<Navigate to="/nous-contacter" replace />} />
          <Route path="/formations-packages" element={<Navigate to="/forfaits" replace />} />
          {/* Checkout PROPRE (domaine tenant) : sur prorascience.org tous les CTA de
              paiement atterrissent ici (soit /paiement direct, soit /t/isna/paiement
              strippé par CimolaceDomainHandler). PaiementPage résout le tenant via
              tenantSlug||DEFAULT_TENANT_SLUG → fonctionne sans :tenantSlug dans l'URL. */}
          <Route path="/paiement" element={<PaiementPage />} />
          {/* Activation OTP (domaine tenant) : le lien de l'email d'accès /t/:slug/activer
              est strippé en /activer par CimolaceDomainHandler sur prorascience.org.
              ActivateAccountPage résout tenantSlug||DEFAULT_TENANT_SLUG. */}
          <Route path="/activer" element={<ActivateAccountPage />} />

          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          {/* Cross-app SSO landing (med-app → immersive room, no second login) */}
          <Route path="/handoff" element={<HandoffPage />} />
          <Route path="/update-password" element={<UpdatePasswordPage />} />
          <Route path="/cart" element={<PlaceholderPage title="Panier" />} />
          <Route path="/consultations" element={<Navigate to="/appointment/request?flow=ngowazulu-consultation" replace />} />
          <Route path="/projects" element={<PlaceholderPage title="Projets" />} />

          <Route path="/eleve" element={<Navigate to="/dashboard" replace />} />
          <Route path="/professeur" element={<Navigate to="/dashboard" replace />} />

          <Route path="/modules/panier" element={<ModuleCartPage />} />
          <Route path="/modules/year2-catalog" element={<ModuleCatalogPageNew />} />
          <Route path="/curriculum/second-year" element={<SecondYearCurriculumPage />} />
          <Route path="/year2-modules" element={<SecondYearCatalogPage />} />
          <Route path="/year3-modules" element={<Navigate to="/modules" replace />} />
          <Route path="/vie-scolaire/notebook" element={<Navigate to="/notebook" replace />} />

          <Route path="/student/practice-journal" element={
            <ProtectedRoute>
              <PracticeJournalPage />
            </ProtectedRoute>
          } />

          {/* === SECRETARIAT DEAD LINKS (PLACEHOLDERS/CONTENT) === */}
          <Route path="/courses" element={
            <ProtectedRoleRoute allowedRoles={['secretariat', 'admin', 'owner']} allowTenantRole>
              <Navigate to="/secretariat-space/courses" replace />
            </ProtectedRoleRoute>
          } />
          <Route path="/teachers" element={
            <ProtectedRoleRoute allowedRoles={['secretariat', 'admin', 'owner']} allowTenantRole>
              <Navigate to="/secretariat-space/teachers" replace />
            </ProtectedRoleRoute>
          } />
          <Route path="/how-it-works" element={
            <ProtectedRoleRoute allowedRoles={['secretariat', 'admin', 'owner']} allowTenantRole>
              <Navigate to="/secretariat-space/how-it-works" replace />
            </ProtectedRoleRoute>
          } />
          <Route path="/cycles/:id" element={
            <ProtectedRoleRoute allowedRoles={['secretariat', 'admin', 'owner']} allowTenantRole>
              <LegacyCycleRedirect />
            </ProtectedRoleRoute>
          } />

          {/* === ADMIN (PROTECTED) === */}
          <Route path="/admin" element={
            <ProtectedRoleRoute allowedRoles={['admin', 'owner']} allowTenantRole>
              <AdminDashboardPage />
            </ProtectedRoleRoute>
          } />
          <Route path="/admin/users" element={
            <ProtectedRoleRoute allowedRoles={['admin', 'owner']} allowTenantRole>
              <UsersAdminPage />
            </ProtectedRoleRoute>
          } />
          <Route path="/admin/logs" element={
            <ProtectedRoleRoute allowedRoles={['admin', 'owner']} allowTenantRole>
              <AuditLogsPage />
            </ProtectedRoleRoute>
          } />
          <Route path="/admin/payments" element={
            <ProtectedRoleRoute allowedRoles={['admin', 'owner']} allowTenantRole>
              <AdminPaymentsPage />
            </ProtectedRoleRoute>
          } />
          <Route path="/admin/students" element={
            <ProtectedRoleRoute allowedRoles={['admin', 'owner']} allowTenantRole>
              <AdminStudentsPage />
            </ProtectedRoleRoute>
          } />
          <Route path="/admin/settings" element={
            <ProtectedRoleRoute allowedRoles={['admin', 'owner']} allowTenantRole>
              <AdminSettingsPage />
            </ProtectedRoleRoute>
          } />
          <Route path="/admin/content" element={
            <ProtectedRoleRoute allowedRoles={['admin', 'owner']} allowTenantRole>
              <AdminContentEditorPage />
            </ProtectedRoleRoute>
          } />
          <Route path="/admin/billing" element={
            <ProtectedRoleRoute allowedRoles={['admin', 'owner']} allowTenantRole>
              <AdminBillingPage />
            </ProtectedRoleRoute>
          } />
          <Route path="/admin/iri" element={
            <ProtectedRoleRoute allowedRoles={['admin', 'owner']} allowTenantRole>
              <AdminIriBuilderPage />
            </ProtectedRoleRoute>
          } />
          <Route path="/admin/marketing" element={
            <ProtectedRoleRoute allowedRoles={['admin', 'owner']} allowTenantRole>
              <AdminMarketingPage />
            </ProtectedRoleRoute>
          } />
          <Route path="/admin/tenants/:tenantId/embed" element={
            <ProtectedRoleRoute allowedRoles={['admin', 'owner']} allowTenantRole>
              <AdminTenantEmbedPage />
            </ProtectedRoleRoute>
          } />
          <Route path="/admin/tenants/:tenantId/branding" element={
            <ProtectedRoleRoute allowedRoles={['admin', 'owner']} allowTenantRole>
              <AdminTenantBrandingPage />
            </ProtectedRoleRoute>
          } />
          <Route path="/admin/marketing/tools" element={
            <ProtectedRoleRoute allowedRoles={['admin', 'owner']} allowTenantRole>
              <MarketingToolsSuitePage />
            </ProtectedRoleRoute>
          } />
          <Route path="/admin/communities" element={
            <ProtectedRoleRoute allowedRoles={['admin', 'owner']} allowTenantRole>
              <AdminCommunitiesPage />
            </ProtectedRoleRoute>
          } />

          {/* === COMMUNITÉS (AUTHENTICATED) === */}
          <Route path="/community" element={
            <ProtectedRoute>
              <CommunityListPage />
            </ProtectedRoute>
          } />
          <Route path="/community/:id" element={
            <ProtectedRoute>
              <CommunityChatPage />
            </ProtectedRoute>
          } />

          <Route path="/appointment/request" element={
            <ProtectedRoute>
              <RequestAppointmentPage />
            </ProtectedRoute>
          } />

          {/* Immersive Waiting Room — accessible publiquement via référence */}
          <Route path="/rendez-vous/:reference" element={<ImmersiveWaitingRoomPage />} />
          <Route path="/rendez-vous" element={<ImmersiveWaitingRoomPage />} />

          {/* Enquête de satisfaction — lien tokenisé (public, pas d'auth) */}
          <Route path="/avis/:token" element={<SatisfactionPage />} />

          <Route path="/prospect/entretien" element={
            <ProtectedRoute>
              <ProspectInterviewLoungePage />
            </ProtectedRoute>
          } />
          <Route path="/onboarding" element={<OnboardingPage />} />
          <Route path="/onboarding/eleve" element={
            <ProtectedSubscriptionRoute>
              <StudentEnrollmentOnboardingPage />
            </ProtectedSubscriptionRoute>
          } />
          <Route path="/ngowazulu/dossier" element={
            <ProtectedRoute>
              <NgowazuluIntakePage />
            </ProtectedRoute>
          } />
          {/* Temple Ngowazulu RETIRÉ du standalone → embarqué dans /liri/temple (portail LIRI). */}
          <Route path="/ngowazulu" element={<NgowazuluTempleRedirect />} />
          <Route path="/ngowazulu/:section" element={<NgowazuluTempleRedirect />} />

          {/* === STUDENT SCHOOL LIFE (AUTHENTICATED) === */}

          {/* Main Dashboard entry point */}
          {/* 🎨 DESIGN PREVIEW — guards désactivés temporairement */}
          {/* Doublon legacy (même composant que /liri/semaine, guards en preview) → portail LIRI. */}
          <Route path="/student-school-life/semaine-courante" element={<Navigate to="/liri/semaine" replace />} />
          {/* Ancien espace élève legacy → portail LIRI (web) ; conservé pour l'app mobile native. */}
          <Route path="/student-school-life/*" element={<StudentSchoolLifeGate />} />

          {/* === CLASSROOM ROUTES (PROTECTED) === */}
          <Route path="/classroom" element={
            <ProtectedSubscriptionRoute>
              <ClassroomPage />
            </ProtectedSubscriptionRoute>
          } /> 
          <Route path="/classroom/:weekId" element={
            <ProtectedSubscriptionRoute>
              <ClassroomPage />
            </ProtectedSubscriptionRoute>
          } /> 
          <Route path="/classroom/archive" element={
            <ProtectedSubscriptionRoute>
              <ClassroomArchivePage />
            </ProtectedSubscriptionRoute>
          } />
          
          <Route path="/classroom/live" element={
            <ProtectedSubscriptionRoute>
              <LiveClassesPage />
            </ProtectedSubscriptionRoute>
          } />
          <Route path="/classroom/live/:classId" element={
            <ProtectedSubscriptionRoute>
              <LiveClassroomPage />
            </ProtectedSubscriptionRoute>
          } />
          {/* /live/:sessionId est défini plus bas avec LiveHostPage (invité) — ne pas dupliquer ici */}
          <Route path="/classroom/videos" element={
            <ProtectedSubscriptionRoute>
              <VideoFormationsPage />
            </ProtectedSubscriptionRoute>
          } />
          <Route path="/classroom/video" element={
            <ProtectedSubscriptionRoute>
              <VideoPlayerPage />
            </ProtectedSubscriptionRoute>
          } />
          <Route path="/classroom/video/:formationId/:moduleId/:weekId/:dayId" element={
            <ProtectedSubscriptionRoute>
              <VideoPlayerPage />
            </ProtectedSubscriptionRoute>
          } />

          {/* === NEW ROUTES === */}
          <Route path="/messages" element={
            <ProtectedImmersiveMessagingRoute>
              <LazyChunkErrorBoundary>
                <Suspense
                  fallback={
                    <div className="flex h-[calc(100dvh-5rem)] w-full items-center justify-center bg-[#090D14]">
                      <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#d97757] border-t-transparent" />
                    </div>
                  }
                >
                  <MessagingPage />
                </Suspense>
              </LazyChunkErrorBoundary>
            </ProtectedImmersiveMessagingRoute>
          } />
          <Route path="/notifications" element={
            <ProtectedRoute>
              <NotificationCenter />
            </ProtectedRoute>
          } />
          <Route path="/settings/notifications" element={
            <ProtectedRoute>
              <NotificationSettings />
            </ProtectedRoute>
          } />
          <Route path="/support" element={
            <ProtectedRoute>
              <SupportPage />
            </ProtectedRoute>
          } />
          <Route path="/coaching-sessions" element={
            <ProtectedRoute>
              <StudentSessionBooking />
            </ProtectedRoute>
          } />
          <Route path="/workshops" element={
            <ProtectedRoute>
              <StudentWorkshopRegistration />
            </ProtectedRoute>
          } />
          
          {/* Admin / Owner Specific */}
          <Route path="/reports" element={
            <ProtectedRoleRoute allowedRoles={['admin', 'owner']} allowTenantRole>
              <ReportsPage />
            </ProtectedRoleRoute>
          } />
          <Route path="/settings" element={
            <ProtectedRoleRoute allowedRoles={['admin', 'owner']} allowTenantRole>
              <SettingsPage />
            </ProtectedRoleRoute>
          } />
          <Route path="/settings/2fa" element={
            <ProtectedRoleRoute allowedRoles={['admin', 'owner']} allowTenantRole>
              <TwoFASetupPage />
            </ProtectedRoleRoute>
          } />
          
          {/* Student Specific */}
          <Route path="/my-certificates" element={
            <ProtectedRoute>
              <StudentCertificatesPage />
            </ProtectedRoute>
          } />

          <Route path="/lives" element={
            <ProtectedRoute>
              <LivesLibraryPage />
            </ProtectedRoute>
          } />
          <Route path="/lesson/:contentId" element={
            <ProtectedSubscriptionRoute>
              <LessonPlayerPage />
            </ProtectedSubscriptionRoute>
          } />
          <Route path="/course-player/:yearId/:moduleId/:weekId/:dayId" element={
            <ProtectedSubscriptionRoute>
              <CoursePlayerInterface />
            </ProtectedSubscriptionRoute>
          } />
          <Route path="/notebook" element={
            <ProtectedSubscriptionRoute>
              <StudentNotebook />
            </ProtectedSubscriptionRoute>
          } />
          
          {/* Admin Dashboard Routes */}
          <Route path="/creator-dashboard" element={
            <ProtectedRoleRoute allowedRoles={['creator', 'admin', 'owner']} allowTenantRole>
              <CreatorDashboardShell />
            </ProtectedRoleRoute>
          } />
          <Route path="/teacher-dashboard" element={
            <ProtectedRoleRoute allowedRoles={['teacher', 'admin', 'owner']} allowTenantRole>
              <Navigate to="/teacher-space/dashboard" replace />
            </ProtectedRoleRoute>
          } />
          <Route path="/teacher-space/*" element={
            <ProtectedRoleRoute allowedRoles={['teacher', 'admin', 'owner', 'secretariat']} allowTenantRole>
              <TeacherPortalPage />
            </ProtectedRoleRoute>
          } />

          {/* Studio de création de contenu — Hub central.
              `practitioner` / `clinic_admin` ajoutés pour la téléconsultation MEDOS :
              le praticien ouvre la salle immersive Liri (/studio/live-arena/:id) avec
              SmartBoard. Additif — n'enlève l'accès à personne. */}
          {/* Salle live/téléconsult immersive : AUTH-ONLY. Autorisée par la session
              (RLS sur live_sessions), PAS par le rôle école ISNA — un praticien d'un
              autre tenant (ex: zahirwellness owner) n'a pas de profiles.role école, et
              son tenant_role vit dans le JWT (que supabase n'expose pas via user.app_metadata).
              Route plus spécifique que /studio/* → priorité React Router v6. */}
          <Route path="/studio/live-arena/:sessionId" element={
            <ProtectedRoleRoute allowedRoles={[]} allowTenantRole>
              <LiveHostPage />
            </ProtectedRoleRoute>
          } />
          <Route path="/studio/*" element={
            <ProtectedLiriRoute allowedRoles={['teacher', 'admin', 'owner', 'secretariat', 'practitioner', 'clinic_admin']} allowTenantRole>
              <StudioRouter />
            </ProtectedLiriRoute>
          } />

          {/* Téléphone QR — rejoint la room immersive sans login (doit être avant /live/:sessionId) */}
          <Route path="/live/phone" element={<ImmersivePhoneCompanionPage />} />

          {/* Caméra mobile QR — classroom LIRI (doit être avant /live/:sessionId) */}
          <Route path="/live/mobile-camera" element={<LiveMobileCameraPage />} />

          {/* Vue hôte LIRI — web uniquement ; l'app native redirige vers /m/eleve/live */}
          <Route path="/live/host/:sessionId" element={
            <ProtectedRoute>
              <LiveHostPageNativeGate />
            </ProtectedRoute>
          } />

          {/* Salle de CONSULTATION (mode dédié, role-aware) — vidéo face-à-face +
              cockpit clinique MEDOS. Praticien (host) ET patient/proche (guest) y
              atterrissent ; le rôle est résolu via /med/teleconsult/:id/clinical-context.
              Token via le chemin médical. AUTH-ONLY (handoff SSO depuis med-app / portail). */}
          <Route path="/teleconsult/:sessionId" element={
            <ProtectedRoute>
              <ErrorBoundary>
                <Suspense fallback={<ImmersiveBootLoader />}>
                  <ConsultationRoom />
                </Suspense>
              </ErrorBoundary>
            </ProtectedRoute>
          } />

          {/* Salle du PROCHE invité — PUBLIQUE (pas de compte tenant). L'accès est
              gardé par le token d'invitation + le consentement RGPD du patient. */}
          <Route path="/teleconsult/:id/proche/:inviteId" element={
            <ErrorBoundary>
              <Suspense fallback={<ImmersiveBootLoader message="Préparation de votre accès sécurisé…" />}>
                <ProcheRoom />
              </Suspense>
            </ErrorBoundary>
          } />

          {/* LIEN DE GROUPE — auto-inscription PUBLIQUE : la personne saisit son nom,
              on lui crée un siège unique puis on la renvoie vers sa salle d'attente. */}
          <Route path="/teleconsult/:id/rejoindre" element={
            <ErrorBoundary>
              <Suspense fallback={<ImmersiveBootLoader message="Préparation de votre accès sécurisé…" />}>
                <TeleconsultJoinPage />
              </Suspense>
            </ErrorBoundary>
          } />

          {/* Invité — alias URL explicite (avant /live/:sessionId pour éviter de capturer « invit » comme id) */}
          <Route path="/live/invit/:sessionId" element={
            <ProtectedRoute>
              <ErrorBoundary>
                <LiveGuestPage />
              </ErrorBoundary>
            </ProtectedRoute>
          } />

          {/* Live PAYANT — invité SANS login (lien token-gaté après achat sur le site tenant).
              Route PUBLIQUE (pas de ProtectedRoute) ; la barrière réelle est le token invité serveur. */}
          <Route path="/live/:sessionId/invite/:inviteId" element={
            <ErrorBoundary>
              <LiveInvitePage />
            </ErrorBoundary>
          } />

          {/* Lien d'invitation live — accessible à tout membre connecté */}
          <Route path="/live/:sessionId" element={
            <ProtectedRoute>
              <ErrorBoundary>
                <LiveGuestPage />
              </ErrorBoundary>
            </ProtectedRoute>
          } />

          {/* Maquette salle d'attente (design local, sans session ni login) — avant :sessionId */}
          <Route path="/live/waiting/maquette" element={<LiveWaitingRoomMaquettePage />} />

          {/* Salle d'attente intelligente (Smart Entry / LIRI) */}
          <Route path="/live/waiting/:sessionId" element={
            <ProtectedRoute>
              <LiveWaitingRoomPage />
            </ProtectedRoute>
          } />

          <Route path="/teacher/corrections" element={
            <ProtectedRoleRoute allowedRoles={['teacher', 'admin', 'owner']} allowTenantRole>
              <Navigate to="/teacher-space/corrections" replace />
            </ProtectedRoleRoute>
          } />
          <Route path="/live-manager" element={
            <ProtectedRoleRoute allowedRoles={['teacher', 'admin', 'owner']} allowTenantRole>
              <Navigate to="/teacher-space/live" replace />
            </ProtectedRoleRoute>
          } />
          <Route path="/teacher/classroom/:weekId" element={
            <ProtectedRoleRoute allowedRoles={['teacher', 'admin', 'owner']} allowTenantRole>
              <Navigate to="/teacher-space/classroom" replace />
            </ProtectedRoleRoute>
          } />

          {/* Back-office UNIFIÉ : /owner-dashboard → onglet École du portail (/liri/ecole),
              query préservée. Le vieux shell séparé « style isna » n'est plus monté. */}
          <Route path="/owner-dashboard" element={<OwnerDashboardLegacyRedirect />} />

          {/* Redirigé vers le studio LIRI (dans le portail) — plus de bounce owner→domaine tenant (prorascience.org / ISNA). */}
          <Route path="/owner-dashboard/post-production/:contentId" element={<OwnerPostProdRedirect />} />

          {/* Doublon legacy (même composant que /liri/ecole/knowledge-base, 0 caller) → portail LIRI. */}
          <Route path="/owner-dashboard/knowledge-base" element={<Navigate to="/liri/ecole/knowledge-base" replace />} />

          {/* Forum admin = forum riche élève (StudentForumRedesign monté dans l'onglet ?tab=forum).
              Ses sous-pages sont des chemins (forumBase dérivé de l'URL) → on les route ici sous
              /owner-dashboard/forum/* pour que « Retour au forum » revienne sur l'onglet. */}
          <Route path="/owner-dashboard/forum" element={<OwnerForumIndexRedirect />} />
          <Route path="/owner-dashboard/forum/new" element={
            <ProtectedOwnerRoute>
              <ForumNewQuestionPage />
            </ProtectedOwnerRoute>
          } />
          <Route path="/owner-dashboard/forum/thread/:threadId" element={
            <ProtectedOwnerRoute>
              <ForumThreadPage />
            </ProtectedOwnerRoute>
          } />

          {/* Forum secrétariat — mêmes sous-pages immersives (fil / nouvelle question). */}
          <Route path="/secretariat-space/forum/new" element={
            <ProtectedRoleRoute allowedRoles={['secretariat', 'admin', 'owner']} allowTenantRole>
              <ForumNewQuestionPage />
            </ProtectedRoleRoute>
          } />
          <Route path="/secretariat-space/forum/thread/:threadId" element={
            <ProtectedRoleRoute allowedRoles={['secretariat', 'admin', 'owner']} allowTenantRole>
              <ForumThreadPage />
            </ProtectedRoleRoute>
          } />

          {/* ── Routes publiques tenant ─────────────────────────────────── */}
          {/* Landing dédiée ISNA / PRORASCIENCE — nouveau design narratif (maquette portée). L'apex prorascience.org redirige vers /t/isna */}
          {/* Vitrine tenant GÉNÉRIQUE (multi-tenant). isna → vitrine PRORASCIENCE
              (Maquette*) via le registre TENANT_VITRINES ; autres tenants → vitrine
              générique. Les sous-pages narratives passent par /t/:slug/:vitrinePage.
              v6 classe les routes statiques (login/courses/paiement/admin) au-dessus
              de :vitrinePage → pas de collision. Cf. docs/CIMOLACE_ARCHITECTURE.md §7. */}
          <Route path="/t/:tenantSlug" element={<TenantVitrineHome />} />
          {/* Vitrine marketplace : services du praticien (public, pilotée par le
              catalogue). Static AVANT le catch-all :vitrinePage. */}
          <Route path="/t/:tenantSlug/services" element={<TenantServicesVitrine />} />
          <Route path="/t/:tenantSlug/reserver" element={<TenantReservationPage />} />
          <Route path="/t/:tenantSlug/:vitrinePage" element={<TenantVitrinePage />} />
          {/* Domaine custom (prorascience.org) — anciennes pages vitrine narratives Academy
              DÉPRÉCIÉES : l'OS (/) est la face publique (il couvre mission/fondateur/temple/doctrine…
              en conversationnel). On redirige donc ces pages vers l'OS. NB : le marketplace praticien
              (/t/:slug/services + /reserver) reste FONCTIONNEL (flux réservation/paiement) — non touché. */}
          <Route path="/ecole" element={<Navigate to="/" replace />} />
          <Route path="/temple" element={<Navigate to="/" replace />} />
          <Route path="/programme" element={<Navigate to="/" replace />} />
          <Route path="/mission" element={<Navigate to="/" replace />} />
          <Route path="/fondateur" element={<Navigate to="/" replace />} />
          <Route path="/doctrine" element={<Navigate to="/" replace />} />
          {/* Academy RETIRÉ (login/signup) : l'accès membre passe par le portail LIRI (/login → /liri).
             Sur domaine custom (ex. prorascience.org) /login résout le tenant par le host. */}
          <Route path="/t/:tenantSlug/login" element={<Navigate to="/liri" replace />} />
          <Route path="/t/:tenantSlug/signup" element={<Navigate to="/signup" replace />} />
          <Route
            path="/t/:tenantSlug/auth/callback"
            element={<SchoolGoogleCallback />}
          />
          <Route
            path="/t/:tenantSlug/courses"
            element={<SchoolCoursesPage />}
          />
          <Route
            path="/t/:tenantSlug/paiement"
            element={<PaiementPage />}
          />
          <Route
            path="/t/:tenantSlug/activer"
            element={<ActivateAccountPage />}
          />
          {/* Rejoindre un live via code (public, anonyme) + gestion des liens (prof). */}
          <Route path="/live/rejoindre" element={<LiveJoinPage />} />
          <Route path="/live/:id/liens" element={<LiveJoinLinksPage />} />

          {/* ── Academy RETIRÉ (tâche E) : tout `/t/:slug/admin*` → portail LIRI ──
              Le back-office école vit désormais dans `/liri/ecole` (même moteur
              OwnerDashboardBody). Une seule route splat couvre le landing + tous les
              sous-chemins (RRv6 : `/admin/*` matche aussi `/admin`). Mapping section
              → onglet dans AcademyToLiriRedirect. */}
          <Route path="/t/:tenantSlug/admin/*" element={<AcademyToLiriRedirect />} />

          {/* Le constructeur complet (header + structure + save) vit dans StudioFormationPage
              (/studio/formation). On redirige pour réutiliser CE câblage : monter
              <OwnerFormationBuilder/> nu (sans onSave) crashait au moment du save. */}
          <Route path="/owner/formations/create" element={
            <ProtectedOwnerRoute>
               <Navigate to="/studio/formation" replace />
            </ProtectedOwnerRoute>
          } />

          <Route path="/owner-dashboard/client/:id" element={
            <ProtectedOwnerRoute>
              <ClientProfilePage />
            </ProtectedOwnerRoute>
          } />

          {/* Standard Routes */}
          <Route path="/modules" element={<PlaceholderPage title="Catalogue des Modules" />} />
          <Route path="/resources" element={<ResourcesPage />} />
          <Route path="/students" element={<PlaceholderPage title="Annuaire Étudiants" />} />
          <Route path="/coaches" element={<PlaceholderPage title="Nos Coachs" />} />

          <Route path="/accompagnement/mentorat" element={<MentoringPage />} />
          <Route path="/accompagnement/coaching" element={<CoachingPage />} />
          <Route path="/accompagnement/coaching-vs-mentorat" element={<MentoringVsCoachingPage />} />
          <Route path="/accompagnement/suivi-pedagogique" element={<PedagogicalFollowUpPage />} />
          <Route path="/accompagnement/soutien-emotionnel" element={<EmotionalSupportPage />} />

          <Route path="/vie-scolaire/*" element={<SchoolLifePage />} />
          <Route path="/vie-scolaire/agenda" element={<Navigate to="/vie-scolaire?tab=calendar" replace />} />
          <Route path="/vie-scolaire/reglements" element={<Navigate to="/vie-scolaire?tab=rules" replace />} />
          <Route path="/vie-scolaire/evenements" element={<Navigate to="/vie-scolaire?tab=events" replace />} />
          <Route path="/vie-scolaire/annonces" element={<Navigate to="/vie-scolaire?tab=announcements" replace />} />
          <Route path="/vie-scolaire/presences" element={<Navigate to="/vie-scolaire?tab=attendance" replace />} />
          <Route path="/vie-scolaire/discipline" element={<Navigate to="/vie-scolaire?tab=discipline" replace />} />
          <Route path="/ressources/*" element={<ResourcesPage />} />

          <Route path="/formations/catalogue" element={<FormationCatalogPage />} />
          <Route path="/formations/inscription" element={<FormationRegistrationPage />} />
          <Route path="/formations/mes-formations" element={
            <ProtectedRoute>
              <MyFormationsPage />
            </ProtectedRoute>
          } />

          <Route path="/ecoles" element={<EcolesProrasciencePage />} />
          <Route path="/doctrine-pedagogique" element={<DoctrinePedagogiquePage />} />
          <Route path="/origine-appel" element={<OrigineAppelPage />} />
          <Route path="/fond-de-tout" element={<FondDeToutPage />} />
          <Route path="/dialogue-physique" element={<DialoguePhysiquePage />} />
          <Route path="/ontodynamique" element={<OntodynamiquePage />} />
          <Route path="/bibliotheque" element={<BibliothequePage />} />
          <Route path="/grande-bibliotheque" element={<LibraryPage />} />
          <Route path="/manuel-initiatique-bris-de-sort" element={<ManuelInitiatiqueBrisDeSortPage />} />
          <Route path="/communaute" element={<CommunautePage />} />
          <Route path="/curriculum/first-year" element={<CurriculumPage />} />
          <Route path="/curriculum/module/:id" element={<ModuleDetailPage />} />
          <Route path="/student/dashboard" element={<Navigate to="/dashboard" replace />} />
          
          <Route path="/paiements/tarifs" element={<Navigate to="/forfaits" replace />} />
          <Route path="/paiements/facturation" element={
            <ProtectedRoute>
              <ForfaitsPage />
            </ProtectedRoute>
          } />
          <Route path="/paiements/payer" element={
            <ProtectedRoute>
              <PaymentActionPage />
            </ProtectedRoute>
          } />
          <Route path="/paiements/activer-licence" element={
            <ProtectedRoute>
              <LicenseActivationPage />
            </ProtectedRoute>
          } />

          <Route path="/profil/mon-profil" element={
            <ProtectedRoute>
              <MyProfilePage />
            </ProtectedRoute>
          } />
          <Route path="/profil/modifier" element={
            <ProtectedRoute>
              <EditProfilePage />
            </ProtectedRoute>
          } />
          <Route path="/profil/parametres" element={
            <ProtectedRoute>
              <SettingsPageUserProfile />
            </ProtectedRoute>
          } />
          <Route path="/profil/certificats" element={
            <ProtectedRoute>
              <CertificatesPage />
            </ProtectedRoute>
          } />

          <Route path="/a-propos" element={<AboutProrascience />} />
          <Route path="/a-propos/fondateur" element={<FounderAboutPage />} />
          <Route path="/equipe" element={<TeamPage />} />
          <Route path="/faq" element={<FAQPage />} />
          <Route path="/nous-contacter" element={<ContactPage />} />
          <Route path="/conditions-utilisation" element={<TermsPage />} />
          <Route path="/politique-confidentialite" element={<PrivacyPage />} />
          <Route path="/mentions-legales" element={<LegalPage />} />
          <Route path="/companion-capture" element={<CompanionCapturePage />} />
          <Route path="/mes-factures" element={
            <ProtectedRoute>
              <BillingPage />
            </ProtectedRoute>
          } />
          <Route path="/certificates" element={<Navigate to="/my-certificates" replace />} />

          <Route path="*" element={<PlaceholderPage title="Page Non Trouvée" />} />
            </Routes>
          </Suspense>
        </LazyChunkErrorBoundary>
        </EleveNoStudioGuard>
      </main>

      <Toaster />
    </div>
  );
};

const App = () => {
  const billingGraceDays = Math.max(0, Number(import.meta?.env?.VITE_BILLING_GRACE_DAYS ?? 0) || 0);
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClient}>
        <BillingProvider graceDays={billingGraceDays}>
          <DataSyncProvider>
            <NotificationProvider>
              <CartProvider>
                <MessagingProvider>
                  <DemoModeProvider>
                    <Router>
                      <VitrineContactEmailProvider>
                        <CimolaceDomainHandler />
                        <TenantFavicon />
                        <AppContent />
                      </VitrineContactEmailProvider>
                    </Router>
                  </DemoModeProvider>
                </MessagingProvider>
              </CartProvider>
            </NotificationProvider>
          </DataSyncProvider>
        </BillingProvider>
      </QueryClientProvider>
    </AuthProvider>
  );
};

export default App;
