/**
 * Migration sans dépendance Polotno : JSON `store.toJSON()` → projet Konva (`sceneModel`).
 * Couverture : texte, image, figures rect/cercle/triangle/étoile, groupes (aplatis).
 */
import {
  SB_KONVA_CANVAS_H,
  SB_KONVA_CANVAS_W,
  createEmptyProject,
  createEmptyScene,
  mkCircleObject,
  mkImageObject,
  mkLineObject,
  mkRectObject,
  mkStarShapeObject,
  mkTextObject,
  mkTriangleObject,
  sortObjectsByLayer,
} from '../model/sceneModel';

function polotnoTextContent(el) {
  const t = el.text;
  if (typeof t === 'string') return t;
  if (Array.isArray(t)) {
    return t
      .map((seg) => (seg && typeof seg === 'object' ? String(seg.text ?? '') : ''))
      .join('');
  }
  return '';
}

/**
 * @param {unknown[]} children
 * @param {number} gx
 * @param {number} gy
 * @param {import('../model/sceneTypes').SbKonvaObjectBase[]} out
 * @param {number} z
 */
function collectPolotnoElements(children, gx, gy, out, z) {
  if (!Array.isArray(children)) return;
  for (const raw of children) {
    const el = raw && typeof raw === 'object' ? /** @type {Record<string, unknown>} */ (raw) : null;
    if (!el) continue;
    if (el.visible === false) continue;
    const opacity = typeof el.opacity === 'number' ? el.opacity : 1;
    if (opacity < 0.02) continue;

    const x = gx + Number(el.x) || 0;
    const y = gy + Number(el.y) || 0;
    const rot = Number(el.rotation) || 0;
    const w = Math.max(8, Number(el.width) || 80);
    const h = Math.max(8, Number(el.height) || 48);
    const layer = z + (Number(el.custom?.layer) || 0);

    const type = String(el.type || '');

    if (type === 'group') {
      const ch = /** @type {{ children?: unknown[] }} */ (el).children;
      collectPolotnoElements(Array.isArray(ch) ? ch : [], x, y, out, z + 1);
      continue;
    }

    if (type === 'text') {
      const txt = polotnoTextContent(el).slice(0, 24000);
      const fwRaw = el.fontWeight;
      const fontWeight =
        typeof fwRaw === 'number'
          ? fwRaw
          : Number.parseInt(String(fwRaw ?? '400'), 10) || 400;
      out.push(
        mkTextObject({
          x,
          y,
          width: w,
          height: h,
          rotation: rot,
          layer,
          style: {
            fontFamily: String(el.fontFamily || 'Inter, system-ui, sans-serif'),
            fontSize: Math.max(8, Number(el.fontSize) || 18),
            fontWeight,
            fontStyle: el.fontStyle === 'italic' ? 'italic' : 'normal',
            fill: String(el.fill || '#F7F2E8'),
            align: /** @type {'left'|'center'|'right'} */ (
              ['left', 'center', 'right'].includes(String(el.align)) ? el.align : 'left'
            ),
            lineHeight: Number(el.lineHeight) > 0 ? Number(el.lineHeight) : 1.25,
          },
          content: { text: txt },
        }),
      );
      continue;
    }

    if (type === 'image') {
      const src = String(el.src || '').trim();
      if (!src) continue;
      out.push(
        mkImageObject(src, {
          x,
          y,
          width: w,
          height: h,
          rotation: rot,
          layer,
        }),
      );
      continue;
    }

    if (type === 'figure') {
      const sub = String(el.subType != null && el.subType !== '' ? el.subType : 'rect').toLowerCase();
      const fill = String(el.fill || 'rgba(212,175,55,0.15)');
      const stroke = String(el.stroke || 'transparent');
      const strokeWidth = Number(el.strokeWidth) || 0;
      const cornerRadius = Number(el.cornerRadius) || 0;

      if (sub === 'circle' || sub === 'ellipse') {
        out.push(
          mkCircleObject({
            x,
            y,
            width: w,
            height: h,
            rotation: rot,
            layer,
            style: { fill, stroke, strokeWidth },
          }),
        );
        continue;
      }
      if (sub === 'triangle') {
        out.push(
          mkTriangleObject({
            x,
            y,
            width: w,
            height: h,
            rotation: rot,
            layer,
            style: { fill, stroke, strokeWidth },
          }),
        );
        continue;
      }
      if (sub === 'star') {
        out.push(
          mkStarShapeObject({
            x,
            y,
            width: w,
            height: h,
            rotation: rot,
            layer,
            style: { fill, stroke: stroke || '', strokeWidth },
          }),
        );
        continue;
      }
      out.push(
        mkRectObject({
          x,
          y,
          width: w,
          height: h,
          rotation: rot,
          layer,
          style: {
            fill,
            stroke,
            strokeWidth,
            cornerRadius,
          },
        }),
      );
      continue;
    }

    if (type === 'line') {
      const pts = Array.isArray(el.points) ? el.points.map((n) => Number(n) || 0) : [];
      if (pts.length >= 4) {
        const x1 = pts[0];
        const y1 = pts[1];
        const x2 = pts[2];
        const y2 = pts[3];
        out.push(
          mkLineObject({
            x: gx + x,
            y: gy + y,
            width: Math.max(4, Math.abs(x2 - x1) || w),
            height: Math.max(4, Math.abs(y2 - y1) || h),
            rotation: rot,
            layer,
            style: {
              stroke: String(el.stroke || '#94a3b8'),
              strokeWidth: Math.max(1, Number(el.strokeWidth) || 2),
            },
            content: { points: [0, 0, x2 - x1, y2 - y1] },
          }),
        );
      }
    }
  }
}

/**
 * @param {unknown} polotnoJson — typiquement `polotno store.toJSON()`
 * @returns {import('../model/sceneTypes').SbKonvaProject | null}
 */
export function migratePolotnoJsonToKonvaProject(polotnoJson) {
  if (!polotnoJson || typeof polotnoJson !== 'object') return null;
  const pages = /** @type {{ pages?: unknown }} */ (polotnoJson).pages;
  if (!Array.isArray(pages) || pages.length === 0) return null;

  const p0 = /** @type {Record<string, unknown>} */ (pages[0]);
  const cw = Math.max(100, Number(p0.width) || SB_KONVA_CANVAS_W);
  const ch = Math.max(100, Number(p0.height) || SB_KONVA_CANVAS_H);
  const bg0 = typeof p0.background === 'string' ? p0.background : '#0b0f1a';

  /** @type {import('../model/sceneTypes').SbKonvaScene[]} */
  const scenes = [];
  for (let i = 0; i < pages.length; i += 1) {
    const page = /** @type {Record<string, unknown>} */ (pages[i]);
    const name =
      typeof page.name === 'string' && page.name.trim()
        ? page.name.trim()
        : `Scène ${i + 1}`;
    const scene = createEmptyScene(name);
    /** @type {import('../model/sceneTypes').SbKonvaObjectBase[]} */
    const objects = [];
    collectPolotnoElements(
      Array.isArray(page.children) ? /** @type {unknown[]} */ (page.children) : [],
      0,
      0,
      objects,
      0,
    );
    scene.objects = sortObjectsByLayer(objects);
    scenes.push(scene);
  }

  const project = createEmptyProject();
  project.canvas = { width: cw, height: ch, background: bg0 };
  project.scenes = scenes;
  if (scenes[0]?.id) {
    project.activeSceneId = scenes[0].id;
  }
  return project;
}
