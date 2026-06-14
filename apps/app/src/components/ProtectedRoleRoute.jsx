import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';
import { getEffectiveRole } from '@/lib/accountRoleMode';

const ProtectedRoleRoute = ({ children, allowedRoles = [], redirectTo = '/dashboard', allowTenantRole = false }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#0F1419]">
        <Loader2 className="h-8 w-8 animate-spin text-[#D4AF37]" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (Array.isArray(allowedRoles) && allowedRoles.length > 0) {
    const role = getEffectiveRole(user);
    const normalizedAllowed = allowedRoles.map((r) => String(r || '').toLowerCase());
    // Multi-tenant : un owner/practitioner d'un tenant a un profiles.role GLOBAL faible
    // (souvent 'visitor') ; son vrai rôle est dans le JWT (app_metadata.tenant_role).
    // Les routes tenant-scoped (ex: /studio pour la téléconsult) passent allowTenantRole
    // pour l'accepter aussi. Périmètre limité : l'autorisation fine reste la RLS sur la
    // session (un owner d'un autre tenant passe le garde mais ne peut charger la session).
    const tenantRole = String(user?.tenant_role || '').toLowerCase();
    const ok =
      normalizedAllowed.includes(role) ||
      (allowTenantRole && tenantRole && normalizedAllowed.includes(tenantRole));
    if (!ok) {
      return <Navigate to={redirectTo} replace />;
    }
  }

  return children;
};

export default ProtectedRoleRoute;
