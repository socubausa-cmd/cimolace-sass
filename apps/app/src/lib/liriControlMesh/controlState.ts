/**
 * Moteur d'état — session de contrôle JoyKit / Control Mesh (un participant ou la salle).
 */

export const CONTROL_MESH_STATES = [
  'idle',
  'request_pending',
  'partial_control_granted',
  'full_control_granted',
  'co_control',
  'control_transferred',
  'control_revoked',
  'split_mode_active',
] as const;

export type ControlMeshState = (typeof CONTROL_MESH_STATES)[number];

export function isActiveControlState(s: ControlMeshState): boolean {
  return s !== 'idle' && s !== 'control_revoked';
}
