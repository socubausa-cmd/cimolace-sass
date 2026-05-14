/**
 * Statuts workspace LIRI (colonne `lifecycle_status` + exports JSON).
 * @typedef {'draft'|'in_progress'|'validated'|'ready_live'|'archived'} LiriWorkspaceLifecycleStatus
 */

/** @type {LiriWorkspaceLifecycleStatus[]} */
export const LIRI_WORKSPACE_LIFECYCLE_STATUSES = [
  'draft',
  'in_progress',
  'validated',
  'ready_live',
  'archived',
];

/** @param {string | null | undefined} raw */
export function normalizeLifecycleStatus(raw) {
  const s = String(raw || '').trim();
  if (LIRI_WORKSPACE_LIFECYCLE_STATUSES.includes(/** @type {LiriWorkspaceLifecycleStatus} */ (s))) {
    return /** @type {LiriWorkspaceLifecycleStatus} */ (s);
  }
  return /** @type {LiriWorkspaceLifecycleStatus} */ ('draft');
}

/** @param {LiriWorkspaceLifecycleStatus} status */
export function labelLifecycleStatusFr(status) {
  switch (status) {
    case 'draft':
      return 'Brouillon';
    case 'in_progress':
      return 'En cours';
    case 'validated':
      return 'Validé';
    case 'ready_live':
      return 'Prêt pour le live';
    case 'archived':
      return 'Archivé';
    default:
      return status;
  }
}
