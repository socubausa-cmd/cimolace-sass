import { getEffectiveRole } from '@/lib/accountRoleMode';
import { isPlatformOrDevHost } from '@/lib/tenantResolver';

export function resolveDashboardPath(user) {
  const role = getEffectiveRole(user);
  // Le DOMAINE décide : hôte produit LIRI (liri.cimolace.space) → portail /liri ;
  // domaine d'un tenant (prorascience.org) → back-office École, brandé tenant (jamais « LIRI »).
  const isPlatformHost = typeof window !== 'undefined' && isPlatformOrDevHost(window.location.hostname);
  if (role === 'owner' || role === 'admin') return isPlatformHost ? '/liri' : '/owner-dashboard';
  if (role === 'secretariat') return '/secretariat-space/dashboard';
  if (role === 'teacher') return '/teacher-space/dashboard';
  if (role === 'creator') return '/creator-dashboard';
  if (role === 'visitor') return '/prospect/entretien';
  return '/student-school-life/dashboard';
}

