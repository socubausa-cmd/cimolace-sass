/**
 * Canevas de conception SmartBoard = référence native unique pour le Designer Konva et le rendu
 * « éléments positionnels » sur l'écran intelligent (même repère % que le JSON Architect).
 *
 * L'UI Live (LiveHostPage / LiveSceneSlide) utilise ces constantes pour convertir x,y,w,h
 * en pourcentages — à garder synchronisé avec `sceneModel` / SmartboardKonvaEditor.
 */
export const SMARTBOARD_DESIGN_WIDTH = 1037;
export const SMARTBOARD_DESIGN_HEIGHT = 750;
export const SMARTBOARD_DESIGN_RATIO = SMARTBOARD_DESIGN_WIDTH / SMARTBOARD_DESIGN_HEIGHT;

/**
 * Canevas 9:16 invité (template « authority ») — unifié avec
 * `generateMobileSmartboardSlide` / `format: mobile-9-16` côté Architect.
 * Le plateau SmartBoard (1037×750) est mis à l'échelle **dans** ce cadre ; la zone prof reste ancrée en px.
 */
export const MOBILE_LIVE_AUTHORITY_WIDTH = 390;
export const MOBILE_LIVE_AUTHORITY_HEIGHT = 844;
export const MOBILE_LIVE_AUTHORITY_RATIO = MOBILE_LIVE_AUTHORITY_WIDTH / MOBILE_LIVE_AUTHORITY_HEIGHT;
export const MOBILE_LIVE_AUTHORITY_SAFE_PADDING = 20;
export const MOBILE_LIVE_AUTHORITY_TEACHER_ZONE = {
  id: 'teacherVideo',
  x: 238,
  y: 118,
  width: 132,
  height: 150,
  label: 'Zone vidéo professeur verrouillée',
};

/** Alias explicite pour l'UI (coque Smart Designer / doc). */
export const SMARTBOARD_NATIVE_VIEWPORT = {
  width: SMARTBOARD_DESIGN_WIDTH,
  height: SMARTBOARD_DESIGN_HEIGHT,
};

/**
 * Facteur scale « contain » pour loger le canevas dans un rectangle disponible (px).
 */
export function computeSmartboardCanvasScale(containerWidth, containerHeight) {
  const w = Number(containerWidth) || 0;
  const h = Number(containerHeight) || 0;
  if (w < 8 || h < 8) return 1;
  const s = Math.min(w / SMARTBOARD_DESIGN_WIDTH, h / SMARTBOARD_DESIGN_HEIGHT);
  if (!isFinite(s) || s <= 0) return 1;
  return Math.max(0.06, Math.min(s, 6));
}

/**
 * Facteur scale « cover » : remplit tout le rectangle visible (live plateau) sans bandes mortes ;
 * le surplus est rogné (même principe que object-fit: cover). Le repère de conception 1037×750 reste inchangé.
 */
export function computeSmartboardCanvasScaleCover(containerWidth, containerHeight) {
  const w = Number(containerWidth) || 0;
  const h = Number(containerHeight) || 0;
  if (w < 8 || h < 8) return 1;
  const s = Math.max(w / SMARTBOARD_DESIGN_WIDTH, h / SMARTBOARD_DESIGN_HEIGHT);
  if (!isFinite(s) || s <= 0) return 1;
  return Math.max(0.06, Math.min(s, 6));
}

/**
 * Taille logique du canevas pour une slide progressive (Architect / API).
 */
export function resolveProgressiveSlideDesignSize(data) {
  if (!data || typeof data !== 'object') {
    return { width: SMARTBOARD_DESIGN_WIDTH, height: SMARTBOARD_DESIGN_HEIGHT };
  }
  const mobileFmt =
    data.format === 'mobile-9-16'
    || data.meta?.format === 'mobile-9-16'
    || data.meta?.template === 'MobileSmartboardAuthorityTemplate';
  if (mobileFmt) {
    return { width: MOBILE_LIVE_AUTHORITY_WIDTH, height: MOBILE_LIVE_AUTHORITY_HEIGHT };
  }
  const dc = data.design_canvas;
  if (dc && Number(dc.width) > 0 && Number(dc.height) > 0) {
    return { width: Math.round(Number(dc.width)), height: Math.round(Number(dc.height)) };
  }
  const fmt = data.format;
  if (fmt && typeof fmt === 'object' && Number(fmt.width) > 0 && Number(fmt.height) > 0) {
    return { width: Math.round(Number(fmt.width)), height: Math.round(Number(fmt.height)) };
  }
  return { width: SMARTBOARD_DESIGN_WIDTH, height: SMARTBOARD_DESIGN_HEIGHT };
}

