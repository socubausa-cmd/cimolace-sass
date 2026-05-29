/**
 * Contexte JSON pour le COACH SLIDE (studio-longia-chat-stream + `designer_konva_assist`) — scène, cours, sélection, présence Copilot.
 */

function summarizeObject(o) {
  if (!o || typeof o !== 'object') return null;
  const base = {
    id: o.id,
    type: o.type,
    x: o.x,
    y: o.y,
    width: o.width,
    height: o.height,
    layer: o.layer,
    visible: o.visible,
    locked: o.locked,
  };
  if (o.type === 'text') {
    const t = String(o.content?.text || '').replace(/\s+/g, ' ').trim();
    return {
      ...base,
      textPreview: t,
      fontSize: o.style?.fontSize,
    };
  }
  if (o.type === 'image') {
    return { ...base, hasSrc: Boolean(o.content?.src) };
  }
  return base;
}

/**
 * @param {object} p
 * @param {import('../model/sceneTypes').SbKonvaProject | null} p.project
 * @param {import('../model/sceneTypes').SbKonvaScene | null} p.activeScene
 * @param {unknown} p.course
 * @param {number} p.activeSlideIndex
 * @param {string[]} p.selectedIds
 * @param {string} [p.centralIdea]
 * @param {string} [p.activitySummary]
 * @param {string} [p.interactionTool]
 * @param {{ kind?: string, x?: number, y?: number, width?: number, height?: number, points?: { x: number, y: number }[] } | null} [p.regionMarquee]
 */
export function buildLongiaDesignerChatContext({
  project,
  activeScene,
  course,
  activeSlideIndex,
  selectedIds,
  centralIdea = '',
  activitySummary = '',
  interactionTool = 'pointer',
  regionMarquee = null,
}) {
  const canvas = project?.canvas || {};
  const objects = activeScene?.objects || [];
  const sel = new Set(selectedIds || []);
  const selected = objects.filter((o) => sel.has(o.id)).map(summarizeObject).filter(Boolean);
  const slides = Array.isArray(course?.slides) ? course.slides : [];
  const slide = slides[activeSlideIndex] || null;

  return {
    editor: 'smartboard_konva_v1',
    canvas: {
      width: canvas.width,
      height: canvas.height,
      background: canvas.background,
    },
    scene: {
      id: activeScene?.id,
      name: activeScene?.name,
      objectCount: objects.length,
      sectionCount: (activeScene?.sections || []).length,
    },
    selection: {
      ids: [...sel],
      summaries: selected,
    },
    workbench: {
      interactionTool: interactionTool || 'pointer',
      regionMarquee: (() => {
        const rm = regionMarquee;
        if (
          !rm ||
          typeof rm !== 'object' ||
          !Number.isFinite(rm.x) ||
          !Number.isFinite(rm.y) ||
          !Number.isFinite(rm.width) ||
          !Number.isFinite(rm.height)
        ) {
          return null;
        }
        const kind = rm.kind || 'rect';
        const base = {
          kind,
          x: rm.x,
          y: rm.y,
          width: rm.width,
          height: rm.height,
        };
        if (kind === 'lasso' && Array.isArray(rm.points) && rm.points.length >= 3) {
          return {
            ...base,
            points: rm.points.map((p) => ({
              x: Math.round((Number(p.x) - rm.x) * 10) / 10,
              y: Math.round((Number(p.y) - rm.y) * 10) / 10,
            })),
          };
        }
        return base;
      })(),
    },
    /** Aperçu léger des objets (ordre inverse = derniers au-dessus en général) */
    objectsOutline: [...objects].reverse().map(summarizeObject).filter(Boolean),
    course: slides.length
      ? {
          title: course?.title || null,
          slideCount: slides.length,
          activeSlideIndex,
          activeSlide: slide
            ? {
                title: slide.title || null,
                objective: slide.objective || null,
                mainIdea: slide.content?.mainIdea || null,
                keyPoints: Array.isArray(slide.content?.keyPoints) ? slide.content.keyPoints : [],
              }
            : null,
        }
      : null,
    copilotPresence: {
      centralIdea: String(centralIdea || '').trim() || null,
      activitySummary: String(activitySummary || '').trim() || null,
    },
  };
}
