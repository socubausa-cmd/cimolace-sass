import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, ChevronUp, ExternalLink, Minimize2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  LIVE_DRAWER_BACKDROP_TRANSITION,
  LIVE_TAB_SPRING,
  liveDrawerFloatPanel,
} from '@/lib/liveDrawerMotion';

/** Dispatched par le raccourci sur l'écran SmartBoard pour rouvrir / déplier le hub. */
export const LIRI_LIVE_LONGIA_HUB_EXPAND_EVENT = 'liri-live-longia-hub-expand';

const placeholderRows = [
  { k: 'Mains levées', v: '0' },
  { k: 'Attente', v: '0' },
  { k: 'Journal', v: '0' },
  { k: 'Mesh', v: '0' },
];

const focusPlaceholderRows = [
  { k: 'Mains', v: '0' },
  { k: 'Attente', v: '0' },
  { k: 'Journal', v: '0' },
  { k: 'Mesh', v: '0' },
];

/** Couleurs chaudes du shell live (alignées --lh-*), pour ne plus injecter le bleu Studio. */
const HUB_PANEL_BG = 'var(--lh-panel-bg, rgba(48,48,46,.97))';
const HUB_BORDER = '1px solid rgba(245,244,238,.1)';
const HUB_ACCENT = 'var(--lh-accent, #d4a36a)';
const HUB_PILL_BG = 'var(--lh-page-bg, #262624)';
const HUB_SHADOW =
  '0 30px 80px rgba(0,0,0,.55), 0 0 0 1px rgba(0,0,0,.35), inset 0 1px 0 rgba(255,255,255,.07)';

/**
 * Hub LONGIA pendant le live hôte — vue Signaux (journal, mains levées, Mesh, Zone 3…).
 *
 * @param {boolean} [centralFocusMode=false] — Mode « écran central élargi » : barre et panneau flottants.
 * @param {import('react').ReactNode} [signalHubSlot] — Contenu embarqué (signaux temps réel).
 * @param {() => void} [onOpenLayoutPreview] — Ouvre la vue participant dans un nouvel onglet (aperçu).
 * @param {boolean} [layoutPreviewHubActive] — Surligne le bouton œil quand ce sous-panneau est ouvert.
 */
