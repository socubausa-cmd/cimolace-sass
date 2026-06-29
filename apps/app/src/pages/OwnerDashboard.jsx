import React, { useEffect, useState } from 'react';
import OwnerDashboardLayout from '@/components/owner/OwnerDashboardLayout';
import OwnerDashboardOverview from '@/components/owner/OwnerDashboardOverview';
import { ResourcesTab, SchoolInfoTab } from '@/components/owner/OwnerTabComponents2';
import { useSchoolYear } from '@/hooks/useSchoolYear';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';

// Core Components
import OwnerFormationsTab from '@/components/owner/OwnerFormationsTab';
import AccompanimentClientList from '@/components/accompaniment/AccompanimentClientList';
import SchoolLifeManagementTab from '@/components/school/school-life-admin/SchoolLifeManagementTab';

// Financial Tabs
import InventoryTab from '@/components/owner/financial/InventoryTab';
import RecoveryTab from '@/components/owner/financial/RecoveryTab';
import PaymentsTab from '@/components/owner/financial/PaymentsTab';

// NEW COMPONENTS
import CoachingMentoringTab from '@/components/coaching/CoachingMentoringTab';
import WorkshopsTab from '@/components/coaching/WorkshopsTab';
import SupportTab from '@/components/support/SupportTab';
import NotificationCenter from '@/pages/NotificationCenter';
import OwnerCertificatesManagement from '@/components/school/certificates/OwnerCertificatesManagement';
import ReportsPage from '@/pages/ReportsPage';
import SettingsPage from '@/pages/SettingsPage';
import ServiceCatalogManager from '@/components/settings/ServiceCatalogManager';
import TenantPayoutProvidersForm from '@/components/settings/TenantPayoutProvidersForm';
import UsersAdminPage from '@/pages/admin/UsersPage';
import TeamManagerPage from '@/pages/owner/TeamManagerPage';
import { AnimatePresence, motion } from 'framer-motion';
import PremiumSegmentedSelector from '@/components/ui/premium-segmented-selector';
import { CreditCard, ShieldAlert, PackageSearch, Users, Plug } from 'lucide-react';
import SecretariatBillingPanel from '@/components/secretariat/SecretariatBillingPanel';
import NgowazuluMentoratManagerTab from '@/components/ngowazulu/owner/NgowazuluMentoratManagerTab';
import NgowazuluOperationsPanel from '@/components/ngowazulu/admin/NgowazuluOperationsPanel';
import SiteReviewsModerationPanel from '@/components/marketing/SiteReviewsModerationPanel';
import CommunicationShell from '@/components/school/CommunicationShell';
import { SslThemeProvider, SSL_LIGHT_CLASS, ensureSslLightStyles } from '@/pages/school/student-school-life/sslTheme';
import { useShellTint } from '@/lib/useShellTint';
import { FormationForumContent } from '@/pages/school/FormationForumPage';
import { usePortalTabs, useInPortalHeader } from '@/components/liri/portalHeader';

/**
 * Forum communauté de l'admin = MÊME forum riche que l'espace élève
 * (StudentForumRedesign : votes, épingles, recherche, temps réel). On reproduit le
 * thème CLAIR de l'espace élève (SslThemeProvider + classe + styles injectés) pour un
 * rendu identique dans le dashboard clair. Les sous-pages (fil / nouvelle question)
 * sont routées dans App.jsx sous /owner-dashboard/forum/* (forumBase dérivé de l'URL,
 * donc « Retour au forum » revient sur l'onglet forum de l'admin).
 */
const OwnerForumPanel = ({ basePath = '/owner-dashboard' }) => {
  useEffect(() => { ensureSslLightStyles(); }, []);
  // Le forum suit la MÊME teinte partagée que l'espace élève (clé localStorage commune
  // `liri-shell-tint`, sombre par défaut) → rendu identique partout, plus de « deux couleurs ».
  const [tint] = useShellTint();
  const isLight = tint !== 'dark';
  return (
    <SslThemeProvider mode={isLight ? 'light' : 'dark'}>
      <div className={isLight ? SSL_LIGHT_CLASS : ''}>
        <CommunicationShell forumBasePath={`${basePath}/forum`} />
      </div>
    </SslThemeProvider>
  );
};

