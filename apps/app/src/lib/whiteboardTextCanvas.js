/**
 * Styles texte tableau blanc live — presets type Smartboard / Architect (titre, sous-titre, corps, légende).
 */

export const WHITEBOARD_TEXT_PRESET = {
  title: 'title',
  subtitle: 'subtitle',
  body: 'body',
  caption: 'caption',
};

/** @type {Record<string, { fontSize: number, fontWeight: number }>} */
export const WHITEBOARD_TEXT_PRESET_BASE = {
  title: { fontSize: 40, fontWeight: 700 },
  subtitle: { fontSize: 28, fontWeight: 600 },
  body: { fontSize: 20, fontWeight: 400 },
  caption: { fontSize: 14, fontWeight: 400 },
};

export function resolveWhiteboardTextStyle(stroke) {
  const presetKey = stroke?.textPreset && WHITEBOARD_TEXT_PRESET_BASE[stroke.textPreset]
    ? stroke.textPreset
    : 'body';
  const base = WHITEBOARD_TEXT_PRESET_BASE[presetKey];
  const fontSize = typeof stroke?.fontSize === 'number' ? stroke.fontSize : base.fontSize;
  let fontWeight = typeof stroke?.fontWeight === 'number' ? stroke.fontWeight : base.fontWeight;
  if (stroke?.textBold === true) fontWeight = Math.max(fontWeight, 700);
  const fontStyle = stroke?.fontStyle === 'italic' ? 'italic' : 'normal';
  const textAlign = stroke?.textAlign === 'center' || stroke?.textAlign === 'right' ? stroke.textAlign : 'left';
  return {
    presetKey,
    fontSize,
    fontWeight,
    fontStyle,
    textAlign,
  };
}

export function whiteboardCanvasFont({ fontSize, fontWeight, fontStyle }) {
  return `${fontStyle} ${fontWeight} ${fontSize}px ui-sans-serif, system-ui, sans-serif`;
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} stroke — kind text
 */
export function measureWhiteboardTextBlock(ctx, stroke) {
  const { fontSize, fontWeight, fontStyle, textAlign } = resolveWhiteboardTextStyle(stroke);
  const lines = String(stroke.text || '').split('\n');
  ctx.save();
  ctx.font = whiteboardCanvasFont({ fontSize, fontWeight, fontStyle });
  const lineHeight = fontSize * 1.25;
  let maxW = 0;
  lines.forEach((line) => {
    maxW = Math.max(maxW, ctx.measureText(line || ' ').width);
  });
  ctx.restore();
  const pad = textAlign === 'left' ? 4 : 6;
  const w = maxW + pad * 2;
  const h = Math.max(lineHeight, lines.length * lineHeight) + pad;
  return { lines, maxW, lineHeight, w, h, pad, fontSize, fontWeight, fontStyle, textAlign };
}

export function drawWhiteboardTextStroke(ctx, stroke) {
  const m = measureWhiteboardTextBlock(ctx, stroke);
  ctx.save();
  ctx.font = whiteboardCanvasFont({
    fontSize: m.fontSize,
    fontWeight: m.fontWeight,
    fontStyle: m.fontStyle,
  });
  ctx.fillStyle = stroke.color;
  ctx.textBaseline = 'top';
  m.lines.forEach((line, i) => {
    const lineW = ctx.measureText(line || ' ').width;
    let x = stroke.x;
    if (m.textAlign === 'center') x = stroke.x + (m.maxW - lineW) / 2;
    if (m.textAlign === 'right') x = stroke.x + (m.maxW - lineW);
    ctx.fillText(line || ' ', x, stroke.y + i * m.lineHeight);
  });
  ctx.restore();
}

export function hitTestWhiteboardTextStroke(ctx, stroke, px, py) {
  if ((stroke.kind || 'path') !== 'text') return false;
  const m = measureWhiteboardTextBlock(ctx, stroke);
  const pad = 6;
  return (
    px >= stroke.x - pad
    && py >= stroke.y - pad
    && px <= stroke.x + m.w
    && py <= stroke.y + m.h
  );
}
