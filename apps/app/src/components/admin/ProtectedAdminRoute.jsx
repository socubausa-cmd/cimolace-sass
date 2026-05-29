import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/SupabaseAuthContext';

const ProtectedAdminRoute = ({ children }) => {
  const { user } = useAuth();
  if (!user || (user.role !== 'owner' && user.role !== 'admin')) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

export default ProtectedAdminRoute;
