/**
 * Coordonnées surface UI → coordonnées cible (capture / fenêtre verrouillée).
 * Aligné sur le pack LIRI_FULL_SYSTEM (mapper.ts).
 */

/** @typedef {{ offsetX: number; offsetY: number; scaleX: number; scaleY: number }} MapperState */

/** @type {MapperState} */
export const DEFAULT_MAPPER = { offsetX: 0, offsetY: 0, scaleX: 1, scaleY: 1 };

/**
 * @param {number} uiX
 * @param {number} uiY
 * @param {MapperState} mapper
 */
export function mapPoint(uiX, uiY, mapper) {
  const m = mapper || DEFAULT_MAPPER;
  const sx = m.scaleX || 1;
  const sy = m.scaleY || 1;
  return {
    x: Math.round((uiX - m.offsetX) / sx),
    y: Math.round((uiY - m.offsetY) / sy),
  };
}

/**
 * Image en object-fit: contain dans la boîte — pour mapper les clics vers pixels source.
 * @param {number} naturalW
 * @param {number} naturalH
 * @param {number} boxW
 * @param {number} boxH
 * @returns {MapperState}
 */
export function mapperForObjectContain(naturalW, naturalH, boxW, boxH) {
  if (!naturalW || !naturalH || !boxW || !boxH) {
    return { ...DEFAULT_MAPPER };
  }
  const scale = Math.min(boxW / naturalW, boxH / naturalH);
  const drawnW = naturalW * scale;
  const drawnH = naturalH * scale;
  const offsetX = (boxW - drawnW) / 2;
  const offsetY = (boxH - drawnH) / 2;
  return { offsetX, offsetY, scaleX: scale, scaleY: scale };
}
