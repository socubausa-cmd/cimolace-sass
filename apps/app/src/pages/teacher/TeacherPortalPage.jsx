import React from 'react';
import { Routes, Route, Navigate, useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import TeacherSchoolLifeSidebar from '@/components/teacher/TeacherSchoolLifeSidebar';
import StudentDashboardPage from '@/pages/StudentDashboardPage';
import StudentFormationsPage from '@/pages/student-school-life/StudentFormationsPage';
import StudentEvaluationsPage from '@/pages/student-school-life/StudentEvaluationsPage';
import StudentProfilePage from '@/pages/student-school-life/StudentProfilePage';
import TeacherAgendaPage from '@/pages/teacher/TeacherAgendaPage';
import AnnualProgramPage from '@/pages/teacher/AnnualProgramPage';
import StudentNotesPage from '@/pages/student-school-life/StudentNotesPage';
import StudentAbsencesPage from '@/pages/student-school-life/StudentAbsencesPage';
import StudentDocumentsPage from '@/pages/student-school-life/StudentDocumentsPage';
import SchoolLifePage from '@/pages/SchoolLifePage';
import BibliothequePage from '@/pages/BibliothequePage';
import LibraryPage from '@/pages/LibraryPage';
import TeacherClassroomPage from '@/pages/TeacherClassroomPage';
import TeacherCorrectionPanel from '@/components/teacher/TeacherCorrectionPanel';
import LiveSessionManager from '@/components/lives/LiveSessionManager';
import LiveStudioPage from '@/pages/LiveStudioPage';
import { isnaTenantConfig } from '@/tenants/isna/tenant.config';
import StudentForumCommunityPage from '@/pages/student-school-life/StudentForumCommunityPage';
import { FormationForumContent } from '@/pages/FormationForumPage';
import { FORUM_COMMUNITY_PATH } from '@/lib/forumDashboardPaths';

function TeacherFormationForumRoute() {
  const { formationId } = useParams();
  if (!formationId) return null;
  return (
    <FormationForumContent
      formationId={formationId}
      embedded
      communityForumTo={FORUM_COMMUNITY_PATH.teacher}
    />
  );
}

const TeacherPortalPage = () => {
  const schoolBrand = isnaTenantConfig?.branding?.name || 'LIRI';
  return (
    <div className="min-h-screen bg-[#0F1419] flex">
      <Helmet>
        <title>{`Espace Professeur | ${schoolBrand}`}</title>
      </Helmet>

      <TeacherSchoolLifeSidebar />

      <main className="flex-1 lg:pl-72 w-full pt-20 px-4 md:px-8 pb-12 overflow-x-hidden">
        <div className="max-w-7xl mx-auto">
          <Routes>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<StudentDashboardPage />} />
            <Route path="formations" element={<StudentFormationsPage />} />
            <Route path="agenda" element={<TeacherAgendaPage />} />
            <Route path="programme-annuel" element={<AnnualProgramPage />} />
            <Route path="evaluations" element={<StudentEvaluationsPage />} />
            <Route path="notes" element={<StudentNotesPage />} />
            <Route path="absences" element={<StudentAbsencesPage />} />
            <Route path="documents" element={<StudentDocumentsPage />} />
            <Route path="forum/formation/:formationId" element={<TeacherFormationForumRoute />} />
            <Route
              path="forum"
              element={<StudentForumCommunityPage forumBasePath={FORUM_COMMUNITY_PATH.teacher} />}
            />
            <Route path="vie-scolaire" element={<SchoolLifePage embedded />} />
            <Route path="bibliotheque" element={<BibliothequePage embedded />} />
            <Route path="bibliotheque-ressources" element={<LibraryPage embedded />} />
            <Route path="profile" element={<StudentProfilePage />} />
            <Route path="classroom" element={<TeacherClassroomPage />} />
            <Route path="classroom/:weekId" element={<TeacherClassroomPage />} />
            <Route path="classes" element={<TeacherClassroomPage defaultView="classes" />} />
            <Route path="classes/:weekId" element={<TeacherClassroomPage defaultView="classes" />} />
            <Route path="corrections" element={<TeacherCorrectionPanel />} />
            <Route path="live" element={<LiveSessionManager />} />
            <Route path="live-studio" element={<LiveStudioPage />} />
            <Route path="notifications" element={<Navigate to="/notifications" replace />} />
          </Routes>
        </div>
      </main>
    </div>
  );
};

export default TeacherPortalPage;
