/**
 * SlideParallaxStage
 *
 * Renderer principal du SmartBoard. Supporte deux modes :
 *
 * 1. MODE LEGACY — slide.elements[] avec positions absolues (x/y/width/height)
 *    Utilisé pour les slides templates et les scènes importées depuis la DB.
 *
 * 2. MODE PROGRESSIVE BUILD — slide.ia_data (canevas conception depuis `design_canvas` / `format` Architect, défaut 1037×750).
 *    Le canevas est mis à l’échelle (**contain** ou **cover**) dans l’Écran intelligent selon `canvasScaleMode`.
 *    Horizontal : development[{ label, points[] }], hero_visual, theme, illustration…
 *    Legacy : development[] de chaînes. Phases 0→3 (ou 0→2 si pas de pied de slide).
 *
 * Props :
 *   slide      — objet slide (legacy ou ia_data)
 *   spotlight  — booléen — active le halo or sur les éléments spotlight
 *   step       — (optionnel) forcer la phase progressive depuis l'extérieur
 *   onStepChange — callback (newStep) quand l'utilisateur clique pour avancer
 *   progressivePlayback — false = slide entière visible (toggle live)
 *   onSmartboardImageExpand — hôte : { url, label } → modale synchronisée (Arena)
 *
 * Mode tactique : focus, flou, ⌃/⌘+molette = zoom sur l’élément, ⌃/⌘+glisser (gauche) = déplacer,
 * ⌃/⌘+clic gauche = masquer, ⌃/⌘+clic droit = afficher, Alt = mini, Shift = pousser,
 * barre/poignées (zone focalisée), ⌃1–9, Échap / ⌃0.
 * Pendant déplacement/redimensionnement : transitions Framer à durée 0 pour coller à la souris.
 * Live Arena : props tacticalSyncRole / remoteTacticalSync / onTacticalSyncChange — diffusion hôte → invités.
 *
 * Immersif : `immersive_edge_feather` ou `immersiveEdgeFeather` (0–100) sur la slide ou dans `ia_data` — fondu des bords
 * dans l’arrière-plan de l’écran intelligent (PNG/WebP sans fond recommandés). 0 = désactivé. Sur la scène SmartBoard natif,
 * une valeur par défaut s’applique si non définie (`immersiveEdgeDefault`, voir props).
 */
import React, {
  useState, useCallback, useEffect, useLayoutEffect, useRef, useMemo,
} from 'react';
import {
  computeDesignCanvasScaleContain,
  computeDesignCanvasScaleCover,
  resolveProgressiveSlideDesignSize,
} from '@/lib/smartboardDesignCanvas';
import { AnimatePresence, motion } from 'framer-motion';
import { getDocumentEmbedSrc } from '@/lib/liveSceneNormalize';
import {
  resolveSmartboardEdgeFeatherPercent,
  smartboardEdgeFeatherMaskStyle,
} from '@/lib/smartboardImmersiveMask';
import { cn } from '@/lib/utils';

/** Version payload sync tactique SmartBoard (broadcast live). */
export const SB_TACTICAL_SYNC_V = 1;

/** Image cliquable (hôte) → modale synchronisée salle ; stopPropagation pour ne pas avancer la lecture progressive. */
function ExpandableHostImage({ src, alt, onExpand, imgClassName = 'h-full w-full object-contain' }) {
  const can = Boolean(onExpand && src && /^https?:\/\//i.test(String(src)));
  const inner = (
    <img
      src={src}
      alt={alt || ''}
      className={cn(can && 'pointer-events-none', imgClassName)}
      referrerPolicy="no-referrer"
      loading="lazy"
    />
  );
  if (!can) return inner;
  return (
    <button
      type="button"
      className="h-full w-full cursor-zoom-in rounded-xl border-0 bg-transparent p-0 text-left"
      onClick={(e) => {
        e.stopPropagation();
        onExpand({ url: src, label: alt || '' });
      }}
      title="Agrandir pour toute la salle"
    >
      {inner}
    </button>
  );
}

/** Alt / Shift sur une zone tactique (mini, pousser). Le Ctrl est géré à part : molette, glisser, clics. */
function applyTacticalAltShiftActions(e, key, setAdjust) {
  if (e.ctrlKey || e.metaKey) return false;
  if (e.altKey) {
    e.preventDefault();
    setAdjust((prev) => {
      const cur = prev[key] || {};
      return { ...prev, [key]: { ...cur, minimized: !cur.minimized, hidden: false } };
    });
    return true;
  }
  if (e.shiftKey) {
    e.preventDefault();
    setAdjust((prev) => {
      const cur = prev[key] || {};
      const nextPush = cur.push === 'left' ? 'right' : cur.push === 'right' ? null : 'left';
      return { ...prev, [key]: { ...cur, push: nextPush } };
    });
    return true;
  }
  return false;
}

/** Zone tactique slide IA (Architect) — focus, flou des autres, modificateurs, poignées déplacer/zoom. */
function IaTacticalPanel({
  panelId,
  iaFocus,
  setIaFocus,
  iaAdj,
  setIaAdj,
  iaInteractRef,
  iaCtrlPendingRef,
  /** id du panneau actuellement en drag (parent) — spring off si égal à panelId */
  tacticalDragPanelId = null,
  onBeginTacticalDrag,
  /** Invité : affichage miroir, pas d’interaction tactique */
  viewOnly = false,
  className,
  children,
}) {
  const adj = iaAdj[panelId] || {};
  const isFocused = iaFocus === panelId;
  const hasAny = iaFocus != null;
  const dim = hasAny && !isFocused && !adj.hidden;
  const hidden = adj.hidden;
  const pushX = adj.push === 'left' ? -18 : adj.push === 'right' ? 18 : 0;
  const geomDx = adj.geomDx || 0;
  const geomDy = adj.geomDy || 0;
  const zoomMul = Math.min(1.48, Math.max(0.62, adj.zoomMul ?? 1));
  const baseScale = adj.minimized ? 0.58 : dim ? 0.94 : isFocused ? 1.04 : 1;

  return (
    <motion.div
      data-sb-tactical-panel={panelId}
      className={cn(
        'relative rounded-2xl',
        className,
        hidden && 'pointer-events-none',
        isFocused && !hidden && 'z-[4]',
      )}
      initial={false}
      animate={{
        opacity: hidden ? 0 : dim ? 0.4 : 1,
        scale: baseScale * zoomMul,
        x: pushX + geomDx,
        y: geomDy,
        filter: dim && !hidden ? 'blur(5px) saturate(0.85)' : 'none',
      }}
      transition={tacticalDragPanelId === panelId ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 30 }}
      onContextMenu={
        viewOnly
          ? undefined
          : (e) => {
            if (!(e.ctrlKey || e.metaKey)) return;
            e.preventDefault();
            e.stopPropagation();
            setIaAdj((prev) => ({
              ...prev,
              [panelId]: { ...(prev[panelId] || {}), hidden: false, minimized: false },
            }));
          }
      }
      onPointerDownCapture={(e) => {
        if (viewOnly) return;
        if ((e.ctrlKey || e.metaKey) && e.button === 0) {
          if (typeof e.target.closest === 'function' && e.target.closest('button, a, input, textarea, .sb-tactical-handle')) {
            return;
          }
          e.stopPropagation();
          e.preventDefault();
          const cur = iaAdj[panelId] || {};
          if (iaCtrlPendingRef) {
            iaCtrlPendingRef.current = {
              panelId,
              startClientX: e.clientX,
              startClientY: e.clientY,
              orig: {
                geomDx: cur.geomDx || 0,
                geomDy: cur.geomDy || 0,
                zoomMul: cur.zoomMul ?? 1,
              },
            };
          }
          return;
        }
        if (e.ctrlKey || e.metaKey) return;
        if (e.altKey || e.shiftKey) {
          if (applyTacticalAltShiftActions(e, panelId, setIaAdj)) {
            e.preventDefault();
            e.stopPropagation();
          }
        }
      }}
      onClick={
        viewOnly
          ? undefined
          : (e) => {
            if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
            if (typeof e.target.closest === 'function' && e.target.closest('button, a, input, textarea')) return;
            e.stopPropagation();
            setIaFocus((f) => (f === panelId ? null : panelId));
          }
      }
      style={
        isFocused && !hidden
          ? { boxShadow: '0 0 0 2px rgba(212,175,55,0.55), 0 16px 48px rgba(212,175,55,0.12)' }
          : undefined
      }
    >
      {isFocused && !hidden && !adj.minimized && iaInteractRef && !viewOnly && (
        <>
          <div
            role="presentation"
            className="sb-tactical-handle absolute left-1 right-8 top-0 z-[80] h-7 cursor-grab rounded-t-[inherit] bg-[#D4AF37]/12 hover:bg-[#D4AF37]/22 active:cursor-grabbing touch-none"
            onPointerDown={(e) => {
              e.stopPropagation();
              onBeginTacticalDrag?.(panelId);
              const cur = iaAdj[panelId] || {};
              iaInteractRef.current = {
                panelId,
                mode: 'move',
                startClientX: e.clientX,
                startClientY: e.clientY,
                orig: {
                  geomDx: cur.geomDx || 0,
                  geomDy: cur.geomDy || 0,
                  zoomMul: cur.zoomMul ?? 1,
                },
              };
              e.currentTarget.setPointerCapture(e.pointerId);
            }}
          />
          <div
            role="presentation"
            className="sb-tactical-handle absolute bottom-0 right-0 z-[80] h-4 w-4 cursor-se-resize rounded-br-[inherit] border border-[#D4AF37]/45 bg-black/45 touch-none"
            onPointerDown={(e) => {
              e.stopPropagation();
              onBeginTacticalDrag?.(panelId);
              const cur = iaAdj[panelId] || {};
              iaInteractRef.current = {
                panelId,
                mode: 'resize-se',
                startClientX: e.clientX,
                startClientY: e.clientY,
                orig: {
                  geomDx: cur.geomDx || 0,
                  geomDy: cur.geomDy || 0,
                  zoomMul: cur.zoomMul ?? 1,
                },
              };
              e.currentTarget.setPointerCapture(e.pointerId);
            }}
          />
        </>
      )}
      {children}
    </motion.div>
  );
}

