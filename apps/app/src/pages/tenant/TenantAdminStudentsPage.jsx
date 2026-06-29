/**
 * TenantAdminStudentsPage — /t/:tenantSlug/admin/students
 *
 * CONSOLIDÉ (2026-06-28) — fin de la « double application » du moteur Élèves.
 * AVANT : ce back-office lisait/écrivait la table `enrollments` via l'API NestJS
 * `/secretariat/enrollments` = un JUMEAU MORT. Preuve : `enrollments` était VIDE
 * en prod (0 ligne, total + ISNA), alors que l'app élève, le secrétariat, le
 * lecteur de cours et le portail lisent tous `student_progress` (6 lignes réelles).
 * Un élève inscrit ici n'apparaissait donc NULLE PART côté élève.
 *
 * MAINTENANT : on rend le composant VIVANT `SecretariatStudentDashboard` (lit/écrit
 * `student_progress`, déjà réutilisé par /owner-dashboard, /secretariat-space et
 * /liri/ecole) → UNE seule source de vérité pour les élèves, le shell tenant-admin
 * en plus. Le moteur Cours (`/t/:slug/admin/courses`) n'est PAS touché : ses tables
 * `course_modules`/`course_lessons` servent les Parcours scolaires (vivants).
 */
import SecretariatStudentDashboard from '@/components/secretariat/SecretariatStudentDashboard';
import { SslThemeProvider } from '@/pages/school/student-school-life/sslTheme';
import TenantAdminShell from '@/components/admin/TenantAdminShell';
import ErrorBoundary from '@/components/ErrorBoundary';

// SecretariatStudentDashboard lit les tokens `--lt-*` (définis sous le shell admin
// secrétariat). On les remappe ici à la palette SOMBRE du shell tenant-admin (navy +
// or) pour que le composant épouse le shell au lieu d'un fond clair.
// Contrastes vérifiés WCAG sur les cartes (--lt-card-bg #12111a) : --lt-muted 0.52 ≈ 5.5:1
// (≥4.5 AA), --lt-sub 0.70 ≈ 9:1.
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

export default function TenantAdminStudentsPage() {
  return (
    <TenantAdminShell>
      <ErrorBoundary logTag="TenantAdmin · Étudiants">
        <SslThemeProvider mode="dark">
          <div style={STUDENTS_THEME_VARS}>
            <SecretariatStudentDashboard />
          </div>
        </SslThemeProvider>
      </ErrorBoundary>
    </TenantAdminShell>
  );
}
