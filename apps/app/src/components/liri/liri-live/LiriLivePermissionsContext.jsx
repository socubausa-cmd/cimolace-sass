import React, { createContext, useContext } from 'react';
import { useLivePermissions } from '@/hooks/useLivePermissions';

const LiriLivePermissionsContext = createContext(null);

/**
 * Fournit useLivePermissions à l'arbre (PermissionGate, boutons, etc.).
 * Phase 1 : pas encore branché sur LiveHostPage.
 */
export function LiriLivePermissionsProvider({
  role,
  sessionOverrides,
  onRequestPermission,
  onGrantPermission,
  onRevokePermission,
  children,
}) {
  const api = useLivePermissions({
    role,
    sessionOverrides,
    onRequestPermission,
    onGrantPermission,
    onRevokePermission,
  });

  return (
    <LiriLivePermissionsContext.Provider value={api}>
      {children}
    </LiriLivePermissionsContext.Provider>
  );
}

export function useLiriLivePermissionsContext() {
  const ctx = useContext(LiriLivePermissionsContext);
  if (!ctx) {
    throw new Error('useLiriLivePermissionsContext doit être utilisé sous LiriLivePermissionsProvider');
  }
  return ctx;
}

/** Variante tolérante : retourne null hors provider (ex. tests isolés). */
export function useLiriLivePermissionsContextOptional() {
  return useContext(LiriLivePermissionsContext);
}
