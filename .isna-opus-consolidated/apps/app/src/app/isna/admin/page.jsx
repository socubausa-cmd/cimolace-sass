/**
 * ═══════════════════════════════════════════════════════════════
 * CIMOLACE ISNA ADMIN REDIRECT
 * Route temporaire pour rediriger vers le nouveau système de tenant
 * ═══════════════════════════════════════════════════════════════
 */

import { redirect } from 'next/navigation';

export default function IsnaAdminRedirectPage() {
  // Redirection temporaire vers le nouveau système de tenant
  redirect('/t/isna/admin');
}
