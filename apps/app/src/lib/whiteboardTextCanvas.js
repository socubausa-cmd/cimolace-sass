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

/** Familles de police disponibles pour le texte du tableau (clé stockée dans le stroke). */
export const WHITEBOARD_FONT_STACK = {
  sans: 'ui-sans-serif, system-ui, sans-serif',
  serif: 'Georgia, "Times New Roman", serif',
  hand: '"Segoe Print", "Bradley Hand", "Comic Sans MS", cursive',
  mono: 'ui-monospace, "SFMono-Regular", Menlo, monospace',
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
  const fontFamily = WHITEBOARD_FONT_STACK[stroke?.fontFamily] || WHITEBOARD_FONT_STACK.sans;
  return {
    presetKey,
    fontSize,
    fontWeight,
    fontStyle,
    textAlign,
    fontFamily,
    underline: stroke?.underline === true,
    highlight: stroke?.highlight || null,
    border: stroke?.border === true,
  };
}

export function whiteboardCanvasFont({ fontSize, fontWeight, fontStyle, fontFamily }) {
  return `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily || 'ui-sans-serif, system-ui, sans-serif'}`;
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} stroke — kind text
 */
export function measureWhiteboardTextBlock(ctx, stroke) {
  const { fontSize, fontWeight, fontStyle, textAlign, fontFamily, underline, highlight, border } =
    resolveWhiteboardTextStyle(stroke);
  const lines = String(stroke.text || '').split('\n');
  ctx.save();
  ctx.font = whiteboardCanvasFont({ fontSize, fontWeight, fontStyle, fontFamily });
  const lineHeight = fontSize * 1.25;
  let maxW = 0;
  lines.forEach((line) => {
    maxW = Math.max(maxW, ctx.measureText(line || ' ').width);
  });
  ctx.restore();
  const pad = textAlign === 'left' ? 4 : 6;
  const w = maxW + pad * 2;
  const h = Math.max(lineHeight, lines.length * lineHeight) + pad;
  return {
    lines, maxW, lineHeight, w, h, pad,
    fontSize, fontWeight, fontStyle, textAlign, fontFamily,
    underline, highlight, border,
  };
}

export function drawWhiteboardTextStroke(ctx, stroke) {
  const m = measureWhiteboardTextBlock(ctx, stroke);
  ctx.save();
  ctx.font = whiteboardCanvasFont({
    fontSize: m.fontSize,
    fontWeight: m.fontWeight,
    fontStyle: m.fontStyle,
    fontFamily: m.fontFamily,
  });
  ctx.textBaseline = 'top';
  // Surlignage (fond) — dessiné derrière le bloc avant le texte.
  if (m.highlight) {
    ctx.fillStyle = m.highlight;
    ctx.fillRect(stroke.x - m.pad, stroke.y - m.pad / 2, m.w, m.h);
  }
  ctx.fillStyle = stroke.color;
  m.lines.forEach((line, i) => {
    const lineW = ctx.measureText(line || ' ').width;
    let x = stroke.x;
    if (m.textAlign === 'center') x = stroke.x + (m.maxW - lineW) / 2;
    if (m.textAlign === 'right') x = stroke.x + (m.maxW - lineW);
    const y = stroke.y + i * m.lineHeight;
    ctx.fillText(line || ' ', x, y);
    // Soulignement — trait sous chaque ligne.
    if (m.underline) {
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = Math.max(1, m.fontSize / 14);
      ctx.beginPath();
      ctx.moveTo(x, y + m.fontSize * 1.05);
      ctx.lineTo(x + lineW, y + m.fontSize * 1.05);
      ctx.stroke();
    }
  });
  // Encadrement (bordure) — rect autour du bloc.
  if (m.border) {
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = Math.max(1.5, m.fontSize / 16);
    ctx.strokeRect(stroke.x - m.pad, stroke.y - m.pad / 2, m.w, m.h);
  }
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
