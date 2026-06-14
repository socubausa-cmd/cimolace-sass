import React, { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useParams, useNavigate } from 'react-router-dom';
const TenantCourseDetailPage = lazy(() => import('@/pages/tenant/TenantCourseDetailPage'));
import { Helmet } from 'react-helmet';
import StudentSchoolLifeSidebar from '@/components/school/student/StudentSchoolLifeSidebar';
import StudentDashboardPage from '@/pages/school/StudentDashboardPage';
import StudentFormationsPage from './StudentFormationsPage';
import StudentEvaluationsPage from './StudentEvaluationsPage';
import StudentProfilePage from './StudentProfilePage';
import StudentAgendaPage from './StudentAgendaPage';
import StudentNotesPage from './StudentNotesPage';
import StudentAbsencesPage from './StudentAbsencesPage';
import StudentDocumentsPage from './StudentDocumentsPage';
import StudentForumCommunityPage from './StudentForumCommunityPage';
import StudentForumRedesign from './StudentForumRedesign';
import StudentNeuroRecallPage from './StudentNeuroRecallPage';
import ForumNewQuestionPage from './ForumNewQuestionPage';
import ForumThreadPage from './ForumThreadPage';
import SchoolLifePage from '@/pages/school/SchoolLifePage';
import BibliothequePage from '@/pages/BibliothequePage';
import LibraryPage from '@/pages/LibraryPage';
import { FormationForumContent } from '@/pages/school/FormationForumPage';

function StudentFormationForumRoute() {
  const { formationId } = useParams();
  if (!formationId) return null;
  return <FormationForumContent formationId={formationId} embedded />;
}

// Lecteurs de livres — ouverts DANS le shell élève (même écran, sidebar conservée)
// au lieu de naviguer vers la page publique autonome.
const BOOK_READERS = {
  'fond-de-tout': lazy(() => import('@/pages/FondDeToutPage')),
  'dialogue-physique': lazy(() => import('@/pages/DialoguePhysiquePage')),
  'ontodynamique': lazy(() => import('@/pages/OntodynamiquePage')),
  'manuel-initiatique-bris-de-sort': lazy(() => import('@/pages/ManuelInitiatiqueBrisDeSortPage')),
};

function StudentBookReaderRoute() {
  const { bookId } = useParams();
  const navigate = useNavigate();
  const Reader = BOOK_READERS[bookId];
  if (!Reader) return <Navigate to="/student-school-life/bibliotheque" replace />;
  return (
    <div className="student-book-reader">
      {/* Le lecteur a son propre fond (#0F1419) qui ferait une "boîte" sur le shell.
          On le rend transparent → le texte s'emboîte avec l'arrière-plan de l'espace élève. */}
      <style>{`
        .student-book-reader > div { background-color: transparent !important; min-height: auto !important; }
        /* Fond du lecteur transparent, SAUF la barre sticky de chapitres (qui doit couvrir le texte). */
        .student-book-reader [class*="0F1419" i]:not(.sticky) { background-color: transparent !important; }
        /* Barre de chapitres : reste collée SOUS le header du shell (89px), fond opaque, au-dessus du contenu. */
        .student-book-reader .sticky {
          top: 96px !important;
          background-color: rgba(11,11,15,0.96) !important;
          backdrop-filter: blur(12px);
          z-index: 40 !important;
        }
      `}</style>
      <button
        type="button"
        onClick={() => navigate('/student-school-life/bibliotheque')}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 7,
          marginBottom: 18, padding: '8px 15px', borderRadius: 11,
          background: 'rgba(212,175,55,0.10)', border: '1px solid rgba(212,175,55,0.30)',
          color: '#D4AF37', fontSize: 13.5, fontWeight: 600, cursor: 'pointer',
        }}
      >
        <span style={{ fontSize: 16, lineHeight: 1 }}>←</span> Retour à la bibliothèque
      </button>
      <Suspense fallback={<div style={{ padding: 48, textAlign: 'center', color: '#9ca3af' }}>Chargement du livre…</div>}>
        <Reader />
      </Suspense>
    </div>
  );
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
        className="lg:pl-[250px]"
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
            <Route path="neuro-recall" element={<StudentNeuroRecallPage />} />
            <Route path="forum/formation/:formationId" element={<StudentFormationForumRoute />} />
            <Route path="forum" element={<StudentForumRedesign />} />
            <Route path="forum/new" element={<ForumNewQuestionPage />} />
            <Route path="forum/thread/:threadId" element={<ForumThreadPage />} />
            <Route path="vie-scolaire" element={<SchoolLifePage embedded />} />
            <Route path="bibliotheque" element={<BibliothequePage embedded />} />
            <Route path="bibliotheque/:bookId" element={<StudentBookReaderRoute />} />
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