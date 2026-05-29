/** Libellés de scène pour la ligne sous le SmartBoard (maquette mobile). */
export const LIRI_MAQUETTE_SCENE_LABELS = {
  smartboard: 'SmartBoard',
  diapo: 'Diaporama',
  camera2: 'Caméra secondaire',
  web: 'Web',
  images: 'Images',
  screen: 'Partage d\'écran',
  shop: 'Boutique',
};

/**
 * Compteur « Plan cours » / « Plan diaporama » (rails natif vs import).
 * @param {{ activeScene: string, coursePlanSplit: { native?: { slides?: unknown[], index?: number }, import?: { slides?: unknown[], index?: number } } | null | undefined, slideIndex: number, totalSlides: number }} p
 */
export function buildMaquettePlanRibbon({ activeScene, coursePlanSplit, slideIndex, totalSlides }) {
  const fallbackHuman = `${Math.min(slideIndex + 1, Math.max(1, totalSlides))} / ${Math.max(1, totalSlides)}`;
  const isDiapo = activeScene === 'diapo';

  const branch = isDiapo ? coursePlanSplit?.import : coursePlanSplit?.native;
  const slides = Array.isArray(branch?.slides) ? branch.slides : [];
  const idx = Number(branch?.index);
  const safeIdx = Number.isFinite(idx) ? idx : 0;
  const n = slides.length;

  if (n <= 0) {
    return {
      label: isDiapo ? 'Plan diaporama' : 'Plan cours',
      human: fallbackHuman,
      empty: true,
      title: isDiapo
        ? 'Aucune diapo dans le plan importé — compteur global affiché'
        : 'Aucune slide SmartBoard dans le plan — compteur global affiché',
    };
  }
  const cur = Math.min(Math.max(1, safeIdx + 1), n);
  return {
    label: isDiapo ? 'Plan diaporama' : 'Plan cours',
    human: `${cur} / ${n}`,
    empty: false,
    title: isDiapo
      ? 'Slide courante / total du diaporama importé'
      : 'Slide courante / total du plan SmartBoard',
  };
}

/**
 * Titre affiché après le compteur (ligne scène maquette).
 */
export function buildMaquetteSceneLineCaption({ activeScene, compositorSlide, scriptCurrentSection }) {
  const fromSlide = String(
    compositorSlide?.title
    || compositorSlide?.slide_title
    || '',
  ).trim();
  const fromScript = String(
    scriptCurrentSection?.title
    || scriptCurrentSection?.slide_title
    || '',
  ).trim();
  const technical = LIRI_MAQUETTE_SCENE_LABELS[activeScene] || activeScene || 'Scène';

  if (fromSlide) return fromSlide;
  if (fromScript) return fromScript;
  return technical;
}
