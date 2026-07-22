import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';
import { getEffectiveRole } from '@/lib/accountRoleMode';

// Rôles GLOBAUX « faibles » d'un membre : un élève payé peut avoir profiles.role='visitor'
// (le rôle 'student' n'est écrit qu'à la fin du dossier KYC, souvent non complété), ou être
// multi-tenant (ex. patient@un-autre-tenant + student@isna) — son vrai rôle par tenant vit
// côté serveur (tenant_memberships), pas dans un unique claim JWT global.
const GLOBAL_MEMBER_ROLES = new Set(['visitor', 'member', 'patient']);

const ProtectedRoleRoute = ({ children, allowedRoles = [], redirectTo = '/dashboard', allowTenantRole = false }) => {
  const { user, loading, tenantRole } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#262624]">
        <Loader2 className="h-8 w-8 animate-spin text-[#d97757]" />
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
    // `tenantRole` vient du contexte auth (décodé du JWT de session) → fiable dès loading=false,
    // sans attendre que `user` soit complété (corrige la race de rebond au cold-reload).
    const ok =
      normalizedAllowed.includes(role) ||
      (allowTenantRole && tenantRole && normalizedAllowed.includes(tenantRole)) ||
      // Route MEMBRE (accepte 'student') + rôle global faible / non résolu : on ne rebondit PAS
      // vers l'ancien /dashboard. On laisse passer et c'est la VRAIE porte en aval (LiriAccessGate
      // = forfait actif du membre pour CE tenant, résolu par l'API) qui décide de l'accès ou du mur
      // d'upgrade. Ne touche JAMAIS les routes créateur (allowedRoles=['owner','admin'], sans 'student').
      (allowTenantRole && normalizedAllowed.includes('student') && (GLOBAL_MEMBER_ROLES.has(role) || !role));
    if (!ok) {
      return <Navigate to={redirectTo} replace />;
    }
  }

  return children;
};

export default ProtectedRoleRoute;
