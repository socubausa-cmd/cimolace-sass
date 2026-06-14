import { Navigate } from 'react-router-dom';
import { ELEVE_MOBILE } from '@/lib/eleveMobileRoutes';

/**
 * URL historique : renvoie vers l'écran Forfaits (abonnement par cycle).
 * Catalogue modules : /m/eleve/modules
 */
export default function EleveModulesForfaitsScreen() {
  return <Navigate to={ELEVE_MOBILE.forfaits} replace />;
}
