/**
 * ═══════════════════════════════════════════════════════════════
 * CIMOLACE ISNA REPLAY REDIRECT
 * Route temporaire pour rediriger vers le nouveau système de tenant
 * ═══════════════════════════════════════════════════════════════
 */

import { redirect } from 'next/navigation';

export default function IsnaReplayRedirectPage() {
  // Redirection temporaire vers le nouveau système de tenant
  redirect('/t/isna/admin');
}
