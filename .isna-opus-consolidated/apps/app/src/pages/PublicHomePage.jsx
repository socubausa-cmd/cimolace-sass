import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import LandingPage from '@/pages/LandingPage';
import { LIRI_MOBILE } from '@/lib/liriMobileRoutes';

/**
 * Accueil public : sur viewport ≤1023px, entrée app LIRI élève (/m/eleve) ;
 * au-delà, landing marketing classique.
 */
const PublicHomePage = () => {
  const [nativeMobileHome, setNativeMobileHome] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 1023px)').matches : false,
  );

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1023px)');
    const onChange = () => setNativeMobileHome(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  if (nativeMobileHome) return <Navigate to={LIRI_MOBILE.home} replace />;
  return <LandingPage />;
};

export default PublicHomePage;
