import React, { lazy, Suspense, useEffect, useState } from 'react';
import { getActiveTenantBranding } from '@/lib/tenant/activeBranding';
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
import CommunicationShell from '@/components/school/CommunicationShell';
import StudentNeuroRecallPage from './StudentNeuroRecallPage';
import ForumNewQuestionPage from './ForumNewQuestionPage';
import ForumThreadPage from './ForumThreadPage';
import SchoolLifePage from '@/pages/school/SchoolLifePage';
import BibliothequePage from '@/pages/BibliothequePage';
import LibraryPage from '@/pages/LibraryPage';
import { FormationForumContent } from '@/pages/school/FormationForumPage';
import { SslThemeProvider, SSL_LIGHT_CLASS, ensureSslLightStyles } from './sslTheme';
import { useShellTint } from '@/lib/useShellTint';

/* Icônes bascule de teinte (mêmes tracés que le shell back-office) */
const SslIconSun = () => (
  <svg viewBox="0 0 20 20" width={17} height={17} fill="none">
    <circle cx="10" cy="10" r="3.4" stroke="currentColor" strokeWidth="1.5" />
    <path d="M10 2.4v2.2M10 15.4v2.2M2.4 10h2.2M15.4 10h2.2M4.9 4.9l1.5 1.5M13.6 13.6l1.5 1.5M15.1 4.9l-1.5 1.5M6.4 13.6l-1.5 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);
const SslIconMoon = () => (
  <svg viewBox="0 0 20 20" width={17} height={17} fill="none">
    <path d="M10 2.5a5 5 0 0 0 7.5 7.5 7.5 7.5 0 1 1-7.5-7.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
  </svg>
);

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
  const isForum = location.pathname.includes('/forum');
  // Nav TOUJOURS dépliée par défaut (cohérent sur les 4 rôles) — l'utilisateur peut
  // la réduire manuellement via le bouton tiroir, mais on ne la replie plus de force.
  const [collapsed, setCollapsed] = useState(false);
  // Injecte le remap CSS clair (pages en utilitaires Tailwind/shadcn). Idempotent.
  useEffect(() => { ensureSslLightStyles(); }, []);
  // Bascule de teinte partagée avec le back-office (clé localStorage commune). Défaut = crème clair.
  const [tint, toggleTint] = useShellTint();
  const isLight = tint !== 'dark';

  return (
    // Espace ÉLÈVE = thème CLAIR. La SIDEBAR (panneau flottant sombre/or) garde son
    // propre fond et n'est PAS affectée — seul le contenu central passe au clair.
    <SslThemeProvider mode={isLight ? 'light' : 'dark'}>
      <div className={isLight ? SSL_LIGHT_CLASS : ''} style={{ minHeight: '100dvh', background: isLight ? '#F4EFE3' : '#0b0b0f', display: 'flex' }}>
        <Helmet><title>{`Espace Étudiant | ${getActiveTenantBranding().name}`}</title></Helmet>

        {/* Bouton de bascule de teinte (crème ⇄ sombre) — flottant, clé partagée avec le back-office */}
        <button
          type="button"
          onClick={toggleTint}
          aria-label={isLight ? 'Passer au thème sombre' : 'Passer au thème crème'}
          title={isLight ? 'Thème sombre' : 'Thème crème'}
          style={{
            position: 'fixed', top: 16, right: 20, zIndex: 50,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 40, height: 40, borderRadius: 11, cursor: 'pointer',
            background: isLight ? '#FFFFFF' : 'rgba(255,255,255,0.06)',
            border: `1px solid ${isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.10)'}`,
            color: isLight ? '#52525B' : 'rgba(245,245,247,0.65)',
            boxShadow: isLight ? '0 1px 3px rgba(0,0,0,0.08)' : '0 2px 8px rgba(0,0,0,0.4)',
            transition: 'background 150ms ease, color 150ms ease, border-color 150ms ease',
          }}
        >
          {isLight ? <SslIconMoon /> : <SslIconSun />}
        </button>

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
            <Route path="forum" element={<CommunicationShell forumBasePath="/student-school-life/forum" />} />
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