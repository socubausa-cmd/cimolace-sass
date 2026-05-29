export function suggestRouteByIntent(intent: string) {
  const safeIntent = String(intent || '').toLowerCase();
  if (safeIntent === 'booking') return '/appointment/request';
  if (safeIntent === 'coaching') return '/accompagnement/coaching';
  if (safeIntent === 'module') return '/formations/catalogue';
  if (safeIntent === 'pricing') return '/forfaits';
  return '/formations/catalogue';
}