// ── Legacy renderer ───────────────────────────────────────────────────────────

/** Texte libre : option repliable (réduit / développé) pour la lecture au live */
function LegacyFreeTextBlock({ el }) {
  const collapsible = Boolean(el.collapsible);
  const [open, setOpen] = useState(el.defaultCollapsed !== true);
  const td = [];
  if (el.underline) td.push('underline');
  if (el.strikethrough) td.push('line-through');
  const lhRaw = el.lineHeight;
  const lh =
    lhRaw != null && lhRaw !== '' && !Number.isNaN(Number(lhRaw)) ? Number(lhRaw) : 1.35;
  const body = (
    <div
      className="h-full w-full overflow-hidden whitespace-pre-wrap break-words box-border"
      style={{
        fontFamily: el.fontFamily || 'system-ui, sans-serif',
        fontSize: el.fontSize ?? 16,
        fontWeight: el.fontWeight || 400,
        fontStyle: el.italic ? 'italic' : 'normal',
        color: el.color || '#0f172a',
        textAlign: el.textAlign || 'left',
        textDecoration: td.length ? td.join(' ') : undefined,
        lineHeight: lh,
        opacity: el.opacity ?? 1,
        transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
        display: 'block',
      }}
    >
      {el.content}
    </div>
  );
  if (!collapsible) return body;
  return (
    <div className="flex h-full w-full min-h-0 flex-col overflow-hidden text-left">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        className="mb-1 shrink-0 rounded-md border border-white/12 bg-black/45 px-2 py-1 text-left text-[11px] font-medium text-[#D4AF37]/95 hover:bg-black/60"
      >
        <span className="tabular-nums opacity-80">{open ? '▼' : '▶'}</span>{' '}
        {String(el.sectionLabel || 'Texte').slice(0, 120)}
      </button>
      {open ? <div className="min-h-0 flex-1 overflow-auto pr-0.5">{body}</div> : null}
    </div>
  );
}

function renderElement(el, onSmartboardImageExpand) {
  if (el.type === 'title') {
    return (
      <h3 className="text-5xl md:text-6xl lg:text-7xl font-semibold text-white leading-[0.95] tracking-[-0.02em] drop-shadow-[0_10px_35px_rgba(0,0,0,0.55)]">
        {el.content}
      </h3>
    );
  }
  if (el.type === 'paragraph') {
    return (
      <p className="text-lg md:text-xl text-gray-100/95 leading-relaxed max-w-3xl">
        {el.content}
      </p>
    );
  }
  if (el.type === 'quote') {
    return <p className="text-lg italic text-[#D4AF37]">"{el.content}"</p>;
  }
  if (el.type === 'badge') {
    return (
      <span className="inline-flex h-7 px-3 rounded-full bg-[#D4AF37]/20 border border-[#D4AF37]/35 text-[#D4AF37] text-xs">
        {el.content}
      </span>
    );
  }
  if (el.type === 'image' && (el.src || el.url)) {
    return (
      <ExpandableHostImage
        src={el.src || el.url}
        alt={el.content || 'Slide asset'}
        onExpand={onSmartboardImageExpand}
        imgClassName="h-full w-full object-contain"
      />
    );
  }
  if (el.type === 'document' && (el.src || el.url)) {
    const src = el.src || el.url;
    const docKind = el.documentKind === 'office' ? 'office' : 'pdf';
    const iframeSrc = getDocumentEmbedSrc(src, docKind);
    return (
      <div className="absolute inset-0 flex min-h-0 min-w-0 bg-zinc-950">
        <iframe
          title={el.content || 'Document'}
          src={iframeSrc}
          className="h-full w-full min-h-0 min-w-0 flex-1 border-0 bg-zinc-950 rounded-md"
          allowFullScreen
        />
      </div>
    );
  }
  if (el.type === 'free_text') {
    return <LegacyFreeTextBlock el={el} />;
  }
  if (el.type === 'html_embed') {
    const html = String(el.html ?? el.content ?? '');
    if (!html.trim()) {
      return <div className="p-2 text-xs text-white/35">HTML vide</div>;
    }
    return (
      <div className="h-full w-full min-h-0 min-w-0 overflow-hidden rounded-md bg-black/45">
        <iframe
          title={el.id ? `embed-${el.id}` : 'html-embed'}
          srcDoc={html}
          sandbox="allow-scripts allow-same-origin"
          className="h-full w-full min-h-0 min-w-0 border-0 bg-transparent"
        />
      </div>
    );
  }
  if (el.type === 'shape_rect') {
    return (
      <div
        className="h-full w-full box-border"
        style={{
          background: el.fill || 'transparent',
          border: `${el.strokeWidth ?? 2}px solid ${el.stroke || 'rgba(212,175,55,0.5)'}`,
          borderRadius: el.borderRadius ?? 0,
          opacity: el.opacity ?? 1,
          transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
        }}
      />
    );
  }
  if (el.type === 'shape_circle') {
    return (
      <div
        className="h-full w-full box-border rounded-full"
        style={{
          background: el.fill || 'transparent',
          border: `${el.strokeWidth ?? 2}px solid ${el.stroke || 'rgba(212,175,55,0.5)'}`,
          opacity: el.opacity ?? 1,
          transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
        }}
      />
    );
  }
  if (el.type === 'shape_arrow') {
    const fill = el.fill || '#D4AF37';
    return (
      <div
        className="flex h-full w-full items-center box-border"
        style={{ opacity: el.opacity ?? 1, transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined }}
      >
        <div className="h-1 flex-1" style={{ background: fill, minHeight: 3 }} />
        <div
          style={{
            width: 0,
            height: 0,
            borderTop: '10px solid transparent',
            borderBottom: '10px solid transparent',
            borderLeft: `16px solid ${fill}`,
          }}
        />
      </div>
    );
  }
  return <div className="text-xs text-gray-400">{el.content || el.type}</div>;
}

// ── Progressive Build renderer ────────────────────────────────────────────────
// Phases : 0 = titre | 1 = core_idea | 2 = développement (+ visuel si horizontal) | 3 = synthèse bas

const PHASE_LABELS_CLASSIC = ['Titre', 'Idée centrale', 'Développement', 'Illustration'];
const PHASE_LABELS_HORIZONTAL = ['Titre', 'Idée centrale', 'Développement & visuel', 'Synthèse'];

