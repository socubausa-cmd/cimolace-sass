/**
 * Modes de composition Arena LIRI (zone centrale).
 * @see docs/LIRI_LIVE_ARENA_LAYOUT_CAHIER_DES_CHARGES.md
 */

export const ARENA_LAYOUT = {
  SMARTBOARD: 'smartboard',
  HOST_CAMERA: 'host_camera',
  GUEST_FOCUS: 'guest_focus',
  PANEL: 'panel',
  MEMBERS_WALL: 'members_wall',
};

/** Nombre de cases vidéo en mode Panel (grille 2×2). */
export const ARENA_PANEL_MAX_SLOTS = 4;

/** Plafond d’affichage en mode Mur (le reste est indiqué par +N). */
export const ARENA_MEMBERS_WALL_MAX_VISIBLE = 20;

/** @typedef {'smartboard'|'host_camera'|'guest_focus'|'panel'|'members_wall'} ArenaLayoutMode */

/**
 * @param {unknown} raw
 * @returns {ArenaLayoutMode}
 */
export function normalizeArenaLayoutMode(raw) {
  if (raw === ARENA_LAYOUT.HOST_CAMERA) return ARENA_LAYOUT.HOST_CAMERA;
  if (raw === ARENA_LAYOUT.GUEST_FOCUS) return ARENA_LAYOUT.GUEST_FOCUS;
  if (raw === ARENA_LAYOUT.PANEL) return ARENA_LAYOUT.PANEL;
  if (raw === ARENA_LAYOUT.MEMBERS_WALL) return ARENA_LAYOUT.MEMBERS_WALL;
  return ARENA_LAYOUT.SMARTBOARD;
}

/**
 * @param {unknown} raw
 * @returns {string[]}
 */
export function normalizeArenaPanelUserIds(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map((x) => (x != null ? String(x) : '')).filter(Boolean).slice(0, ARENA_PANEL_MAX_SLOTS);
}
