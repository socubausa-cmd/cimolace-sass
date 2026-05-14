import type { LiveRole } from './liveRole';
import type { LivePermissions, LivePermissionAction } from './livePermissions';
import { LIVE_PERMISSION_ACTIONS } from './livePermissions';
import type { LiveSessionPermissionSources } from './sessionOverrides';
import { defaultLivePermissionsForRole } from './defaultLivePermissions';
import { applyJoyKitGrantToPermissions } from './joyKit';

function mergePartial(base: LivePermissions, patch: Partial<LivePermissions> | undefined): LivePermissions {
  if (!patch) return base;
  const out = { ...base };
  for (const key of LIVE_PERMISSION_ACTIONS) {
    if (Object.prototype.hasOwnProperty.call(patch, key) && patch[key] !== undefined) {
      out[key] = Boolean(patch[key]);
    }
  }
  return out;
}

/**
 * Résout les permissions effectives : défauts par rôle + overrides + grants temporaires non expirés.
 */
export function resolveLivePermissions(
  role: LiveRole,
  sources: LiveSessionPermissionSources | undefined,
): LivePermissions {
  let p = defaultLivePermissionsForRole(role);
  p = mergePartial(p, sources?.permissionsOverride);

  const now = Date.now();
  const sessionGrantActions = sources?.sessionGrants;
  if (sessionGrantActions?.length) {
    const bump: Partial<LivePermissions> = {};
    for (const a of sessionGrantActions) {
      if (a) bump[a as LivePermissionAction] = true;
    }
    p = mergePartial(p, bump);
  }

  const grants = sources?.temporaryGrants;
  if (grants?.length) {
    const bump: Partial<LivePermissions> = {};
    for (const g of grants) {
      if (g && typeof g.expiresAt === 'number' && g.expiresAt > now && g.action) {
        bump[g.action as LivePermissionAction] = true;
      }
    }
    p = mergePartial(p, bump);
  }

  p = applyJoyKitGrantToPermissions(p, sources?.joyKitGrant ?? null, now);

  return p;
}
