/**
 * ═══════════════════════════════════════════════════════════════
 * CIMOLACE ISNA REDIRECT
 * Route temporaire pour rediriger vers le nouveau système de tenant
 * ═══════════════════════════════════════════════════════════════
 */

import { redirect } from 'next/navigation';

export default function IsnaRedirectPage() {
  // Redirection temporaire vers le nouveau système de tenant
  redirect('/t/isna/admin');
}
