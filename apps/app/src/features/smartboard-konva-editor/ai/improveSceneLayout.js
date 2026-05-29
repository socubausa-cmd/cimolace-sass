/**
 * Pipeline IA Konva : scène JSON → scène JSON améliorée.
 * Appelle l'Edge `liri-konva-scene-improve` (Claude → DeepSeek → Grok) ; sinon fallback local
 * déterministe (règles UX LIRI Text Design : grille, marges).
 */
import { callKonvaSceneImprove } from '../lib/callKonvaSceneImprove';

import { LIRI_TEXT_DESIGN_ENGINE } from '../lib/liriTextDesignPack';

/**
 * @param {number} v
 * @param {number} grid
 */
function snapScalar(v, grid) {
  if (!grid || grid <= 0) return Math.round(v);
  return Math.round(v / grid) * grid;
}

/**
 * @param {import('../model/sceneTypes').SbKonvaSceneExport} sceneExport
 * @param {{ intent?: 'balance' | 'typography' | 'premium' | 'pedagogy' }} [opts]
 * @returns {Promise<{ objects: unknown[], canvas?: unknown, suggestions?: string[], provider?: string } | import('../model/sceneTypes').SbKonvaSceneExport>}
 */
export async function improveSceneLayout(sceneExport, opts = {}) {
  const intent = opts.intent || 'balance';
  const objects = sceneExport?.objects;
  const canvas = sceneExport?.canvas || { width: 1037, height: 750, background: '#0b0f1a' };
  const sceneName = sceneExport?.sceneId || 'Scene active';

  // Tentative appel IA réel
  try {
    const result = await callKonvaSceneImprove({ objects, canvas, sceneName, intent });
    if (result) {
      return {
        ...sceneExport,
        objects: result.objects,
        canvas: result.canvas ? { ...canvas, ...result.canvas } : canvas,
        _suggestions: result.suggestions,
        _provider: result.provider,
      };
    }
  } catch (err) {
    console.warn('[improveSceneLayout] appel IA echoue, fallback local:', err?.message);
  }

  // Fallback local (ajustements minimes, aucun appel réseau)
  return improveSceneLayoutLocal(sceneExport);
}

/**
 * Fallback local deterministe : légers ajustements de mise en page.
 * @param {import('../model/sceneTypes').SbKonvaSceneExport} sceneExport
 */
function improveSceneLayoutLocal(sceneExport) {
  const next = structuredClone(sceneExport);
  if (!next.objects || !Array.isArray(next.objects)) return next;

  const snap = LIRI_TEXT_DESIGN_ENGINE?.ux_rules?.snap;
  const grid = snap?.enabled ? Number(snap.grid) || 8 : 0;
  const margin =
    LIRI_TEXT_DESIGN_ENGINE?.ux_rules?.spacing?.minimum_to_canvas_edge ?? 48;

  for (const o of next.objects) {
    if (o.type === 'text' && o.style && typeof o.style.fontSize === 'number') {
      o.style.fontSize = Math.min(72, Math.round(o.style.fontSize * 1.08));
    }
    if (typeof o.x === 'number') {
      o.x = snapScalar(Math.round(o.x + 12), grid);
    }
    if (typeof o.y === 'number') {
      o.y = snapScalar(Math.round(o.y + 6), grid);
    }
    if (typeof o.x === 'number' && typeof o.width === 'number') {
      const maxX = (sceneExport.canvas?.width ?? 1037) - margin;
      if (o.x + o.width > maxX) o.x = Math.max(margin, maxX - o.width);
    }
    if (typeof o.y === 'number' && typeof o.height === 'number') {
      const maxY = (sceneExport.canvas?.height ?? 750) - margin;
      if (o.y + o.height > maxY) o.y = Math.max(margin, maxY - o.height);
    }
    if (o.type === 'rect' && o.style) {
      o.style.strokeWidth = Math.max(2, Number(o.style.strokeWidth || 2) + 1);
    }
  }
  next._provider = 'local';
  return next;
}

/** Variantes exposées pour les boutons IA du designer. */
export const improveSceneLayoutVariants = {
  balance:    (scene) => improveSceneLayout(scene, { intent: 'balance' }),
  typography: (scene) => improveSceneLayout(scene, { intent: 'typography' }),
  premium:    (scene) => improveSceneLayout(scene, { intent: 'premium' }),
  pedagogy:   (scene) => improveSceneLayout(scene, { intent: 'pedagogy' }),
};
