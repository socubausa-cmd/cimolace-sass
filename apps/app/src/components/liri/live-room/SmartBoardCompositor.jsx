/**
 * SmartBoardCompositor — une scène à la fois, plein cadre.
 * Navigateur de scènes : colonne verticale à droite par défaut, ou `sceneDockPlacement="footer"` (barre parente) + PiP étroit + NeuroInk sur le bord en scène board.
 * Scène board : rail outils intégré au compositeur par défaut ; `hideEmbeddedWhiteboardToolsRail` pour le masquer si un parent affiche déjà les outils ailleurs.
 *
 * Scenes:
 *   diapo    → Slide immersif
 *   screen   → Écran partagé (getDisplayMedia stream, full view)
 *   browser  → Navigateur web intégré (iframe + URL bar, interactive)
 *   image    → Image partagée
 *   camera2  → 2ᵉ caméra (téléphone avant/arrière, capture écran appareil, USB, flux salle)
 */

import React, {
  useState, useRef, useEffect, useLayoutEffect, useCallback, useMemo, forwardRef,
} from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronUp, ChevronDown, Globe, RefreshCw,
  ExternalLink, AlertCircle, Camera, MonitorPlay,
  UserSquare2, Move, ChevronLeft, ChevronRight, Home,
  HelpCircle, Link2, X, Smartphone,
  Bold, Italic, AlignLeft, AlignCenter, AlignRight, Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getActiveTenantBranding } from '@/lib/tenant/activeBranding';
import {
  designerShellMicroLabel,
  designerShellCardInset,
  designerShellSegmentedRail,
  designerShellSegmentedSlot,
  designerShellDeviceRow,
  designerShellHeader,
  designerShellInput,
  designerShellBtnGold,
  designerShellChipGhost,
  designerShellEmbedPanel,
} from '@/lib/liriDesignerShellClasses';
import SlideParallaxStage from './SlideParallaxStage';
import SlideAnnotationOverlay from './SlideAnnotationOverlay';
import NeuroInkPanel from './NeuroInkPanel';
import { useNeuroInkAi } from './useNeuroInkAi';
import LiveWhiteboardToolsSidebar from './LiveWhiteboardToolsSidebar';
import WhiteboardContextMenu from './WhiteboardContextMenu';
import { useLiveWhiteboardStore } from './useLiveWhiteboardStore';
import { LIRI_LIVE_ARCHITECT_APPLY } from '@/lib/liriLiveArchitectApplyEvent';
export const LIRI_WB_LATEX_PENDING_EVENT = 'liri:wb:latex-pending';
import { applyNeuroInkToFreePoints } from '@/lib/neuroInk';
import {
  LIRI_INK_EDIT_DOMAIN,
  mergeNeuroInkWithDomain,
  isStraightLineModifier,
} from '@/lib/liriSmartboardInkEngine';
import {
  drawWhiteboardTextStroke,
  measureWhiteboardTextBlock,
  hitTestWhiteboardTextStroke,
  WHITEBOARD_TEXT_PRESET_BASE,
} from '@/lib/whiteboardTextCanvas';
import { invokeWhiteboardTextAi } from '@/lib/liriWhiteboardTextAi';
import {
  buildSmartboardNavigatorScenes,
  mergeSmartboardSceneFlags,
  SMARTBOARD_INTELLIGENT_SCENES,
} from '@/lib/smartboardNavigatorScenes';
import { playSmartboardSceneNavigationSound } from '@/lib/smartboardSceneNavSound';
// Scène « Dossier MEDOS » : rend la scène clinique partagée (jumeau 3D / roue / SOAP / labs)
// sur le smartboard central du live. SharedSceneView est la même vue que le cockpit patient.
import { SharedSceneView } from '@/features/medos-cockpit/MedTeleconsultCockpit';
import {
  cloneStrokesDeep,
  offsetWhiteboardStroke,
  offsetWhiteboardStrokes,
} from '@/lib/whiteboardStrokeTransform';
import { WHITEBOARD_TEMPLATES } from '@/lib/whiteboardTemplates';
import WhiteboardObjectEditPanel from './WhiteboardObjectEditPanel';
import {
  SMARTBOARD_DESIGN_WIDTH,
  SMARTBOARD_DESIGN_HEIGHT,
  publishLiveSmartboardStageDesignPixels,
  clearLiveSmartboardStageDesignPixels,
} from '@/lib/smartboardDesignCanvas';
import {
  isSchoolKind,
  drawSchoolStroke,
  schoolStrokeVisualBounds,
  hitTestSchoolStroke,
  latexDecodeListeners,
  drawCompassDraft,
  drawAngleDraft,
  reflectStrokeAcrossLine,
  rotateStroke,
  scaleStroke,
  safeMathEval,
} from '@/lib/whiteboardSchoolStrokes';
import { SmartboardNavigatorSceneIcon } from '@/components/liri/live-room/SmartboardNavigatorSceneIcon';
import { SECURE_APP_ALLOWED_DOMAINS } from '@/config/secureAppShareDomains';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

/** Fond « canvas » Smartboard Designer — grille alignée sur le shell studio */
const SCENE_STAGE_GRID =
  'bg-[var(--lh-stage-bg)] bg-[linear-gradient(rgba(255,255,255,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.045)_1px,transparent_1px)] [background-size:44px_44px]';

/** Barre d'outils / URL — même bandeau que les tiroirs designer */
const SCENE_TOOLBAR = cn(designerShellHeader, 'min-h-0 flex-wrap gap-2 py-2.5 pl-3 pr-3');

// ── PiP sizes ─────────────────────────────────────────────────────────────────
const PIP_SIZES = {
  sm: { widthPct: 18, label: 'S' },
  md: { widthPct: 24, label: 'M' },
  lg: { widthPct: 32, label: 'L' },
};

/** Marge basse PiP (px) — plus de bandeau scènes en bas */
const PIP_BOTTOM_SAFE_PX = 10;

function guestBoardPageLabel1Based(pageIndex, pageCount) {
  const c = Math.max(1, Math.floor(Number(pageCount) || 1));
  const i = Math.min(Math.max(0, Math.floor(Number(pageIndex) || 0)), c - 1);
  return i + 1;
}

