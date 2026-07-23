import { Navigate } from 'react-router-dom';

/** Prise de rendez-vous DANS la coque LIRI (jamais l'ancienne page ISNA standalone /appointment/request
 *  qui rend l'ancienne navbar Academy). Cf. /liri/rendez-vous (LiriRendezVousPage embarquée). */
export default function MobileBookingScreen() {
  return <Navigate to="/liri/rendez-vous" replace />;
}
