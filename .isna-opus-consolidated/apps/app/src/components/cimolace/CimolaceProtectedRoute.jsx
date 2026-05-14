/**
 * ═══════════════════════════════════════════════════════════════
 * CIMOLACE PROTECTED ROUTE
 * Protection de route pour CIMOLACE
 * ═══════════════════════════════════════════════════════════════
 */

import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Loader2 } from 'lucide-react';

const CimolaceProtectedRoute = ({ children, redirectTo = '/cimolace/login' }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f]">
        <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to={redirectTo} state={{ from: location }} replace />;
  }

  return children;
};

export default CimolaceProtectedRoute;
