import type { Permissions } from '@/lib/liriControlMesh/permissions';
import { emptyPermissions, mergePermissions } from '@/lib/liriControlMesh/permissions';
import { permissionsForProfile } from '@/lib/liriControlMesh/profiles';
import type { LivePermissionAction, LivePermissions } from './livePermissions';

/** Niveau JoyKit accordé par l’hôte (signaux DB + matrice Liri Live). */
export type JoyKitLevel = 'light' | 'interactive' | 'control' | 'full';

/** Grant JoyKit actif côté session (projection invité). */
export type JoyKitGrant = {
  level: JoyKitLevel;
  /** Epoch ms ; `null` = portée session. */
  expiresAt: number | null;
  scope: 'temporary' | 'session';
};

export const JOYKIT_LEVEL_RANK: Record<JoyKitLevel, number> = {
  light: 1,
  interactive: 2,
  control: 3,
  full: 4,
};

/**
 * Carte niveau → flags `LivePermissions` (fusionnées après overrides / grants signaux classiques).
 */
export const JOYKIT_PERMISSIONS: Record<JoyKitLevel, Partial<LivePermissions>> = {
  light: { canUseJoyKit: true },
  interactive: {
    canUseJoyKit: true,
    canDrawSmartboard: true,
    canUseSignals: true,
  },
  control: {
    canUseJoyKit: true,
    canDrawSmartboard: true,
    canControlScenes: true,
    canUseSignals: true,
  },
  full: {
    canUseJoyKit: true,
    canDrawSmartboard: true,
    canControlScenes: true,
    canMovePanel: true,
    canUseSignals: true,
  },
};

export function joyKitLevelEnablesSmartboardDrive(level: JoyKitLevel): boolean {
  return JOYKIT_LEVEL_RANK[level] >= JOYKIT_LEVEL_RANK.interactive;
}

/** Permissions Control Mesh synthétiques pour pilotage SmartBoard (alignées au niveau JoyKit). */
export function meshPermissionsForJoyKitLevel(level: JoyKitLevel): Permissions {
  const base = emptyPermissions();
  if (level === 'light') {
    return mergePermissions(base, { view_smartboard: true, request_control_visible: true });
  }
  if (level === 'interactive') {
    return mergePermissions(base, {
      view_smartboard: true,
      open_smartboard_composer: true,
      realtime_coedit: true,
    });
  }
  if (level === 'control') {
    return mergePermissions(base, permissionsForProfile('guest_speaker'));
  }
  return mergePermissions(base, permissionsForProfile('presenter'));
}

/**
 * Fusionne le grant Mesh (broadcast) et le grant JoyKit signaux DB pour l’invité.
 */
export function mergeGuestMeshPermissions(
  meshGrant: { permissions?: Permissions } | null | undefined,
  joyKit: { level: JoyKitLevel; expiresAt: number | null } | null | undefined,
): Permissions | null {
  const fromMesh = meshGrant?.permissions;
  let fromJoy: Permissions | null = null;
  if (joyKit?.level && (joyKit.expiresAt == null || joyKit.expiresAt > Date.now())) {
    fromJoy = meshPermissionsForJoyKitLevel(joyKit.level);
  }
  if (fromMesh && fromJoy) {
    return mergePermissions(mergePermissions(emptyPermissions(), fromMesh), fromJoy);
  }
  if (fromMesh) return fromMesh;
  if (fromJoy) return mergePermissions(emptyPermissions(), fromJoy);
  return null;
}

export function applyJoyKitGrantToPermissions(
  p: LivePermissions,
  grant: JoyKitGrant | null | undefined,
  nowMs: number = Date.now(),
): LivePermissions {
  if (!grant) return p;
  if (grant.scope === 'temporary' && grant.expiresAt != null && grant.expiresAt <= nowMs) return p;
  const bump = JOYKIT_PERMISSIONS[grant.level];
  if (!bump) return p;
  const out = { ...p };
  for (const [k, v] of Object.entries(bump)) {
    if (v) out[k as LivePermissionAction] = true;
  }
  return out;
}
