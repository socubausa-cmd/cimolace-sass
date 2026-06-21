import React, { useCallback, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { HelpCircle, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  designerShellBackdrop,
  designerShellBtnGold,
  designerShellCloseBtn,
  designerShellComposer,
  designerShellDrawerClass,
  designerShellHeader,
  designerShellIconBadge,
  designerShellInput,
  designerShellMainScroll,
} from '@/lib/liriDesignerShellClasses';
import { LIVE_DRAWER_BACKDROP_TRANSITION, liveDrawerAsideRight } from '@/lib/liveDrawerMotion';

/**
 * Invité — NeuronQ en tiroir droit (même coque que la messagerie).
 * Plusieurs « volets » : Ctrl+Entrée ou ⌘+Entrée ajoute un volet (question à plusieurs parties).
 */
export default function LiveGuestNeuronqPanel({
  open,
  onClose,
  volets,
  onVoletsChange,
  guestNeuronqReformulated,
  onReformulatedChange,
  neuronqReformulating,
  onReformulate,
  onSubmit,
  neuronqGuestSubmitting,
  combinedRawTrimmed,
}) {
  const endTextareaRef = useRef(null);
  const prevLen = useRef(volets.length);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (volets.length > prevLen.current && endTextareaRef.current) {
      endTextareaRef.current.focus();
    }
    prevLen.current = volets.length;
  }, [volets.length]);

  const setVolet = useCallback(
    (index, text) => {
      onVoletsChange((prev) => {
        const next = [...prev];
        next[index] = text;
        return next;
      });
    },
    [onVoletsChange],
  );

  const addVolet = useCallback(() => {
    onVoletsChange((prev) => [...prev, '']);
  }, [onVoletsChange]);

  const removeVolet = useCallback(
    (index) => {
      if (volets.length <= 1) return;
      onVoletsChange((prev) => prev.filter((_, i) => i !== index));
    },
    [onVoletsChange, volets.length],
  );

  const onKeyDownVolet = useCallback(
    (e) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        addVolet();
      }
    },
    [addVolet],
  );

  const canAct = Boolean(combinedRawTrimmed);
  const sendDisabled = !canAct || neuronqGuestSubmitting;

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="nq-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={LIVE_DRAWER_BACKDROP_TRANSITION}
            className={cn(designerShellBackdrop, '!z-[210]')}
            onClick={onClose}
          />
          <motion.aside
            key="nq-panel"
            {...liveDrawerAsideRight}
            className={cn(designerShellDrawerClass('w-[min(100vw,520px)]'), '!z-[211]')}
          >
            <div className={designerShellHeader}>
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <div className={designerShellIconBadge}>
                  <HelpCircle className="h-5 w-5 text-amber-200/95" strokeWidth={2} />
                </div>
                <div className="min-w-0">
                  <p className="text-[12px] font-semibold tracking-wide text-white/95">NeuronQ — question au formateur</p>
                  <p className="mt-1 max-w-[360px] text-[10px] leading-relaxed text-white/38">
                    Chaque bloc est un « volet » de votre question.{' '}
                    <span className="text-amber-200/80">Ctrl+Entrée</span> (ou <span className="text-amber-200/80">⌘+Entrée</span>) ajoute un
                    volet suivant. Envoyez quand tout est prêt.
                  </p>
                </div>
              </div>
              <button type="button" onClick={onClose} className={designerShellCloseBtn} aria-label="Fermer">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <div className={designerShellMainScroll}>
                <div className="space-y-3">
                  {volets.map((text, index) => (
                    <div
                      key={index}
                      className="rounded-xl border border-white/[0.08] bg-[#14131c]/90 p-3 ring-1 ring-inset ring-white/[0.02]"
                    >
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-amber-200/75">
                          Volet {index + 1}
                          {volets.length > 1 ? ` / ${volets.length}` : ''}
                        </span>
                        {volets.length > 1 ? (
                          <button
                            type="button"
                            onClick={() => removeVolet(index)}
                            className="rounded-lg border border-white/10 px-2 py-0.5 text-[9px] text-white/45 transition-colors hover:border-amber-500/35 hover:bg-amber-500/10 hover:text-amber-200"
                          >
                            Retirer
                          </button>
                        ) : null}
                      </div>
                      <textarea
                        ref={index === volets.length - 1 ? endTextareaRef : undefined}
                        value={text}
                        onChange={(e) => setVolet(index, e.target.value)}
                        onKeyDown={onKeyDownVolet}
                        placeholder={index === 0 ? 'Première partie de votre question…' : `Volet ${index + 1}…`}
                        rows={4}
                        className={cn(
                          designerShellInput,
                          'min-h-[88px] w-full resize-y font-[system-ui] leading-relaxed',
                        )}
                      />
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={addVolet}
                  className="mt-3 w-full rounded-xl border border-dashed border-amber-500/25 bg-amber-500/[0.04] py-2.5 text-[11px] font-semibold text-amber-200/80 transition-colors hover:border-amber-400/40 hover:bg-amber-500/[0.08]"
                >
                  + Ajouter un volet (ou Ctrl+Entrée dans un champ)
                </button>

                {guestNeuronqReformulated ? (
                  <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-3">
                    <span className="text-[9px] font-semibold uppercase tracking-wide text-white/45">Version reformulée (modifiable)</span>
                    <textarea
                      value={guestNeuronqReformulated}
                      onChange={(e) => onReformulatedChange(e.target.value)}
                      rows={4}
                      className={cn(designerShellInput, 'mt-2 min-h-[100px] w-full resize-y')}
                    />
                  </div>
                ) : null}
              </div>

              <div className={designerShellComposer}>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={!canAct || neuronqReformulating}
                    onClick={() => onReformulate()}
                    className="rounded-xl border border-amber-500/35 bg-amber-500/10 px-4 py-2.5 text-[12px] font-semibold text-amber-100/95 transition-colors hover:bg-amber-500/16 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {neuronqReformulating ? '…' : 'Reformuler (IA)'}
                  </button>
                  <button type="button" disabled={sendDisabled} onClick={() => onSubmit()} className={designerShellBtnGold}>
                    {neuronqGuestSubmitting ? '…' : 'Envoyer au formateur'}
                  </button>
                </div>
              </div>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
