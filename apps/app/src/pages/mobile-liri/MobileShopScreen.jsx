import { Navigate } from 'react-router-dom';
import { ELEVE_MOBILE } from '@/lib/eleveMobileRoutes';

/** Alias mobile vers l'écran boutique natif. */
export default function MobileShopScreen() {
  return <Navigate to={ELEVE_MOBILE.shop} replace />;
}
