/**
 * Scènes du bandeau « joker » SmartBoard — alignées sur config.smartboard_scenes du wizard.
 */

export const DEFAULT_SMARTBOARD_SCENE_FLAGS = {
  smartboard: true,
  diapo: true,
  screen: true,
  browser: true,
  embed: true,
  quiz: true,
  secure_app_share: true,
  board: true,
  image: true,
  camera2: false,
  shop: true,
};

export function mergeSmartboardSceneFlags(raw) {
  const patch =
    raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  return { ...DEFAULT_SMARTBOARD_SCENE_FLAGS, ...patch };
}

function on(flags, id) {
  return flags[id] !== false;
}

/**
 * @param {object} opts
 * @param {Record<string, boolean>} [opts.flags] — fusionné avec les défauts
 */
export function buildSmartboardNavigatorScenes(opts = {}) {
  const f = mergeSmartboardSceneFlags(opts.flags);
  const list = [];

  if (on(f, 'smartboard')) {
    list.push({ id: 'smartboard', label: 'SmartBoard natif', hint: 'Programme LIRI (IA, progressif) — distinct des imports' });
  }
  if (on(f, 'diapo')) {
    list.push({ id: 'diapo', label: 'Diaporama importé', hint: 'Images, PDF, PPT / exports — pas le moteur SmartBoard interne' });
  }
  if (on(f, 'screen')) list.push({ id: 'screen', label: 'Écran', hint: 'Partage d’écran' });
  if (on(f, 'browser')) list.push({ id: 'browser', label: 'Web', hint: 'Navigateur intégré' });
  if (on(f, 'embed')) list.push({ id: 'embed', label: 'Embed', hint: 'Iframe / lien' });
  if (on(f, 'quiz')) list.push({ id: 'quiz', label: 'Quiz', hint: 'Quiz intégré' });
  if (on(f, 'secure_app_share')) {
    list.push({
      id: 'secure_app_share',
      label: 'App secure',
      hint: 'Application embarquée synchronisée (hôte -> invités)',
    });
  }
  if (on(f, 'board')) list.push({ id: 'board', label: 'Crayon', hint: 'Tableau blanc' });
  if (on(f, 'image')) {
    list.push({ id: 'image', label: 'Images', hint: 'Galerie (manuel ou boucle)' });
  }
  if (on(f, 'camera2')) {
    list.push({
      id: 'camera2',
      label: 'Cam 2',
      hint: '2ᵉ caméra : téléphone (avant/arrière), écran de l’appareil, USB ou flux participant',
    });
  }
  if (on(f, 'shop')) list.push({ id: 'shop', label: 'Boutique', hint: 'Liens & paiement' });

  return list.length > 0 ? list : [{ id: 'smartboard', label: 'SmartBoard natif', hint: '' }];
}

export function navigatorSceneIds(flags) {
  return buildSmartboardNavigatorScenes({ flags }).map((s) => s.id);
}

/** Scènes « contenu intelligent » : le flux partage-écran peut s’y superposer sans changer de scène. */
export const SMARTBOARD_INTELLIGENT_SCENES = ['smartboard', 'diapo'];

/** Métadonnées de toutes les scènes configurables (pour réglages type Step 6). */
export function getAllSmartboardNavigatorSceneMetas() {
  const allTrue = Object.fromEntries(Object.keys(DEFAULT_SMARTBOARD_SCENE_FLAGS).map((k) => [k, true]));
  return buildSmartboardNavigatorScenes({ flags: mergeSmartboardSceneFlags(allTrue) });
}
