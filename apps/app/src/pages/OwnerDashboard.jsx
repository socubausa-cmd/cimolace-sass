import React, { useEffect, useState } from 'react';
import OwnerDashboardLayout from '@/components/owner/OwnerDashboardLayout';
import OwnerDashboardOverview from '@/components/owner/OwnerDashboardOverview';
import { ResourcesTab, SchoolInfoTab } from '@/components/owner/OwnerTabComponents2';
import { useSchoolYear } from '@/hooks/useSchoolYear';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';

// Core Components
import OwnerFormationsTab from '@/components/owner/OwnerFormationsTab';
import AccompanimentClientList from '@/components/accompaniment/AccompanimentClientList';
import SchoolLifeManagementTab from '@/components/school-life-admin/SchoolLifeManagementTab';

// Financial Tabs
import InventoryTab from '@/components/owner/financial/InventoryTab';
import RecoveryTab from '@/components/owner/financial/RecoveryTab';
import PaymentsTab from '@/components/owner/financial/PaymentsTab';

// NEW COMPONENTS
import CoachingMentoringTab from '@/components/coaching/CoachingMentoringTab';
import WorkshopsTab from '@/components/coaching/WorkshopsTab';
import SupportTab from '@/components/support/SupportTab';
import NotificationCenter from '@/pages/NotificationCenter';
import OwnerCertificatesManagement from '@/components/certificates/OwnerCertificatesManagement';
import ReportsPage from '@/pages/ReportsPage';
import SettingsPage from '@/pages/SettingsPage';
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
import { useAuth } from '@/hooks/useAuth';
import { getEffectiveRole } from '@/lib/accountRoleMode';
import StudentForumCommunityPage from '@/pages/student-school-life/StudentForumCommunityPage';
import { FormationForumContent } from '@/pages/FormationForumPage';
import { formationForumUrlForRole } from '@/lib/forumDashboardPaths';

const OwnerDashboard = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const { currentYear, setSchoolYear } = useSchoolYear();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();

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
              communityForumTo="/owner-dashboard?tab=forum"
            />
          );
        }
        return (
          <StudentForumCommunityPage
            formationForumHref={(fid, qid) => formationForumUrlForRole(getEffectiveRole(user), fid, qid)}
          />
        );
      }
      case 'payments': return <FinanceSection />;
      case 'resources': return <ResourcesTab />;
      case 'school-info': return <SchoolInfoTab />;
      case 'team': return <TeamManagerPage />;
      case 'users': return <UsersAdminPage />;
      case 'settings': return <SettingsPage />;
      default: return <OwnerDashboardOverview />;
    }
  };

  return (
    <OwnerDashboardLayout activeTab={activeTab} onTabChange={handleTabChange}>
      {activeTab === 'dashboard' && (
         <div className="mb-6 flex justify-end">
            <div className="premium-panel px-3 py-3 rounded-xl min-w-[280px]">
              <p className="text-xs uppercase tracking-wider text-gray-400 mb-2">Annee scolaire</p>
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
              />
            </div>
         </div>
      )}
      {renderContent()}
    </OwnerDashboardLayout>
  );
};

const FINANCE_SUB_TABS = new Set(['students', 'payments', 'recovery', 'inventory', 'payout-setup']);

// Sub-component to handle Financial Navigation within the "Payments" main tab
const FinanceSection = () => {
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
       navigate(`/owner-dashboard?tab=payments&finance=${encodeURIComponent(next)}`, { replace: true });
     }
   };

   const financeOptions = [
     { value: 'students', label: 'Vue étudiants', badge: 'Qui a payé ?', icon: Users },
     { value: 'payments', label: 'Transactions', badge: 'Historique', icon: CreditCard },
     { value: 'recovery', label: 'Recouvrement', badge: 'Impayés', icon: ShieldAlert },
     { value: 'inventory', label: 'Inventaire', badge: 'Plans actifs', icon: PackageSearch },
     { value: 'payout-setup', label: 'Encaissement', badge: 'Config · tutoriel', icon: Plug },
   ];

   return (
      <div className="space-y-6">
         <PremiumSegmentedSelector
           value={subTab}
           onChange={onFinanceSubChange}
           options={financeOptions}
           layoutId="owner-finance-segment-pill"
           className="max-w-4xl"
         />
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
               <div className="premium-panel p-4 rounded-xl border border-white/10">
                 <TenantPayoutProvidersForm />
               </div>
             </motion.div>
           )}
         </AnimatePresence>
      </div>
   );
};

export default OwnerDashboard;