import React, { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Network, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PRODUCT_NAMES } from '@/lib/liriControlMesh';

/**
 * Feuille basse type « social » pour Control Mesh (invité mobile) : demandes contrôle / JoyKit.
 * S'ouvre depuis la coque Liri mobile (icône Mesh sur le bord droit).
 */
export default function LiriMobileMeshControlShell({
  open,
  onOpenChange,
  onRequestControl,
  onRequestJoykit,
  canUseJoyKit = true,
  /** Grant actif côté invité (signal) — ex. { level, expires_at? } */
  joyKitGrant = null,
  /** Ligne de statut (permissions fusionnées, etc.) */
  statusLine = '',
}) {
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onOpenChange(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onOpenChange]);

  const grantLabel =
    joyKitGrant && typeof joyKitGrant === 'object' && joyKitGrant.level
      ? String(joyKitGrant.level).toUpperCase()
      : null;

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.button
            type="button"
            aria-label="Fermer le panneau Control Mesh"
            className="fixed inset-0 z-[140] bg-black/55 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => onOpenChange(false)}
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal
            aria-labelledby="liri-mesh-mobile-title"
            className="fixed inset-x-0 bottom-0 z-[150] flex max-h-[min(72vh,560px)] flex-col rounded-t-[1.35rem] border border-white/12 bg-[#07080c] shadow-[0_-20px_60px_rgba(0,0,0,.65)]"
            style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 0px))' }}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
          >
            <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-white/18" aria-hidden />
            <div className="flex items-start justify-between gap-2 border-b border-white/[0.07] px-4 pb-3 pt-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-200">
                  <Network className="h-4 w-4" strokeWidth={2.2} aria-hidden />
                </span>
                <div className="min-w-0">
                  <h2
                    id="liri-mesh-mobile-title"
                    className="text-[15px] font-bold tracking-tight text-white/95"
                  >
                    {PRODUCT_NAMES.controlMesh}
                  </h2>
                  <p className="text-[10px] leading-snug text-white/40">
                    Passation SmartBoard & JoyKit — le formateur valide.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/55 transition hover:border-white/18 hover:text-white/85"
                aria-label="Fermer"
              >
                <X className="h-4 w-4" strokeWidth={2} />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
              {grantLabel ? (
                <div
                  className="mb-3 rounded-xl border border-amber-500/25 bg-amber-500/8 px-3 py-2.5 text-center"
                  data-testid="liri-mesh-grant-active"
                >
                  <p className="text-[10px] font-bold uppercase tracking-wider text-amber-300/95">
                    Accès actif — {grantLabel}
                  </p>
                  {(joyKitGrant?.expiresAt != null || joyKitGrant?.expires_at != null) && (
                    <p className="mt-0.5 text-[9px] text-white/45">
                      Fin prévue côté hôte (sync).
                    </p>
                  )}
                </div>
              ) : null}

              {statusLine ? (
                <p className="mb-3 text-center text-[9px] leading-relaxed text-white/38">{statusLine}</p>
              ) : null}

              <div className="flex flex-col gap-2.5">
                <button
                  type="button"
                  disabled={!canUseJoyKit}
                  onClick={() => {
                    if (!canUseJoyKit) return;
                    void onRequestControl?.();
                    onOpenChange(false);
                  }}
                  className={cn(
                    'flex w-full items-center justify-center gap-2 rounded-2xl border px-4 py-3.5 text-[13px] font-bold transition',
                    canUseJoyKit
                      ? 'border-amber-500/40 bg-amber-500/12 text-amber-100 active:scale-[0.99] hover:bg-amber-500/18'
                      : 'cursor-not-allowed border-white/6 bg-white/[0.02] text-white/25',
                  )}
                >
                  Demander le contrôle
                </button>
                <button
                  type="button"
                  disabled={!canUseJoyKit}
                  onClick={() => {
                    if (!canUseJoyKit) return;
                    void onRequestJoykit?.();
                    onOpenChange(false);
                  }}
                  className={cn(
                    'flex w-full items-center justify-center gap-2 rounded-2xl border px-4 py-3.5 text-[13px] font-bold transition',
                    canUseJoyKit
                      ? 'border-amber-500/40 bg-amber-500/12 text-amber-100 active:scale-[0.99] hover:bg-amber-500/18'
                      : 'cursor-not-allowed border-white/6 bg-white/[0.02] text-white/25',
                  )}
                >
                  Demander JoyKit
                </button>
              </div>
              <p className="mt-3 text-center text-[8px] leading-relaxed text-white/32">
                Les demandes sont visibles côté formateur. Sans accord JoyKit, le Mesh peut être refusé.
              </p>
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );
}
