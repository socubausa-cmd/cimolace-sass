/**
 * Détecte si la scène a été modifiée depuis le dernier snapshot `stateInitial` (brouillon live).
 * Comparaison stable ordonnée par id d'objet.
 */

/** @param {import('../model/sceneTypes').SbKonvaObjectBase[] | null | undefined} objs */
function sortById(objs) {
  return [...(objs || [])].sort((a, b) => String(a.id).localeCompare(String(b.id)));
}

/**
 * @param {{ objects?: unknown[]; stateInitial?: unknown[] | null } | null | undefined} scene
 * @returns {boolean}
 */
export function sceneHasLiveDraft(scene) {
  if (!scene?.stateInitial || !Array.isArray(scene.stateInitial)) return false;
  const a = sortById(/** @type {import('../model/sceneTypes').SbKonvaObjectBase[]} */ (scene.objects));
  const b = sortById(/** @type {import('../model/sceneTypes').SbKonvaObjectBase[]} */ (scene.stateInitial));
  try {
    return JSON.stringify(a) !== JSON.stringify(b);
  } catch {
    return true;
  }
}
