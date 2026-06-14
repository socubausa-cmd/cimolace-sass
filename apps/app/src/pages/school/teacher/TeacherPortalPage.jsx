import React from 'react';
import { Routes, Route, Navigate, useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import TeacherSchoolLifeSidebar from '@/components/school/teacher/TeacherSchoolLifeSidebar';
import StudentDashboardPage from '@/pages/school/StudentDashboardPage';
import StudentFormationsPage from '@/pages/school/student-school-life/StudentFormationsPage';
import StudentEvaluationsPage from '@/pages/school/student-school-life/StudentEvaluationsPage';
import StudentProfilePage from '@/pages/school/student-school-life/StudentProfilePage';
import TeacherAgendaPage from '@/pages/school/teacher/TeacherAgendaPage';
import AnnualProgramPage from '@/pages/school/teacher/AnnualProgramPage';
import StudentNotesPage from '@/pages/school/student-school-life/StudentNotesPage';
import StudentAbsencesPage from '@/pages/school/student-school-life/StudentAbsencesPage';
import StudentDocumentsPage from '@/pages/school/student-school-life/StudentDocumentsPage';
import SchoolLifePage from '@/pages/school/SchoolLifePage';
import BibliothequePage from '@/pages/BibliothequePage';
import LibraryPage from '@/pages/LibraryPage';
import TeacherClassroomPage from '@/pages/school/TeacherClassroomPage';
import TeacherCorrectionPanel from '@/components/school/teacher/TeacherCorrectionPanel';
import LiveSessionManager from '@/components/liri/lives/LiveSessionManager';
import LiveStudioPage from '@/pages/liri/LiveStudioPage';
import { isnaTenantConfig } from '@/tenants/isna/tenant.config';
import StudentForumRedesign from '@/pages/school/student-school-life/StudentForumRedesign';
import ForumNewQuestionPage from '@/pages/school/student-school-life/ForumNewQuestionPage';
import ForumThreadPage from '@/pages/school/student-school-life/ForumThreadPage';
import { FormationForumContent } from '@/pages/school/FormationForumPage';
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
    <div style={{ minHeight: '100dvh', background: '#0B0B0F', display: 'flex' }}>
      <Helmet>
        <title>{`Espace Professeur | ${schoolBrand}`}</title>
      </Helmet>

      <TeacherSchoolLifeSidebar />

      {/* Main Content Area — lg:pl-[250px] offsets content past the fixed sidebar */}
      <main
        style={{ flex: 1, overflowX: 'hidden', minHeight: '100dvh' }}
        className="lg:pl-[250px]"
      >
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '28px 24px 48px' }}>
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
            <Route path="forum/new" element={<ForumNewQuestionPage />} />
            <Route path="forum/thread/:threadId" element={<ForumThreadPage />} />
            <Route path="forum" element={<StudentForumRedesign forumBasePath={FORUM_COMMUNITY_PATH.teacher} />} />
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
