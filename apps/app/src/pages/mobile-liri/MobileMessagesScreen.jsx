import { Navigate } from 'react-router-dom';

/** Alias mobile vers la messagerie immersive. */
export default function MobileMessagesScreen() {
  return <Navigate to="/messages" replace />;
}
