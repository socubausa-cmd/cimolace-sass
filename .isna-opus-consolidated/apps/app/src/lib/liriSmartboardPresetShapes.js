/**
 * Formes prêtes à insérer sur le calque d’annotation (coordonnées normalisées).
 */

/**
 * @param {HTMLCanvasElement} canvas
 * @param {'circle'|'square'|'hline'|'frame'} preset
 * @param {string} color
 * @param {number} sizePx — épaisseur trait (comme le crayon)
 */
export function buildPresetNormStroke(canvas, preset, color, sizePx) {
  const r = canvas?.getBoundingClientRect?.();
  const W = Math.max(1, r?.width || 1);
  const H = Math.max(1, r?.height || 1);
  const m = Math.min(W, H);
  const sn = Math.max(0.002, sizePx / m);

  switch (preset) {
    case 'circle':
      return {
        type: 'ellipse',
        norm: true,
        color,
        sizeNorm: sn,
        xn: 0.34,
        yn: 0.3,
        wn: 0.32,
        hn: 0.26,
      };
    case 'square':
      return {
        type: 'rect',
        norm: true,
        color,
        sizeNorm: sn,
        xn: 0.34,
        yn: 0.34,
        wn: 0.26,
        hn: 0.22,
      };
    case 'frame':
      return {
        type: 'rect',
        norm: true,
        color,
        sizeNorm: sn,
        xn: 0.12,
        yn: 0.18,
        wn: 0.76,
        hn: 0.52,
      };
    case 'hline':
      return {
        type: 'line',
        norm: true,
        color,
        sizeNorm: sn,
        x1n: 0.14,
        y1n: 0.48,
        x2n: 0.86,
        y2n: 0.48,
      };
    default:
      return null;
  }
}