/**
 * CONTENU du back-office (en-tête année scolaire + switch d'onglets), SANS shell —
 * réutilisable tel quel dans le shell admin historique (OwnerDashboardLayout) OU dans
 * le portail LIRI (LiriEcolePage → LiriPortalShell). `basePath` = base des navigations
 * internes ('/owner-dashboard' par défaut ; le portail passe '/liri/ecole').
 */
export const OwnerDashboardBody = ({ activeTab, basePath = '/owner-dashboard' }) => {
  const { currentYear, setSchoolYear } = useSchoolYear();
  const [searchParams] = useSearchParams();

  const renderContent = () => {
    switch(activeTab) {
      case 'dashboard': return <OwnerDashboardOverview />;
      case 'notifications': return <NotificationCenter />;
      case 'reports': return <ReportsPage />;
      case 'certificates': return <OwnerCertificatesManagement />;
      case 'formations': return <OwnerFormationsTab />;
      case 'coaching-mentoring': return <CoachingMentoringTab />;
      case 'workshops': return <WorkshopsTab />;
      case 'ngowazulu-mentorat': return <NgowazuluMentoratManagerTab />;
      case 'ngowazulu-operations': return <NgowazuluOperationsPanel />;
      case 'reviews': return <SiteReviewsModerationPanel />;
      case 'support': return <SupportTab />;
      case 'school-life': return <SchoolLifeManagementTab />;
      case 'forum': {
        const formationId = searchParams.get('formationId');
        if (formationId) {
          return (
            <FormationForumContent
              formationId={formationId}
              embedded
              communityForumTo={`${basePath}?tab=forum`}
            />
          );
        }
        return <OwnerForumPanel basePath={basePath} />;
      }
      case 'payments': return <FinanceSection basePath={basePath} />;
      case 'catalog': return (
        <div
          className="p-4"
          style={{ background: 'var(--lt-card-bg)', border: '1px solid var(--lt-card-border)', boxShadow: 'var(--lt-card-shadow)', borderRadius: 14 }}
        >
          <ServiceCatalogManager />
        </div>
      );
      case 'resources': return <ResourcesTab />;
      case 'school-info': return <SchoolInfoTab />;
      case 'team': return <TeamManagerPage />;
      case 'users': return <UsersAdminPage />;
      case 'settings': return <SettingsPage embedded />;
      default: return <OwnerDashboardOverview />;
    }
  };

  return (
    <>
      {activeTab === 'dashboard' && (
         <div className="mb-6 flex justify-end">
            <div
              className="px-3 py-3 rounded-[14px] min-w-[280px]"
              style={{ background: 'var(--lt-card-bg)', border: '1px solid var(--lt-card-border)', boxShadow: 'var(--lt-card-shadow)' }}
            >
              <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--lt-muted)' }}>Année scolaire</p>
              <PremiumSegmentedSelector
                value={currentYear}
                onChange={setSchoolYear}
                options={[
                  { value: '2024-2025', label: '2024-2025' },
                  { value: '2023-2024', label: '2023-2024' },
                ]}
                layoutId="owner-dashboard-school-year-segment-pill"
                compact
                showChevron={false}
                railClassName="!bg-[var(--lt-inner-bg)] !border-[var(--lt-border)]"
                optionClassName="!text-zinc-500 [&.text-white]:!text-zinc-900 hover:!bg-black/[0.03]"
              />
            </div>
         </div>
      )}
      {renderContent()}
    </>
  );
};

const OwnerDashboard = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(location?.search || '');
    const tab = params.get('tab');
    if (tab && typeof tab === 'string') {
      setActiveTab(tab);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location?.search]);

  const handleTabChange = (nextTab) => {
    setActiveTab(nextTab);
    try {
      const params = new URLSearchParams(location?.search || '');
      params.set('tab', nextTab);
      if (nextTab === 'forum') {
        params.delete('formationId');
        params.delete('questionId');
      }
      navigate(`/owner-dashboard?${params.toString()}`, { replace: true });
    } catch {
      navigate(`/owner-dashboard?tab=${encodeURIComponent(nextTab)}`, { replace: true });
    }
  };

  return (
    <OwnerDashboardLayout activeTab={activeTab} onTabChange={handleTabChange}>
      <OwnerDashboardBody activeTab={activeTab} basePath="/owner-dashboard" />
    </OwnerDashboardLayout>
  );
};

