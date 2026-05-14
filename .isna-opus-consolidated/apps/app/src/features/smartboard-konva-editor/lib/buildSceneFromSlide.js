/**
 * buildSceneFromSlide — pivot function.
 *
 * Converts a SmartboardSlide (DesignElement[]-based BoardState)
 * into an SbKonvaScene compatible with SmartboardKonvaEditorV1.
 *
 * Mapping:
 *   DesignElement.data.text  → SbKonvaObject content.text    (type 'text')
 *   DesignElement.data.url   → SbKonvaObject content.src     (type 'image')
 *   DesignElement.data.shape → SbKonvaObject                 (type 'rect' | 'circle')
 *   DesignElement.type line  → SbKonvaObject content.points  (type 'line')
 */
import { createEmptyScene, genSbKonvaId } from '../model/sceneModel';

// ── DesignElement → SbKonvaObject ─────────────────────────────────────────────

function designElementToKonvaObject(el) {
  const base = {
    id: el.id || genSbKonvaId(el.type),
    x: el.x ?? 100,
    y: el.y ?? 100,
    width: el.width ?? 400,
    height: el.height ?? 80,
    rotation: el.rotation ?? 0,
    opacity: el.opacity ?? 1,
    layer: el.zIndex ?? 1,
    visible: !el.hidden,
    locked: el.locked ?? false,
    step: el.step ?? 0,
    visibleFor: el.visibleFor ?? 'both',
    mindmapNodeId: '',
    masterScriptRef: '',
    sectionId: el.sectionId ?? null,
    style: el.style ?? {},
    content: {},
  };

  switch (el.type) {
    case 'text': {
      return {
        ...base,
        type: 'text',
        width: el.width ?? 600,
        height: el.height ?? 48,
        style: {
          fontFamily: el.style?.fontFamily ?? 'Inter, system-ui, sans-serif',
          fontSize: el.style?.fontSize ?? 28,
          fontWeight: el.style?.fontWeight ?? 400,
          fontStyle: el.style?.fontStyle ?? 'normal',
          fill: el.style?.fill ?? '#F7F2E8',
          align: el.style?.align ?? 'left',
          lineHeight: el.style?.lineHeight ?? 1.3,
          ...el.style,
        },
        content: {
          text: String(el.data?.text ?? ''),
          collapsible: false,
          defaultCollapsed: false,
          sectionLabel: '',
        },
      };
    }

    case 'image': {
      return {
        ...base,
        type: 'image',
        width: el.width ?? 400,
        height: el.height ?? 280,
        style: { objectFit: 'cover', ...el.style },
        content: {
          src: String(el.data?.url ?? el.data?.src ?? ''),
          alt: String(el.data?.alt ?? ''),
        },
      };
    }

    case 'line': {
      const pts = el.data?.points ?? [0, 0, el.width ?? 200, 0];
      return {
        ...base,
        type: 'line',
        x: el.x ?? 0,
        y: el.y ?? 0,
        width: el.width ?? 200,
        height: 4,
        layer: 0,
        style: {
          stroke: el.style?.stroke ?? '#94a3b8',
          strokeWidth: el.style?.strokeWidth ?? 2,
          lineCap: 'round',
          opacity: el.opacity ?? 0.4,
          hitStrokeWidth: 14,
          ...el.style,
        },
        content: { points: pts },
      };
    }

    case 'shape': {
      const shape = el.data?.shape ?? 'rect';
      if (shape === 'circle' || shape === 'ellipse') {
        return {
          ...base,
          type: 'ellipse',
          style: {
            fill: el.style?.fill ?? 'rgba(212,175,55,0.12)',
            stroke: el.style?.stroke ?? '#D4AF37',
            strokeWidth: el.style?.strokeWidth ?? 2,
            ...el.style,
          },
          content: {},
        };
      }
      return {
        ...base,
        type: 'rect',
        style: {
          fill: el.style?.fill ?? 'rgba(212,175,55,0.08)',
          stroke: el.style?.stroke ?? '#D4AF37',
          strokeWidth: el.style?.strokeWidth ?? 1,
          cornerRadius: el.style?.cornerRadius ?? 8,
          ...el.style,
        },
        content: {},
      };
    }

    default: {
      // Unknown type — wrap as rect placeholder
      return {
        ...base,
        type: 'rect',
        style: {
          fill: 'rgba(100,100,100,0.1)',
          stroke: '#555',
          strokeWidth: 1,
          cornerRadius: 4,
        },
        content: {},
      };
    }
  }
}

// ── BoardState → SbKonvaScene objects ─────────────────────────────────────────

function boardStateToObjects(boardState) {
  if (!boardState?.elements?.length) return [];
  return boardState.elements.map(designElementToKonvaObject).filter(Boolean);
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Build an SbKonvaScene from a SmartboardSlide.
 *
 * @param {import('@/engines/types/smartboard').SmartboardSlide} slide
 * @param {'initial' | 'live' | string} stateKey
 *   'initial' → initialState, 'live' → liveState, else progressiveStates[stateKey]
 * @returns {import('../model/sceneTypes').SbKonvaScene}
 */
export function buildSceneFromSlide(slide, stateKey = 'initial') {
  const scene = createEmptyScene(slide.title ?? 'Scene');
  scene.id = `scene_${slide.id}`;

  // Pick the correct BoardState
  let boardState = slide.initialState;
  if (stateKey === 'live') {
    boardState = slide.liveState ?? slide.initialState;
  } else if (stateKey !== 'initial' && slide.progressiveStates?.[stateKey]) {
    // Progressive reveal: merge initial + requested progressive state
    const initial = slide.initialState?.elements ?? [];
    const progressive = slide.progressiveStates[stateKey]?.elements ?? [];
    boardState = { elements: [...initial, ...progressive] };
  }

  scene.objects = boardStateToObjects(boardState);

  // Carry over sections
  if (slide.sections?.length) {
    scene.sections = slide.sections.map((sec) => ({
      id: sec.id,
      label: sec.label,
    }));
  }

  // Store the initial snapshot for reset
  scene.stateInitial = slide.resetState
    ? boardStateToObjects(slide.resetState)
    : null;

  return scene;
}

/**
 * Build all progressive scenes from a SmartboardSlide.
 * Returns one scene per section (progressive reveal), plus base + full.
 *
 * @param {import('@/engines/types/smartboard').SmartboardSlide} slide
 * @returns {{ base: SbKonvaScene; sections: SbKonvaScene[]; live: SbKonvaScene }}
 */
export function buildAllScenesFromSlide(slide) {
  const base = buildSceneFromSlide(slide, 'initial');
  const live = buildSceneFromSlide(slide, 'live');
  const sections = (slide.sections ?? []).map((sec) =>
    buildSceneFromSlide(slide, sec.id),
  );
  return { base, sections, live };
}
