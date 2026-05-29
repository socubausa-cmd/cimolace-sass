/**
 * Pont live (micro / hints) → SmartBoard Designer Konva.
 * File d'attente `localStorage` remplie depuis SlideAnnotationOverlay quand des hints sont produits.
 */

import { mkTextObject, SB_KONVA_CANVAS_W } from '@/features/smartboard-konva-editor/model/sceneModel';

export const LIRI_PEDAGOGY_HINTS_QUEUE_KEY = 'liri_pedagogy_hints_queue_v1';

/** @param {{ hints: { id: string; count?: number }[] }} data */
export function buildKonvaObjectsFromPedagogyHints(data) {
  const hints = data?.hints;
  if (!Array.isArray(hints) || hints.length === 0) return [];

  const objects = [];
  let y = 56;
  const cw = SB_KONVA_CANVAS_W;

  for (const h of hints) {
    if (h.id === 'title') {
      objects.push(
        mkTextObject({
          x: 80,
          y,
          width: cw - 160,
          height: 72,
          layer: 2,
          style: {
            fontFamily: 'Inter, system-ui, sans-serif',
            fontSize: 38,
            fontWeight: 700,
            fill: '#F7F2E8',
            align: 'center',
          },
          content: { text: 'Titre' },
        }),
      );
      y += 96;
    } else if (h.id === 'list') {
      const n = typeof h.count === 'number' ? Math.min(12, Math.max(2, h.count)) : 3;
      for (let i = 0; i < n; i++) {
        objects.push(
          mkTextObject({
            x: 96,
            y,
            width: cw - 192,
            height: 44,
            layer: 1,
            style: {
              fontFamily: 'Inter, system-ui, sans-serif',
              fontSize: 24,
              fontWeight: 600,
              fill: '#e8e4dc',
              align: 'left',
            },
            content: { text: `${i + 1}. …` },
          }),
        );
        y += 50;
      }
    } else if (h.id === 'emphasis') {
      objects.push(
        mkTextObject({
          x: 80,
          y,
          width: cw - 160,
          height: 64,
          layer: 2,
          style: {
            fontFamily: 'Inter, system-ui, sans-serif',
            fontSize: 28,
            fontWeight: 700,
            fill: '#D4AF37',
            align: 'left',
          },
          content: { text: 'À retenir' },
        }),
      );
      y += 78;
    } else if (h.id === 'numbered') {
      objects.push(
        mkTextObject({
          x: 80,
          y,
          width: cw - 160,
          height: 48,
          layer: 1,
          style: {
            fontFamily: 'Inter, system-ui, sans-serif',
            fontSize: 22,
            fill: '#c8c4bc',
          },
          content: { text: 'Liste (oral) → structurer ici' },
        }),
      );
      y += 58;
    }
  }

  return objects;
}

export function readPedagogyHintsQueue() {
  try {
    const raw = localStorage.getItem(LIRI_PEDAGOGY_HINTS_QUEUE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data?.hints?.length) return null;
    return data;
  } catch {
    return null;
  }
}

export function clearPedagogyHintsQueue() {
  try {
    localStorage.removeItem(LIRI_PEDAGOGY_HINTS_QUEUE_KEY);
  } catch {
    /* ignore */
  }
}
