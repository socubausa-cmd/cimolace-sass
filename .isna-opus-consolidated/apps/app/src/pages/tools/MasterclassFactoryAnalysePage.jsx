import React from 'react';
import { Navigate } from 'react-router-dom';

/**
 * Ancienne route d'analyse — désormais intégrée dans le flow unifié de
 * `MasterclassFactoryPage` (8 étapes pilotées par `useMasterclassProject`).
 *
 * Cette redirection conserve les liens internes existants
 * (`/dashboard/tools/masterclass-factory/analyse`) en pointant directement
 * sur l'étape 1 (Analyse) du parcours unifié.
 */
export default function MasterclassFactoryAnalysePage() {
  return <Navigate to="/dashboard/tools/masterclass-factory?step=1" replace />;
}
