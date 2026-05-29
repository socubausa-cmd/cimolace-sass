/**
 * Détourage type chroma sur ImageData — vert par défaut (logique proche CaptureStudio).
 * @param {ImageData} frame
 * @param {{ r: number, g: number, b: number }} keyRgb
 * @param {number} sensitivity ~40–180 (plus haut = tolérance plus large)
 * @param {boolean} [preferGreenFormula] — si la clé est un vert type fond vert
 */
export function applyChromaKeyToImageData(frame, keyRgb, sensitivity, preferGreenFormula) {
  const d = frame.data;
  const { r: kr, g: kg, b: kb } = keyRgb;
  const sens = Math.max(20, Math.min(220, sensitivity));
  const greenKey = preferGreenFormula || (kg > kr + 30 && kg > kb + 30);

  for (let i = 0; i < d.length; i += 4) {
    const r = d[i];
    const g = d[i + 1];
    const b = d[i + 2];
    if (greenKey) {
      if (g > 50 && g > r * 1.1 && g > b * 1.1 && g - r + (g - b) > sens * 0.35) {
        d[i + 3] = 0;
      }
    } else {
      const dist = Math.abs(r - kr) + Math.abs(g - kg) + Math.abs(b - kb);
      if (dist < sens * 1.15) d[i + 3] = 0;
    }
  }
}

export function hexToRgb(hex) {
  const h = String(hex || '').replace('#', '');
  if (h.length !== 6) return { r: 0, g: 177, b: 64 };
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}
