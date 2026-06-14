import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, ChevronUp, Eye, Minimize2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { designerShellChipGhost } from '@/lib/liriDesignerShellClasses';
import {
  LIVE_DRAWER_BACKDROP_TRANSITION,
  LIVE_TAB_SPRING,
  liveDrawerAsideLeft,
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

/**
 * Hub LONGIA pendant le live hôte — vue Signaux (journal, mains levées, Mesh, Zone 3…).
 *
 * @param {boolean} [centralFocusMode=false] — Mode « écran central élargi » : barre et panneau flottants.
 * @param {import('react').ReactNode} [signalHubSlot] — Contenu embarqué (signaux temps réel).
 * @param {() => void} [onOpenLayoutPreview] — Ouvre le sous-panneau « Aperçu des vues » (mobile / projecteur).
 * @param {boolean} [layoutPreviewHubActive] — Surligne le bouton œil quand ce sous-panneau est ouvert.
 */
export default function LiveHostLongiaHubDrawer({
  open,
  onClose,
  centralFocusMode = false,
  signalHubSlot = null,
  onOpenLayoutPreview,
  layoutPreviewHubActive = false,
  /** Largeur du tiroir bureau (px). Peut augmenter quand un sous-panneau détaillé est ouvert (ex. Zone 3). */
  drawerWidthPx = 320,
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

  const signalsPanelDesktop = (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-transparent px-3 py-3 [scrollbar-width:thin]">
      {signalsBody}
    </div>
  );

  const signalsPanelFocus = (
    <div className="flex max-h-[min(70vh,520px)] min-h-[min(40vh,280px)] flex-col overflow-hidden px-2 py-2 [scrollbar-width:thin]">
      {signalsBody}
    </div>
  );

  /** Tiroir latéral classique — ancré à gauche. */
  if (!centralFocusMode) {
    return (
      <>
        {/* Voile visuel seulement : sans pointer-events, sinon il capte tous les clics
            au-dessus du plateau (bouton LONGIA, Mesh, etc.) qui sont en z-index plus bas. */}
        <div
          role="presentation"
          aria-hidden
          className="pointer-events-none fixed top-0 right-0 bottom-0 z-[85] bg-black/50 lg:bg-black/40"
          style={{ left: `min(100vw, ${drawerWidthPx}px)` }}
        />
        <motion.aside
          {...liveDrawerAsideLeft}
          className={cn(
            'live-studio-premium live-studio-pane-left fixed left-0 top-0 z-[90] flex h-[100dvh] shrink-0 flex-col text-white',
            'shadow-[16px_0_48px_rgba(0,0,0,.55)] ring-1 ring-inset ring-white/[0.02]',
          )}
          style={{
            width: `min(100vw, ${drawerWidthPx}px)`,
            maxWidth: `min(100vw, ${drawerWidthPx}px)`,
          }}
        >
          {/* En-tête aligné shell Studio Live Creator (live-studio-pane-head) */}
          <header className="live-studio-pane-head flex shrink-0 items-start justify-between gap-3 px-3 py-2.5">
            <div className="min-w-0 flex-1 space-y-0.5 pt-0.5">
              <p className="live-studio-pane-head-title">Signaux & salle</p>
              <h2
                className="truncate text-[13px] font-semibold leading-snug tracking-[0.04em] text-[#c4b5fd]"
                style={{ fontFamily: 'Georgia, "Times New Roman", ui-serif, serif' }}
              >
                LONGIA · HUB
              </h2>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              {typeof onOpenLayoutPreview === 'function' ? (
                <button
                  type="button"
                  onClick={onOpenLayoutPreview}
                  title="Aperçu des vues — mobile et projecteur"
                  aria-label="Aperçu des vues mobile et projecteur"
                  className={cn(
                    designerShellChipGhost,
                    'flex h-9 w-9 items-center justify-center rounded-xl border p-0 transition-colors',
                    layoutPreviewHubActive
                      ? 'border-violet-400/45 bg-violet-500/15 text-violet-100'
                      : 'border-white/12 text-white/70 hover:border-violet-400/35 hover:bg-violet-500/10 hover:text-violet-100',
                  )}
                >
                  <Eye className="h-4 w-4" strokeWidth={2} aria-hidden />
                </button>
              ) : null}
              <button
                type="button"
                onClick={onClose}
                className={cn(
                  designerShellChipGhost,
                  'shrink-0 rounded-xl border border-white/12 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-white/80 hover:border-white/18 hover:bg-white/[0.07] hover:text-white/95',
                )}
              >
                Fermer
              </button>
            </div>
          </header>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key="signals"
              role="region"
              aria-label="Signaux LONGIA"
              className="flex min-h-0 flex-1 flex-col overflow-hidden"
              initial={{ opacity: 0, y: 12, scaleY: 0.982 }}
              animate={{ opacity: 1, y: 0, scaleY: 1 }}
              exit={{ opacity: 0, y: -10, scaleY: 0.99 }}
              transition={LIVE_TAB_SPRING}
              style={{ transformOrigin: '50% 0%' }}
            >
              {signalsPanelDesktop}
            </motion.div>
          </AnimatePresence>
        </motion.aside>
      </>
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
            className="live-studio-premium flex max-w-[min(92vw,280px)] items-center gap-2 overflow-hidden rounded-full border border-[#2D3139] bg-[#12141a]/96 px-2.5 py-2 pr-3 text-white shadow-[0_12px_40px_rgba(0,0,0,0.55)] backdrop-blur-md"
            title="Déplier LONGIA — signaux et journal"
          >
            <div className="h-8 w-8 shrink-0 rounded-full bg-gradient-to-br from-amber-400/90 to-violet-700/80 ring-2 ring-white/10" />
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
        <div className="live-studio-premium premium-panel flex max-w-full flex-nowrap items-center gap-2 overflow-x-auto rounded-2xl border border-[#2D3139] bg-[#12141a]/98 px-3 py-2 text-white shadow-[0_12px_40px_rgba(0,0,0,0.5)] backdrop-blur-md [scrollbar-width:none]">
          <div className="flex shrink-0 items-center gap-2 border-r border-white/[0.08] pr-3">
            <div className="h-8 w-8 shrink-0 rounded-full bg-gradient-to-br from-amber-400/90 to-violet-700/80 ring-2 ring-white/10" />
            <span className="whitespace-nowrap text-[12px] font-semibold tracking-tight text-white/95">LONGIA</span>
          </div>

          {typeof onOpenLayoutPreview === 'function' ? (
            <button
              type="button"
              onClick={onOpenLayoutPreview}
              title="Aperçu des vues — mobile et projecteur"
              aria-label="Aperçu des vues mobile et projecteur"
              className={cn(
                'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border text-white/55 transition-colors',
                layoutPreviewHubActive
                  ? 'border-violet-400/45 bg-violet-500/15 text-violet-100'
                  : 'border-white/[0.08] bg-white/[0.04] hover:border-violet-400/30 hover:bg-violet-500/10 hover:text-violet-100',
              )}
            >
              <Eye className="h-4 w-4" strokeWidth={2} aria-hidden />
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
                className="fixed inset-0 z-[228] bg-black/35"
                onClick={() => setHubPanelOpen(false)}
              />
              <motion.div
                key="longia-focus-panel"
                {...liveDrawerFloatPanel}
                className="live-studio-premium premium-panel relative z-[229] flex max-h-[min(78vh,560px)] w-[min(280px,92vw)] max-w-full flex-col overflow-hidden rounded-2xl border border-[#2D3139] bg-[#12141a] shadow-[0_20px_64px_rgba(0,0,0,0.7)] ring-1 ring-inset ring-white/[0.03]"
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
