/**
 * Architecture — quatre briques (implémentation progressive).
 *
 * 1. Permission Engine — droits fins (voir permissions.ts + profiles.ts)
 * 2. Control Transfer Engine — demandes, acceptation, retrait, passation
 * 3. JoyKit Access Manager — modules SmartBoard / médias / overlays disponibles par acteur
 * 4. Split SmartBoard Engine — dual canvas, co-présentation, débat côte à côte
 *
 * Persistance prévue : config live_sessions / canal temps réel dédié (à brancher).
 */

import type { Permissions } from './permissions';
import { mergePermissions, emptyPermissions } from './permissions';
import type { ControlMeshState } from './controlState';
import { permissionsForProfile, type ControlProfileId } from './profiles';

export type ControlTransferEvent =
  | { type: 'request'; fromUserId: string; kind: 'full' | 'scene' | 'joykit' | 'media' }
  | { type: 'grant'; toUserId: string; permissions: Partial<Permissions> }
  | { type: 'revoke'; userId: string }
  | { type: 'transfer'; fromUserId: string; toUserId: string };

/** Permission Engine — applique un profil ou une fusion manuelle. */
export function applyPermissionEngine(
  base: Permissions,
  profileId: ControlProfileId | null,
  manualPatch: Partial<Permissions> | null,
): Permissions {
  let next = base;
  if (profileId) {
    next = mergePermissions(next, permissionsForProfile(profileId));
  }
  if (manualPatch && Object.keys(manualPatch).length) {
    next = mergePermissions(next, manualPatch);
  }
  return next;
}

/** JoyKit Access Manager — filtre les capacités UI selon permissions. */
export function joyKitModulesAllowed(p: Permissions): {
  composer: boolean;
  scenes: boolean;
  mediaImages: boolean;
  mediaSlides: boolean;
  mediaWeb: boolean;
  mediaAudio: boolean;
  overlays: boolean;
  progressive: boolean;
} {
  return {
    composer: p.open_smartboard_composer,
    scenes: p.manipulate_active_scene || p.load_personal_scene,
    mediaImages: p.share_images,
    mediaSlides: p.share_slides,
    mediaWeb: p.share_web,
    mediaAudio: p.share_audio || p.manage_music,
    overlays: p.manipulate_active_scene,
    progressive: p.use_progressive_mode,
  };
}

/** Split SmartBoard — état UI pour dual canvas. */
export function splitEngineInitialState(): { active: boolean; leftUserId: string | null; rightUserId: string | null } {
  return { active: false, leftUserId: null, rightUserId: null };
}

export function mapStateToMeshUi(state: ControlMeshState): 'idle' | 'pending' | 'active' | 'split' {
  if (state === 'split_mode_active') return 'split';
  if (state === 'request_pending') return 'pending';
  if (
    state === 'partial_control_granted' ||
    state === 'full_control_granted' ||
    state === 'co_control' ||
    state === 'control_transferred'
  ) {
    return 'active';
  }
  return 'idle';
}
