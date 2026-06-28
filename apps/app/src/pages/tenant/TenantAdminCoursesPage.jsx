/**
 * TenantAdminCoursesPage — /t/:tenantSlug/admin/courses
 *
 * CONSOLIDÉ (2026-06-28) — fin de la « double application » du moteur Cours.
 *
 * AVANT : ce back-office éditait un MODÈLE DE CONTENU PARALLÈLE (`course_modules` +
 * `course_lessons`, via l'API NestJS /courses → coursesApi) que le LECTEUR DE COURS
 * ÉLÈVE n'a JAMAIS lu. Le player (CoursePlayerInterface / useFormationStructure) lit la
 * Famille A : `modules → formation_weeks → formation_days → formation_day_contents`.
 * Construire un cours + modules + leçons ICI ne produisait donc RIEN côté élève — exactement
 * la confusion « deux apps qui se chevauchent » signalée.
 *
 * AUDIT (read/write réel) :
 *   • `course_lessons`  → écrit UNIQUEMENT ici, lu NULLE PART = mort.
 *   • `course_modules`  → lu uniquement par les Parcours scolaires, qui ont leur PROPRE
 *     éditeur AUTONOME (SchoolPathCourseStructurePanel → schoolPathsApi.createCourseModule/
 *     updateCourseModule/deleteCourseModule). Ils ne dépendent pas de cette page.
 *   ⇒ Cette page liste/édite était un JUMEAU REDONDANT du vrai éditeur de cours.
 *
 * MAINTENANT : on rend l'éditeur VIVANT `OwnerFormationsTab` (Famille A — la SEULE source
 * que le lecteur de cours élève affiche réellement, déjà réutilisé par /owner-dashboard,
 * /secretariat-space et /liri/ecole) dans le shell tenant-admin → UNE seule source de
 * vérité pour le contenu des cours.
 *
 * NON touché : les Parcours scolaires (`/t/:slug/admin/school-paths`) gardent leur éditeur
 * dédié et leurs `course_modules` existants (aucune donnée supprimée). La page détail
 * `/t/:slug/admin/courses/:courseId` (TenantCourseDetailPage) lit DÉJÀ la Famille A
 * (fetchOutline) → l'ensemble est cohérent.
 */
import OwnerFormationsTab from '@/components/owner/OwnerFormationsTab';
import TenantAdminShell from '@/components/admin/TenantAdminShell';
import ErrorBoundary from '@/components/ErrorBoundary';

export default function TenantAdminCoursesPage() {
  return (
    <TenantAdminShell>
      <ErrorBoundary logTag="TenantAdmin · Cours">
        <OwnerFormationsTab />
      </ErrorBoundary>
    </TenantAdminShell>
  );
}
