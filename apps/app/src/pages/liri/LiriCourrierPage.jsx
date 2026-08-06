import React from 'react';
import { LiriPortalShell } from '@/components/liri/LiriPortalShell';
import OrgMailboxPage from '@/pages/secretariat/OrgMailboxPage';

/**
 * Courrier (boîte email org infos@prorascience.org) DANS le portail LIRI.
 * Réutilise le lecteur IMAP intégré (OrgMailboxPage / useOrgMailbox) : synchro
 * auto toutes les 30 min + lecture/réponse sans sortir vers le webmail Hostinger.
 *
 * Uniformisation visuelle : on redéfinit les variables `--lt-*` (thème secrétariat)
 * sur la palette LIRI chaude — fond = `--base` (#262624, comme le portail), accent
 * = `--coral` — pour que la boîte se fonde dans le portail au lieu d'un dark neutre.
 */
const LIRI_MAILBOX_THEME = {
  '--lt-card-bg': 'var(--base, #262624)',
  '--lt-inner-bg': 'rgba(255, 255, 255, 0.03)',
  '--lt-border': 'rgba(245, 244, 238, 0.08)',
  '--lt-card-shadow': '0 24px 60px -30px rgba(0, 0, 0, 0.55)',
  '--lt-text': '#f5f4ee',
  '--lt-sub': 'rgba(245, 244, 238, 0.55)',
  '--lt-muted': 'rgba(245, 244, 238, 0.4)',
  '--lt-gold-ink': 'var(--coral, #d97757)',
  '--school-accent': 'var(--coral, #d97757)',
};

export default function LiriCourrierPage() {
  return (
    <LiriPortalShell active="courrier">
      <div className="h-full min-h-0 overflow-y-auto px-4 py-5 md:px-7" style={LIRI_MAILBOX_THEME}>
        <OrgMailboxPage />
      </div>
    </LiriPortalShell>
  );
}