// ── Whiteboard Scene ──────────────────────────────────────────────────────────
function hexToRgba(hex, alpha) {
  if (!hex || typeof hex !== 'string' || !hex.startsWith('#')) {
    return `rgba(255,255,255,${alpha})`;
  }
  const h = hex.slice(1);
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  if (full.length !== 6) return `rgba(255,255,255,${alpha})`;
  const n = parseInt(full, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

function drawOneStroke(ctx, stroke) {
  const kind = stroke.kind || 'path';
  if (kind === 'path') {
    if (!stroke.points?.length) return;
    ctx.beginPath();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = stroke.isEraser ? stroke.size * 5 : stroke.size;
    if (stroke.isEraser) {
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(0,0,0,1)';
      stroke.points.forEach(([x, y], i) => {
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.restore();
      return;
    }
    ctx.strokeStyle = stroke.color;
    stroke.points.forEach(([x, y], i) => {
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    return;
  }
  if (kind === 'text') {
    drawWhiteboardTextStroke(ctx, stroke);
    return;
  }
  if (kind === 'rect') {
    const { x, y, w, h, color, lineWidth, fill, fillColor: fc } = stroke;
    ctx.lineWidth = lineWidth ?? 2;
    ctx.strokeStyle = color;
    if (fc) { ctx.fillStyle = fc; ctx.fillRect(x, y, w, h); }
    else if (fill) { ctx.fillStyle = hexToRgba(color, 0.22); ctx.fillRect(x, y, w, h); }
    ctx.strokeRect(x, y, w, h);
    return;
  }
  if (kind === 'circle') {
    const { cx, cy, r, color, lineWidth, fill, fillColor: fc } = stroke;
    ctx.beginPath();
    ctx.arc(cx, cy, Math.max(0, r), 0, Math.PI * 2);
    ctx.lineWidth = lineWidth ?? 2;
    ctx.strokeStyle = color;
    if (fc) { ctx.fillStyle = fc; ctx.fill(); }
    else if (fill) { ctx.fillStyle = hexToRgba(color, 0.22); ctx.fill(); }
    ctx.stroke();
    return;
  }
  if (kind === 'line') {
    ctx.beginPath();
    ctx.moveTo(stroke.x1, stroke.y1);
    ctx.lineTo(stroke.x2, stroke.y2);
    ctx.lineWidth = stroke.lineWidth ?? 2;
    ctx.strokeStyle = stroke.color;
    ctx.lineCap = 'round';
    ctx.stroke();
    return;
  }
  if (kind === 'quadratic') {
    const {
      x0, y0, cx, cy, x1, y1, color, lineWidth: lw,
    } = stroke;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo(cx, cy, x1, y1);
    ctx.lineWidth = lw ?? 2;
    ctx.strokeStyle = color;
    ctx.lineCap = 'round';
    ctx.stroke();
    return;
  }
  if (kind === 'image') {
    const url = String(stroke.url || '').trim();
    const x = stroke.x ?? 0;
    const y = stroke.y ?? 0;
    const bw = Math.max(1, stroke.width ?? 120);
    const bh = Math.max(1, stroke.height ?? 80);
    const op = stroke.opacity != null ? Number(stroke.opacity) : 1;
    if (!url) return;
    const entry = getOrDecodeBoardImage(url);
    ctx.save();
    ctx.globalAlpha = Number.isFinite(op) ? Math.max(0, Math.min(1, op)) : 1;
    let drew = false;
    if (entry.ready && entry.img?.naturalWidth) {
      try {
        ctx.drawImage(entry.img, x, y, bw, bh);
        drew = true;
      } catch {
        entry.failed = true;
        entry.ready = false;
      }
    }
    if (!drew) {
      if (entry.failed) {
        ctx.fillStyle = 'rgba(248,113,113,0.12)';
        ctx.strokeStyle = 'rgba(248,113,113,0.45)';
        ctx.lineWidth = 1;
        ctx.fillRect(x, y, bw, bh);
        ctx.strokeRect(x, y, bw, bh);
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.font = '12px ui-sans-serif, system-ui, sans-serif';
        ctx.textBaseline = 'top';
        ctx.fillText('Image indisponible', x + 6, y + 8);
      } else {
        ctx.fillStyle = 'rgba(255,255,255,0.06)';
        ctx.strokeStyle = 'rgba(212,175,55,0.4)';
        ctx.lineWidth = 1;
        ctx.fillRect(x, y, bw, bh);
        ctx.strokeRect(x, y, bw, bh);
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.font = '11px ui-sans-serif, system-ui, sans-serif';
        ctx.textBaseline = 'top';
        ctx.fillText('Chargement…', x + 6, y + 8);
      }
    }
    ctx.restore();
    return;
  }
  if (kind === 'group') {
    (stroke.strokes || []).forEach((sub) => drawOneStroke(ctx, sub));
    return;
  }
  if (isSchoolKind(kind)) {
    drawSchoolStroke(ctx, stroke);
  }
}

function drawPolyDraft(ctx, draft, color, lw) {
  if (!draft?.points?.length) return;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.setLineDash([5, 4]);
  ctx.beginPath();
  draft.points.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
  if (draft.currentPos) ctx.lineTo(draft.currentPos.x, draft.currentPos.y);
  ctx.stroke();
  draft.points.forEach(([x, y]) => {
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.setLineDash([5, 4]);
  });
  ctx.restore();
}

function drawShapeDraft(ctx, draft, { color, lineWidth, fill }) {
  if (!draft) return;
  const { kind, x0, y0, x1, y1 } = draft;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.setLineDash([4, 4]);
  if (kind === 'line') {
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    ctx.restore(); return;
  }
  const x = Math.min(x0, x1);
  const y = Math.min(y0, y1);
  const w = Math.abs(x1 - x0);
  const h = Math.abs(y1 - y0);
  if (kind === 'curtain') {
    ctx.fillStyle = hexToRgba(color, 0.5); ctx.fillRect(x, y, w, h);
    ctx.strokeRect(x, y, w, h);
    ctx.font = '10px ui-sans-serif,system-ui,sans-serif';
    ctx.fillStyle = hexToRgba(color === '#1f1e1c' ? '#D4AF37' : '#333', 0.7);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('▓ Rideau', x + w / 2, y + h / 2);
    ctx.restore(); return;
  }
  if (kind === 'rect' || kind === 'frame') {
    if (fill || kind === 'frame') { ctx.fillStyle = hexToRgba(color, 0.1); ctx.fillRect(x, y, w, h); }
    ctx.strokeRect(x, y, w, h);
  } else if (kind === 'circle') {
    const cx = x + w / 2; const cy = y + h / 2; const r = Math.min(w, h) / 2;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
    if (fill) { ctx.fillStyle = hexToRgba(color, 0.14); ctx.fill(); }
    ctx.stroke();
  } else if (kind === 'arrow' || kind === 'vector') {
    ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    const angle = Math.atan2(y1 - y0, x1 - x0);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x1 - 12 * Math.cos(angle - Math.PI / 7), y1 - 12 * Math.sin(angle - Math.PI / 7));
    ctx.lineTo(x1 - 12 * Math.cos(angle + Math.PI / 7), y1 - 12 * Math.sin(angle + Math.PI / 7));
    ctx.closePath(); ctx.fillStyle = color; ctx.fill();
    if (kind === 'vector') {
      ctx.beginPath(); ctx.arc(x0, y0, 4, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill();
      const cfg = useLiveWhiteboardStore.getState().schoolConfig;
      const lbl = cfg?.vectorLabel || '';
      if (lbl) {
        ctx.setLineDash([]);
        ctx.font = 'bold italic 14px ui-sans-serif,system-ui,sans-serif';
        ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        const perpX = -Math.sin(angle) * 18; const perpY = Math.cos(angle) * 18;
        ctx.fillText(`${lbl}\u20D7`, (x0 + x1) / 2 + perpX, (y0 + y1) / 2 + perpY);
      }
    }
  } else if (kind === 'function-plot') {
    ctx.setLineDash([3, 3]);
    const len2 = Math.hypot(x1 - x0, y1 - y0);
    const scale = Math.max(10, Math.min(300, len2));
    const cfg = useLiveWhiteboardStore.getState().schoolConfig;
    const xMin2 = cfg?.fnXMin ?? -5; const xMax2 = cfg?.fnXMax ?? 5;
    ctx.beginPath(); ctx.moveTo(x0 + xMin2 * scale, y0); ctx.lineTo(x0 + xMax2 * scale, y0); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x0, y0 - scale * 4); ctx.lineTo(x0, y0 + scale * 2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = '10px ui-sans-serif,system-ui,sans-serif'; ctx.fillStyle = color; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillText(`y = ${cfg?.fnExpr || 'x'}  [${xMin2}, ${xMax2}]  scale=${Math.round(scale)}px`, x0 + 4, y0 + 4);
  } else if (kind === 'segment') {
    ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    const ang = Math.atan2(y1 - y0, x1 - x0);
    const pX = -Math.sin(ang); const pY = Math.cos(ang);
    [[x0, y0], [x1, y1]].forEach(([cx, cy]) => {
      ctx.beginPath(); ctx.moveTo(cx + 6 * pX, cy + 6 * pY); ctx.lineTo(cx - 6 * pX, cy - 6 * pY); ctx.stroke();
    });
    const cfg2 = useLiveWhiteboardStore.getState().schoolConfig;
    const lA = cfg2?.segmentLabelA || 'A'; const lB = cfg2?.segmentLabelB || 'B';
    ctx.font = 'bold 12px ui-sans-serif,system-ui,sans-serif'; ctx.fillStyle = color;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(lA, x0 - Math.cos(ang) * 14, y0 - Math.sin(ang) * 14);
    ctx.fillText(lB, x1 + Math.cos(ang) * 14, y1 + Math.sin(ang) * 14);
  } else if (kind === 'histogram') {
    ctx.strokeRect(x, y, w, h);
    ctx.font = '10px ui-sans-serif,system-ui,sans-serif'; ctx.fillStyle = hexToRgba(color, 0.5);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('Histogramme', x + w / 2, y + h / 2);
  } else if (kind === 'symmetry') {
    ctx.setLineDash([8, 5]);
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = '10px ui-sans-serif,system-ui,sans-serif'; ctx.fillStyle = color;
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.fillText('Axe de symétrie', (x0 + x1) / 2, (y0 + y1) / 2 - 6);
  } else if (kind === 'rotation') {
    ctx.setLineDash([]);
    const ang = Math.atan2(y1 - y0, x1 - x0);
    const radDisp = Math.min(Math.hypot(x1 - x0, y1 - y0), 50);
    ctx.beginPath(); ctx.arc(x0, y0, radDisp, 0, ang, ang < 0); ctx.strokeStyle = hexToRgba(color, 0.5); ctx.lineWidth = 1.5; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0 + radDisp, y0); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    ctx.beginPath(); ctx.arc(x0, y0, 6, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill();
    const deg = Math.round(ang * 180 / Math.PI);
    ctx.font = 'bold 13px ui-sans-serif,system-ui,sans-serif'; ctx.fillStyle = color;
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.fillText(`${deg}°`, x0 + radDisp * Math.cos(ang / 2) + 12, y0 + radDisp * Math.sin(ang / 2) - 6);
  } else if (kind === 'translation') {
    ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    const ang = Math.atan2(y1 - y0, x1 - x0);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x1 - 12 * Math.cos(ang - Math.PI / 7), y1 - 12 * Math.sin(ang - Math.PI / 7));
    ctx.lineTo(x1 - 12 * Math.cos(ang + Math.PI / 7), y1 - 12 * Math.sin(ang + Math.PI / 7));
    ctx.closePath(); ctx.fillStyle = color; ctx.fill();
    ctx.beginPath(); ctx.arc(x0, y0, 5, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill();
    const dx = Math.round(x1 - x0); const dy = Math.round(y1 - y0);
    ctx.font = 'bold 12px ui-sans-serif,system-ui,sans-serif'; ctx.fillStyle = color;
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.fillText(`(${dx}; ${-dy})`, (x0 + x1) / 2, (y0 + y1) / 2 - 8);
    ctx.fillText(`\u20D7u`, (x0 + x1) / 2, (y0 + y1) / 2 - 24);
  } else if (kind === 'pie-chart') {
    ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.arc(x0, y0, Math.max(6, Math.hypot(x1 - x0, y1 - y0)), 0, Math.PI * 2);
    ctx.stroke(); ctx.setLineDash([]);
    ctx.font = '10px ui-sans-serif,system-ui,sans-serif'; ctx.fillStyle = color;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('Camembert', x0, y0);
  } else if (kind === 'scatter-plot') {
    ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(x0 - 40, y0); ctx.lineTo(x0 + 40, y0); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x0, y0 - 40); ctx.lineTo(x0, y0 + 40); ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath(); ctx.arc(x0, y0, 4, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill();
    ctx.font = '10px ui-sans-serif,system-ui,sans-serif'; ctx.fillStyle = color;
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.fillText('Nuage de points', x0, y0 - 44);
  } else if (kind === 'polygon' || kind === 'star') {
    const r = Math.hypot(x1 - x0, y1 - y0);
    const cfg = useLiveWhiteboardStore.getState().schoolConfig;
    const sides = cfg.polygonSides || 6;
    ctx.beginPath();
    for (let i = 0; i < sides; i++) {
      const a = (i / sides) * Math.PI * 2 - Math.PI / 2;
      i === 0 ? ctx.moveTo(x0 + r * Math.cos(a), y0 + r * Math.sin(a))
              : ctx.lineTo(x0 + r * Math.cos(a), y0 + r * Math.sin(a));
    }
    ctx.closePath();
    if (fill) { ctx.fillStyle = hexToRgba(color, 0.14); ctx.fill(); }
    ctx.stroke();
  } else if (kind === 'triangle') {
    const mid = (x0 + x1) / 2;
    ctx.beginPath(); ctx.moveTo(mid, y0); ctx.lineTo(x1, y1); ctx.lineTo(x0, y1); ctx.closePath();
    if (fill) { ctx.fillStyle = hexToRgba(color, 0.14); ctx.fill(); }
    ctx.stroke();
  } else if (kind === 'axes') {
    const sz = Math.max(30, Math.hypot(x1 - x0, y1 - y0));
    ctx.beginPath(); ctx.moveTo(x0 - sz, y0); ctx.lineTo(x0 + sz, y0); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x0, y0 - sz); ctx.lineTo(x0, y0 + sz); ctx.stroke();
  } else if (kind === 'numberline' || kind === 'ruler') {
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  } else if (kind === 'table') {
    ctx.strokeRect(x, y, w, h);
    const cfg = useLiveWhiteboardStore.getState().schoolConfig;
    const cols = cfg.tableCols || 3; const rows = cfg.tableRows || 3;
    const cw = w / cols; const ch = h / rows;
    for (let c = 1; c < cols; c++) {
      ctx.beginPath(); ctx.moveTo(x + c * cw, y); ctx.lineTo(x + c * cw, y + h); ctx.stroke();
    }
    for (let r = 1; r < rows; r++) {
      ctx.beginPath(); ctx.moveTo(x, y + r * ch); ctx.lineTo(x + w, y + r * ch); ctx.stroke();
    }
  } else if (kind === 'protractor') {
    const r = Math.hypot(x1 - x0, y1 - y0);
    ctx.beginPath(); ctx.arc(x0, y0, r, Math.PI, 0, false); ctx.lineTo(x0, y0); ctx.closePath(); ctx.stroke();
  }
  ctx.restore();
}

function mergeBounds(a, b) {
  if (!a) return b;
  if (!b) return a;
  const x1 = Math.min(a.x, b.x);
  const y1 = Math.min(a.y, b.y);
  const x2 = Math.max(a.x + a.w, b.x + b.w);
  const y2 = Math.max(a.y + a.h, b.y + b.h);
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

/** Décodage images raster sur le tableau (traits `kind: 'image'`). */
const boardRasterImageCache = new Map();
const boardImageDecodeListeners = new Set();

function notifyBoardImageDecode() {
  boardImageDecodeListeners.forEach((fn) => {
    try {
      fn();
    } catch {
      /* ignore */
    }
  });
}

/**
 * `crossOrigin = 'anonymous'` uniquement pour des hôtes qui envoient en général les en-têtes CORS
 * (canvas non « tainted » pour export / fusion). Les autres URLs restent sans CORS pour maximiser l'affichage.
 * @param {string} rawUrl
 * @returns {'anonymous' | null}
 */
function boardImageCrossOriginForUrl(rawUrl) {
  const s = String(rawUrl || '').trim();
  if (!/^https?:\/\//i.test(s)) return null;
  try {
    const parsed = new URL(s);
    const h = parsed.hostname.toLowerCase();
    if (h.endsWith('.supabase.co') || h.endsWith('.supabase.in')) return 'anonymous';
    if (h === 'images.unsplash.com' || h.endsWith('.unsplash.com')) return 'anonymous';
    if (h.endsWith('.googleusercontent.com')) return 'anonymous';
    if (h.endsWith('.wikimedia.org') || h.endsWith('.wikipedia.org')) return 'anonymous';
    const base = typeof import.meta !== 'undefined' ? String(import.meta.env?.VITE_SUPABASE_URL || '').trim() : '';
    if (base) {
      try {
        const bh = new URL(base).hostname.toLowerCase();
        if (bh && (h === bh || h.endsWith(`.${bh}`))) return 'anonymous';
      } catch {
        /* ignore */
      }
    }
    return null;
  } catch {
    return null;
  }
}

function getOrDecodeBoardImage(url) {
  const u = String(url || '').trim();
  if (!u) return { ready: false, failed: true, img: null };
  let e = boardRasterImageCache.get(u);
  if (e) return e;
  e = { img: null, ready: false, failed: false };
  const im = new Image();
  e.img = im;
  im.decoding = 'async';
  const cors = boardImageCrossOriginForUrl(u);
  if (cors) {
    try {
      im.crossOrigin = cors;
    } catch {
      /* ignore */
    }
  }
  im.onload = () => {
    e.ready = true;
    e.failed = false;
    notifyBoardImageDecode();
  };
  im.onerror = () => {
    e.ready = false;
    e.failed = true;
    notifyBoardImageDecode();
  };
  try {
    im.referrerPolicy = 'no-referrer';
  } catch {
    /* ignore */
  }
  im.src = u;
  boardRasterImageCache.set(u, e);
  return e;
}

function strokeVisualBounds(ctx, stroke) {
  const k = stroke.kind || 'path';
  if (k === 'group') {
    let acc = null;
    for (const sub of stroke.strokes || []) {
      const b = strokeVisualBounds(ctx, sub);
      if (b) acc = mergeBounds(acc, b);
    }
    return acc;
  }
  if (k === 'path') {
    const pts = stroke.points;
    if (!pts?.length) return null;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    pts.forEach(([x, y]) => {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    });
    const pad = (stroke.isEraser ? stroke.size * 5 : stroke.size) / 2 + 2;
    return { x: minX - pad, y: minY - pad, w: maxX - minX + pad * 2, h: maxY - minY + pad * 2 };
  }
  if (k === 'text') {
    const m = measureWhiteboardTextBlock(ctx, stroke);
    const pad = 4;
    return { x: stroke.x - pad, y: stroke.y - pad, w: m.w, h: m.h };
  }
  if (k === 'rect') {
    const lw = (stroke.lineWidth ?? 2) / 2 + 2;
    const { x, y, w, h } = stroke;
    return { x: x - lw, y: y - lw, w: w + lw * 2, h: h + lw * 2 };
  }
  if (k === 'circle') {
    const r = Math.max(0, stroke.r) + (stroke.lineWidth ?? 2) / 2 + 2;
    return { x: stroke.cx - r, y: stroke.cy - r, w: r * 2, h: r * 2 };
  }
  if (k === 'line') {
    const lw = (stroke.lineWidth ?? 2) / 2 + 6;
    const { x1, y1, x2, y2 } = stroke;
    const minX = Math.min(x1, x2) - lw;
    const minY = Math.min(y1, y2) - lw;
    const maxX = Math.max(x1, x2) + lw;
    const maxY = Math.max(y1, y2) + lw;
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  }
  if (k === 'quadratic') {
    const { x0, y0, cx, cy, x1, y1 } = stroke;
    const pad = (stroke.lineWidth ?? 2) / 2 + 4;
    const xs = [x0, cx, x1];
    const ys = [y0, cy, y1];
    const minX = Math.min(...xs) - pad;
    const minY = Math.min(...ys) - pad;
    const maxX = Math.max(...xs) + pad;
    const maxY = Math.max(...ys) + pad;
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  }
  if (k === 'image') {
    const x = stroke.x ?? 0;
    const y = stroke.y ?? 0;
    const bw = Math.max(1, stroke.width ?? 120);
    const bh = Math.max(1, stroke.height ?? 80);
    return { x, y, w: bw, h: bh };
  }
  if (isSchoolKind(k)) return schoolStrokeVisualBounds(ctx, stroke);
  return null;
}

function drawCurveDraft(ctx, draft, color, lineWidth) {
  if (!draft) return;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.setLineDash([5, 4]);
  if (draft.phase === 1 && draft.px != null) {
    ctx.beginPath();
    ctx.moveTo(draft.x0, draft.y0);
    ctx.lineTo(draft.px, draft.py);
    ctx.stroke();
  } else if (draft.phase === 2 && draft.px != null) {
    ctx.beginPath();
    ctx.moveTo(draft.x0, draft.y0);
    ctx.quadraticCurveTo(draft.cx, draft.cy, draft.px, draft.py);
    ctx.stroke();
  }
  ctx.restore();
}

const BOARD_BG_DARK = '#1f1e1c';
const BOARD_BG_CHALK = '#1a4a3d';
const BOARD_BG_GEOPLAN = '#f8f7f2';
const BOARD_BG_CARREAUX = '#1f1e1c'; // tableau IMMERSIF LIRI (fond sombre chaud + carreaux ambre)

function paintBoardBackground(bgCanvas) {
  if (!bgCanvas?.width) return;
  const ctx = bgCanvas.getContext('2d');
  const surface = useLiveWhiteboardStore.getState().boardSurface || 'dark';
  if (surface === 'chalkboard') {
    ctx.fillStyle = BOARD_BG_CHALK;
    ctx.fillRect(0, 0, bgCanvas.width, bgCanvas.height);
  } else if (surface === 'geoplan') {
    ctx.fillStyle = BOARD_BG_GEOPLAN;
    ctx.fillRect(0, 0, bgCanvas.width, bgCanvas.height);
    /* grille pointée style géoplan français */
    const STEP = 24;
    ctx.fillStyle = 'rgba(220,160,100,0.28)';
    for (let gx = STEP; gx < bgCanvas.width; gx += STEP) {
      for (let gy = STEP; gy < bgCanvas.height; gy += STEP) {
        ctx.beginPath(); ctx.arc(gx, gy, 1.4, 0, Math.PI * 2); ctx.fill();
      }
    }
  } else if (surface === 'carreaux') {
    /* Tableau IMMERSIF LIRI : fond sombre CHAUD + quadrillage AMBRE (cahier
       quadrillé). Le canevas est dimensionné en px CSS (resize sans DPR) → un pas
       de 40px = 40px à l'écran. Carreaux fins 40px + repères forts tous les 200px. */
    const W = bgCanvas.width;
    const H = bgCanvas.height;
    ctx.fillStyle = BOARD_BG_CARREAUX;
    ctx.fillRect(0, 0, W, H);
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(212,163,106,0.13)';
    ctx.beginPath();
    for (let gx = 40; gx < W; gx += 40) { ctx.moveTo(gx + 0.5, 0); ctx.lineTo(gx + 0.5, H); }
    for (let gy = 40; gy < H; gy += 40) { ctx.moveTo(0, gy + 0.5); ctx.lineTo(W, gy + 0.5); }
    ctx.stroke();
    ctx.strokeStyle = 'rgba(212,163,106,0.22)';
    ctx.beginPath();
    for (let gx = 200; gx < W; gx += 200) { ctx.moveTo(gx + 0.5, 0); ctx.lineTo(gx + 0.5, H); }
    for (let gy = 200; gy < H; gy += 200) { ctx.moveTo(0, gy + 0.5); ctx.lineTo(W, gy + 0.5); }
    ctx.stroke();
  } else {
    ctx.fillStyle = BOARD_BG_DARK;
    ctx.fillRect(0, 0, bgCanvas.width, bgCanvas.height);
  }
}

/** `fgCanvas` = calque traits (transparent) ; `bgCanvas` = fond opaque (optionnel si même ref legacy). */
function redrawBoard(fgCanvas, bgCanvas, allStrokes, draft = null, curveDraft = null, marqueeDraft = null, polyDraft = null, viewFit = null) {
  if (!fgCanvas) return;
  if (bgCanvas) paintBoardBackground(bgCanvas);
  const ctx = fgCanvas.getContext('2d');
  ctx.clearRect(0, 0, fgCanvas.width, fgCanvas.height);
  // Recadrage "fit" du VIEWER (lecture seule) : les traits sont stockés en
  // coords-pixels du canvas de l'HÔTE ; sur un buffer plus petit (mobile) ils
  // débordent et sont rognés → invisibles (seul le quadrillage, redessiné plein
  // buffer, reste visible). `viewFit` (calculé côté viewer, cf. flushRedraw) mappe
  // tout le dessin dans le buffer via une transform de contexte ; les traceurs de
  // traits n'utilisant que des transforms RELATIVES, ils composent proprement.
  // HÔTE : viewFit = null → rendu strictement identique (aucune régression).
  const fit = viewFit && viewFit.k > 0;
  if (fit) {
    ctx.save();
    ctx.setTransform(viewFit.k, 0, 0, viewFit.k, viewFit.dx, viewFit.dy);
  }
  allStrokes.forEach((s) => drawOneStroke(ctx, s));
  if (draft) {
    const st = useLiveWhiteboardStore.getState();
    drawShapeDraft(ctx, draft, {
      color: st.color,
      lineWidth: st.size,
      fill: st.shapeFill,
    });
  }
  if (curveDraft) {
    const st = useLiveWhiteboardStore.getState();
    drawCurveDraft(ctx, curveDraft, st.color, st.size);
  }
  const { boardSelection } = useLiveWhiteboardStore.getState();
  if (boardSelection?.length) {
    ctx.save();
    ctx.strokeStyle = 'rgba(212,175,55, 0.92)';
    ctx.setLineDash([5, 4]);
    ctx.lineWidth = 1.5;
    boardSelection.forEach((idx) => {
      const s = allStrokes[idx];
      if (!s) return;
      const b = strokeVisualBounds(ctx, s);
      if (!b) return;
      ctx.strokeRect(b.x - 3, b.y - 3, b.w + 6, b.h + 6);
    });
    ctx.restore();
  }
  if (marqueeDraft) {
    const box = normalizedMarquee(marqueeDraft);
    if (box && (box.w > 0.5 || box.h > 0.5)) {
      ctx.save();
      ctx.strokeStyle = 'rgba(212,175,55, 0.88)';
      ctx.setLineDash([4, 3]);
      ctx.lineWidth = 1.25;
      ctx.strokeRect(box.x, box.y, box.w, box.h);
      ctx.restore();
    }
  }
  if (polyDraft?.points?.length) {
    const st = useLiveWhiteboardStore.getState();
    drawPolyDraft(ctx, polyDraft, st.color || '#fff', st.size || 2);
  }
  if (fit) ctx.restore();
}

/* extended redraw — compass + angle + measure draft overlaid after board strokes */
function redrawBoardWithCompass(fgCanvas, bgCanvas, allStrokes, draft, curveDraft, marqueeDraft, polyDraft, compassDraft, angleDraftVal, measureDraftVal, triFreeDraftVal, viewFit = null) {
  redrawBoard(fgCanvas, bgCanvas, allStrokes, draft, curveDraft, marqueeDraft, polyDraft, viewFit);
  if (!fgCanvas) return;
  const ctx = fgCanvas.getContext('2d');
  const st = useLiveWhiteboardStore.getState();
  if (compassDraft) drawCompassDraft(ctx, compassDraft, st.color || '#d4af37');
  if (angleDraftVal) drawAngleDraft(ctx, angleDraftVal, st.color || '#d4a36a', st.size || 2);
  if (triFreeDraftVal) {
    const d = triFreeDraftVal;
    const col = st.color || '#fff';
    ctx.save();
    ctx.strokeStyle = col; ctx.lineWidth = st.size || 2; ctx.lineCap = 'round'; ctx.setLineDash([5, 4]);
    ctx.beginPath(); ctx.moveTo(d.ax, d.ay); ctx.lineTo(d.cx, d.cy); ctx.stroke();
    if (d.phase === 2) {
      ctx.beginPath(); ctx.moveTo(d.ax, d.ay); ctx.lineTo(d.bx, d.by); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(d.bx, d.by); ctx.lineTo(d.cx, d.cy); ctx.stroke();
    }
    ctx.setLineDash([]);
    [[d.ax, d.ay], d.phase === 2 ? [d.bx, d.by] : null].filter(Boolean).forEach(([px, py]) => {
      ctx.beginPath(); ctx.arc(px, py, 5, 0, Math.PI * 2); ctx.fillStyle = col; ctx.fill();
    });
    ctx.font = 'bold 11px ui-sans-serif,system-ui,sans-serif'; ctx.fillStyle = col;
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.fillText(d.phase === 1 ? 'Clic 2 = B' : 'Clic 3 = C', d.cx, d.cy - 10);
    ctx.restore();
  }
  if (measureDraftVal) {
    const col = st.color || '#D4AF37';
    ctx.save();
    ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.setLineDash([5, 4]);
    ctx.beginPath(); ctx.moveTo(measureDraftVal.x0, measureDraftVal.y0);
    ctx.lineTo(measureDraftVal.cx, measureDraftVal.cy); ctx.stroke();
    ctx.setLineDash([]);
    [[measureDraftVal.x0, measureDraftVal.y0], [measureDraftVal.cx, measureDraftVal.cy]].forEach(([px, py]) => {
      ctx.beginPath(); ctx.arc(px, py, 5, 0, Math.PI * 2); ctx.fillStyle = col; ctx.fill();
    });
    const len = Math.hypot(measureDraftVal.cx - measureDraftVal.x0, measureDraftVal.cy - measureDraftVal.y0);
    const mx = (measureDraftVal.x0 + measureDraftVal.cx) / 2;
    const my = (measureDraftVal.y0 + measureDraftVal.cy) / 2;
    ctx.font = 'bold 12px ui-sans-serif,system-ui,sans-serif';
    const label = `${Math.round(len)} px`;
    const tw = ctx.measureText(label).width + 10;
    ctx.fillStyle = 'rgba(10,11,15,0.8)'; ctx.fillRect(mx - tw / 2, my - 12, tw, 22);
    ctx.fillStyle = col; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(label, mx, my + 1);
    ctx.restore();
  }
}

function distPointSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-12) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const qx = x1 + t * dx;
  const qy = y1 + t * dy;
  return Math.hypot(px - qx, py - qy);
}

function hitTestStrokeDeep(ctx, stroke, px, py) {
  const k = stroke.kind || 'path';
  if (k === 'group') {
    const inner = stroke.strokes || [];
    for (let i = inner.length - 1; i >= 0; i -= 1) {
      if (hitTestStrokeDeep(ctx, inner[i], px, py)) return true;
    }
    return false;
  }
  if (k === 'path') {
    const pts = stroke.points;
    if (!pts?.length) return false;
    if (pts.length === 1) {
      return Math.hypot(px - pts[0][0], py - pts[0][1]) <= Math.max(12, stroke.size);
    }
    const tol = (stroke.isEraser ? stroke.size * 5 : stroke.size) / 2 + 8;
    for (let i = 1; i < pts.length; i += 1) {
      const [xa, ya] = pts[i - 1];
      const [xb, yb] = pts[i];
      if (distPointSegment(px, py, xa, ya, xb, yb) <= tol) return true;
    }
    return false;
  }
  if (k === 'text') return hitTestWhiteboardTextStroke(ctx, stroke, px, py);
  if (k === 'rect') {
    const { x, y, w, h } = stroke;
    return px >= x && px <= x + w && py >= y && py <= y + h;
  }
  if (k === 'circle') {
    const d = Math.hypot(px - stroke.cx, py - stroke.cy);
    return d <= Math.max(0, stroke.r) + 4;
  }
  if (k === 'line') {
    const tol = (stroke.lineWidth ?? 2) / 2 + 8;
    return distPointSegment(px, py, stroke.x1, stroke.y1, stroke.x2, stroke.y2) <= tol;
  }
  if (k === 'quadratic') {
    const {
      x0, y0, cx, cy, x1, y1,
    } = stroke;
    const tol = (stroke.lineWidth ?? 2) / 2 + 10;
    for (let s = 0; s <= 40; s += 1) {
      const t = s / 40;
      const mt = 1 - t;
      const qx = mt * mt * x0 + 2 * mt * t * cx + t * t * x1;
      const qy = mt * mt * y0 + 2 * mt * t * cy + t * t * y1;
      if (s > 0) {
        const pt = (s - 1) / 40;
        const pm = 1 - pt;
        const px0 = pm * pm * x0 + 2 * pm * pt * cx + pt * pt * x1;
        const py0 = pm * pm * y0 + 2 * pm * pt * cy + pt * pt * y1;
        if (distPointSegment(px, py, px0, py0, qx, qy) <= tol) return true;
      }
    }
    return false;
  }
  if (k === 'image') {
    const x = stroke.x ?? 0;
    const y = stroke.y ?? 0;
    const bw = Math.max(1, stroke.width ?? 120);
    const bh = Math.max(1, stroke.height ?? 80);
    return px >= x && px <= x + bw && py >= y && py <= y + bh;
  }
  if (isSchoolKind(k)) return hitTestSchoolStroke(ctx, stroke, px, py);
  return false;
}

function findHitStrokeIndex(ctx, strokes, px, py) {
  for (let i = strokes.length - 1; i >= 0; i -= 1) {
    if (hitTestStrokeDeep(ctx, strokes[i], px, py)) return i;
  }
  return -1;
}

function normalizedMarquee(d) {
  if (!d) return null;
  const x = Math.min(d.x0, d.x1);
  const y = Math.min(d.y0, d.y1);
  const w = Math.abs(d.x1 - d.x0);
  const h = Math.abs(d.y1 - d.y0);
  return { x, y, w, h };
}

function rectsIntersect(a, b) {
  if (!a || !b) return false;
  return (
    a.x < b.x + b.w
    && a.x + a.w > b.x
    && a.y < b.y + b.h
    && a.y + a.h > b.y
  );
}

function indicesIntersectingMarquee(ctx, strokes, rect) {
  if (!rect || rect.w < 1 || rect.h < 1) return [];
  const out = [];
  for (let i = 0; i < strokes.length; i += 1) {
    const b = strokeVisualBounds(ctx, strokes[i]);
    if (b && rectsIntersect(rect, b)) out.push(i);
  }
  return out;
}

function sortedUniqueBoardIndices(strokes, sel) {
  return [...new Set(sel)]
    .filter((i) => typeof i === 'number' && i >= 0 && i < strokes.length)
    .sort((a, b) => a - b);
}

function normalizeArchitectBoardText(title, detail) {
  const a = String(title || '').replace(/\s+/g, ' ').trim();
  const b = String(detail || '').replace(/\s+/g, ' ').trim();
  if (!a && !b) return 'LONGIA · Architect';
  if (!b || b === a) return a.slice(0, 220);
  return `${a} — ${b}`.slice(0, 280);
}

/**
 * @param {Record<string, unknown>} proposal
 * @returns {Array<Record<string, unknown>>}
 */
function buildStrokesFromArchitectProposal(proposal, canvasW, canvasH, fontSize, strokeColor) {
  const type = String(proposal?.type || '').toLowerCase();
  const title = String(proposal?.title || proposal?.label || '').trim();
  const detail = String(proposal?.detail || proposal?.body || '').trim();
  const imageUrl = proposal?.imageUrl;
  const w = Math.max(320, Number(canvasW) || 800);
  const h = Math.max(240, Number(canvasH) || 600);
  const gold = '#D4AF37';
  const fs = Math.max(14, Math.min(28, Number(fontSize) || 20));
  const slot = Math.floor(Date.now() / 200) % 5;
  const x0 = Math.min(w - 48, Math.max(28, w * 0.46 + slot * 8));
  const y0 = Math.min(h - 56, Math.max(40, 56 + slot * (fs * 1.45)));
  const ink = strokeColor || '#F7F2E8';
  const out = [];

  if (type === 'image_idea' && imageUrl && /^https?:\/\//i.test(String(imageUrl))) {
    const imgW = Math.min(300, w - x0 - 20);
    const imgH = Math.max(72, Math.min(220, Math.round(imgW * 0.62)));
    const cap = normalizeArchitectBoardText(title || 'Visuel', detail);
    out.push({
      kind: 'image',
      url: String(imageUrl).trim(),
      x: x0,
      y: y0,
      width: imgW,
      height: imgH,
      opacity: 1,
    });
    if (cap && cap !== 'LONGIA · Architect') {
    out.push({
      kind: 'text',
      x: x0,
      y: y0 + imgH + 6,
      text: cap.slice(0, 180),
      color: ink,
      fontSize: Math.max(11, fs - 3),
      textPreset: 'caption',
    });
    }
    return out;
  }

  const mainText = normalizeArchitectBoardText(title, detail);

  if (type === 'stroke_hint') {
    out.push({
      kind: 'path',
      color: gold,
      size: 2.5,
      isEraser: false,
      points: [
        [x0, y0],
        [x0 + 36, y0 - 14],
        [x0 + 72, y0 + 4],
        [x0 + 110, y0 - 8],
        [x0 + 150, y0 + 6],
      ],
    });
    out.push({
      kind: 'text',
      x: x0,
      y: y0 + 26,
      text: mainText.slice(0, 200),
      color: ink,
      fontSize: Math.max(11, fs - 4),
      textPreset: 'body',
    });
    return out;
  }

  if (type === 'layout' || type === 'visual_mood') {
    const boxW = Math.min(300, w - x0 - 20);
    const boxH = fs * 2.8;
    out.push({
      kind: 'rect',
      x: x0 - 4,
      y: y0 - 4,
      w: boxW,
      h: boxH,
      color: gold,
      lineWidth: 2,
      fill: false,
    });
    out.push({
      kind: 'text',
      x: x0 + 6,
      y: y0 + 6,
      text: mainText.slice(0, 200),
      color: ink,
      fontSize: Math.max(12, fs - 2),
      textPreset: 'subtitle',
    });
    return out;
  }

  out.push({
    kind: 'text',
    x: x0,
    y: y0,
    text: mainText.slice(0, 240),
    color: ink,
    fontSize: fs,
    textPreset: 'body',
  });
  return out;
}

/** 8 positions de poignée pour un bounds {x,y,w,h} */
function getResizeHandles(b) {
  const { x, y, w, h } = b;
  const mx = x + w / 2; const my = y + h / 2;
  return [
    { id: 'tl', x, y },           { id: 'tc', x: mx, y },          { id: 'tr', x: x + w, y },
    { id: 'ml', x, y: my },                                          { id: 'mr', x: x + w, y: my },
    { id: 'bl', x, y: y + h },    { id: 'bc', x: mx, y: y + h },   { id: 'br', x: x + w, y: y + h },
  ];
}
function hitResizeHandle(handles, px, py, tol = 9) {
  for (const h of handles) { if (Math.hypot(px - h.x, py - h.y) <= tol) return h.id; }
  return null;
}
function computeNewBoundsFromHandle(handle, origBounds, dx, dy, proportional = false) {
  let { x, y, w, h } = origBounds;
  if (handle === 'tl' || handle === 'ml' || handle === 'bl') { x += dx; w -= dx; }
  if (handle === 'tr' || handle === 'mr' || handle === 'br') { w += dx; }
  if (handle === 'tl' || handle === 'tc' || handle === 'tr') { y += dy; h -= dy; }
  if (handle === 'bl' || handle === 'bc' || handle === 'br') { h += dy; }
  w = Math.max(4, w); h = Math.max(4, h);
  // Resize PROPORTIONNEL (Shift) sur les poignées de COIN : conserve le ratio d'origine,
  // ancré sur le coin opposé (réflexe Photoshop). Les poignées de bord restent libres.
  const isCorner = handle === 'tl' || handle === 'tr' || handle === 'bl' || handle === 'br';
  if (proportional && isCorner && origBounds.w > 0 && origBounds.h > 0) {
    const ar = origBounds.w / origBounds.h;
    if (w / origBounds.w >= h / origBounds.h) { h = Math.max(4, w / ar); } else { w = Math.max(4, h * ar); }
    const left = handle === 'tl' || handle === 'bl';
    const top = handle === 'tl' || handle === 'tr';
    x = left ? origBounds.x + origBounds.w - w : origBounds.x;
    y = top ? origBounds.y + origBounds.h - h : origBounds.y;
  }
  return { x, y, w, h };
}
const RESIZABLE_KINDS = new Set(['rect', 'circle', 'image', 'polygon', 'star', 'arc', 'axes', 'numberline', 'ruler', 'frame', 'table', 'function-plot', 'histogram', 'value-table', 'pie-chart', 'scatter-plot', 'curtain']);
function applyResizeToStroke(stroke, nb) {
  const { x, y, w, h } = nb;
  const k = stroke.kind || 'path';
  if (k === 'rect' || k === 'frame') return { ...stroke, x, y, w: Math.max(4, w), h: Math.max(4, h) };
  if (k === 'table') {
    const cols = stroke.cols || 3; const rows = stroke.rows || 3;
    return { ...stroke, x, y, cellW: Math.max(12, w / cols), cellH: Math.max(8, h / rows) };
  }
  if (k === 'circle' || k === 'arc') return { ...stroke, cx: x + w / 2, cy: y + h / 2, r: Math.max(4, Math.min(w, h) / 2) };
  if (k === 'image') return { ...stroke, x, y, width: Math.max(12, w), height: Math.max(8, h) };
  if (k === 'polygon' || k === 'star') return { ...stroke, cx: x + w / 2, cy: y + h / 2, r: Math.max(4, Math.min(w, h) / 2) };
  if (k === 'axes') return { ...stroke, cx: x + w / 2, cy: y + h / 2, size: Math.max(20, Math.min(w, h) / 2) };
  if (k === 'numberline' || k === 'ruler') return { ...stroke, x, y: y + h / 2, length: Math.max(20, w) };
  if (k === 'function-plot') {
    const scaleX = Math.max(10, w / Math.max(1, (stroke.xMax || 5) - (stroke.xMin || -5)));
    return { ...stroke, cx: x - (stroke.xMin || -5) * scaleX, cy: y + h / 2, scaleX, scaleY: scaleX };
  }
  if (k === 'histogram') return { ...stroke, x, y, w: Math.max(20, w), h: Math.max(40, h) };
  if (k === 'pie-chart') return { ...stroke, cx: x + w / 2, cy: y + h / 2, r: Math.max(10, Math.min(w, h) / 2) };
  if (k === 'scatter-plot') {
    const sc = Math.max(10, w / Math.max(1, (stroke.xMax || 10) - (stroke.xMin || -2)));
    return { ...stroke, cx: x + w / 2, cy: y + h / 2, scaleX: sc, scaleY: sc };
  }
  if (k === 'curtain') return { ...stroke, x, y, w: Math.max(20, w), h: Math.max(20, h) };
  if (k === 'value-table') {
    const cellW = Math.max(30, Math.round(w / Math.max(1, (stroke.labels?.length || 5) + 1)));
    return { ...stroke, x, y };
  }
  return stroke;
}

function WhiteboardScene({
  strokes: strokesProp = [],
  onStrokesChange,
  readOnly = false,
  onSaveStroke,
  onBroadcast,
  remoteLaserPointer = null,
}) {
  const boardLayerRef = useRef(null);
  const bgCanvasRef = useRef(null);
  const canvasRef = useRef(null);
  const textAreaRef = useRef(null);
  const tool = useLiveWhiteboardStore((s) => s.tool);
  const color = useLiveWhiteboardStore((s) => s.color);
  const size = useLiveWhiteboardStore((s) => s.size);
  const boardSurface = useLiveWhiteboardStore((s) => s.boardSurface);
  const wbTimer = useLiveWhiteboardStore((s) => s.wbTimer);
  const boardPan = useLiveWhiteboardStore((s) => s.boardPan);
  const boardZoom = useLiveWhiteboardStore((s) => s.boardZoom);
  const boardSelection = useLiveWhiteboardStore((s) => s.boardSelection);
  const drawing = useRef(false);
  const lastPos = useRef(null);
  const strokesRef = useRef(Array.isArray(strokesProp) ? strokesProp : []);
  // Miroir de `readOnly` lisible dans flushRedraw (deps stables []). Sert au
  // recadrage "fit" du viewer (les traits de l'hôte doivent tenir dans un buffer
  // plus petit, ex. mobile). Cf. redrawBoard(viewFit).
  const readOnlyRef = useRef(readOnly);
  readOnlyRef.current = readOnly;
  const curStroke = useRef(null);
  const straightLineModifierRef = useRef(false);
  const shapeDraft = useRef(null);
  /** Brouillon courbe quadratique : phase 1 = point de départ, 2 = point de contrôle, puis 3ᵉ clic valide. */
  const curveDraftRef = useRef(null);
  const marqueeDraftRef = useRef(null);
  const marqueeDraggingRef = useRef(false);
  const [boardContextMenu, setBoardContextMenu] = useState(null);
  const textAnchorRef = useRef(null);
  const textPointerIdRef = useRef(null);
  const textClickTimerRef = useRef(null);
  const pendingTextAnchorRef = useRef(null);
  // Garde anti double-commit : passe à true quand la saisie est finalisée (Entrée/Placer/Échap/Annuler)
  // pour que le blur d'unmount qui suit ne re-déclenche PAS commitTextDraft. Reset à l'ouverture d'un draft.
  const textFinalizedRef = useRef(false);
  const [textDraft, setTextDraft] = useState(null);
  /** Position écran de la pop-up texte (portail — au-dessus du rail outils z-51). */
  const [textOverlayScreen, setTextOverlayScreen] = useState({ left: 0, top: 0, scaleX: 1, scaleY: 1, maxWidth: 480 });
  /** Glisser-déposer en mode sélection : { pointerId, x0, y0, snapshot, indices } */
  const boardDragRef = useRef(null);
  const boardDragDidMoveRef = useRef(false);
  const viewPanDragRef = useRef(null);
  const pointerOverBoardRef = useRef(false);
  /** Clic sur le fond sans glisser (crayon / gomme) → bascule outil Sélection, comme PowerPoint / Word objet. */
  const emptyCanvasTapRef = useRef(null);
  const spaceDownRef = useRef(false);
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [viewPanPointerDown, setViewPanPointerDown] = useState(false);
  const [textOverlayAiBusy, setTextOverlayAiBusy] = useState(null);
  /** Compositeur texte MINIMAL par défaut (saisie inline façon Zoom, à l'endroit du clic) ;
   *  mise en forme + presets + IA repliés, révélés À LA DEMANDE via le bouton « Aa ». */
  const [composerToolsOpen, setComposerToolsOpen] = useState(false);
  useEffect(() => {
    // Chaque nouvelle saisie repart en mode minimal (on ne garde pas les outils ouverts).
    if (textDraft) setComposerToolsOpen(false);
  }, [textDraft]);

  const textPreset = useLiveWhiteboardStore((s) => s.textPreset);
  const setTextPreset = useLiveWhiteboardStore((s) => s.setTextPreset);
  const textBold = useLiveWhiteboardStore((s) => s.textBold);
  const setTextBold = useLiveWhiteboardStore((s) => s.setTextBold);
  const textItalic = useLiveWhiteboardStore((s) => s.textItalic);
  const setTextItalic = useLiveWhiteboardStore((s) => s.setTextItalic);
  const textAlign = useLiveWhiteboardStore((s) => s.textAlign);
  const setTextAlign = useLiveWhiteboardStore((s) => s.setTextAlign);
  const setTextFontSize = useLiveWhiteboardStore((s) => s.setTextFontSize);
  const textFontSize = useLiveWhiteboardStore((s) => s.textFontSize);

  // Éditeur de texte « in-place » façon Word : on calque EXACTEMENT le rendu canvas
  // (police, taille mise à l'échelle écran, couleur, interligne 1.25) pour écrire directement
  // sur le tableau — sans cadre. Le fond reprend la couleur de la surface du tableau, ce qui le
  // rend invisible ET masque le bloc en cours d'édition (fini le double affichage en mode edit).
  const textInPlace = useMemo(() => {
    const scaleY = textOverlayScreen.scaleY || 1;
    const fontPx = Math.max(11, (textFontSize || 20) * scaleY);
    const presetBase = WHITEBOARD_TEXT_PRESET_BASE[textPreset] || WHITEBOARD_TEXT_PRESET_BASE.body;
    let weight = presetBase.fontWeight || 400;
    if (textBold) weight = Math.max(weight, 700);
    const surfaceBg =
      boardSurface === 'chalkboard'
        ? BOARD_BG_CHALK
        : boardSurface === 'geoplan'
          ? BOARD_BG_GEOPLAN
          : boardSurface === 'carreaux'
            ? BOARD_BG_CARREAUX
            : BOARD_BG_DARK;
    return {
      fontPx,
      lineHeightPx: fontPx * 1.25,
      weight,
      fontStyle: textItalic ? 'italic' : 'normal',
      textAlign: textAlign === 'center' || textAlign === 'right' ? textAlign : 'left',
      color: color || '#F7F2E8',
      surfaceBg,
      topPx: (textOverlayScreen.top || 0) - fontPx * 0.125,
    };
  }, [textFontSize, textPreset, textBold, textItalic, textAlign, color, boardSurface, textOverlayScreen]);

  const polyDraftRef = useRef(null);
  const compassDraftRef = useRef(null);
  const angleDraftRef = useRef(null);
  const measureDraftRef = useRef(null);
  const triFreeDraftRef = useRef(null);
  const pendingImageRef = useRef(null);
  const [editingStroke, setEditingStroke] = useState(null);
  const [compassSweepAngle, setCompassSweepAngle] = useState(0);
  const [laserPos, setLaserPos] = useState(null);
  const laserThrottleRef = useRef(0);
  /** Poignée de redimensionnement en cours : { handle, strokeIdx, origBounds, origStroke, x0, y0, pointerId } */
  const resizeDraftRef = useRef(null);
  const [resizeRevision, setResizeRevision] = useState(0);

  // Redraw coalescé en 1 frame (requestAnimationFrame). Pendant un geste continu (déplacement,
  // redimensionnement, lasso, tracé de forme), des dizaines de pointermove/s ne déclenchent
  // qu'UN seul redraw complet par frame au lieu d'un redraw O(n traits) à chaque mouvement → fluide.
  // (Le crayon libre dessine de façon incrémentale et ne passe pas par ici.)
  const redrawRafRef = useRef(0);
  const redrawArgsRef = useRef(null);
  const flushRedraw = useCallback(() => {
    redrawRafRef.current = 0;
    const a = redrawArgsRef.current;
    redrawArgsRef.current = null;
    if (!a) return;
    const fg = canvasRef.current;
    // VIEWER (lecture seule) : calcule un recadrage "fit" pour que TOUT le dessin de
    // l'hôte tienne dans le buffer local. Actif UNIQUEMENT si le bbox des traits
    // déborde le buffer (cas mobile : petit canvas → traits hôte rognés). Sur un
    // buffer où tout rentre déjà (desktop) → viewFit reste null → rendu inchangé.
    let viewFit = null;
    if (readOnlyRef.current && fg && Array.isArray(a.strokes) && a.strokes.length) {
      const mctx = fg.getContext('2d');
      let b = null;
      a.strokes.forEach((s) => { if (s) b = mergeBounds(b, strokeVisualBounds(mctx, s)); });
      const W = fg.width;
      const H = fg.height;
      if (b && b.w > 1 && b.h > 1 && W > 2 && H > 2) {
        // Marge confortable : le dessin recadré ne colle jamais aux bords (ni aux
        // pastilles membres qui flottent sur les côtés en mobile). ~9% de la plus
        // petite dimension.
        const pad = Math.max(12, Math.min(W, H) * 0.09);
        // FIT-TO-VIEW : le dessin remplit le canvas du viewer — il AGRANDIT (mode
        // focus / grand écran) autant qu'il RÉDUIT (petit mobile), toujours
        // entièrement visible + centré. Cap l'agrandissement (évite une
        // pixelisation extrême d'un tout petit tracé blown-up).
        const fit = Math.min((W - pad * 2) / b.w, (H - pad * 2) / b.h);
        const k = Math.max(0.02, Math.min(fit, 3.5));
        const cx = b.x + b.w / 2;
        const cy = b.y + b.h / 2;
        viewFit = { k, dx: W / 2 - cx * k, dy: H / 2 - cy * k };
      }
    }
    redrawBoardWithCompass(
      fg, bgCanvasRef.current, a.strokes, a.draft, a.curve, a.marquee,
      polyDraftRef.current, compassDraftRef.current, angleDraftRef.current, measureDraftRef.current, triFreeDraftRef.current,
      viewFit,
    );
  }, []);
  const redrawSheet = useCallback((
    strokes,
    draft = shapeDraft.current,
    curve = curveDraftRef.current,
    marquee = marqueeDraftRef.current,
  ) => {
    redrawArgsRef.current = { strokes, draft, curve, marquee };
    if (redrawRafRef.current) return;
    redrawRafRef.current = typeof requestAnimationFrame === 'function'
      ? requestAnimationFrame(flushRedraw)
      : (flushRedraw(), 0);
  }, [flushRedraw]);

  const paintCanvas = useCallback(() => {
    redrawSheet(strokesRef.current, shapeDraft.current, curveDraftRef.current);
  }, [redrawSheet]);

  useEffect(
    () => () => {
      if (textClickTimerRef.current) window.clearTimeout(textClickTimerRef.current);
      if (redrawRafRef.current && typeof cancelAnimationFrame === 'function') {
        cancelAnimationFrame(redrawRafRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    if (tool !== 'curve') {
      curveDraftRef.current = null;
      redrawSheet(strokesRef.current, shapeDraft.current, null);
    }
    if (tool !== 'compass') {
      compassDraftRef.current = null;
    }
    if (tool !== 'poly') {
      polyDraftRef.current = null;
    }
    if (tool !== 'angle' && tool !== 'right-angle') {
      angleDraftRef.current = null;
    }
    if (tool !== 'measure') {
      measureDraftRef.current = null;
    }
    if (tool !== 'tri-free') {
      triFreeDraftRef.current = null;
    }
    if (tool !== 'image-place') {
      pendingImageRef.current = useLiveWhiteboardStore.getState().pendingImage
        ? pendingImageRef.current
        : null;
    }
  }, [tool, redrawSheet]);

  useEffect(() => {
    if (tool !== 'marquee') {
      marqueeDraftRef.current = null;
      marqueeDraggingRef.current = false;
      redrawSheet(strokesRef.current, null, curveDraftRef.current, null);
    }
  }, [tool, redrawSheet]);

  useLayoutEffect(() => {
    // Ne pas écraser strokesRef pendant une interaction locale : LiveHost (et autres vues)
    // re-render souvent sans changer le tableau ; si `strokesProp` est une nouvelle référence
    // avec le même contenu, ou un tick en retard, le déplacement multi/groupé serait annulé.
    const busy =
      boardDragRef.current
      || marqueeDraggingRef.current
      || drawing.current
      || viewPanDragRef.current
      || shapeDraft.current
      || (curveDraftRef.current && curveDraftRef.current.phase >= 1);
    if (busy) return;
    const next = Array.isArray(strokesProp) ? strokesProp : [];
    strokesRef.current = next;
    const n = next.length;
    const st = useLiveWhiteboardStore.getState();
    if (n !== st.boardStrokeCount) {
      st.emitBoardIaTelemetry({ strokeCount: n });
    }
    const sel = useLiveWhiteboardStore.getState().boardSelection;
    const clamped = sel.filter((i) => typeof i === 'number' && i >= 0 && i < n);
    if (clamped.length !== sel.length) {
      useLiveWhiteboardStore.getState().setBoardSelection(clamped);
    }
    redrawSheet(next, null, curveDraftRef.current);
  }, [strokesProp, redrawSheet]);

  useEffect(() => {
    paintCanvas();
  }, [boardSelection, paintCanvas]);

  useEffect(() => {
    const fn = () => redrawSheet(strokesRef.current);
    boardImageDecodeListeners.add(fn);
    latexDecodeListeners.add(fn);
    return () => {
      boardImageDecodeListeners.delete(fn);
      latexDecodeListeners.delete(fn);
    };
  }, [redrawSheet]);

  const latexPendingRef = useRef(null);

  useEffect(() => {
    if (readOnly) return undefined;
    const onLatexPending = (ev) => {
      const { formula, displayMode } = ev.detail || {};
      if (formula) latexPendingRef.current = { formula, displayMode: displayMode !== false };
    };
    window.addEventListener(LIRI_WB_LATEX_PENDING_EVENT, onLatexPending);
    return () => window.removeEventListener(LIRI_WB_LATEX_PENDING_EVENT, onLatexPending);
  }, [readOnly]);

  /* ── Historique undo/redo (60 étapes) ─────────────────────────────── */
  const undoStackRef = useRef([]);
  const redoStackRef = useRef([]);
  const MAX_UNDO = 60;

  const saveUndoSnapshot = useCallback(() => {
    if (readOnly) return;
    redoStackRef.current = [];
    const snap = cloneStrokesDeep(strokesRef.current);
    if (undoStackRef.current.length >= MAX_UNDO) undoStackRef.current.shift();
    undoStackRef.current.push(snap);
  }, [readOnly]);

  const pushStroke = useCallback(
    (stroke) => {
      saveUndoSnapshot();
      onSaveStroke?.(stroke);
      onStrokesChange?.((prev) => [...(Array.isArray(prev) ? prev : []), stroke]);
      const merged = [...strokesRef.current, stroke];
      strokesRef.current = merged;
      redrawSheet(merged, null, curveDraftRef.current);
    },
    [onSaveStroke, onStrokesChange, redrawSheet, saveUndoSnapshot],
  );

  // Zoom du tableau vers un point écran (curseur ou centre) en gardant ce point fixe — réflexe
  // Figma/Photoshop. boardLayerRef porte le pan ; un enfant porte scale(zoom) origine 0,0.
  const zoomBoardAtPoint = useCallback((targetZoom, clientX, clientY) => {
    const st = useLiveWhiteboardStore.getState();
    const zoom = st.boardZoom || 1;
    const z = Math.min(4, Math.max(0.25, targetZoom));
    if (z === zoom) return;
    const host = boardLayerRef.current;
    const rect = host?.getBoundingClientRect();
    if (rect) {
      const lx = (clientX - rect.left) / zoom;
      const ly = (clientY - rect.top) / zoom;
      st.setBoardPan({ x: st.boardPan.x + lx * (zoom - z), y: st.boardPan.y + ly * (zoom - z) });
    }
    st.setBoardZoom(z);
  }, []);

  // « Tout saisir » : insère une image (File) sur le tableau — collage presse-papiers ou
  // glisser-déposer (façon Photoshop). Dimensionne proportionnellement (plafonné), centre sur
  // le point fourni (drop) ou le centre du tableau (collage), puis sélectionne l'image posée.
  const insertImageFromFile = useCallback((file, atCanvasPos) => {
    if (readOnly || !file || !String(file.type || '').startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result || '');
      if (!url) return;
      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const maxW = Math.min(canvas.width * 0.6, 700);
        const maxH = Math.min(canvas.height * 0.6, 520);
        let w = img.naturalWidth || 240;
        let h = img.naturalHeight || 180;
        const scale = Math.min(1, maxW / w, maxH / h);
        w = Math.max(24, Math.round(w * scale));
        h = Math.max(24, Math.round(h * scale));
        const cx = atCanvasPos ? atCanvasPos.x : canvas.width / 2;
        const cy = atCanvasPos ? atCanvasPos.y : canvas.height / 2;
        pushStroke({ kind: 'image', url, x: cx - w / 2, y: cy - h / 2, width: w, height: h });
        const st = useLiveWhiteboardStore.getState();
        st.setTool('select');
        st.setBoardSelection([strokesRef.current.length - 1]);
      };
      img.src = url;
    };
    reader.readAsDataURL(file);
  }, [readOnly, pushStroke]);

  // Collage d'image système (Ctrl+V) façon Photoshop. Écouteur 'paste' global, ignoré quand on
  // saisit dans un champ texte (laisse le collage texte normal). Le keydown Ctrl+V n'intercepte
  // que si le presse-papiers INTERNE du tableau contient des objets (cf. handler clavier).
  useEffect(() => {
    if (readOnly || typeof window === 'undefined') return undefined;
    const onPaste = (ev) => {
      const ae = document.activeElement;
      if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.tagName === 'SELECT' || ae.isContentEditable)) return;
      const items = ev.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i += 1) {
        if (items[i].type && items[i].type.startsWith('image/')) {
          const file = items[i].getAsFile();
          if (file) { ev.preventDefault(); insertImageFromFile(file, null); return; }
        }
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [readOnly, insertImageFromFile]);

  useEffect(() => {
    if (readOnly || typeof window === 'undefined') return undefined;
    const onArchitectApply = (ev) => {
      if (!onStrokesChange) return;
      const proposal = ev?.detail;
      if (!proposal || typeof proposal !== 'object') return;
      const canvas = canvasRef.current;
      const cw = canvas?.width ?? 800;
      const ch = canvas?.height ?? 600;
      const { color: curColor, textFontSize } = useLiveWhiteboardStore.getState();
      const additions = buildStrokesFromArchitectProposal(proposal, cw, ch, textFontSize, curColor);
      if (!additions.length) return;
      additions.forEach((s) => onSaveStroke?.(s));
      onStrokesChange((prev) => [...(Array.isArray(prev) ? prev : []), ...additions]);
      const merged = [...strokesRef.current, ...additions];
      strokesRef.current = merged;
      redrawSheet(merged, null, curveDraftRef.current);
      const startIdx = merged.length - additions.length;
      useLiveWhiteboardStore.getState().setTool('select');
      useLiveWhiteboardStore.getState().setBoardSelection(
        additions.map((_, i) => startIdx + i),
      );
    };
    window.addEventListener(LIRI_LIVE_ARCHITECT_APPLY, onArchitectApply);
    return () => window.removeEventListener(LIRI_LIVE_ARCHITECT_APPLY, onArchitectApply);
  }, [readOnly, onStrokesChange, onSaveStroke, redrawSheet]);

  const zoomToBoardSelection = useCallback(() => {
    if (readOnly) return;
    const canvas = canvasRef.current;
    const layer = boardLayerRef.current;
    if (!canvas || !layer) return;
    const sel = useLiveWhiteboardStore.getState().boardSelection;
    const strokes = strokesRef.current;
    const idx = sortedUniqueBoardIndices(strokes, sel);
    if (idx.length === 0) return;
    const ctx = canvas.getContext('2d');
    let b = null;
    idx.forEach((i) => {
      const s = strokes[i];
      if (!s) return;
      const bb = strokeVisualBounds(ctx, s);
      b = mergeBounds(b, bb);
    });
    if (!b || b.w < 1 || b.h < 1) return;
    const view = layer.getBoundingClientRect();
    const pad = 24;
    const fit = Math.min((view.width - pad) / b.w, (view.height - pad) / b.h);
    const z = Math.min(24, Math.max(1, fit));
    const cx = b.x + b.w / 2;
    const cy = b.y + b.h / 2;
    useLiveWhiteboardStore.getState().setBoardZoom(z);
    useLiveWhiteboardStore.getState().setBoardPan({
      x: view.width / 2 - cx * z,
      y: view.height / 2 - cy * z,
    });
    redrawSheet(strokesRef.current, null, curveDraftRef.current, null);
  }, [readOnly, redrawSheet]);

  useEffect(() => {
    const layer = boardLayerRef.current;
    if (!layer) return;
    const resize = () => {
      const fg = canvasRef.current;
      const bg = bgCanvasRef.current;
      if (!fg || !bg) return;
      const { width, height } = layer.getBoundingClientRect();
      const w = Math.max(1, Math.floor(width));
      const h = Math.max(1, Math.floor(height));
      fg.width = w;
      fg.height = h;
      bg.width = w;
      bg.height = h;
      redrawSheet(strokesRef.current, null, curveDraftRef.current);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(layer);
    return () => ro.disconnect();
  }, [redrawSheet]);

  useEffect(() => {
    const el = textAreaRef.current;
    if (textDraft && el) {
      textFinalizedRef.current = false; // nouveau draft : réarmer le commit-on-blur
      el.focus();
      // Caret en fin de texte (édition) + hauteur calée sur le contenu (multi-lignes).
      try {
        const end = el.value.length;
        el.setSelectionRange(end, end);
      } catch {
        /* setSelectionRange indisponible */
      }
      el.style.height = 'auto';
      el.style.height = `${el.scrollHeight}px`;
    }
  }, [textDraft]);

  useEffect(() => {
    const st = useLiveWhiteboardStore.getState();
    if (textDraft) {
      st.emitBoardIaTelemetry({ textDraftActive: true, textDraftPreview: '' });
    } else {
      st.emitBoardIaTelemetry({ textDraftActive: false, textDraftPreview: '' });
    }
  }, [textDraft]);

  useEffect(() => {
    if (readOnly) return undefined;
    const typing = (el) =>
      el
      && (el.tagName === 'INPUT'
        || el.tagName === 'TEXTAREA'
        || el.tagName === 'SELECT'
        || el.isContentEditable);
    const onSpaceDown = (ev) => {
      if (ev.code !== 'Space') return;
      if (typing(ev.target)) return;
      if (!pointerOverBoardRef.current) return;
      ev.preventDefault();
      spaceDownRef.current = true;
      setSpaceHeld(true);
    };
    const onSpaceUp = (ev) => {
      if (ev.code === 'Space') {
        spaceDownRef.current = false;
        setSpaceHeld(false);
      }
    };
    window.addEventListener('keydown', onSpaceDown, { passive: false });
    window.addEventListener('keyup', onSpaceUp);
    return () => {
      window.removeEventListener('keydown', onSpaceDown);
      window.removeEventListener('keyup', onSpaceUp);
    };
  }, [readOnly]);

  useEffect(() => {
    paintCanvas();
  }, [boardSurface, paintCanvas]);

  const syncTextOverlayScreen = useCallback(() => {
    const c = canvasRef.current;
    const td = textDraft;
    if (!c || !td) return;
    const r = c.getBoundingClientRect();
    const cw = Math.max(1, c.width);
    const ch = Math.max(1, c.height);
    const sx = r.width / cw;
    const sy = r.height / ch;
    const left = r.left + td.x * sx;
    setTextOverlayScreen({
      left,
      top: r.top + td.y * sy,
      scaleX: sx,
      scaleY: sy,
      maxWidth: Math.max(120, r.right - left - 8),
    });
  }, [textDraft]);

  useLayoutEffect(() => {
    if (!textDraft) return;
    syncTextOverlayScreen();
    const onUpdate = () => syncTextOverlayScreen();
    window.addEventListener('resize', onUpdate);
    window.addEventListener('scroll', onUpdate, true);
    return () => {
      window.removeEventListener('resize', onUpdate);
      window.removeEventListener('scroll', onUpdate, true);
    };
  }, [textDraft, boardPan.x, boardPan.y, syncTextOverlayScreen]);

  useEffect(() => {
    if (readOnly) return undefined;
    const onKey = (ev) => {
      if (ev.defaultPrevented) return;
      const el = ev.target;
      if (
        el
        && (el.tagName === 'INPUT'
          || el.tagName === 'TEXTAREA'
          || el.tagName === 'SELECT'
          || el.isContentEditable)
      ) {
        return;
      }
      const k = ev.key.length === 1 ? ev.key.toLowerCase() : ev.key;
      const ctrlLike = ev.ctrlKey || ev.metaKey;
      if (ctrlLike && !ev.altKey) {
        const st = useLiveWhiteboardStore.getState();
        if (k === '1') {
          ev.preventDefault();
          zoomToBoardSelection();
          return;
        }
        if (k === '0') {
          ev.preventDefault();
          st.resetBoardView(); // Ctrl+0 = vue 100 % recentrée
          return;
        }
        if (k === '=' || k === '+' || k === '-') {
          ev.preventDefault();
          const r = boardLayerRef.current?.parentElement?.getBoundingClientRect();
          const cx = r ? r.left + r.width / 2 : 0;
          const cy = r ? r.top + r.height / 2 : 0;
          zoomBoardAtPoint((st.boardZoom || 1) * (k === '-' ? 0.9 : 1.1), cx, cy);
          return;
        }
        if (k === 'g') {
          ev.preventDefault();
          if (ev.shiftKey) {
            st.ungroupBoardSelection();
          } else {
            st.groupBoardSelection();
          }
          return;
        }
        if (k === 'z' && !ev.shiftKey) {
          ev.preventDefault();
          st.undoBoard();
          return;
        }
        if ((k === 'y' && !ev.shiftKey) || (k === 'z' && ev.shiftKey)) {
          ev.preventDefault();
          st.redoBoard?.();
          return;
        }
        if (k === 'c' && !ev.shiftKey) {
          ev.preventDefault();
          st.copyBoardSelection();
          return;
        }
        if (k === 'v' && !ev.shiftKey) {
          // Ne capter Ctrl+V que si le presse-papiers INTERNE a des objets ; sinon laisser passer
          // le collage natif → l'écouteur 'paste' insère une image système (façon Photoshop).
          const clip = useLiveWhiteboardStore.getState().boardClipboard;
          if (Array.isArray(clip) && clip.length > 0) {
            ev.preventDefault();
            st.pasteBoardClipboard();
          }
          return;
        }
        if (k === 'd' && !ev.shiftKey) {
          ev.preventDefault();
          st.duplicateBoardSelection();
          return;
        }
        if (k === 'x' && !ev.shiftKey) {
          ev.preventDefault();
          st.cutBoardSelection(); // couper = copier + supprimer (réflexe standard), pas juste supprimer
          return;
        }
      }
      if (ev.altKey || ev.metaKey || ev.ctrlKey) return;
      const map = {
        v: 'select',
        h: 'hand',
        p: 'pencil',
        e: 'eraser',
        t: 'text',
        r: 'rect',
        c: 'circle',
        l: 'line',
        u: 'curve',
        m: 'marquee',
      };
        if (map[k]) {
        ev.preventDefault();
        useLiveWhiteboardStore.getState().setTool(map[k]);
        return;
      }
      if (ctrlLike && !ev.altKey && !ev.shiftKey) {
        if (k === ']') { ev.preventDefault(); useLiveWhiteboardStore.getState().bringForward(); return; }
        if (k === '[') { ev.preventDefault(); useLiveWhiteboardStore.getState().sendBackward(); return; }
      }
      if (ctrlLike && !ev.altKey && ev.shiftKey) {
        if (k === ']') { ev.preventDefault(); useLiveWhiteboardStore.getState().bringToFront(); return; }
        if (k === '[') { ev.preventDefault(); useLiveWhiteboardStore.getState().sendToBack(); return; }
      }
      if (k === 'Enter' && polyDraftRef.current) {
        ev.preventDefault();
        const draft = polyDraftRef.current;
        polyDraftRef.current = null;
        if (draft.points.length >= 2) {
          const { color: c, size: lw } = useLiveWhiteboardStore.getState();
          pushStroke({ kind: 'polyline', points: draft.points, color: c, lineWidth: lw, closed: false });
        }
        paintCanvas();
        return;
      }
      if (k === 'Escape') {
        ev.preventDefault();
        setBoardContextMenu(null);
        marqueeDraftRef.current = null;
        marqueeDraggingRef.current = false;
        curveDraftRef.current = null;
        polyDraftRef.current = null;
        compassDraftRef.current = null;
        angleDraftRef.current = null;
        measureDraftRef.current = null;
        triFreeDraftRef.current = null;
        emptyCanvasTapRef.current = null;
        const stEsc = useLiveWhiteboardStore.getState();
        stEsc.setTool('select');
        stEsc.setBoardSelection([]);
        paintCanvas();
        return;
      }
      if (
        (k === 'Delete' || k === 'Backspace')
        && useLiveWhiteboardStore.getState().boardSelection.length > 0
      ) {
        ev.preventDefault();
        useLiveWhiteboardStore.getState().deleteBoardSelection();
        paintCanvas();
        return;
      }
      // Flèches = nudge de la sélection (réflexe Photoshop/Figma). Shift = grand pas (10 px).
      if (k === 'ArrowUp' || k === 'ArrowDown' || k === 'ArrowLeft' || k === 'ArrowRight') {
        const sel = useLiveWhiteboardStore.getState().boardSelection;
        if (Array.isArray(sel) && sel.length > 0) {
          ev.preventDefault();
          const step = ev.shiftKey ? 10 : 1;
          const dx = k === 'ArrowLeft' ? -step : k === 'ArrowRight' ? step : 0;
          const dy = k === 'ArrowUp' ? -step : k === 'ArrowDown' ? step : 0;
          const indices = sortedUniqueBoardIndices(strokesRef.current, sel);
          if (indices.length) {
            saveUndoSnapshot();
            const idxSet = new Set(indices);
            const next = strokesRef.current.map((s, i) => (idxSet.has(i) ? offsetWhiteboardStroke(s, dx, dy) : s));
            strokesRef.current = next;
            paintCanvas();
            onStrokesChange?.(() => cloneStrokesDeep(strokesRef.current));
          }
          return;
        }
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [readOnly, paintCanvas, zoomToBoardSelection, saveUndoSnapshot, onStrokesChange, zoomBoardAtPoint]);

  useEffect(() => {
    const download = () => {
      const fg = canvasRef.current;
      const bg = bgCanvasRef.current;
      if (!fg || !bg || !fg.width) return;
      const merged = document.createElement('canvas');
      merged.width = fg.width;
      merged.height = fg.height;
      const mx = merged.getContext('2d');
      mx.drawImage(bg, 0, 0);
      mx.drawImage(fg, 0, 0);
      const link = document.createElement('a');
      link.download = `whiteboard-${Date.now()}.png`;
      link.href = merged.toDataURL('image/png');
      link.click();
    };

    /** NeuroInk IA — image PNG (base64) du tableau, downscalée pour l'analyse vision. */
    const aiRasterize = () => {
      const fg = canvasRef.current;
      const bg = bgCanvasRef.current;
      if (!fg || !fg.width) return null;
      const srcW = fg.width;
      const srcH = fg.height;
      const maxW = 1280;
      const scale = srcW > maxW ? maxW / srcW : 1;
      const outW = Math.max(1, Math.round(srcW * scale));
      const outH = Math.max(1, Math.round(srcH * scale));
      const merged = document.createElement('canvas');
      merged.width = outW;
      merged.height = outH;
      const mx = merged.getContext('2d');
      if (!mx) return null;
      /* Fond sombre du tableau (l'encre claire reste lisible même sans bg). */
      mx.fillStyle = '#17150f';
      mx.fillRect(0, 0, outW, outH);
      if (bg) mx.drawImage(bg, 0, 0, outW, outH);
      mx.drawImage(fg, 0, 0, outW, outH);
      try {
        return merged.toDataURL('image/png');
      } catch {
        return null;
      }
    };

    /** NeuroInk IA — texte concaténé des blocs `text` du tableau (pour reformulation/architecte). */
    const aiReadBoardText = () => {
      try {
        return (strokesRef.current || [])
          .filter((s) => s && s.kind === 'text' && s.text)
          .map((s) => String(s.text).trim())
          .filter(Boolean)
          .join('\n');
      } catch {
        return '';
      }
    };

    const noop = () => {};
    if (readOnly || !onStrokesChange) {
      useLiveWhiteboardStore.getState().bindBoardActions({
        undo: noop, clear: noop, download, groupBoardSelection: noop,
        ungroupBoardSelection: noop, copyBoardSelection: noop, cutBoardSelection: noop,
        pasteBoardClipboard: noop, duplicateBoardSelection: noop, deleteBoardSelection: noop,
        bringToFront: noop, sendToBack: noop, bringForward: noop, sendBackward: noop,
      });
      return () => {
        useLiveWhiteboardStore.getState().bindBoardActions({
          undo: noop, clear: noop, download: noop, groupBoardSelection: noop,
          ungroupBoardSelection: noop, copyBoardSelection: noop, cutBoardSelection: noop,
          pasteBoardClipboard: noop, duplicateBoardSelection: noop, deleteBoardSelection: noop,
          bringToFront: noop, sendToBack: noop, bringForward: noop, sendBackward: noop,
        });
      };
    }

    const groupBoardSelection = () => {
      const sorted = [...new Set(useLiveWhiteboardStore.getState().boardSelection)]
        .filter((i) => typeof i === 'number' && i >= 0)
        .sort((a, b) => a - b);
      if (sorted.length < 2) return;
      saveUndoSnapshot();
      onStrokesChange((prev) => {
        const p = [...(Array.isArray(prev) ? prev : [])];
        const maxIdx = p.length - 1;
        if (sorted.some((i) => i > maxIdx)) return p;
        const picked = sorted.map((i) => p[i]);
        for (let j = sorted.length - 1; j >= 0; j -= 1) {
          p.splice(sorted[j], 1);
        }
        const insertAt = sorted[0];
        p.splice(insertAt, 0, { kind: 'group', strokes: picked });
        return p;
      });
      useLiveWhiteboardStore.getState().setBoardSelection([sorted[0]]);
    };

    const ungroupBoardSelection = () => {
      const sel = useLiveWhiteboardStore.getState().boardSelection;
      if (sel.length !== 1) return;
      const idx = sel[0];
      saveUndoSnapshot();
      onStrokesChange((prev) => {
        const p = [...(Array.isArray(prev) ? prev : [])];
        const s = p[idx];
        if (!s || s.kind !== 'group' || !Array.isArray(s.strokes) || s.strokes.length === 0) return p;
        const inner = [...s.strokes];
        const n = inner.length;
        p.splice(idx, 1, ...inner);
        queueMicrotask(() => {
          useLiveWhiteboardStore.getState().setTool('select');
          useLiveWhiteboardStore.getState().setBoardSelection(
            Array.from({ length: n }, (_, j) => idx + j),
          );
        });
        return p;
      });
    };

    const copyBoardSelection = () => {
      const sel = useLiveWhiteboardStore.getState().boardSelection;
      const strokes = strokesRef.current;
      const idx = sortedUniqueBoardIndices(strokes, sel);
      if (idx.length === 0) return;
      useLiveWhiteboardStore.getState().setBoardClipboard(cloneStrokesDeep(idx.map((i) => strokes[i])));
    };

    const cutBoardSelection = () => {
      const sel = useLiveWhiteboardStore.getState().boardSelection;
      const strokes = strokesRef.current;
      const idx = sortedUniqueBoardIndices(strokes, sel);
      if (idx.length === 0) return;
      saveUndoSnapshot();
      useLiveWhiteboardStore.getState().setBoardClipboard(cloneStrokesDeep(idx.map((i) => strokes[i])));
      const sortedDesc = [...idx].sort((a, b) => b - a);
      onStrokesChange((prev) => {
        const p = [...(Array.isArray(prev) ? prev : [])];
        sortedDesc.forEach((i) => {
          p.splice(i, 1);
        });
        return p;
      });
      useLiveWhiteboardStore.getState().setBoardSelection([]);
    };

    const pasteBoardClipboard = () => {
      const clip = useLiveWhiteboardStore.getState().boardClipboard;
      if (!Array.isArray(clip) || clip.length === 0) return;
      saveUndoSnapshot();
      const shifted = offsetWhiteboardStrokes(cloneStrokesDeep(clip), 14, 14);
      onStrokesChange((prev) => [...(Array.isArray(prev) ? prev : []), ...shifted]);
    };

    const duplicateBoardSelection = () => {
      const sel = useLiveWhiteboardStore.getState().boardSelection;
      const strokes = strokesRef.current;
      const idx = sortedUniqueBoardIndices(strokes, sel);
      if (idx.length === 0) return;
      saveUndoSnapshot();
      const dup = offsetWhiteboardStrokes(cloneStrokesDeep(idx.map((i) => strokes[i])), 22, 22);
      onStrokesChange((prev) => [...(Array.isArray(prev) ? prev : []), ...dup]);
    };

    const deleteBoardSelection = () => {
      const sel = useLiveWhiteboardStore.getState().boardSelection;
      const strokes = strokesRef.current;
      const idx = sortedUniqueBoardIndices(strokes, sel);
      if (idx.length === 0) return;
      saveUndoSnapshot();
      const sortedDesc = [...idx].sort((a, b) => b - a);
      onStrokesChange((prev) => {
        const p = [...(Array.isArray(prev) ? prev : [])];
        sortedDesc.forEach((i) => {
          p.splice(i, 1);
        });
        return p;
      });
      useLiveWhiteboardStore.getState().setBoardSelection([]);
    };

    const bringToFront = () => {
      const sel = sortedUniqueBoardIndices(strokesRef.current, useLiveWhiteboardStore.getState().boardSelection);
      if (!sel.length) return;
      saveUndoSnapshot();
      onStrokesChange((prev) => {
        const p = [...(Array.isArray(prev) ? prev : [])];
        const items = sel.map((i) => p[i]);
        const filtered = p.filter((_, i) => !sel.includes(i));
        filtered.push(...items);
        queueMicrotask(() => {
          useLiveWhiteboardStore.getState().setTool('select');
          useLiveWhiteboardStore.getState().setBoardSelection(
            Array.from({ length: items.length }, (_, j) => filtered.length - items.length + j),
          );
        });
        return filtered;
      });
    };

    const sendToBack = () => {
      const sel = sortedUniqueBoardIndices(strokesRef.current, useLiveWhiteboardStore.getState().boardSelection);
      if (!sel.length) return;
      saveUndoSnapshot();
      onStrokesChange((prev) => {
        const p = [...(Array.isArray(prev) ? prev : [])];
        const items = sel.map((i) => p[i]);
        const filtered = p.filter((_, i) => !sel.includes(i));
        filtered.unshift(...items);
        queueMicrotask(() => {
          useLiveWhiteboardStore.getState().setTool('select');
          useLiveWhiteboardStore.getState().setBoardSelection(
            Array.from({ length: items.length }, (_, j) => j),
          );
        });
        return filtered;
      });
    };

    const bringForward = () => {
      const sel = sortedUniqueBoardIndices(strokesRef.current, useLiveWhiteboardStore.getState().boardSelection);
      if (sel.length !== 1) { bringToFront(); return; }
      const idx = sel[0];
      saveUndoSnapshot();
      onStrokesChange((prev) => {
        const p = [...(Array.isArray(prev) ? prev : [])];
        if (idx >= p.length - 1) return p;
        const next = [...p];
        [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
        queueMicrotask(() => useLiveWhiteboardStore.getState().setBoardSelection([idx + 1]));
        return next;
      });
    };

    const sendBackward = () => {
      const sel = sortedUniqueBoardIndices(strokesRef.current, useLiveWhiteboardStore.getState().boardSelection);
      if (sel.length !== 1) { sendToBack(); return; }
      const idx = sel[0];
      saveUndoSnapshot();
      onStrokesChange((prev) => {
        const p = [...(Array.isArray(prev) ? prev : [])];
        if (idx <= 0) return p;
        const next = [...p];
        [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
        queueMicrotask(() => useLiveWhiteboardStore.getState().setBoardSelection([idx - 1]));
        return next;
      });
    };

    useLiveWhiteboardStore.getState().bindBoardActions({
      undo: () => {
        if (undoStackRef.current.length === 0) return;
        const snapshot = undoStackRef.current.pop();
        redoStackRef.current.push(cloneStrokesDeep(strokesRef.current));
        strokesRef.current = snapshot;
        redrawSheet(snapshot, null, curveDraftRef.current);
        onStrokesChange(snapshot);
        useLiveWhiteboardStore.getState().setBoardSelection([]);
      },
      redo: () => {
        if (redoStackRef.current.length === 0) return;
        const snapshot = redoStackRef.current.pop();
        undoStackRef.current.push(cloneStrokesDeep(strokesRef.current));
        strokesRef.current = snapshot;
        redrawSheet(snapshot, null, curveDraftRef.current);
        onStrokesChange(snapshot);
        useLiveWhiteboardStore.getState().setBoardSelection([]);
      },
      clear: () => {
        saveUndoSnapshot();
        onStrokesChange([]);
        useLiveWhiteboardStore.getState().setBoardSelection([]);
        useLiveWhiteboardStore.getState().resetBoardView();
      },
      download,
      aiRasterize,
      aiReadBoardText,
      groupBoardSelection,
      ungroupBoardSelection,
      copyBoardSelection,
      cutBoardSelection,
      pasteBoardClipboard,
      duplicateBoardSelection,
      deleteBoardSelection,
      bringToFront,
      sendToBack,
      bringForward,
      sendBackward,
      ...(() => {
        const alignStrokes = (dir) => {
          const sel = useLiveWhiteboardStore.getState().boardSelection;
          if (sel.length < 2) return;
          const canvas = canvasRef.current; if (!canvas) return;
          const ctx2 = canvas.getContext('2d');
          const strokes = strokesRef.current;
          const items = sel.map((i) => {
            const st = strokes[i]; if (!st) return null;
            const b = strokeVisualBounds(ctx2, st);
            return b ? { idx: i, st, b } : null;
          }).filter(Boolean);
          if (items.length < 2) return;
          const allL = items.map((it) => it.b.x);
          const allR = items.map((it) => it.b.x + it.b.w);
          const allT = items.map((it) => it.b.y);
          const allBo = items.map((it) => it.b.y + it.b.h);
          const minL = Math.min(...allL); const maxR = Math.max(...allR);
          const minT = Math.min(...allT); const maxBo = Math.max(...allBo);
          const cH = (minL + maxR) / 2; const cV = (minT + maxBo) / 2;
          saveUndoSnapshot();
          const next = [...strokes];
          if (dir === 'distributeH') {
            const sorted = [...items].sort((a, b2) => a.b.x - b2.b.x);
            const totalGap = maxR - minL - sorted.reduce((acc, it) => acc + it.b.w, 0);
            const gap = totalGap / Math.max(1, sorted.length - 1);
            let cursor = minL;
            sorted.forEach((it) => { next[it.idx] = offsetWhiteboardStroke(it.st, cursor - it.b.x, 0); cursor += it.b.w + gap; });
          } else if (dir === 'distributeV') {
            const sorted = [...items].sort((a, b2) => a.b.y - b2.b.y);
            const totalGap = maxBo - minT - sorted.reduce((acc, it) => acc + it.b.h, 0);
            const gap = totalGap / Math.max(1, sorted.length - 1);
            let cursor = minT;
            sorted.forEach((it) => { next[it.idx] = offsetWhiteboardStroke(it.st, 0, cursor - it.b.y); cursor += it.b.h + gap; });
          } else {
            items.forEach(({ idx, st: ist, b }) => {
              let dx = 0; let dy = 0;
              if (dir === 'left') dx = minL - b.x;
              else if (dir === 'right') dx = maxR - (b.x + b.w);
              else if (dir === 'centerH') dx = cH - (b.x + b.w / 2);
              else if (dir === 'top') dy = minT - b.y;
              else if (dir === 'bottom') dy = maxBo - (b.y + b.h);
              else if (dir === 'centerV') dy = cV - (b.y + b.h / 2);
              if (dx !== 0 || dy !== 0) next[idx] = offsetWhiteboardStroke(ist, dx, dy);
            });
          }
          strokesRef.current = next;
          onStrokesChange?.(() => cloneStrokesDeep(next));
          redrawSheet(next);
        };
        return {
          alignLeft: () => alignStrokes('left'),
          alignRight: () => alignStrokes('right'),
          alignCenterH: () => alignStrokes('centerH'),
          alignTop: () => alignStrokes('top'),
          alignBottom: () => alignStrokes('bottom'),
          alignCenterV: () => alignStrokes('centerV'),
          distributeH: () => alignStrokes('distributeH'),
          distributeV: () => alignStrokes('distributeV'),
        };
      })(),
      updateStrokeProperties: (patch) => {
        const sel = useLiveWhiteboardStore.getState().boardSelection;
        if (!sel.length || !patch) return;
        saveUndoSnapshot();
        const next = strokesRef.current.map((s, i) => {
          if (!sel.includes(i)) return s;
          const applied = {};
          if ('color' in patch) applied.color = patch.color;
          if ('lineWidth' in patch) applied.lineWidth = patch.lineWidth;
          if ('size' in patch && (s.kind === 'path' || s.kind === undefined)) applied.size = patch.size;
          if ('fontSize' in patch && s.kind === 'text') applied.fontSize = patch.fontSize;
          if ('text' in patch && s.kind === 'text') applied.text = patch.text;
          if ('opacity' in patch && s.kind === 'curtain') applied.opacity = patch.opacity;
          if ('fillColor' in patch) applied.fillColor = patch.fillColor;
          if ('fill' in patch) applied.fill = patch.fill;
          return { ...s, ...applied };
        });
        strokesRef.current = next;
        onStrokesChange?.(() => cloneStrokesDeep(next));
        redrawSheet(next);
        /* re-sync selectedStrokeInfo */
        const first = next[sel[0]];
        if (first) useLiveWhiteboardStore.getState().setSelectedStrokeInfo({
          color: first.color || '#ffffff',
          lineWidth: first.lineWidth || first.size || 2,
          kind: first.kind || 'path',
          opacity: first.opacity,
          text: first.kind === 'text' ? (first.text || '') : undefined,
          index: sel[0],
        });
      },
    });
    return () => {
      useLiveWhiteboardStore.getState().bindBoardActions({
        undo: () => {},
        clear: noop, download: noop, groupBoardSelection: noop, ungroupBoardSelection: noop,
        copyBoardSelection: noop, cutBoardSelection: noop, pasteBoardClipboard: noop,
        duplicateBoardSelection: noop, deleteBoardSelection: noop,
        bringToFront: noop, sendToBack: noop, bringForward: noop, sendBackward: noop,
        updateStrokeProperties: noop,
        aiRasterize: noop, aiReadBoardText: noop,
        alignLeft: noop, alignRight: noop, alignCenterH: noop,
        alignTop: noop, alignBottom: noop, alignCenterV: noop,
        distributeH: noop, distributeV: noop,
      });
    };
  }, [readOnly, onStrokesChange, saveUndoSnapshot, redrawSheet]);

  /* Timer tick */
  useEffect(() => {
    if (!wbTimer?.running) return;
    const interval = setInterval(() => {
      const cur = useLiveWhiteboardStore.getState().wbTimer;
      if (!cur.running) { clearInterval(interval); return; }
      const next = Math.max(0, cur.remainingSec - 1);
      useLiveWhiteboardStore.getState().setWbTimer({ remainingSec: next, running: next > 0 });
    }, 1000);
    return () => clearInterval(interval);
  }, [wbTimer?.running]);

  /* Synchronise selectedStrokeInfo quand la sélection change */
  useEffect(() => {
    if (boardSelection.length >= 1) {
      const s = strokesRef.current[boardSelection[0]];
      if (s) {
        useLiveWhiteboardStore.getState().setSelectedStrokeInfo({
          color: s.color || '#ffffff',
          lineWidth: s.lineWidth || s.size || 2,
          kind: s.kind || 'path',
          opacity: s.opacity ?? undefined,
          text: s.kind === 'text' ? (s.text || '') : undefined,
          index: boardSelection[0],
        });
        return;
      }
    }
    useLiveWhiteboardStore.getState().setSelectedStrokeInfo(null);
  }, [boardSelection]);

  function getPos(e, canvas) {
    const rect = canvas.getBoundingClientRect();
    const sx = canvas.width / Math.max(1, rect.width);
    const sy = canvas.height / Math.max(1, rect.height);
    let x = (e.clientX - rect.left) * sx;
    let y = (e.clientY - rect.top) * sy;
    const st = useLiveWhiteboardStore.getState();
    if (st.snapToGrid) {
      const gs = st.gridSize || 24;
      x = Math.round(x / gs) * gs;
      y = Math.round(y / gs) * gs;
    }
    return { x, y };
  }

  const replaceBoardTextAt = useCallback(
    (idx, newText) => {
      const apply = (prev) => {
        const p = [...(Array.isArray(prev) ? prev : [])];
        if (idx < 0 || idx >= p.length) return p;
        const s = p[idx];
        if (!s || s.kind !== 'text') return p;
        p[idx] = { ...s, text: String(newText || '').slice(0, 2000) };
        return p;
      };
      const next = apply(strokesRef.current);
      strokesRef.current = next;
      redrawSheet(next, null, curveDraftRef.current);
      onStrokesChange?.(apply);
    },
    [onStrokesChange, redrawSheet],
  );

  const updateBoardTextStyleAt = useCallback(
    (idx, partial) => {
      if (!partial || typeof partial !== 'object') return;
      const apply = (prev) => {
        const p = [...(Array.isArray(prev) ? prev : [])];
        if (idx < 0 || idx >= p.length) return p;
        const s = p[idx];
        if (!s || s.kind !== 'text') return p;
        p[idx] = { ...s, ...partial };
        return p;
      };
      const next = apply(strokesRef.current);
      strokesRef.current = next;
      redrawSheet(next, null, curveDraftRef.current);
      onStrokesChange?.(apply);
    },
    [onStrokesChange, redrawSheet],
  );

  const runOverlayTextAi = useCallback(async (mode) => {
    const el = textAreaRef.current;
    if (!el) return;
    const slice = String(el.value || '').trim();
    if (!slice) return;
    setTextOverlayAiBusy(mode);
    try {
      const next = await invokeWhiteboardTextAi(slice, mode, 'en');
      el.value = next.slice(0, 2000);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    } catch (err) {
      window.alert(err?.message || 'IA indisponible');
    } finally {
      setTextOverlayAiBusy(null);
    }
  }, []);

  const handleBoardContextMenu = useCallback(
    (e) => {
      if (readOnly || textDraft) return;
      e.preventDefault();
      e.stopPropagation();
      const canvas = canvasRef.current;
      if (!canvas) return;
      const pos = getPos(e, canvas);
      const ctx = canvas.getContext('2d');
      const hit = findHitStrokeIndex(ctx, strokesRef.current, pos.x, pos.y);
      if (hit >= 0) {
        const prev = useLiveWhiteboardStore.getState().boardSelection;
        if (e.shiftKey || e.ctrlKey || e.metaKey) {
          const next = prev.includes(hit)
            ? prev.filter((i) => i !== hit)
            : [...prev, hit].sort((a, b) => a - b);
          useLiveWhiteboardStore.getState().setBoardSelection(next);
        } else {
          useLiveWhiteboardStore.getState().setBoardSelection([hit]);
        }
      }
      redrawSheet(strokesRef.current, null, curveDraftRef.current, null);
      const hitStroke = hit >= 0 ? strokesRef.current[hit] : null;
      setBoardContextMenu({
        x: e.clientX,
        y: e.clientY,
        hit,
        hitKind: hitStroke?.kind || null,
        hitText: hitStroke?.kind === 'text' ? String(hitStroke.text || '') : '',
      });
    },
    [readOnly, textDraft, redrawSheet],
  );

  const commitShape = useCallback(() => {
    const draft = shapeDraft.current;
    if (!draft) return null;
    const { color: c, size: lw, shapeFill, schoolConfig, boardFillColor, boardFillColorEnabled } = useLiveWhiteboardStore.getState();
    const fillColorProp = boardFillColorEnabled && boardFillColor ? boardFillColor : undefined;
    const { kind, x0, y0 } = draft;
    let { x1, y1 } = draft;
    // CLIC SIMPLE = TAMPON : sans glisser (len ~0), chaque forme a un seuil `len < N`
    // qui renvoyait null → un simple clic ne posait RIEN (« outils figés »). On pose
    // désormais une taille par défaut au point cliqué. Le GLISSER reste inchangé.
    if (Math.hypot(x1 - x0, y1 - y0) < 6) {
      const linear = kind === 'line' || kind === 'arrow' || kind === 'vector' || kind === 'segment';
      const D = linear ? 140 : 120;
      x1 = x0 + D;
      y1 = y0 + (linear ? 0 : D);
    }
    const len = Math.hypot(x1 - x0, y1 - y0);

    if (kind === 'line') {
      if (len < 3) return null;
      return { kind: 'line', x1: x0, y1: y0, x2: x1, y2: y1, color: c, lineWidth: lw };
    }
    if (kind === 'arrow') {
      if (len < 4) return null;
      return { kind: 'arrow', x1: x0, y1: y0, x2: x1, y2: y1, color: c, lineWidth: lw, doubleArrow: schoolConfig?.arrowDouble || false };
    }
    if (kind === 'vector') {
      if (len < 4) return null;
      return { kind: 'vector', x1: x0, y1: y0, x2: x1, y2: y1, color: c, lineWidth: lw, label: schoolConfig?.vectorLabel || '' };
    }
    if (kind === 'function-plot') {
      const scale = Math.max(10, Math.min(300, len));
      const cfg = schoolConfig || {};
      return {
        kind: 'function-plot',
        cx: x0, cy: y0,
        scaleX: scale, scaleY: scale,
        xMin: cfg.fnXMin ?? -5, xMax: cfg.fnXMax ?? 5,
        color: c, lineWidth: lw,
        expr: cfg.fnExpr || 'x',
      };
    }
    if (kind === 'segment') {
      if (len < 4) return null;
      return {
        kind: 'segment', x1: x0, y1: y0, x2: x1, y2: y1, color: c, lineWidth: lw,
        labelA: schoolConfig?.segmentLabelA ?? 'A',
        labelB: schoolConfig?.segmentLabelB ?? 'B',
        style: schoolConfig?.segmentStyle || 'segment',
        showLength: schoolConfig?.segmentShowLength || false,
        tickCount: schoolConfig?.segmentTickCount || 0,
      };
    }
    if (kind === 'histogram') {
      if (len < 20) return null;
      const cfg = schoolConfig || {};
      const rawLabels = (cfg.histLabels || 'A,B,C').split(',').map((s) => s.trim()).filter(Boolean);
      const rawValues = (cfg.histValues || '3,5,4').split(',').map((s) => Number(s.trim())).filter((n) => !isNaN(n));
      const n = Math.max(rawLabels.length, rawValues.length);
      const labels = Array.from({ length: n }, (_, i) => rawLabels[i] ?? String(i + 1));
      const values = Array.from({ length: n }, (_, i) => rawValues[i] ?? 0);
      return {
        kind: 'histogram',
        x: Math.min(x0, x1), y: Math.min(y0, y1),
        w: Math.abs(x1 - x0), h: Math.abs(y1 - y0),
        labels, values,
        title: cfg.histTitle || '',
        color: c, lineWidth: lw,
      };
    }
    if (kind === 'symmetry') {
      return { kind: 'symmetry', x0, y0, x1, y1, _special: true };
    }
    if (kind === 'rotation') {
      return { kind: 'rotation', x0, y0, x1, y1, _special: true };
    }
    if (kind === 'translation') {
      return { kind: 'translation', x0, y0, x1, y1, _special: true };
    }
    if (kind === 'pie-chart') {
      if (len < 10) return null;
      const cfg = schoolConfig || {};
      const rawLabels = (cfg.pieLabels || 'A,B,C').split(',').map((s) => s.trim()).filter(Boolean);
      const rawValues = (cfg.pieValues || '1,1,1').split(',').map((s) => Number(s.trim())).filter((n) => !isNaN(n));
      const n = Math.max(rawLabels.length, rawValues.length);
      return {
        kind: 'pie-chart', cx: x0, cy: y0, r: len,
        labels: Array.from({ length: n }, (_, i) => rawLabels[i] ?? String(i + 1)),
        values: Array.from({ length: n }, (_, i) => rawValues[i] ?? 0),
        title: cfg.pieTitle || '', color: c, lineWidth: lw,
      };
    }
    if (kind === 'scatter-plot') {
      if (len < 10) return null;
      const cfg = schoolConfig || {};
      const scale = Math.max(10, Math.min(200, len / Math.max(1, (cfg.scatterXMax || 10) - (cfg.scatterXMin || -2))));
      const rawData = (cfg.scatterData || '').split(';').map((pair) => {
        const parts = pair.trim().split(',');
        const xv = parseFloat(parts[0]); const yv = parseFloat(parts[1]);
        return isFinite(xv) && isFinite(yv) ? { x: xv, y: yv, label: parts[2]?.trim() || '' } : null;
      }).filter(Boolean);
      return {
        kind: 'scatter-plot', cx: x0, cy: y0,
        scaleX: scale, scaleY: scale,
        xMin: cfg.scatterXMin ?? -2, xMax: cfg.scatterXMax ?? 10,
        data: rawData,
        connectDots: cfg.scatterConnect || false,
        showAxes: true, title: cfg.scatterTitle || '',
        color: c, lineWidth: lw,
      };
    }
    if (kind === 'polygon') {
      if (len < 6) return null;
      return { kind: 'polygon', cx: x0, cy: y0, r: len, sides: schoolConfig?.polygonSides || 6, color: c, lineWidth: lw, fill: shapeFill, ...(fillColorProp ? { fillColor: fillColorProp } : {}) };
    }
    if (kind === 'star') {
      if (len < 6) return null;
      return { kind: 'star', cx: x0, cy: y0, outerR: len, points: schoolConfig?.starPoints || 5, color: c, lineWidth: lw, fill: shapeFill, ...(fillColorProp ? { fillColor: fillColorProp } : {}) };
    }
    if (kind === 'triangle') {
      if (len < 4) return null;
      const mid = (x0 + x1) / 2;
      return { kind: 'triangle', x0: mid, y0, x1, y1, x2: x0, y2: y1, color: c, lineWidth: lw, fill: shapeFill, ...(fillColorProp ? { fillColor: fillColorProp } : {}) };
    }
    if (kind === 'axes') {
      const sz = Math.max(40, len);
      return { kind: 'axes', cx: x0, cy: y0, size: sz, color: c, lineWidth: lw, showLabels: true };
    }
    if (kind === 'numberline') {
      if (len < 10) return null;
      const cfg = schoolConfig || {};
      return { kind: 'numberline', x: x0, y: y0, length: len, min: cfg.numberlineMin || 0, max: cfg.numberlineMax || 10, step: cfg.numberlineStep || 1, color: c, lineWidth: lw, showLabels: true };
    }
    if (kind === 'ruler') {
      if (len < 10) return null;
      return { kind: 'ruler', x: x0, y: y0, length: len, angle: Math.atan2(y1 - y0, x1 - x0), color: c, lineWidth: lw };
    }
    if (kind === 'protractor') {
      if (len < 10) return null;
      return { kind: 'protractor', cx: x0, cy: y0, r: len, color: c, lineWidth: lw };
    }

    const x = Math.min(x0, x1);
    const y = Math.min(y0, y1);
    const w = Math.abs(x1 - x0);
    const h = Math.abs(y1 - y0);
    if (w < 3 && h < 3) return null;

    if (kind === 'rect') {
      return { kind: 'rect', x, y, w, h, color: c, lineWidth: lw, fill: shapeFill, ...(fillColorProp ? { fillColor: fillColorProp } : {}) };
    }
    if (kind === 'circle') {
      const cx = x + w / 2; const cy = y + h / 2; const r = Math.min(w, h) / 2;
      return { kind: 'circle', cx, cy, r, color: c, lineWidth: lw, fill: shapeFill, ...(fillColorProp ? { fillColor: fillColorProp } : {}) };
    }
    if (kind === 'frame') {
      return { kind: 'frame', x, y, w, h, label: 'Cadre', color: c || '#d4a36a', lineWidth: lw };
    }
    if (kind === 'table') {
      const cfg = schoolConfig || {};
      const cols = cfg.tableCols || 3; const rows = cfg.tableRows || 3;
      const cellW = Math.max(20, w / cols); const cellH = Math.max(14, h / rows);
      return { kind: 'table', x, y, cols, rows, cellW, cellH, color: c, lineWidth: lw };
    }
    if (kind === 'curtain') {
      if (w < 4 && h < 4) return null;
      const surface = useLiveWhiteboardStore.getState().boardSurface || 'dark';
      const bgColor = surface === 'chalkboard' ? '#1a4a3d' : surface === 'geoplan' ? '#f8f7f2' : surface === 'carreaux' ? '#1f1e1c' : '#1f1e1c';
      return { kind: 'curtain', x, y, w: Math.max(20, w), h: Math.max(20, h), color: bgColor, opacity: 0.97 };
    }
    return null;
  }, []);

  const endPathStroke = useCallback(() => {
    if (!drawing.current || !curStroke.current) return;
    const forceStraightLine = straightLineModifierRef.current;
    drawing.current = false;
    straightLineModifierRef.current = false;
    const canvas = canvasRef.current;
    let stroke = curStroke.current;
    curStroke.current = null;
    const minPts = stroke.isEraser ? 1 : 2;
    if (!stroke.points || stroke.points.length < minPts) {
      redrawSheet(strokesRef.current, null, curveDraftRef.current);
      return;
    }
    const neuroInk = useLiveWhiteboardStore.getState().neuroInk;
    const ink = mergeNeuroInkWithDomain(neuroInk, LIRI_INK_EDIT_DOMAIN.SKETCH);
    if (canvas && !stroke.isEraser && stroke.kind === 'path') {
      const refined = applyNeuroInkToFreePoints(stroke.points, ink, canvas.width, canvas.height, {
        forceStraightLine,
      });
      if (refined.length >= 2) {
        stroke = { ...stroke, points: refined };
      }
    }
    pushStroke(stroke);
  }, [pushStroke, redrawSheet]);

  const commitTextDraft = useCallback(() => {
    if (!textDraft || readOnly) return;
    textFinalizedRef.current = true; // empêche le blur d'unmount de re-committer
    const el = textAreaRef.current;
    const raw = el?.value ?? '';
    const t = String(raw).trim();
    const draft = textDraft;
    saveUndoSnapshot();
    setTextDraft(null);
    const stText = useLiveWhiteboardStore.getState();
    const {
      color: textColor,
      textFontSize,
      textPreset,
      textBold,
      textItalic,
      textAlign,
    } = stText;
    const canvas = canvasRef.current;

    if (draft.mode === 'edit') {
      const idx = draft.index;
      const apply = (prev) => {
        const p = [...(Array.isArray(prev) ? prev : [])];
        if (idx < 0 || idx >= p.length) return p;
        if (!t) {
          return p.filter((_, j) => j !== idx);
        }
        return p.map((s, j) =>
          j === idx
            ? {
              ...s,
              text: t,
              color: textColor,
              fontSize: textFontSize,
              textPreset,
              textBold,
              fontStyle: textItalic ? 'italic' : 'normal',
              textAlign,
            }
            : s,
        );
      };
      const next = apply(strokesRef.current);
      strokesRef.current = next;
      redrawSheet(next, null, curveDraftRef.current);
      onStrokesChange?.(apply);
      return;
    }

    if (!t) return;
    pushStroke({
      kind: 'text',
      x: draft.x,
      y: draft.y,
      text: t,
      color: textColor,
      fontSize: textFontSize,
      textPreset,
      textBold,
      fontStyle: textItalic ? 'italic' : 'normal',
      textAlign,
    });
  }, [textDraft, readOnly, pushStroke, onStrokesChange, redrawSheet]);

  const handleCanvasDoubleClick = useCallback(
    (e) => {
      if (readOnly || textDraft) return;
      if (textClickTimerRef.current) {
        window.clearTimeout(textClickTimerRef.current);
        textClickTimerRef.current = null;
      }
      pendingTextAnchorRef.current = null;

      if (angleDraftRef.current) {
        e.preventDefault();
        angleDraftRef.current = null;
        redrawSheet(strokesRef.current, null, curveDraftRef.current, null);
        return;
      }

      if (polyDraftRef.current) {
        e.preventDefault();
        const draft = polyDraftRef.current;
        polyDraftRef.current = null;
        const pts = draft.points.slice(0, -1);
        if (pts.length >= 2) {
          const { color: c, size: lw } = useLiveWhiteboardStore.getState();
          pushStroke({ kind: 'polyline', points: pts, color: c, lineWidth: lw, closed: false });
        }
        redrawSheet(strokesRef.current, null, curveDraftRef.current, null);
        return;
      }
      const canvas = canvasRef.current;
      if (!canvas) return;
      const pos = getPos(e, canvas);
      const ctx = canvas.getContext('2d');
      const list = strokesRef.current;

      /* ── Double-clic sur un trait scolaire = ouvrir l'éditeur ─────────── */
      for (let i = list.length - 1; i >= 0; i -= 1) {
        const s = list[i];
        if (isSchoolKind(s.kind) && hitTestSchoolStroke(ctx, s, pos.x, pos.y)) {
          e.preventDefault();
          setEditingStroke({ index: i, stroke: { ...s } });
          return;
        }
      }

      for (let i = list.length - 1; i >= 0; i -= 1) {
        const s = list[i];
        if (hitTestWhiteboardTextStroke(ctx, s, pos.x, pos.y)) {
          e.preventDefault();
          const wb = useLiveWhiteboardStore.getState();
          wb.setTextPreset(s.textPreset || 'body');
          wb.setTextBold(s.textBold === true);
          wb.setTextItalic(s.fontStyle === 'italic');
          wb.setTextAlign(s.textAlign === 'center' || s.textAlign === 'right' ? s.textAlign : 'left');
          if (typeof s.fontSize === 'number') wb.setTextFontSize(s.fontSize);
          wb.setColor(s.color || wb.color);
          setTextDraft({
            mode: 'edit',
            index: i,
            x: s.x,
            y: s.y,
            initialText: s.text || '',
          });
          return;
        }
      }
      const hit = findHitStrokeIndex(ctx, list, pos.x, pos.y);
      if (hit >= 0) {
        e.preventDefault();
        useLiveWhiteboardStore.getState().setTool('select');
        useLiveWhiteboardStore.getState().setBoardSelection([hit]);
        redrawSheet(list, null, curveDraftRef.current);
        return;
      }
      e.preventDefault();
      useLiveWhiteboardStore.getState().setTool('marquee');
      useLiveWhiteboardStore.getState().setBoardSelection([]);
      redrawSheet(list, null, curveDraftRef.current, null);
    },
    [readOnly, textDraft, redrawSheet],
  );

  const handlePointerDown = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas || readOnly || textDraft) return;
    const st0 = useLiveWhiteboardStore.getState();
    const { tool: t } = st0;
    const wantViewPan = t === 'hand' || (spaceDownRef.current && t !== 'text');
    if (wantViewPan) {
      e.preventDefault();
      viewPanDragRef.current = {
        pointerId: e.pointerId,
        sx: e.clientX,
        sy: e.clientY,
        ox: st0.boardPan.x,
        oy: st0.boardPan.y,
      };
      setViewPanPointerDown(true);
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      return;
    }

    /* Resize handle hit-test (before normal select) */
    if (t === 'select') {
      const selNow = useLiveWhiteboardStore.getState().boardSelection;
      if (selNow.length === 1) {
        const sIdx = selNow[0];
        const sStroke = strokesRef.current[sIdx];
        if (sStroke && RESIZABLE_KINDS.has(sStroke.kind || 'path')) {
          const ctx = canvas.getContext('2d');
          const b = strokeVisualBounds(ctx, sStroke);
          if (b) {
            const pos = getPos(e, canvas);
            const hId = hitResizeHandle(getResizeHandles(b), pos.x, pos.y);
            if (hId) {
              e.preventDefault();
              saveUndoSnapshot();
              resizeDraftRef.current = {
                handle: hId,
                strokeIdx: sIdx,
                origBounds: b,
                origStroke: sStroke,
                x0: pos.x, y0: pos.y,
                pointerId: e.pointerId,
              };
              try { canvas.setPointerCapture(e.pointerId); } catch { /* */ }
              return;
            }
          }
        }
      }
    }

    if (t === 'select') {
      e.preventDefault();
      const pos = getPos(e, canvas);
      const ctx = canvas.getContext('2d');
      const hit = findHitStrokeIndex(ctx, strokesRef.current, pos.x, pos.y);
      const additive = e.shiftKey || e.ctrlKey || e.metaKey;
      const prev = useLiveWhiteboardStore.getState().boardSelection;
      let next;
      if (hit < 0) {
        next = additive ? prev : [];
      } else if (additive) {
        next = prev.includes(hit)
          ? prev.filter((i) => i !== hit)
          : [...prev, hit].sort((a, b) => a - b);
      } else {
        next = [hit];
      }
      useLiveWhiteboardStore.getState().setBoardSelection(next);
      redrawSheet(strokesRef.current, null, curveDraftRef.current);
      if (hit >= 0 && next.includes(hit)) {
        boardDragDidMoveRef.current = false;
        boardDragRef.current = {
          pointerId: e.pointerId,
          x0: pos.x,
          y0: pos.y,
          snapshot: cloneStrokesDeep(strokesRef.current),
          indices: sortedUniqueBoardIndices(strokesRef.current, next),
        };
        try {
          canvas.setPointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
      } else if (hit < 0 && !additive) {
        // Réflexe Figma/Photoshop : glisser sur le vide en mode Sélection = lasso (marquee),
        // sans changer d'outil. Un simple clic (sans glisser) reste une désélection (cf. pointerUp).
        setBoardContextMenu(null);
        marqueeDraggingRef.current = true;
        marqueeDraftRef.current = { x0: pos.x, y0: pos.y, x1: pos.x, y1: pos.y };
        try {
          canvas.setPointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
      }
      return;
    }

    if (t === 'marquee') {
      e.preventDefault();
      setBoardContextMenu(null);
      const pos = getPos(e, canvas);
      useLiveWhiteboardStore.getState().setBoardSelection([]);
      marqueeDraggingRef.current = true;
      marqueeDraftRef.current = { x0: pos.x, y0: pos.y, x1: pos.x, y1: pos.y };
      redrawSheet(strokesRef.current, null, curveDraftRef.current, marqueeDraftRef.current);
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      return;
    }

    if (t === 'curve') {
      e.preventDefault();
      const pos = getPos(e, canvas);
      const d = curveDraftRef.current;
      const { color: qc, size: qlw } = useLiveWhiteboardStore.getState();
      if (!d) {
        curveDraftRef.current = { phase: 1, x0: pos.x, y0: pos.y, px: pos.x, py: pos.y };
      } else if (d.phase === 1) {
        curveDraftRef.current = {
          phase: 2,
          x0: d.x0,
          y0: d.y0,
          cx: pos.x,
          cy: pos.y,
          px: pos.x,
          py: pos.y,
        };
      } else if (d.phase === 2) {
        const len = Math.hypot(pos.x - d.x0, pos.y - d.y0);
        if (len >= 4) {
          pushStroke({
            kind: 'quadratic',
            x0: d.x0,
            y0: d.y0,
            cx: d.cx,
            cy: d.cy,
            x1: pos.x,
            y1: pos.y,
            color: qc,
            lineWidth: qlw,
          });
        }
        curveDraftRef.current = null;
      }
      redrawSheet(strokesRef.current, null, curveDraftRef.current);
      return;
    }

    if (t === 'text') {
      e.preventDefault();
      textAnchorRef.current = getPos(e, canvas);
      textPointerIdRef.current = e.pointerId;
      canvas.setPointerCapture(e.pointerId);
      return;
    }

    if (t === 'fraction') {
      e.preventDefault();
      const pos = getPos(e, canvas);
      const { color: c, size: lw, schoolConfig } = useLiveWhiteboardStore.getState();
      pushStroke({
        kind: 'fraction',
        x: pos.x, y: pos.y,
        numerator: schoolConfig?.fracNumerator ?? 1,
        denominator: schoolConfig?.fracDenominator ?? 4,
        style: schoolConfig?.fracStyle || 'bar',
        cellSize: schoolConfig?.fracCellSize ?? 32,
        color: c, lineWidth: lw,
      });
      return;
    }

    if (t === 'value-table') {
      e.preventDefault();
      const pos = getPos(e, canvas);
      const { color: c, size: lw, schoolConfig } = useLiveWhiteboardStore.getState();
      pushStroke({
        kind: 'value-table',
        x: pos.x, y: pos.y,
        expr: schoolConfig?.vtExpr || 'x',
        xMin: schoolConfig?.vtXMin ?? -3,
        xMax: schoolConfig?.vtXMax ?? 3,
        xStep: schoolConfig?.vtXStep ?? 1,
        color: c, lineWidth: lw,
      });
      return;
    }

    if (t === 'measure') {
      e.preventDefault();
      const pos = getPos(e, canvas);
      const d = measureDraftRef.current;
      if (!d) {
        measureDraftRef.current = { phase: 1, x0: pos.x, y0: pos.y, cx: pos.x, cy: pos.y };
      } else {
        const { color: c, size: lw, schoolConfig } = useLiveWhiteboardStore.getState();
        pushStroke({ kind: 'measure', x1: d.x0, y1: d.y0, x2: pos.x, y2: pos.y, color: c, lineWidth: lw, label: schoolConfig?.measureLabel || '' });
        measureDraftRef.current = null;
        useLiveWhiteboardStore.getState().setTool('select');
      }
      redrawSheet(strokesRef.current, null, curveDraftRef.current, null);
      return;
    }

    if (t === 'tri-free') {
      e.preventDefault();
      const pos = getPos(e, canvas);
      const d = triFreeDraftRef.current;
      if (!d) {
        triFreeDraftRef.current = { phase: 1, ax: pos.x, ay: pos.y, cx: pos.x, cy: pos.y };
      } else if (d.phase === 1) {
        triFreeDraftRef.current = { ...d, phase: 2, bx: pos.x, by: pos.y, cx: pos.x, cy: pos.y };
      } else if (d.phase === 2) {
        const { color: c, size: lw, shapeFill } = useLiveWhiteboardStore.getState();
        pushStroke({ kind: 'triangle', x0: d.ax, y0: d.ay, x1: d.bx, y1: d.by, x2: pos.x, y2: pos.y, color: c, lineWidth: lw, fill: shapeFill });
        triFreeDraftRef.current = null;
        useLiveWhiteboardStore.getState().setTool('select');
      }
      redrawSheet(strokesRef.current, null, curveDraftRef.current, null);
      return;
    }

    if (t === 'image-place') {
      e.preventDefault();
      const pos = getPos(e, canvas);
      const pending = pendingImageRef.current || useLiveWhiteboardStore.getState().pendingImage;
      if (pending?.url) {
        pushStroke({ kind: 'image', url: pending.url, x: pos.x - (pending.w || 200) / 2, y: pos.y - (pending.h || 150) / 2, width: pending.w || 200, height: pending.h || 150 });
        pendingImageRef.current = null;
        useLiveWhiteboardStore.getState().setPendingImage(null);
        useLiveWhiteboardStore.getState().setTool('select');
      }
      return;
    }

    if (t === 'eraser-stroke') {
      e.preventDefault();
      const pos = getPos(e, canvas);
      const ctx2 = canvas.getContext('2d');
      const idx = findHitStrokeIndex(ctx2, strokesRef.current, pos.x, pos.y);
      if (idx >= 0) {
        saveUndoSnapshot();
        const next = strokesRef.current.filter((_, i) => i !== idx);
        strokesRef.current = next;
        onStrokesChange?.(() => cloneStrokesDeep(next));
        redrawSheet(next, null, curveDraftRef.current);
      }
      return;
    }

    if (t === 'template-place') {
      e.preventDefault();
      const pos = getPos(e, canvas);
      const tpl = useLiveWhiteboardStore.getState().pendingTemplate;
      if (tpl?.create) {
        const { color: c, size: lw } = useLiveWhiteboardStore.getState();
        const strokes = tpl.create(pos.x, pos.y, c, lw);
        saveUndoSnapshot();
        const next = [...strokesRef.current, ...strokes];
        strokesRef.current = next;
        onStrokesChange?.(() => cloneStrokesDeep(next));
        redrawSheet(next, null, curveDraftRef.current);
        useLiveWhiteboardStore.getState().setPendingTemplate(null);
        useLiveWhiteboardStore.getState().setTool('select');
      }
      return;
    }

    if (t === 'homothetie') {
      e.preventDefault();
      const pos = getPos(e, canvas);
      const { boardSelection, schoolConfig } = useLiveWhiteboardStore.getState();
      const indices = boardSelection.length > 0 ? boardSelection : [];
      if (indices.length > 0) {
        const k = parseFloat(schoolConfig?.homothetieRatio) || 2;
        saveUndoSnapshot();
        const next = strokesRef.current.map((st, i) =>
          indices.includes(i) && st.kind !== 'group' ? scaleStroke(st, pos.x, pos.y, k) : st,
        );
        strokesRef.current = next;
        onStrokesChange?.(() => cloneStrokesDeep(next));
        redrawSheet(next, null, curveDraftRef.current);
        useLiveWhiteboardStore.getState().setTool('select');
      }
      return;
    }

    if (t === 'electric-component') {
      e.preventDefault();
      const pos = getPos(e, canvas);
      const { color: c, size: lw, schoolConfig } = useLiveWhiteboardStore.getState();
      const cfg = schoolConfig || {};
      pushStroke({
        kind: 'electric-component',
        cx: pos.x, cy: pos.y,
        component: cfg.electricComp || 'resistor',
        size: cfg.electricSize ?? 50,
        angle: (cfg.electricAngle ?? 0) * Math.PI / 180,
        label: cfg.electricLabel || '',
        color: c, lineWidth: lw,
      });
      return;
    }

    if (t === 'sign-table') {
      e.preventDefault();
      const pos = getPos(e, canvas);
      const { color: c, size: lw, schoolConfig } = useLiveWhiteboardStore.getState();
      const cfg = schoolConfig || {};
      const xValues = (cfg.signXVals || '-∞, -1, 0, 2, +∞').split(',').map((v) => v.trim());
      const rows = (cfg.signRows || '(x+1): -, 0, +, +, +, +, +').split('\n').map((line) => {
        const colonIdx = line.indexOf(':');
        if (colonIdx < 0) return null;
        const label = line.slice(0, colonIdx).trim();
        const signs = line.slice(colonIdx + 1).split(',').map((v) => v.trim());
        const isFinal = label.toLowerCase().includes('produit') || label.toLowerCase().includes('quotient') || label.includes('f(x)');
        return { label, signs, isFinal };
      }).filter(Boolean);
      pushStroke({ kind: 'sign-table', x: pos.x, y: pos.y, xValues, rows, color: c, lineWidth: lw });
      return;
    }

    if (t === 'prob-tree') {
      e.preventDefault();
      const pos = getPos(e, canvas);
      const { color: c, size: lw, schoolConfig } = useLiveWhiteboardStore.getState();
      const cfg = schoolConfig || {};
      const parseBranches = (str) => (str || '').split(',').map((item) => {
        const parts = item.trim().split(':');
        return { label: (parts[0] || '').trim(), p: (parts[1] || '').trim() };
      }).filter((b) => b.label);
      const l1 = parseBranches(cfg.probL1 || 'A:0.3, Ā:0.7');
      const l2Keys = ['probL2A', 'probL2B', 'probL2C', 'probL2D'];
      const l2 = l1.map((_, i) => parseBranches(cfg[l2Keys[i]] || (i === 0 ? 'B:0.4, B̄:0.6' : 'B:0.2, B̄:0.8')));
      pushStroke({
        kind: 'prob-tree',
        x: pos.x, y: pos.y,
        l1, l2,
        showProducts: cfg.probShowProducts !== false,
        color: c, lineWidth: lw,
      });
      return;
    }

    if (t === 'variation-table') {
      e.preventDefault();
      const pos = getPos(e, canvas);
      const { color: c, size: lw, schoolConfig } = useLiveWhiteboardStore.getState();
      const cfg = schoolConfig || {};
      const parseArr = (str) => (str || '').split(',').map((v) => v.trim());
      const parseBool = (str) => parseArr(str).map((v) => v.toLowerCase() !== 'false');
      pushStroke({
        kind: 'variation-table',
        x: pos.x, y: pos.y,
        functionName: cfg.vtFnName || 'f',
        xValues: parseArr(cfg.vtXVals || '-∞, 1, +∞'),
        derivSigns: parseArr(cfg.vtDerivSigns || '+, -'),
        critFValues: parseArr(cfg.vtCritFVals || '3'),
        increasing: parseBool(cfg.vtIncreasing || 'true, false'),
        boundaryFValues: parseArr(cfg.vtBoundaryFVals || ', '),
        color: c, lineWidth: lw,
      });
      return;
    }

    const SHAPE_TOOLS = ['rect', 'circle', 'line', 'arrow', 'vector', 'polygon', 'star', 'triangle', 'frame', 'axes', 'numberline', 'ruler', 'protractor', 'table', 'function-plot', 'segment', 'histogram', 'symmetry', 'rotation', 'translation', 'pie-chart', 'scatter-plot', 'curtain'];
    if (SHAPE_TOOLS.includes(t)) {
      e.preventDefault();
      const pos = getPos(e, canvas);
      shapeDraft.current = { kind: t, x0: pos.x, y0: pos.y, x1: pos.x, y1: pos.y };
      drawing.current = true;
      canvas.setPointerCapture(e.pointerId);
      return;
    }

    if (t === 'poly') {
      e.preventDefault();
      const pos = getPos(e, canvas);
      if (!polyDraftRef.current) {
        polyDraftRef.current = { points: [[pos.x, pos.y]], currentPos: { x: pos.x, y: pos.y } };
      } else {
        polyDraftRef.current = {
          points: [...polyDraftRef.current.points, [pos.x, pos.y]],
          currentPos: { x: pos.x, y: pos.y },
        };
      }
      redrawSheet(strokesRef.current, null, curveDraftRef.current, null);
      return;
    }

    if (t === 'compass') {
      e.preventDefault();
      const pos = getPos(e, canvas);
      const { schoolConfig } = useLiveWhiteboardStore.getState();
      const arcMode = schoolConfig?.arcMode === true;
      const existingDraft = compassDraftRef.current;
      if (!existingDraft || existingDraft.phase === 'idle') {
        /* Phase 1 : clic pour poser le centre du compas */
        compassDraftRef.current = {
          cx: pos.x, cy: pos.y, r: 0,
          startAngle: 0, currentAngle: 0,
          arcMode, phase: 'radius',
          pointerId: e.pointerId,
        };
        try { canvas.setPointerCapture(e.pointerId); } catch { /* */ }
      } else if (existingDraft.phase === 'radius' && existingDraft.r > 6 && arcMode) {
        /* Phase 2 (arc mode) : 2e clic commence le tracé de l'arc */
        const a = Math.atan2(pos.y - existingDraft.cy, pos.x - existingDraft.cx);
        compassDraftRef.current = { ...existingDraft, phase: 'draw', startAngle: a, currentAngle: a };
      }
      redrawSheet(strokesRef.current, null, curveDraftRef.current, null);
      return;
    }

    if (t === 'coord-point') {
      e.preventDefault();
      const pos = getPos(e, canvas);
      const { color: c, size, schoolConfig } = useLiveWhiteboardStore.getState();
      const allStrokes = strokesRef.current;
      let nearestAxes = null; let bestDist = Infinity;
      for (const s of allStrokes) {
        if (s.kind === 'axes') {
          const d = Math.hypot(pos.x - (s.cx || 0), pos.y - (s.cy || 0));
          if (d < bestDist) { bestDist = d; nearestAxes = s; }
        }
      }
      let xVal = null; let yVal = null; let cx = pos.x; let cy = pos.y;
      if (nearestAxes && bestDist < (nearestAxes.size || 150) * 2.5) {
        const tick = nearestAxes.tickStep || 30;
        xVal = Math.round((pos.x - nearestAxes.cx) / tick * 10) / 10;
        yVal = Math.round((nearestAxes.cy - pos.y) / tick * 10) / 10;
        cx = nearestAxes.cx; cy = nearestAxes.cy;
      }
      const labelBase = String.fromCharCode(65 + (allStrokes.filter((s) => s.kind === 'coord-point').length % 26));
      pushStroke({ kind: 'coord-point', x: pos.x, y: pos.y, label: labelBase, xVal, yVal, cx, cy, color: c, fontSize: Math.max(12, size * 5 || 14) });
      return;
    }

    if (t === 'angle' || t === 'right-angle') {
      e.preventDefault();
      const pos = getPos(e, canvas);
      const d = angleDraftRef.current;
      if (!d || d.phase === 0) {
        angleDraftRef.current = { kind: t, phase: 1, vx: pos.x, vy: pos.y, cx: pos.x, cy: pos.y };
      } else if (d.phase === 1) {
        angleDraftRef.current = { ...d, phase: 2, ax: pos.x, ay: pos.y, cx: pos.x, cy: pos.y };
      } else if (d.phase === 2) {
        /* Commit */
        const { color: c, size: lw, schoolConfig } = useLiveWhiteboardStore.getState();
        const isRight = d.kind === 'right-angle';
        if (isRight) {
          const lenA = Math.hypot(d.ax - d.vx, d.ay - d.vy) || 1;
          const dAX = (d.ax - d.vx) / lenA; const dAY = (d.ay - d.vy) / lenA;
          pushStroke({ kind: 'angle-mark', vx: d.vx, vy: d.vy, ax: d.ax, ay: d.ay, bx: d.vx - dAY * lenA, by: d.vy + dAX * lenA, color: c, lineWidth: lw, rightAngle: true, showDegrees: true, label: '90°' });
        } else {
          pushStroke({ kind: 'angle-mark', vx: d.vx, vy: d.vy, ax: d.ax, ay: d.ay, bx: pos.x, by: pos.y, color: c, lineWidth: lw, rightAngle: false, showDegrees: schoolConfig?.showAngleDegrees !== false });
        }
        angleDraftRef.current = null;
        useLiveWhiteboardStore.getState().setTool('select');
        redrawSheet(strokesRef.current, null, curveDraftRef.current, null);
      }
      redrawSheet(strokesRef.current, null, curveDraftRef.current, null);
      return;
    }

    if (t === 'latex') {
      e.preventDefault();
      const pos = getPos(e, canvas);
      const pending = latexPendingRef.current;
      if (pending?.formula) {
        const { color: c, size } = useLiveWhiteboardStore.getState();
        pushStroke({ kind: 'latex', x: pos.x, y: pos.y, formula: pending.formula, displayMode: pending.displayMode, color: c, fontSize: Math.max(14, size * 6) });
        latexPendingRef.current = null;
        useLiveWhiteboardStore.getState().setTool('select');
        useLiveWhiteboardStore.getState().setPendingLatex(null);
      }
      return;
    }

    if (t !== 'pencil' && t !== 'eraser') return;
    e.preventDefault();
    const strokePos = getPos(e, canvas);
    const sctx = canvas.getContext('2d');
    const hitEmpty = findHitStrokeIndex(sctx, strokesRef.current, strokePos.x, strokePos.y) < 0;
    emptyCanvasTapRef.current = hitEmpty ? { x0: strokePos.x, y0: strokePos.y } : null;
    canvas.setPointerCapture(e.pointerId);
    drawing.current = true;
    straightLineModifierRef.current = isStraightLineModifier(e);
    const { color: strokeColor, size: strokeSize } = useLiveWhiteboardStore.getState();
    const pos = strokePos;
    lastPos.current = pos;
    curStroke.current = {
      kind: 'path',
      color: strokeColor,
      size: strokeSize,
      isEraser: t === 'eraser',
      points: [[pos.x, pos.y]],
    };
  }, [readOnly, textDraft, redrawSheet, pushStroke]);

  const handlePointerMove = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas || readOnly) return;

    if (polyDraftRef.current && !viewPanDragRef.current) {
      const pos = getPos(e, canvas);
      polyDraftRef.current = { ...polyDraftRef.current, currentPos: pos };
      redrawSheet(strokesRef.current, null, curveDraftRef.current, null);
    }

    if (resizeDraftRef.current && e.pointerId === resizeDraftRef.current.pointerId) {
      e.preventDefault();
      const pos = getPos(e, canvas);
      const rd = resizeDraftRef.current;
      const dx = pos.x - rd.x0; const dy = pos.y - rd.y0;
      const nb = computeNewBoundsFromHandle(rd.handle, rd.origBounds, dx, dy, e.shiftKey);
      const newStroke = applyResizeToStroke(rd.origStroke, nb);
      const next = [...strokesRef.current];
      next[rd.strokeIdx] = newStroke;
      strokesRef.current = next;
      setResizeRevision((v) => v + 1);
      redrawSheet(next, null, curveDraftRef.current);
      return;
    }

    if (angleDraftRef.current && !viewPanDragRef.current) {
      const pos = getPos(e, canvas);
      angleDraftRef.current = { ...angleDraftRef.current, cx: pos.x, cy: pos.y };
      redrawSheet(strokesRef.current, null, curveDraftRef.current, null);
    }

    if (measureDraftRef.current && !viewPanDragRef.current) {
      const pos = getPos(e, canvas);
      measureDraftRef.current = { ...measureDraftRef.current, cx: pos.x, cy: pos.y };
      redrawSheet(strokesRef.current, null, curveDraftRef.current, null);
    }

    if (triFreeDraftRef.current && !viewPanDragRef.current) {
      const pos = getPos(e, canvas);
      triFreeDraftRef.current = { ...triFreeDraftRef.current, cx: pos.x, cy: pos.y };
      redrawSheet(strokesRef.current, null, curveDraftRef.current, null);
    }

    if (useLiveWhiteboardStore.getState().tool === 'laser') {
      const pos = getPos(e, canvas);
      setLaserPos({ x: pos.x, y: pos.y });
      const now = Date.now();
      if (now - laserThrottleRef.current > 50) {
        laserThrottleRef.current = now;
        const cw = canvasRef.current?.width || 800;
        const ch = canvasRef.current?.height || 600;
        onBroadcast?.({ laserPointer: { nx: pos.x / Math.max(1, cw), ny: pos.y / Math.max(1, ch), visible: true } });
      }
    }

    if (compassDraftRef.current && !viewPanDragRef.current) {
      const pos = getPos(e, canvas);
      const d = compassDraftRef.current;
      const r = Math.hypot(pos.x - d.cx, pos.y - d.cy);
      const angle = Math.atan2(pos.y - d.cy, pos.x - d.cx);
      if (d.phase === 'radius') {
        compassDraftRef.current = { ...d, r, currentAngle: angle };
      } else if (d.phase === 'draw') {
        compassDraftRef.current = { ...d, currentAngle: angle };
        setCompassSweepAngle(angle);
      }
      redrawSheet(strokesRef.current, null, curveDraftRef.current, null);
    }

    const vp = viewPanDragRef.current;
    if (vp && e.pointerId === vp.pointerId) {
      e.preventDefault();
      const dx = e.clientX - vp.sx;
      const dy = e.clientY - vp.sy;
      useLiveWhiteboardStore.getState().setBoardPan({
        x: vp.ox + dx,
        y: vp.oy + dy,
      });
      return;
    }

    const drag = boardDragRef.current;
    if (drag && e.pointerId === drag.pointerId) {
      e.preventDefault();
      const pos = getPos(e, canvas);
      let dx = pos.x - drag.x0;
      let dy = pos.y - drag.y0;
      const stSnap = useLiveWhiteboardStore.getState();
      if (stSnap.snapToGrid) {
        const gs = stSnap.gridSize || 24;
        dx = Math.round(dx / gs) * gs;
        dy = Math.round(dy / gs) * gs;
      }
      if (Math.hypot(dx, dy) > 2) boardDragDidMoveRef.current = true;
      const merged = drag.snapshot.map((s, i) =>
        (drag.indices.includes(i) ? offsetWhiteboardStroke(s, dx, dy) : s),
      );
      strokesRef.current = merged;
      redrawSheet(merged, null, curveDraftRef.current);
      return;
    }

    if (marqueeDraggingRef.current && marqueeDraftRef.current) {
      e.preventDefault();
      const pos = getPos(e, canvas);
      marqueeDraftRef.current.x1 = pos.x;
      marqueeDraftRef.current.y1 = pos.y;
      redrawSheet(strokesRef.current, null, curveDraftRef.current, marqueeDraftRef.current);
      return;
    }

    const tCurve = useLiveWhiteboardStore.getState().tool;
    if (tCurve === 'curve' && curveDraftRef.current?.phase >= 1) {
      e.preventDefault();
      const pos = getPos(e, canvas);
      Object.assign(curveDraftRef.current, { px: pos.x, py: pos.y });
      redrawSheet(strokesRef.current, shapeDraft.current, curveDraftRef.current);
      return;
    }

    if (shapeDraft.current && drawing.current) {
      e.preventDefault();
      const pos = getPos(e, canvas);
      shapeDraft.current.x1 = pos.x;
      shapeDraft.current.y1 = pos.y;
      redrawSheet(strokesRef.current, shapeDraft.current, curveDraftRef.current);
      return;
    }

    if (!drawing.current || !curStroke.current) return;
    e.preventDefault();
    straightLineModifierRef.current = straightLineModifierRef.current || isStraightLineModifier(e);
    const pos = getPos(e, canvas);
    if (emptyCanvasTapRef.current && curStroke.current.points.length >= 1) {
      const fp = curStroke.current.points[0];
      if (Math.hypot(pos.x - fp[0], pos.y - fp[1]) > 4) {
        emptyCanvasTapRef.current = null;
      }
    }
    curStroke.current.points.push([pos.x, pos.y]);

    const ctx = canvas.getContext('2d');
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = curStroke.current.isEraser ? curStroke.current.size * 5 : curStroke.current.size;
    if (curStroke.current.isEraser) {
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(0,0,0,1)';
      ctx.beginPath();
      ctx.moveTo(lastPos.current.x, lastPos.current.y);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
      ctx.restore();
    } else {
      ctx.beginPath();
      ctx.strokeStyle = curStroke.current.color;
      ctx.moveTo(lastPos.current.x, lastPos.current.y);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
    }
    lastPos.current = pos;
  }, [readOnly, redrawSheet]);

  const handlePointerUp = useCallback(
    (e) => {
      if (readOnly) return;
      const canvas = canvasRef.current;
      const vp = viewPanDragRef.current;
      if (vp && e.pointerId === vp.pointerId) {
        viewPanDragRef.current = null;
        setViewPanPointerDown(false);
        if (canvas) {
          try {
            canvas.releasePointerCapture(e.pointerId);
          } catch {
            /* ignore */
          }
        }
        return;
      }

      const drag = boardDragRef.current;
      if (drag && e.pointerId === drag.pointerId) {
        boardDragRef.current = null;
        if (canvas) {
          try {
            canvas.releasePointerCapture(e.pointerId);
          } catch {
            /* ignore */
          }
        }
        if (boardDragDidMoveRef.current) {
          /* save pre-drag state as undo snapshot */
          redoStackRef.current = [];
          const preDragSnap = cloneStrokesDeep(drag.snapshot);
          if (undoStackRef.current.length >= MAX_UNDO) undoStackRef.current.shift();
          undoStackRef.current.push(preDragSnap);
          onStrokesChange?.(() => cloneStrokesDeep(strokesRef.current));
        } else {
          strokesRef.current = drag.snapshot;
          redrawSheet(drag.snapshot, null, curveDraftRef.current);
        }
        boardDragDidMoveRef.current = false;
        return;
      }

      if (marqueeDraggingRef.current) {
        marqueeDraggingRef.current = false;
        const d = marqueeDraftRef.current;
        marqueeDraftRef.current = null;
        const m = normalizedMarquee(d);
        if (canvas && m && m.w >= 4 && m.h >= 4) {
          const ctx = canvas.getContext('2d');
          const idx = indicesIntersectingMarquee(ctx, strokesRef.current, m);
          useLiveWhiteboardStore.getState().setBoardSelection(idx);
        } else {
          useLiveWhiteboardStore.getState().setBoardSelection([]);
        }
        useLiveWhiteboardStore.getState().setTool('select');
        redrawSheet(strokesRef.current, null, curveDraftRef.current, null);
        if (canvas) {
          try {
            canvas.releasePointerCapture(e.pointerId);
          } catch {
            /* ignore */
          }
        }
        return;
      }

      if (canvas) {
        try {
          canvas.releasePointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
      }

      if (shapeDraft.current?.kind === 'rotation' && drawing.current) {
        e.preventDefault();
        const d = shapeDraft.current;
        shapeDraft.current = null; drawing.current = false;
        const len = Math.hypot(d.x1 - d.x0, d.y1 - d.y0);
        if (len > 4) {
          const { boardSelection } = useLiveWhiteboardStore.getState();
          const allS = strokesRef.current;
          const indices = boardSelection.length > 0 ? boardSelection : [];
          if (indices.length > 0) {
            const angle = Math.atan2(d.y1 - d.y0, d.x1 - d.x0);
            saveUndoSnapshot();
            const next = [...allS];
            indices.forEach((i) => {
              if (allS[i] && allS[i].kind !== 'group') {
                next[i] = rotateStroke(allS[i], d.x0, d.y0, angle);
              }
            });
            strokesRef.current = next;
            onStrokesChange?.(() => cloneStrokesDeep(strokesRef.current));
          }
        }
        redrawSheet(strokesRef.current, null, curveDraftRef.current);
        return;
      }

      if (shapeDraft.current?.kind === 'translation' && drawing.current) {
        e.preventDefault();
        const d = shapeDraft.current;
        shapeDraft.current = null; drawing.current = false;
        const dx = d.x1 - d.x0; const dy = d.y1 - d.y0;
        if (Math.hypot(dx, dy) > 3) {
          const { boardSelection } = useLiveWhiteboardStore.getState();
          const allS = strokesRef.current;
          const indices = boardSelection.length > 0 ? boardSelection : [];
          if (indices.length > 0) {
            saveUndoSnapshot();
            const next = allS.map((s, i) => indices.includes(i) ? offsetWhiteboardStroke(s, dx, dy) : s);
            strokesRef.current = next;
            onStrokesChange?.(() => cloneStrokesDeep(strokesRef.current));
          }
        }
        redrawSheet(strokesRef.current, null, curveDraftRef.current);
        return;
      }

      if (shapeDraft.current?.kind === 'symmetry' && drawing.current) {
        e.preventDefault();
        const d = shapeDraft.current;
        shapeDraft.current = null;
        drawing.current = false;
        const axisLen = Math.hypot(d.x1 - d.x0, d.y1 - d.y0);
        if (axisLen > 6) {
          const { boardSelection } = useLiveWhiteboardStore.getState();
          const allS = strokesRef.current;
          const indices = boardSelection.length > 0 ? boardSelection : [];
          if (indices.length > 0) {
            saveUndoSnapshot();
            indices.forEach((i) => {
              const s = allS[i];
              if (s && s.kind !== 'group') {
                const reflected = reflectStrokeAcrossLine(s, d.x0, d.y0, d.x1, d.y1);
                if (reflected) {
                  const next = [...strokesRef.current, reflected];
                  strokesRef.current = next;
                }
              }
            });
            /* axe visuel (tirets) */
            const { color: c } = useLiveWhiteboardStore.getState();
            strokesRef.current = [...strokesRef.current, {
              kind: 'line', x1: d.x0, y1: d.y0, x2: d.x1, y2: d.y1,
              color: hexToRgba(c, 0.45), lineWidth: 1,
            }];
            onStrokesChange?.(() => cloneStrokesDeep(strokesRef.current));
          }
        }
        redrawSheet(strokesRef.current, null, curveDraftRef.current);
        return;
      }

      if (shapeDraft.current && drawing.current) {
        e.preventDefault();
        const shapeToolBefore = shapeDraft.current?.kind;
        const committed = commitShape();
        shapeDraft.current = null;
        drawing.current = false;
        if (committed && canvas && !committed._special) {
          pushStroke(committed);
        } else if (canvas) {
          redrawSheet(strokesRef.current, null, curveDraftRef.current);
          const stShape = useLiveWhiteboardStore.getState();
          if (shapeToolBefore === 'rect' || shapeToolBefore === 'circle' || shapeToolBefore === 'line') {
            stShape.setTool('select');
            stShape.setBoardSelection([]);
          }
        }
        return;
      }

      if (textAnchorRef.current != null && textPointerIdRef.current === e.pointerId) {
        e.preventDefault();
        const start = textAnchorRef.current;
        textAnchorRef.current = null;
        textPointerIdRef.current = null;
        const pos = canvas ? getPos(e, canvas) : start;
        if (canvas && Math.hypot(pos.x - start.x, pos.y - start.y) < 12) {
          // Saisie IMMÉDIATE, sans délai (fini les 220 ms). Si le tap touche un bloc texte
          // existant → édition directe au clic simple (façon Word) ; sinon → nouveau bloc tout de suite.
          const ctx = canvas.getContext('2d');
          const list = strokesRef.current;
          let editIdx = -1;
          for (let i = list.length - 1; i >= 0; i -= 1) {
            if (hitTestWhiteboardTextStroke(ctx, list[i], pos.x, pos.y)) { editIdx = i; break; }
          }
          if (editIdx >= 0) {
            const s = list[editIdx];
            const wb = useLiveWhiteboardStore.getState();
            wb.setTextPreset(s.textPreset || 'body');
            wb.setTextBold(s.textBold === true);
            wb.setTextItalic(s.fontStyle === 'italic');
            wb.setTextAlign(s.textAlign === 'center' || s.textAlign === 'right' ? s.textAlign : 'left');
            if (typeof s.fontSize === 'number') wb.setTextFontSize(s.fontSize);
            wb.setColor(s.color || wb.color);
            setTextDraft({ mode: 'edit', index: editIdx, x: s.x, y: s.y, initialText: s.text || '' });
          } else {
            setTextDraft({ mode: 'create', x: start.x, y: start.y });
          }
        }
        return;
      }

      if (resizeDraftRef.current && resizeDraftRef.current.pointerId === e.pointerId) {
        e.preventDefault();
        const rd = resizeDraftRef.current;
        resizeDraftRef.current = null;
        if (canvas) { try { canvas.releasePointerCapture(e.pointerId); } catch { /* */ } }
        onStrokesChange?.(() => cloneStrokesDeep(strokesRef.current));
        setResizeRevision((v) => v + 1);
        return;
      }

      if (compassDraftRef.current && compassDraftRef.current.pointerId === e.pointerId) {
        e.preventDefault();
        const d = compassDraftRef.current;
        const { color: c, size: lw } = useLiveWhiteboardStore.getState();
        if (d.phase === 'radius' && d.r > 6) {
          if (!d.arcMode) {
            /* Cercle complet */
            pushStroke({ kind: 'arc', cx: d.cx, cy: d.cy, r: d.r, startAngle: 0, endAngle: Math.PI * 2, color: c, lineWidth: lw });
            compassDraftRef.current = null;
          } else {
            /* Mode arc : 2e phase commence au prochain clic */
            compassDraftRef.current = { ...d, phase: 'radius' };
          }
        } else if (d.phase === 'draw') {
          /* Valider l'arc */
          const swept = d.currentAngle - d.startAngle;
          const fullCircle = Math.abs(Math.abs(swept) - Math.PI * 2) < 0.05;
          if (fullCircle) {
            pushStroke({ kind: 'arc', cx: d.cx, cy: d.cy, r: d.r, startAngle: 0, endAngle: Math.PI * 2, color: c, lineWidth: lw });
          } else if (Math.abs(swept) > 0.1) {
            pushStroke({ kind: 'arc', cx: d.cx, cy: d.cy, r: d.r, startAngle: d.startAngle, endAngle: d.currentAngle, color: c, lineWidth: lw });
          }
          compassDraftRef.current = null;
        }
        if (canvas) {
          try { canvas.releasePointerCapture(e.pointerId); } catch { /* */ }
        }
        redrawSheet(strokesRef.current, null, curveDraftRef.current, null);
        return;
      }

      if (curStroke.current && emptyCanvasTapRef.current) {
        e.preventDefault();
        drawing.current = false;
        straightLineModifierRef.current = false;
        curStroke.current = null;
        emptyCanvasTapRef.current = null;
        if (canvas) {
          try {
            canvas.releasePointerCapture(e.pointerId);
          } catch {
            /* ignore */
          }
        }
        redrawSheet(strokesRef.current, null, curveDraftRef.current);
        const stTap = useLiveWhiteboardStore.getState();
        stTap.setTool('select');
        stTap.setBoardSelection([]);
        return;
      }

      if (curStroke.current) {
        endPathStroke();
      }
      emptyCanvasTapRef.current = null;
    },
    [readOnly, commitShape, endPathStroke, pushStroke, onStrokesChange, redrawSheet],
  );

  const panningUi = tool === 'hand' || spaceHeld;
  const cursor = readOnly
    ? 'default'
    : panningUi
      ? (viewPanPointerDown ? 'grabbing' : 'grab')
      : tool === 'select'
        ? 'grab'
        : tool === 'text'
          ? 'text'
          : tool === 'compass'
            ? 'none'
            : 'crosshair';

  const gridDot =
    boardSurface === 'chalkboard'
      ? 'radial-gradient(circle, rgba(255,255,255,0.12) 1px, transparent 1px)'
      : 'radial-gradient(circle, rgba(255,255,255,0.35) 1px, transparent 1px)';

  return (
    <div className={cn('absolute inset-0 flex flex-col', SCENE_STAGE_GRID)}>
      <div className="relative min-h-0 flex-1 overflow-hidden bg-black/25 ring-1 ring-inset ring-white/[0.04]">
        <div
          ref={boardLayerRef}
          className="absolute inset-0"
          style={{
            transform: `translate(${boardPan.x}px, ${boardPan.y}px)`,
          }}
          onPointerEnter={() => { pointerOverBoardRef.current = true; }}
          onPointerLeave={() => { pointerOverBoardRef.current = false; }}
        >
          <div
            className="absolute inset-0"
            style={{ transform: `scale(${boardZoom})`, transformOrigin: '0 0' }}
          >
            <canvas
              ref={bgCanvasRef}
              className="pointer-events-none absolute inset-0 z-0 h-full w-full"
              aria-hidden
            />
            <canvas
              ref={canvasRef}
              className="absolute inset-0 z-[1] h-full w-full touch-none focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40"
              style={{ cursor }}
              tabIndex={readOnly ? undefined : 0}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              onDoubleClick={handleCanvasDoubleClick}
              onContextMenu={handleBoardContextMenu}
              onDragOver={(e) => { if (!readOnly && e.dataTransfer?.types?.includes('Files')) e.preventDefault(); }}
              onDrop={(e) => {
                if (readOnly) return;
                const f = e.dataTransfer?.files?.[0];
                if (f && String(f.type || '').startsWith('image/')) {
                  e.preventDefault();
                  const canvas = canvasRef.current;
                  insertImageFromFile(f, canvas ? getPos(e, canvas) : null);
                }
              }}
              onWheel={(e) => {
                if (readOnly) return;
                if (!pointerOverBoardRef.current) return;
                const st = useLiveWhiteboardStore.getState();
                // Ctrl/Cmd + molette = zoom du tableau vers le curseur (réflexe Figma/Photoshop).
                if (e.ctrlKey || e.metaKey) {
                  e.preventDefault();
                  const zoom = st.boardZoom || 1;
                  zoomBoardAtPoint(zoom * (e.deltaY > 0 ? 0.9 : 1.1), e.clientX, e.clientY);
                  return;
                }
                const t = st.tool;
                if (t !== 'pencil' && t !== 'eraser') return;
                e.preventDefault();
                const sign = e.deltaY > 0 ? -1 : 1;
                const baseStep = 1;
                const step = e.shiftKey ? baseStep * 3 : baseStep;
                const next = Math.min(80, Math.max(1, st.size + sign * step));
                st.setSize(next);
              }}
            />
          </div>
          <div
            className="pointer-events-none absolute inset-0 z-[2] opacity-[0.06]"
            style={{
              backgroundImage: gridDot,
              backgroundSize: '32px 32px',
            }}
          />
          {/* ── Poignées de redimensionnement ─────────────────────────── */}
          {boardSelection.length === 1 && !readOnly && tool === 'select' ? (() => {
            const idx = boardSelection[0];
            const s = strokesRef.current[idx];
            if (!s) return null;
            const canvas = canvasRef.current;
            if (!canvas) return null;
            const ctx = canvas.getContext('2d');
            const b = strokeVisualBounds(ctx, s);
            if (!b) return null;
            // Poignées de redimensionnement : seulement pour les objets redimensionnables.
            // MAIS on trace TOUJOURS un contour de sélection — y compris texte et tracé
            // libre — pour que l'utilisateur VOIE l'objet sélectionné (donc déplaçable).
            const resizable = RESIZABLE_KINDS.has(s.kind || 'path');
            const handles = resizable ? getResizeHandles(b) : [];
            const cw = canvas.width || 800;
            const ch = canvas.height || 600;
            const svgKey = `${resizeRevision}-${idx}`;
            return (
              <svg
                key={svgKey}
                className="pointer-events-none absolute inset-0 z-[5] overflow-visible"
                width="100%" height="100%"
                viewBox={`0 0 ${cw} ${ch}`}
                aria-hidden
              >
                <rect
                  x={b.x - 3} y={b.y - 3} width={Math.max(0, b.w) + 6} height={Math.max(0, b.h) + 6}
                  rx="3" fill="none" stroke="rgba(212,175,55,0.9)" strokeWidth="1.5" strokeDasharray="6 4"
                />
                {handles.map((h) => (
                  <rect
                    key={h.id}
                    x={h.x - 5} y={h.y - 5} width="10" height="10"
                    rx="2"
                    fill="rgba(255,255,255,0.9)"
                    stroke="rgba(212,175,55,0.95)"
                    strokeWidth="1.5"
                  />
                ))}
              </svg>
            );
          })() : null}

          {/* ── Laser pointer overlay ─────────────────────────────────── */}
          {tool === 'laser' && laserPos ? (() => {
            const cw = canvasRef.current?.width || 800;
            const ch = canvasRef.current?.height || 600;
            return (
              <svg
                className="pointer-events-none absolute inset-0 z-[8] overflow-visible"
                width="100%" height="100%"
                viewBox={`0 0 ${cw} ${ch}`}
                aria-hidden
              >
                <circle cx={laserPos.x} cy={laserPos.y} r={26} fill="rgba(239,68,68,0.10)" />
                <circle cx={laserPos.x} cy={laserPos.y} r={14} fill="rgba(239,68,68,0.22)" />
                <circle cx={laserPos.x} cy={laserPos.y} r={6} fill="rgba(239,68,68,0.85)" />
                <circle cx={laserPos.x} cy={laserPos.y} r={3} fill="#fff" opacity="0.95" />
              </svg>
            );
          })() : null}
          {/* Remote laser (participants see teacher's laser) */}
          {remoteLaserPointer?.visible ? (() => {
            const cw = canvasRef.current?.width || 800;
            const ch = canvasRef.current?.height || 600;
            const rx = (remoteLaserPointer.nx || 0) * cw;
            const ry = (remoteLaserPointer.ny || 0) * ch;
            return (
              <svg
                className="pointer-events-none absolute inset-0 z-[8] overflow-visible"
                width="100%" height="100%"
                viewBox={`0 0 ${cw} ${ch}`}
                aria-hidden
              >
                <circle cx={rx} cy={ry} r={26} fill="rgba(239,68,68,0.10)" />
                <circle cx={rx} cy={ry} r={14} fill="rgba(239,68,68,0.22)" />
                <circle cx={rx} cy={ry} r={6} fill="rgba(239,68,68,0.85)" />
                <circle cx={rx} cy={ry} r={3} fill="#fff" opacity="0.95" />
                <text x={rx + 14} y={ry - 10} fontSize="10" fill="rgba(239,68,68,0.9)" fontFamily="ui-sans-serif,system-ui,sans-serif" fontWeight="600">Formateur</text>
              </svg>
            );
          })() : null}

          {/* ── Éditeur d'objet (double-clic) ─────────────────────────── */}
          {editingStroke && (
            <WhiteboardObjectEditPanel
              stroke={editingStroke.stroke}
              onClose={() => setEditingStroke(null)}
              onApply={(patch) => {
                saveUndoSnapshot();
                const idx = editingStroke.index;
                const next = [...strokesRef.current];
                next[idx] = { ...next[idx], ...patch };
                strokesRef.current = next;
                onStrokesChange?.(() => cloneStrokesDeep(next));
                redrawSheet(next, null, curveDraftRef.current);
                setEditingStroke(null);
              }}
            />
          )}

          {/* ── Timer overlay ─────────────────────────────────────────── */}
          {wbTimer?.visible && (
            <div className="pointer-events-none absolute top-3 right-3 z-[9] select-none">
              <div className={cn(
                'rounded-2xl border px-4 py-2.5 backdrop-blur-sm shadow-lg',
                wbTimer.remainingSec <= 30 && wbTimer.remainingSec > 0
                  ? 'border-red-500/50 bg-[#1f1e1c]/95'
                  : 'border-amber-500/30 bg-[#1f1e1c]/90',
              )}>
                <div className={cn(
                  'text-[28px] font-mono font-bold tabular-nums text-center tracking-widest',
                  wbTimer.remainingSec <= 30 && wbTimer.remainingSec > 0 ? 'text-red-400' : 'text-amber-200',
                  wbTimer.remainingSec === 0 && 'opacity-50',
                )}>
                  {String(Math.floor(wbTimer.remainingSec / 60)).padStart(2, '0')}
                  <span className="opacity-60">:</span>
                  {String(wbTimer.remainingSec % 60).padStart(2, '0')}
                </div>
                {wbTimer.remainingSec === 0 && (
                  <p className="text-center text-[9px] text-red-400/80 font-semibold mt-0.5">⏰ Terminé</p>
                )}
              </div>
            </div>
          )}

          {/* ── Compas SVG overlay ────────────────────────────────────── */}
          {tool === 'compass' && compassDraftRef.current?.r >= 4 ? (() => {
            const d = compassDraftRef.current;
            const pencilX = d.cx + d.r * Math.cos(d.currentAngle);
            const pencilY = d.cy + d.r * Math.sin(d.currentAngle);
            const midX = (d.cx + pencilX) / 2;
            const midY = (d.cy + pencilY) / 2;
            const legLen = Math.min(d.r * 0.85, 90);
            const halfR = d.r / 2;
            const perpH = Math.sqrt(Math.max(0, legLen * legLen - halfR * halfR));
            const dirX = d.r > 0 ? (pencilX - d.cx) / d.r : 1;
            const dirY = d.r > 0 ? (pencilY - d.cy) / d.r : 0;
            const p1X = -dirY; const p1Y = dirX;
            const p2X = dirY;  const p2Y = -dirX;
            const perpX = p1Y < 0 ? p1X : p2X;
            const perpY = p1Y < 0 ? p1Y : p2Y;
            const hx = midX + perpH * perpX;
            const hy = midY + perpH * perpY;
            const col = color || '#D4AF37';
            const cw = canvasRef.current?.width || 800;
            const ch = canvasRef.current?.height || 600;
            return (
              <svg
                key={compassSweepAngle}
                className="pointer-events-none absolute inset-0 z-[4] overflow-visible"
                width="100%" height="100%"
                viewBox={`0 0 ${cw} ${ch}`}
                aria-hidden
              >
                {/* radius hint label */}
                <text
                  x={Math.max(midX, d.cx) + 10}
                  y={Math.min(midY, d.cy) - 6}
                  fill={col} fontSize="13" fontWeight="700"
                  fontFamily="ui-sans-serif,system-ui,sans-serif"
                  opacity="0.88"
                >
                  r = {Math.round(d.r)}
                </text>
                {/* dashed circle preview */}
                <circle cx={d.cx} cy={d.cy} r={d.r} fill="none" stroke={col} strokeWidth="1.5" strokeOpacity="0.3" strokeDasharray="7 5" />
                {/* arc in draw phase */}
                {d.phase === 'draw' && (
                  <path
                    d={(() => {
                      const sax = d.cx + d.r * Math.cos(d.startAngle);
                      const say = d.cy + d.r * Math.sin(d.startAngle);
                      const eax = d.cx + d.r * Math.cos(d.currentAngle);
                      const eay = d.cy + d.r * Math.sin(d.currentAngle);
                      const largeArc = (d.currentAngle - d.startAngle + Math.PI * 2) % (Math.PI * 2) > Math.PI ? 1 : 0;
                      return `M ${sax} ${say} A ${d.r} ${d.r} 0 ${largeArc} 1 ${eax} ${eay}`;
                    })()}
                    fill="none" stroke={col} strokeWidth="2.5" strokeOpacity="0.8" strokeLinecap="round"
                  />
                )}
                {/* jambe aiguille */}
                <line x1={d.cx} y1={d.cy} x2={hx} y2={hy} stroke={col} strokeWidth="3" strokeLinecap="round" opacity="0.9" />
                {/* jambe crayon */}
                <line x1={hx} y1={hy} x2={pencilX} y2={pencilY} stroke={col} strokeWidth="3" strokeLinecap="round" opacity="0.9" />
                {/* charnière */}
                <circle cx={hx} cy={hy} r="6" fill={col} opacity="0.88" />
                {/* pivot centre */}
                <circle cx={d.cx} cy={d.cy} r="9" fill="none" stroke={col} strokeWidth="2.5" opacity="0.9" />
                <circle cx={d.cx} cy={d.cy} r="3" fill={col} opacity="0.9" />
                <line x1={d.cx - 11} y1={d.cy} x2={d.cx + 11} y2={d.cy} stroke={col} strokeWidth="1.8" opacity="0.7" />
                <line x1={d.cx} y1={d.cy - 11} x2={d.cx} y2={d.cy + 11} stroke={col} strokeWidth="1.8" opacity="0.7" />
                {/* pointe crayon */}
                <circle cx={pencilX} cy={pencilY} r="5" fill={col} opacity="0.92" />
                <polygon
                  points={`${pencilX},${pencilY + 6} ${pencilX - 4},${pencilY + 14} ${pencilX + 4},${pencilY + 14}`}
                  fill={col} opacity="0.7"
                />
              </svg>
            );
          })() : null}
        </div>
      </div>

      <WhiteboardContextMenu
        open={Boolean(boardContextMenu)}
        anchor={boardContextMenu}
        hitStrokeIndex={boardContextMenu?.hit ?? -1}
        hitStrokeKind={boardContextMenu?.hitKind ?? null}
        hitTextContent={boardContextMenu?.hitText ?? ''}
        strokeCount={Array.isArray(strokesProp) ? strokesProp.length : 0}
        readOnly={readOnly}
        onClose={() => setBoardContextMenu(null)}
        onZoomToSelection={zoomToBoardSelection}
        onReplaceBoardText={replaceBoardTextAt}
        onUpdateBoardTextStyle={updateBoardTextStyleAt}
      />

      {typeof document !== 'undefined' && textDraft && !readOnly ? (
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label={textDraft.mode === 'edit' ? 'Modifier le texte sur le tableau' : 'Saisie de texte sur le tableau'}
            style={{
              position: 'fixed',
              left: Math.max(4, textOverlayScreen.left || 0),
              top: Math.max(4, textInPlace.topPx),
              // z-index MAX : en téléconsult, la coque `.consult-shell` est un overlay
              // plein écran à z-index 2147483000 → un composer à 6000 était ENTERRÉ
              // dessous (invisible = « texte fantôme »). On repasse au-dessus de la coque.
              zIndex: 2147483600,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              gap: 8,
              // Conteneur de POSITIONNEMENT seulement — transparent, aucun cadre autour du texte.
              background: 'transparent',
              border: 'none',
              padding: 0,
              maxWidth: 'calc(100vw - 16px)',
            }}
          >
            {/* Saisie DIRECTE sur le tableau (façon Word) : calque exact du rendu canvas. */}
            <textarea
              ref={textAreaRef}
              key={`${textDraft.mode}-${textDraft.x}-${textDraft.y}-${textDraft.mode === 'edit' ? textDraft.index : ''}`}
              rows={1}
              wrap="off"
              spellCheck
              lang="fr"
              placeholder="Texte…"
              defaultValue={textDraft.mode === 'edit' ? String(textDraft.initialText ?? '') : ''}
              onInput={(ev) => {
                const el = ev.currentTarget;
                el.style.height = 'auto';
                el.style.height = `${el.scrollHeight}px`;
                const v = String(el.value || '').slice(0, 2000);
                useLiveWhiteboardStore.getState().emitBoardIaTelemetry({
                  textDraftActive: true,
                  textDraftPreview: v,
                });
              }}
              onKeyDown={(ev) => {
                if (ev.key === 'Escape') {
                  ev.preventDefault();
                  textFinalizedRef.current = true; // Échap = annuler, pas committer au blur
                  setTextDraft(null);
                }
                if (ev.key === 'Enter' && !ev.shiftKey) {
                  ev.preventDefault();
                  commitTextDraft();
                }
              }}
              onBlur={() => {
                // Commit-on-blur façon Word : cliquer ailleurs (le tableau) valide la saisie.
                // Les contrôles (Aa/Annuler/Placer) ont onMouseDown preventDefault → pas de blur,
                // et le blur d'unmount après finalisation est ignoré via textFinalizedRef.
                if (textFinalizedRef.current) return;
                commitTextDraft();
              }}
              style={{
                margin: 0,
                padding: 0,
                border: 'none',
                // CADRE NET + halo doré + ombre portée : le champ de saisie doit être
                // VISIBLE. Avant : fond = couleur du tableau + contour fin pointillé →
                // le champ se confond avec le tableau = « texte fantôme » (on ne voit
                // pas où on tape). outline + boxShadow ne décalent PAS le texte (WYSIWYG
                // conservé). Visible sur fond sombre ET clair.
                outline: '2px solid #d4a36a',
                outlineOffset: '3px',
                boxShadow: '0 0 0 4px rgba(212,163,106,0.20), 0 10px 28px rgba(0,0,0,0.5)',
                borderRadius: 4,
                resize: 'none',
                overflow: 'hidden',
                whiteSpace: 'pre',
                width: Math.max(160, textOverlayScreen.maxWidth || 480),
                minHeight: textInPlace.lineHeightPx,
                background: textInPlace.surfaceBg || 'rgba(20,18,16,0.55)',
                fontFamily: 'ui-sans-serif, system-ui, sans-serif',
                fontSize: `${textInPlace.fontPx}px`,
                fontWeight: textInPlace.weight,
                fontStyle: textInPlace.fontStyle,
                lineHeight: `${textInPlace.lineHeightPx}px`,
                textAlign: textInPlace.textAlign,
                color: textInPlace.color,
                // Curseur ambre TOUJOURS visible (avant = couleur du texte → invisible
                // si le texte matche le fond) → on voit clairement où on écrit.
                caretColor: '#d4a36a',
              }}
            />

            {/* Contrôles DÉTACHÉS sous le texte (jamais autour) — barre flottante minimale.
                onMouseDown preventDefault : cliquer un contrôle ne retire PAS le focus du champ
                (pas de blur → la saisie continue, et Annuler reste « annuler »). */}
            <div
              className="flex flex-col gap-1.5 rounded-lg border border-white/10 bg-[#1f1e1c]/90 p-1.5 shadow-lg backdrop-blur-sm"
              onMouseDown={(e) => e.preventDefault()}
            >
            {composerToolsOpen ? (
            <>
            <p className={cn(designerShellMicroLabel, 'text-white/55')}>Compositeur Architect · presets et IA</p>
            <div className="flex flex-wrap gap-1">
              {[
                { id: 'title', label: 'Titre' },
                { id: 'subtitle', label: 'Sous-titre' },
                { id: 'body', label: 'Paragr.' },
                { id: 'caption', label: 'Légende' },
              ].map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  title={`Preset ${label}`}
                  onClick={() => {
                    setTextPreset(id);
                    const base = WHITEBOARD_TEXT_PRESET_BASE[id];
                    if (base?.fontSize) setTextFontSize(base.fontSize);
                  }}
                  className={cn(
                    designerShellChipGhost,
                    'px-2 py-1 text-[9px] font-semibold',
                    textPreset === id && 'border-amber-500/50 bg-amber-500/15 text-amber-100',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-1">
              <button
                type="button"
                title="Gras"
                onClick={() => setTextBold((b) => !b)}
                className={cn(
                  designerShellChipGhost,
                  'h-8 w-8 p-0',
                  textBold && 'border-amber-500/45 bg-amber-500/12 text-amber-100',
                )}
              >
                <Bold className="mx-auto h-3.5 w-3.5" strokeWidth={2.2} />
              </button>
              <button
                type="button"
                title="Italique"
                onClick={() => setTextItalic((b) => !b)}
                className={cn(
                  designerShellChipGhost,
                  'h-8 w-8 p-0',
                  textItalic && 'border-amber-500/45 bg-amber-500/12 text-amber-100',
                )}
              >
                <Italic className="mx-auto h-3.5 w-3.5" strokeWidth={2.2} />
              </button>
              {[
                { id: 'left', Icon: AlignLeft },
                { id: 'center', Icon: AlignCenter },
                { id: 'right', Icon: AlignRight },
              ].map(({ id, Icon }) => (
                <button
                  key={id}
                  type="button"
                  title={id === 'left' ? 'Aligner à gauche' : id === 'center' ? 'Centrer' : 'Aligner à droite'}
                  onClick={() => setTextAlign(id)}
                  className={cn(
                    designerShellChipGhost,
                    'h-8 w-8 p-0',
                    textAlign === id && 'border-amber-500/45 bg-amber-500/12 text-amber-100',
                  )}
                >
                  <Icon className="mx-auto h-3.5 w-3.5" strokeWidth={2} />
                </button>
              ))}
              <span className="mx-0.5 h-4 w-px bg-white/15" aria-hidden />
              {[
                { mode: 'fix', label: 'Corriger' },
                { mode: 'rephrase', label: 'Reformuler' },
                { mode: 'translate', label: '→ EN' },
              ].map(({ mode, label }) => (
                <button
                  key={mode}
                  type="button"
                  disabled={Boolean(textOverlayAiBusy)}
                  title={mode === 'fix' ? 'Corriger fautes (IA)' : mode === 'rephrase' ? 'Reformuler (IA)' : 'Traduire en anglais (IA)'}
                  onClick={() => void runOverlayTextAi(mode)}
                  className={cn(
                    designerShellChipGhost,
                    'flex items-center gap-0.5 px-2 py-1 text-[9px] text-amber-200/95',
                    textOverlayAiBusy === mode && 'opacity-70',
                  )}
                >
                  <Sparkles className="h-3 w-3 shrink-0 opacity-80" />
                  {label}
                </button>
              ))}
            </div>
            </>
            ) : null}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setComposerToolsOpen((o) => !o)}
                title="Mise en forme & IA — titre, gras, alignement, Corriger, Reformuler…"
                aria-pressed={composerToolsOpen}
                aria-label="Afficher la mise en forme et l'IA"
                className={cn(
                  designerShellChipGhost,
                  'flex items-center px-2.5 py-1 text-[11px] font-semibold leading-none',
                  composerToolsOpen
                    ? 'border-amber-500/40 bg-amber-500/12 text-amber-100'
                    : 'text-white/70',
                )}
              >
                Aa
              </button>
              <button
                type="button"
                onClick={() => { textFinalizedRef.current = true; setTextDraft(null); }}
                className={cn(designerShellChipGhost, 'ml-auto px-2.5 py-1 text-[10px]')}
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => commitTextDraft()}
                className={cn(designerShellBtnGold, 'px-3 py-1 text-[10px]')}
              >
                {textDraft.mode === 'edit' ? 'Enregistrer' : 'Placer'}
              </button>
            </div>
            </div>
          </div>,
          document.body,
        )
      ) : null}

      <div className="pointer-events-none absolute bottom-16 left-3 z-10">
        <div
          className="rounded-full border-2 border-white/30"
          style={{
            backgroundColor: tool === 'eraser' ? 'rgba(255,255,255,0.1)' : color,
            width: `${Math.max(12, size * 3)}px`,
            height: `${Math.max(12, size * 3)}px`,
          }}
        />
      </div>
    </div>
  );
}

// ── Integrated URL / iframe scenes (Web, Embed Gamma, Quiz) ─────────────────
// X-Frame-Options : beaucoup de pages « pleine page » refusent l'iframe — utiliser
// l'URL d'embed fournie par l'outil (Gamma, Typeform…) ou « Partager l'écran ».
const URL_FRAME_VARIANTS = {
  web: {
    Icon: Globe,
    placeholder: 'Entrer une URL ou un nom de site…',
    emptyLead: 'Entrez une URL pour naviguer',
    emptyHint:
      'Les pages complètes peuvent bloquer l\'iframe. Pour Gamma ou un site capricieux : scène « Embed » avec le lien /embed, ou partage d\'écran.',
    blockedHint:
      'Cette page refuse l\'affichage intégré (sécurité du site). Ouvrez-la dans un onglet et utilisez « Partager l\'écran » pour la montrer aux élèves.',
    showSuggestions: true,
    showShare: true,
  },
  embed: {
    Icon: Link2,
    placeholder: 'Collez l\'URL d\'embed (Gamma : Partager → Intégrer)',
    emptyLead: 'Contenu intégré (Gamma, Canva, Notion…)',
    emptyHint:
      'Utilisez toujours le lien d\'intégration (/embed, iframe) fourni par l\'outil — pas l\'URL d\'édition.',
    blockedHint:
      'L\'URL n\'est pas une page embed autorisée en iframe. Vérifiez le lien « Intégrer » ou passez par le partage d\'écran.',
    showSuggestions: false,
    showShare: true,
  },
  quiz: {
    Icon: HelpCircle,
    placeholder: 'URL d\'embed du quiz (Typeform, Google Forms…)',
    emptyLead: 'Quiz pour les élèves',
    emptyHint:
      'Collez l\'URL d\'intégration du formulaire (mode embed / iframe). Les élèves voient la même scène que vous via la diffusion live.',
    blockedHint:
      'Ce quiz ne peut pas s\'afficher ici (blocage iframe). Utilisez le lien « embed » du fournisseur ou partagez votre écran.',
    showSuggestions: false,
    showShare: true,
  },
  secure_app: {
    Icon: Smartphone,
    placeholder: "URL de l'application à partager (embed/web app)",
    emptyLead: 'Application embarquée sécurisée',
    emptyHint:
      "Chargez l'application cible, puis manipulez-la depuis l'hôte. L'état est synchronisé vers les invités.",
    blockedHint:
      "L'application refuse l'iframe. Ouvrez-la dans un onglet et utilisez le partage d'écran.",
    showSuggestions: false,
    showShare: true,
  },
};

function isSecureAppDomainAllowed(rawUrl) {
  if (Array.isArray(SECURE_APP_ALLOWED_DOMAINS) && SECURE_APP_ALLOWED_DOMAINS.includes('*')) {
    return true;
  }
  try {
    const u = new URL(rawUrl);
    const h = String(u.hostname || '').toLowerCase();
    if (!h) return false;
    return SECURE_APP_ALLOWED_DOMAINS.some((d) => h === d || h.endsWith(`.${d}`));
  } catch {
    return false;
  }
}

function IntegratedUrlFrame({
  onShareScreen,
  variant = 'web',
  syncState = null,
  onSyncStateChange = null,
  readOnly = false,
}) {
  const cfg = URL_FRAME_VARIANTS[variant] || URL_FRAME_VARIANTS.web;
  const FrameIcon = cfg.Icon;
  const [url, setUrl] = useState(syncState?.url || ''); // URL chargée dans l'iframe
  const [inputUrl, setInputUrl] = useState(syncState?.inputUrl || '');
  // 'blank' = état initial, 'loading' = chargement en cours, 'ok' = chargé, 'blocked' = X-Frame refus
  const [iframeState, setIframeState] = useState(syncState?.iframeState || 'blank');
  const [denyMessage, setDenyMessage] = useState('');
  const iframeRef  = useRef(null);
  const loadTimer  = useRef(null);
  const historyStackRef = useRef([]);
  const historyIndexRef = useRef(-1);
  const emitState = useCallback((patch) => {
    onSyncStateChange?.((prev) => ({
      ...(prev && typeof prev === 'object' ? prev : {}),
      ...patch,
      updatedAt: Date.now(),
    }));
  }, [onSyncStateChange]);

  useEffect(() => {
    if (!syncState || typeof syncState !== 'object') return;
    if (typeof syncState.url === 'string' && syncState.url !== url) setUrl(syncState.url);
    if (typeof syncState.inputUrl === 'string' && syncState.inputUrl !== inputUrl) setInputUrl(syncState.inputUrl);
    if (typeof syncState.iframeState === 'string' && syncState.iframeState !== iframeState) {
      setIframeState(syncState.iframeState);
    }
  }, [syncState, url, inputUrl, iframeState]);

  const navigate = useCallback((target) => {
    if (readOnly) return;
    let finalUrl = target.trim();
    if (!finalUrl) return;
    if (!/^https?:\/\//i.test(finalUrl)) finalUrl = 'https://' + finalUrl;
    if (variant === 'secure_app' && !isSecureAppDomainAllowed(finalUrl)) {
      const denied = "Domaine non autorisé pour App secure. Utilisez un domaine de la whitelist.";
      setDenyMessage(denied);
      setIframeState('blocked');
      emitState({ iframeState: 'blocked', deniedReason: denied });
      return;
    }
    setDenyMessage('');
    setUrl(finalUrl);
    setInputUrl(finalUrl);
    if (historyIndexRef.current < historyStackRef.current.length - 1) {
      historyStackRef.current = historyStackRef.current.slice(0, historyIndexRef.current + 1);
    }
    historyStackRef.current.push(finalUrl);
    historyIndexRef.current = historyStackRef.current.length - 1;
    setIframeState('loading');
    emitState({
      url: finalUrl,
      inputUrl: finalUrl,
      iframeState: 'loading',
      canGoBack: historyIndexRef.current > 0,
      canGoForward: historyIndexRef.current < historyStackRef.current.length - 1,
    });
    // Si l'iframe ne charge pas dans 5s → probablement bloqué
    clearTimeout(loadTimer.current);
    loadTimer.current = setTimeout(() => {
      setIframeState('blocked');
      emitState({ iframeState: 'blocked' });
    }, 5000);
  }, [readOnly, emitState, variant]);

  const handleKey = (e) => { if (e.key === 'Enter') navigate(inputUrl); };

  const reload = () => {
    if (readOnly) return;
    if (!url) return;
    setIframeState('loading');
    emitState({ iframeState: 'loading' });
    clearTimeout(loadTimer.current);
    loadTimer.current = setTimeout(() => {
      setIframeState('blocked');
      emitState({ iframeState: 'blocked' });
    }, 5000);
    if (iframeRef.current) {
      try { iframeRef.current.src = url; } catch {}
    }
  };

  const goBack = useCallback(() => {
    if (readOnly || variant !== 'secure_app') return;
    if (historyIndexRef.current <= 0) return;
    historyIndexRef.current -= 1;
    const next = historyStackRef.current[historyIndexRef.current];
    if (!next) return;
    setDenyMessage('');
    setUrl(next);
    setInputUrl(next);
    setIframeState('loading');
    emitState({
      url: next,
      inputUrl: next,
      iframeState: 'loading',
      canGoBack: historyIndexRef.current > 0,
      canGoForward: historyIndexRef.current < historyStackRef.current.length - 1,
    });
  }, [emitState, readOnly, variant]);

  const goForward = useCallback(() => {
    if (readOnly || variant !== 'secure_app') return;
    if (historyIndexRef.current >= historyStackRef.current.length - 1) return;
    historyIndexRef.current += 1;
    const next = historyStackRef.current[historyIndexRef.current];
    if (!next) return;
    setDenyMessage('');
    setUrl(next);
    setInputUrl(next);
    setIframeState('loading');
    emitState({
      url: next,
      inputUrl: next,
      iframeState: 'loading',
      canGoBack: historyIndexRef.current > 0,
      canGoForward: historyIndexRef.current < historyStackRef.current.length - 1,
    });
  }, [emitState, readOnly, variant]);

  const goHome = useCallback(() => {
    if (readOnly || variant !== 'secure_app') return;
    const home = String(syncState?.homeUrl || `${getActiveTenantBranding().publicSiteOrigin}/`);
    navigate(home);
    emitState({ homeUrl: home });
  }, [emitState, navigate, readOnly, syncState?.homeUrl, variant]);

  const openExternal = () => {
    const target = url || (inputUrl.trim() ? ((/^https?:\/\//i.test(inputUrl) ? inputUrl : 'https://' + inputUrl)) : null);
    if (target) window.open(target, '_blank', 'noopener');
  };

  // Quand l'iframe se charge : annuler le timer de blocage et vérifier si le contenu est accessible
  const handleLoad = useCallback(() => {
    clearTimeout(loadTimer.current);
    try {
      // Si contentDocument est accessible et vide → page bloquée (certains navigateurs)
      const doc = iframeRef.current?.contentDocument;
      if (doc !== null && doc !== undefined && doc.body && doc.body.innerHTML.trim() === '') {
        setIframeState('blocked');
        emitState({ iframeState: 'blocked' });
        return;
      }
    } catch {
      // Cross-origin : normal pour les sites externes — pas une erreur
    }
    setIframeState('ok');
    emitState({ iframeState: 'ok' });
  }, [emitState]);

  useEffect(() => () => clearTimeout(loadTimer.current), []);

  const suggestions = [
    { label: 'Wikipedia', url: 'https://fr.wikipedia.org' },
    { label: 'MDN Docs', url: 'https://developer.mozilla.org/fr' },
    { label: 'YouTube', url: 'https://www.youtube.com' },
    { label: 'OpenStreetMap', url: 'https://www.openstreetmap.org' },
  ];

  return (
    <div className={cn('absolute inset-0 flex flex-col', SCENE_STAGE_GRID)}>
      {/* URL bar — shell designer */}
      <div className={cn(SCENE_TOOLBAR, 'items-center')}>
        <FrameIcon
          className={cn(
            'h-3.5 w-3.5 shrink-0',
            iframeState === 'loading' ? 'animate-spin text-amber-400' : 'text-white/45',
          )}
        />
        {variant === 'secure_app' ? (
          <>
            <button
              type="button"
              onClick={goBack}
              disabled={readOnly || historyIndexRef.current <= 0}
              className={cn(designerShellChipGhost, 'flex h-8 w-8 items-center justify-center p-0')}
              title="Retour"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={goForward}
              disabled={readOnly || historyIndexRef.current >= historyStackRef.current.length - 1}
              className={cn(designerShellChipGhost, 'flex h-8 w-8 items-center justify-center p-0')}
              title="Suivant"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={goHome}
              disabled={readOnly}
              className={cn(designerShellChipGhost, 'flex h-8 w-8 items-center justify-center p-0')}
              title="Home"
            >
              <Home className="h-3.5 w-3.5" />
            </button>
          </>
        ) : null}
        <input
          value={inputUrl}
          onChange={(e) => {
            const next = e.target.value;
            setInputUrl(next);
            emitState({ inputUrl: next });
          }}
          onKeyDown={handleKey}
          placeholder={cfg.placeholder}
          disabled={readOnly}
          className={cn(designerShellInput, 'h-8 min-w-0 flex-1 text-[13px]')}
        />
        <button type="button" onClick={() => navigate(inputUrl)} disabled={readOnly} className={cn(designerShellBtnGold, 'h-8 shrink-0 px-3 py-0 text-[11px]')}>
          Aller
        </button>
        {url ? (
          <button
            type="button"
            onClick={reload}
            disabled={readOnly}
            className={cn(designerShellChipGhost, 'flex h-8 w-8 items-center justify-center p-0')}
            title="Recharger"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        ) : null}
        <button
          type="button"
          onClick={openExternal}
          className={cn(designerShellChipGhost, 'flex h-8 w-8 items-center justify-center p-0')}
          title="Ouvrir dans un nouvel onglet"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Contenu */}
      <div className="relative min-h-0 flex-1 overflow-hidden">

        {/* État initial — page vide */}
        {iframeState === 'blank' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 px-6 text-center">
            <div className={cn(designerShellEmbedPanel, 'max-w-md px-5 py-6')}>
              <FrameIcon className="mx-auto mb-3 h-10 w-10 text-amber-400/35" />
              <p className="mb-2 text-center text-sm font-semibold text-white/88">{cfg.emptyLead}</p>
              <p className="text-[12px] leading-relaxed text-white/42">{cfg.emptyHint}</p>
            </div>
            {cfg.showSuggestions && (
              <div className="flex flex-wrap items-center justify-center gap-2">
                {suggestions.map((s) => (
                  <button
                    key={s.url}
                    type="button"
                    onClick={() => {
                      setInputUrl(s.url);
                      navigate(s.url);
                    }}
                    className={cn(designerShellChipGhost, 'cursor-pointer px-3 py-1.5 text-[12px] text-white/65')}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            )}
            {cfg.showShare && onShareScreen && (
              <button
                type="button"
                onClick={onShareScreen}
                className={cn(designerShellChipGhost, 'flex h-9 cursor-pointer items-center gap-2 px-4 text-[12px] text-white/70')}
              >
                <MonitorPlay className="h-3.5 w-3.5" />
                Partager l&apos;écran ici
              </button>
            )}
          </div>
        )}

        {/* Site bloqué — X-Frame-Options */}
        {iframeState === 'blocked' && (
          <div className={cn('absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 px-6 text-center', SCENE_STAGE_GRID)}>
            <div className={cn(designerShellEmbedPanel, 'max-w-md px-5 py-5')}>
              <AlertCircle className="mx-auto mb-3 h-9 w-9 text-amber-400/70" />
              <p className="mb-1 text-[13px] font-semibold text-white/88">Affichage intégré impossible</p>
              {denyMessage ? (
                <p className="mb-2 text-[12px] leading-relaxed text-amber-200/90">{denyMessage}</p>
              ) : null}
              <p className="text-[12px] leading-relaxed text-white/45">{cfg.blockedHint}</p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {cfg.showShare && onShareScreen && (
                <button
                  type="button"
                  onClick={() => {
                    openExternal();
                    setTimeout(onShareScreen, 800);
                  }}
                  className={cn(designerShellBtnGold, 'flex h-8 items-center gap-2 px-3 text-[11px]')}
                >
                  <MonitorPlay className="h-3.5 w-3.5" />
                  Ouvrir + partager l&apos;écran
                </button>
              )}
              <button
                type="button"
                onClick={openExternal}
                className={cn(designerShellChipGhost, 'flex h-8 items-center gap-2 px-3 text-[11px]')}
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Nouvel onglet
              </button>
              <button
                type="button"
                onClick={() => setIframeState('blank')}
                className={cn(designerShellChipGhost, 'h-8 px-3 text-[11px]')}
              >
                Retour
              </button>
            </div>
          </div>
        )}

        {/* iframe — affiché seulement quand une URL est chargée */}
        {url && iframeState !== 'blocked' && (
          <iframe
            ref={iframeRef}
            src={url}
            title="Navigateur intégré"
            className={cn('w-full h-full border-0 absolute inset-0', iframeState === 'loading' ? 'opacity-0' : 'opacity-100')}
            allow="camera; microphone; fullscreen; clipboard-write"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-top-navigation-by-user-activation"
            onLoad={handleLoad}
            onError={() => {
              clearTimeout(loadTimer.current);
              setIframeState('blocked');
              emitState({ iframeState: 'blocked' });
            }}
          />
        )}
      </div>
    </div>
  );
}

// ── Calque UI partage d'écran (la balise <video> est montée en permanence plus bas pour LiveKit) ──
function ScreenShareSceneLayer({ active }) {
  if (!active) {
    return (
      <div className={cn('absolute inset-0 z-[12] flex flex-col items-center justify-center', SCENE_STAGE_GRID)}>
        <div className={cn(designerShellEmbedPanel, 'max-w-sm px-5 py-6 text-center')}>
          <MonitorPlay className="mx-auto mb-3 h-10 w-10 text-amber-400/40" />
          <p className="text-sm font-semibold text-white/80">Aucun écran partagé</p>
          <p className="mt-2 text-[11px] leading-relaxed text-white/42">
            Utilisez « Partager l&apos;écran » dans la barre du live — le flux s&apos;affiche ici.
          </p>
        </div>
      </div>
    );
  }
  return (
    <div className="absolute inset-0 z-[12] pointer-events-none">
      <div className="absolute top-3 left-3 flex items-center gap-1.5 h-5 px-2 rounded-full bg-black/60 border border-white/15 pointer-events-auto">
        <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
        <span className="text-[9px] text-white/70">Écran partagé</span>
      </div>
    </div>
  );
}

// ── Camera 2 — flux salle (LiveKit) ou 2ᵉ webcam locale ───────────────────────
function fluxParticipantLabel(p) {
  if (p?.isLocal) return 'Ma caméra principale';
  return p?.name || p?.id || 'Participant';
}

function usbVideoLabel(d, index) {
  const raw = (d.label || '').trim();
  if (raw.length > 0 && raw.length <= 36) return raw;
  if (raw.length > 36) return `${raw.slice(0, 34)}…`;
  return `Caméra ${index + 1}`;
}

function Camera2SourcePickerBody({
  fluxParticipants,
  devices,
  onPickRemote,
  onPickLocal,
  onPickLocalFacing,
  onPickLocalDisplay,
  showIntro = true,
}) {
  const showPhoneBlock = Boolean(onPickLocalFacing || onPickLocalDisplay);
  return (
    <div className="pointer-events-auto flex w-full max-w-md flex-col items-center gap-4 px-4 text-white/30">
      {showIntro && (
        <>
          <Camera className="h-10 w-10" />
          <p className="text-center text-sm text-white/50">
            Flux d&apos;un participant, webcam USB, ou caméra / écran mobile.
          </p>
        </>
      )}

      {showPhoneBlock && (
        <div
          className={cn(
            designerShellCardInset,
            'w-full max-w-xs space-y-2 border-amber-500/20 bg-amber-500/[0.06]',
          )}
        >
          <p className={cn(designerShellMicroLabel, 'flex items-center gap-1.5 text-amber-200/85')}>
            <Smartphone className="h-3 w-3" />
            Téléphone / tablette
          </p>
          <p className="text-[10px] leading-snug text-white/42">
            QR « QR tel. » sur le dock : l&apos;appareil rejoint la salle comme{' '}
            <strong className="text-white/60">Téléphone (QR)</strong>. Sinon : selfie, caméra arrière ou écran via le navigateur.
          </p>
          <div className="flex flex-col gap-1.5">
            {onPickLocalFacing ? (
              <>
                <button
                  type="button"
                  onClick={() => onPickLocalFacing('user')}
                  className="h-9 w-full rounded-xl border border-amber-500/35 bg-amber-500/12 text-xs font-medium text-amber-50/95 transition-colors hover:bg-amber-500/18"
                >
                  Selfie (caméra avant)
                </button>
                <button
                  type="button"
                  onClick={() => onPickLocalFacing('environment')}
                  className="h-9 w-full rounded-xl border border-amber-500/28 bg-amber-500/10 text-xs font-medium text-amber-100/90 transition-colors hover:bg-amber-500/16"
                >
                  Caméra arrière (document ou pièce)
                </button>
              </>
            ) : null}
            {onPickLocalDisplay ? (
              <button
                type="button"
                onClick={() => void onPickLocalDisplay()}
                className="h-9 w-full rounded-xl border border-white/12 bg-white/[0.06] text-xs font-medium text-white/88 transition-colors hover:border-white/18 hover:bg-white/[0.1]"
              >
                Écran de l&apos;appareil (temps réel)
              </button>
            ) : null}
          </div>
        </div>
      )}

      <div className={cn(designerShellCardInset, 'w-full max-w-xs space-y-2')}>
        <p className={cn(designerShellMicroLabel, 'flex items-center gap-1.5 text-white/48')}>
          <UserSquare2 className="h-3 w-3" />
          Flux de la salle
        </p>
        {fluxParticipants.length > 0 ? (
          <>
            {fluxParticipants.length === 2 ? (
              <p className="text-[9px] leading-snug text-white/38">Une pression affiche le flux sur Caméra 2.</p>
            ) : null}
            {fluxParticipants.length === 2 ? (
              <div className={designerShellSegmentedRail}>
                {fluxParticipants.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => onPickRemote(p.id)}
                    className={designerShellSegmentedSlot(false)}
                  >
                    <UserSquare2 className="h-3.5 w-3.5 shrink-0 text-amber-300/75" />
                    <span className="line-clamp-2 text-center text-[10px] font-semibold leading-tight text-white/80">
                      {fluxParticipantLabel(p)}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                {fluxParticipants.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => onPickRemote(p.id)}
                    className={cn(
                      designerShellDeviceRow(false),
                      'items-stretch py-2',
                    )}
                  >
                    <UserSquare2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-300/75" />
                    <span className="min-w-0 flex-1 text-left text-xs font-medium text-white/82">
                      {fluxParticipantLabel(p)}
                    </span>
                    <span className="shrink-0 self-center text-[9px] font-semibold uppercase tracking-wide text-amber-200/80">
                      Afficher
                    </span>
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <p className="text-[11px] text-white/35">Aucun participant pour l'instant.</p>
        )}
      </div>

      <div className={cn(designerShellCardInset, 'w-full max-w-xs space-y-2')}>
        <p className={designerShellMicroLabel}>Webcam USB ou intégrée</p>
        {devices.length > 0 ? (
          <>
            {devices.length === 2 ? (
              <p className="text-[9px] leading-snug text-white/38">Deux sources : basculez d&apos;un clic.</p>
            ) : null}
            {devices.length === 2 ? (
              <div className={designerShellSegmentedRail}>
                {devices.map((d, i) => (
                  <button
                    key={d.deviceId}
                    type="button"
                    onClick={() => onPickLocal(d.deviceId)}
                    className={designerShellSegmentedSlot(false)}
                  >
                    <Camera className="h-3.5 w-3.5 shrink-0 text-amber-200/70" />
                    <span className="line-clamp-2 text-center text-[10px] font-semibold leading-tight text-white/80">
                      {usbVideoLabel(d, i)}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                {devices.map((d, i) => (
                  <button
                    key={d.deviceId}
                    type="button"
                    onClick={() => onPickLocal(d.deviceId)}
                    className={cn(designerShellDeviceRow(false), 'items-center py-2')}
                  >
                    <Camera className="h-3.5 w-3.5 shrink-0 text-amber-200/65" />
                    <span className="min-w-0 flex-1 truncate text-left text-xs font-medium text-white/82">
                      {usbVideoLabel(d, i)}
                    </span>
                    <span className="shrink-0 text-[9px] font-semibold uppercase tracking-wide text-amber-200/75">
                      Utiliser
                    </span>
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <p className="text-center text-[11px] text-amber-200/55">
            Autorisez la caméra dans le navigateur pour lister les périphériques.
          </p>
        )}
      </div>
    </div>
  );
}

function Camera2Scene({
  videoRef,
  active,
  onStart,
  readOnlySceneNavigator = false,
  fluxParticipants = [],
  placeholder = null,
  waitingRemote = false,
}) {
  const [devices, setDevices] = useState([]);
  const [sourcePickerOpen, setSourcePickerOpen] = useState(false);

  const needDeviceEnumeration = !readOnlySceneNavigator && (!active || sourcePickerOpen);

  useEffect(() => {
    if (!active) setSourcePickerOpen(false);
  }, [active]);

  useEffect(() => {
    if (!sourcePickerOpen || !active || readOnlySceneNavigator) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setSourcePickerOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sourcePickerOpen, active, readOnlySceneNavigator]);

  useEffect(() => {
    if (!needDeviceEnumeration) return undefined;
    let cancelled = false;
    (async () => {
      try {
        await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      } catch {
        /* permission refusée : on tente quand même enumerate */
      }
      try {
        const all = await navigator.mediaDevices.enumerateDevices();
        if (cancelled) return;
        const vids = all.filter((d) => d.kind === 'videoinput');
        setDevices(vids);
      } catch {
        if (!cancelled) setDevices([]);
      }
    })();
    return () => { cancelled = true; };
  }, [needDeviceEnumeration]);

  const applyRemote = useCallback((id) => {
    onStart?.({ type: 'remote_camera', identity: id });
    setSourcePickerOpen(false);
  }, [onStart]);

  const applyLocal = useCallback((did) => {
    onStart?.({ type: 'local_aux', deviceId: did });
    setSourcePickerOpen(false);
  }, [onStart]);

  const applyLocalFacing = useCallback((mode) => {
    if (mode !== 'user' && mode !== 'environment') return;
    onStart?.({ type: 'local_aux', facingMode: mode });
    setSourcePickerOpen(false);
  }, [onStart]);

  const applyLocalDisplay = useCallback(() => {
    onStart?.({ type: 'local_display' });
    setSourcePickerOpen(false);
  }, [onStart]);

  if (readOnlySceneNavigator && placeholder) {
    return (
      <div className={cn('absolute inset-0 flex flex-col items-center justify-center px-6 text-center', SCENE_STAGE_GRID)}>
        <div className={cn(designerShellEmbedPanel, 'max-w-sm px-5 py-6')}>
          <UserSquare2 className="mx-auto mb-3 h-10 w-10 text-white/30" />
          <p className="text-sm text-white/55">{placeholder}</p>
        </div>
      </div>
    );
  }

  if (readOnlySceneNavigator && waitingRemote) {
    return (
      <div className={cn('absolute inset-0 flex flex-col items-center justify-center gap-3 px-6', SCENE_STAGE_GRID)}>
        <div className="h-9 w-9 animate-spin rounded-full border-2 border-amber-500/35 border-t-amber-400" />
        <p className="text-center text-xs text-white/48">Connexion à la vidéo du participant…</p>
      </div>
    );
  }

  return (
    <div className={cn('absolute inset-0 flex items-center justify-center', SCENE_STAGE_GRID)}>
      {active ? (
        <>
          <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
          <div className="absolute top-3 left-3 z-[21] flex items-center gap-1.5 h-5 px-2 rounded-full bg-black/60 border border-white/15 pointer-events-none">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-[9px] text-white/70">Caméra 2</span>
          </div>
          {!readOnlySceneNavigator && (
            <button
              type="button"
              onClick={() => setSourcePickerOpen(true)}
              className="pointer-events-auto absolute right-3 top-3 z-[21] flex h-7 items-center gap-1.5 rounded-xl border border-white/12 bg-black/75 px-2.5 text-[10px] font-medium text-white/88 backdrop-blur-sm transition-colors hover:border-amber-500/35 hover:bg-black/88"
            >
              <RefreshCw className="h-3 w-3 text-amber-200/85" />
              Changer la source
            </button>
          )}
          {!readOnlySceneNavigator && sourcePickerOpen && (
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Changer la source Caméra 2"
              className="absolute inset-0 z-[22] flex items-center justify-center p-3 bg-black/55 backdrop-blur-md pointer-events-auto"
              onClick={() => setSourcePickerOpen(false)}
            >
              <div
                className="relative max-h-[88%] w-full max-w-md overflow-y-auto rounded-2xl border border-white/[0.09] bg-[#1f1e1c]/95 py-4 shadow-2xl ring-1 ring-inset ring-white/[0.02] [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.12)_transparent]"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between gap-2 border-b border-white/[0.08] px-4 pb-3">
                  <p className="text-sm font-semibold text-white/92">Source Caméra 2</p>
                  <button
                    type="button"
                    onClick={() => setSourcePickerOpen(false)}
                    className="flex h-8 w-8 items-center justify-center rounded-xl text-white/55 transition-colors hover:bg-white/[0.08] hover:text-white/85"
                    aria-label="Fermer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="pt-4">
                  <Camera2SourcePickerBody
                    fluxParticipants={fluxParticipants}
                    devices={devices}
                    onPickRemote={applyRemote}
                    onPickLocal={applyLocal}
                    onPickLocalFacing={applyLocalFacing}
                    onPickLocalDisplay={applyLocalDisplay}
                    showIntro={false}
                  />
                </div>
              </div>
            </div>
          )}
        </>
      ) : readOnlySceneNavigator ? (
        <div className={cn(designerShellEmbedPanel, 'mx-4 max-w-sm px-5 py-6 text-center')}>
          <Camera className="mx-auto mb-2 h-8 w-8 text-white/35" />
          <p className="text-xs text-white/45">En attente du flux Cam 2…</p>
        </div>
      ) : (
        <div className="flex w-full max-w-md flex-col items-center gap-4 px-4">
          <div className={cn(designerShellEmbedPanel, 'w-full px-4 py-5 text-center')}>
            <Camera className="mx-auto mb-3 h-10 w-10 text-amber-400/40" />
            <p className="text-[13px] font-semibold text-white/80">Caméra 2</p>
            <p className="mt-1 text-[11px] leading-relaxed text-white/42">
              Téléphone, écran de l&apos;appareil, autre webcam ou flux d&apos;un participant.
            </p>
          </div>
          <Camera2SourcePickerBody
            fluxParticipants={fluxParticipants}
            devices={devices}
            onPickRemote={applyRemote}
            onPickLocal={applyLocal}
            onPickLocalFacing={applyLocalFacing}
            onPickLocalDisplay={applyLocalDisplay}
            showIntro={false}
          />
        </div>
      )}
    </div>
  );
}

// ── Shop / Boutique scene ────────────────────────────────────────────────────
function ShopScene({ products = [], onProductClick }) {
  const categories = {};
  products.forEach((p) => {
    const cat = p.category || 'Autre';
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push(p);
  });
  const catEntries = Object.entries(categories);

  return (
    <div className={cn('absolute inset-0 flex flex-col overflow-hidden', SCENE_STAGE_GRID)}>
      <div className={cn(SCENE_TOOLBAR, 'items-center')}>
        <span className="text-lg" aria-hidden>
          🛒
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-amber-100/95">Boutique en direct</h3>
          <p className="text-[10px] text-white/40">Cliquez sur un produit pour accéder au paiement</p>
        </div>
        <div className="flex-1" />
        <span
          className={cn(
            designerShellChipGhost,
            'rounded-full px-2.5 py-0.5 text-[10px] tabular-nums text-white/55',
          )}
        >
          {products.length} produit{products.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4 [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.12)_transparent]">
        {products.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3">
            <div className={cn(designerShellEmbedPanel, 'max-w-sm px-6 py-8 text-center')}>
              <span className="text-3xl" aria-hidden>
                🏪
              </span>
              <p className="mt-3 text-sm font-medium text-white/55">Aucun produit configuré</p>
              <p className="mt-1 text-[11px] text-white/35">Ajoutez des produits dans la configuration du live.</p>
            </div>
          </div>
        ) : (
          catEntries.map(([cat, items]) => (
            <div key={cat}>
              <p className={cn(designerShellMicroLabel, 'mb-2')}>{cat}</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((product, i) => (
                  <motion.button
                    key={product.id || i}
                    type="button"
                    whileHover={{ scale: 1.02, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => onProductClick?.(product)}
                    className={cn(
                      designerShellCardInset,
                      'group text-left transition-all hover:border-amber-500/30 hover:shadow-[0_8px_32px_rgba(245,158,11,0.12)]',
                    )}
                  >
                    {product.image && (
                      <div className="w-full aspect-video rounded-lg overflow-hidden mb-3 bg-black/30">
                        <img src={product.image} alt="" className="w-full h-full object-cover" />
                      </div>
                    )}
                    {product.badge && (
                      <span className="inline-block text-[9px] uppercase tracking-wider font-bold bg-[color-mix(in_srgb,var(--school-accent)_15%,transparent)] text-[var(--school-accent)] px-2 py-0.5 rounded-full mb-2 border border-[color-mix(in_srgb,var(--school-accent)_25%,transparent)]">
                        {product.badge}
                      </span>
                    )}
                    <h4 className="text-sm font-semibold text-white group-hover:text-[var(--school-accent)] transition-colors leading-tight">
                      {product.name}
                    </h4>
                    {product.description && (
                      <p className="mt-1 line-clamp-2 text-[11px] text-white/40">{product.description}</p>
                    )}
                    <div className="flex items-center justify-between mt-3 pt-2 border-t border-white/5">
                      <span className="text-base font-bold text-[var(--school-accent)]">
                        {product.price != null ? `${product.price} ${product.currency || 'EUR'}` : 'Gratuit'}
                      </span>
                      <span className="text-[10px] text-[var(--school-accent)] font-semibold bg-[color-mix(in_srgb,var(--school-accent)_10%,transparent)] px-2.5 py-1 rounded-full border border-[color-mix(in_srgb,var(--school-accent)_25%,transparent)] group-hover:bg-[color-mix(in_srgb,var(--school-accent)_20%,transparent)] transition-colors">
                        {product.cta || 'Acheter →'}
                      </span>
                    </div>
                    {product.interval && (
                      <span className="mt-1 block text-[9px] text-white/32">
                        {product.interval === 'one_time' ? 'Paiement unique' : product.interval === 'monthly' ? '/ mois' : product.interval === 'yearly' ? '/ an' : `/ ${product.interval}`}
                      </span>
                    )}
                  </motion.button>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ── Tooltips dock (nom + aide au survol) ─────────────────────────────────────
function SceneNavTooltip({ scene, premiumArenaHostTray, children }) {
  return (
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent
        side="left"
        sideOffset={12}
        className={cn(
          'max-w-[min(92vw,268px)] border px-3 py-2.5 text-left shadow-[0_14px_44px_-14px_rgba(0,0,0,0.82)]',
          premiumArenaHostTray
            ? 'border-amber-400/35 bg-[#1f1e1c]/97 text-amber-50'
            : 'border-amber-400/32 bg-[#0f0e0a]/97 text-amber-50',
        )}
      >
        <p
          className={cn(
            'text-[11px] font-bold uppercase tracking-[0.07em]',
            premiumArenaHostTray ? 'text-amber-100' : 'text-amber-100',
          )}
        >
          {scene.label}
        </p>
        {scene.hint ? (
          <p className="mt-1.5 text-[10px] font-medium leading-relaxed text-white/50">{scene.hint}</p>
        ) : null}
      </TooltipContent>
    </Tooltip>
  );
}

function DockChromeTooltip({ label, description, children }) {
  return (
    <Tooltip delayDuration={220}>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent
        side="left"
        sideOffset={11}
        className="max-w-[240px] border border-white/14 bg-[#0c0f16]/97 px-3 py-2 text-left shadow-[0_14px_40px_-12px_rgba(0,0,0,0.8)]"
      >
        <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-amber-100/95">{label}</p>
        {description ? (
          <p className="mt-1 text-[10px] font-medium leading-relaxed text-white/48">{description}</p>
        ) : null}
      </TooltipContent>
    </Tooltip>
  );
}

/** Boutons chrome dock — alignés shell designer (cartes #1f1e1c, hover discret) */
function dockChromeBtnClass(premiumArenaHostTray) {
  return cn(
    'flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border transition-all duration-200 ease-out',
    'border-white/[0.08] bg-[#1f1e1c]/95 text-white/52',
    'shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]',
    premiumArenaHostTray
      ? 'hover:border-amber-400/35 hover:bg-[#2a2723] hover:text-amber-100 hover:shadow-[0_0_28px_-10px_rgba(212,163,106,0.28)]'
      : 'hover:border-amber-400/32 hover:bg-[#1a1814] hover:text-amber-100/95 hover:shadow-[0_0_28px_-10px_rgba(251,191,36,0.22)]',
    'active:scale-[0.96] disabled:pointer-events-none disabled:opacity-[0.22]',
  );
}

// ── Scene thumbnail — style premium + tooltip nom / description ─────────────
const SceneThumbnail = forwardRef(function SceneThumbnail(
  { scene, active, onClick, readOnly, premiumArenaHostTray, dockScale = 1 },
  ref,
) {
  const cls = cn(
    'relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border transition-all duration-200 ease-out',
    active
      ? premiumArenaHostTray
        ? 'border-amber-400/45 bg-gradient-to-b from-amber-500/22 to-[#1a1512] text-amber-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_0_20px_-12px_rgba(212,163,106,0.45)]'
        : 'border-amber-400/42 bg-gradient-to-b from-amber-500/18 to-[#14100c] text-amber-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_20px_-12px_rgba(245,158,11,0.3)]'
      : cn(
          'border-white/[0.07] bg-[#1f1e1c]/90 text-white/48',
          'shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]',
          !readOnly &&
            (premiumArenaHostTray
              ? 'hover:border-amber-400/28 hover:bg-[#2a2723] hover:text-amber-100/90'
              : 'hover:border-amber-400/26 hover:bg-[#1c1a16] hover:text-amber-100/90'),
        ),
    readOnly ? 'cursor-default opacity-[0.96]' : 'cursor-pointer',
  );
  const dotCls = cn(
    'pointer-events-none absolute bottom-[5px] left-1/2 h-[3px] w-[18px] -translate-x-1/2 rounded-full transition-all duration-200',
    active ? 'opacity-100' : 'opacity-0',
    premiumArenaHostTray
      ? 'bg-amber-300/90 shadow-[0_0_8px_rgba(212,163,106,0.65)]'
      : 'bg-amber-300/90 shadow-[0_0_8px_rgba(252,211,77,0.5)]',
  );
  const inner = (
    <>
      <SmartboardNavigatorSceneIcon sceneId={scene.id} className="h-5 w-5 shrink-0" strokeWidth={1.35} />
      <span className="sr-only">{scene.label}</span>
      <span aria-hidden className={dotCls} />
    </>
  );
  const spring = { type: 'spring', stiffness: 420, damping: 28, mass: 0.32 };
  const tapScale = readOnly ? dockScale : Math.max(0.88, dockScale * 0.94);

  if (readOnly) {
    return (
      <SceneNavTooltip scene={scene} premiumArenaHostTray={premiumArenaHostTray}>
        <motion.div
          ref={ref}
          role="presentation"
          className={cls}
          animate={{ scale: dockScale }}
          transition={spring}
          style={{ zIndex: dockScale > 1.04 ? 3 : 1 }}
        >
          {inner}
        </motion.div>
      </SceneNavTooltip>
    );
  }
  return (
    <SceneNavTooltip scene={scene} premiumArenaHostTray={premiumArenaHostTray}>
      <motion.button
        ref={ref}
        type="button"
        onClick={onClick}
        whileTap={{ scale: tapScale }}
        className={cls}
        animate={{ scale: dockScale }}
        transition={spring}
        style={{ zIndex: dockScale > 1.04 ? 3 : 1 }}
      >
        {inner}
      </motion.button>
    </SceneNavTooltip>
  );
});
SceneThumbnail.displayName = 'SceneThumbnail';

/** Pile diapo / annotations — utilisée une fois par scène joker (natif vs import), pas une seule branche fusionnée. */
function ParallaxSlideSceneStack({
  slide,
  spotlight,
  progressivePlayback,
  onSmartboardImageExpand,
  tacticalSyncRole,
  remoteTacticalSync,
  onTacticalSyncChange,
  readOnlySceneNavigator,
  annotationStrokes,
  onAnnotationStrokesChange,
  onSaveStroke,
  /** SmartBoard natif : fondu bords par défaut ; diapo importé : non (sauf si la slide définit une intensité). */
  immersiveEdgeDefault = true,
  /** LiveHost : remplissage cover + fond transparent (pas de cadre bleu Architect). */
  liveStageFillCover = false,
}) {
  return (
    <div className="absolute inset-0 min-h-0">
      <SlideParallaxStage
        slide={slide}
        spotlight={spotlight}
        progressivePlayback={progressivePlayback}
        onSmartboardImageExpand={onSmartboardImageExpand}
        tacticalSyncRole={tacticalSyncRole}
        remoteTacticalSync={remoteTacticalSync}
        onTacticalSyncChange={onTacticalSyncChange}
        immersiveEdgeDefault={liveStageFillCover ? false : immersiveEdgeDefault}
        liveStageFillCover={liveStageFillCover}
      />
      <SlideAnnotationOverlay
        readOnly={readOnlySceneNavigator}
        slideId={slide?.id ?? null}
        strokes={annotationStrokes}
        onStrokesChange={onAnnotationStrokesChange}
        onSaveStroke={onSaveStroke}
      />
    </div>
  );
}

// ── Main compositor ───────────────────────────────────────────────────────────
export default function SmartBoardCompositor({
  // SmartBoard natif et diaporama importé : deux scènes distinctes (joker) — slide doit correspondre à la scène active (résolu côté shell).
  slide,
  spotlight,
  /** false = slide entière visible (sync hôte → invités via LiveArena) */
  progressivePlayback = true,
  /** Hôte : clic sur une image SmartBoard → diffusion modale salle */
  onSmartboardImageExpand,
  // Screen source
  screenVideoRef,
  screenActive = false,
  // Image source
  sharedImageSrc = '',
  sharedGalleryLength = 0,
  sharedImageIndex = 0,
  onSharedImagePrev,
  onSharedImageNext,
  sharedImageLoop = false,
  onToggleSharedImageLoop,
  // Camera 2 source
  camera2VideoRef,
  camera2Active = false,
  onStartCamera2,
  camera2FluxParticipants = [],
  camera2Placeholder = null,
  camera2WaitingRemote = false,
  // Scene control
  activeScene,
  onChangeScene,
  /** Flags wizard (smartboard_scenes) — filtre le joker */
  sceneFlags: sceneFlagsProp,
  // Whiteboard
  onSaveStroke,
  // PiP — local participant video (background-removed canvas stream)
  pipStream = null,
  // Screen share trigger — permet au mode Web de déclencher le partage d'écran
  onShareScreen = null,
  // Shop / Boutique
  shopProducts = [],
  onShopProductClick = null,
  /** Bandeau de scènes type maquette LIRI hôte : bord or sur le tray, onglet actif violet */
  premiumArenaHostTray = false,
  /**
   * Effet « Dock magnification » (survol) sur les icônes — actif seulement si `premiumArenaHostTray`.
   * Style proche du dock macOS : l'icône sous le pointeur grossit, les voisines un peu aussi.
   */
  sceneDockMagnification = true,
  /** Invités : scène pilotée par l'hôte (realtime) — pas de changement local */
  readOnlySceneNavigator = false,
  annotationStrokes = [],
  onAnnotationStrokesChange = null,
  /** Traits tableau blanc (scène board) — séparés des annotations diapo / slide. */
  whiteboardStrokes = [],
  onWhiteboardStrokesChange = null,
  /** Live : 'host' | 'viewer' | undefined — sync tactique SmartBoard */
  tacticalSyncRole = undefined,
  remoteTacticalSync = null,
  onTacticalSyncChange = null,
  /**
   * LiveHost / plein cadre : scène sur toute la hauteur utile (navigateur vertical en overlay à droite).
   */
  expandStageToViewport = false,
  /**
   * 'right' = colonne scènes + PiP à droite du cadre (défaut).
   * 'footer' = scènes dans la barre d'actions parente ; ici seulement PiP (étroit) + NeuroInk sur le bord droit en scène board.
   */
  sceneDockPlacement = 'right',
  /** Téléconsult mobile spectateur : masque ENTIÈREMENT le navigateur de scènes vertical (aucun dock). */
  hideSceneDock = false,
  /**
   * LiveRoomShell affiche déjà `LiveWhiteboardToolsSidebar` dans le rail latéral — éviter le doublon dans le cadre.
   * LiveHost (SmartBoard stage seul) : laisser à false pour monter le rail ici.
   */
  hideEmbeddedWhiteboardToolsRail = false,
  // Consultation MEDOS : active le panneau NeuroInk (IA tableau) piloté par le
  // bouton IA du cockpit (via le flag store `neuroInkOpen`), même hors footer dock.
  showNeuroInk = false,
  /** Pagination tableau blanc : plusieurs « écrans » de dessin (sync côté parent). */
  whiteboardPageIndex = 0,
  whiteboardPageCount = 1,
  onWhiteboardPrevPage = null,
  onWhiteboardNextPage = null,
  onWhiteboardAddPage = null,
  onWhiteboardRemovePage = null,
  /** Scène "app secure" : état URL synchronisé hôte -> invités. */
  secureAppShareState = null,
  onSecureAppShareStateChange = null,
  /** Masque le pastille « n / total » en haut à droite (ex. scènes déjà dans le footer hôte). */
  hideSceneIndexChip = false,
  /** Laser pointer reçu du broadcast hôte (invités) */
  remoteLaserPointer: remoteLaserPointerProp = null,
  /** Callback quand le laser change (hôte → broadcast) */
  onLaserPointerChange = null,
  /** Ref sur le cadre visuel principal (bordure) — capture PNG (cahier invité, etc.) */
  stageCaptureSurfaceRef = null,
  /** Live MEDOS : scène clinique partagée (CockpitScene) à rendre sur la scène 'medos'. */
  medosSharedScene = null,
}) {
  const useFooterSceneDock = sceneDockPlacement === 'footer';
  const sceneFlags = useMemo(() => mergeSmartboardSceneFlags(sceneFlagsProp), [sceneFlagsProp]);
  const scenes = useMemo(() => buildSmartboardNavigatorScenes({ flags: sceneFlags }), [sceneFlags]);
  const sceneIds = scenes.map((s) => s.id);
  const currentScene = sceneIds.includes(activeScene) ? activeScene : (scenes[0]?.id || 'diapo');
  const currentIndex = scenes.findIndex((s) => s.id === currentScene);
  const total = scenes.length;
  const prevIndexRef = useRef(currentIndex);
  const [sceneDirection, setSceneDirection] = useState(1);
  const [sceneFlash, setSceneFlash] = useState(false);
  // Scène « Dossier MEDOS » : le cockpit clinique (MedTeleconsultCockpit) émet la scène
  // partagée via l'event global LIRI_MEDOS_SHARED_SCENE — on l'écoute ici pour l'afficher
  // sur le smartboard central sans threading. Le prop medosSharedScene reste un fallback.
  const [medosSceneFromEvent, setMedosSceneFromEvent] = useState(
    () => (typeof window !== 'undefined' ? window.__liriMedosScene ?? null : null),
  );
  useEffect(() => {
    const onMedosScene = (e) => setMedosSceneFromEvent(e?.detail?.scene ?? null);
    window.addEventListener('LIRI_MEDOS_SHARED_SCENE', onMedosScene);
    return () => window.removeEventListener('LIRI_MEDOS_SHARED_SCENE', onMedosScene);
  }, []);
  const effectiveMedosScene = medosSharedScene ?? medosSceneFromEvent;
  const screenOverIntelligent =
    screenActive
    && (currentScene === 'screen' || SMARTBOARD_INTELLIGENT_SCENES.includes(currentScene));

  const goNext = useCallback(() => {
    if (readOnlySceneNavigator) return;
    const next = scenes[(currentIndex + 1) % total];
    if (next) onChangeScene?.(next.id);
  }, [readOnlySceneNavigator, scenes, currentIndex, total, onChangeScene]);
  const goPrev = useCallback(() => {
    if (readOnlySceneNavigator) return;
    const prev = scenes[(currentIndex - 1 + total) % total];
    if (prev) onChangeScene?.(prev.id);
  }, [readOnlySceneNavigator, scenes, currentIndex, total, onChangeScene]);

  const sceneItemRefs = useRef([]);
  const [dockScales, setDockScales] = useState(null);
  const dockMagnificationEnabled = Boolean(
    premiumArenaHostTray && sceneDockMagnification && total > 0 && !useFooterSceneDock,
  );

  useEffect(() => {
    setDockScales(null);
    sceneItemRefs.current = [];
  }, [scenes.length]);

  const handleSceneDockMove = useCallback(
    (e) => {
      if (!dockMagnificationEnabled) return;
      const container = e.currentTarget;
      const rect = container.getBoundingClientRect();
      const py = e.clientY - rect.top;
      const next = scenes.map((_, i) => {
        const el = sceneItemRefs.current[i];
        if (!el) return 1;
        const er = el.getBoundingClientRect();
        const cy = er.top - rect.top + er.height / 2;
        const d = Math.abs(py - cy);
        const maxBoost = 0.48;
        const radius = 64;
        const t = Math.max(0, 1 - d / radius);
        return 1 + maxBoost * t * t * t;
      });
      setDockScales(next);
    },
    [dockMagnificationEnabled, scenes],
  );

  const handleSceneDockLeave = useCallback(() => {
    if (!dockMagnificationEnabled) return;
    setDockScales(null);
  }, [dockMagnificationEnabled]);

  useEffect(() => {
    const prev = prevIndexRef.current;
    if (currentIndex !== prev) {
      if (currentIndex > prev) setSceneDirection(1);
      else setSceneDirection(-1);
      prevIndexRef.current = currentIndex;
      // Flash de lumière au changement de scène
      setSceneFlash(true);
      const t = setTimeout(() => setSceneFlash(false), 420);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [currentIndex]);

  /** Son navigation d'écran — après premier rendu (évite bruit au mount). */
  const sceneNavSoundReadyRef = useRef(false);
  useEffect(() => {
    if (!sceneNavSoundReadyRef.current) {
      sceneNavSoundReadyRef.current = true;
      return;
    }
    playSmartboardSceneNavigationSound();
  }, [currentScene]);

  // Keyboard left/right to navigate scenes (hôte uniquement)
  useEffect(() => {
    if (readOnlySceneNavigator) return undefined;
    const handler = (e) => {
      if (e.altKey && (e.key === 'ArrowDown' || e.key === 'ArrowRight')) goNext();
      if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowLeft')) goPrev();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [readOnlySceneNavigator, goNext, goPrev]);

  const neuroInkOpen = useLiveWhiteboardStore((s) => s.neuroInkOpen);
  const setNeuroInkOpen = useLiveWhiteboardStore((s) => s.setNeuroInkOpen);
  const neuroInk = useLiveWhiteboardStore((s) => s.neuroInk);
  const setNeuroInk = useLiveWhiteboardStore((s) => s.setNeuroInk);
  const neuroInkAi = useNeuroInkAi();

  // ── PiP state ──────────────────────────────────────────────────────────────
  const [pipEnabled, setPipEnabled] = useState(false);
  const [pipEditMode, setPipEditMode] = useState(false);
  const [pipSize, setPipSize] = useState('md');
  // position in % from bottom-left corner of the scene area
  const [pipPos, setPipPos] = useState({ x: 2, y: 2 });
  const pipVideoRef = useRef(null);
  const pipDragging = useRef(false);
  const pipDragStart = useRef({ mx: 0, my: 0, px: 0, py: 0 });
  const pipContainerRef = useRef(null);

  // Assign pipStream to the pip video element
  useEffect(() => {
    const el = pipVideoRef.current;
    if (!el) return;
    el.srcObject = null;
    el.load?.();
    el.srcObject = pipStream || null;
    if (pipStream) el.play?.().catch(() => {});
  }, [pipStream]);

  // Disable PiP when stream disappears
  useEffect(() => {
    if (!pipStream) { setPipEnabled(false); setPipEditMode(false); }
  }, [pipStream]);

  const startPipDrag = useCallback((e) => {
    if (!pipEditMode) return;
    e.preventDefault();
    pipDragging.current = true;
    const src = e.touches ? e.touches[0] : e;
    pipDragStart.current = { mx: src.clientX, my: src.clientY, px: pipPos.x, py: pipPos.y };
  }, [pipEditMode, pipPos]);

  const movePipDrag = useCallback((e) => {
    if (!pipDragging.current || !pipContainerRef.current) return;
    const src = e.touches ? e.touches[0] : e;
    const rect = pipContainerRef.current.getBoundingClientRect();
    const dxPct = ((src.clientX - pipDragStart.current.mx) / rect.width) * 100;
    const dyPct = (-(src.clientY - pipDragStart.current.my) / rect.height) * 100;
    setPipPos({
      x: Math.max(0, Math.min(72, pipDragStart.current.px + dxPct)),
      y: Math.max(0, Math.min(68, pipDragStart.current.py + dyPct)),
    });
  }, []);

  const endPipDrag = useCallback(() => { pipDragging.current = false; }, []);

  const footerNeuroInkRight =
    useFooterSceneDock && pipStream ? 'right-[4.75rem] sm:right-[5.25rem]' : 'right-1 sm:right-1.5';

  const showEmbeddedWhiteboardToolsRail =
    !hideEmbeddedWhiteboardToolsRail
    && currentScene === 'board'
    && !readOnlySceneNavigator
    && typeof onWhiteboardStrokesChange === 'function';

  const prevBoardPageRef = useRef(whiteboardPageIndex);
  const [boardPageDir, setBoardPageDir] = useState(0);
  useEffect(() => {
    if (whiteboardPageIndex !== prevBoardPageRef.current) {
      setBoardPageDir(whiteboardPageIndex > prevBoardPageRef.current ? 1 : -1);
      prevBoardPageRef.current = whiteboardPageIndex;
    }
  }, [whiteboardPageIndex]);

  const whiteboardPagingUi =
    typeof onWhiteboardNextPage === 'function' || typeof onWhiteboardAddPage === 'function'
      ? {
          pageIndex: whiteboardPageIndex,
          pageCount: Math.max(1, whiteboardPageCount),
          onPrev: onWhiteboardPrevPage,
          onNext: onWhiteboardNextPage,
          onAdd: onWhiteboardAddPage,
          onRemove: onWhiteboardRemovePage,
        }
      : null;

  const [stageCaptureMeasureEl, setStageCaptureMeasureEl] = useState(null);
  const assignStageCaptureSurfaceRef = useCallback((node) => {
    setStageCaptureMeasureEl(node);
    const r = stageCaptureSurfaceRef;
    if (typeof r === 'function') {
      r(node);
    } else if (r && typeof r === 'object' && 'current' in r) {
      r.current = node;
    }
  }, [stageCaptureSurfaceRef]);

  useLayoutEffect(() => {
    if (!expandStageToViewport) {
      clearLiveSmartboardStageDesignPixels();
      return undefined;
    }
    const el = stageCaptureMeasureEl;
    if (!el) return undefined;
    const apply = () => {
      publishLiveSmartboardStageDesignPixels(el.clientWidth, el.clientHeight);
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => {
      ro.disconnect();
      clearLiveSmartboardStageDesignPixels();
    };
  }, [expandStageToViewport, stageCaptureMeasureEl]);

  return (
    <div
      ref={pipContainerRef}
      className={cn(
        'relative flex h-full min-h-0 w-full flex-col overflow-hidden',
        expandStageToViewport ? 'rounded-none' : 'rounded-[28px]',
      )}
      onMouseMove={movePipDrag}
      onMouseUp={endPipDrag}
      onMouseLeave={endPipDrag}
      onTouchMove={movePipDrag}
      onTouchEnd={endPipDrag}
    >

      {/* ── Scène active : par défaut viewport 16:9 centré (Designer) ; expandStageToViewport = tout le cadre central LiveHost ── */}
      <div
        className={cn(
          'relative min-h-0 flex-1 overflow-hidden',
          expandStageToViewport ? '' : '[container-type:size]',
        )}
      >
        <div
          className={cn(
            'flex h-full min-h-0 w-full overflow-hidden',
            expandStageToViewport ? 'p-0' : 'items-center justify-center p-1.5 sm:p-2',
          )}
        >
          <div
            ref={assignStageCaptureSurfaceRef}
            data-liri-smartboard-capture-surface=""
            className={cn(
              'relative overflow-hidden border',
              expandStageToViewport
                ? 'h-full w-full min-h-0 min-w-0 max-h-full max-w-full rounded-none border-white/[0.06] bg-transparent shadow-none'
                : 'max-w-full rounded-[22px] border-white/[0.12] bg-black/35 shadow-[inset_0_0_60px_rgba(0,0,0,0.3)]',
            )}
            style={
              expandStageToViewport
                ? { width: '100%', height: '100%', minHeight: 0 }
                : {
                    aspectRatio: `${SMARTBOARD_DESIGN_WIDTH} / ${SMARTBOARD_DESIGN_HEIGHT}`,
                    width: `min(100cqw, calc(100cqh * ${SMARTBOARD_DESIGN_WIDTH} / ${SMARTBOARD_DESIGN_HEIGHT}))`,
                    maxWidth: '100%',
                  }
            }
          >
            {!expandStageToViewport ? (
              <div className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(circle_at_25%_20%,rgba(255,255,255,0.06),transparent_36%),radial-gradient(circle_at_80%_14%,rgba(212,175,55,0.09),transparent_28%)]" />
            ) : null}
            {/*
              Vidéo partage d'écran : TOUJOURS dans le DOM pour que LiveKit garde un point d'attache stable.
            */}
            <video
              ref={screenVideoRef}
              autoPlay
              playsInline
              muted
              className={cn(
                'absolute inset-0 z-[1] h-full w-full bg-black/40 transition-opacity duration-200',
                expandStageToViewport ? 'object-cover' : 'object-contain',
                screenOverIntelligent ? 'z-[15] opacity-100' : 'opacity-0 pointer-events-none',
              )}
            />
            {screenActive && SMARTBOARD_INTELLIGENT_SCENES.includes(currentScene) ? (
              <div className="pointer-events-none absolute left-3 top-3 z-[16] flex h-5 items-center gap-1.5 rounded-full border border-white/15 bg-black/60 px-2">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-400" />
                <span className="text-[9px] text-white/70">
                  {currentScene === 'smartboard' ? 'Écran sur SmartBoard natif' : 'Écran sur diaporama importé'}
                </span>
              </div>
            ) : null}
            {/* Flash de lumière au changement de scène */}
            <AnimatePresence>
              {sceneFlash && (
                <motion.div
                  key="scene-flash"
                  initial={{ opacity: 0.55 }}
                  animate={{ opacity: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.38, ease: [0.25, 0.46, 0.45, 0.94] }}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    zIndex: 50,
                    pointerEvents: 'none',
                    background: 'radial-gradient(ellipse 70% 60% at 50% 50%, rgba(212,163,106,.28) 0%, rgba(168,118,58,.12) 40%, transparent 72%)',
                    mixBlendMode: 'screen',
                  }}
                />
              )}
            </AnimatePresence>

            <AnimatePresence mode="wait">
              <motion.div
                key={currentScene}
                initial={{ opacity: 0, scale: 0.93, filter: 'blur(12px)' }}
                animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                exit={{ opacity: 0, scale: 1.05, filter: 'blur(10px)' }}
                transition={{
                  type: 'spring',
                  stiffness: 440,
                  damping: 38,
                  mass: 0.48,
                  opacity: { duration: 0.22, ease: 'easeOut' },
                  filter: { duration: 0.28, ease: [0.25, 0.46, 0.45, 0.94] },
                }}
                className="absolute inset-0 z-[10] will-change-transform"
              >
            {currentScene === 'smartboard' && (
              <ParallaxSlideSceneStack
                slide={slide}
                spotlight={spotlight}
                progressivePlayback={progressivePlayback}
                onSmartboardImageExpand={onSmartboardImageExpand}
                tacticalSyncRole={tacticalSyncRole}
                remoteTacticalSync={remoteTacticalSync}
                onTacticalSyncChange={onTacticalSyncChange}
                readOnlySceneNavigator={readOnlySceneNavigator}
                annotationStrokes={annotationStrokes}
                onAnnotationStrokesChange={onAnnotationStrokesChange}
                onSaveStroke={onSaveStroke}
                immersiveEdgeDefault
                liveStageFillCover={expandStageToViewport}
              />
            )}
            {currentScene === 'diapo' && (
              <ParallaxSlideSceneStack
                slide={slide}
                spotlight={spotlight}
                progressivePlayback={progressivePlayback}
                onSmartboardImageExpand={onSmartboardImageExpand}
                tacticalSyncRole={tacticalSyncRole}
                remoteTacticalSync={remoteTacticalSync}
                onTacticalSyncChange={onTacticalSyncChange}
                readOnlySceneNavigator={readOnlySceneNavigator}
                annotationStrokes={annotationStrokes}
                onAnnotationStrokesChange={onAnnotationStrokesChange}
                onSaveStroke={onSaveStroke}
                immersiveEdgeDefault={false}
              />
            )}
            {currentScene === 'screen' && (
              <ScreenShareSceneLayer active={screenActive} />
            )}
            {currentScene === 'browser' && (
              <IntegratedUrlFrame onShareScreen={onShareScreen} variant="web" />
            )}
            {currentScene === 'embed' && (
              <IntegratedUrlFrame onShareScreen={onShareScreen} variant="embed" />
            )}
            {currentScene === 'quiz' && (
              <IntegratedUrlFrame onShareScreen={onShareScreen} variant="quiz" />
            )}
            {currentScene === 'secure_app_share' && (
              <IntegratedUrlFrame
                onShareScreen={onShareScreen}
                variant="secure_app"
                syncState={secureAppShareState}
                onSyncStateChange={readOnlySceneNavigator ? undefined : onSecureAppShareStateChange}
                readOnly={readOnlySceneNavigator}
              />
            )}
            {currentScene === 'board' && (whiteboardPageCount > 1 ? (
              <motion.div
                key={whiteboardPageIndex}
                initial={{
                  opacity: 0.45,
                  x: boardPageDir > 0 ? 26 : boardPageDir < 0 ? -26 : 0,
                }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ type: 'spring', stiffness: 280, damping: 32, mass: 0.7 }}
                className="absolute inset-0"
              >
                <WhiteboardScene
                  strokes={whiteboardStrokes}
                  onStrokesChange={readOnlySceneNavigator ? undefined : onWhiteboardStrokesChange}
                  readOnly={readOnlySceneNavigator}
                  onSaveStroke={onSaveStroke}
                  onBroadcast={onLaserPointerChange}
                  remoteLaserPointer={remoteLaserPointerProp}
                />
              </motion.div>
            ) : (
              <WhiteboardScene
                strokes={whiteboardStrokes}
                onStrokesChange={readOnlySceneNavigator ? undefined : onWhiteboardStrokesChange}
                readOnly={readOnlySceneNavigator}
                onSaveStroke={onSaveStroke}
                onBroadcast={onLaserPointerChange}
                remoteLaserPointer={remoteLaserPointerProp}
              />
            ))}
            {currentScene === 'image' && (
              <div className={cn('absolute inset-0 flex items-center justify-center', SCENE_STAGE_GRID)}>
                {sharedImageSrc ? (
                  <>
                    <img src={sharedImageSrc} alt="Partagé" className="max-h-full max-w-full object-contain" />
                    {!readOnlySceneNavigator && sharedGalleryLength > 0 && (
                      <div
                        className={cn(
                          designerShellEmbedPanel,
                          'absolute bottom-14 left-1/2 z-20 flex -translate-x-1/2 flex-wrap items-center justify-center gap-2 px-3 py-2',
                        )}
                      >
                        <span className="text-[10px] tabular-nums text-white/48">
                          {sharedGalleryLength > 1 ? `${sharedImageIndex + 1} / ${sharedGalleryLength}` : '1 image'}
                        </span>
                        {sharedGalleryLength > 1 && (
                          <>
                            <button
                              type="button"
                              onClick={() => onSharedImagePrev?.()}
                              className={cn(designerShellChipGhost, 'h-7 px-2 text-[11px]')}
                            >
                              ◀ Préc.
                            </button>
                            <button
                              type="button"
                              onClick={() => onSharedImageNext?.()}
                              className={cn(designerShellChipGhost, 'h-7 px-2 text-[11px]')}
                            >
                              Suiv. ▶
                            </button>
                          </>
                        )}
                        {sharedGalleryLength > 1 && (
                          <label className="flex cursor-pointer select-none items-center gap-1.5 text-[10px] text-white/50">
                            <input
                              type="checkbox"
                              checked={sharedImageLoop}
                              onChange={(e) => onToggleSharedImageLoop?.(e.target.checked)}
                              className="rounded border-white/30"
                            />
                            Boucle
                          </label>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <div className={cn(designerShellEmbedPanel, 'max-w-md px-6 py-8 text-center')}>
                    <p className="text-sm font-semibold text-white/55">Aucune image dans la galerie</p>
                    <p className="mt-2 text-[11px] leading-relaxed text-white/38">
                      Ajoutez des visuels (Gamma, exports, photos) dans le studio live — section « Images partagées ».
                    </p>
                  </div>
                )}
              </div>
            )}
            {currentScene === 'camera2' && (
              <Camera2Scene
                videoRef={camera2VideoRef}
                active={camera2Active}
                onStart={onStartCamera2}
                readOnlySceneNavigator={readOnlySceneNavigator}
                fluxParticipants={camera2FluxParticipants}
                placeholder={camera2Placeholder}
                waitingRemote={camera2WaitingRemote}
              />
            )}
            {currentScene === 'shop' && (
              <ShopScene products={shopProducts} onProductClick={onShopProductClick} />
            )}
            {currentScene === 'medos' && (
              <div className="absolute inset-0 flex items-center justify-center overflow-hidden bg-[#f6f4ee]">
                {effectiveMedosScene && effectiveMedosScene.kind !== 'clear' ? (
                  <div className="h-full w-full overflow-auto p-3 sm:p-5">
                    <SharedSceneView scene={effectiveMedosScene} />
                  </div>
                ) : (
                  <div className="flex max-w-md flex-col items-center gap-2 px-6 text-center">
                    <span className="text-3xl">🩺</span>
                    <p className="text-[15px] font-semibold text-[#2b2420]">Dossier MEDOS</p>
                    <p className="text-[13px] leading-snug text-[#6b6259]">
                      Ouvrez le cockpit clinique (bouton 🩺) puis partagez le jumeau 3D, la roue de
                      transformation, un bilan ou la note SOAP : le contenu s'affiche ici, visible par
                      tous les participants de la séance.
                    </p>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>

            {showEmbeddedWhiteboardToolsRail ? (
              <div
                className={cn(
                  'pointer-events-auto absolute left-1.5 top-1/2 z-[51] w-[min(13.5rem,42vw)] max-h-[min(78vh,520px)] -translate-y-1/2 overflow-y-auto overflow-x-hidden rounded-2xl border border-white/[0.09] bg-[#1f1e1c]/94 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_16px_48px_-16px_rgba(0,0,0,0.65)] backdrop-blur-xl ring-1 ring-inset ring-white/[0.03] sm:left-2',
                  premiumArenaHostTray &&
                    'border-amber-500/20 bg-[#1f1e1c]/96 shadow-[inset_0_1px_0_rgba(212,163,106,0.08),0_16px_44px_-14px_rgba(212,163,106,0.12)]',
                )}
              >
                <LiveWhiteboardToolsSidebar
                  hideNeuroInk={useFooterSceneDock}
                  whiteboardStrokes={whiteboardStrokes}
                  whiteboardPaging={whiteboardPagingUi}
                />
              </div>
            ) : null}

            {currentScene === 'board' && readOnlySceneNavigator && whiteboardPageCount > 1 ? (
              <div
                className="pointer-events-none absolute left-3 top-12 z-[42] max-w-[min(14rem,calc(100%-5rem))] rounded-xl border border-white/12 bg-black/70 px-2.5 py-1.5 shadow-lg backdrop-blur-sm"
                role="status"
                aria-live="polite"
              >
                <span className="text-[9px] leading-tight text-white/75">
                  Tableau · écran {guestBoardPageLabel1Based(whiteboardPageIndex, whiteboardPageCount)} /{' '}
                  {Math.max(1, whiteboardPageCount)}
                </span>
              </div>
            ) : null}

            {/* Scène courante — compteur discret */}
            {!hideSceneIndexChip ? (
              <div className="absolute top-3 right-3 z-40 flex h-5 items-center gap-1.5 rounded-full border border-white/15 bg-black/70 px-2">
                <span className="text-[9px] font-medium tabular-nums text-white/50">
                  {currentIndex + 1} / {total}
                </span>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* ── PiP Overlay — participant vidéo sans fond intégré dans le décor ── */}
      {pipEnabled && pipStream && (
        <div
          className={cn(
            'absolute z-40 overflow-hidden rounded-xl border-2 shadow-2xl transition-shadow select-none',
            pipEditMode
              ? 'border-[var(--school-accent)] shadow-[0_0_16px_rgba(212,175,55,0.5)] cursor-move'
              : 'border-white/15 cursor-default'
          )}
          style={{
            left: `${pipPos.x}%`,
            bottom: `calc(${PIP_BOTTOM_SAFE_PX}px + ${pipPos.y}%)`,
            width: `${PIP_SIZES[pipSize].widthPct}%`,
            aspectRatio: '3/4',
          }}
          onMouseDown={startPipDrag}
          onTouchStart={startPipDrag}
        >
          <video
            ref={pipVideoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover"
          />
          {/* Edit mode controls */}
          {pipEditMode && (
            <div className="absolute top-1 left-1 right-1 flex items-center justify-between gap-1 z-10">
              <div className="flex gap-0.5">
                {Object.entries(PIP_SIZES).map(([key, { label }]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setPipSize(key); }}
                    className={cn(
                      'text-[9px] px-1.5 py-0.5 rounded font-bold transition-colors',
                      pipSize === key ? 'bg-[var(--school-accent)] text-black' : 'bg-black/70 text-white/70 hover:bg-white/20'
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-0.5">
                <Move className="w-3 h-3 text-[var(--school-accent)] opacity-80" />
              </div>
            </div>
          )}
          {!pipEditMode && (
            <div className="absolute inset-x-0 bottom-0 h-4 bg-gradient-to-t from-black/50 to-transparent" />
          )}
        </div>
      )}

      {/* Navigateur de scènes : colonne verticale (défaut) ; mode footer = barre parente + ici PiP seul + NeuroInk (board) */}
      {!useFooterSceneDock && !hideSceneDock ? (
        <TooltipProvider delayDuration={200} skipDelayDuration={100}>
          <div
            className={cn(
              'pointer-events-auto absolute right-1.5 top-1/2 z-50 flex h-[min(78vh,520px)] w-[58px] -translate-y-1/2 flex-col items-center gap-2 overflow-hidden rounded-2xl px-2 py-2.5 sm:right-2.5 sm:w-[62px] sm:gap-2.5 sm:px-2.5 sm:py-3',
              'border border-white/[0.09] bg-[#1f1e1c]/94 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_16px_48px_-16px_rgba(0,0,0,0.65)] backdrop-blur-xl ring-1 ring-inset ring-white/[0.03]',
              premiumArenaHostTray &&
                'border-amber-500/22 bg-[#1f1e1c]/96 shadow-[inset_0_1px_0_rgba(251,191,36,0.06),0_16px_44px_-14px_rgba(251,191,36,0.1)]',
            )}
            {...(dockMagnificationEnabled
              ? { onMouseMove: handleSceneDockMove, onMouseLeave: handleSceneDockLeave }
              : {})}
            role="toolbar"
            aria-label="Scènes SmartBoard"
          >
            {readOnlySceneNavigator ? (
              <span className="sr-only">Scènes pilotées par l&apos;hôte — synchronisation temps réel</span>
            ) : null}
            <DockChromeTooltip
              label="Scène précédente"
              description="Raccourci : Alt + ↑ ou ←"
            >
              <button
                type="button"
                onClick={goPrev}
                disabled={readOnlySceneNavigator || total <= 1}
                className={dockChromeBtnClass(premiumArenaHostTray)}
              >
                <ChevronUp className="h-5 w-5 stroke-[1.5]" />
              </button>
            </DockChromeTooltip>

            <div className="flex min-h-0 w-full flex-1 flex-col items-center gap-2 overflow-y-auto overflow-x-hidden py-1 [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.12)_transparent]">
              {scenes.map((scene, i) => (
                <SceneThumbnail
                  key={scene.id}
                  ref={(el) => {
                    sceneItemRefs.current[i] = el;
                  }}
                  scene={scene}
                  active={scene.id === currentScene}
                  readOnly={readOnlySceneNavigator}
                  premiumArenaHostTray={premiumArenaHostTray}
                  dockScale={dockMagnificationEnabled ? (dockScales?.[i] ?? 1) : 1}
                  onClick={() => onChangeScene?.(scene.id)}
                />
              ))}
            </div>

            <DockChromeTooltip
              label="Scène suivante"
              description="Raccourci : Alt + ↓ ou →"
            >
              <button
                type="button"
                onClick={goNext}
                disabled={readOnlySceneNavigator || total <= 1}
                className={dockChromeBtnClass(premiumArenaHostTray)}
              >
                <ChevronDown className="h-5 w-5 stroke-[1.5]" />
              </button>
            </DockChromeTooltip>

            {pipStream ? (
              <div className="flex w-full shrink-0 flex-col items-center gap-2 border-t border-white/[0.08] pt-2.5">
                <DockChromeTooltip
                  label="PiP vidéo"
                  description="Affiche votre caméra dans la scène. Désactiver pour masquer l'incrustation."
                >
                  <button
                    type="button"
                    onClick={() => {
                      setPipEnabled((v) => !v);
                      if (pipEnabled) setPipEditMode(false);
                    }}
                    className={cn(
                      dockChromeBtnClass(premiumArenaHostTray),
                      pipEnabled &&
                        (premiumArenaHostTray
                          ? 'border-amber-400/40 bg-gradient-to-b from-amber-500/20 to-[#1a1512] text-amber-50 shadow-[0_0_18px_-8px_rgba(212,163,106,0.35)]'
                          : 'border-amber-400/40 bg-gradient-to-b from-amber-500/16 to-[#14100c] text-amber-50 shadow-[0_0_18px_-8px_rgba(251,191,36,0.28)]'),
                    )}
                  >
                    <UserSquare2 className="h-5 w-5 shrink-0" strokeWidth={1.45} />
                  </button>
                </DockChromeTooltip>
                {pipEnabled ? (
                  <DockChromeTooltip
                    label="Ajuster le PiP"
                    description="Déplacez l'aperçu et choisissez la taille (S / M / L)."
                  >
                    <button
                      type="button"
                      onClick={() => setPipEditMode((v) => !v)}
                      className={cn(
                        dockChromeBtnClass(premiumArenaHostTray),
                        pipEditMode &&
                          (premiumArenaHostTray
                            ? 'border-amber-400/48 bg-gradient-to-b from-amber-500/24 to-[#1a1512] text-amber-50 shadow-[0_0_20px_-8px_rgba(212,163,106,0.4)]'
                            : 'border-amber-400/45 bg-gradient-to-b from-amber-500/20 to-[#14100c] text-amber-50 shadow-[0_0_20px_-8px_rgba(251,191,36,0.32)]'),
                      )}
                    >
                      <Move className="h-5 w-5 stroke-[1.5]" />
                    </button>
                  </DockChromeTooltip>
                ) : null}
              </div>
            ) : null}
          </div>
        </TooltipProvider>
      ) : pipStream ? (
        <TooltipProvider delayDuration={200} skipDelayDuration={100}>
          <div
            className={cn(
              'pointer-events-auto absolute right-1.5 top-1/2 z-50 flex w-[58px] -translate-y-1/2 flex-col items-center gap-2 overflow-hidden rounded-2xl border border-white/[0.09] bg-[#1f1e1c]/94 px-2 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_16px_48px_-16px_rgba(0,0,0,0.65)] backdrop-blur-xl ring-1 ring-inset ring-white/[0.03] sm:right-2.5 sm:w-[62px] sm:py-3',
              premiumArenaHostTray &&
                'border-amber-500/22 bg-[#1f1e1c]/96 shadow-[inset_0_1px_0_rgba(251,191,36,0.06),0_16px_44px_-14px_rgba(251,191,36,0.1)]',
            )}
            role="toolbar"
            aria-label="PiP vidéo SmartBoard"
          >
            <DockChromeTooltip
              label="PiP vidéo"
              description="Affiche votre caméra dans la scène. Désactiver pour masquer l'incrustation."
            >
              <button
                type="button"
                onClick={() => {
                  setPipEnabled((v) => !v);
                  if (pipEnabled) setPipEditMode(false);
                }}
                className={cn(
                  dockChromeBtnClass(premiumArenaHostTray),
                  pipEnabled &&
                    (premiumArenaHostTray
                      ? 'border-amber-400/40 bg-gradient-to-b from-amber-500/20 to-[#1a1512] text-amber-50 shadow-[0_0_18px_-8px_rgba(212,163,106,0.35)]'
                      : 'border-amber-400/40 bg-gradient-to-b from-amber-500/16 to-[#14100c] text-amber-50 shadow-[0_0_18px_-8px_rgba(251,191,36,0.28)]'),
                )}
              >
                <UserSquare2 className="h-5 w-5 shrink-0" strokeWidth={1.45} />
              </button>
            </DockChromeTooltip>
            {pipEnabled ? (
              <DockChromeTooltip
                label="Ajuster le PiP"
                description="Déplacez l'aperçu et choisissez la taille (S / M / L)."
              >
                <button
                  type="button"
                  onClick={() => setPipEditMode((v) => !v)}
                  className={cn(
                    dockChromeBtnClass(premiumArenaHostTray),
                    pipEditMode &&
                      (premiumArenaHostTray
                        ? 'border-amber-400/48 bg-gradient-to-b from-amber-500/24 to-[#1a1512] text-amber-50 shadow-[0_0_20px_-8px_rgba(212,163,106,0.4)]'
                        : 'border-amber-400/45 bg-gradient-to-b from-amber-500/20 to-[#14100c] text-amber-50 shadow-[0_0_20px_-8px_rgba(251,191,36,0.32)]'),
                  )}
                >
                  <Move className="h-5 w-5 stroke-[1.5]" />
                </button>
              </DockChromeTooltip>
            ) : null}
          </div>
        </TooltipProvider>
      ) : null}

      {(useFooterSceneDock || (showNeuroInk && neuroInkOpen)) && currentScene === 'board' && !readOnlySceneNavigator ? (
        <div
          className={cn(
            'pointer-events-auto absolute top-1/2 z-[52] w-[min(13.5rem,38vw)] max-h-[min(78vh,520px)] -translate-y-1/2 overflow-y-auto overflow-x-hidden rounded-2xl border border-white/[0.09] bg-[#1f1e1c]/94 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_16px_48px_-16px_rgba(0,0,0,0.65)] backdrop-blur-xl ring-1 ring-inset ring-white/[0.03]',
            footerNeuroInkRight,
            premiumArenaHostTray &&
              'border-amber-500/20 bg-[#1f1e1c]/96 shadow-[inset_0_1px_0_rgba(212,163,106,0.08),0_16px_44px_-14px_rgba(212,163,106,0.12)]',
          )}
        >
          <p className="mb-1.5 font-serif text-[11px] font-semibold uppercase tracking-wide text-white/55">
            NeuroInk
          </p>
          <NeuroInkPanel
            variant="rail"
            open={neuroInkOpen}
            onOpenChange={setNeuroInkOpen}
            neuroInk={neuroInk}
            setNeuroInk={setNeuroInk}
            ai={neuroInkAi}
            footerHint="S'applique au crayon libre au relâchement du trait."
          />
        </div>
      ) : null}
    </div>
  );
}
