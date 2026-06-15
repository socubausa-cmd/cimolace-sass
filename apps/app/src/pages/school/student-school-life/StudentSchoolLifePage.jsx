import React, { lazy, Suspense, useEffect, useState } from 'react';
import { Routes, Route, Navigate, useParams, useNavigate, useLocation } from 'react-router-dom';
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
import { SslThemeProvider, SSL_LIGHT_CLASS, ensureSslLightStyles } from './sslTheme';

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
      {/* Le lecteur a son propre fond sombre (#0F1419) qui ferait une "boîte" sur le shell.
          Espace élève = thème CLAIR → on le rend transparent (le texte s'emboîte sur le canvas clair)
          et on force un texte lisible sur fond clair. */}
      <style>{`
        .student-book-reader > div { background-color: transparent !important; min-height: auto !important; color: #18181B !important; }
        /* Fond du lecteur transparent, SAUF la barre sticky de chapitres (qui doit couvrir le texte). */
        .student-book-reader [class*="0F1419" i]:not(.sticky) { background-color: transparent !important; }
        /* Texte du lecteur : passer des tons clairs (conçus pour fond sombre) au sombre lisible. */
        .student-book-reader .text-white,
        .student-book-reader [class*="text-gray-1" i],
        .student-book-reader [class*="text-gray-2" i],
        .student-book-reader [class*="text-gray-3" i] { color: #18181B !important; }
        .student-book-reader [class*="text-gray-4" i],
        .student-book-reader [class*="text-gray-5" i] { color: #52525B !important; }
        /* Barre de chapitres : collée SOUS le header du shell, fond clair translucide, au-dessus du contenu. */
        .student-book-reader .sticky {
          top: 96px !important;
          background-color: rgba(244,245,247,0.92) !important;
          backdrop-filter: blur(12px);
          border-bottom: 1px solid rgba(0,0,0,0.08);
          color: #18181B !important;
          z-index: 40 !important;
        }
      `}</style>
      <button
        type="button"
        onClick={() => navigate('/student-school-life/bibliotheque')}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 7,
          marginBottom: 18, padding: '8px 15px', borderRadius: 11,
          background: 'rgba(212,175,55,0.12)', border: '1px solid rgba(212,175,55,0.40)',
          color: '#8A6D1A', fontSize: 13.5, fontWeight: 600, cursor: 'pointer',
        }}
      >
        <span style={{ fontSize: 16, lineHeight: 1 }}>←</span> Retour à la bibliothèque
      </button>
      <Suspense fallback={<div style={{ padding: 48, textAlign: 'center', color: '#71717A' }}>Chargement du livre…</div>}>
        <Reader />
      </Suspense>
    </div>
  );
}

// Main Wrapper Layout for Student School Life Area
const StudentSchoolLifePage = () => {
  const location = useLocation();
  // Le forum réduit la sidebar en mode icônes pour centrer la conversation.
  const isForum = location.pathname.includes('/forum');
  const [collapsed, setCollapsed] = useState(isForum);
  // Auto : réduit en entrant sur le forum, étend en sortant (l'utilisateur peut surcharger via le bouton tiroir).
  useEffect(() => { setCollapsed(isForum); }, [isForum]);
  // Injecte le remap CSS clair (pages en utilitaires Tailwind/shadcn). Idempotent.
  useEffect(() => { ensureSslLightStyles(); }, []);

  return (
    // Espace ÉLÈVE = thème CLAIR. La SIDEBAR (panneau flottant sombre/or) garde son
    // propre fond et n'est PAS affectée — seul le contenu central passe au clair.
    <SslThemeProvider mode="light">
      <div className={SSL_LIGHT_CLASS} style={{ minHeight: '100dvh', background: '#F4F5F7', display: 'flex' }}>
        <Helmet><title>Espace Étudiant | PRORASCIENCE</title></Helmet>

        {/* Sidebar (mode icônes sur le forum, bouton tiroir pour étendre) — reste SOMBRE */}
        <StudentSchoolLifeSidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />

        {/* Main Content Area — décalage adapté à la largeur de la sidebar */}
        <main
          style={{ flex: 1, overflowX: 'hidden', minHeight: '100dvh' }}
          className={collapsed ? 'lg:pl-[92px]' : 'lg:pl-[250px]'}
        >
          <div style={{ maxWidth: isForum ? 1480 : 1280, margin: '0 auto', padding: '28px 24px 48px' }}>
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
    </SslThemeProvider>
  );
};


export default StudentSchoolLifePage;