/**
 * ═══════════════════════════════════════════════════════════════
 * CIMOLACE ROUTER — routes produit CIMOLACE (marque distincte d'ISNA / PRORASCIENCE)
 * ═══════════════════════════════════════════════════════════════
 */

import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import CimolaceProtectedRoute from '@/components/cimolace/CimolaceProtectedRoute';
import CimolaceProtectedOwnerRoute from '@/components/cimolace/CimolaceProtectedOwnerRoute';
import CimolaceLanding from '@/pages/CimolaceLanding';
import CimolaceLandingCatalog from '@/pages/cimolace/CimolaceLandingCatalog';
import CimolaceOsDetail from '@/pages/CimolaceOsDetail';
import CimolaceLoginPage from '@/pages/CimolaceLoginPage';
import CimolaceGoogleCallback from '@/pages/CimolaceGoogleCallback';

// Lazy loaded pages
const CimolaceAboutPage = lazy(() => import('@/pages/CimolaceAboutPage'));
const CimolaceSolutionsPage = lazy(() => import('@/pages/CimolaceSolutionsPage'));
const CimolaceSolutionDetailPage = lazy(() => import('@/pages/CimolaceSolutionDetailPage'));
const CimolaceSolutionStoryPage = lazy(() => import('@/pages/CimolaceSolutionStoryPage'));
const CimolaceComparisonPage = lazy(() => import('@/pages/CimolaceComparisonPage'));
const VirtuelMboloPage = lazy(() => import('@/pages/cimolace/VirtuelMboloPage'));
const VirtuelMboloStarterPage = lazy(() => import('@/pages/cimolace/VirtuelMboloStarterPage'));
const VirtuelMboloProPage = lazy(() => import('@/pages/cimolace/VirtuelMboloProPage'));
const VirtuelMboloElitePage = lazy(() => import('@/pages/cimolace/VirtuelMboloElitePage'));
const VirtuelMboloPaymentPage = lazy(() => import('@/pages/cimolace/VirtuelMboloPaymentPage'));
const VirtuelMboloPaymentSuccessPage = lazy(() => import('@/pages/cimolace/VirtuelMboloPaymentSuccessPage'));
const VirtuelMboloBookingPage = lazy(() => import('@/pages/cimolace/VirtuelMboloBookingPage'));
const VirtuelMboloSubscriptionPage = lazy(() => import('@/pages/cimolace/VirtuelMboloSubscriptionPage'));
const VirtuelMboloDashboardPage = lazy(() => import('@/pages/cimolace/VirtuelMboloDashboardPage'));
const CimolaceConfigurator = lazy(() => import('@/pages/CimolaceConfigurator'));
const CimolaceArchitecturePage = lazy(() => import('@/pages/CimolaceArchitecturePage'));
const CimolaceContactPage = lazy(() => import('@/pages/cimolace/CimolaceContactPage'));
const CimolaceHostingPage = lazy(() => import('@/pages/cimolace/CimolaceHostingPage'));
const CimolaceInstallerPage = lazy(() => import('@/pages/cimolace/CimolaceInstallerPage'));
const CimolacePrivacyPage = lazy(() => import('@/pages/cimolace/legal/PrivacyPage'));
const CimolaceTermsPage = lazy(() => import('@/pages/cimolace/legal/TermsPage'));
const CimolaceCookiesPage = lazy(() => import('@/pages/cimolace/legal/CookiesPage'));
const CimolaceCareersPage = lazy(() => import('@/pages/cimolace/company/CareersPage'));
const CimolaceBlogPage = lazy(() => import('@/pages/cimolace/company/BlogPage'));
const CimolacePressPage = lazy(() => import('@/pages/cimolace/company/PressPage'));
const CimolaceDocsPage = lazy(() => import('@/pages/cimolace/resources/DocsPage'));
const CimolaceDocumentationDetailPage = lazy(() => import('@/pages/cimolace/resources/DocumentationDetailPage'));
const CimolaceApiPage = lazy(() => import('@/pages/cimolace/resources/ApiPage'));
const CimolaceGuidePage = lazy(() => import('@/pages/cimolace/resources/GuidePage'));
const CimolaceSupportPage = lazy(() => import('@/pages/cimolace/resources/SupportPage'));

