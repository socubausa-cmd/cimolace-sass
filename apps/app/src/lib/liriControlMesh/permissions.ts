/**
 * LIRI Control Mesh — permissions fines (une par ligne, indépendantes).
 * JoyKit regroupe SmartBoard Composer, scènes, médias, overlays.
 */

export const PERMISSION_GROUPS = {
  smartboard: 'SmartBoard / JoyKit',
  media: 'Médias',
  live: 'Salle live',
  orchestration: 'Orchestration',
  advanced: 'Avancé',
} as const;

/** Identifiants stables pour persistance et UI. */
export const PERMISSION_IDS = [
  // SmartBoard
  'view_smartboard',
  'manipulate_active_scene',
  'load_personal_scene',
  'modify_existing_scene',
  'open_smartboard_composer',
  'use_progressive_mode',
  // Médias
  'share_images',
  'share_slides',
  'share_web',
  'share_embed',
  'share_video',
  'share_audio',
  'manage_music',
  // Live
  'toggle_remote_mics',
  'toggle_remote_cameras',
  'stage_raise_lower',
  'give_floor',
  'manage_waiting_room',
  'manage_hands',
  'send_announcements',
  // Orchestration
  'pass_control',
  'request_control_visible',
  'grant_control',
  'revoke_control',
  'set_control_duration',
  // Avancé
  'split_smartboard',
  'realtime_coedit',
  'copresentation',
  'dual_event_visible',
] as const;

export type PermissionId = (typeof PERMISSION_IDS)[number];

export type Permissions = Record<PermissionId, boolean>;

export function emptyPermissions(): Permissions {
  return Object.fromEntries(PERMISSION_IDS.map((id) => [id, false])) as Permissions;
}

export function mergePermissions(base: Permissions, patch: Partial<Permissions>): Permissions {
  const out = { ...base };
  for (const k of PERMISSION_IDS) {
    if (Object.prototype.hasOwnProperty.call(patch, k) && patch[k] !== undefined) {
      out[k] = Boolean(patch[k]);
    }
  }
  return out;
}

export function permissionGroup(id: PermissionId): keyof typeof PERMISSION_GROUPS {
  if (
    id === 'view_smartboard' ||
    id === 'manipulate_active_scene' ||
    id === 'load_personal_scene' ||
    id === 'modify_existing_scene' ||
    id === 'open_smartboard_composer' ||
    id === 'use_progressive_mode'
  ) {
    return 'smartboard';
  }
  if (
    id === 'share_images' ||
    id === 'share_slides' ||
    id === 'share_web' ||
    id === 'share_embed' ||
    id === 'share_video' ||
    id === 'share_audio' ||
    id === 'manage_music'
  ) {
    return 'media';
  }
  if (
    id === 'toggle_remote_mics' ||
    id === 'toggle_remote_cameras' ||
    id === 'stage_raise_lower' ||
    id === 'give_floor' ||
    id === 'manage_waiting_room' ||
    id === 'manage_hands' ||
    id === 'send_announcements'
  ) {
    return 'live';
  }
  if (
    id === 'pass_control' ||
    id === 'request_control_visible' ||
    id === 'grant_control' ||
    id === 'revoke_control' ||
    id === 'set_control_duration'
  ) {
    return 'orchestration';
  }
  return 'advanced';
}
