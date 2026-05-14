import type { JoyKitGrant } from './joyKit';
import type { LivePermissionAction, LivePermissions } from './livePermissions';

/** Grant temporaire (epoch ms). */
export type LiveTemporaryPermissionGrant = {
  action: LivePermissionAction;
  expiresAt: number;
};

/**
 * Sources optionnelles pour affiner les permissions (caps invité, Mesh, ligne participant…).
 * Phase 1 : structure seule ; le branchage Supabase / Mesh viendra plus tard.
 */
export type LiveSessionPermissionSources = {
  permissionsOverride?: Partial<LivePermissions>;
  /** Grants jusqu’à la fin de la session (signaux host `grant: session`). */
  sessionGrants?: LivePermissionAction[];
  temporaryGrants?: LiveTemporaryPermissionGrant[];
  /** Grant JoyKit actif (`joykit_granted` en base). */
  joyKitGrant?: JoyKitGrant | null;
};
