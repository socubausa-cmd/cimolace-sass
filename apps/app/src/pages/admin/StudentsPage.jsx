/**
 * StudentsPage — /admin/students (back-office ADMIN du founder ISNA ;
 * /t/isna/admin/students y redirige).
 *
 * CONSOLIDÉ (2026-06-28) — fin de la « TRIPLE application » du moteur Élèves.
 * AVANT : cette page lisait la table `students` — une 3ᵉ source MORTE (table
 * inexistante en prod) ≠ `student_progress` (VIVANT, 6 lignes réelles) ≠ `enrollments`
 * (mort, 0 ligne). Trois implémentations Élèves différentes pour la même école.
 *
 * MAINTENANT : on rend le composant VIVANT `SecretariatStudentDashboard` (lit/écrit
 * `student_progress`, déjà réutilisé par /owner-dashboard, /secretariat-space,
 * /liri/ecole et /t/:slug/admin/students) → UNE seule source de vérité pour les élèves.
 */
import { Helmet } from 'react-helmet';
import SecretariatStudentDashboard from '@/components/secretariat/SecretariatStudentDashboard';
import { SslThemeProvider } from '@/pages/school/student-school-life/sslTheme';
import ErrorBoundary from '@/components/ErrorBoundary';

// SecretariatStudentDashboard lit les tokens `--lt-*` → remappés à une palette sombre
// (le back-office admin est sombre) sinon fond clair incohérent.
// Contrastes vérifiés WCAG sur les cartes (--lt-card-bg #12111a) : --lt-muted 0.52 ≈ 5.5:1
// (≥4.5 AA), --lt-sub 0.70 ≈ 9:1, --lt-text #f5f5f7 ≈ 15:1.
const PAGE_BG = '#0b0b0f';
const STUDENTS_THEME_VARS = {
  '--lt-text': '#f5f5f7',
  '--lt-sub': 'rgba(245,245,247,0.70)',
  '--lt-muted': 'rgba(245,245,247,0.52)',
  '--lt-border': 'rgba(255,255,255,0.10)',
  '--lt-card-bg': '#12111a',
  '--lt-card-border': 'rgba(255,255,255,0.08)',
  '--lt-card-shadow': '0 10px 30px -16px rgba(0,0,0,0.6)',
  '--lt-inner-bg': '#0e0d14',
  '--lt-gold': '#D4AF37',
  '--lt-gold-ink': '#e3c558',
};

const StudentsPage = () => (
  <>
    <Helmet><title>Gestion Étudiants | Admin</title></Helmet>
    <ErrorBoundary logTag="Admin · Étudiants">
      <SslThemeProvider mode="dark">
        {/* /admin/students n'a PAS de shell (≠ /t/:slug/admin/* qui a TenantAdminShell,
            ≠ /liri/ecole qui a son portail). Le dashboard, lui, n'a pas de fond propre
            (son wrapper racine est `space-y-6`). Sans canevas, il flottait sur le fond
            global → titre/texte « délavés ». On garantit donc ici un canevas SOMBRE
            plein écran + le centrage/padding. */}
        <div style={{ minHeight: '100dvh', background: PAGE_BG, ...STUDENTS_THEME_VARS }}>
          <div style={{ maxWidth: 1180, margin: '0 auto', padding: '28px 20px 56px' }}>
            <SecretariatStudentDashboard />
          </div>
        </div>
      </SslThemeProvider>
    </ErrorBoundary>
  </>
);

export default StudentsPage;
