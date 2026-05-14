/**
 * Calque de dessin au-dessus du SmartBoard / diapo.
 * Coordonnées normalisées 0–1 (norm: true) pour aligner hôte / invités quand la zone d’affichage diffère.
 */
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  Pencil, Eraser, Trash2, Minus, Plus, Square, Circle, Spline, PenLine, X, Mic, MicOff, Type, Shapes,
  Frame,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { LiriWordmark } from '@/components/brand/LiriWordmark';
import { ANNOTATION_BROADCAST_MAX_STROKES } from '@/lib/annotationStrokes';
import { applyNeuroInkToFreePoints, defaultNeuroInkSettings } from '@/lib/neuroInk';
import {
  LIRI_INK_EDIT_DOMAIN,
  mergeNeuroInkWithDomain,
  isStraightLineModifier,
  filterStrokesOutsideNormRect,
  buildPresetNormStroke,
  analyzePedagogyTranscript,
} from '@/lib/liriSmartboardInkEngine';
import { LIRI_PEDAGOGY_HINTS_QUEUE_KEY } from '@/lib/liriPedagogyHintsKonvaBridge';
import {
  createLiriSpeechAssistSession,
  isBrowserSpeechRecognitionSupported,
} from '@/lib/liriSmartboardSpeechAssist';
import NeuroInkPanel from './NeuroInkPanel';

const COLORS = [
  { value: '#D4AF37', label: 'Or' },
  { value: '#ffffff', label: 'Blanc' },
  { value: '#f87171', label: 'Rouge' },
  { value: '#34d399', label: 'Vert' },
  { value: '#60a5fa', label: 'Bleu' },
  { value: '#c084fc', label: 'Violet' },
  { value: '#fb923c', label: 'Orange' },
  { value: '#000000', label: 'Noir' },
];

