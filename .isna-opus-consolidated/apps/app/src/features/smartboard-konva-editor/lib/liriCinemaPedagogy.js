/**
 * Cinéma pédagogique — prises par slide (MVP, sans fichier vidéo pour l’instant).
 * Persisté dans le bundle workspace (`cinemaPedagogy`).
 */

/**
 * @typedef {{
 *   id: string;
 *   slideIndex: number;
 *   sceneId: string | null;
 *   durationSec: number;
 *   recordedAt: string;
 *   note?: string;
 *   previewUrl?: string;
 *   hasRecording?: boolean;
 *   recordingMime?: string;
 *   recordingSizeBytes?: number;
 *   recordingPublicUrl?: string;
 *   recordingStoragePath?: string;
 * }} LiriCinemaPedagogyTake
 */

/**
 * @typedef {{ takes: LiriCinemaPedagogyTake[] }} LiriCinemaPedagogyState
 */

export function defaultCinemaPedagogy() {
  return /** @type {LiriCinemaPedagogyState} */ ({ takes: [] });
}

/** @param {unknown} t */
function isValidTake(t) {
  if (!t || typeof t !== 'object') return false;
  const o = /** @type {Record<string, unknown>} */ (t);
  return typeof o.id === 'string' && Number.isFinite(Number(o.slideIndex));
}

/**
 * @param {unknown} raw
 * @returns {LiriCinemaPedagogyState}
 */
export function mergeCinemaPedagogyFromExport(raw) {
  if (!raw || typeof raw !== 'object') return defaultCinemaPedagogy();
  const takes = /** @type {unknown[]} */ (
    Array.isArray(/** @type {{ takes?: unknown }} */ (raw).takes) ? /** @type {{ takes: unknown[] }} */ (raw).takes : []
  )
    .filter(isValidTake)
    .map((x) => {
      const o = /** @type {Record<string, unknown>} */ (x);
      const take = {
        id: String(o.id),
        slideIndex: Math.max(0, Math.floor(Number(o.slideIndex))),
        sceneId: typeof o.sceneId === 'string' ? o.sceneId : o.sceneId == null ? null : String(o.sceneId),
        durationSec: Math.max(0, Number(o.durationSec) || 0),
        recordedAt: typeof o.recordedAt === 'string' ? o.recordedAt : new Date().toISOString(),
        note: typeof o.note === 'string' ? o.note : undefined,
        hasRecording: Boolean(o.hasRecording),
        recordingMime: typeof o.recordingMime === 'string' ? o.recordingMime : undefined,
        recordingSizeBytes: Number.isFinite(Number(o.recordingSizeBytes))
          ? Math.max(0, Math.floor(Number(o.recordingSizeBytes)))
          : undefined,
        recordingPublicUrl:
          typeof o.recordingPublicUrl === 'string' && o.recordingPublicUrl.startsWith('http')
            ? o.recordingPublicUrl
            : undefined,
        recordingStoragePath: typeof o.recordingStoragePath === 'string' ? o.recordingStoragePath : undefined,
      };
      return take;
    });
  return { takes };
}

/**
 * Retire les champs non sérialisables / lourds avant export JSON.
 * @param {LiriCinemaPedagogyState | null | undefined} state
 * @returns {LiriCinemaPedagogyState}
 */
export function sanitizeCinemaPedagogyForExport(state) {
  const base = mergeCinemaPedagogyFromExport(state);
  return {
    takes: base.takes.map((t) => {
      const { previewUrl: _p, ...rest } = /** @type {LiriCinemaPedagogyTake & { previewUrl?: string }} */ (t);
      return rest;
    }),
  };
}

export function genCinemaTakeId() {
  return `take_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}
