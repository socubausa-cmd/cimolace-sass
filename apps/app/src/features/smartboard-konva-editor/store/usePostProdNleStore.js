import { create } from 'zustand';

const defaultGrade = () => ({
  /** -100 … 100 → luminosité */
  exposure: 0,
  /** 0 … 200 → % */
  contrast: 100,
  /** 0 … 200 → % */
  saturation: 100,
  /** -100 … 100 → chaud / froid (sepia partiel) */
  warmth: 0,
});

/**
 * Étalonnage « NLE léger » : filtres CSS sur la preview vidéo, persisté dans `formation_day_contents.data.nle`.
 */
export const usePostProdNleStore = create((set, get) => ({
  grade: defaultGrade(),
  setGrade: (patch) =>
    set((s) => ({
      grade: { ...s.grade, ...(typeof patch === 'object' && patch ? patch : {}) },
    })),
  resetGrade: () => set({ grade: defaultGrade() }),
}));

/**
 * @param {Partial<ReturnType<defaultGrade>>} grade
 * @returns {string} valeur CSS `filter`
 */
export function buildPreviewFilterFromNle(grade) {
  const g = { ...defaultGrade(), ...(grade || {}) };
  const e = Math.max(-100, Math.min(100, Number(g.exposure) || 0));
  const c = Math.max(0, Math.min(200, Number(g.contrast) ?? 100));
  const sat = Math.max(0, Math.min(200, Number(g.saturation) ?? 100));
  const w = Math.max(-100, Math.min(100, Number(g.warmth) || 0));
  const brightness = Math.max(0.35, Math.min(1.85, 1 + e / 100));
  const contrast = Math.max(0.25, Math.min(2.4, c / 100));
  const saturate = Math.max(0, Math.min(2.5, sat / 100));
  const sepia = Math.max(0, Math.min(0.45, w / 220 + (w > 0 ? 0.02 : 0)));
  const hue = w * 0.15;
  return `brightness(${brightness}) contrast(${contrast}) saturate(${saturate}) sepia(${sepia}) hue-rotate(${hue}deg)`;
}
