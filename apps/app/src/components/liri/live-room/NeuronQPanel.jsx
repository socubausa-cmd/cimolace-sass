/**
 * NEURON-Q — Interface de questions pendant le live
 *
 * Deux modes :
 * 1. Bouton flottant "Poser une question" pour les participants (non-hôte)
 *    → Modal : saisie → reformulation IA → confirmation → envoi
 *
 * 2. Panneau hôte (rendu dans Zone3Panel onglet Questions)
 *    → Liste des questions reçues avec statuts + actions
 *    → Bouton "Mode Q&A" pour projeter les questions sur le SmartBoard
 */
import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { HelpCircle, Sparkles, Send, X, Check, SkipForward, Play, Pause } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  designerShellBackdrop,
  designerShellBtnGold,
  designerShellCardInset,
  designerShellCloseBtn,
  designerShellEmbedPanel,
  designerShellHeader,
  designerShellInput,
  designerShellMainScroll,
  designerShellMicroLabel,
  designerShellChipEmerald,
  designerShellChipGhost,
} from '@/lib/liriDesignerShellClasses';
import {
  LIVE_DRAWER_BACKDROP_TRANSITION,
  liveDrawerFloatCardBottomCenter,
  liveDrawerSheetBottom,
} from '@/lib/liveDrawerMotion';

const neuronQShellFloatingCard =
  'flex max-h-[min(70vh,520px)] w-[min(92vw,440px)] flex-col overflow-hidden rounded-2xl border border-white/[0.09] bg-[#14131c]/95 shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_32px_80px_-16px_rgba(0,0,0,0.85)] ring-1 ring-inset ring-white/[0.02]';

const neuronQShellSheetShell =
  'rounded-t-[26px] border border-white/[0.09] bg-[var(--lh-page-bg)] shadow-[0_-28px_80px_-12px_rgba(0,0,0,0.72)] ring-1 ring-inset ring-white/[0.03] overflow-hidden';

const neuronQIconWrap =
  'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-amber-500/25 bg-amber-500/[0.1] text-amber-200 shadow-[0_0_20px_-8px_rgba(245,158,11,0.35)]';

const neuronQPrimaryBtn =
  'flex min-h-11 items-center justify-center gap-2 rounded-xl border border-amber-500/35 bg-amber-500/10 px-4 py-2.5 text-[12px] font-semibold text-amber-100/95 transition-colors hover:bg-amber-500/16 disabled:cursor-not-allowed disabled:opacity-40 sm:min-h-8';

const neuronQSecondaryBtn =
  'flex min-h-11 flex-1 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[12px] text-white/55 transition-colors hover:border-white/14 hover:bg-white/[0.07] hover:text-white/88 sm:min-h-8 sm:text-xs';

