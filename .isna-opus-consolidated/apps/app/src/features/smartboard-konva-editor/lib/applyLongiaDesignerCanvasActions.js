import { mkTextObject, mkRectObject, mkCircleObject, mkImageObject } from '../model/sceneModel';

/**
 * Applique les actions déclarées par COACH SLIDE (bloc longia_canvas_actions).
 * @param {object[]} actions
 * @param {{
 *   addObject: (o: object) => void;
 *   pushHistory: () => void;
 *   setActiveSlideIndex: (i: number) => void;
 *   slideCount: number;
 *   deleteSelected?: () => void;
 *   selectedIds?: string[];
 *   groupSelected?: () => void;
 *   uniteSelected?: () => void;
 * }} api
 * @returns {number} nombre d’actions appliquées
 */
export function applyLongiaDesignerCanvasActions(actions, api) {
  const {
    addObject,
    pushHistory,
    setActiveSlideIndex,
    slideCount,
    deleteSelected,
    selectedIds = [],
    groupSelected,
    uniteSelected,
  } = api;
  if (!Array.isArray(actions) || actions.length === 0) return 0;
  let n = 0;
  let textStack = 0;

  for (const a of actions) {
    if (!a || typeof a !== 'object') continue;
    const t = String(a.type || '').trim();

    if (t === 'delete_selected') {
      if (typeof deleteSelected === 'function' && selectedIds.length > 0) {
        pushHistory();
        deleteSelected();
        n += 1;
      }
      continue;
    }

    /** Regroupe la sélection (même groupId) — équivalent « fusionner » logique */
    if (t === 'group_selected') {
      if (typeof groupSelected === 'function' && selectedIds.length >= 2) {
        groupSelected();
        n += 1;
      }
      continue;
    }

    /** Fusionne les bbox en un seul rectangle (destructif, simplifié) */
    if (t === 'unite_selected') {
      if (typeof uniteSelected === 'function' && selectedIds.length >= 2) {
        uniteSelected();
        n += 1;
      }
      continue;
    }

    if (t === 'add_text') {
      const text = String(a.text || '').trim().slice(0, 65535);
      if (!text) continue;
      pushHistory();
      const fs = Math.min(72, Math.max(12, Number(a.fontSize) || 22));
      const x = typeof a.x === 'number' && Number.isFinite(a.x) ? a.x : 80;
      const y = typeof a.y === 'number' && Number.isFinite(a.y) ? a.y : 100 + textStack * 48;
      textStack += 1;
      const fontWeight = Number(a.fontWeight) >= 600 ? 700 : 400;
      addObject(
        mkTextObject({
          x,
          y,
          width: Math.min(880, Math.max(280, 920 - x)),
          height: Math.min(200, 36 + Math.ceil(text.length / 48) * 28),
          content: { text, collapsible: false, sectionLabel: '' },
          style: {
            fontFamily: 'Inter, system-ui, sans-serif',
            fontSize: fs,
            fontWeight,
            fontStyle: 'normal',
            fill: String(a.fill || '#F7F2E8'),
            align: 'left',
            lineHeight: 1.25,
          },
        }),
      );
      n += 1;
      continue;
    }

    if (t === 'add_rect') {
      pushHistory();
      const x = typeof a.x === 'number' && Number.isFinite(a.x) ? a.x : 100;
      const y = typeof a.y === 'number' && Number.isFinite(a.y) ? a.y : 120;
      const w = Math.min(900, Math.max(20, Number(a.width) || 200));
      const h = Math.min(700, Math.max(20, Number(a.height) || 120));
      const fill = String(a.fill || 'rgba(212,175,55,0.15)');
      const stroke = String(a.stroke || '#D4AF37');
      const sw = Math.min(12, Math.max(0, Number(a.strokeWidth) || 2));
      const cornerRadius = Math.min(40, Math.max(0, Number(a.cornerRadius) ?? 8));
      addObject(
        mkRectObject({
          x,
          y,
          width: w,
          height: h,
          style: { fill, stroke, strokeWidth: sw, cornerRadius },
        }),
      );
      n += 1;
      continue;
    }

    if (t === 'add_circle') {
      pushHistory();
      const x = typeof a.x === 'number' && Number.isFinite(a.x) ? a.x : 200;
      const y = typeof a.y === 'number' && Number.isFinite(a.y) ? a.y : 200;
      const r = Math.min(400, Math.max(8, Number(a.radius) || Number(a.r) || 60));
      const fill = String(a.fill || 'rgba(96,165,250,0.2)');
      const stroke = String(a.stroke || '#60a5fa');
      const sw = Math.min(12, Math.max(0, Number(a.strokeWidth) || 2));
      addObject(
        mkCircleObject({
          x,
          y,
          width: r * 2,
          height: r * 2,
          style: { fill, stroke, strokeWidth: sw },
        }),
      );
      n += 1;
      continue;
    }

    if (t === 'add_image') {
      const url = String(a.url || a.src || '').trim().slice(0, 65535);
      if (!url) continue;
      pushHistory();
      const x = typeof a.x === 'number' && Number.isFinite(a.x) ? a.x : 120;
      const y = typeof a.y === 'number' && Number.isFinite(a.y) ? a.y : 100;
      const w = Math.min(920, Math.max(40, Number(a.width) || 320));
      const h = Math.min(800, Math.max(40, Number(a.height) || 200));
      addObject(mkImageObject(url, { x, y, width: w, height: h, layer: 1 }));
      n += 1;
      continue;
    }

    if (t === 'go_slide') {
      const idx = Math.floor(Number(a.slideIndex));
      if (Number.isFinite(idx) && idx >= 0 && idx < slideCount) {
        setActiveSlideIndex(idx);
        n += 1;
      }
    }
  }
  return n;
}