// Back-office pages - use index.jsx files from directories
import CreateSchoolPage from '@/pages/cimolace/create-school/index';
import CimolaceAdminDashboard from '@/pages/cimolace/admin/index';
import CimolaceAdminClients from '@/pages/cimolace/admin/clients/index';
import CimolaceAdminClientDetail from '@/pages/cimolace/admin/clients/[id]';
import CimolaceAdminSchoolProvisioning from '@/pages/cimolace/admin/school-provisioning/index';
import CimolaceAdminSites from '@/pages/cimolace/admin/sites/index';
import CimolaceAdminFinances from '@/pages/cimolace/admin/finances/index';
import CimolaceAdminSupport from '@/pages/cimolace/admin/support/index';
import CimolaceAdminMonitoring from '@/pages/cimolace/admin/monitoring/index';
import CimolaceAdminAiKeys from '@/pages/cimolace/admin/ai-keys/index';
import CimolaceClientDashboard from '@/pages/cimolace/client/[clientSlug]/index';
const CimolaceBillingDashboardPage = React.lazy(() => import('@/pages/cimolace/CimolaceBillingDashboardPage'));
const CimolaceLaunchPage = React.lazy(() => import('@/pages/cimolace/CimolaceLaunchPage'));

export default function CimolaceRouter() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-[#0a0a0f] text-white">Chargement...</div>}>
        <Routes>
          {/* Public pages - chemins relatifs car Router imbriqué */}
          {/* Accueil officiel premium · catalogue historique conservé sur /catalog */}
          <Route path="/" element={<CimolaceLanding />} />
          <Route path="immersive" element={<CimolaceLanding />} />
          <Route path="catalog" element={<CimolaceLandingCatalog />} />
          <Route path="os/:osId" element={<CimolaceOsDetail />} />
          <Route path="login" element={<CimolaceLoginPage />} />
          <Route path="auth/google/callback" element={<CimolaceGoogleCallback />} />
          <Route path="about" element={<CimolaceAboutPage />} />
          <Route path="contact" element={<CimolaceContactPage />} />
          <Route path="hebergement" element={<CimolaceHostingPage />} />
          <Route path="installer" element={<CimolaceInstallerPage />} />
          <Route path="comparaison" element={<CimolaceComparisonPage />} />
          <Route path="products" element={<CimolaceSolutionsPage />} />
          <Route path="products/:id" element={<CimolaceSolutionDetailPage />} />
          <Route path="products/:id/story" element={<CimolaceSolutionStoryPage />} />

          {/* Legal */}
          <Route path="legal/confidentialite" element={<CimolacePrivacyPage />} />
          <Route path="legal/cgu" element={<CimolaceTermsPage />} />
          <Route path="legal/cookies" element={<CimolaceCookiesPage />} />

          {/* Company */}
          <Route path="company/carrieres" element={<CimolaceCareersPage />} />
          <Route path="company/blog" element={<CimolaceBlogPage />} />
          <Route path="company/presse" element={<CimolacePressPage />} />

          {/* Resources */}
          <Route path="resources/documentation" element={<CimolaceDocsPage />} />
          <Route path="resources/documentation/:type/:id" element={<CimolaceDocumentationDetailPage />} />
          <Route path="resources/api" element={<CimolaceApiPage />} />
          <Route path="resources/guide" element={<CimolaceGuidePage />} />
          <Route path="resources/support" element={<CimolaceSupportPage />} />

          {/* Raccourcis marketing → flux Virtuel Mbolo (liens historiques / footer) */}
          <Route path="paiement/setup" element={<Navigate to="/cimolace/solutions/virtuel-mbolo/payment" replace />} />
          <Route path="booking" element={<Navigate to="/cimolace/solutions/virtuel-mbolo/booking" replace />} />
          <Route path="dashboard" element={<Navigate to="/cimolace/solutions/virtuel-mbolo/dashboard" replace />} />
          <Route path="abonnement" element={<Navigate to="/cimolace/solutions/virtuel-mbolo/subscription" replace />} />
          
          {/* Virtuel-Mbolo pages */}
          <Route path="solutions/virtuel-mbolo" element={<VirtuelMboloPage />} />
          <Route path="solutions/virtuel-mbolo/starter" element={<VirtuelMboloStarterPage />} />
          <Route path="solutions/virtuel-mbolo/pro" element={<VirtuelMboloProPage />} />
          <Route path="solutions/virtuel-mbolo/elite" element={<VirtuelMboloElitePage />} />
          <Route path="solutions/virtuel-mbolo/payment" element={<VirtuelMboloPaymentPage />} />
          <Route path="solutions/virtuel-mbolo/payment/success" element={<VirtuelMboloPaymentSuccessPage />} />
          <Route path="solutions/virtuel-mbolo/booking" element={<VirtuelMboloBookingPage />} />
          <Route path="solutions/virtuel-mbolo/subscription" element={<VirtuelMboloSubscriptionPage />} />
          <Route path="solutions/virtuel-mbolo/dashboard" element={<CimolaceProtectedRoute><VirtuelMboloDashboardPage /></CimolaceProtectedRoute>} />
          <Route path="billing" element={<CimolaceProtectedRoute><CimolaceBillingDashboardPage /></CimolaceProtectedRoute>} />
          
          {/* Launch infrastructure */}
          <Route path="launch" element={<CimolaceLaunchPage />} />

          {/* Configurator */}
          <Route path="configurateur" element={<CimolaceConfigurator />} />
          <Route path="architecture" element={<CimolaceArchitecturePage />} />
          
          {/* Back-office - Propriétaire */}
          <Route path="admin" element={<CimolaceProtectedOwnerRoute><CimolaceAdminDashboard /></CimolaceProtectedOwnerRoute>} />
          <Route path="admin/clients" element={<CimolaceProtectedOwnerRoute><CimolaceAdminClients /></CimolaceProtectedOwnerRoute>} />
          <Route path="admin/clients/:id" element={<CimolaceProtectedOwnerRoute><CimolaceAdminClientDetail /></CimolaceProtectedOwnerRoute>} />
          <Route path="admin/school-provisioning" element={<CimolaceProtectedOwnerRoute><CimolaceAdminSchoolProvisioning /></CimolaceProtectedOwnerRoute>} />
          <Route path="admin/sites" element={<CimolaceProtectedOwnerRoute><CimolaceAdminSites /></CimolaceProtectedOwnerRoute>} />
          {/* La page « billing » legacy lisait cimolace_invoices (tables vides) → l'opérateur
              voyait 0 revenu. Redirigée vers /admin/finances qui lit la VRAIE API
              (cimolace-backoffice/finances : revenus, payouts, wallets réels). */}
          <Route path="admin/billing" element={<Navigate to="/cimolace/admin/finances" replace />} />
          <Route path="admin/finances" element={<CimolaceProtectedOwnerRoute><CimolaceAdminFinances /></CimolaceProtectedOwnerRoute>} />
          <Route path="admin/support" element={<CimolaceProtectedOwnerRoute><CimolaceAdminSupport /></CimolaceProtectedOwnerRoute>} />
          <Route path="admin/monitoring" element={<CimolaceProtectedOwnerRoute><CimolaceAdminMonitoring /></CimolaceProtectedOwnerRoute>} />
          <Route path="admin/ai-keys" element={<CimolaceProtectedOwnerRoute><CimolaceAdminAiKeys /></CimolaceProtectedOwnerRoute>} />

          {/* Self-service school creation */}
          <Route path="create-school" element={<CimolaceProtectedRoute><CreateSchoolPage /></CimolaceProtectedRoute>} />

          {/* Ancien portail client (Supabase direct, RLS-staff → cassé pour les tenants) : redirigé vers le dashboard tenant unifié */}
          <Route path="client/:clientSlug" element={<Navigate to="/cimolace/billing" replace />} />
        </Routes>
      </Suspense>
  );
}
