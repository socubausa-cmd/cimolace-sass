import { useCallback, useMemo } from 'react';
import { resolveLivePermissions } from '@/lib/liriLive/resolveLivePermissions';

const DEFAULT_TOOLTIP = 'Demandez l’autorisation à l’hôte';

/**
 * @typedef {import('@/lib/liriLive/liveRole').LiveRole} LiveRole
 * @typedef {import('@/lib/liriLive/livePermissions').LivePermissionAction} LivePermissionAction
 * @typedef {import('@/lib/liriLive/sessionOverrides').LiveSessionPermissionSources} LiveSessionPermissionSources
 */

/**
 * @param {object} opts
 * @param {LiveRole} opts.role
 * @param {LiveSessionPermissionSources} [opts.sessionOverrides]
 * @param {(action: LivePermissionAction) => void} [opts.onRequestPermission]
 * @param {(userId: string, action: LivePermissionAction, durationMs?: number|null) => Promise<void>} [opts.onGrantPermission]
 * @param {(userId: string, action: LivePermissionAction) => Promise<void>} [opts.onRevokePermission]
 */
export function useLivePermissions({
  role = 'guest',
  sessionOverrides,
  onRequestPermission,
  onGrantPermission,
  onRevokePermission,
} = {}) {
  const permissions = useMemo(
    () => resolveLivePermissions(role, sessionOverrides),
    [role, sessionOverrides],
  );

  const isAllowed = useCallback(
    (action) => Boolean(permissions[action]),
    [permissions],
  );

  const requestPermission = useCallback(
    async (action) => {
      if (typeof onRequestPermission === 'function') {
        await Promise.resolve(onRequestPermission(action));
      }
    },
    [onRequestPermission],
  );

  const grantPermission = useCallback(
    async (userId, action, durationMs = null) => {
      if (typeof onGrantPermission === 'function') {
        await onGrantPermission(userId, action, durationMs);
        return;
      }
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.warn('[useLivePermissions] grantPermission: brancher onGrantPermission (RPC / serveur).');
      }
    },
    [onGrantPermission],
  );

  const revokePermission = useCallback(
    async (userId, action) => {
      if (typeof onRevokePermission === 'function') {
        await onRevokePermission(userId, action);
        return;
      }
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.warn('[useLivePermissions] revokePermission: brancher onRevokePermission (RPC / serveur).');
      }
    },
    [onRevokePermission],
  );

  return {
    permissions,
    isAllowed,
    requestPermission,
    grantPermission,
    revokePermission,
    disabledTooltip: DEFAULT_TOOLTIP,
  };
}
