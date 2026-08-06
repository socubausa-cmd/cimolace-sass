import React from 'react';
import { LiriPortalShell } from '@/components/liri/LiriPortalShell';
import OrgMailboxPage from '@/pages/secretariat/OrgMailboxPage';

/**
 * Courrier (boîte email org infos@prorascience.org) DANS le portail LIRI.
 * Réutilise le lecteur IMAP intégré (OrgMailboxPage / useOrgMailbox) : synchro
 * auto toutes les 30 min + lecture/réponse sans sortir vers le webmail Hostinger.
 */
export default function LiriCourrierPage() {
  return (
    <LiriPortalShell active="courrier">
      <div className="h-full min-h-0 overflow-y-auto px-4 py-5 md:px-7">
        <OrgMailboxPage />
      </div>
    </LiriPortalShell>
  );
}
