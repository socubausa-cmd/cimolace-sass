import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useBilling } from '@/contexts/BillingContext';

const Loader = () => (
  <div className="flex h-screen w-full items-center justify-center bg-[#0F1419]">
    <Loader2 className="h-8 w-8 animate-spin text-[#D4AF37]" />
  </div>
);

export default function ProtectedSubscriptionRoute({ children }) {
  const { loading, status, inGrace } = useBilling();
  const location = useLocation();
  const pathname = String(location?.pathname || '');
  const isStudentLitePath =
    pathname === '/student-school-life' ||
    pathname === '/student-school-life/' ||
    pathname.startsWith('/student-school-life/dashboard');
  const hasSubscriptionAccess = status === 'active' || (status === 'past_due' && inGrace);

  return (
    <ProtectedRoute>
      {loading ? (
        <Loader />
      ) : hasSubscriptionAccess || isStudentLitePath ? (
        children
      ) : (
        <Navigate to="/subscribe" state={{ from: location }} replace />
      )}
    </ProtectedRoute>
  );
}

