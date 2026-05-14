import React from 'react';
import { Navigate } from 'react-router-dom';

/**
 * Ancienne page Circle.so — redirige vers l'inscription.
 * La communauté est désormais intégrée dans l'app (vie scolaire, messagerie, etc.).
 */
const CommunautePage = () => {
  return <Navigate to="/signup" replace />;
};

export default CommunautePage;
