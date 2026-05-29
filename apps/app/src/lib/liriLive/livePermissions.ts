import type { LiveRole } from './liveRole';

/** Flags produit Liri Live (une seule matrice pour host / cohost / guest / viewer). */
export type LivePermissions = {
  canUseMic: boolean;
  canUseCamera: boolean;
  canDrawSmartboard: boolean;
  canMovePanel: boolean;
  canUseJoyKit: boolean;
  canUseNeuronQ: boolean;
  canUseSignals: boolean;
  canInvitePeople: boolean;
  canControlScenes: boolean;
  canRecord: boolean;
  canStopLive: boolean;
  canManagePermissions: boolean;
};

export type LivePermissionAction = keyof LivePermissions;

/** Toutes les clés d'action (pour itérations / formulaires). */
export const LIVE_PERMISSION_ACTIONS: LivePermissionAction[] = [
  'canUseMic',
  'canUseCamera',
  'canDrawSmartboard',
  'canMovePanel',
  'canUseJoyKit',
  'canUseNeuronQ',
  'canUseSignals',
  'canInvitePeople',
  'canControlScenes',
  'canRecord',
  'canStopLive',
  'canManagePermissions',
];

export function allPermissionsTrue(): LivePermissions {
  return Object.fromEntries(LIVE_PERMISSION_ACTIONS.map((k) => [k, true])) as LivePermissions;
}

export function allPermissionsFalse(): LivePermissions {
  return Object.fromEntries(LIVE_PERMISSION_ACTIONS.map((k) => [k, false])) as LivePermissions;
}

/** Alignement nom produit ↔ valeur stockée côté participant (snake historique). */
export function normalizeParticipantRole(raw: string | null | undefined): LiveRole {
  const s = String(raw || '').toLowerCase().replace(/-/g, '_');
  if (s === 'host' || s === 'teacher') return 'host';
  if (s === 'co_host' || s === 'cohost') return 'cohost';
  if (s === 'viewer' || s === 'visitor') return 'viewer';
  return 'guest';
}