const FINANCE_SUB_TABS = new Set(['students', 'payments', 'recovery', 'inventory', 'payout-setup']);

// Sub-component to handle Financial Navigation within the "Payments" main tab
const FinanceSection = ({ basePath = '/owner-dashboard' }) => {
   const inPortal = useInPortalHeader();
   const navigate = useNavigate();
   const location = useLocation();
   const [searchParams] = useSearchParams();
   const [subTab, setSubTab] = useState(() => {
     const f = searchParams.get('finance');
     return f && FINANCE_SUB_TABS.has(f) ? f : 'students';
   });

   useEffect(() => {
     const f = searchParams.get('finance');
     if (f && FINANCE_SUB_TABS.has(f)) {
       setSubTab((prev) => (prev === f ? prev : f));
     }
   }, [searchParams]);

   const onFinanceSubChange = (next) => {
     setSubTab(next);
     try {
       const params = new URLSearchParams(location.search || '');
       params.set('tab', 'payments');
       params.set('finance', next);
       navigate(`${location.pathname}?${params.toString()}`, { replace: true });
     } catch {
       navigate(`${basePath}?tab=payments&finance=${encodeURIComponent(next)}`, { replace: true });
     }
   };

   const financeOptions = [
     { value: 'students', label: 'Vue étudiants', badge: 'Qui a payé ?', icon: Users },
     { value: 'payments', label: 'Transactions', badge: 'Historique', icon: CreditCard },
     { value: 'recovery', label: 'Recouvrement', badge: 'Impayés', icon: ShieldAlert },
     { value: 'inventory', label: 'Inventaire', badge: 'Plans actifs', icon: PackageSearch },
     { value: 'payout-setup', label: 'Encaissement', badge: 'Config · tutoriel', icon: Plug },
   ];

   usePortalTabs(financeOptions, subTab, onFinanceSubChange);

   return (
      <div className="space-y-6">
         {!inPortal && (
           <PremiumSegmentedSelector
             value={subTab}
             onChange={onFinanceSubChange}
             options={financeOptions}
             layoutId="owner-finance-segment-pill"
             className="max-w-4xl"
             railClassName="!bg-[var(--lt-inner-bg)] !border-[var(--lt-border)]"
             optionClassName="!text-zinc-500 [&.text-white]:!text-zinc-900 hover:!bg-black/[0.03]"
           />
         )}
         <AnimatePresence mode="wait">
           {subTab === 'students' && (
             <motion.div
               key="finance-students"
               initial={{ opacity: 0, y: 8 }}
               animate={{ opacity: 1, y: 0 }}
               exit={{ opacity: 0, y: -8 }}
               transition={{ duration: 0.22, ease: 'easeOut' }}
             >
               <SecretariatBillingPanel />
             </motion.div>
           )}
           {subTab === 'payments' && (
             <motion.div
               key="finance-payments"
               initial={{ opacity: 0, y: 8 }}
               animate={{ opacity: 1, y: 0 }}
               exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
             >
               <PaymentsTab />
             </motion.div>
           )}
           {subTab === 'recovery' && (
             <motion.div
               key="finance-recovery"
               initial={{ opacity: 0, y: 8 }}
               animate={{ opacity: 1, y: 0 }}
               exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
             >
               <RecoveryTab />
             </motion.div>
           )}
           {subTab === 'inventory' && (
             <motion.div
               key="finance-inventory"
               initial={{ opacity: 0, y: 8 }}
               animate={{ opacity: 1, y: 0 }}
               exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
             >
               <InventoryTab />
             </motion.div>
           )}
           {subTab === 'payout-setup' && (
             <motion.div
               key="finance-payout-setup"
               initial={{ opacity: 0, y: 8 }}
               animate={{ opacity: 1, y: 0 }}
               exit={{ opacity: 0, y: -8 }}
               transition={{ duration: 0.22, ease: 'easeOut' }}
             >
               <div
                 className="p-4 rounded-[14px]"
                 style={{ background: 'var(--lt-card-bg)', border: '1px solid var(--lt-card-border)', boxShadow: 'var(--lt-card-shadow)' }}
               >
                 <TenantPayoutProvidersForm />
               </div>
             </motion.div>
           )}
         </AnimatePresence>
      </div>
   );
};

export default OwnerDashboard;