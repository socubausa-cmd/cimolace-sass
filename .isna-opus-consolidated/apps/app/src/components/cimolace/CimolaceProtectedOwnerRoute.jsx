/**
 * ═══════════════════════════════════════════════════════════════
 * CIMOLACE PROTECTED OWNER ROUTE
 * Protection de route owner pour CIMOLACE
 * ═══════════════════════════════════════════════════════════════
 */

import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Loader2 } from 'lucide-react';

const CimolaceProtectedOwnerRoute = ({ children, redirectTo = '/cimolace/admin' }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f]">
        <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
      </div>
    );
  }

  // Not authenticated
  if (!user) {
    return <Navigate to="/cimolace/login" state={{ from: location }} replace />;
  }

  // Check if user is owner/admin (role field from profiles table via SupabaseAuthContext)
  const isOwner = user?.role === 'owner' || user?.role === 'admin';
  
  if (!isOwner) {
    return <Navigate to={redirectTo} replace />;
  }

  return children;
};

export default CimolaceProtectedOwnerRoute;
