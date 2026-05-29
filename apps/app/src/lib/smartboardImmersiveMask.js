/**
 * Masque « fondre les bords » pour SmartBoard sur l'écran intelligent (effet immersif).
 * PNG/WebP sans fond + ce masque = fusion dans le dégradé de la coque.
 */

/** Intensité par défaut (0–100) quand la slide n'a pas de valeur explicite et que le contexte l'autorise (ex. scène natif). */
export const DEFAULT_SMARTBOARD_EDGE_FEATHER = 26;

/**
 * @param {object | null} slide
 * @param {boolean} immersiveEdgeDefault — true = appliquer la valeur par défaut si non défini (ex. SmartBoard natif live)
 * @returns {number} 0 = désactivé, 1–100 = intensité du fondu sur les bords
 */
export function resolveSmartboardEdgeFeatherPercent(slide, immersiveEdgeDefault) {
  if (!slide || typeof slide !== 'object') return immersiveEdgeDefault ? DEFAULT_SMARTBOARD_EDGE_FEATHER : 0;
  const raw = slide.immersiveEdgeFeather ?? slide.immersive_edge_feather ?? slide.ia_data?.immersive_edge_feather;
  if (raw === 0 || raw === '0') return 0;
  if (raw != null && raw !== '') {
    const n = Number(raw);
    if (Number.isFinite(n)) return Math.min(100, Math.max(0, n));
  }
  return immersiveEdgeDefault ? DEFAULT_SMARTBOARD_EDGE_FEATHER : 0;
}

/**
 * Style CSS mask (radial) style Photoshop « adoucir les bords ».
 * @param {number} featherPercent 0 = aucun masque
 * @returns {Record<string, string>}
 */
export function smartboardEdgeFeatherMaskStyle(featherPercent) {
  const f = Number(featherPercent);
  if (!Number.isFinite(f) || f <= 0) return {};
  const clamped = Math.min(100, Math.max(0.5, f));
  // Plus feather est élevé, plus la zone opaque centrale est petite → bords plus fondus
  const inner = Math.round(97 - clamped * 0.62);
  const gradient = `radial-gradient(ellipse 94% 90% at 50% 50%, #000 ${inner}%, transparent 100%)`;
  return {
    WebkitMaskImage: gradient,
    maskImage: gradient,
    WebkitMaskSize: '100% 100%',
    maskSize: '100% 100%',
    WebkitMaskRepeat: 'no-repeat',
    maskRepeat: 'no-repeat',
    WebkitMaskPosition: 'center',
    maskPosition: 'center',
  };
}
