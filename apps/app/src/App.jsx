import React, { Suspense, lazy, useEffect, useState } from 'react';
import ErrorBoundary from '@/components/ErrorBoundary';
// DEV PREVIEW — composant sans auth
const SmartboardKonvaEditorV1 = lazy(() => import('@/features/smartboard-konva-editor/SmartboardKonvaEditorV1'));
function DevSmartboardPreview() {
  return <div className="flex h-screen flex-col overflow-hidden bg-[#080a0f]"><SmartboardKonvaEditorV1 className="min-h-0 flex-1" /></div>;
}
const StudioSmartboardKonvaPageLazy = lazy(() => import('@/pages/studio/StudioSmartboardKonvaPage'));

// Tenant routing constants - will be replaced with tenant config in future
const TENANT_SLUG = 'isna';
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

    // Dev local : ne pas imposer la prod
    if (
      host === 'localhost'
      || host === '127.0.0.1'
      || host.endsWith('.local')
    ) {
      return;
    }

    // Domaine officiel CIMOLACE : la racine publique doit ouvrir la vitrine produit,
    // pas l'ancienne vitrine ISNA/PRORASCIENCE.
    if (CIMOLACE_PUBLIC_HOSTS.has(host) || host.endsWith('-cimolace.vercel.app')) {
      if (path === '/' || path === '') {
        navigate('/cimolace', { replace: true });
      }
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
      if (path === '/' || path === '') {
        navigate('/t/isna', { replace: true });
      } else if (path === '/login') {
        navigate('/t/isna/login', { replace: true });
      } else if (path === '/signup') {
        navigate('/t/isna/signup', { replace: true });
      } else if (path === '/formations' || path === '/catalogue' || path === '/forfaits') {
        navigate('/t/isna/courses', { replace: true });
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
import ProtectedRoleRoute from '@/components/ProtectedRoleRoute';
import ProtectedSubscriptionRoute from '@/components/ProtectedSubscriptionRoute';
import { BillingProvider, useBilling } from '@/contexts/BillingContext';
const GraceBanner = lazy(() => import('@/components/billing/GraceBanner'));
const DiscoveryChat = lazy(() => import('@/components/booking/DiscoveryChat').then((m) => ({ default: m.DiscoveryChat })));

const Header = lazy(() => import('@/components/Header'));
import ProtectedOwnerRoute from '@/components/ProtectedOwnerRoute';
const ShoppingCart = lazy(() => import('@/components/ecommerce/ShoppingCart'));
const LiveAlertBanner = lazy(() => import('@/components/live/LiveAlertBanner'));
const MobileReelsShell = lazy(() => import('@/components/mobile-app/MobileReelsShell'));
import { MobileReelsShellProvider } from '@/contexts/MobileReelsShellContext';
import { useMobileReelsShellVisible } from '@/hooks/useMobileReelsShellVisible';
import { isSupabaseConfigured } from '@/lib/supabase';

// --- Core Pages ---
const OwnerFormationBuilder = lazy(() => import('@/components/formations/OwnerFormationBuilder'));
const CreatorDashboardShell = lazy(() => import('@/pages/creator/CreatorDashboardShell'));
const CoursePlayerInterface = lazy(() => import('@/components/formations/CoursePlayerInterface'));
const StudentNotebook = lazy(() => import('@/components/student/StudentNotebook'));
const PublicFormationsPage = lazy(() => import('@/pages/PublicFormationsPage'));
const FormationDetailPage = lazy(() => import('@/pages/FormationDetailPage'));
const LivesLibraryPage = lazy(() => import('@/pages/LivesLibraryPage'));
const MessagingPage = lazy(() => import('@/pages/MessagingPage'));

// --- Classroom Pages ---
const ClassroomPage = lazy(() => import('@/pages/ClassroomPage'));
const ClassroomArchivePage = lazy(() => import('@/pages/ClassroomArchivePage'));
const LiveClassesPage = lazy(() => import('@/pages/LiveClassesPage'));
const LiveClassroomPage = lazy(() => import('@/pages/LiveClassroomPage'));
const VideoFormationsPage = lazy(() => import('@/pages/VideoFormationsPage'));
const VideoPlayerPage = lazy(() => import('@/pages/VideoPlayerPage'));
const FormationForumPage = lazy(() => import('@/pages/FormationForumPage'));
const LessonPlayerPage = lazy(() => import('@/pages/LessonPlayerPage'));
const VideoPostProductionPage = lazy(() => import('@/pages/VideoPostProductionPage'));
const KnowledgeBaseManager = lazy(() => import('@/pages/KnowledgeBaseManager')); // --- Student School Life (NEW) ---
const StudentSchoolLifePage = lazy(() => import('@/pages/student-school-life/StudentSchoolLifePage'));
const StudentDashboardPage = lazy(() => import('@/pages/StudentDashboardPage'));
const StudentEnrollmentOnboardingPage = lazy(() => import('@/pages/student-school-life/StudentEnrollmentOnboardingPage'));
const OnboardingPage = lazy(() => import('@/pages/OnboardingPage'));
const NgowazuluIntakePage = lazy(() => import('@/pages/ngowazulu/NgowazuluIntakePage'));
const NgowazuluTemplePage = lazy(() => import('@/pages/ngowazulu/NgowazuluTemplePage'));
const ProspectInterviewLoungePage = lazy(() => import('@/pages/ProspectInterviewLoungePage')); // --- New Formation & Pricing Pages ---
const FormationsPage = lazy(() => import('@/pages/FormationsPage')); // New Page
const HomePage = lazy(() => import('@/pages/HomePage'));
const LandingPage = lazy(() => import('@/pages/LandingPage'));
const MaquetteAccueil = lazy(() => import('@/pages/MaquetteAccueil'));
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
const EleveHomeScreen = lazy(() => import('@/pages/eleve-mobile/EleveHomeScreen'));
const EleveLiveScreen = lazy(() => import('@/pages/eleve-mobile/EleveLiveScreen'));
const EleveLiveLoadingScreen = lazy(() => import('@/pages/eleve-mobile/EleveLiveLoadingScreen'));
const EleveLiveAccessDeniedScreen = lazy(() => import('@/pages/eleve-mobile/EleveLiveAccessDeniedScreen'));
const EleveLiveTermineScreen = lazy(() => import('@/pages/eleve-mobile/EleveLiveTermineScreen'));
const EleveLiveWaitingScreen = lazy(() => import('@/pages/eleve-mobile/EleveLiveWaitingScreen'));
const EleveLiveSessionChatScreen = lazy(() => import('@/pages/eleve-mobile/EleveLiveSessionChatScreen'));
const EleveLiveRoomShellMaquette = lazy(() => import('@/pages/eleve-mobile/EleveLiveRoomShellMaquette'));
const EleveLiveRoomImmersiveAlpha = lazy(() => import('@/pages/eleve-mobile/EleveLiveRoomImmersiveAlpha'));
const LiriMobileHostView = lazy(() => import('@/pages/eleve-mobile/LiriMobileHostView'));
const EleveCoursePage = lazy(() => import('@/pages/eleve-mobile/EleveCoursePage'));
const EleveBillingCheckoutScreen = lazy(() => import('@/pages/eleve-mobile/EleveBillingCheckoutScreen'));
const EleveCheckoutSuccessScreen = lazy(() => import('@/pages/eleve-mobile/EleveCheckoutSuccessScreen'));
const EleveBibliothequeScreen = lazy(() => import('@/pages/eleve-mobile/EleveBibliothequeScreen'));
const EleveCommunauteScreen = lazy(() => import('@/pages/eleve-mobile/EleveCommunauteScreen'));
const EleveProfileScreen = lazy(() => import('@/pages/eleve-mobile/EleveProfileScreen'));
const EleveClasseScreen = lazy(() => import('@/pages/eleve-mobile/EleveClasseScreen'));
const EleveMessagesScreen = lazy(() => import('@/pages/eleve-mobile/EleveMessagesScreen'));
const EleveMessagesNewScreen = lazy(() => import('@/pages/eleve-mobile/EleveMessagesNewScreen'));
const EleveMessageThreadScreen = lazy(() => import('@/pages/eleve-mobile/EleveMessageThreadScreen'));
const EleveNeuronScreen = lazy(() => import('@/pages/eleve-mobile/EleveNeuronScreen'));
const EleveReplaysScreen = lazy(() => import('@/pages/eleve-mobile/EleveReplaysScreen'));
const EleveAgendaScreen = lazy(() => import('@/pages/eleve-mobile/EleveAgendaScreen'));
const EleveCalendrierAnnuelScreen = lazy(() => import('@/pages/eleve-mobile/EleveCalendrierAnnuelScreen'));
const EleveEspaceEnLigneScreen = lazy(() => import('@/pages/eleve-mobile/EleveEspaceEnLigneScreen'));
const EleveEtudiantDashboardScreen = lazy(() => import('@/pages/eleve-mobile/etudiantParity/EleveEtudiantDashboardScreen'));
const EleveEtudiantFormationsScreen = lazy(() => import('@/pages/eleve-mobile/etudiantParity/EleveEtudiantFormationsScreen'));
const EleveEtudiantEvaluationsScreen = lazy(() => import('@/pages/eleve-mobile/etudiantParity/EleveEtudiantEvaluationsScreen'));
const EleveEtudiantNotesScreen = lazy(() => import('@/pages/eleve-mobile/etudiantParity/EleveEtudiantNotesScreen'));
const EleveEtudiantAbsencesScreen = lazy(() => import('@/pages/eleve-mobile/etudiantParity/EleveEtudiantAbsencesScreen'));
const EleveEtudiantDocumentsScreen = lazy(() => import('@/pages/eleve-mobile/etudiantParity/EleveEtudiantDocumentsScreen'));
const EleveVieScolaireLayout = lazy(() => import('@/pages/eleve-mobile/vieScolaire/EleveVieScolaireLayout'));
const EleveVieScolaireApercuTab = lazy(() => import('@/pages/eleve-mobile/vieScolaire/EleveVieScolaireApercuTab'));
const EleveVieScolaireCalendrierTab = lazy(() => import('@/pages/eleve-mobile/vieScolaire/EleveVieScolaireCalendrierTab'));
const EleveVieScolaireResultatsTab = lazy(() => import('@/pages/eleve-mobile/vieScolaire/EleveVieScolaireResultatsTab'));
const EleveVieScolaireAnnoncesTab = lazy(() => import('@/pages/eleve-mobile/vieScolaire/EleveVieScolaireAnnoncesTab'));
const EleveModulesForfaitsScreen = lazy(() => import('@/pages/eleve-mobile/EleveModulesForfaitsScreen'));
const EleveModulesScreen = lazy(() => import('@/pages/eleve-mobile/EleveModulesScreen'));
const EleveForfaitsScreen = lazy(() => import('@/pages/eleve-mobile/EleveForfaitsScreen'));
const EleveBoutiqueSacreeScreen = lazy(() => import('@/pages/eleve-mobile/EleveBoutiqueSacreeScreen'));
const EleveProrascienceVitrineScreen = lazy(() => import('@/pages/eleve-mobile/EleveProrascienceVitrineScreen'));
const Ecoles21SciencesMobileScreen = lazy(() => import('@/pages/eleve-mobile/Ecoles21SciencesMobileScreen'));
const VitrineAboutMobileScreen = lazy(() => import('@/pages/eleve-mobile/ProrascienceVitrineMobileScreens').then(m => ({ default: m.VitrineAboutMobileScreen })));
const VitrineCoachingMobileScreen = lazy(() => import('@/pages/eleve-mobile/ProrascienceVitrineMobileScreens').then(m => ({ default: m.VitrineCoachingMobileScreen })));
const VitrineCoachingVsMentoratMobileScreen = lazy(() => import('@/pages/eleve-mobile/ProrascienceVitrineMobileScreens').then(m => ({ default: m.VitrineCoachingVsMentoratMobileScreen })));
const VitrineCommunauteMobileScreen = lazy(() => import('@/pages/eleve-mobile/ProrascienceVitrineMobileScreens').then(m => ({ default: m.VitrineCommunauteMobileScreen })));
const VitrineContactMobileScreen = lazy(() => import('@/pages/eleve-mobile/ProrascienceVitrineMobileScreens').then(m => ({ default: m.VitrineContactMobileScreen })));
const VitrineEquipeMobileScreen = lazy(() => import('@/pages/eleve-mobile/ProrascienceVitrineMobileScreens').then(m => ({ default: m.VitrineEquipeMobileScreen })));
const VitrineFaqMobileScreen = lazy(() => import('@/pages/eleve-mobile/ProrascienceVitrineMobileScreens').then(m => ({ default: m.VitrineFaqMobileScreen })));
const VitrineFondateurMobileScreen = lazy(() => import('@/pages/eleve-mobile/ProrascienceVitrineMobileScreens').then(m => ({ default: m.VitrineFondateurMobileScreen })));
const VitrineForfaitsMobileScreen = lazy(() => import('@/pages/eleve-mobile/ProrascienceVitrineMobileScreens').then(m => ({ default: m.VitrineForfaitsMobileScreen })));
const VitrineFormationsMobileScreen = lazy(() => import('@/pages/eleve-mobile/ProrascienceVitrineMobileScreens').then(m => ({ default: m.VitrineFormationsMobileScreen })));
const VitrineMentoratMobileScreen = lazy(() => import('@/pages/eleve-mobile/ProrascienceVitrineMobileScreens').then(m => ({ default: m.VitrineMentoratMobileScreen })));
const EleveChooseAccountTypeScreen = lazy(() => import('@/pages/eleve-mobile/EleveChooseAccountTypeScreen'));
const EleveAppointmentRequestScreen = lazy(() => import('@/pages/eleve-mobile/EleveAppointmentRequestScreen'));
const EleveVersionScreen = lazy(() => import('@/pages/eleve-mobile/EleveVersionScreen'));
const VersionPage = lazy(() => import('@/pages/VersionPage'));
const EleveConnectionWelcome = lazy(() => import('@/pages/eleve-mobile/connection/EleveConnectionWelcome'));
const EleveConnectionLien = lazy(() => import('@/pages/eleve-mobile/connection/EleveConnectionLien'));
const EleveConnectionCode = lazy(() => import('@/pages/eleve-mobile/connection/EleveConnectionCode'));
const EleveSignupMobile = lazy(() => import('@/pages/eleve-mobile/connection/EleveSignupMobile'));
const EleveNotificationsScreen = lazy(() => import('@/pages/eleve-mobile/EleveNotificationsScreen'));
import EleveNoStudioGuard from '@/components/eleve-mobile/EleveNoStudioGuard';
const EleveMobileRouteShell = lazy(() => import('@/components/eleve-mobile/EleveMobileRouteShell'));

// ── LIRI Embed (iframe, pas de shell, pas d'auth) ─────────────────────────────
const LiveEmbedPage = lazy(() => import('@/pages/embed/LiveEmbedPage'));
const LiveEmbedStudioPage = lazy(() => import('@/pages/embed/LiveEmbedStudioPage'));

// --- Other Pages ---
const NotificationCenter = lazy(() => import('@/pages/NotificationCenter'));
const NotificationSettings = lazy(() => import('@/pages/NotificationSettings'));
const SupportPage = lazy(() => import('@/pages/SupportPage'));
const StudentSessionBooking = lazy(() => import('@/pages/StudentSessionBooking'));
const StudentWorkshopRegistration = lazy(() => import('@/pages/StudentWorkshopRegistration'));
const ReportsPage = lazy(() => import('@/pages/ReportsPage'));
const SettingsPage = lazy(() => import('@/pages/SettingsPage'));
const TwoFASetupPage = lazy(() => import('@/pages/TwoFASetupPage'));
const StudentCertificatesPage = lazy(() => import('@/pages/StudentCertificatesPage')); // --- Existing Pages ---
const SecretariatPage = lazy(() => import('@/pages/SecretariatPage'));
const SchoolVitrinePage = lazy(() => import('@/pages/SchoolVitrinePage'));
const SchoolVitrineTenantPage = lazy(() => import('@/pages/school/SchoolVitrineTenantPage'));
const PaiementPage = lazy(() => import('@/pages/school/PaiementPage'));
const SchoolBillingPage = lazy(() => import('@/pages/school/SchoolBillingPage'));
const SchoolLoginPage = lazy(() => import('@/pages/school/SchoolLoginPage'));
const SchoolGoogleCallback = lazy(() => import('@/pages/school/SchoolGoogleCallback'));
const SchoolAdminDashboard = lazy(() => import('@/pages/school/SchoolAdminDashboard'));
const SchoolSignupPage = lazy(() => import('@/pages/school/SchoolSignupPage'));
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
const ForgotPasswordPage = lazy(() => import('@/pages/ForgotPasswordPage'));
const UpdatePasswordPage = lazy(() => import('@/pages/UpdatePasswordPage'));
const OwnerDashboard = lazy(() => import('@/pages/OwnerDashboard'));
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
const SchoolLifePage = lazy(() => import('@/pages/SchoolLifePage'));
const ResourcesPage = lazy(() => import('@/pages/ResourcesPage'));
const FormationCatalogPage = lazy(() => import('@/pages/FormationCatalogPage'));
const FormationRegistrationPage = lazy(() => import('@/pages/FormationRegistrationPage'));
const MyFormationsPage = lazy(() => import('@/pages/MyFormationsPage'));
const BillingPage = lazy(() => import('@/pages/BillingPage'));
const ForfaitsPage = lazy(() => import('@/pages/ForfaitsPage'));
const PaymentActionPage = lazy(() => import('@/pages/PaymentActionPage'));
const MyProfilePage = lazy(() => import('@/pages/MyProfilePage'));
const EditProfilePage = lazy(() => import('@/pages/EditProfilePage'));
const SettingsPageUserProfile = lazy(() => import('@/pages/SettingsPage'));
const CertificatesPage = lazy(() => import('@/pages/CertificatesPage'));
const BillingCheckoutPage = lazy(() => import('@/pages/BillingCheckoutPage'));
const LicenseActivationPage = lazy(() => import('@/pages/LicenseActivationPage'));
const RedeemPrivilegedLinkPage = lazy(() => import('@/pages/RedeemPrivilegedLinkPage'));
const DashboardInfrastructure = lazy(() => import('@/pages/DashboardInfrastructure').then((m) => ({ default: m.DashboardInfrastructure })));
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
const ImmersivePhoneCompanionPage = lazy(() => import('@/pages/live/ImmersivePhoneCompanionPage'));
const LiveMobileCameraPage = lazy(() => import('@/pages/live/LiveMobileCameraPage'));
const BoutiquePage = lazy(() => import('@/pages/BoutiquePage'));
const ServicesSpirituelsPage = lazy(() => import('@/pages/ServicesSpirituelsPage'));
const CoursesPage = lazy(() => import('@/pages/CoursesPage'));
const TeachersPage = lazy(() => import('@/pages/TeachersPage'));
const HowItWorksPage = lazy(() => import('@/pages/HowItWorksPage'));
const CyclesDetailPage = lazy(() => import('@/pages/CyclesDetailPage'));
const AdminDashboardPage = lazy(() => import('@/pages/admin/AdminDashboard'));
const UsersAdminPage = lazy(() => import('@/pages/admin/UsersPage'));
const TenantAdminCoursesPage = lazy(() => import('@/pages/tenant/TenantAdminCoursesPage'));
const TenantAdminStudentsPage = lazy(() => import('@/pages/tenant/TenantAdminStudentsPage'));
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
const TeacherPortalPage = lazy(() => import('@/pages/teacher/TeacherPortalPage'));
const MasterclassFactoryPage = lazy(() => import('@/pages/tools/MasterclassFactoryPage'));
const MasterclassFactoryAnalysePage = lazy(() => import('@/pages/tools/MasterclassFactoryAnalysePage'));
const OrchestratorLiveDashboardPage = lazy(() => import('@/app/dashboard/liri/orchestrator-live/page'));
const SmartboardStreamingPage = lazy(() => import('@/app/dashboard/liri/smartboard-stream/page'));
// Chat LIRI Brain (multi-modèles + outils + conversations persistées). Export nommé → default pour lazy().
const DashboardLiri = lazy(() => import('@/pages/DashboardLiri').then((m) => ({ default: m.DashboardLiri })));
// Portail LIRI — accueil/hub (rail Accueil/Lives/Forum/Studio/Biblio/Brain + stats live)
const LiriPortalPage = lazy(() => import('@/pages/LiriPortalPage').then((m) => ({ default: m.LiriPortalPage })));
const LiriStudioHub = lazy(() => import('@/pages/dev/LiriStudioHub'));
const MasterclassFactoryV2 = lazy(() => import('@/pages/dev/MasterclassFactoryV2'));
const OrchestratorLiveV2 = lazy(() => import('@/pages/dev/OrchestratorLiveV2'));
const SmartboardStreamingV2 = lazy(() => import('@/pages/dev/SmartboardStreamingV2'));
const SmartboardToolPage = lazy(() => import('@/app/dashboard/tools/smartboard/page'));
const StudioRouter = lazy(() => import('@/pages/studio/StudioRouter'));
const StudioLiriRouter = lazy(() => import('@/pages/studio/StudioLiriRouter'));
const LiveHostPageNativeGate = lazy(() => import('@/components/eleve-mobile/LiveHostPageNativeGate'));
const LiveGuestPage = lazy(() => import('@/pages/LiveGuestPage'));
const DevLiriHostEntry = lazy(() => import('@/pages/dev/DevLiriHostEntry'));
const LiveWaitingRoomPage = lazy(() => import('@/pages/studio/LiveWaitingRoomPage'));
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
  <div className="min-h-screen bg-[#0F1419] text-white flex items-center justify-center p-20 text-center">
    <div className="max-w-xl">
      <div className="w-24 h-1 bg-[#D4AF37] mx-auto rounded-full mb-8"></div>
      <h1 className="text-4xl md:text-5xl font-serif font-bold text-white mb-6">{title}</h1>
      <button onClick={() => window.history.back()} className="px-8 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-white transition-colors">
        Retour
      </button>
    </div>
  </div>
);

const PageLoader = () => (
  <div className="flex min-h-[50dvh] w-full items-center justify-center bg-[#0F1419]">
    <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#D4AF37] border-t-transparent" />
  </div>
);

const LazyShell = ({ children }) => <Suspense fallback={null}>{children}</Suspense>;

const DashboardRedirect = () => {
  const { user, loading, supabase: authSupabase } = useAuth();
  const { loading: billingLoading, status, inGrace } = useBilling();
  const [slowLoad, setSlowLoad] = useState(false);

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
      <div className="flex h-screen w-full flex-col items-center justify-center gap-6 bg-[#0F1419] p-6">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-[#D4AF37] border-t-transparent" />
        <p className="text-center text-sm text-gray-400">Chargement de votre espace…</p>
        {slowLoad && (
          <div className="max-w-sm rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-center">
            <p className="text-sm text-amber-200">
              La connexion prend plus de temps que prévu. Si le projet Supabase est en pause, réactivez-le depuis le dashboard Supabase.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-3 rounded-lg bg-[#D4AF37] px-4 py-2 text-sm font-medium text-black hover:bg-amber-500"
            >
              Réessayer
            </button>
          </div>
        )}
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;

  if (hasMultiRoleAccess(user) && !getSelectedAccountRole()) {
    return <Navigate to={getChooseAccountTypePath()} replace />;
  }

  const role = getEffectiveRole(user);
  const isPremiumActive = status === 'active' || (status === 'past_due' && inGrace);

  if (role === 'owner' || role === 'admin') return <Navigate to="/owner-dashboard" replace />;
  if (role === 'secretariat') return <Navigate to="/secretariat-space/dashboard" replace />;
  if (role === 'teacher') return <Navigate to="/teacher-space/dashboard" replace />;
  if (role === 'creator') return <Navigate to="/creator-dashboard" replace />;

  if (role === 'visitor') {
    if (isPremiumActive && !user?.student_profile_completed) return <Navigate to="/onboarding/eleve" replace />;
    if (isPremiumActive && user?.student_profile_completed) return <Navigate to="/student-school-life/dashboard" replace />;
    return <Navigate to="/prospect/entretien" replace />;
  }

  if (role === 'student' && isPremiumActive && !user?.student_profile_completed) {
    return <Navigate to="/onboarding/eleve" replace />;
  }
  if (role === 'student' && isPremiumActive && user?.student_profile_completed) {
    return <Navigate to="/student-school-life/dashboard" replace />;
  }

  if (!isPremiumActive) return <Navigate to="/forfaits" replace />;
  return <Navigate to="/student-school-life/dashboard" replace />;
};

// Helper component to redirect authenticated users away from login/signup
const RedirectIfAuthenticated = ({ children }) => {
  const { user, loading, supabase: authSupabase } = useAuth();
  const location = useLocation();
  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#0F1419]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#D4AF37] border-t-transparent" />
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
      <div className="flex h-screen w-full items-center justify-center bg-[#0F1419]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#D4AF37] border-t-transparent" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  const role = String(getEffectiveRole(user) || '').toLowerCase();
  if (['owner', 'admin', 'secretariat', 'teacher', 'creator'].includes(role)) return children;

  const isPremiumActive = status === 'active' || (status === 'past_due' && inGrace);
  if (!isPremiumActive) return <Navigate to="/forfaits" replace />;
  if (role === 'visitor' && !user?.student_profile_completed) {
    return <Navigate to="/onboarding/eleve" replace />;
  }
  return children;
};

const ProtectedImmersiveMessagingRoute = ({ children }) => {
  const { user, loading, supabase: authSupabase } = useAuth();
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
      <div className="flex h-screen w-full items-center justify-center bg-[#0F1419]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#D4AF37] border-t-transparent" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;

  const role = String(getEffectiveRole(user) || '').toLowerCase();
  const isStaffRole = ['owner', 'admin', 'secretariat', 'teacher', 'creator', 'commercial', 'support'].includes(role);
  const isPremiumActive = status === 'active' || (status === 'past_due' && inGrace);
  if (isStaffRole || isPremiumActive || (role === 'visitor' && visitorCanChat)) return children;

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
  const { user } = useAuth();

  useEffect(() => {
    if (location.hash) return;
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [location.pathname, location.search, location.hash]);

  const mobileReelsShellActive = useMobileReelsShellVisible() && !location.pathname.startsWith('/cimolace');

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
   */
  const isLiriEleveMaquetteRoute = location.pathname.startsWith('/m/eleve/live/maquette');

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
    '/auth/callback',
    '/creator-dashboard',
    '/teacher-dashboard',
    '/owner-dashboard',
    '/classroom/live/', 
    '/classroom/video',
    '/studio',
    '/dashboard/tools',
    '/dashboard/medos',
    '/dashboard/infrastructure',
    '/companion-capture',
    '/live/',
    '/dev/masterclass-factory',
    '/embed/',       // LIRI embed iframe — aucun shell
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

  /** Espace propriétaire : layout plein écran sans barre globale (évite tout doublon LIRI / PRORASCIENCE). */
  const isOwnerDashboardShell = /^\/owner-dashboard(\/|$)/.test(location.pathname || '/');

  const shouldShowHeader =
    !isAdminRoute &&
    !isMarketingShellRoute &&
    !isLiveArenaRoute &&
    !isEleveMobileRoute &&
    !isOwnerDashboardShell &&
    !hideHeaderRoutes.some(route => location.pathname.startsWith(route)) &&
    !mobileReelsShellActive &&
    !isCimolaceRoute;
  const shouldOffsetMain =
    shouldShowHeader &&
    !isImmersiveHomeRoute &&
    !isImmersiveEmbed &&
    !isLiveArenaRoute &&
    !isEleveMobileRoute &&
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
      <MobileReelsShellProvider active={mobileReelsShellActive}>
        <div className="flex min-h-screen flex-col marketing-public-shell">
          {!isLiveArenaRoute && <GraceBanner />}
          {!isAdminRoute && !isImmersiveEmbed && !isLiveArenaRoute && <DiscoveryChat />}
          <main className="flex-grow min-h-[100dvh]">
            <React.Suspense fallback={<div className="flex min-h-[100dvh] items-center justify-center bg-[#f7f8fb] text-slate-500">Chargement…</div>}>
              <ProrascienceAppleStoryLandingLazy />
            </React.Suspense>
          </main>
          {mobileReelsShellActive ? <MobileReelsShell /> : null}
          <Toaster />
        </div>
      </MobileReelsShellProvider>
    );
  }

  if (location.pathname === '/ecoles/prorascience-apple-story-v3') {
    return (
      <MobileReelsShellProvider active={mobileReelsShellActive}>
        <div className="flex min-h-screen flex-col marketing-public-shell">
          {!isLiveArenaRoute && <GraceBanner />}
          {!isAdminRoute && !isImmersiveEmbed && !isLiveArenaRoute && <DiscoveryChat />}
          <main className="flex-grow min-h-[100dvh]">
            <React.Suspense fallback={<div className="flex min-h-[100dvh] items-center justify-center bg-[#06070c] text-white/60">Chargement…</div>}>
              <ProrascienceAppleStoryV3Lazy />
            </React.Suspense>
          </main>
          {mobileReelsShellActive ? <MobileReelsShell /> : null}
          <Toaster />
        </div>
      </MobileReelsShellProvider>
    );
  }

  return (
    <MobileReelsShellProvider active={mobileReelsShellActive}>
    <div className={appShellClassName}>
      {!isLiveArenaRoute && !isEleveMobileRoute && !isCimolaceRoute && !isAdminRoute && (
        <LazyShell>
          <GraceBanner />
        </LazyShell>
      )}
      {shouldShowHeader && (
        <LazyShell>
          <Header />
        </LazyShell>
      )}

      {!isLiveArenaRoute && !isEleveMobileRoute && !isCimolaceRoute && !isAdminRoute && (
        <LazyShell>
          <ShoppingCart />
        </LazyShell>
      )}
      {!isLiveArenaRoute && !isEleveMobileRoute && !isCimolaceRoute && !isAdminRoute && (
        <LazyShell>
          <LiveAlertBanner />
        </LazyShell>
      )}

      {/* Discovery Chat — affiché sur les pages publiques uniquement */}
      {!isAdminRoute && !isImmersiveEmbed && !isLiveArenaRoute && !isEleveMobileRoute && !isCimolaceRoute && (
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
          <Route path="/" element={<Navigate to="/login" replace />} />
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
            <Route path="/dev/liri/*" element={
              <React.Suspense fallback={<div className="flex h-screen items-center justify-center bg-[#0F1117] text-white/50 text-sm">Chargement LIRI…</div>}>
                <StudioLiriRouter />
              </React.Suspense>
            } />
          )}
<Route path="/dev/smartboard-designer" element={
              <React.Suspense fallback={<div className="flex h-screen items-center justify-center bg-[#0F1117] text-white/50 text-sm">Chargement Designer…</div>}>
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
            <Route path="live/maquette" element={<Outlet />}>
              <Route index element={<EleveLiveRoomShellMaquette />} />
              <Route path="alpha" element={<EleveLiveRoomImmersiveAlpha />} />
              <Route path="host" element={<LiriMobileHostView />} />
            </Route>
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
            <Route path="prorascience/isna-pro" element={<Navigate to={TENANT_ADMIN_PATH} replace />} /> {/* Legacy ISNA mobile route - redirects to tenant system */}
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
          <Route path="/maquette" element={<MaquetteAccueil />} />
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
            <ProtectedRoleRoute allowedRoles={['owner', 'admin']}>
              <MboloCatalog />
            </ProtectedRoleRoute>
          } />
          <Route path="/dashboard/mbolo/orders" element={
            <ProtectedRoleRoute allowedRoles={['owner', 'admin']}>
              <MboloOrders />
            </ProtectedRoleRoute>
          } />
          <Route path="/dashboard/billing" element={
            <ProtectedRoleRoute allowedRoles={['owner', 'admin']}>
              <TenantBillingPage />
            </ProtectedRoleRoute>
          } />
          <Route path="/dashboard/payouts" element={
            <ProtectedRoleRoute allowedRoles={['owner', 'admin']}>
              <TenantPayoutsPage />
            </ProtectedRoleRoute>
          } />
          <Route path="/dashboard/tools/masterclass-factory" element={
            <ProtectedRoleRoute allowedRoles={['teacher', 'admin', 'owner', 'secretariat']}>
              <MasterclassFactoryPage />
            </ProtectedRoleRoute>
          } />
          <Route path="/dashboard/tools/masterclass-factory/analyse" element={
            <ProtectedRoleRoute allowedRoles={['teacher', 'admin', 'owner', 'secretariat']}>
              <MasterclassFactoryAnalysePage />
            </ProtectedRoleRoute>
          } />
          <Route path="/dashboard/tools/smartboard" element={
            <ProtectedRoleRoute allowedRoles={['teacher', 'admin', 'owner', 'secretariat']}>
              <SmartboardToolPage />
            </ProtectedRoleRoute>
          } />
          <Route path="/dashboard/liri/orchestrator-live" element={
            <ProtectedRoleRoute allowedRoles={['teacher', 'admin', 'owner', 'secretariat']}>
              <OrchestratorLiveDashboardPage />
            </ProtectedRoleRoute>
          } />
          <Route path="/dashboard/liri/smartboard-stream" element={
            <ProtectedRoleRoute allowedRoles={['teacher', 'admin', 'owner', 'secretariat']}>
              <SmartboardStreamingPage />
            </ProtectedRoleRoute>
          } />
          <Route path="/dashboard/liri" element={
            <ProtectedRoleRoute allowedRoles={['teacher', 'admin', 'owner', 'secretariat']}>
              <DashboardLiri />
            </ProtectedRoleRoute>
          } />
          <Route path="/liri" element={
            <ProtectedRoleRoute allowedRoles={['owner', 'admin', 'teacher', 'secretariat', 'student']}>
              <LiriPortalPage />
            </ProtectedRoleRoute>
          } />
          <Route path="/choose-account-type" element={
            <ProtectedRoute>
              <ChooseAccountTypePage />
            </ProtectedRoute>
          } />

          <Route path="/secretariat" element={
            <ProtectedRoleRoute allowedRoles={['secretariat', 'admin', 'owner']}>
              <Navigate to="/secretariat-space/dashboard" replace />
            </ProtectedRoleRoute>
          } />
          <Route path="/secretariat-space" element={
            <ProtectedRoleRoute allowedRoles={['secretariat', 'admin', 'owner']}>
              <Navigate to="/secretariat-space/dashboard" replace />
            </ProtectedRoleRoute>
          } />
          <Route path="/secretariat-space/*" element={
            <ProtectedRoleRoute allowedRoles={['secretariat', 'admin', 'owner']}>
              <SecretariatPortalPage />
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
          {/* Alias publics — le lien "Rejoindre" du menu vitrine ne doit pas faire 404 */}
          <Route path="/rejoindre" element={<Navigate to="/signup" replace />} />
          <Route path="/inscription" element={<Navigate to="/signup" replace />} />
          <Route path="/register" element={<Navigate to="/signup" replace />} />
          
          <Route path="/isna/produits" element={<Navigate to={TENANT_COURSES_PATH} replace />} /> {/* Legacy ISNA route - redirects to tenant system */}
          <Route path="/isna/produits/:slug" element={<Navigate to={TENANT_COURSES_PATH} replace />} /> {/* Legacy ISNA route - redirects to tenant system */}
          <Route path="/products" element={<ProductsPage />} />
          <Route path="/boutique" element={<BoutiquePage />} />
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
          <Route path="/formations" element={<Navigate to="/t/isna/courses" replace />} />
          <Route path="/forfaits" element={<ForfaitsPage />} />
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
          <Route path="/formations/list" element={<PublicFormationsPage />} />
          <Route path="/cours-publics" element={<Navigate to="/formations/list" replace />} />

          <Route path="/catalogue" element={<Navigate to="/t/isna/courses" replace />} />

          <Route path="/create-owner-account" element={<CreateOwnerAccountPage />} />
          <Route path="/verify-owner" element={<VerifyOwnerPage />} />
          <Route path="/contact" element={<Navigate to="/nous-contacter" replace />} />
          <Route path="/formations-packages" element={<Navigate to="/forfaits" replace />} />
          <Route path="/paiement" element={<Navigate to="/paiements/tarifs" replace />} />

          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
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
            <ProtectedRoleRoute allowedRoles={['secretariat', 'admin', 'owner']}>
              <Navigate to="/secretariat-space/courses" replace />
            </ProtectedRoleRoute>
          } />
          <Route path="/teachers" element={
            <ProtectedRoleRoute allowedRoles={['secretariat', 'admin', 'owner']}>
              <Navigate to="/secretariat-space/teachers" replace />
            </ProtectedRoleRoute>
          } />
          <Route path="/how-it-works" element={
            <ProtectedRoleRoute allowedRoles={['secretariat', 'admin', 'owner']}>
              <Navigate to="/secretariat-space/how-it-works" replace />
            </ProtectedRoleRoute>
          } />
          <Route path="/cycles/:id" element={
            <ProtectedRoleRoute allowedRoles={['secretariat', 'admin', 'owner']}>
              <LegacyCycleRedirect />
            </ProtectedRoleRoute>
          } />

          {/* === ADMIN (PROTECTED) === */}
          <Route path="/admin" element={
            <ProtectedRoleRoute allowedRoles={['admin', 'owner']}>
              <AdminDashboardPage />
            </ProtectedRoleRoute>
          } />
          <Route path="/admin/users" element={
            <ProtectedRoleRoute allowedRoles={['admin', 'owner']}>
              <UsersAdminPage />
            </ProtectedRoleRoute>
          } />
          <Route path="/admin/logs" element={
            <ProtectedRoleRoute allowedRoles={['admin', 'owner']}>
              <AuditLogsPage />
            </ProtectedRoleRoute>
          } />
          <Route path="/admin/payments" element={
            <ProtectedRoleRoute allowedRoles={['admin', 'owner']}>
              <AdminPaymentsPage />
            </ProtectedRoleRoute>
          } />
          <Route path="/admin/students" element={
            <ProtectedRoleRoute allowedRoles={['admin', 'owner']}>
              <AdminStudentsPage />
            </ProtectedRoleRoute>
          } />
          <Route path="/admin/settings" element={
            <ProtectedRoleRoute allowedRoles={['admin', 'owner']}>
              <AdminSettingsPage />
            </ProtectedRoleRoute>
          } />
          <Route path="/admin/content" element={
            <ProtectedRoleRoute allowedRoles={['admin', 'owner']}>
              <AdminContentEditorPage />
            </ProtectedRoleRoute>
          } />
          <Route path="/admin/billing" element={
            <ProtectedRoleRoute allowedRoles={['admin', 'owner']}>
              <AdminBillingPage />
            </ProtectedRoleRoute>
          } />
          <Route path="/admin/iri" element={
            <ProtectedRoleRoute allowedRoles={['admin', 'owner']}>
              <AdminIriBuilderPage />
            </ProtectedRoleRoute>
          } />
          <Route path="/admin/marketing" element={
            <ProtectedRoleRoute allowedRoles={['admin', 'owner']}>
              <AdminMarketingPage />
            </ProtectedRoleRoute>
          } />
          <Route path="/admin/tenants/:tenantId/embed" element={
            <ProtectedRoleRoute allowedRoles={['admin', 'owner']}>
              <AdminTenantEmbedPage />
            </ProtectedRoleRoute>
          } />
          <Route path="/admin/tenants/:tenantId/branding" element={
            <ProtectedRoleRoute allowedRoles={['admin', 'owner']}>
              <AdminTenantBrandingPage />
            </ProtectedRoleRoute>
          } />
          <Route path="/admin/marketing/tools" element={
            <ProtectedRoleRoute allowedRoles={['admin', 'owner']}>
              <MarketingToolsSuitePage />
            </ProtectedRoleRoute>
          } />
          <Route path="/admin/communities" element={
            <ProtectedRoleRoute allowedRoles={['admin', 'owner']}>
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
          <Route path="/ngowazulu" element={
            <ProtectedRoute>
              <NgowazuluTemplePage />
            </ProtectedRoute>
          } />
          <Route path="/ngowazulu/:section" element={
            <ProtectedRoute>
              <NgowazuluTemplePage />
            </ProtectedRoute>
          } />

          {/* === STUDENT SCHOOL LIFE (AUTHENTICATED) === */}

          {/* Main Dashboard entry point */}
          {/* 🎨 DESIGN PREVIEW — guards désactivés temporairement */}
          <Route path="/student-school-life/*" element={<StudentSchoolLifePage />} />

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
                      <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#D4AF37] border-t-transparent" />
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
            <ProtectedRoleRoute allowedRoles={['admin', 'owner']}>
              <ReportsPage />
            </ProtectedRoleRoute>
          } />
          <Route path="/settings" element={
            <ProtectedRoleRoute allowedRoles={['admin', 'owner']}>
              <SettingsPage />
            </ProtectedRoleRoute>
          } />
          <Route path="/settings/2fa" element={
            <ProtectedRoleRoute allowedRoles={['admin', 'owner']}>
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
            <ProtectedRoleRoute allowedRoles={['creator', 'admin', 'owner']}>
              <CreatorDashboardShell />
            </ProtectedRoleRoute>
          } />
          <Route path="/teacher-dashboard" element={
            <ProtectedRoleRoute allowedRoles={['teacher', 'admin', 'owner']}>
              <Navigate to="/teacher-space/dashboard" replace />
            </ProtectedRoleRoute>
          } />
          <Route path="/teacher-space/*" element={
            <ProtectedRoleRoute allowedRoles={['teacher', 'admin', 'owner', 'secretariat']}>
              <TeacherPortalPage />
            </ProtectedRoleRoute>
          } />

          {/* Studio de création de contenu — Hub central.
              `practitioner` / `clinic_admin` ajoutés pour la téléconsultation MEDOS :
              le praticien ouvre la salle immersive Liri (/studio/live-arena/:id) avec
              SmartBoard. Additif — n'enlève l'accès à personne. */}
          <Route path="/studio/*" element={
            <ProtectedRoleRoute allowedRoles={['teacher', 'admin', 'owner', 'secretariat', 'practitioner', 'clinic_admin']}>
              <StudioRouter />
            </ProtectedRoleRoute>
          } />
          <Route path="/constructeur-isna" element={
            <ProtectedRoleRoute allowedRoles={['teacher', 'admin', 'owner', 'secretariat']}>
              <Navigate to={TENANT_ADMIN_PATH} replace /> {/* Legacy ISNA route - redirects to tenant system */}
            </ProtectedRoleRoute>
          } />
          <Route path="/isna-course-constructor" element={
            <ProtectedRoleRoute allowedRoles={['teacher', 'admin', 'owner', 'secretariat']}>
              <Navigate to={TENANT_ADMIN_PATH} replace /> {/* Legacy ISNA route - redirects to tenant system */}
            </ProtectedRoleRoute>
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

          {/* Invité — alias URL explicite (avant /live/:sessionId pour éviter de capturer « invit » comme id) */}
          <Route path="/live/invit/:sessionId" element={
            <ProtectedRoute>
              <ErrorBoundary>
                <LiveGuestPage />
              </ErrorBoundary>
            </ProtectedRoute>
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
            <ProtectedRoleRoute allowedRoles={['teacher', 'admin', 'owner']}>
              <Navigate to="/teacher-space/corrections" replace />
            </ProtectedRoleRoute>
          } />
          <Route path="/live-manager" element={
            <ProtectedRoleRoute allowedRoles={['teacher', 'admin', 'owner']}>
              <Navigate to="/teacher-space/live" replace />
            </ProtectedRoleRoute>
          } />
          <Route path="/teacher/classroom/:weekId" element={
            <ProtectedRoleRoute allowedRoles={['teacher', 'admin', 'owner']}>
              <Navigate to="/teacher-space/classroom" replace />
            </ProtectedRoleRoute>
          } />

          <Route path="/owner-dashboard" element={
            <ProtectedOwnerRoute>
              <OwnerDashboard />
            </ProtectedOwnerRoute>
          } />

          <Route path="/owner-dashboard/post-production/:contentId" element={
            <ProtectedOwnerRoute>
              <VideoPostProductionPage />
            </ProtectedOwnerRoute>
          } />

          <Route path="/owner-dashboard/knowledge-base" element={
            <ProtectedOwnerRoute>
              <KnowledgeBaseManager />
            </ProtectedOwnerRoute>
          } />

          {/* ── Routes publiques tenant ─────────────────────────────────── */}
          {/* Landing dédiée ISNA / PRORASCIENCE — l'apex prorascience.org redirige vers /t/isna */}
          <Route path="/t/isna" element={<LandingPage />} />
          <Route
            path="/t/:tenantSlug"
            element={<SchoolVitrineTenantPage />}
          />
          <Route
            path="/t/:tenantSlug/login"
            element={<SchoolLoginPage />}
          />
          <Route
            path="/t/:tenantSlug/auth/callback"
            element={<SchoolGoogleCallback />}
          />
          <Route
            path="/t/:tenantSlug/signup"
            element={<SchoolSignupPage />}
          />
          <Route
            path="/t/:tenantSlug/courses"
            element={<SchoolCoursesPage />}
          />
          <Route
            path="/t/:tenantSlug/paiement"
            element={<PaiementPage />}
          />

          {/* ── Dashboard admin école (route principale) ─────────────────── */}
          <Route
            path="/t/:tenantSlug/admin"
            element={
              <TenantProtectedRoute>
                <SchoolAdminDashboard />
              </TenantProtectedRoute>
            }
          />

          {/* ── Sous-routes admin (protégées par appartenance au tenant) ──── */}
          <Route
            path="/t/:tenantSlug/admin/billing"
            element={
              <TenantProtectedRoute>
                <SchoolBillingPage />
              </TenantProtectedRoute>
            }
          />
          <Route
            path="/t/:tenantSlug/admin/settings"
            element={
              <TenantProtectedRoute>
                <ErrorBoundary>
                  <TenantAdminSettingsPage />
                </ErrorBoundary>
              </TenantProtectedRoute>
            }
          />
          <Route
            path="/t/:tenantSlug/admin/members"
            element={
              <TenantProtectedRoute>
                <ErrorBoundary>
                  <TenantMembersPage />
                </ErrorBoundary>
              </TenantProtectedRoute>
            }
          />
          <Route
            path="/t/:tenantSlug/admin/courses"
            element={
              <TenantProtectedRoute>
                <ErrorBoundary>
                  <TenantAdminCoursesPage />
                </ErrorBoundary>
              </TenantProtectedRoute>
            }
          />
          <Route
            path="/t/:tenantSlug/admin/courses/:courseId"
            element={
              <TenantProtectedRoute>
                <ErrorBoundary>
                  <TenantCourseDetailPage />
                </ErrorBoundary>
              </TenantProtectedRoute>
            }
          />
          <Route
            path="/t/:tenantSlug/admin/students"
            element={
              <TenantProtectedRoute>
                <ErrorBoundary>
                  <TenantAdminStudentsPage />
                </ErrorBoundary>
              </TenantProtectedRoute>
            }
          />
          <Route
            path="/t/:tenantSlug/admin/lives"
            element={
              <TenantProtectedRoute>
                <TenantAdminLivesPage />
              </TenantProtectedRoute>
            }
          />
          <Route
            path="/t/:tenantSlug/admin/smartboard"
            element={
              <TenantProtectedRoute>
                <TenantAdminSmartboardPage />
              </TenantProtectedRoute>
            }
          />
          <Route
            path="/t/:tenantSlug/admin/marketing"
            element={
              <TenantProtectedRoute>
                <TenantAdminMarketingPage />
              </TenantProtectedRoute>
            }
          />
          <Route
            path="/t/:tenantSlug/admin/studio"
            element={
              <TenantProtectedRoute>
                <TenantAdminStudioPage />
              </TenantProtectedRoute>
            }
          />
          <Route
            path="/t/:tenantSlug/admin/neuro-recall"
            element={
              <TenantProtectedRoute>
                <TenantAdminNeuroRecallPage />
              </TenantProtectedRoute>
            }
          />
          <Route
            path="/t/:tenantSlug/admin/ai-billing"
            element={
              <TenantProtectedRoute>
                <TenantAdminAiBillingPage />
              </TenantProtectedRoute>
            }
          />
          <Route
            path="/t/:tenantSlug/admin/calendar"
            element={
              <TenantProtectedRoute>
                <TenantAdminCalendarPage />
              </TenantProtectedRoute>
            }
          />
          <Route
            path="/t/:tenantSlug/admin/chat"
            element={
              <TenantProtectedRoute>
                <TenantAdminChatPage />
              </TenantProtectedRoute>
            }
          />
          <Route
            path="/t/:tenantSlug/admin/notifications"
            element={
              <TenantProtectedRoute>
                <TenantAdminNotificationsPage />
              </TenantProtectedRoute>
            }
          />

          <Route path="/owner/formations/create" element={
            <ProtectedOwnerRoute>
               <OwnerFormationBuilder />
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

      {mobileReelsShellActive ? (
        <LazyShell>
          <MobileReelsShell />
        </LazyShell>
      ) : null}

      <Toaster />
    </div>
    </MobileReelsShellProvider>
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
