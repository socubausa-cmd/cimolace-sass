/**
 * Animations harmonisées pour tiroirs / feuilles live (ressort doux, léger étirement).
 * Utiliser les mêmes transitions partout pour un ressenti « premium » cohérent.
 */

/** Ressort élastique doux — léger dépassement puis stabilisation */
export const LIVE_DRAWER_SPRING_ELASTIC = {
  type: 'spring',
  stiffness: 188,
  damping: 20.5,
  mass: 1.08,
};

/** Onglets / panneaux imbriqués — un peu plus amorti */
export const LIVE_TAB_SPRING = {
  type: 'spring',
  stiffness: 260,
  damping: 26,
  mass: 0.92,
};

/** Voile derrière les tiroirs */
export const LIVE_DRAWER_BACKDROP_TRANSITION = {
  duration: 0.34,
  ease: [0.16, 1, 0.3, 1],
};

/** Tiroir latéral droit — glisse + léger scaleX depuis le bord droit */
export const liveDrawerAsideRight = {
  style: { transformOrigin: '100% 50%' },
  initial: { x: '100%', opacity: 0, scaleX: 0.92 },
  animate: { x: 0, opacity: 1, scaleX: 1 },
  exit: { x: '104%', opacity: 0, scaleX: 0.94 },
  transition: LIVE_DRAWER_SPRING_ELASTIC,
};

/** Tiroir latéral gauche — glisse + léger scaleX depuis le bord gauche */
export const liveDrawerAsideLeft = {
  style: { transformOrigin: '0% 50%' },
  initial: { x: '-104%', opacity: 0, scaleX: 0.92 },
  animate: { x: 0, opacity: 1, scaleX: 1 },
  exit: { x: '-108%', opacity: 0, scaleX: 0.94 },
  transition: LIVE_DRAWER_SPRING_ELASTIC,
};

/** Feuille bas (mobile / chat) — glisse + léger scaleY depuis le bas */
export const liveDrawerSheetBottom = {
  style: { transformOrigin: '50% 100%' },
  initial: { y: '108%', opacity: 0, scaleY: 0.94 },
  animate: { y: 0, opacity: 1, scaleY: 1 },
  exit: { y: '108%', opacity: 0, scaleY: 0.96 },
  transition: LIVE_DRAWER_SPRING_ELASTIC,
};

/** Panneau overlay (signal hub) ancré à gauche — occupe la zone, même ressort */
export const liveDrawerPanelLeftAbsolute = {
  style: { transformOrigin: '0% 50%' },
  initial: { x: '-105%', opacity: 0, scaleX: 0.93 },
  animate: { x: 0, opacity: 1, scaleX: 1 },
  exit: { x: '-108%', opacity: 0, scaleX: 0.95 },
  transition: LIVE_DRAWER_SPRING_ELASTIC,
};

/** Petite carte / barre flottante (focus LONGIA, etc.) */
export const liveDrawerFloatPanel = {
  style: { transformOrigin: '0% 0%' },
  initial: { opacity: 0, y: -10, scale: 0.94 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -8, scale: 0.96 },
  transition: LIVE_DRAWER_SPRING_ELASTIC,
};

/** Carte centrée en bas (NeuronQ flottant, etc.) — ne pas animer x si translate-x-1/2 CSS */
export const liveDrawerFloatCardBottomCenter = {
  style: { transformOrigin: '50% 100%' },
  initial: { opacity: 0, y: 18, scale: 0.93 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: 12, scale: 0.95 },
  transition: LIVE_DRAWER_SPRING_ELASTIC,
};