function drawStroke(ctx, s, W, H) {
  const m = Math.min(W, H) || 1;
  if (s.norm) {
    const sizeNorm = s.sizeNorm ?? 0.004;
    if (s.type === 'free') {
      if (!s.points?.length) return;
      ctx.save();
      ctx.globalCompositeOperation = s.isEraser ? 'destination-out' : 'source-over';
      ctx.beginPath();
      ctx.strokeStyle = s.isEraser ? 'rgba(0,0,0,1)' : s.color;
      ctx.lineWidth = s.isEraser ? Math.max(2, sizeNorm * m * 6) : Math.max(1, sizeNorm * m);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      s.points.forEach(([nx, ny], i) => {
        const x = nx * W;
        const y = ny * H;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.restore();
      return;
    }
    if (s.type === 'line') {
      const lw = Math.max(1, sizeNorm * m);
      ctx.save();
      ctx.strokeStyle = s.color;
      ctx.lineWidth = lw;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(s.x1n * W, s.y1n * H);
      ctx.lineTo(s.x2n * W, s.y2n * H);
      ctx.stroke();
      ctx.restore();
      return;
    }
    if (s.type === 'rect') {
      const lw = Math.max(1, sizeNorm * m);
      ctx.save();
      ctx.strokeStyle = s.color;
      ctx.lineWidth = lw;
      ctx.strokeRect(s.xn * W, s.yn * H, s.wn * W, s.hn * H);
      ctx.restore();
      return;
    }
    if (s.type === 'ellipse') {
      const lw = Math.max(1, sizeNorm * m);
      const bx = s.xn * W;
      const by = s.yn * H;
      const bw = s.wn * W;
      const bh = s.hn * H;
      const cx = bx + bw / 2;
      const cy = by + bh / 2;
      const rx = Math.abs(bw) / 2;
      const ry = Math.abs(bh) / 2;
      if (rx < 0.5 || ry < 0.5) return;
      ctx.save();
      ctx.strokeStyle = s.color;
      ctx.lineWidth = lw;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    return;
  }

  // Legacy : coordonnées pixels (sessions anciennes sans norm)
  if (s.type === 'free') {
    if (!s.points?.length) return;
    ctx.save();
    ctx.globalCompositeOperation = s.isEraser ? 'destination-out' : 'source-over';
    ctx.beginPath();
    ctx.strokeStyle = s.isEraser ? 'rgba(0,0,0,1)' : s.color;
    ctx.lineWidth = s.isEraser ? s.size * 6 : s.size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    s.points.forEach(([x, y], i) => {
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.restore();
    return;
  }
  if (s.type === 'line') {
    ctx.save();
    ctx.strokeStyle = s.color;
    ctx.lineWidth = s.size;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(s.x1, s.y1);
    ctx.lineTo(s.x2, s.y2);
    ctx.stroke();
    ctx.restore();
    return;
  }
  if (s.type === 'rect') {
    ctx.save();
    ctx.strokeStyle = s.color;
    ctx.lineWidth = s.size;
    ctx.strokeRect(s.x, s.y, s.w, s.h);
    ctx.restore();
    return;
  }
  if (s.type === 'ellipse') {
    ctx.save();
    ctx.strokeStyle = s.color;
    ctx.lineWidth = s.size;
    const cx = s.x + s.w / 2;
    const cy = s.y + s.h / 2;
    const rx = Math.abs(s.w) / 2;
    const ry = Math.abs(s.h) / 2;
    if (rx < 0.5 || ry < 0.5) {
      ctx.restore();
      return;
    }
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

function redrawAll(canvas, strokeList) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const W = canvas.width;
  const H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  (strokeList || []).forEach((s) => drawStroke(ctx, s, W, H));
}

function canvasRect(canvas) {
  const r = canvas.getBoundingClientRect();
  return { W: Math.max(1, r.width), H: Math.max(1, r.height) };
}

function commitFreeNorm(canvas, cur) {
  const { W, H } = canvasRect(canvas);
  const m = Math.min(W, H);
  return {
    type: 'free',
    norm: true,
    color: cur.color,
    sizeNorm: cur.size / m,
    isEraser: cur.isEraser,
    points: cur.points.map(([x, y]) => [x / W, y / H]),
  };
}

function commitLineNorm(canvas, p, color, size) {
  const { W, H } = canvasRect(canvas);
  const m = Math.min(W, H);
  return {
    type: 'line',
    norm: true,
    color,
    sizeNorm: size / m,
    x1n: p.x1 / W,
    y1n: p.y1 / H,
    x2n: p.x2 / W,
    y2n: p.y2 / H,
  };
}

function commitRectNorm(canvas, p, color, size) {
  const { W, H } = canvasRect(canvas);
  const m = Math.min(W, H);
  return {
    type: 'rect',
    norm: true,
    color,
    sizeNorm: size / m,
    xn: p.x / W,
    yn: p.y / H,
    wn: p.w / W,
    hn: p.h / H,
  };
}

function commitEllipseNorm(canvas, p, color, size) {
  const { W, H } = canvasRect(canvas);
  const m = Math.min(W, H);
  return {
    type: 'ellipse',
    norm: true,
    color,
    sizeNorm: size / m,
    xn: p.x / W,
    yn: p.y / H,
    wn: p.w / W,
    hn: p.h / H,
  };
}

function getPos(e, canvas) {
  const rect = canvas.getBoundingClientRect();
  const src = e.touches ? e.touches[0] : e;
  return {
    x: src.clientX - rect.left,
    y: src.clientY - rect.top,
  };
}

export default function SlideAnnotationOverlay({
  readOnly = false,
  slideId = null,
  strokes: strokesProp = [],
  onStrokesChange = null,
  onSaveStroke,
  className,
}) {
  const canvasRef = useRef(null);
  const [annotateOpen, setAnnotateOpen] = useState(false);
  const [neuroInkOpen, setNeuroInkOpen] = useState(false);
  const [neuroInk, setNeuroInk] = useState(defaultNeuroInkSettings);
  const [tool, setTool] = useState('pencil');
  const [color, setColor] = useState('#D4AF37');
  const [size, setSize] = useState(3);

  const drawing = useRef(false);
  const lastPos = useRef(null);
  const curFree = useRef(null);
  const shapeStart = useRef(null);
  const previewStroke = useRef(null);
  /** ⌃/⌨ pendant tout le geste crayon → ligne droite début→fin */
  const straightLineModifierRef = useRef(false);

  const [editDomain, setEditDomain] = useState(LIRI_INK_EDIT_DOMAIN.HANDWRITING);
  const [speechAssistOn, setSpeechAssistOn] = useState(false);
  const [speechSnippet, setSpeechSnippet] = useState('');
  const [pedagogyHints, setPedagogyHints] = useState(/** @type {{ id: string; label: string; detail?: string }[]} */ ([]));
  const speechSessionRef = useRef(null);

  const effectiveNeuroInk = useMemo(
    () => mergeNeuroInkWithDomain(neuroInk, editDomain),
    [neuroInk, editDomain],
  );

  const strokes = Array.isArray(strokesProp) ? strokesProp : [];
  const strokesListRef = useRef(strokes);
  strokesListRef.current = strokes;

  useEffect(() => {
    setAnnotateOpen(false);
  }, [slideId]);

  useEffect(() => {
    if (!speechAssistOn || !annotateOpen) {
      speechSessionRef.current?.abort?.();
      speechSessionRef.current = null;
      return;
    }
    if (!isBrowserSpeechRecognitionSupported()) return undefined;

    const session = createLiriSpeechAssistSession({
      lang: 'fr-FR',
      onResult: (text, isFinal) => {
        setSpeechSnippet(text);
        if (isFinal && text?.trim()) {
          setPedagogyHints(analyzePedagogyTranscript(text));
        }
      },
      onError: () => {
        setSpeechAssistOn(false);
      },
    });
    if (!session.supported) return undefined;
    speechSessionRef.current = session;
    session.start();
    return () => {
      session.abort?.();
      speechSessionRef.current = null;
    };
  }, [speechAssistOn, annotateOpen]);

  useEffect(() => {
    if (!pedagogyHints.length) return;
    try {
      localStorage.setItem(
        LIRI_PEDAGOGY_HINTS_QUEUE_KEY,
        JSON.stringify({ hints: pedagogyHints, ts: Date.now() }),
      );
    } catch {
      /* quota / private mode */
    }
  }, [pedagogyHints]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    redrawAll(canvas, strokesListRef.current);
  }, [strokes]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;
    const resize = () => {
      const { width, height } = parent.getBoundingClientRect();
      canvas.width = Math.max(1, Math.floor(width));
      canvas.height = Math.max(1, Math.floor(height));
      redrawAll(canvas, strokesListRef.current);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(parent);
    return () => ro.disconnect();
  }, [slideId, readOnly]);

  const paintFrame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    redrawAll(canvas, strokes);
    const pv = previewStroke.current;
    if (pv?.type === 'zoneErase') {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.save();
      ctx.setLineDash([6, 4]);
      ctx.strokeStyle = 'rgba(248, 113, 113, 0.95)';
      ctx.lineWidth = 2;
      ctx.strokeRect(pv.x, pv.y, pv.w, pv.h);
      ctx.setLineDash([]);
      ctx.restore();
      return;
    }
    if (pv) {
      const ctx = canvas.getContext('2d');
      drawStroke(ctx, pv, canvas.width, canvas.height);
    }
  }, [strokes]);

  const startDraw = useCallback((e) => {
    if (readOnly || !annotateOpen) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    e.preventDefault();
    e.stopPropagation();
    const pos = getPos(e, canvas);
    drawing.current = true;
    straightLineModifierRef.current = isStraightLineModifier(e);

    if (tool === 'pencil' || tool === 'eraser') {
      curFree.current = {
        type: 'free',
        color,
        size,
        isEraser: tool === 'eraser',
        points: [[pos.x, pos.y]],
      };
      lastPos.current = pos;
      previewStroke.current = null;
      return;
    }

    shapeStart.current = pos;
    previewStroke.current = null;
  }, [readOnly, annotateOpen, tool, color, size]);

  const moveDraw = useCallback((e) => {
    if (!drawing.current || readOnly || !annotateOpen) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    e.preventDefault();
    e.stopPropagation();
    const pos = getPos(e, canvas);

    if (tool === 'pencil' || tool === 'eraser') {
      if (!curFree.current) return;
      straightLineModifierRef.current = straightLineModifierRef.current || isStraightLineModifier(e);
      curFree.current.points.push([pos.x, pos.y]);
      const ctx = canvas.getContext('2d');
      ctx.save();
      ctx.globalCompositeOperation = curFree.current.isEraser ? 'destination-out' : 'source-over';
      ctx.beginPath();
      ctx.strokeStyle = curFree.current.isEraser ? 'rgba(0,0,0,1)' : curFree.current.color;
      ctx.lineWidth = curFree.current.isEraser ? curFree.current.size * 6 : curFree.current.size;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.moveTo(lastPos.current.x, lastPos.current.y);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
      ctx.restore();
      lastPos.current = pos;
      return;
    }

    const s0 = shapeStart.current;
    if (!s0) return;
    const x = Math.min(s0.x, pos.x);
    const y = Math.min(s0.y, pos.y);
    const w = Math.abs(pos.x - s0.x);
    const h = Math.abs(pos.y - s0.y);

    if (tool === 'eraser-zone') {
      previewStroke.current = { type: 'zoneErase', x, y, w, h };
      paintFrame();
      return;
    }

    if (tool === 'line') {
      previewStroke.current = { type: 'line', x1: s0.x, y1: s0.y, x2: pos.x, y2: pos.y, color, size };
    } else if (tool === 'rect') {
      previewStroke.current = { type: 'rect', x, y, w, h, color, size };
    } else if (tool === 'ellipse') {
      previewStroke.current = { type: 'ellipse', x, y, w, h, color, size };
    }
    paintFrame();
  }, [readOnly, annotateOpen, tool, color, size, paintFrame]);

  const endDraw = useCallback(() => {
    if (!drawing.current || readOnly) return;
    const canvas = canvasRef.current;
    const forceStraightLine = straightLineModifierRef.current;
    const zonePreview = tool === 'eraser-zone' ? previewStroke.current : null;
    drawing.current = false;
    shapeStart.current = null;
    straightLineModifierRef.current = false;

    if (tool === 'pencil' || tool === 'eraser') {
      if (curFree.current?.points?.length && canvas) {
        let payload = curFree.current;
        if (tool === 'pencil') {
          const refined = applyNeuroInkToFreePoints(
            curFree.current.points,
            effectiveNeuroInk,
            canvas.width,
            canvas.height,
            { forceStraightLine },
          );
          payload = { ...curFree.current, points: refined.length >= 2 ? refined : curFree.current.points };
        }
        const stroke = commitFreeNorm(canvas, payload);
        if (stroke) {
          onSaveStroke?.(stroke);
          onStrokesChange?.((prev) => [...(Array.isArray(prev) ? prev : []), stroke]);
        }
      }
      curFree.current = null;
      return;
    }

    if (tool === 'eraser-zone' && zonePreview?.type === 'zoneErase' && canvas) {
      previewStroke.current = null;
      if (zonePreview.w > 4 && zonePreview.h > 4) {
        const { W, H } = canvasRect(canvas);
        const xn = zonePreview.x / W;
        const yn = zonePreview.y / H;
        const wn = zonePreview.w / W;
        const hn = zonePreview.h / H;
        onStrokesChange?.((prev) =>
          filterStrokesOutsideNormRect(
            Array.isArray(prev) ? prev : [],
            xn,
            yn,
            wn,
            hn,
            canvas.width,
            canvas.height,
          ),
        );
      }
      paintFrame();
      return;
    }

    if (previewStroke.current && canvas && (previewStroke.current.w > 2 || previewStroke.current.type === 'line')) {
      const p = previewStroke.current;
      if (p.type === 'line') {
        const len = Math.hypot(p.x2 - p.x1, p.y2 - p.y1);
        if (len > 2) {
          const stroke = commitLineNorm(canvas, p, color, size);
          onSaveStroke?.(stroke);
          onStrokesChange?.((prev) => [...(Array.isArray(prev) ? prev : []), stroke]);
        }
      } else if ((p.w > 2 || p.h > 2)) {
        const stroke = p.type === 'ellipse'
          ? commitEllipseNorm(canvas, p, color, size)
          : commitRectNorm(canvas, p, color, size);
        onSaveStroke?.(stroke);
        onStrokesChange?.((prev) => [...(Array.isArray(prev) ? prev : []), stroke]);
      }
    }
    previewStroke.current = null;
    paintFrame();
  }, [readOnly, tool, color, size, effectiveNeuroInk, onSaveStroke, onStrokesChange, paintFrame]);

  const clearAll = useCallback(() => {
    onStrokesChange?.([]);
  }, [onStrokesChange]);

  const undo = useCallback(() => {
    onStrokesChange?.((prev) => (Array.isArray(prev) ? prev : []).slice(0, -1));
  }, [onStrokesChange]);

  const insertPresetShape = useCallback(
    (preset) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const s = buildPresetNormStroke(canvas, preset, color, size);
      if (!s) return;
      onSaveStroke?.(s);
      onStrokesChange?.((prev) => [...(Array.isArray(prev) ? prev : []), s]);
    },
    [color, size, onSaveStroke, onStrokesChange],
  );

  if (readOnly) {
    if (strokes.length === 0) return null;
    return (
      <div className={cn('absolute inset-0 z-[25] pointer-events-none', className)}>
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full touch-none"
          aria-hidden
        />
      </div>
    );
  }

  return (
    <div className={cn('absolute inset-0 z-[25] pointer-events-none flex flex-col', className)}>
      <div className="pointer-events-auto absolute top-2 right-2 flex flex-col items-end gap-2 max-w-[min(100%,320px)]">
        <button
          type="button"
          onClick={() => setAnnotateOpen((v) => !v)}
          className={cn(
            'flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-[11px] font-semibold shadow-lg backdrop-blur-md transition-colors',
            annotateOpen
              ? 'border-[#D4AF37]/50 bg-[#D4AF37]/20 text-[#f5e6a8]'
              : 'border-white/15 bg-black/55 text-white/80 hover:bg-black/70',
          )}
          title={annotateOpen ? 'Fermer les outils d’annotation' : 'Annoter sur la projection'}
        >
          {annotateOpen ? <X className="w-3.5 h-3.5" /> : <PenLine className="w-3.5 h-3.5" />}
          {annotateOpen ? 'Fermer' : 'Annoter'}
        </button>

        {annotateOpen && (
          <div className="rounded-xl border border-white/12 bg-black/75 backdrop-blur-xl p-2 shadow-xl flex flex-col gap-2 w-full">
            <p className="text-[10px] text-white/45 px-0.5 leading-snug">
              Dessin visible par les participants (même proportions sur tous les écrans). Fermez pour cliquer sur la slide ou le PDF.
            </p>
            <div className="flex flex-col gap-1 rounded-lg border border-[#D4AF37]/20 bg-[#D4AF37]/5 px-2 py-1.5">
              <div className="flex flex-wrap items-end gap-1.5 text-[9px] font-semibold uppercase tracking-wide text-[#e8c76b]/90">
                <LiriWordmark size="footer" className="text-[#e8c76b]/90" subtleGlow />
                <span>· mode crayon</span>
              </div>
              <div className="flex gap-1">
                <button
                  type="button"
                  title="Manuscrit : lissage sans transformer les boucles en cercles"
                  onClick={() => setEditDomain(LIRI_INK_EDIT_DOMAIN.HANDWRITING)}
                  className={cn(
                    'flex flex-1 items-center justify-center gap-1 rounded-lg border px-2 py-1 text-[9px] font-medium transition-colors',
                    editDomain === LIRI_INK_EDIT_DOMAIN.HANDWRITING
                      ? 'border-[#D4AF37]/50 bg-[#D4AF37]/15 text-[#f5e6a8]'
                      : 'border-white/10 bg-white/[0.04] text-white/55 hover:text-white/80',
                  )}
                >
                  <Type className="h-3 w-3 shrink-0" />
                  Écriture
                </button>
                <button
                  type="button"
                  title="Croquis : reconnaissance cercle, rectangle, triangle, flèche…"
                  onClick={() => setEditDomain(LIRI_INK_EDIT_DOMAIN.SKETCH)}
                  className={cn(
                    'flex flex-1 items-center justify-center gap-1 rounded-lg border px-2 py-1 text-[9px] font-medium transition-colors',
                    editDomain === LIRI_INK_EDIT_DOMAIN.SKETCH
                      ? 'border-[#D4AF37]/50 bg-[#D4AF37]/15 text-[#f5e6a8]'
                      : 'border-white/10 bg-white/[0.04] text-white/55 hover:text-white/80',
                  )}
                >
                  <Shapes className="h-3 w-3 shrink-0" />
                  Croquis
                </button>
              </div>
              <p className="text-[8px] leading-snug text-white/35">
                <kbd className="rounded border border-white/15 bg-black/40 px-1 py-0.5 font-mono">⌃</kbd>
                {' + trait '}
                → ligne droite parfaite (début→fin).
              </p>
            </div>
            {isBrowserSpeechRecognitionSupported() ? (
              <div className="flex flex-col gap-1 rounded-lg border border-violet-500/20 bg-violet-950/20 px-2 py-1.5">
                <button
                  type="button"
                  onClick={() => setSpeechAssistOn((v) => !v)}
                  className={cn(
                    'flex w-full items-center justify-center gap-1.5 rounded-lg border px-2 py-1 text-[9px] font-medium transition-colors',
                    speechAssistOn
                      ? 'border-violet-400/40 bg-violet-500/20 text-violet-100'
                      : 'border-white/10 bg-white/[0.04] text-white/60 hover:text-white/85',
                  )}
                >
                  {speechAssistOn ? <Mic className="h-3 w-3" /> : <MicOff className="h-3 w-3" />}
                  {speechAssistOn ? 'IA écoute (micro)' : 'Assistance vocale (expérimental)'}
                </button>
                {speechSnippet ? (
                  <p className="max-h-14 overflow-y-auto text-[8px] leading-snug text-white/45 [scrollbar-width:thin]">
                    {speechSnippet}
                  </p>
                ) : (
                  <p className="text-[8px] text-white/30">Reconnaissance vocale navigateur — branchement titres/listes à venir.</p>
                )}
                {pedagogyHints.length > 0 ? (
                  <ul className="flex flex-col gap-0.5 border-t border-violet-500/15 pt-1.5">
                    {pedagogyHints.map((h) => (
                      <li key={h.id} className="text-[8px] leading-snug text-violet-200/85">
                        <span className="font-semibold text-violet-100/90">{h.label}</span>
                        {h.detail ? <span className="text-white/40"> — {h.detail}</span> : null}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}
            {strokes.length >= Math.floor(ANNOTATION_BROADCAST_MAX_STROKES * 0.85) && (
              <p className="text-[9px] text-amber-200/75 px-0.5 leading-snug">
                Limite d’environ {ANNOTATION_BROADCAST_MAX_STROKES} traits pour le live — les plus anciens seront retirés automatiquement au-delà.
              </p>
            )}
            <div className="flex flex-wrap items-center gap-1">
              {[
                { id: 'pencil', Icon: Pencil, title: 'Crayon' },
                { id: 'eraser', Icon: Eraser, title: 'Gomme trait' },
                { id: 'eraser-zone', Icon: Frame, title: 'Gomme zone — cadre pour supprimer les traits dedans' },
                { id: 'line', Icon: Spline, title: 'Trait' },
                { id: 'rect', Icon: Square, title: 'Rectangle' },
                { id: 'ellipse', Icon: Circle, title: 'Cercle / ellipse' },
              ].map(({ id, Icon, title }) => (
                <button
                  key={id}
                  type="button"
                  title={title}
                  onClick={() => setTool(id)}
                  className={cn(
                    'w-8 h-8 rounded-lg flex items-center justify-center border transition-all',
                    tool === id
                      ? 'bg-[#D4AF37]/25 border-[#D4AF37]/45 text-[#D4AF37]'
                      : 'bg-white/[0.06] border-white/10 text-white/55 hover:text-white',
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                </button>
              ))}
            </div>
            <div className="flex flex-col gap-1">
              <p className="text-[9px] text-white/40 px-0.5">Formes rapides</p>
              <div className="flex flex-wrap gap-1">
                {[
                  { id: 'circle', label: '○ cercle', Icon: Circle },
                  { id: 'square', label: '□ carré', Icon: Square },
                  { id: 'hline', label: '— ligne', Icon: Minus },
                  { id: 'frame', label: '▭ encadré', Icon: Frame },
                ].map(({ id, label, Icon: Ic }) => (
                  <button
                    key={id}
                    type="button"
                    title={label}
                    onClick={() => insertPresetShape(id)}
                    className="flex flex-1 min-w-[4.5rem] items-center justify-center gap-1 rounded-lg border border-white/10 bg-white/[0.05] px-1.5 py-1 text-[8px] text-white/65 hover:border-[#D4AF37]/35 hover:text-[#D4AF37]"
                  >
                    <Ic className="h-3 w-3 shrink-0 opacity-80" />
                    {label.split(' ')[0]}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-1">
              {COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  title={c.label}
                  onClick={() => { setColor(c.value); if (tool === 'eraser' || tool === 'eraser-zone') setTool('pencil'); }}
                  className={cn(
                    'w-5 h-5 rounded-full border-2 transition-transform',
                    color === c.value && tool !== 'eraser' ? 'border-white scale-110' : 'border-transparent hover:scale-105',
                  )}
                  style={{ backgroundColor: c.value }}
                />
              ))}
            </div>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => setSize((s) => Math.max(1, s - 1))} className="w-7 h-7 rounded-lg bg-white/[0.06] border border-white/10 flex items-center justify-center text-white/60">
                <Minus className="w-3 h-3" />
              </button>
              <span className="text-[10px] text-white/50 w-6 text-center tabular-nums">{size}</span>
              <button type="button" onClick={() => setSize((s) => Math.min(16, s + 1))} className="w-7 h-7 rounded-lg bg-white/[0.06] border border-white/10 flex items-center justify-center text-white/60">
                <Plus className="w-3 h-3" />
              </button>
              <div className="flex-1" />
              <button type="button" onClick={undo} className="h-7 px-2 rounded-lg bg-white/[0.06] border border-white/10 text-[10px] text-white/55 hover:text-white">
                Annuler
              </button>
              <button type="button" onClick={clearAll} className="w-7 h-7 rounded-lg bg-red-500/15 border border-red-500/25 flex items-center justify-center text-red-400/80 hover:text-red-300" title="Tout effacer">
                <Trash2 className="w-3 h-3" />
              </button>
            </div>

            <div className="border-t border-white/10 pt-2 mt-0.5">
              <NeuroInkPanel
                open={neuroInkOpen}
                onOpenChange={setNeuroInkOpen}
                neuroInk={neuroInk}
                setNeuroInk={setNeuroInk}
              />
            </div>
          </div>
        )}
      </div>

      <canvas
        ref={canvasRef}
        className={cn(
          'absolute inset-0 w-full h-full touch-none',
          annotateOpen ? 'pointer-events-auto cursor-crosshair' : 'pointer-events-none',
        )}
        style={{
          cursor:
            annotateOpen && tool === 'eraser'
              ? 'cell'
              : annotateOpen && tool === 'eraser-zone'
                ? 'crosshair'
                : undefined,
        }}
        onMouseDown={startDraw}
        onMouseMove={moveDraw}
        onMouseUp={endDraw}
        onMouseLeave={endDraw}
        onTouchStart={startDraw}
        onTouchMove={moveDraw}
        onTouchEnd={endDraw}
      />
    </div>
  );
}
