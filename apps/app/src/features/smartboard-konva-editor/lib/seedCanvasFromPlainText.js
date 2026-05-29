import { mkTextObject, SB_KONVA_CANVAS_H, SB_KONVA_CANVAS_W } from '../model/sceneModel';

function chunkParagraphs(text) {
  return (text || '')
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/**
 * Crée une colonne de blocs texte à partir du document source (paragraphes).
 * @param {string} rawText
 * @param {{ maxBlocks?: number }} [opts]
 * @returns {{ objects: import('../model/sceneTypes').SbKonvaObjectBase[]; error: string | null }}
 */
export function seedCanvasFromPlainText(rawText, opts = {}) {
  const maxBlocks = opts.maxBlocks ?? 40;
  const paras = chunkParagraphs(rawText).slice(0, maxBlocks);
  if (paras.length === 0) {
    return { objects: [], error: 'Aucun paragraphe — collez du texte dans « Document source ».' };
  }

  const colW = 440;
  const gapY = 10;
  const margin = 64;
  let x = margin;
  let y = margin;

  /** @type {import('../model/sceneTypes').SbKonvaObjectBase[]} */
  const objects = [];

  for (let i = 0; i < paras.length; i += 1) {
    const p = paras[i];
    const fontSize = i === 0 ? 30 : 17;
    const fontWeight = i === 0 ? 700 : 400;
    const lines = Math.max(1, Math.ceil(p.length / 42));
    const h = Math.min(360, Math.max(48, Math.round(lines * fontSize * 1.35 + 12)));

    if (y + h > SB_KONVA_CANVAS_H - margin) {
      x += colW + 36;
      y = margin;
      if (x + colW > SB_KONVA_CANVAS_W - margin) {
        break;
      }
    }

    objects.push(
      mkTextObject({
        x,
        y,
        width: colW,
        height: h,
        style: {
          fontFamily: 'Inter, system-ui, sans-serif',
          fontSize,
          fontWeight,
          fill: '#F7F2E8',
          align: 'left',
          lineHeight: 1.3,
        },
        content: { text: p.slice(0, 12000) },
      }),
    );
    y += h + gapY;
  }

  if (objects.length === 0) {
    return { objects: [], error: 'Pas assez de place sur le canvas pour placer le texte.' };
  }
  return { objects, error: null };
}
