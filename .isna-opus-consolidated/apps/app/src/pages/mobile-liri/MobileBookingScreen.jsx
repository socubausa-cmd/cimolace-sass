import { Navigate } from 'react-router-dom';

/** Prise de rendez-vous (flux existant). */
export default function MobileBookingScreen() {
  return <Navigate to="/appointment/request" replace />;
}