export function computeDesignCanvasScaleContain(containerWidth, containerHeight, designWidth, designHeight) {
  const w = Number(containerWidth) || 0;
  const h = Number(containerHeight) || 0;
  const dw = Number(designWidth) || SMARTBOARD_DESIGN_WIDTH;
  const dh = Number(designHeight) || SMARTBOARD_DESIGN_HEIGHT;
  if (w < 8 || h < 8) return 1;
  const s = Math.min(w / dw, h / dh);
  if (!isFinite(s) || s <= 0) return 1;
  return Math.max(0.06, Math.min(s, 6));
}

export function computeDesignCanvasScaleCover(containerWidth, containerHeight, designWidth, designHeight) {
  const w = Number(containerWidth) || 0;
  const h = Number(containerHeight) || 0;
  const dw = Number(designWidth) || SMARTBOARD_DESIGN_WIDTH;
  const dh = Number(designHeight) || SMARTBOARD_DESIGN_HEIGHT;
  if (w < 8 || h < 8) return 1;
  const s = Math.max(w / dw, h / dh);
  if (!isFinite(s) || s <= 0) return 1;
  return Math.max(0.06, Math.min(s, 6));
}

/**
 * Estime WxH de conception pour SmartBoard Architect (aperçu studio / alignement zone centrale live).
 * Ratio natif SmartBoard conservé ; tient compte des marges UI (chrome studio, barres).
 */
export function estimateArchitectDesignCanvasFromViewport(options = {}) {
  if (typeof window === 'undefined') return null;
  const marginX = options.marginX ?? 160;
  const marginY = options.marginY ?? 220;
  const minW = options.minWidth ?? 640;
  const minH = options.minHeight ?? 480;
  const maxW = options.maxWidth ?? 3840;
  const maxH = options.maxHeight ?? 2160;
  const ratio = SMARTBOARD_DESIGN_RATIO;
  const maxWAvail = Math.min(maxW, Math.max(minW, window.innerWidth - marginX));
  const maxHAvail = Math.min(maxH, Math.max(minH, window.innerHeight - marginY));
  let w = maxWAvail;
  let h = Math.round(w / ratio);
  if (h > maxHAvail) {
    h = maxHAvail;
    w = Math.round(h * ratio);
  }
  return {
    width: Math.max(minW, w),
    height: Math.max(minH, h),
  };
}

// ── Mesure « sur mesure » du plateau live (cadre `stageCaptureSurfaceRef`, expandStageToViewport) ──

let liveStageArchitectPixels = null;
const liveStageArchitectListeners = new Set();

/** Aligné sur clamp serveur `smartboard-ia-generate` (requête designCanvas). */
function clampArchitectRequestPixels(w, h) {
  const W = Math.round(Number(w));
  const H = Math.round(Number(h));
  if (!Number.isFinite(W) || !Number.isFinite(H)) return null;
  if (W < 480 || H < 360 || W > 4096 || H > 4096) return null;
  return { width: W, height: H };
}

/**
 * Publie la taille CSS du cadre central SmartBoard (live hôte plein plateau).
 * Appelé depuis SmartBoardCompositor + ResizeObserver ; effacé au démontage.
 */
export function publishLiveSmartboardStageDesignPixels(width, height) {
  const next = clampArchitectRequestPixels(width, height);
  if (!next) {
    clearLiveSmartboardStageDesignPixels();
    return;
  }
  const prev = liveStageArchitectPixels;
  if (prev && prev.width === next.width && prev.height === next.height) return;
  liveStageArchitectPixels = next;
  liveStageArchitectListeners.forEach((fn) => {
    try {
      fn();
    } catch {
      /* ignore */
    }
  });
}

export function clearLiveSmartboardStageDesignPixels() {
  if (liveStageArchitectPixels == null) return;
  liveStageArchitectPixels = null;
  liveStageArchitectListeners.forEach((fn) => {
    try {
      fn();
    } catch {
      /* ignore */
    }
  });
}

