import { getEffectiveRole } from '@/lib/accountRoleMode';

export function resolveDashboardPath(user) {
  const role = getEffectiveRole(user);
  if (role === 'owner' || role === 'admin') return '/liri';
  if (role === 'secretariat') return '/secretariat-space/dashboard';
  if (role === 'teacher') return '/teacher-space/dashboard';
  if (role === 'creator') return '/creator-dashboard';
  if (role === 'visitor') return '/prospect/entretien';
  return '/student-school-life/dashboard';
}

