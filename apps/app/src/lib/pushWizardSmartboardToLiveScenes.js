import { listScenes, upsertScene, deleteScenesForLiveSession } from '@/services/liveProduction';

/**
 * Copie `smartboard_element_scenes` (brouillon constructeur de live) vers `live_scenes`.
 * Le renderer Arena lit d'abord `live_scenes` ; le payload inclut `ia_data` / `elements` pour `normalizeLiveSceneToSlide`.
 *
 * @param {string} liveSessionId
 * @param {Array<object>} elementScenes — `draft.smartboard_element_scenes`
 * @param {{ skipIfScenesExist?: boolean, replaceExisting?: boolean }} [options]
 * @returns {Promise<{ ok: boolean, inserted?: number, replaced?: boolean, reason?: string, error?: Error }>}
 */
export async function pushWizardSmartboardToLiveScenes(liveSessionId, elementScenes, options = {}) {
  const { skipIfScenesExist = true, replaceExisting = false } = options;
  if (!liveSessionId || !Array.isArray(elementScenes) || elementScenes.length === 0) {
    return { ok: false, reason: 'no_data' };
  }

  if (replaceExisting) {
    const { error: delErr } = await deleteScenesForLiveSession(liveSessionId);
    if (delErr) return { ok: false, error: delErr };
  } else if (skipIfScenesExist) {
    const { data: existing, error: listErr } = await listScenes(liveSessionId);
    if (listErr) return { ok: false, error: listErr };
    if ((existing || []).length > 0) return { ok: false, reason: 'scenes_exist' };
  }

  const sorted = [...elementScenes].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));

  for (let i = 0; i < sorted.length; i++) {
    const scene = sorted[i];
    const content_payload_json = {};
    if (scene.ia_data != null) content_payload_json.ia_data = scene.ia_data;
    if (Array.isArray(scene.elements) && scene.elements.length) content_payload_json.elements = scene.elements;
    content_payload_json.source = 'live_studio_wizard';
    if (scene.scene_type) content_payload_json.scene_type_wizard = scene.scene_type;

    const hasIa = scene.ia_data && typeof scene.ia_data === 'object';
    const scene_type = hasIa || scene.scene_type === 'progressive_build' ? 'smartboard' : 'slides';

    const { error } = await upsertScene(liveSessionId, {
      name: scene.name || `Slide ${i + 1}`,
      scene_type,
      order_index: i,
      content_payload_json,
    });
    if (error) return { ok: false, error, inserted: i };
  }

  return { ok: true, inserted: sorted.length, replaced: replaceExisting };
}