// ── Modal question élève ───────────────────────────────────────────────────────
export function NeuronQStudentModal({
  open,
  onClose,
  onSubmit,          // (rawText, reformulatedText) => Promise<bool>
  onReformulate,     // (rawText) => Promise<string>
  reformulating = false,
  submitting = false,
  /** `sheet` = plein écran bas (LIRI mobile) ; `floating` = carte au-dessus du dock */
  variant = 'floating',
}) {
  const [step, setStep] = useState('write'); // 'write' | 'confirm'
  const [rawText, setRawText] = useState('');
  const [reformulated, setReformulated] = useState('');

  const handleReformulate = async () => {
    if (!rawText.trim()) return;
    const result = await onReformulate(rawText);
    setReformulated(result || rawText);
    setStep('confirm');
  };

  const handleConfirm = async () => {
    const ok = await onSubmit(rawText, reformulated);
    if (ok) {
      setRawText('');
      setReformulated('');
      setStep('write');
      onClose();
    }
  };

  const handleClose = () => {
    setRawText('');
    setReformulated('');
    setStep('write');
    onClose();
  };

  const isSheet = variant === 'sheet';

  const header = (
    <div
      className={cn(
        designerShellHeader,
        'pt-[max(0.75rem,env(safe-area-inset-top))] pb-3',
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className={neuronQIconWrap}>
          <HelpCircle className="h-4 w-4" strokeWidth={1.75} aria-hidden />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold tracking-wide text-white/92">NeuronQ</p>
          <p className={cn(designerShellMicroLabel, 'mt-0.5 normal-case tracking-normal text-white/45')}>
            Poser une question au formateur
          </p>
        </div>
      </div>
      <button type="button" onClick={handleClose} className={designerShellCloseBtn} aria-label="Fermer">
        <X className="h-4 w-4" />
      </button>
    </div>
  );

  const formBody = (
    <div
      className={cn(
        'space-y-3 px-5 py-4',
        isSheet &&
          cn(
            designerShellMainScroll,
            'flex-1 min-h-0 overscroll-contain px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]',
          ),
        !isSheet && 'bg-[#1f1e1c]/40',
      )}
    >
      {step === 'write' ? (
        <>
          <p className="text-[11px] leading-relaxed text-white/48">
            Posez votre question simplement — l&apos;IA la reformule pour le formateur.
          </p>
          <textarea
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            placeholder="Ex. : Comment les banques ont été créées ?"
            maxLength={600}
            rows={isSheet ? 5 : 3}
            className={cn(
              designerShellInput,
              'min-h-0 w-full resize-none text-base sm:text-[13px]',
            )}
          />
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-[9px] tabular-nums text-white/35">{rawText.length}/600</span>
            <button
              type="button"
              disabled={!rawText.trim() || reformulating}
              onClick={handleReformulate}
              className={cn(
                neuronQPrimaryBtn,
                'w-full sm:w-auto',
                (!rawText.trim() || reformulating) && 'pointer-events-none opacity-40',
              )}
            >
              {reformulating ? (
                <>
                  <motion.span
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  >
                    <Sparkles className="w-3 h-3" />
                  </motion.span>
                  Reformulation IA…
                </>
              ) : (
                <>
                  <Sparkles className="w-3 h-3" />
                  Reformuler avec l'IA
                </>
              )}
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="text-[11px] leading-relaxed text-white/48">
            Voici comment votre question sera transmise au formateur :
          </p>
          <div className={cn(designerShellCardInset, 'border-amber-500/18 bg-amber-500/[0.06]')}>
            <div className="flex items-start gap-2.5">
              <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-300/90" />
              <p className="text-[13px] leading-relaxed text-white/92">{reformulated}</p>
            </div>
          </div>
          <p className="text-[9px] text-white/38">
            Question originale :{' '}
            <span className="text-white/55 italic">&ldquo;{rawText}&rdquo;</span>
          </p>
          <div className="flex flex-col gap-2 pt-1 sm:flex-row">
            <button type="button" onClick={() => setStep('write')} className={neuronQSecondaryBtn}>
              Modifier
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={handleConfirm}
              className={cn(
                designerShellBtnGold,
                'flex min-h-11 flex-1 items-center justify-center gap-1.5 sm:min-h-8',
                submitting && 'pointer-events-none opacity-40',
              )}
            >
              <Send className="h-3 w-3" />
              {submitting ? 'Envoi…' : 'Envoyer'}
            </button>
          </div>
        </>
      )}
    </div>
  );

  if (isSheet) {
    return (
      <AnimatePresence>
        {open && (
          <>
            <motion.button
              type="button"
              aria-label="Fermer"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={LIVE_DRAWER_BACKDROP_TRANSITION}
              className={cn(designerShellBackdrop, 'z-[55] cursor-default border-0 p-0')}
              onClick={handleClose}
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="neuronq-sheet-title"
              {...liveDrawerSheetBottom}
              onClick={(e) => e.stopPropagation()}
              className={cn(
                'fixed inset-x-0 bottom-0 top-[8vh] z-[56] flex flex-col backdrop-blur-md',
                neuronQShellSheetShell,
              )}
            >
              <div className="flex flex-shrink-0 justify-center pb-1 pt-2" aria-hidden>
                <div className="h-1 w-10 rounded-full bg-white/14" />
              </div>
              <span id="neuronq-sheet-title" className="sr-only">
                NeuronQ — poser une question
              </span>
              {header}
              {formBody}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    );
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          {...liveDrawerFloatCardBottomCenter}
          className={cn(
            'absolute bottom-[112px] left-1/2 z-50 -translate-x-1/2 backdrop-blur-md',
            neuronQShellFloatingCard,
          )}
        >
          {header}
          {formBody}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── Bouton flottant pour l'élève ───────────────────────────────────────────────
export function NeuronQButton({ onClick, pendingOwnCount = 0, className }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'relative flex min-h-11 items-center justify-center gap-2 rounded-full border border-amber-500/35 bg-[#14131c]/90 px-5 text-[11px] font-semibold text-amber-100/95 shadow-[0_4px_24px_-8px_rgba(245,158,11,0.35)] backdrop-blur-md transition-all hover:border-amber-500/45 hover:bg-amber-500/12 sm:min-h-9 sm:px-4',
        className,
      )}
    >
      <HelpCircle className="h-3.5 w-3.5" strokeWidth={1.75} />
      Poser une question
      {pendingOwnCount > 0 && (
        <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-amber-400 px-0.5 text-[8px] font-bold text-[#1f1e1c]">
          {pendingOwnCount}
        </span>
      )}
    </button>
  );
}

// ── Onglet Questions dans Zone3Panel (côté hôte) ──────────────────────────────
export function NeuronQHostTab({ questions, onMarkAnswered, onMarkSkipped, qaMode, onToggleQaMode }) {
  const pending  = questions.filter((q) => q.status === 'pending');
  const answered = questions.filter((q) => q.status === 'answered');

  return (
    <div className="space-y-2.5">
      <button
        type="button"
        onClick={onToggleQaMode}
        className={cn(
          'flex min-h-11 w-full items-center gap-2 rounded-xl border px-3 text-[11px] font-semibold transition-all sm:min-h-9',
          qaMode
            ? 'border-amber-500/35 bg-amber-500/12 text-amber-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]'
            : 'border-white/[0.08] bg-[#1f1e1c]/80 text-white/60 hover:border-white/14 hover:bg-white/[0.04] hover:text-white/88',
        )}
      >
        {qaMode ? <Pause className="h-3.5 w-3.5 shrink-0" /> : <Play className="h-3.5 w-3.5 shrink-0" />}
        {qaMode ? 'Mode Q&R actif — arrêter' : 'Activer le mode Q&R'}
      </button>

      {pending.length === 0 ? (
        <div
          className={cn(
            designerShellEmbedPanel,
            'flex h-28 flex-col items-center justify-center gap-2 border-dashed border-white/[0.06] bg-[#1f1e1c]/50',
          )}
        >
          <HelpCircle className="h-6 w-6 text-white/22" strokeWidth={1.25} />
          <p className="text-[11px] text-white/40">Aucune question en attente</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          <p className={designerShellMicroLabel}>
            {pending.length} question{pending.length > 1 ? 's' : ''} en attente
          </p>
          {pending.map((q) => (
            <div
              key={q.id}
              className={cn(designerShellCardInset, 'space-y-1.5 border-amber-500/15 bg-[#1f1e1c]/90')}
            >
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-amber-500/25 bg-amber-500/10 text-[9px] font-bold text-amber-200">
                  {(q.user_name || 'É').charAt(0).toUpperCase()}
                </div>
                <p className="truncate text-[10px] text-white/45">{q.user_name}</p>
              </div>
              <p className="text-[11px] leading-relaxed text-white/88">
                {q.reformulated_text || q.raw_text}
              </p>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => onMarkAnswered(q.id)}
                  className={cn(
                    designerShellChipEmerald,
                    'flex min-h-9 flex-1 cursor-pointer items-center justify-center gap-1 text-[10px] font-semibold sm:min-h-7 sm:text-[9px]',
                  )}
                >
                  <Check className="h-3 w-3 sm:h-2.5 sm:w-2.5" /> Répondu
                </button>
                <button
                  type="button"
                  onClick={() => onMarkSkipped(q.id)}
                  className={cn(
                    designerShellChipGhost,
                    'flex min-h-9 flex-1 cursor-pointer items-center justify-center gap-1 text-[10px] font-semibold text-white/55 sm:min-h-7 sm:text-[9px]',
                  )}
                >
                  <SkipForward className="h-3 w-3 sm:h-2.5 sm:w-2.5" /> Passer
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {answered.length > 0 && (
        <div className="space-y-1">
          <p className={cn(designerShellMicroLabel, 'text-white/32')}>
            {answered.length} répondu{answered.length > 1 ? 's' : ''}
          </p>
          {answered.map((q) => (
            <div
              key={q.id}
              className={cn(
                designerShellCardInset,
                'flex items-start gap-2 border-white/[0.06] bg-[#1f1e1c]/60 py-2',
              )}
            >
              <Check className="mt-0.5 h-3 w-3 shrink-0 text-emerald-400/90" />
              <p className="line-clamp-2 text-[10px] leading-relaxed text-white/48">
                {q.reformulated_text || q.raw_text}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Mode Q&A plein écran (SmartBoard overlay) ─────────────────────────────────
export function QAModeOverlay({ questions, onMarkAnswered, onMarkSkipped, onClose }) {
  const pending = questions.filter((q) => q.status === 'pending');
  const [idx, setIdx] = useState(0);
  const current = pending[idx] || null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[58] flex flex-col items-center justify-center bg-[#080910]/78 px-3 pt-[max(3rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] backdrop-blur-[10px] sm:absolute"
    >
      <div
        className={cn(
          designerShellEmbedPanel,
          'absolute left-1/2 top-[max(1rem,env(safe-area-inset-top))] flex max-w-[95vw] -translate-x-1/2 flex-wrap items-center justify-center gap-2 rounded-full px-3 py-2 sm:px-4',
        )}
      >
        <div className={cn(neuronQIconWrap, 'h-8 w-8')}>
          <HelpCircle className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
        </div>
        <span className="text-[11px] font-semibold text-amber-100/95">Mode Q&amp;R</span>
        <span className="tabular-nums text-[10px] text-amber-200/55">
          {pending.length} question{pending.length > 1 ? 's' : ''}
        </span>
      </div>

      <button
        type="button"
        onClick={onClose}
        className={cn(
          designerShellCloseBtn,
          'absolute right-[max(0.75rem,env(safe-area-inset-right))] top-[max(0.75rem,env(safe-area-inset-top))]',
        )}
        aria-label="Fermer le mode Q&amp;R"
      >
        <X className="h-4 w-4" />
      </button>

      {/* Navigation */}
      {pending.length > 1 && (
        <div className="absolute top-14 flex items-center gap-2">
          {pending.map((q, i) => (
            <button
              key={q.id}
              type="button"
              onClick={() => setIdx(i)}
              className={cn(
                'h-2 w-2 rounded-full transition-all',
                i === idx ? 'scale-125 bg-amber-400' : 'bg-white/18 hover:bg-white/35',
              )}
            />
          ))}
        </div>
      )}

      {/* Question courante */}
      {current ? (
        <div className="w-full max-w-2xl space-y-5 px-4 text-center sm:space-y-6 sm:px-8">
          <div className="space-y-1 sm:space-y-2">
            <p className={cn(designerShellMicroLabel, 'text-amber-200/45')}>Question de</p>
            <p className="text-sm font-semibold text-white/82">{current.user_name}</p>
          </div>
          <motion.p
            key={current.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="px-1 text-lg font-semibold leading-snug text-white/95 sm:text-2xl sm:leading-relaxed"
          >
            {current.reformulated_text || current.raw_text}
          </motion.p>
          <div className="mx-auto flex w-full max-w-md flex-col items-stretch justify-center gap-2 sm:flex-row sm:items-center sm:gap-3">
            <button
              type="button"
              onClick={() => {
                onMarkAnswered(current.id);
                if (idx >= pending.length - 1) setIdx(Math.max(0, idx - 1));
              }}
              className={cn(
                designerShellChipEmerald,
                'flex min-h-12 cursor-pointer items-center justify-center gap-2 px-5 py-3 text-sm font-semibold sm:min-h-9 sm:py-2',
              )}
            >
              <Check className="h-4 w-4" /> Répondu
            </button>
            <button
              type="button"
              onClick={() => {
                onMarkSkipped(current.id);
                setIdx(Math.min(idx + 1, pending.length - 1));
              }}
              className={cn(
                designerShellChipGhost,
                'flex min-h-12 cursor-pointer items-center justify-center gap-2 border-white/[0.1] px-5 py-3 text-sm text-white/60 sm:min-h-9 sm:py-2 hover:text-white/88',
              )}
            >
              <SkipForward className="h-4 w-4" /> Passer
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2 text-center">
          <Check className="mx-auto h-10 w-10 text-emerald-400/90" />
          <p className="text-lg font-semibold text-white/82">Toutes les questions ont été traitées</p>
          <button
            type="button"
            onClick={onClose}
            className={cn(designerShellBtnGold, 'mt-4 inline-flex h-9 items-center px-6')}
          >
            Fermer le mode Q&amp;R
          </button>
        </div>
      )}

      {pending.length > 0 && (
        <p className="absolute bottom-6 text-[10px] tabular-nums text-white/35">
          {idx + 1} / {pending.length}
        </p>
      )}
    </motion.div>
  );
}