/** Rendu Mermaid (SmartBoard IA : illustration.mermaid) */
function MermaidDiagram({ code }) {
  const ref = useRef(null);
  const idRef = useRef(`mermaid-sb-${Math.random().toString(36).slice(2, 11)}`);

  useEffect(() => {
    const raw = String(code || '').trim();
    if (!raw || !ref.current) return;
    let cancelled = false;
    import('mermaid')
      .then((mod) => {
        if (cancelled || !ref.current) return;
        const mermaid = mod.default;
        try {
          mermaid.initialize({
            startOnLoad: false,
            theme: 'dark',
            securityLevel: 'loose',
            fontFamily: 'ui-sans-serif, system-ui, sans-serif',
          });
        } catch {
          /* déjà initialisé */
        }
        ref.current.innerHTML = '';
        const id = idRef.current;
        mermaid
          .render(id, raw)
          .then(({ svg }) => {
            if (!cancelled && ref.current) ref.current.innerHTML = svg;
          })
          .catch(() => {
            if (!cancelled && ref.current) {
              ref.current.innerHTML = '<p class="text-xs text-amber-200/80 p-2">Schéma Mermaid non affichable</p>';
            }
          });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [code]);

  return (
    <div
      ref={ref}
      className="rounded-lg border border-white/10 bg-black/50 p-2 overflow-auto max-h-56 text-[10px] [&_svg]:max-w-full"
    />
  );
}

function isStructuredDevelopment(d) {
  return Array.isArray(d) && d.length > 0 && typeof d[0] === 'object' && Array.isArray(d[0].points);
}

function ProgressiveBuildSlide({
  slideKey,
  data,
  step = 0,
  onStepChange,
  spotlight,
  revealAll = false,
  onSmartboardImageExpand,
  /** Invité live : pas d’édition tactique ; clic traverse vers avance progressive */
  tacticalViewOnly = false,
  /** JSON string `{ focus, adj }` depuis l’hôte (même slide) */
  iaRemoteApplyKey = '',
  /** Hôte live : émettre l’état IA pour broadcast */
  onIaTacticalEmit,
  /** Masque radial bords (immersif) — fusion avec l’arrière-plan de l’écran intelligent */
  immersiveMaskStyle = {},
  /** Live plateau plein cadre : remplit la zone (cover) au lieu de bandes mortes (contain). */
  canvasScaleMode = 'contain',
  /** Live immersif : pas de dégradé bleu/violet de fond sur le canevas (contenu sur fond du shell). */
  transparentStageBackground = false,
}) {
  const [iaFocus, setIaFocus] = useState(null);
  const [iaAdj, setIaAdj] = useState({});
  /** id du panneau en drag/redimensionnement — spring désactivé sur ce seul panneau */
  const [iaDragPanelId, setIaDragPanelId] = useState(null);
  const iaInteractRef = useRef(null);
  const iaCtrlPendingRef = useRef(null);
  const iaScrollRootRef = useRef(null);
  const iaFocusRef = useRef(null);
  const canvasHostRef = useRef(null);
  /** 1 / facteur scale du canevas — pour convertir les deltas pointeur (px écran) en px maquette */
  const designCanvasScaleRef = useRef(1);
  const [canvasScale, setCanvasScale] = useState(1);
  const designSize = useMemo(() => resolveProgressiveSlideDesignSize(data), [data]);
  const designW = designSize.width;
  const designH = designSize.height;

  useLayoutEffect(() => {
    const el = canvasHostRef.current;
    if (!el) return undefined;
    const apply = (w, h) => {
      const s =
        canvasScaleMode === 'cover'
          ? computeDesignCanvasScaleCover(w, h, designW, designH)
          : computeDesignCanvasScaleContain(w, h, designW, designH);
      designCanvasScaleRef.current = s;
      setCanvasScale(s);
    };
    apply(el.clientWidth, el.clientHeight);
    const ro = new ResizeObserver((entries) => {
      const cr = entries[0]?.contentRect;
      if (!cr || cr.width < 4 || cr.height < 4) return;
      apply(cr.width, cr.height);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [slideKey, canvasScaleMode, designW, designH]);

  useEffect(() => {
    iaFocusRef.current = iaFocus;
  }, [iaFocus]);

  const iaEmitTimerRef = useRef(null);

  useEffect(() => {
    setIaDragPanelId(null);
    iaCtrlPendingRef.current = null;
    iaInteractRef.current = null;
    if (iaRemoteApplyKey) {
      try {
        const ia = JSON.parse(iaRemoteApplyKey);
        setIaFocus(ia.focus ?? null);
        setIaAdj(ia.adj && typeof ia.adj === 'object' ? ia.adj : {});
      } catch {
        setIaFocus(null);
        setIaAdj({});
      }
    } else {
      setIaFocus(null);
      setIaAdj({});
    }
  }, [slideKey, iaRemoteApplyKey]);

  useEffect(() => {
    if (!onIaTacticalEmit || tacticalViewOnly) return undefined;
    if (iaEmitTimerRef.current) clearTimeout(iaEmitTimerRef.current);
    iaEmitTimerRef.current = setTimeout(() => {
      iaEmitTimerRef.current = null;
      onIaTacticalEmit({ focus: iaFocus, adj: iaAdj });
    }, 55);
    return () => {
      if (iaEmitTimerRef.current) clearTimeout(iaEmitTimerRef.current);
    };
  }, [iaFocus, iaAdj, slideKey, onIaTacticalEmit, tacticalViewOnly]);

  useEffect(() => {
    const root = iaScrollRootRef.current;
    if (!root || tacticalViewOnly) return undefined;
    const onWheel = (e) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const host = e.target.closest?.('[data-sb-tactical-panel]');
      if (!host || !root.contains(host)) return;
      e.preventDefault();
      e.stopPropagation();
      const panelId = host.getAttribute('data-sb-tactical-panel');
      if (!panelId) return;
      const factor = Math.min(0.22, Math.max(-0.22, -e.deltaY * 0.002));
      setIaAdj((prev) => {
        const c = prev[panelId] || {};
        const cur = c.zoomMul ?? 1;
        const next = Math.min(1.48, Math.max(0.62, cur * (1 + factor)));
        return { ...prev, [panelId]: { ...c, zoomMul: next } };
      });
    };
    root.addEventListener('wheel', onWheel, { passive: false });
    return () => root.removeEventListener('wheel', onWheel);
  }, [slideKey, tacticalViewOnly]);

  useEffect(() => {
    if (tacticalViewOnly) return undefined;
    const onMove = (e) => {
      const p = iaCtrlPendingRef.current;
      if (p && !iaInteractRef.current) {
        const dx = e.clientX - p.startClientX;
        const dy = e.clientY - p.startClientY;
        if (Math.hypot(dx, dy) > 6) {
          iaInteractRef.current = {
            panelId: p.panelId,
            mode: 'move',
            startClientX: p.startClientX,
            startClientY: p.startClientY,
            orig: { ...p.orig },
          };
          iaCtrlPendingRef.current = null;
          setIaDragPanelId(p.panelId);
        }
      }
      const s = iaInteractRef.current;
      if (!s) return;
      const dxS = e.clientX - s.startClientX;
      const dyS = e.clientY - s.startClientY;
      const inv = 1 / Math.max(0.08, designCanvasScaleRef.current || 1);
      if (s.mode === 'move') {
        setIaAdj((prev) => ({
          ...prev,
          [s.panelId]: {
            ...(prev[s.panelId] || {}),
            geomDx: s.orig.geomDx + dxS * inv,
            geomDy: s.orig.geomDy + dyS * inv,
          },
        }));
      } else if (s.mode === 'resize-se') {
        const delta = (dxS + dyS) * 0.0035;
        const z = Math.min(1.48, Math.max(0.62, s.orig.zoomMul + delta));
        setIaAdj((prev) => ({
          ...prev,
          [s.panelId]: {
            ...(prev[s.panelId] || {}),
            zoomMul: z,
          },
        }));
      }
    };
    const end = () => {
      const pend = iaCtrlPendingRef.current;
      if (pend && !iaInteractRef.current) {
        setIaAdj((prev) => ({
          ...prev,
          [pend.panelId]: { ...(prev[pend.panelId] || {}), hidden: true, minimized: false },
        }));
      }
      iaCtrlPendingRef.current = null;
      iaInteractRef.current = null;
      setIaDragPanelId(null);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
    };
  }, [tacticalViewOnly]);

  useEffect(() => {
    const onKey = (e) => {
      if (tacticalViewOnly) return;
      if (e.target?.closest?.('input, textarea, select, [contenteditable="true"]')) return;
      if (e.key === 'Escape') {
        setIaFocus(null);
        setIaDragPanelId(null);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === '0') {
        e.preventDefault();
        setIaFocus(null);
        setIaAdj({});
        setIaDragPanelId(null);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && /^[1-9]$/.test(e.key)) {
        const fid = iaFocusRef.current;
        if (!fid) return;
        e.preventDefault();
        const n = Number(e.key);
        if (n === 1) {
          setIaAdj((prev) => ({ ...prev, [fid]: { ...(prev[fid] || {}), push: null } }));
        } else if (n === 2) {
          setIaAdj((prev) => ({ ...prev, [fid]: { ...(prev[fid] || {}), push: 'left' } }));
        } else if (n === 3) {
          setIaAdj((prev) => ({ ...prev, [fid]: { ...(prev[fid] || {}), push: 'right' } }));
        } else if (n === 4) {
          setIaAdj((prev) => {
            const c = prev[fid] || {};
            return { ...prev, [fid]: { ...c, minimized: !c.minimized, hidden: false } };
          });
        } else if (n === 5) {
          setIaAdj((prev) => {
            const c = prev[fid] || {};
            return { ...prev, [fid]: { ...c, hidden: !c.hidden, minimized: false } };
          });
        } else if (n === 6) {
          setIaAdj((prev) => {
            const c = prev[fid] || {};
            const m = Math.min(1.48, (c.zoomMul ?? 1) * 1.1);
            return { ...prev, [fid]: { ...c, zoomMul: m } };
          });
        } else if (n === 7) {
          setIaAdj((prev) => {
            const c = prev[fid] || {};
            const m = Math.max(0.62, (c.zoomMul ?? 1) / 1.1);
            return { ...prev, [fid]: { ...c, zoomMul: m } };
          });
        } else if (n === 8) {
          setIaAdj((prev) => {
            const c = { ...(prev[fid] || {}) };
            delete c.geomDx;
            delete c.geomDy;
            return { ...prev, [fid]: c };
          });
        } else if (n === 9) {
          setIaAdj((prev) => {
            const c = { ...(prev[fid] || {}) };
            delete c.zoomMul;
            return { ...prev, [fid]: c };
          });
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tacticalViewOnly]);

  const isHorizontalLayout = data.layout_mode === 'smartboard_horizontal'
    || data.format?.mode === 'smartboard_horizontal'
    || isStructuredDevelopment(data.development);
  const hasFooterContent = !!(data.illustration?.insight || data.illustration?.formula || data.illustration?.advice);
  const maxStep = isHorizontalLayout && !hasFooterContent ? 2 : 3;
  const effectiveStep = revealAll ? maxStep : step;
  const canAdvance = !revealAll && effectiveStep < maxStep;

  const advance = useCallback(() => {
    if (canAdvance) onStepChange?.(step + 1);
  }, [canAdvance, step, onStepChange]);

  const isHorizontal = isHorizontalLayout;
  const isCosmic = data.theme?.background === 'dark_cosmic_blue';
  const PHASE_LABELS = isHorizontal ? PHASE_LABELS_HORIZONTAL : PHASE_LABELS_CLASSIC;

  const hasDev = Array.isArray(data.development) && data.development.length > 0;
  const illUrl = data.illustration_image_url || data.illustration?.image_url;
  const hasIll = isHorizontal
    ? (hasFooterContent || !!(data.illustration?.scene || data.illustration?.mermaid || data.hero_visual || illUrl))
    : !!(data.illustration?.insight || data.illustration?.scene || data.illustration?.formula || illUrl);

  const bgClass = isCosmic
    ? 'bg-[radial-gradient(ellipse_at_15%_0%,rgba(99,102,241,0.22),transparent_45%),radial-gradient(ellipse_at_85%_90%,rgba(212,175,55,0.14),transparent_42%),radial-gradient(ellipse_at_50%_50%,rgba(15,23,42,0.9),#050814_75%)]'
    : 'bg-[radial-gradient(ellipse_at_20%_10%,rgba(151,127,255,0.18),transparent_50%),radial-gradient(ellipse_at_80%_85%,rgba(212,175,55,0.12),transparent_50%)]';

  const accentBorder = isCosmic ? 'border-[#C9D3F2]/25' : 'border-[#D4AF37]/30';
  const accentBg = isCosmic ? 'bg-[#C9D3F2]/08' : 'bg-[#D4AF37]/08';

  return (
    <div
      className={cn(
        'absolute inset-0 flex flex-col select-none overflow-hidden',
        !revealAll && 'cursor-pointer',
      )}
      onClick={revealAll ? undefined : advance}
      title={
        revealAll
          ? 'Lecture intégrale'
          : canAdvance
            ? `Cliquer pour révéler : ${PHASE_LABELS[step + 1] || ''}`
            : 'Slide complète'
      }
    >
      <div
        ref={canvasHostRef}
        className="relative flex min-h-0 min-w-0 flex-1 items-center justify-center overflow-hidden"
      >
        <div
          className="relative shrink-0 overflow-hidden"
          style={{
            width: designW * canvasScale,
            height: designH * canvasScale,
          }}
        >
          <div
            className={cn(
              'absolute left-0 top-0 flex flex-col overflow-hidden',
              transparentStageBackground ? 'rounded-none' : 'rounded-[20px]',
            )}
            style={{
              width: designW,
              height: designH,
              transform: `scale(${canvasScale})`,
              transformOrigin: 'top left',
              ...immersiveMaskStyle,
            }}
          >
            {!transparentStageBackground ? (
              <div className={cn('pointer-events-none absolute inset-0', bgClass)} />
            ) : null}

            <div
              ref={iaScrollRootRef}
              className="relative flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-8 pb-5 pt-10 [scrollbar-width:none]"
            >

        <AnimatePresence>
          {effectiveStep >= 0 && (
            <motion.div
              key="affiche"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
              className="flex flex-col gap-2"
            >
              <IaTacticalPanel
                panelId="ia-hero"
                iaFocus={iaFocus}
                setIaFocus={setIaFocus}
                iaAdj={iaAdj}
                setIaAdj={setIaAdj}
                iaInteractRef={iaInteractRef}
                iaCtrlPendingRef={iaCtrlPendingRef}
                tacticalDragPanelId={iaDragPanelId}
                onBeginTacticalDrag={setIaDragPanelId}
                viewOnly={tacticalViewOnly}
                className="flex flex-col gap-2"
              >
                {!transparentStageBackground ? (
                  <span className={`inline-flex self-start items-center gap-1.5 h-6 px-3 rounded-full ${accentBg} border ${accentBorder} text-[#D4AF37] text-[11px] font-medium tracking-wider uppercase`}>
                    <span className="w-1.5 h-1.5 rounded-full bg-[#D4AF37] animate-pulse" />
                    {isHorizontal
                      ? `Canevas ${designW}×${designH} · Écran intelligent`
                      : 'Grande Affiche'}
                  </span>
                ) : null}

                {data.subtitle && (
                  <p
                    className="text-xs font-semibold uppercase tracking-[0.18em] text-white/50"
                    style={data.theme?.text_secondary ? { color: data.theme.text_secondary } : undefined}
                  >
                    {data.subtitle}
                  </p>
                )}

                <h2
                  className={[
                    'font-bold leading-[0.92] tracking-[-0.02em] font-serif',
                    spotlight ? 'drop-shadow-[0_0_28px_rgba(212,175,55,0.5)]' : 'drop-shadow-[0_8px_30px_rgba(0,0,0,0.6)]',
                    'text-[2.375rem] text-[#F5F1E8]',
                  ].join(' ')}
                >
                  {data.title}
                </h2>

                {data.visual_description && !isHorizontal && (
                  <p className="text-[11px] text-white/25 italic leading-relaxed mt-1">
                    ✦ {data.visual_description}
                  </p>
                )}

                {!isHorizontal && illUrl && (
                  <div className="mt-3 max-w-lg self-start rounded-xl overflow-hidden border border-white/12 shadow-lg">
                    <ExpandableHostImage
                      src={illUrl}
                      alt={data.title || 'Visuel'}
                      onExpand={onSmartboardImageExpand}
                      imgClassName="block w-full max-h-48 object-cover"
                    />
                  </div>
                )}
                {!isHorizontal && data.slide_summary && (
                  <div className="mt-3 rounded-xl border border-[#D4AF37]/20 bg-[#D4AF37]/06 px-4 py-3 max-w-2xl">
                    <p className="text-[10px] uppercase tracking-widest text-[#D4AF37]/55 font-semibold mb-1.5">Résumé</p>
                    <p className="text-sm md:text-[15px] text-white/88 leading-relaxed font-serif">{data.slide_summary}</p>
                  </div>
                )}
                {isHorizontal && data.slide_summary && effectiveStep >= 2 && (
                  <div className={`mt-2 rounded-xl border ${accentBorder} ${accentBg} px-4 py-2.5 max-w-2xl`}>
                    <p className="text-[10px] uppercase tracking-widest text-white/40 font-semibold mb-1">Résumé</p>
                    <p className="text-sm text-white/85 leading-snug font-serif">{data.slide_summary}</p>
                  </div>
                )}
              </IaTacticalPanel>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {effectiveStep >= 1 && data.core_idea && (
            <motion.div
              key="core"
              initial={{ opacity: 0, x: -16, scale: 0.97 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className={`rounded-2xl border ${accentBorder} ${accentBg} backdrop-blur-sm px-5 py-4`}
            >
              <IaTacticalPanel
                panelId="ia-core"
                iaFocus={iaFocus}
                setIaFocus={setIaFocus}
                iaAdj={iaAdj}
                setIaAdj={setIaAdj}
                iaInteractRef={iaInteractRef}
                iaCtrlPendingRef={iaCtrlPendingRef}
                tacticalDragPanelId={iaDragPanelId}
                onBeginTacticalDrag={setIaDragPanelId}
                viewOnly={tacticalViewOnly}
                className=""
              >
                <p className="text-[10px] uppercase tracking-widest text-[#D4AF37]/65 mb-2 font-semibold">
                  Idée centrale
                </p>
                <p className="text-xl font-semibold text-[#F5F1E8] leading-snug">
                  &ldquo;{data.core_idea}&rdquo;
                </p>
              </IaTacticalPanel>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {effectiveStep >= 2 && hasDev && (
            <motion.div
              key="dev"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              className={isHorizontal ? 'grid grid-cols-2 gap-4 items-start' : 'flex flex-col gap-2'}
            >
              {!isHorizontal && (
                <p className="text-[10px] uppercase tracking-widest text-white/35 font-semibold mb-1">
                  Développement
                </p>
              )}
              {isHorizontal && (
                <p className="text-[10px] uppercase tracking-widest text-[#C9D3F2]/50 font-semibold mb-1 col-span-2">
                  Développement (gauche) · Visuel (droite)
                </p>
              )}

              {isStructuredDevelopment(data.development) ? (
                <>
                  <IaTacticalPanel
                    panelId="ia-dev"
                    iaFocus={iaFocus}
                    setIaFocus={setIaFocus}
                    iaAdj={iaAdj}
                    setIaAdj={setIaAdj}
                    iaInteractRef={iaInteractRef}
                    iaCtrlPendingRef={iaCtrlPendingRef}
                    tacticalDragPanelId={iaDragPanelId}
                    onBeginTacticalDrag={setIaDragPanelId}
                    viewOnly={tacticalViewOnly}
                    className="flex flex-col gap-3 min-w-0"
                  >
                    {data.development.map((block, i) => (
                      <motion.div
                        key={block.label || i}
                        initial={{ opacity: 0, x: -12 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.06, duration: 0.35 }}
                        className={`rounded-xl bg-white/[0.05] border ${accentBorder} backdrop-blur-md px-4 py-3`}
                      >
                        <p className="text-[11px] font-bold text-[#D4AF37] tracking-wide mb-2">{block.label}</p>
                        <ul className="space-y-1.5">
                          {(block.points || []).slice(0, 3).map((pt, j) => (
                            <li key={j} className="text-[15px] text-[#F5F1E8]/90 leading-snug flex gap-2">
                              <span className="text-[#D4AF37]/80 flex-shrink-0">▸</span>
                              <span>{pt}</span>
                            </li>
                          ))}
                        </ul>
                      </motion.div>
                    ))}
                  </IaTacticalPanel>
                  <IaTacticalPanel
                    panelId="ia-visual"
                    iaFocus={iaFocus}
                    setIaFocus={setIaFocus}
                    iaAdj={iaAdj}
                    setIaAdj={setIaAdj}
                    iaInteractRef={iaInteractRef}
                    iaCtrlPendingRef={iaCtrlPendingRef}
                    tacticalDragPanelId={iaDragPanelId}
                    onBeginTacticalDrag={setIaDragPanelId}
                    viewOnly={tacticalViewOnly}
                    className="flex flex-col gap-3 min-w-0"
                  >
                    {data.hero_visual?.description && (
                      <div className={`rounded-xl border ${accentBorder} bg-black/25 backdrop-blur-md px-4 py-3`}>
                        <p className="text-[9px] uppercase tracking-widest text-[#C9D3F2]/55 font-semibold mb-1">
                          {data.hero_visual.type || 'Visuel'}
                        </p>
                        <p className="text-[13px] text-[#C9D3F2]/90 leading-relaxed">{data.hero_visual.description}</p>
                      </div>
                    )}
                    {data.illustration?.scene && (
                      <p className="text-[12px] text-white/45 italic leading-relaxed px-1">
                        {data.illustration.scene}
                      </p>
                    )}
                    {data.illustration?.mermaid && (
                      <div className="min-w-0">
                        <p className="text-[9px] uppercase tracking-widest text-[#C9D3F2]/45 font-semibold mb-1">
                          Schéma
                        </p>
                        <MermaidDiagram code={data.illustration.mermaid} />
                      </div>
                    )}
                    {illUrl && (
                      <div className="rounded-xl overflow-hidden border border-white/12 shadow-lg">
                        <ExpandableHostImage
                          src={illUrl}
                          alt={data.title || 'Illustration'}
                          onExpand={onSmartboardImageExpand}
                          imgClassName="block w-full max-h-56 object-cover"
                        />
                      </div>
                    )}
                  </IaTacticalPanel>
                </>
              ) : (
                <IaTacticalPanel
                  panelId="ia-dev"
                  iaFocus={iaFocus}
                  setIaFocus={setIaFocus}
                  iaAdj={iaAdj}
                  setIaAdj={setIaAdj}
                  iaInteractRef={iaInteractRef}
                  iaCtrlPendingRef={iaCtrlPendingRef}
                  tacticalDragPanelId={iaDragPanelId}
                  onBeginTacticalDrag={setIaDragPanelId}
                  viewOnly={tacticalViewOnly}
                  className="flex flex-col gap-2 w-full"
                >
                  {data.development.map((point, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.08, duration: 0.35 }}
                      className="flex items-start gap-3 rounded-xl bg-white/[0.04] border border-white/08 px-4 py-2.5"
                    >
                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-white/10 border border-white/15 flex items-center justify-center text-[9px] text-white/50 font-bold mt-0.5">
                        {i + 1}
                      </span>
                      <p className="text-[15px] text-gray-100/90 leading-relaxed">{point}</p>
                    </motion.div>
                  ))}
                </IaTacticalPanel>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {effectiveStep >= 3 && (isHorizontal ? hasFooterContent : hasIll) && (
            <motion.div
              key="illustration"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className={`rounded-2xl overflow-hidden border ${isHorizontal ? 'border-[#D4AF37]/25' : 'border-purple-500/20'} ${isHorizontal ? 'bg-black/30 backdrop-blur-md' : 'bg-gradient-to-br from-purple-500/08 to-blue-500/06'}`}
            >
              <IaTacticalPanel
                panelId="ia-footer"
                iaFocus={iaFocus}
                setIaFocus={setIaFocus}
                iaAdj={iaAdj}
                setIaAdj={setIaAdj}
                iaInteractRef={iaInteractRef}
                iaCtrlPendingRef={iaCtrlPendingRef}
                tacticalDragPanelId={iaDragPanelId}
                onBeginTacticalDrag={setIaDragPanelId}
                viewOnly={tacticalViewOnly}
                className=""
              >
                <div className="px-4 py-2 border-b border-white/06 flex items-center gap-2">
                  <span className={`text-[10px] uppercase tracking-widest font-semibold ${isHorizontal ? 'text-[#D4AF37]/70' : 'text-purple-300/60'}`}>
                    {isHorizontal ? 'Insight & formule' : 'Illustration'}
                  </span>
                </div>
                <div className="px-4 py-3 flex flex-col gap-2.5">
                  {!isHorizontal && illUrl && (
                    <ExpandableHostImage
                      src={illUrl}
                      alt={data.title || 'Illustration'}
                      onExpand={onSmartboardImageExpand}
                      imgClassName="block w-full max-h-52 object-cover rounded-xl border border-white/12 shadow-lg"
                    />
                  )}
                  {!isHorizontal && data.illustration?.scene && (
                    <p className="text-[12px] text-white/50 italic leading-relaxed">
                      {data.illustration.scene}
                    </p>
                  )}
                  {data.illustration?.insight && (
                    <p className="text-base font-semibold text-white leading-snug">
                      {data.illustration.insight}
                    </p>
                  )}
                  {data.illustration?.formula && (
                    <div className="rounded-xl bg-white/[0.06] border border-white/10 px-4 py-2 text-center">
                      <p className="text-sm font-mono font-bold text-[#D4AF37] tracking-wide">
                        {data.illustration.formula}
                      </p>
                    </div>
                  )}
                  {data.illustration?.advice && (
                    <p className="text-[11px] text-emerald-300/70 leading-relaxed">
                      💡 {data.illustration.advice}
                    </p>
                  )}
                </div>
              </IaTacticalPanel>
            </motion.div>
          )}
        </AnimatePresence>
            </div>
          </div>
        </div>
      </div>

      {/* ── Barre de progression et bouton avancer ── */}
      <div className="relative flex-shrink-0 flex flex-col gap-1 px-5 py-2.5 border-t border-white/08 bg-black/20 backdrop-blur-sm">
        <div className="flex items-center gap-3">
        {/* Dots de progression */}
        <div className="flex items-center gap-1.5">
          {Array.from({ length: maxStep + 1 }, (_, ph) => (
            <button
              key={ph}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (!revealAll) onStepChange?.(ph);
              }}
              disabled={revealAll}
              className={[
                'rounded-full transition-all duration-300',
                ph <= effectiveStep
                  ? 'bg-[#D4AF37] w-5 h-1.5 shadow-[0_0_8px_rgba(212,175,55,0.6)]'
                  : 'bg-white/20 w-1.5 h-1.5',
                revealAll && 'opacity-80 cursor-default',
              ].join(' ')}
              title={PHASE_LABELS[ph]}
            />
          ))}
        </div>

        <div className="flex-1" />

        {/* Label phase actuelle */}
        <span className="text-[10px] text-white/30 font-medium">
          {revealAll ? 'Lecture intégrale' : PHASE_LABELS[step]}
        </span>

        {/* Bouton avancer */}
        {revealAll ? (
          <span className="h-7 px-3 rounded-xl bg-white/08 border border-white/12 text-white/45 text-[11px] font-medium flex items-center gap-1">
            Vue complète
          </span>
        ) : canAdvance ? (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); advance(); }}
            className="h-7 px-3 rounded-xl bg-[#D4AF37]/15 border border-[#D4AF37]/35 text-[#D4AF37] text-[11px] font-semibold hover:bg-[#D4AF37]/25 transition-colors flex items-center gap-1.5"
          >
            <span>{PHASE_LABELS[step + 1]}</span>
            <span className="opacity-60">→</span>
          </button>
        ) : (
          <span className="h-7 px-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-semibold flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            Complet
          </span>
        )}
        </div>
        <p className="text-center text-[9px] leading-snug text-white/28">
          Zones tactiques · clic = focus · ⌃+molette = zoom · ⌃+glisser = déplacer · ⌃+clic gauche = masquer ·
          ⌃+clic droit = afficher · barre / coin si focus · Alt mini · Shift pousser · ⌃1–9 · Échap / ⌃0
        </p>
      </div>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function SlideParallaxStage({
  slide,
  spotlight = false,
  step,
  onStepChange,
  /** false = afficher toute la slide d'un coup (toggle live « lecture progressive ») */
  progressivePlayback = true,
  /** Hôte uniquement : clic image → modale synchronisée */
  onSmartboardImageExpand,
  /** Live Arena : 'host' émet, 'viewer' applique + lecture seule tactique */
  tacticalSyncRole,
  /** Snapshot tactique depuis broadcast (invités) */
  remoteTacticalSync = null,
  /** Hôte : (payload) => void — throttlé dans le composant */
  onTacticalSyncChange = null,
  /**
   * true = fondu bords par défaut si la slide ne fixe pas `immersive_edge_feather` (SmartBoard natif).
   * false = pas de défaut (ex. scène diaporama importé) ; la slide peut quand même définir une valeur > 0.
   */
  immersiveEdgeDefault = true,
  /** Slide Studio Capture : fond papier clair + pas de dégradé violet sur le legacy */
  canvasStudioPaper = false,
  /** Masque le bandeau d’aide mode tactique (ex. aperçu enregistrement) */
  legacyPresentationMode = false,
  /**
   * LiveHost / LiveArena : le canevas Architect (1037×750) remplit le cadre central (cover) et le fond
   * décoratif bleu est retiré pour s’intégrer au plateau (grille shell).
   */
  liveStageFillCover = false,
}) {
  const tacticalViewOnly = tacticalSyncRole === 'viewer';

  const tacticalEmitTimerRef = useRef(null);
  const queueTacticalBroadcast = useCallback((payload) => {
    if (tacticalSyncRole !== 'host' || !onTacticalSyncChange) return;
    if (tacticalEmitTimerRef.current) clearTimeout(tacticalEmitTimerRef.current);
    tacticalEmitTimerRef.current = setTimeout(() => {
      tacticalEmitTimerRef.current = null;
      onTacticalSyncChange(payload);
    }, 55);
  }, [tacticalSyncRole, onTacticalSyncChange]);

  useEffect(() => () => {
    if (tacticalEmitTimerRef.current) clearTimeout(tacticalEmitTimerRef.current);
  }, []);

  const immersiveMaskStyle = useMemo(() => {
    const pct = resolveSmartboardEdgeFeatherPercent(slide, immersiveEdgeDefault);
    return smartboardEdgeFeatherMaskStyle(pct);
  }, [slide, immersiveEdgeDefault]);

  const [parallax, setParallax] = useState({ x: 0, y: 0 });
  const [internalStep, setInternalStep] = useState(0);
  const [legacyRevealIdx, setLegacyRevealIdx] = useState(0);
  const [legacyFocusId, setLegacyFocusId] = useState(null);
  const [legacyElAdjust, setLegacyElAdjust] = useState({});
  const [legacyGeom, setLegacyGeom] = useState({});
  const [legacyDragElKey, setLegacyDragElKey] = useState(null);
  const legacyInteractRef = useRef(null);
  const legacyCtrlPendingRef = useRef(null);
  const legacyFocusIdRef = useRef(null);

  useEffect(() => {
    legacyFocusIdRef.current = legacyFocusId;
  }, [legacyFocusId]);

  useEffect(() => {
    if (tacticalSyncRole !== 'viewer' || !slide || slide.ia_data) return;
    const r = remoteTacticalSync;
    if (!r || r.v !== SB_TACTICAL_SYNC_V || String(r.slideId) !== String(slide.id) || r.kind !== 'legacy' || !r.legacy) {
      setLegacyFocusId(null);
      setLegacyElAdjust({});
      setLegacyGeom({});
      return;
    }
    const L = r.legacy;
    setLegacyFocusId(L.focusId ?? null);
    setLegacyElAdjust(L.adjust && typeof L.adjust === 'object' ? { ...L.adjust } : {});
    setLegacyGeom(L.geom && typeof L.geom === 'object' ? { ...L.geom } : {});
  }, [tacticalSyncRole, remoteTacticalSync, slide?.id, slide?.ia_data]);

  useEffect(() => {
    if (tacticalSyncRole !== 'host' || !onTacticalSyncChange || !slide || slide.ia_data) return;
    queueTacticalBroadcast({
      v: SB_TACTICAL_SYNC_V,
      slideId: String(slide.id),
      kind: 'legacy',
      legacy: {
        focusId: legacyFocusId,
        adjust: { ...legacyElAdjust },
        geom: { ...legacyGeom },
      },
      ia: null,
    });
  }, [legacyFocusId, legacyElAdjust, legacyGeom, slide?.id, slide?.ia_data, tacticalSyncRole, onTacticalSyncChange, queueTacticalBroadcast]);

  useEffect(() => {
    if (!slide || slide.ia_data || tacticalViewOnly) return undefined;
    const onWheel = (e) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const host = e.target.closest?.('[data-sb-tactical]');
      if (!host) return;
      e.preventDefault();
      e.stopPropagation();
      const elKey = host.getAttribute('data-sb-tactical');
      if (!elKey) return;
      const factor = Math.min(0.22, Math.max(-0.22, -e.deltaY * 0.002));
      setLegacyElAdjust((prev) => {
        const c = prev[elKey] || {};
        const cur = c.scaleMul ?? 1;
        const next = Math.min(1.48, Math.max(0.62, cur * (1 + factor)));
        return { ...prev, [elKey]: { ...c, scaleMul: next } };
      });
    };
    document.addEventListener('wheel', onWheel, { passive: false, capture: true });
    return () => document.removeEventListener('wheel', onWheel, { capture: true });
  }, [slide?.id, slide?.ia_data, tacticalViewOnly]);

  useEffect(() => {
    if (tacticalViewOnly) return undefined;
    const onMove = (e) => {
      const p = legacyCtrlPendingRef.current;
      if (p && !legacyInteractRef.current) {
        const dx = e.clientX - p.startClientX;
        const dy = e.clientY - p.startClientY;
        if (Math.hypot(dx, dy) > 6) {
          legacyInteractRef.current = {
            elKey: p.elKey,
            mode: 'move',
            startClientX: p.startClientX,
            startClientY: p.startClientY,
            orig: p.orig,
            baseW: p.baseW,
            baseH: p.baseH,
          };
          legacyCtrlPendingRef.current = null;
          setLegacyDragElKey(p.elKey);
        }
      }
      const s = legacyInteractRef.current;
      if (!s) return;
      const dx = e.clientX - s.startClientX;
      const dy = e.clientY - s.startClientY;
      if (s.mode === 'move') {
        setLegacyGeom((prev) => ({
          ...prev,
          [s.elKey]: {
            dx: s.orig.dx + dx,
            dy: s.orig.dy + dy,
            dw: s.orig.dw,
            dh: s.orig.dh,
          },
        }));
      } else if (s.mode === 'resize-se') {
        const minDw = 40 - s.baseW;
        const minDh = 32 - s.baseH;
        setLegacyGeom((prev) => ({
          ...prev,
          [s.elKey]: {
            dx: s.orig.dx,
            dy: s.orig.dy,
            dw: Math.max(minDw, s.orig.dw + dx),
            dh: Math.max(minDh, s.orig.dh + dy),
          },
        }));
      }
    };
    const end = () => {
      const pend = legacyCtrlPendingRef.current;
      if (pend && !legacyInteractRef.current) {
        setLegacyElAdjust((prev) => ({
          ...prev,
          [pend.elKey]: { ...(prev[pend.elKey] || {}), hidden: true, minimized: false },
        }));
      }
      legacyCtrlPendingRef.current = null;
      legacyInteractRef.current = null;
      setLegacyDragElKey(null);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
    };
  }, [tacticalViewOnly]);

  useEffect(() => {
    if (!slide?.id) return;
    setInternalStep(0);
    setLegacyRevealIdx(0);
    setLegacyFocusId(null);
    setLegacyElAdjust({});
    setLegacyGeom({});
    setLegacyDragElKey(null);
    legacyCtrlPendingRef.current = null;
  }, [slide?.id]);

  useEffect(() => {
    const onKey = (e) => {
      if (tacticalViewOnly) return;
      if (e.target?.closest?.('input, textarea, select, [contenteditable="true"]')) return;
      if (e.key === 'Escape') {
        setLegacyFocusId(null);
        setLegacyDragElKey(null);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === '0') {
        e.preventDefault();
        setLegacyFocusId(null);
        setLegacyElAdjust({});
        setLegacyGeom({});
        setLegacyDragElKey(null);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && /^[1-9]$/.test(e.key)) {
        const id = legacyFocusIdRef.current;
        if (!id) return;
        e.preventDefault();
        const n = Number(e.key);
        if (n === 1) {
          setLegacyElAdjust((prev) => ({ ...prev, [id]: { ...(prev[id] || {}), push: null } }));
        } else if (n === 2) {
          setLegacyElAdjust((prev) => ({ ...prev, [id]: { ...(prev[id] || {}), push: 'left' } }));
        } else if (n === 3) {
          setLegacyElAdjust((prev) => ({ ...prev, [id]: { ...(prev[id] || {}), push: 'right' } }));
        } else if (n === 4) {
          setLegacyElAdjust((prev) => {
            const c = prev[id] || {};
            return { ...prev, [id]: { ...c, minimized: !c.minimized, hidden: false } };
          });
        } else if (n === 5) {
          setLegacyElAdjust((prev) => {
            const c = prev[id] || {};
            return { ...prev, [id]: { ...c, hidden: !c.hidden, minimized: false } };
          });
        } else if (n === 6) {
          setLegacyElAdjust((prev) => {
            const c = prev[id] || {};
            const m = Math.min(1.48, (c.scaleMul ?? 1) * 1.1);
            return { ...prev, [id]: { ...c, scaleMul: m } };
          });
        } else if (n === 7) {
          setLegacyElAdjust((prev) => {
            const c = prev[id] || {};
            const m = Math.max(0.62, (c.scaleMul ?? 1) / 1.1);
            return { ...prev, [id]: { ...c, scaleMul: m } };
          });
        } else if (n === 8) {
          setLegacyGeom((prev) => {
            const next = { ...prev };
            delete next[id];
            return next;
          });
        } else if (n === 9) {
          setLegacyElAdjust((prev) => {
            const c = { ...(prev[id] || {}) };
            delete c.scaleMul;
            return { ...prev, [id]: c };
          });
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tacticalViewOnly]);

  const iaRemoteApplyKey = useMemo(() => {
    if (tacticalSyncRole !== 'viewer' || !slide?.ia_data || !remoteTacticalSync) return '';
    const r = remoteTacticalSync;
    if (!r || r.v !== SB_TACTICAL_SYNC_V || String(r.slideId) !== String(slide.id) || r.kind !== 'ia' || !r.ia) return '';
    try {
      return JSON.stringify(r.ia);
    } catch {
      return '';
    }
  }, [tacticalSyncRole, remoteTacticalSync, slide?.id, slide?.ia_data]);

  const handleIaTacticalEmit = useCallback((iaPart) => {
    if (!slide?.id || slide?.ia_data == null) return;
    queueTacticalBroadcast({
      v: SB_TACTICAL_SYNC_V,
      slideId: String(slide.id),
      kind: 'ia',
      legacy: null,
      ia: {
        focus: iaPart?.focus ?? null,
        adj: iaPart?.adj && typeof iaPart.adj === 'object' ? iaPart.adj : {},
      },
    });
  }, [slide?.id, slide?.ia_data, queueTacticalBroadcast]);

  if (!slide) return null;

  const isProgressiveBuild = !!slide.ia_data;
  const currentStep = step !== undefined ? step : internalStep;
  const handleStepChange = onStepChange || setInternalStep;
  const studioPaper = Boolean(slide?.canvasStudioPaper || canvasStudioPaper);

  // ── Progressive Build mode ──────────────────────────────────────────────────
  if (isProgressiveBuild) {
    return (
      <div
        className={cn(
          'relative h-full w-full overflow-hidden bg-transparent',
          liveStageFillCover ? 'rounded-none' : 'rounded-[26px]',
        )}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={slide.id}
            initial={{ opacity: 0, y: 16, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -14, scale: 0.99 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="absolute inset-0"
          >
            <ProgressiveBuildSlide
              slideKey={slide.id}
              data={slide.ia_data}
              step={currentStep}
              onStepChange={handleStepChange}
              spotlight={spotlight}
              revealAll={!progressivePlayback}
              onSmartboardImageExpand={onSmartboardImageExpand}
              tacticalViewOnly={tacticalViewOnly}
              iaRemoteApplyKey={iaRemoteApplyKey}
              onIaTacticalEmit={tacticalSyncRole === 'host' ? handleIaTacticalEmit : undefined}
              immersiveMaskStyle={immersiveMaskStyle}
              canvasScaleMode={liveStageFillCover ? 'cover' : 'contain'}
              transparentStageBackground={liveStageFillCover}
            />
          </motion.div>
        </AnimatePresence>
      </div>
    );
  }

  // ── Legacy element-based mode ───────────────────────────────────────────────
  const legacyEls = slide.elements || [];
  const fullBleedDocumentOnly = legacyEls.length > 0
    && legacyEls.every((e) => e.type === 'document' && (e.src || e.url || e.href));

  const legacyProgressive = progressivePlayback && !fullBleedDocumentOnly && legacyEls.length > 1;
  const legacyVisibleCount = legacyProgressive
    ? Math.min(legacyRevealIdx + 1, legacyEls.length)
    : legacyEls.length;
  const legacyVisible = legacyEls.slice(0, legacyVisibleCount);

  const advanceLegacy = () => {
    setLegacyRevealIdx((i) => (i < legacyEls.length - 1 ? i + 1 : i));
  };

  const minimizedKeys = legacyVisible
    .map((e2, j) => e2.id || `${slide.id}-${j}`)
    .filter((k) => legacyElAdjust[k]?.minimized);
  const focusDim = legacyFocusId != null && !fullBleedDocumentOnly;

  return (
    <div
      className="relative h-full w-full min-h-0 rounded-[26px] bg-transparent overflow-x-hidden overflow-y-visible flex flex-col"
      onMouseMove={(e) => {
        if (fullBleedDocumentOnly) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
        const y = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
        setParallax({ x, y });
      }}
      onMouseLeave={() => setParallax({ x: 0, y: 0 })}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={slide.id}
          initial={{ opacity: 0, y: 16, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -14, scale: 0.99 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className={cn(
            'absolute inset-0 min-h-0 flex flex-col overflow-visible',
            legacyProgressive && 'cursor-pointer',
          )}
          style={{
            ...(Object.keys(immersiveMaskStyle).length ? immersiveMaskStyle : {}),
            ...(studioPaper ? { background: '#f7f6f3' } : {}),
          }}
          onClick={legacyProgressive ? advanceLegacy : undefined}
        >
          {!fullBleedDocumentOnly && !studioPaper && (
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_16%,rgba(151,127,255,0.22),transparent_34%),radial-gradient(circle_at_78%_20%,rgba(69,153,255,0.14),transparent_36%),radial-gradient(circle_at_50%_82%,rgba(255,255,255,0.04),transparent_44%)]" />
          )}
          {legacyVisible.map((el, idx) => {
            const isDoc = el.type === 'document' && (el.src || el.url || el.href);
            const elKey = el.id || `${slide.id}-${idx}`;
            const z = el.zIndex || 1;
            const tacticalOn = !fullBleedDocumentOnly && !isDoc;
            const adj = legacyElAdjust[elKey] || {};
            const isFocused = tacticalOn && legacyFocusId === elKey;
            const push = adj.push || null;
            const g = legacyGeom[elKey] || {};
            const posStyle = isDoc
              ? {
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                zIndex: z,
              }
              : adj.minimized
                ? {
                  position: 'absolute',
                  left: 'auto',
                  top: 'auto',
                  right: 6 + (minimizedKeys.indexOf(elKey) % 6) * 56,
                  bottom: 6 + Math.floor(minimizedKeys.indexOf(elKey) / 6) * 54,
                  width: Math.max(56, el.width * 0.24),
                  height: Math.max(48, el.height * 0.24),
                  zIndex: 220 + minimizedKeys.indexOf(elKey),
                }
                : {
                  position: 'absolute',
                  left: el.x + parallax.x * (z * 0.9) + (g.dx || 0),
                  top: el.y + parallax.y * (z * 0.7) + (g.dy || 0),
                  width: Math.max(40, el.width + (g.dw || 0)),
                  height: Math.max(32, el.height + (g.dh || 0)),
                  zIndex: isFocused ? z + 140 : z,
                };

            const pushX = push === 'left' ? -36 : push === 'right' ? 36 : 0;
            const scaleMul = Math.min(1.48, Math.max(0.62, adj.scaleMul ?? 1));

            return (
              <motion.div
                key={elKey}
                data-sb-tactical={tacticalOn ? elKey : undefined}
                initial={{ opacity: 0, y: 6 }}
                animate={
                  tacticalOn
                    ? {
                      opacity: adj.hidden ? 0 : focusDim && !isFocused ? 0.4 : 1,
                      y: adj.hidden ? 10 : 0,
                      scale: adj.minimized
                        ? 1
                        : (isFocused ? 1.06 : focusDim ? 0.93 : 1) * scaleMul,
                      x: pushX,
                      filter: focusDim && !isFocused && !adj.hidden && !adj.minimized
                        ? 'blur(5px) saturate(0.85)'
                        : 'blur(0px) saturate(1)',
                    }
                    : { opacity: 1, y: 0, scale: 1, x: 0, filter: 'none' }
                }
                transition={
                  tacticalOn
                    ? legacyDragElKey === elKey
                      ? { duration: 0 }
                      : { type: 'spring', stiffness: 400, damping: 28, delay: idx * 0.04 }
                    : { delay: idx * 0.05, duration: 0.35 }
                }
                style={{
                  ...posStyle,
                  pointerEvents: adj.hidden ? 'none' : 'auto',
                }}
                className={cn(
                  isDoc ? 'min-h-0 min-w-0' : '',
                  spotlight && el.animation === 'spotlight' ? 'drop-shadow-[0_0_30px_rgba(212,175,55,0.45)]' : '',
                  tacticalOn && isFocused && 'rounded-lg ring-2 ring-[#D4AF37]/60 shadow-[0_0_48px_rgba(212,175,55,0.22)]',
                  tacticalOn && !isDoc && 'origin-center',
                )}
                onContextMenu={
                  tacticalOn && !tacticalViewOnly
                    ? (e) => {
                      if (!(e.ctrlKey || e.metaKey)) return;
                      e.preventDefault();
                      e.stopPropagation();
                      setLegacyElAdjust((prev) => ({
                        ...prev,
                        [elKey]: { ...(prev[elKey] || {}), hidden: false, minimized: false },
                      }));
                    }
                    : undefined
                }
                onPointerDownCapture={
                  tacticalOn && !tacticalViewOnly
                    ? (e) => {
                      if ((e.ctrlKey || e.metaKey) && e.button === 0) {
                        const t = e.target;
                        if (typeof t.closest === 'function' && t.closest('button, a, input, textarea, .sb-tactical-handle')) {
                          return;
                        }
                        e.stopPropagation();
                        e.preventDefault();
                        const cur = legacyGeom[elKey] || {};
                        legacyCtrlPendingRef.current = {
                          elKey,
                          startClientX: e.clientX,
                          startClientY: e.clientY,
                          orig: {
                            dx: cur.dx || 0,
                            dy: cur.dy || 0,
                            dw: cur.dw || 0,
                            dh: cur.dh || 0,
                          },
                          baseW: el.width,
                          baseH: el.height,
                        };
                        return;
                      }
                      if (e.ctrlKey || e.metaKey) return;
                      if (e.altKey || e.shiftKey) {
                        if (applyTacticalAltShiftActions(e, elKey, setLegacyElAdjust)) {
                          e.stopPropagation();
                        }
                      }
                    }
                    : undefined
                }
                onClick={
                  tacticalOn && !tacticalViewOnly
                    ? (e) => {
                      if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
                      const t = e.target;
                      if (typeof t.closest === 'function' && t.closest('button, a, input, textarea')) return;
                      e.stopPropagation();
                      setLegacyFocusId((id) => (id === elKey ? null : elKey));
                    }
                    : undefined
                }
              >
                {tacticalOn && isFocused && !adj.minimized && !isDoc && !adj.hidden && !tacticalViewOnly && (
                  <>
                    <div
                      role="presentation"
                      className="sb-tactical-handle absolute left-1 right-8 top-0 z-[80] h-7 cursor-grab rounded-t-md bg-[#D4AF37]/12 hover:bg-[#D4AF37]/22 active:cursor-grabbing touch-none"
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        setLegacyDragElKey(elKey);
                        const cur = legacyGeom[elKey] || {};
                        legacyInteractRef.current = {
                          elKey,
                          mode: 'move',
                          startClientX: e.clientX,
                          startClientY: e.clientY,
                          orig: {
                            dx: cur.dx || 0,
                            dy: cur.dy || 0,
                            dw: cur.dw || 0,
                            dh: cur.dh || 0,
                          },
                          baseW: el.width,
                          baseH: el.height,
                        };
                        e.currentTarget.setPointerCapture(e.pointerId);
                      }}
                    />
                    <div
                      role="presentation"
                      className="sb-tactical-handle absolute bottom-0 right-0 z-[80] h-4 w-4 cursor-se-resize rounded-br-md border border-[#D4AF37]/45 bg-black/45 touch-none"
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        setLegacyDragElKey(elKey);
                        const cur = legacyGeom[elKey] || {};
                        legacyInteractRef.current = {
                          elKey,
                          mode: 'resize-se',
                          startClientX: e.clientX,
                          startClientY: e.clientY,
                          orig: {
                            dx: cur.dx || 0,
                            dy: cur.dy || 0,
                            dw: cur.dw || 0,
                            dh: cur.dh || 0,
                          },
                          baseW: el.width,
                          baseH: el.height,
                        };
                        e.currentTarget.setPointerCapture(e.pointerId);
                      }}
                    />
                  </>
                )}
                {renderElement(el, onSmartboardImageExpand)}
              </motion.div>
            );
          })}
        </motion.div>
      </AnimatePresence>
      {!legacyPresentationMode && !fullBleedDocumentOnly && legacyEls.length > 0 ? (
        <div className="relative z-[30] flex shrink-0 flex-col gap-0.5 border-t border-white/08 bg-black/40 px-2 py-1.5 backdrop-blur-sm">
          <p className="text-center text-[9px] leading-snug text-white/35">
            Mode tactique · Clic = focus · <span className="text-white/45">⌃</span>+molette = zoom ·{' '}
            <span className="text-white/45">⌃</span>+glisser = déplacer · <span className="text-white/45">⌃</span>+clic gauche = masquer ·{' '}
            <span className="text-white/45">⌃</span>+clic droit = afficher · barre / coin si focus ·{' '}
            <span className="text-white/45">Alt</span> mini · <span className="text-white/45">Shift</span> pousser ·{' '}
            <span className="text-white/45">⌃1–9</span> · <span className="text-white/45">Échap</span> / <span className="text-white/45">⌃0</span>
          </p>
          {legacyProgressive ? (
            <span className="text-center text-[10px] text-white/45 tabular-nums">
              Bloc {legacyRevealIdx + 1} / {legacyEls.length}
              <span className="text-white/25"> · fond = slide suivante</span>
            </span>
          ) : null}
        </div>
      ) : !legacyPresentationMode && legacyProgressive ? (
        <div className="relative z-10 flex shrink-0 items-center justify-center gap-2 border-t border-white/08 bg-black/30 px-3 py-2 backdrop-blur-sm">
          <span className="text-[10px] text-white/45 tabular-nums">
            Bloc {legacyRevealIdx + 1} / {legacyEls.length}
            <span className="text-white/25"> · clic sur la slide pour révéler le suivant</span>
          </span>
        </div>
      ) : null}
    </div>
  );
}
