import React from 'react';
import { Navigate, useParams } from 'react-router-dom';
import LiriHostEmptyStateUI from './LiriHostEmptyStateUI';
import LiriHostShellDevPage from './LiriHostShellDevPage';
import LiriMobileGuestDevPage from './LiriMobileGuestDevPage';
import OwnerShellDevPage from './OwnerShellDevPage';
import EleveShellDevPage from './EleveShellDevPage';
import LiveHostPage from '@/pages/liri/LiveHostPage';

/**
 * Point d'entrée unique pour /dev/* — évite les 404 si la correspondance des routes plates varie
 * (slash final, préfixe, etc.).
 *
 * ⛔ TOUTES les maquettes d'ici sont réservées au build DEV, sans exception. `liri-host-live` et
 * `liri-guest-live` montent la VRAIE page hôte peuplée de 7 participants FICTIFS portant des noms
 * de personnes et marqués « online » (LiveHostPage.jsx, membres de démonstration) : servie en
 * production sur prorascience.org, elle se lisait comme une vraie salle de classe en direct.
 * Avant, seuls `owner-shell` et `eleve-shell` étaient gardés — la garde est maintenant globale.
 */
export default function DevLiriHostEntry() {
  const { '*': raw } = useParams();
  const key = String(raw || '')
    .replace(/^\/+|\/+$/g, '')
    .toLowerCase();

  if (!import.meta.env.DEV) return <Navigate to="/" replace />;

  if (key === 'liri-host-ui') {
    return <LiriHostEmptyStateUI />;
  }
  if (key === 'liri-host-shell') {
    return <LiriHostShellDevPage />;
  }
  if (key === 'liri-host-live') {
    return <LiveHostPage />;
  }
  if (key === 'liri-guest-live') {
    // Aperçu dev de la VUE INVITÉ (même mock 7 membres, isGuestUi via forceGuestRoute).
    return <LiveHostPage forceGuestRoute />;
  }
  if (key === 'liri-mobile-guest') {
    return <LiriMobileGuestDevPage />;
  }
  if (key === 'owner-shell') {
    return <OwnerShellDevPage />;
  }
  if (key === 'eleve-shell') {
    return <EleveShellDevPage />;
  }

  if (key === '') {
    return <Navigate to="/dev/liri-host-ui" replace />;
  }

  return <Navigate to="/dev/liri-host-ui" replace />;
}
