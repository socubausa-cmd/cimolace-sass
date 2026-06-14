import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';
import { getEffectiveRole } from '@/lib/accountRoleMode';

const ProtectedOwnerRoute = ({ children, redirectTo = '/dashboard' }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0F1419]">
        <Loader2 className="w-8 h-8 text-[var(--school-accent)] animate-spin" />
      </div>
    );
  }

  // Not authenticated
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Authenticated but not allowed
  const role = getEffectiveRole(user);
  if (role !== 'owner' && role !== 'admin') {
    return <Navigate to={redirectTo} replace />;
  }

  return children;
};

export default ProtectedOwnerRoute;