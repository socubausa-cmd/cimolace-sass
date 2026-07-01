import React, { useEffect } from 'react';
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
import LiveStudioPage from '@/pages/studio-creator/LiveStudioPage';
import { getActiveTenantBranding } from '@/lib/tenant/activeBranding';
import StudentForumRedesign from '@/pages/school/student-school-life/StudentForumRedesign';
import ForumNewQuestionPage from '@/pages/school/student-school-life/ForumNewQuestionPage';
import ForumThreadPage from '@/pages/school/student-school-life/ForumThreadPage';
import TopicThreadPage from '@/pages/school/student-school-life/TopicThreadPage';
import { FormationForumContent } from '@/pages/school/FormationForumPage';
import { FORUM_COMMUNITY_PATH } from '@/lib/forumDashboardPaths';
import { SslThemeProvider, SSL_LIGHT_CLASS, ensureSslLightStyles } from '@/pages/school/student-school-life/sslTheme';
import { useShellTint } from '@/lib/useShellTint';

/* Icônes bascule de teinte (mêmes tracés que le shell back-office / élève) */
const TpIconSun = () => (
  <svg viewBox="0 0 20 20" width={17} height={17} fill="none">
    <circle cx="10" cy="10" r="3.4" stroke="currentColor" strokeWidth="1.5" />
    <path d="M10 2.4v2.2M10 15.4v2.2M2.4 10h2.2M15.4 10h2.2M4.9 4.9l1.5 1.5M13.6 13.6l1.5 1.5M15.1 4.9l-1.5 1.5M6.4 13.6l-1.5 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);
const TpIconMoon = () => (
  <svg viewBox="0 0 20 20" width={17} height={17} fill="none">
    <path d="M10 2.5a5 5 0 0 0 7.5 7.5 7.5 7.5 0 1 1-7.5-7.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
  </svg>
);

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
  const schoolBrand = getActiveTenantBranding().name || 'LIRI';
  useEffect(() => { ensureSslLightStyles(); }, []);
  // Bascule de teinte partagée (clé localStorage commune au back-office + élève). Défaut crème.
  const [tint, toggleTint] = useShellTint();
  const isLight = tint !== 'dark';
  return (
    <SslThemeProvider mode={isLight ? 'light' : 'dark'}>
    <div className={isLight ? SSL_LIGHT_CLASS : ''} style={{ minHeight: '100dvh', background: isLight ? '#F4EFE3' : '#0B0B0F', display: 'flex' }}>
      {/* Bouton de bascule de teinte (crème ⇄ sombre) — flottant haut-droite */}
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
        {isLight ? <TpIconMoon /> : <TpIconSun />}
      </button>
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
            <Route path="forum/topic/:topicId" element={<TopicThreadPage />} />
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
    </SslThemeProvider>
  );
};

export default TeacherPortalPage;
