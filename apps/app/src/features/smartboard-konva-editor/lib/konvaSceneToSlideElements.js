/**
 * Pont optionnel : objets Konva Designer → éléments legacy `slide.elements[]` (SlideParallaxStage).
 * À utiliser lors d'un export « live » ou fusion workspace si besoin.
 */

/**
 * @param {import('../model/sceneTypes').SbKonvaObjectBase} obj
 * @param {number} zIndex
 */
export function konvaObjectToSlideElement(obj, zIndex = 1) {
  const z = zIndex;
  const base = {
    id: obj.id,
    x: obj.x,
    y: obj.y,
    width: obj.width,
    height: obj.height,
    zIndex: z,
    rotation: obj.rotation ?? 0,
    opacity: obj.visible === false ? 0.35 : 1,
  };

  if (obj.type === 'text') {
    const st = obj.style || {};
    const c = obj.content || {};
    return {
      ...base,
      type: 'free_text',
      content: c.text ?? '',
      fontFamily: st.fontFamily,
      fontSize: st.fontSize,
      fontWeight: st.fontWeight,
      color: st.fill,
      textAlign: st.align || 'left',
      italic: st.fontStyle === 'italic',
      collapsible: Boolean(c.collapsible),
      defaultCollapsed: Boolean(c.defaultCollapsed),
      sectionLabel: typeof c.sectionLabel === 'string' ? c.sectionLabel : '',
    };
  }

  if (obj.type === 'rect') {
    const st = obj.style || {};
    return {
      ...base,
      type: 'shape_rect',
      fill: st.fill,
      stroke: st.stroke,
      strokeWidth: st.strokeWidth ?? 2,
      borderRadius: st.cornerRadius ?? 0,
    };
  }

  if (obj.type === 'circle') {
    const st = obj.style || {};
    return {
      ...base,
      type: 'shape_circle',
      fill: st.fill,
      stroke: st.stroke,
      strokeWidth: st.strokeWidth ?? 2,
    };
  }

  if (obj.type === 'image') {
    const src = obj.content?.src || '';
    return {
      ...base,
      type: 'image',
      src,
      url: src,
      content: '',
    };
  }

  if (obj.type === 'html') {
    return {
      ...base,
      type: 'html_embed',
      html: String(obj.content?.html ?? ''),
    };
  }

  if (obj.type === 'icon') {
    return {
      ...base,
      type: 'badge',
      content: obj.content?.glyph ? String(obj.content.glyph) : '★',
    };
  }

  return null;
}

/**
 * @param {import('../model/sceneTypes').SbKonvaScene} scene
 */
export function konvaSceneToSlideElements(scene) {
  const objs = [...(scene?.objects || [])].sort((a, b) => (a.layer ?? 0) - (b.layer ?? 0));
  const out = [];
  let zi = 1;
  for (const o of objs) {
    const el = konvaObjectToSlideElement(o, zi);
    if (el) {
      out.push(el);
      zi += 1;
    }
  }
  return out;
}
