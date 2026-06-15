import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams, Navigate } from 'react-router-dom';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import SecretariatDashboardLayout from '@/components/secretariat/SecretariatDashboardLayout';
import SecretariatOverview from '@/components/secretariat/SecretariatOverview';
import SecretariatStudentDashboard from '@/components/secretariat/SecretariatStudentDashboard';
import { useSchoolYear } from '@/hooks/useSchoolYear';

// Mêmes composants que OwnerDashboard (accès restreints par RLS)
import OwnerFormationsTab from '@/components/owner/OwnerFormationsTab';
import SchoolLifeManagementTab from '@/components/school/school-life-admin/SchoolLifeManagementTab';
import CoachingMentoringTab from '@/components/coaching/CoachingMentoringTab';
import WorkshopsTab from '@/components/coaching/WorkshopsTab';
import SupportTab from '@/components/support/SupportTab';
import NotificationCenter from '@/pages/NotificationCenter';
import OwnerCertificatesManagement from '@/components/school/certificates/OwnerCertificatesManagement';
import ReportsPage from '@/pages/ReportsPage';
import SecretariatInboxPage from '@/pages/secretariat/SecretariatInboxPage';
import SecretariatCalendarPage from '@/pages/secretariat/SecretariatCalendarPage';
import SecretariatMarketingPanelPage from '@/pages/secretariat/SecretariatMarketingPanelPage';
import SecretariatAppointmentsPage from '@/pages/secretariat/SecretariatAppointmentsPage';
import HowItWorksPage from '@/pages/HowItWorksPage';
import CoursesPage from '@/pages/school/CoursesPage';
import TeachersPage from '@/pages/school/TeachersPage';
import CyclesDetailPage from '@/pages/CyclesDetailPage';
import SecretariatBillingPanel from '@/components/secretariat/SecretariatBillingPanel';
import NgowazuluMentoratManagerTab from '@/components/ngowazulu/owner/NgowazuluMentoratManagerTab';
import NgowazuluOperationsPanel from '@/components/ngowazulu/admin/NgowazuluOperationsPanel';
import SiteReviewsModerationPanel from '@/components/marketing/SiteReviewsModerationPanel';
import AdministrativeDocumentStudio from '@/components/secretariat/AdministrativeDocumentStudio';
import StudentForumCommunityPage from '@/pages/school/student-school-life/StudentForumCommunityPage';
import { FormationForumContent } from '@/pages/school/FormationForumPage';
import { FORUM_COMMUNITY_PATH } from '@/lib/forumDashboardPaths';

const VALID_TABS = ['dashboard', 'apercu', 'paiements', 'notifications', 'reports', 'formations', 'coaching-mentoring', 'workshops', 'ngowazulu-mentorat', 'ngowazulu-operations', 'reviews', 'certificates', 'support', 'school-life', 'forum', 'rendez-vous', 'calendrier', 'marketing', 'messagerie', 'teachers', 'how-it-works', 'courses', 'document-admin', 'cycles-disciple', 'cycles-initie', 'cycles-maitre'];

const SecretariatDashboard = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const { currentYear, setSchoolYear } = useSchoolYear();
  const location = useLocation();
  const navigate = useNavigate();
  const { '*': pathSplat } = useParams();

  useEffect(() => {
    let fromPath = (pathSplat || 'dashboard').split('/')[0] || 'dashboard';
    if (fromPath === 'cycles') {
      const sub = (pathSplat || '').split('/')[1] || 'disciple';
      fromPath = sub === 'disciple' ? 'cycles-disciple' : sub === 'initie' ? 'cycles-initie' : sub === 'maitre' ? 'cycles-maitre' : 'cycles-disciple';
    }
    const fromQuery = new URLSearchParams(location?.search || '').get('tab');
    const tab = fromQuery || (VALID_TABS.includes(fromPath) ? fromPath : 'dashboard');
    setActiveTab(tab);
  }, [location?.search, pathSplat]);

  const handleTabChange = (nextTab) => {
    setActiveTab(nextTab);
    let path = '/secretariat-space';
    if (nextTab !== 'dashboard') {
      path = nextTab.startsWith('cycles-') ? `/secretariat-space/cycles/${nextTab.replace('cycles-', '')}` : `/secretariat-space/${nextTab}`;
    }
    navigate(path, { replace: true });
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <SecretariatStudentDashboard />;
      case 'apercu':
        return <SecretariatOverview />;
      case 'paiements':
        return <SecretariatBillingPanel />;
      case 'notifications':
        return <NotificationCenter />;
      case 'reports':
        return <ReportsPage />;
      case 'formations':
        return <OwnerFormationsTab />;
      case 'coaching-mentoring':
        return <CoachingMentoringTab />;
      case 'workshops':
        return <WorkshopsTab />;
      case 'ngowazulu-mentorat':
        return <NgowazuluMentoratManagerTab />;
      case 'ngowazulu-operations':
        return <NgowazuluOperationsPanel />;
      case 'reviews':
        return <SiteReviewsModerationPanel />;
      case 'certificates':
        return <OwnerCertificatesManagement />;
      case 'support':
        return <SupportTab />;
      case 'school-life':
        return <SchoolLifeManagementTab />;
      case 'forum': {
        const raw = pathSplat || '';
        const rest = raw.replace(/^forum\/?/, '');
        const m = /^formation\/([^/?#]+)/.exec(rest || '');
        if (m?.[1]) {
          return (
            <FormationForumContent
              formationId={m[1]}
              embedded
              communityForumTo={FORUM_COMMUNITY_PATH.secretariat}
            />
          );
        }
        return <StudentForumCommunityPage forumBasePath={FORUM_COMMUNITY_PATH.secretariat} />;
      }
      case 'rendez-vous':
        return <SecretariatAppointmentsPage />;
      case 'calendrier':
        return <SecretariatCalendarPage />;
      case 'courrier-infos':
        return (
          <Navigate to="/secretariat-space/messagerie?inboxTab=emails" replace />
        );
      case 'marketing':
        return <SecretariatMarketingPanelPage />;
      case 'messagerie':
        return <SecretariatInboxPage />;
      case 'teachers':
        return <TeachersPage />;
      case 'how-it-works':
        return <HowItWorksPage />;
      case 'courses':
        return <CoursesPage />;
      case 'document-admin':
        return <AdministrativeDocumentStudio />;
      case 'cycles-disciple':
        return <CyclesDetailPage cycleId="disciple" />;
      case 'cycles-initie':
        return <CyclesDetailPage cycleId="initie" />;
      case 'cycles-maitre':
        return <CyclesDetailPage cycleId="maitre" />;
      default:
        return <SecretariatOverview />;
    }
  };

  return (
    <SecretariatDashboardLayout activeTab={activeTab} onTabChange={handleTabChange}>
      {activeTab === 'dashboard' && (
        <div className="mb-6 flex flex-col sm:flex-row sm:justify-end gap-2">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 p-2 rounded-[14px] border border-[var(--lt-border)] shadow-[var(--lt-card-shadow)] w-full sm:w-auto" style={{ background: 'var(--lt-card-bg)' }}>
            <span className="text-sm text-[var(--lt-sub)] sm:pl-2">Année scolaire</span>
            <Select value={currentYear} onValueChange={setSchoolYear}>
              <SelectTrigger className="w-full sm:w-[140px] bg-[var(--lt-inner-bg)] border-[var(--lt-border)] text-[var(--lt-text)] h-9 sm:h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2024-2025">2024-2025</SelectItem>
                <SelectItem value="2023-2024">2023-2024</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}
      {renderContent()}
    </SecretariatDashboardLayout>
  );
};

export default SecretariatDashboard;