export default function LiveHostLongiaHubDrawer({
  open,
  onClose,
  centralFocusMode = false,
  signalHubSlot = null,
  onOpenLayoutPreview,
  layoutPreviewHubActive = false,
  /** Largeur de la fenêtre flottante (px). Peut augmenter quand un sous-panneau détaillé est ouvert (ex. Zone 3). */
  drawerWidthPx = 340,
}) {
  const [hubPanelOpen, setHubPanelOpen] = useState(true);
  /** En mode écran central : barre complète vs pastille compacte (reste visible). */
  const [hubBarCollapsed, setHubBarCollapsed] = useState(false);

  useEffect(() => {
    if (open && centralFocusMode) {
      setHubPanelOpen(true);
      setHubBarCollapsed(false);
    }
  }, [open, centralFocusMode]);

  useEffect(() => {
    if (!centralFocusMode) setHubBarCollapsed(false);
  }, [centralFocusMode]);

  useEffect(() => {
    if (!open || typeof window === 'undefined') return undefined;
    const onExpand = () => {
      setHubBarCollapsed(false);
      setHubPanelOpen(true);
    };
    window.addEventListener(LIRI_LIVE_LONGIA_HUB_EXPAND_EVENT, onExpand);
    return () => window.removeEventListener(LIRI_LIVE_LONGIA_HUB_EXPAND_EVENT, onExpand);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const signalsBody =
    signalHubSlot != null && signalHubSlot !== false ? (
      signalHubSlot
    ) : centralFocusMode ? (
      <div className="flex flex-col gap-1.5 px-1 py-1">
        {focusPlaceholderRows.map((row) => (
          <div key={row.k} className="rounded-md border border-white/[0.08] bg-white/[0.04] px-2 py-1.5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[8px] font-bold uppercase tracking-wider text-white/40">{row.k}</p>
              <p className="text-sm font-bold tabular-nums text-white/90">{row.v}</p>
            </div>
          </div>
        ))}
      </div>
    ) : (
      <div className="flex flex-col gap-1.5 px-1 py-2">
        {placeholderRows.map((row) => (
          <div key={row.k} className="rounded-md border border-white/[0.08] bg-white/[0.04] px-2 py-1.5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[8px] font-bold uppercase tracking-wider text-white/40">{row.k}</p>
              <p className="text-sm font-bold tabular-nums text-white/90">{row.v}</p>
            </div>
          </div>
        ))}
      </div>
    );

  const signalsPanelFocus = (
    <div className="flex max-h-[min(70vh,520px)] min-h-[min(40vh,280px)] flex-col overflow-hidden px-2 py-2 [scrollbar-width:thin]">
      {signalsBody}
    </div>
  );

  /**
   * Mode standard (desktop hôte) — FENÊTRE FLOTTANTE chaude par-dessus la scène.
   * Calée sur la scène via les vars partagées posées par le rail gauche
   * (--lh-stage-top-vw / --lh-stage-bottom-vw / --lh-rail-edge), avec repli sûr.
   * Plus de tiroir plein écran ni de réorganisation de la grille.
   */
  if (!centralFocusMode) {
    return (
      <motion.aside
        role="dialog"
        aria-label="Hub LONGIA — signaux et salle"
        initial={{ opacity: 0, x: -14, scale: 0.985 }}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        transition={LIVE_TAB_SPRING}
        className="fixed z-[70] flex flex-col overflow-hidden text-white"
        style={{
          left: 'var(--lh-rail-edge, 78px)',
          top: 'var(--lh-stage-top-vw, 150px)',
          bottom: 'var(--lh-stage-bottom-vw, 84px)',
          width: `min(92vw, ${Math.max(320, drawerWidthPx)}px)`,
          maxWidth: '92vw',
          borderRadius: 18,
          border: HUB_BORDER,
          background: HUB_PANEL_BG,
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          boxShadow: HUB_SHADOW,
        }}
      >
        <header
          className="flex shrink-0 items-start justify-between gap-3 px-3.5 py-3"
          style={{ borderBottom: '1px solid rgba(255,255,255,.07)' }}
        >
          <div className="min-w-0 flex-1 space-y-0.5 pt-0.5">
            <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-white/45">Signaux &amp; salle</p>
            <h2
              className="truncate text-[14px] font-semibold leading-snug tracking-[0.08em]"
              style={{ color: HUB_ACCENT, fontFamily: 'Georgia, "Times New Roman", ui-serif, serif' }}
            >
              LONGIA
            </h2>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {typeof onOpenLayoutPreview === 'function' ? (
              <button
                type="button"
                onClick={onOpenLayoutPreview}
                title="Aperçu — ouvrir la vue participant (nouvel onglet)"
                aria-label="Ouvrir la vue participant dans un nouvel onglet"
                className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-xl border p-0 transition-colors',
                  layoutPreviewHubActive
                    ? 'border-amber-400/45 bg-amber-500/15 text-amber-100'
                    : 'border-white/12 text-white/65 hover:border-amber-400/35 hover:bg-amber-500/10 hover:text-amber-100',
                )}
              >
                <ExternalLink className="h-4 w-4" strokeWidth={2} aria-hidden />
              </button>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              title="Fermer le hub LONGIA"
              aria-label="Fermer le hub LONGIA"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/12 text-white/55 transition-colors hover:border-red-500/30 hover:bg-red-950/30 hover:text-red-200"
            >
              <X className="h-4 w-4" strokeWidth={2} aria-hidden />
            </button>
          </div>
        </header>
        <div
          role="region"
          aria-label="Signaux LONGIA"
          className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 py-3 [scrollbar-width:thin]"
        >
          {signalsBody}
        </div>
      </motion.aside>
    );
  }

  if (hubBarCollapsed) {
    return (
      <div className="pointer-events-none fixed inset-0 z-[230]">
        <div className="pointer-events-auto absolute left-3 top-3 flex flex-col items-start gap-2">
          <button
            type="button"
            onClick={() => {
              setHubBarCollapsed(false);
              setHubPanelOpen(true);
            }}
            className="flex max-w-[min(92vw,280px)] items-center gap-2 overflow-hidden rounded-full px-2.5 py-2 pr-3 text-white backdrop-blur-md"
            style={{ background: HUB_PILL_BG, border: HUB_BORDER, boxShadow: HUB_SHADOW }}
            title="Déplier LONGIA — signaux et journal"
          >
            <div className="h-8 w-8 shrink-0 rounded-full bg-gradient-to-br from-amber-400/90 to-amber-700/80 ring-2 ring-white/10" />
            <span className="shrink-0 text-[11px] font-semibold tracking-tight text-white/95">LONGIA</span>
            <ChevronUp className="h-4 w-4 shrink-0 text-white/70" strokeWidth={2} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-[230]">
      <div className="pointer-events-auto absolute left-3 top-3 flex max-w-[min(96vw,300px)] flex-col items-start gap-2">
        <div
          className="flex max-w-full flex-nowrap items-center gap-2 overflow-x-auto rounded-2xl px-3 py-2 text-white backdrop-blur-md [scrollbar-width:none]"
          style={{ background: HUB_PILL_BG, border: HUB_BORDER, boxShadow: HUB_SHADOW }}
        >
          <div className="flex shrink-0 items-center gap-2 border-r border-white/[0.08] pr-3">
            <div className="h-8 w-8 shrink-0 rounded-full bg-gradient-to-br from-amber-400/90 to-amber-700/80 ring-2 ring-white/10" />
            <span className="whitespace-nowrap text-[12px] font-semibold tracking-tight text-white/95">LONGIA</span>
          </div>

          {typeof onOpenLayoutPreview === 'function' ? (
            <button
              type="button"
              onClick={onOpenLayoutPreview}
              title="Aperçu — ouvrir la vue participant (nouvel onglet)"
              aria-label="Ouvrir la vue participant dans un nouvel onglet"
              className={cn(
                'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border text-white/55 transition-colors',
                layoutPreviewHubActive
                  ? 'border-amber-400/45 bg-amber-500/15 text-amber-100'
                  : 'border-white/[0.08] bg-white/[0.04] hover:border-amber-400/30 hover:bg-amber-500/10 hover:text-amber-100',
              )}
            >
              <ExternalLink className="h-4 w-4" strokeWidth={2} aria-hidden />
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setHubPanelOpen((v) => !v)}
            title={hubPanelOpen ? 'Replier le panneau signaux' : 'Ouvrir le panneau signaux'}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.04] text-white/55 hover:bg-white/[0.08]"
          >
            {hubPanelOpen ? <ChevronUp className="h-4 w-4" strokeWidth={2} /> : <ChevronDown className="h-4 w-4" strokeWidth={2} />}
          </button>
          <button
            type="button"
            onClick={() => {
              setHubBarCollapsed(true);
              setHubPanelOpen(false);
            }}
            title="Réduire en pastille (reste accessible sur l'écran)"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.04] text-white/50 hover:bg-white/[0.08] hover:text-white/85"
          >
            <Minimize2 className="h-4 w-4" strokeWidth={2} />
          </button>
          <button
            type="button"
            onClick={onClose}
            title="Fermer"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] text-white/40 hover:border-red-500/30 hover:bg-red-950/40 hover:text-red-200"
          >
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>

        <AnimatePresence>
          {hubPanelOpen ? (
            <>
              <motion.div
                key="longia-focus-scrim"
                role="presentation"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={LIVE_DRAWER_BACKDROP_TRANSITION}
                className="fixed inset-0 z-[228] bg-black/30"
                onClick={() => setHubPanelOpen(false)}
              />
              <motion.div
                key="longia-focus-panel"
                {...liveDrawerFloatPanel}
                className="relative z-[229] flex max-h-[min(78vh,560px)] w-[min(300px,92vw)] max-w-full flex-col overflow-hidden rounded-2xl"
                style={{ background: HUB_PANEL_BG, border: HUB_BORDER, boxShadow: HUB_SHADOW }}
              >
                {signalsPanelFocus}
              </motion.div>
            </>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}
