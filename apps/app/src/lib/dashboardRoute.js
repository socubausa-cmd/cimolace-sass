import { getEffectiveRole } from '@/lib/accountRoleMode';

export function resolveDashboardPath(user) {
  const role = getEffectiveRole(user);
  // Owner/admin → TOUJOURS le portail LIRI : le back-office école est embarqué dans
  // l'onglet École (/liri/ecole). Le vieux shell séparé /owner-dashboard est retiré, on
  // ne « retombe » plus jamais dessus, quel que soit le domaine. Le branding tenant (sur
  // prorascience.org) est porté par le shell du portail, pas par la route d'atterrissage.
  if (role === 'owner' || role === 'admin') return '/liri';
  if (role === 'secretariat') return '/secretariat-space/dashboard';
  if (role === 'teacher') return '/teacher-space/dashboard';
  if (role === 'creator') return '/creator-dashboard';
  if (role === 'visitor') return '/prospect/entretien';
  return '/student-school-life/dashboard';
}

