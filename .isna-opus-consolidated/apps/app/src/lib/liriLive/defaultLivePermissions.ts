import type { LiveRole } from './liveRole';
import type { LivePermissions } from './livePermissions';
import { allPermissionsFalse, allPermissionsTrue } from './livePermissions';

/**
 * Matrice par défaut avant fusion `sessionOverrides`.
 * - guest : mic/cam à false jusqu’à lecture guest_permissions / floor (branchage ultérieur).
 * - viewer : tout false (chat / réactions hors LivePermissions pour l’instant).
 */
export function defaultLivePermissionsForRole(role: LiveRole): LivePermissions {
  switch (role) {
    case 'host':
      return allPermissionsTrue();

    case 'cohost': {
      const p = allPermissionsTrue();
      p.canStopLive = false;
      p.canManagePermissions = false;
      return p;
    }

    case 'guest':
      return {
        ...allPermissionsFalse(),
        canMovePanel: true,
        canUseNeuronQ: true,
        canUseSignals: true,
      };

    case 'viewer':
    default:
      return allPermissionsFalse();
  }
}
