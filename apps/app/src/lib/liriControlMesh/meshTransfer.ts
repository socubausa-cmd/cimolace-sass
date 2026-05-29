import type { ControlProfileId } from './profiles';
import type { Permissions } from './permissions';
import { permissionsForProfile } from './profiles';

/** Durée par défaut d'un grant JoyKit (ms). */
export const DEFAULT_MESH_GRANT_MS = 15 * 60 * 1000;

/** Choix rapides pour l'hôte à l'acceptation d'une demande. */
export const MESH_GRANT_DURATION_PRESETS = [
  { ms: 5 * 60 * 1000, labelFr: '5 min' },
  { ms: 15 * 60 * 1000, labelFr: '15 min' },
  { ms: 30 * 60 * 1000, labelFr: '30 min' },
  { ms: 60 * 60 * 1000, labelFr: '1 h' },
] as const;

/** Type de demande → profil JoyKit par défaut à l'acceptation. */
export const MESH_REQUEST_KIND_TO_PROFILE: Record<string, ControlProfileId> = {
  control: 'presenter',
  scene: 'guest_speaker',
  joykit: 'presenter',
  media: 'music_lead',
};

export function profileIdForMeshRequestKind(kind: string): ControlProfileId {
  return MESH_REQUEST_KIND_TO_PROFILE[kind] ?? 'guest_speaker';
}

export function buildGrantFromRequest(kind: string): { profileId: ControlProfileId; permissions: Permissions } {
  const profileId = profileIdForMeshRequestKind(kind);
  return { profileId, permissions: permissionsForProfile(profileId) };
}