export function getLiveSmartboardStageDesignSnapshot() {
  return liveStageArchitectPixels;
}

export function subscribeLiveSmartboardStageDesignPixels(listener) {
  liveStageArchitectListeners.add(listener);
  return () => liveStageArchitectListeners.delete(listener);
}

/**
 * Taille à envoyer à SmartBoard Architect : **mesure live** si le plateau est monté, sinon estimation viewport.
 */
export function resolveArchitectDesignCanvasForApiRequest(options) {
  const live = getLiveSmartboardStageDesignSnapshot();
  if (live) return live;
  return estimateArchitectDesignCanvasFromViewport(options);
}

// ── Live invité : viewport vertical (type TikTok) vs canevas 1037×750 ──

/**
 * Téléphone logique cible (iPhone 14/15 @1x, plein portait in-app). Aligné sur la sortie « Smartphone 390×844 » du studio.
 * `chromeTopBottomReserve` = barre live, miniatures, safe area, zone pouce.
 */
export const MOBILE_LIVE_VIEWPORT_CSS = {
  width: 390,
  height: 844,
  chromeTopBottomReserve: 168,
};

/**
 * Tablette portrait courante (iPad 11" logique) pour comparaison densité.
 */
export const TABLET_LIVE_VIEWPORT_CSS = {
  width: 834,
  height: 1112,
  chromeTopBottomReserve: 200,
};

/**
 * Estime l'échelle « contain » du canevas de conception sur la zone scène mobile / tablette,
 * pour aider l'auteur à juger la quantité d'info lisible (même contenu qu'au web, mis à l'échelle).
 *
 * @param {object} [options]
 * @param {number} [options.designWidth]
 * @param {number} [options.designHeight]
 * @param {number} [options.viewportWidth]
 * @param {number} [options.viewportHeight]
 * @param {number} [options.chromeTopBottomReserve]
 * @param {boolean} [options.tablet] — utilise `TABLET_LIVE_VIEWPORT_CSS` si largeur/hauteur non fournies
 */
export function getSmartboardMobileReadabilitySummary(options = {}) {
  const dw = Number(options.designWidth) > 0 ? Math.round(Number(options.designWidth)) : SMARTBOARD_DESIGN_WIDTH;
  const dh = Number(options.designHeight) > 0 ? Math.round(Number(options.designHeight)) : SMARTBOARD_DESIGN_HEIGHT;
  const useTablet = Boolean(options.tablet);
  const def = useTablet ? TABLET_LIVE_VIEWPORT_CSS : MOBILE_LIVE_VIEWPORT_CSS;
  const vw = Number(options.viewportWidth) > 0 ? Number(options.viewportWidth) : def.width;
  const vh = Number(options.viewportHeight) > 0 ? Number(options.viewportHeight) : def.height;
  const cr = options.chromeTopBottomReserve;
  const chrome =
    cr != null && Number.isFinite(Number(cr)) && Number(cr) >= 0
      ? Number(cr)
      : def.chromeTopBottomReserve;
  const availW = Math.max(120, vw);
  const availH = Math.max(120, vh - chrome);
  const scaleContain = Math.min(availW / dw, availH / dh);
  const s = isFinite(scaleContain) && scaleContain > 0 ? Math.max(0.02, scaleContain) : 1;
  const minOk = 0.11;
  const minTight = 0.07;
  let status = 'poor';
  if (s >= minOk) status = 'ok';
  else if (s >= minTight) status = 'tight';
  const hint =
    status === 'ok'
      ? 'Lisibilité confortable : le plan 1037×750 tient entièrement dans la zone scène, comme sur le web (même infographie, plus petite).'
      : status === 'tight'
        ? 'Densité élevée : limitez le texte par écran ou augmentez la taille des caractères à la conception.'
        : 'Risque de texte illisible : scindez en plusieurs écrans ou simplifiez la diapositive.';
  return {
    device: useTablet ? 'tablet' : 'phone',
    designSize: { width: dw, height: dh },
    viewportCss: { width: Math.round(vw), height: Math.round(vh) },
    availableStage: { width: Math.round(availW), height: Math.round(availH) },
    /** Échelle globale (contain) = taille d'un « pixel de conception » côté spectateur. */
    scaleContain: s,
    scaleContainPercent: Math.round(s * 1000) / 10,
    status,
    hint,
  };
}
