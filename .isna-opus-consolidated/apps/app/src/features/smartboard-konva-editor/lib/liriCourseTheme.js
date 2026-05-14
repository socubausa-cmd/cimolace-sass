/**
 * Thème global du cours (Module 4) — persistant dans le bundle workspace.
 * Les palettes / typo pourront piloter Polotno ou l’export plus tard.
 */

/** @typedef {'administrative'|'academic'|'creative'|'spiritual'|'technical'} LiriCourseThemePreset */

/** @type {LiriCourseThemePreset[]} */
export const COURSE_THEME_PRESETS = [
  'administrative',
  'academic',
  'creative',
  'spiritual',
  'technical',
];

/** @typedef {'photo'|'illustration'|'diagram'|'mixed'} LiriCourseImageStyle */

/**
 * @typedef {Object} CourseThemeState
 * @property {LiriCourseThemePreset} preset
 * @property {string} paletteId
 * @property {string} typographyPreset
 * @property {LiriCourseImageStyle} imageStyle
 */

/**
 * @returns {{
 *   preset: LiriCourseThemePreset;
 *   paletteId: string;
 *   typographyPreset: string;
 *   imageStyle: LiriCourseImageStyle;
 * }}
 */
export function defaultCourseTheme() {
  return {
    preset: 'academic',
    paletteId: 'liri_gold_navy',
    typographyPreset: 'modern_sans',
    imageStyle: 'mixed',
  };
}

/** @param {string | null | undefined} p */
export function normalizeCourseThemePreset(p) {
  const s = String(p || '').trim();
  if (COURSE_THEME_PRESETS.includes(/** @type {LiriCourseThemePreset} */ (s))) {
    return /** @type {LiriCourseThemePreset} */ (s);
  }
  return /** @type {LiriCourseThemePreset} */ ('academic');
}

/** @param {LiriCourseThemePreset} preset */
export function labelCourseThemePresetFr(preset) {
  switch (preset) {
    case 'administrative':
      return 'Administratif';
    case 'academic':
      return 'Académique';
    case 'creative':
      return 'Créatif';
    case 'spiritual':
      return 'Spirituel';
    case 'technical':
      return 'Technique';
    default:
      return preset;
  }
}

/** Palettes nommées (aperçu futur — couleurs de référence live SmartBoard). */
export const COURSE_THEME_PALETTES = [
  { id: 'liri_gold_navy', label: 'Or & marine (LIRI)' },
  { id: 'slate_minimal', label: 'Ardoise minimal' },
  { id: 'warm_contrast', label: 'Contraste chaud' },
  { id: 'soft_pastel', label: 'Pastel doux' },
];

/** Couleur de fond de page Polotno par palette (application manuelle ou au changement). */
const PALETTE_PAGE_BG = {
  liri_gold_navy: '#0b0f1a',
  slate_minimal: '#12141c',
  warm_contrast: '#1a1410',
  soft_pastel: '#14161f',
};

/** @param {string} paletteId */
export function getPalettePageBackground(paletteId) {
  const id = String(paletteId || '').trim();
  return PALETTE_PAGE_BG[/** @type {keyof typeof PALETTE_PAGE_BG} */ (id)] ?? PALETTE_PAGE_BG.liri_gold_navy;
}

export const COURSE_TYPO_PRESETS = [
  { id: 'modern_sans', label: 'Sans moderne' },
  { id: 'serif_classic', label: 'Serif classique' },
  { id: 'readable_large', label: 'Lisible grand' },
];

/**
 * Règles Polotno pour le préréglage typo — `mapFontSize` évite la dérive si on change de preset.
 * @param {string} typographyPresetId
 * @returns {{ fontFamily: string; fontWeight: string; mapFontSize: (fs: number) => number } | null}
 */
export function getPolotnoTypographyForPreset(typographyPresetId) {
  const id = String(typographyPresetId || '').trim();
  switch (id) {
    case 'serif_classic':
      return {
        fontFamily: 'Georgia, "Times New Roman", serif',
        fontWeight: '400',
        mapFontSize: (fs) => Math.max(12, fs),
      };
    case 'readable_large':
      return {
        fontFamily: 'Inter, system-ui, sans-serif',
        fontWeight: '400',
        mapFontSize: (fs) => Math.max(18, Math.round(fs * 1.04)),
      };
    case 'modern_sans':
    default:
      return {
        fontFamily: 'Inter, system-ui, sans-serif',
        fontWeight: '400',
        mapFontSize: (fs) => Math.max(12, fs),
      };
  }
}

const IMAGE_STYLES = /** @type {const} */ (['photo', 'illustration', 'diagram', 'mixed']);

/** @param {string | null | undefined} raw */
export function normalizeImageStyle(raw) {
  const s = String(raw || '').trim();
  if (IMAGE_STYLES.includes(/** @type {LiriCourseImageStyle} */ (s))) {
    return /** @type {LiriCourseImageStyle} */ (s);
  }
  return /** @type {LiriCourseImageStyle} */ ('mixed');
}

/** @param {LiriCourseImageStyle} s */
export function labelImageStyleFr(s) {
  switch (s) {
    case 'photo':
      return 'Photo';
    case 'illustration':
      return 'Illustration';
    case 'diagram':
      return 'Schémas';
    case 'mixed':
      return 'Mixte';
    default:
      return s;
  }
}

/**
 * @param {unknown} raw
 */
export function mergeCourseThemeFromExport(raw) {
  const base = defaultCourseTheme();
  if (!raw || typeof raw !== 'object') return base;
  const o = /** @type {Record<string, unknown>} */ (raw);
  return {
    preset: normalizeCourseThemePreset(typeof o.preset === 'string' ? o.preset : base.preset),
    paletteId:
      typeof o.paletteId === 'string' && o.paletteId
        ? o.paletteId
        : base.paletteId,
    typographyPreset:
      typeof o.typographyPreset === 'string' && o.typographyPreset
        ? o.typographyPreset
        : base.typographyPreset,
    imageStyle: normalizeImageStyle(
      typeof o.imageStyle === 'string' ? o.imageStyle : base.imageStyle,
    ),
  };
}
