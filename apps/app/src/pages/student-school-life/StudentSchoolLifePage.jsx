import React, { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useParams } from 'react-router-dom';
const TenantCourseDetailPage = lazy(() => import('@/pages/tenant/TenantCourseDetailPage'));
import { Helmet } from 'react-helmet';
import StudentSchoolLifeSidebar from '@/components/student/StudentSchoolLifeSidebar';
import StudentDashboardPage from '@/pages/StudentDashboardPage';
import StudentFormationsPage from './StudentFormationsPage';
import StudentEvaluationsPage from './StudentEvaluationsPage';
import StudentProfilePage from './StudentProfilePage';
import StudentAgendaPage from './StudentAgendaPage';
import StudentNotesPage from './StudentNotesPage';
import StudentAbsencesPage from './StudentAbsencesPage';
import StudentDocumentsPage from './StudentDocumentsPage';
import StudentForumCommunityPage from './StudentForumCommunityPage';
import StudentForumRedesign from './StudentForumRedesign';
import ForumNewQuestionPage from './ForumNewQuestionPage';
import ForumThreadPage from './ForumThreadPage';
import SchoolLifePage from '@/pages/SchoolLifePage';
import BibliothequePage from '@/pages/BibliothequePage';
import LibraryPage from '@/pages/LibraryPage';
import { FormationForumContent } from '@/pages/FormationForumPage';

function StudentFormationForumRoute() {
  const { formationId } = useParams();
  if (!formationId) return null;
  return <FormationForumContent formationId={formationId} embedded />;
}

// Main Wrapper Layout for Student School Life Area
const StudentSchoolLifePage = () => {
  return (
    <div style={{ minHeight: '100dvh', background: '#0B0B0F', display: 'flex' }}>
      <Helmet><title>Espace Étudiant | PRORASCIENCE</title></Helmet>

      {/* Sidebar */}
      <StudentSchoolLifeSidebar />

      {/* Main Content Area — lg:pl-[220px] offsets content past the fixed sidebar */}
      <main
        style={{ flex: 1, overflowX: 'hidden', minHeight: '100dvh' }}
        className="lg:pl-[220px]"
      >
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '28px 24px 48px' }}>
          <Routes>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<StudentDashboardPage />} />
            <Route path="formations" element={<StudentFormationsPage />} />
            <Route path="cours/:courseId" element={<Suspense fallback={null}><TenantCourseDetailPage /></Suspense>} />
            <Route path="agenda" element={<StudentAgendaPage />} />
            <Route path="evaluations" element={<StudentEvaluationsPage />} />
            <Route path="notes" element={<StudentNotesPage />} />
            <Route path="absences" element={<StudentAbsencesPage />} />
            <Route path="documents" element={<StudentDocumentsPage />} />
            <Route path="forum/formation/:formationId" element={<StudentFormationForumRoute />} />
            <Route path="forum" element={<StudentForumRedesign />} />
            <Route path="forum/new" element={<ForumNewQuestionPage />} />
            <Route path="forum/thread/:threadId" element={<ForumThreadPage />} />
            <Route path="vie-scolaire" element={<SchoolLifePage embedded />} />
            <Route path="bibliotheque" element={<BibliothequePage embedded />} />
            <Route path="bibliotheque-ressources" element={<LibraryPage embedded />} />
            <Route path="profile" element={<StudentProfilePage />} />
            <Route path="notifications" element={<Navigate to="/notifications" replace />} />
            
            {/* Redirect /classroom inside this layout to the actual main classroom route outside this layout */}
            <Route path="classroom" element={<Navigate to="/classroom" replace />} />
          </Routes>
        </div>
      </main>
    </div>
  );
};


export default StudentSchoolLifePage;