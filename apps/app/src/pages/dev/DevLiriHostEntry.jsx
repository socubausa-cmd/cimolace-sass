import React from 'react';
import { Navigate, useParams } from 'react-router-dom';
import LiriHostEmptyStateUI from './LiriHostEmptyStateUI';
import LiriHostShellDevPage from './LiriHostShellDevPage';
import LiriMobileGuestDevPage from './LiriMobileGuestDevPage';
import OwnerShellDevPage from './OwnerShellDevPage';
import EleveShellDevPage from './EleveShellDevPage';
import LiveHostPage from '@/pages/LiveHostPage';

/**
 * Point d'entrée unique pour /dev/* — évite les 404 si la correspondance des routes plates varie
 * (slash final, préfixe, etc.).
 */
export default function DevLiriHostEntry() {
  const { '*': raw } = useParams();
  const key = String(raw || '')
    .replace(/^\/+|\/+$/g, '')
    .toLowerCase();

  if (key === 'liri-host-ui') {
    return <LiriHostEmptyStateUI />;
  }
  if (key === 'liri-host-shell') {
    return <LiriHostShellDevPage />;
  }
  if (key === 'liri-host-live') {
    return <LiveHostPage />;
  }
  if (key === 'liri-mobile-guest') {
    return <LiriMobileGuestDevPage />;
  }
  if (key === 'owner-shell') {
    if (!import.meta.env.DEV) return <Navigate to="/" replace />;
    return <OwnerShellDevPage />;
  }
  if (key === 'eleve-shell') {
    if (!import.meta.env.DEV) return <Navigate to="/" replace />;
    return <EleveShellDevPage />;
  }

  if (key === '') {
    return <Navigate to="/dev/liri-host-ui" replace />;
  }

  return <Navigate to="/dev/liri-host-ui" replace />;
}
