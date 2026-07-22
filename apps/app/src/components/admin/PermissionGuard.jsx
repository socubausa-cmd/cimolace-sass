import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/SupabaseAuthContext';

const PermissionGuard = ({ children, requiredRole, requiredPermission }) => {
  const { profile, loading, hasRole, hasPermission } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="w-12 h-12 border-4 border-[#d97757] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // If user is not logged in or doesn't have profile data yet
  if (!profile) {
    return <Navigate to="/login" replace />;
  }

  // Check Role
  if (requiredRole && !hasRole(requiredRole)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 text-center p-4">
        <h2 className="text-2xl font-bold text-red-600 mb-2">Accès Refusé</h2>
        <p className="text-gray-600 mb-4">Vous n'avez pas le rôle requis ({requiredRole}) pour accéder à cette page.</p>
        <button onClick={() => window.history.back()} className="px-4 py-2 bg-gray-800 text-white rounded">Retour</button>
      </div>
    );
  }

  // Check Permission (if we implemented granular permissions)
  if (requiredPermission && !hasPermission(requiredPermission)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 text-center p-4">
        <h2 className="text-2xl font-bold text-red-600 mb-2">Permission Insuffisante</h2>
        <p className="text-gray-600 mb-4">Vous n'avez pas la permission requise pour effectuer cette action.</p>
        <button onClick={() => window.history.back()} className="px-4 py-2 bg-gray-800 text-white rounded">Retour</button>
      </div>
    );
  }

  return children;
};

export default PermissionGuard;