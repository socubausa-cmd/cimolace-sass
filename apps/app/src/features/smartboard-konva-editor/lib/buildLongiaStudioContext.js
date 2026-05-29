/**
 * Contexte LONGIA aligné sur les données runtime (canvas, cours Copilot, workspace).
 * Reste compact pour l'Edge Function (tronquage serveur ~4200 car. sur JSON.stringify).
 */

/** @param {string} s @param {number} max */
function trunc(s, max) {
  const t = String(s ?? '').replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

/**
 * Histogramme des types d'objets sur une scène.
 * @param {Array<{ type?: string }>|undefined} objects
 */
export function longiaObjectTypeHistogram(objects) {
  const hist = {};
  for (const o of objects ?? []) {
    const k = o?.type && typeof o.type === 'string' ? o.type : 'unknown';
    hist[k] = (hist[k] || 0) + 1;
  }
  return hist;
}

/**
 * @param {{
 *   designerMode?: string;
 *   docType?: string | null;
 *   studioQuickMode?: string;
 *   llmMode?: string;
 *   workspaceCloudId?: string | null;
 *   workspaceCloudTitle?: string;
 *   outputFormats?: string[];
 *   course?: object | null;
 *   courseTitleFallback?: string | null;
 *   activeSlideIndex?: number;
 *   scenes?: Array<{ id?: string; name?: string; objects?: unknown[] }>;
 *   activeSceneId?: string | null;
 *   canvas?: { width?: number; height?: number; background?: string };
 *   selectedIds?: string[];
 *   documentCoach?: { isDocumentMode?: boolean; phase?: string } | null;
 *   lastRouting?: { requestedMode?: string; effectiveMode?: string; routingReason?: string } | null;
 *   appContext?: { embeddedControlActive?: boolean; appName?: string | null } | null;
 * }} p
 */
export function buildLongiaStudioContext(p) {
  const scenes = Array.isArray(p.scenes) ? p.scenes : [];
  const activeId = p.activeSceneId ?? null;
  const scene = scenes.find((s) => s.id === activeId) ?? scenes[0];
  const objects = Array.isArray(scene?.objects) ? scene.objects : [];
  const hist = longiaObjectTypeHistogram(objects);

  const selectedIds = Array.isArray(p.selectedIds) ? p.selectedIds : [];
  const selectionItems = selectedIds
    .map((id) => {
      const o = objects.find((x) => x && x.id === id);
      if (!o) return null;
      const base = { type: o.type || 'unknown' };
      if (o.type === 'text' && o.content && typeof o.content.text === 'string') {
        return { ...base, textPreview: trunc(o.content.text, 140) };
      }
      return base;
    })
    .filter(Boolean)
    .slice(0, 8);

  const course = p.course && typeof p.course === 'object' ? p.course : null;
  const slides = Array.isArray(course?.slides) ? course.slides : [];
  const idx = Math.max(0, Math.min(slides.length - 1, Number(p.activeSlideIndex) || 0));
  const activeSlide = slides.length ? slides[idx] : null;

  const courseBlock = course
    ? {
        title: trunc(course.title, 120),
        description: trunc(course.description, 200),
        slideCount: slides.length,
        activeSlideIndex: idx,
        activeSlideTitle: activeSlide?.title ? trunc(activeSlide.title, 100) : null,
        activeSlideObjective: activeSlide?.objective ? trunc(activeSlide.objective, 220) : null,
        activeSlideType: activeSlide?.type ?? null,
        chapters: (course.chapters ?? [])
          .slice(0, 6)
          .map((c) => ({ title: trunc(c.title, 80) })),
        slidesOutline: slides.slice(0, 12).map((s) => ({
          title: trunc(s.title, 72),
          type: s.type ?? null,
        })),
        analysisTopic: course.analysis?.mainTopic ? trunc(course.analysis.mainTopic, 100) : null,
        complexity: course.analysis?.complexity ?? null,
      }
    : {
        title: p.courseTitleFallback ? trunc(p.courseTitleFallback, 120) : null,
        slideCount: 0,
        activeSlideIndex: 0,
        activeSlideTitle: null,
        activeSlideObjective: null,
        activeSlideType: null,
        chapters: [],
        slidesOutline: [],
        analysisTopic: null,
        complexity: null,
      };

  const ac = p.appContext && typeof p.appContext === 'object' ? p.appContext : null;
  const appContextBlock =
    ac && ac.embeddedControlActive === true
      ? {
          embeddedControlActive: true,
          appName: typeof ac.appName === 'string' && ac.appName.trim() ? trunc(ac.appName, 120) : undefined,
        }
      : undefined;

  return {
    designerMode: p.designerMode,
    docType: p.docType || undefined,
    outputFormats: Array.isArray(p.outputFormats) && p.outputFormats.length ? p.outputFormats.slice(0, 8) : undefined,
    studioQuickMode: p.studioQuickMode,
    llmMode: p.llmMode,
    appContext: appContextBlock,
    workspaceId: p.workspaceCloudId || undefined,
    workspaceTitle: p.workspaceCloudTitle ? trunc(p.workspaceCloudTitle, 160) : undefined,
    documentCoach: p.documentCoach?.isDocumentMode
      ? { phase: p.documentCoach.phase || 'unknown' }
      : undefined,
    lastRouting: p.lastRouting?.effectiveMode
      ? {
          requestedMode: p.lastRouting.requestedMode,
          effectiveMode: p.lastRouting.effectiveMode,
          routingReason: p.lastRouting.routingReason,
        }
      : undefined,
    canvas: p.canvas
      ? {
          width: p.canvas.width,
          height: p.canvas.height,
          background: typeof p.canvas.background === 'string' ? trunc(p.canvas.background, 80) : undefined,
        }
      : undefined,
    scenes: {
      total: scenes.length,
      activeSceneId: scene?.id ?? null,
      activeSceneName: scene?.name ? trunc(scene.name, 80) : null,
      perScene: scenes.slice(0, 16).map((s) => ({
        name: trunc(s.name || 'Scène', 48),
        objectCount: Array.isArray(s.objects) ? s.objects.length : 0,
      })),
    },
    activeScene: {
      objectCount: objects.length,
      types: hist,
    },
    selection: {
      count: selectedIds.length,
      items: selectionItems,
    },
    course: courseBlock,
  };
}

/**
 * Fil d'aperçu coach (remplace les messages mock) à partir de la scène et du cours.
 * @param {{
 *   scene?: { name?: string; objects?: Array<{ type?: string; id?: string; content?: { text?: string } }> } | null;
 *   course?: { title?: string; slides?: Array<{ title?: string; objective?: string }> } | null;
 *   activeSceneIndex?: number;
 *   selectedIds?: string[];
 *   getTypeLabel?: (type: string) => string;
 * }} p
 */
export function buildLongiaHubCoachFeed(p) {
  const getLabel = p.getTypeLabel || ((t) => t || 'élément');
  const scene = p.scene;
  const objects = Array.isArray(scene?.objects) ? scene.objects : [];
  const n = objects.length;
  const selectedIds = Array.isArray(p.selectedIds) ? p.selectedIds : [];
  const slides = Array.isArray(p.course?.slides) ? p.course.slides : [];
  const idx = Math.max(0, Math.min(slides.length - 1, Number(p.activeSceneIndex) || 0));
  const slide = slides[idx];

  /** @type {Array<{ type: 'warn'|'info'|'success'|'ai'; text: string }>} */
  const out = [];

  if (!n) {
    out.push({
      type: 'info',
      text: `Scène « ${trunc(scene?.name || 'active', 40)} » est vide — ajoutez un bloc texte ou une forme (barre d'outils gauche).`,
    });
  } else if (n > 14) {
    out.push({
      type: 'warn',
      text: `${n} éléments sur cette scène : regroupez ou allégez pour garder une lecture claire.`,
    });
  }

  const textCount = objects.filter((o) => o?.type === 'text').length;
  if (textCount >= 3) {
    out.push({
      type: 'info',
      text: `${textCount} textes détectés — variez les tailles (titre / sous-titre / corps) pour la hiérarchie visuelle.`,
    });
  }

  if (slide?.objective && String(slide.objective).trim()) {
    out.push({
      type: 'success',
      text: `Objectif pédagogique (fiche ${idx + 1}) : ${trunc(slide.objective, 130)}`,
    });
  } else if (p.course?.title && slides.length) {
    out.push({
      type: 'ai',
      text: `Parcours « ${trunc(p.course.title, 42)} » — ${slides.length} fiche(s) dans le plan Copilot.`,
    });
  }

  if (selectedIds.length === 1) {
    const o = objects.find((x) => x?.id === selectedIds[0]);
    if (o) {
      out.push({
        type: 'info',
        text: `${getLabel(o.type || '')} sélectionné — onglet Action : grouper, dupliquer, centrer.`,
      });
    }
  } else if (selectedIds.length >= 2) {
    out.push({
      type: 'info',
      text: `${selectedIds.length} éléments sélectionnés — vous pouvez grouper ou aligner depuis l'onglet Action.`,
    });
  }

  if (!out.length) {
    out.push({
      type: 'ai',
      text: 'LONGIA lit votre scène et votre plan. Posez une question dans la barre du bas pour aller plus loin.',
    });
  }

  return out.slice(0, 5);
}

/**
 * Score d'aperçu « clarté » (heuristique, pas une IA).
 */
export function computeLongiaClarityScore(p) {
  const scene = p.scene;
  const objects = Array.isArray(scene?.objects) ? scene.objects : [];
  const n = objects.length;
  const slides = Array.isArray(p.course?.slides) ? p.course.slides : [];
  const idx = Math.max(0, Math.min(slides.length - 1, Number(p.activeSceneIndex) || 0));
  const hasObjective = Boolean(slides[idx]?.objective && String(slides[idx].objective).trim());

  let score = 38;
  if (n > 0 && n <= 6) score += 22;
  else if (n > 6 && n <= 12) score += 14;
  else if (n > 12) score += 6;
  if (slides.length) score += 12;
  if (hasObjective) score += 14;
  if (p.course?.title) score += 6;
  return Math.min(96, Math.round(score));
}
