/**
 * StudioBuilder — Moteur central de création
 * Gère : progression, étapes, navigation, transitions, preview
 * Utilisé par : LiveStudioBuilder, FormationStudioBuilder, etc.
 */
import React, { cloneElement, isValidElement, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronRight, ChevronLeft, ChevronDown, Save, Loader2, AlertCircle, Eye, EyeOff, CheckCircle2, ListOrdered } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StudioProgress } from './StudioProgress';
import { StudioSidebar } from './StudioSidebar';
import { LiveStudioProgress } from '@/components/liri/live-studio/LiveStudioProgress';
import { LiveStudioSidebar } from '@/components/liri/live-studio/LiveStudioSidebar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { studioCreatorShellBg, studioCreatorHeader } from './studioCreatorTheme';
import { LiriWordmark } from '@/components/brand/LiriWordmark';

export function StudioBuilder({
  steps,
  stepComponents,
  draft,
  updateDraft,
  lastSavedAt,
  onClose,
  onSubmit,
  creating,
  title,
  subtitle = 'Configuration étape par étape',
  previewComponent: PreviewComponent,
  extraStepProps = {},
  showPreview = true,
  validateStep,
  getStepCompletion,
  saveStatus = 'idle',
  saveError = null,
  /** Ex. live : { 6: 3, 7: 3 } — sous-écrans avant de changer d'étape principale (aligné sur LiveStudioWizard) */
  nestedSubStepCounts = null,
  /** Une fois au montage : ouvrir une étape / sous-écran (ex. LIRI Agent → étape 6 programme SmartBoard) */
  initialNavigation = null,
  /** Dernière étape : id DOM à faire défiler (ex. barre « Programmer / Lancer » du live) — remplace l'absence de « Suivant » */
  lastStepScrollToActionsId = null,
  /** Shell « Studio de création live » (fond de page #262624 de la charte, stepper or, colonnes live-studio-*) */
  liveCreationShell = false,
  /** Imbriqué dans la coque « LIRI Studio » (StudioDesignerLikeShell) : pas de
   *  plein écran `fixed inset-0`, header propre MASQUÉ (la coque fournit topbar +
   *  rail + footer). Le corps (sidebar étapes + contenu + preview) vit dedans. */
  embedInShell = false,
}) {
  const totalSteps = steps.length;
  const [currentStep, setCurrentStep] = useState(1);
  const [maxReachedStep, setMaxReachedStep] = useState(1);
  /** index du sous-écran par id d'étape (6, 7, …) */
  const [nestedByStep, setNestedByStep] = useState({});
  const appliedInitialNavRef = useRef(false);
  const [stepErrors, setStepErrors] = useState({});
  const [showMobilePreview, setShowMobilePreview] = useState(false);
  const [validationPulse, setValidationPulse] = useState(null);
  const [stepsMenuOpen, setStepsMenuOpen] = useState(false);
  const currentStepKey = steps.find((s) => s.id === currentStep)?.key || steps[0]?.key;
  const StepComponent = stepComponents[currentStepKey] || (() => null);
  const canGoNext = currentStep < totalSteps;
  const canGoPrev = currentStep > 1;

  const nestedCount = nestedSubStepCounts?.[currentStep] ?? 0;
  const nestedIdx = nestedByStep[currentStep] ?? 0;

  const scrollToLastStepActions = () => {
    if (!lastStepScrollToActionsId) return;
    document.getElementById(lastStepScrollToActionsId)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  const liveNextLabel = useMemo(() => {
    if (!nestedSubStepCounts) return null;
    if (currentStep === 6 && nestedCount >= 3) {
      if (nestedIdx === 0) return 'Suivant : Programme SmartBoard';
      if (nestedIdx === 1) return 'Suivant : Joker — scènes';
      if (nestedIdx === 2) return 'Suivant : Interactions & IA';
    }
    if (currentStep === 7 && nestedCount >= 3) {
      if (nestedIdx === 0) return 'Suivant : Ambiance sonore';
      if (nestedIdx === 1) return 'Suivant : Scènes LIRI';
      if (nestedIdx === 2) return 'Suivant : Validation';
    }
    return null;
  }, [nestedSubStepCounts, nestedCount, currentStep, nestedIdx]);

  useEffect(() => {
    if (!validationPulse) return undefined;
    const timer = setTimeout(() => setValidationPulse(null), 1500);
    return () => clearTimeout(timer);
  }, [validationPulse]);

  useEffect(() => {
    if (appliedInitialNavRef.current) return;
    const nav = initialNavigation;
    if (!nav || typeof nav.stepId !== 'number') return;
    const sid = nav.stepId;
    if (sid < 1 || sid > totalSteps) return;
    appliedInitialNavRef.current = true;
    setCurrentStep(sid);
    setMaxReachedStep((m) => Math.max(m, sid));
    const nest = nestedSubStepCounts?.[sid];
    if (nest && typeof nav.nestedIndex === 'number' && nav.nestedIndex >= 0 && nav.nestedIndex < nest) {
      setNestedByStep((prev) => ({ ...prev, [sid]: nav.nestedIndex }));
    }
  }, [initialNavigation, totalSteps, nestedSubStepCounts]);

  const triggerValidationPulse = (stepId) => {
    const step = steps.find((item) => item.id === stepId);
    if (!step) return;
    setValidationPulse({ stepId, label: step.label });
  };

  const runStepValidation = (stepId = currentStep) => {
    if (typeof validateStep !== 'function') return { valid: true };
    const stepKey = steps.find((step) => step.id === stepId)?.key;
    const result = validateStep({ stepId, stepKey, draft });
    const normalized = typeof result === 'boolean' ? { valid: result } : (result || { valid: true });

    if (!normalized.valid && stepKey) {
      setStepErrors((prev) => ({
        ...prev,
        [stepKey]: normalized.message || 'Étape incomplète',
      }));
    } else if (stepKey) {
      setStepErrors((prev) => {
        const next = { ...prev };
        delete next[stepKey];
        return next;
      });
    }
    return normalized;
  };

  const goNext = () => {
    if (nestedCount > 1 && nestedIdx < nestedCount - 1) {
      setNestedByStep((prev) => ({ ...prev, [currentStep]: nestedIdx + 1 }));
      return;
    }
    if (!canGoNext) return;
    const validation = runStepValidation(currentStep);
    if (!validation.valid) return;
    triggerValidationPulse(currentStep);
    const nextStep = Math.min(currentStep + 1, totalSteps);
    setCurrentStep(nextStep);
    if (nestedSubStepCounts?.[nextStep]) {
      setNestedByStep((prev) => ({ ...prev, [nextStep]: 0 }));
    }
    setMaxReachedStep((prev) => Math.max(prev, nextStep));
  };
  const goPrev = () => {
    if (nestedCount > 1 && nestedIdx > 0) {
      setNestedByStep((prev) => ({ ...prev, [currentStep]: nestedIdx - 1 }));
      return;
    }
    if (!canGoPrev) return;
    const prevStep = Math.max(currentStep - 1, 1);
    setCurrentStep(prevStep);
    if (nestedSubStepCounts?.[prevStep]) {
      const last = nestedSubStepCounts[prevStep] - 1;
      setNestedByStep((prev) => ({ ...prev, [prevStep]: last }));
    }
  };
  const goToStep = (stepId) => {
    if (stepId < 1 || stepId > totalSteps) return;
    if (stepId <= currentStep || stepId <= maxReachedStep) {
      setCurrentStep(stepId);
      return;
    }
    if (stepId === currentStep + 1) {
      const validation = runStepValidation(currentStep);
      if (!validation.valid) return;
      triggerValidationPulse(currentStep);
      setCurrentStep(stepId);
      setMaxReachedStep((prev) => Math.max(prev, stepId));
    }
  };

  const pickStepFromMenu = (stepId) => {
    goToStep(stepId);
    setStepsMenuOpen(false);
  };

  const stepStates = useMemo(() => {
    return steps.reduce((acc, step) => {
      const completionResult = typeof getStepCompletion === 'function'
        ? getStepCompletion({ stepId: step.id, stepKey: step.key, draft })
        : step.id < currentStep;

      acc[step.key] = {
        completed: Boolean(completionResult),
        locked: step.id > maxReachedStep + 1,
        error: Boolean(stepErrors[step.key]),
        errorMessage: stepErrors[step.key],
      };
      return acc;
    }, {});
  }, [steps, getStepCompletion, draft, currentStep, maxReachedStep, stepErrors]);

  const saveStateLabel = useMemo(() => {
    // Trois états, trois teintes CHAUDES distinctes (la différenciation passait
    // par bleu/vert/rouge — elle passe maintenant par ambre/olive/rouge chaud) :
    //   en cours = ambre #e0a458 · enregistré = olive #9cc48a · erreur = rouge chaud.
    if (saveStatus === 'saving') return { icon: Loader2, text: 'Sauvegarde...', className: 'text-[#e0a458]' };
    if (saveStatus === 'error') return { icon: AlertCircle, text: saveError || 'Erreur de sauvegarde', className: 'text-red-300' };
    if (lastSavedAt != null) {
      return {
        icon: liveCreationShell ? CheckCircle2 : Save,
        text: 'Brouillon enregistré',
        className: liveCreationShell ? 'text-[#9cc48a]' : 'text-[#9cc48a]/90',
      };
    }
    return null;
  }, [saveStatus, saveError, lastSavedAt, liveCreationShell]);

  const stepProps = useMemo(() => {
    const base = {
      draft,
      updateDraft,
      onSubmit,
      creating,
      ...extraStepProps,
    };
    if (currentStep === 6 && nestedSubStepCounts?.[6]) {
      base.salleSubStepIndex = nestedIdx;
    }
    if (currentStep === 7 && nestedSubStepCounts?.[7]) {
      base.interactionsSubStepIndex = nestedIdx;
    }
    return base;
  }, [
    draft,
    updateDraft,
    onSubmit,
    creating,
    extraStepProps,
    currentStep,
    nestedSubStepCounts,
    nestedIdx,
  ]);

  /** Builders pass soit une référence de composant, soit un élément (<Preview … />) — évite React #130. */
  const previewEl = useMemo(() => {
    if (!PreviewComponent) return null;
    const liveExtras = liveCreationShell
      ? { embedded: true, onGoToDateStep: () => goToStep(3) }
      : {};
    if (isValidElement(PreviewComponent)) {
      return cloneElement(PreviewComponent, { draft, ...liveExtras });
    }
    const Comp = PreviewComponent;
    return <Comp draft={draft} {...liveExtras} />;
  }, [PreviewComponent, draft, liveCreationShell, goToStep]);

  const progressPct = Math.max(0, Math.min(100, (currentStep / totalSteps) * 100));

  return (
    <div
      className={cn(
        'flex flex-col overflow-hidden text-white',
        embedInShell ? 'min-h-0 flex-1' : 'fixed inset-0 z-[2000]',
        liveCreationShell
          ? cn('live-studio-premium', !embedInShell && 'bg-[#262624]')
          : studioCreatorShellBg,
      )}
    >
      {!liveCreationShell && (
        <div className="pointer-events-none fixed inset-0 z-0">
          <div className="absolute -top-32 left-1/3 h-[min(420px,50vh)] w-[min(520px,120vw)] -translate-x-1/2 rounded-full bg-[color-mix(in_srgb,var(--school-accent)_10%,transparent)] blur-[100px]" />
          <div className="absolute bottom-0 right-0 h-72 w-72 rounded-full bg-amber-950/25 blur-[90px]" />
          {/* Halo décoratif : or de la charte #d99a4e (l'or froid #D4AF37 est banni). */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(217,154,78,0.07),transparent)]" />
        </div>
      )}
      {!embedInShell && (
      <header
        className={cn(
          'relative z-30 shrink-0',
          liveCreationShell
            ? 'premium-topbar border-b border-[rgba(245,244,238,0.09)] px-4 py-3 lg:px-6'
            : cn(
                'flex-shrink-0 shadow-[inset_0_1px_0_0_rgba(217,154,78,0.08)]',
                studioCreatorHeader,
              ),
        )}
        {...(liveCreationShell ? { 'aria-label': `${title} — ${subtitle}` } : {})}
      >
        {liveCreationShell ? (
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between lg:gap-6">
            <div className="flex min-w-0 items-start gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="h-9 w-9 shrink-0 rounded-lg border border-[rgba(245,244,238,0.09)] bg-[#30302e] text-gray-400 hover:border-white/15 hover:bg-white/5 hover:text-white"
                aria-label="Fermer"
              >
                <X className="h-4 w-4" />
              </Button>
              <div className="flex min-w-0 flex-1 gap-3">
                <div className="shrink-0 pt-0.5">
                  <LiriWordmark
                    size="compact"
                    letterClassName="text-white"
                    /* Halo du wordmark : corail #d97757 — c'était un bleu #5B8DEF. */
                    className="drop-shadow-[0_2px_12px_rgba(217,119,87,0.22)]"
                  />
                  <p className="mt-1 text-[8px] font-bold uppercase tracking-[0.35em] text-white/45">
                    LEARN • LIVE • GROW
                  </p>
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-gray-500">{subtitle}</p>
                  {saveStateLabel ? (
                    <span
                      className={cn(
                        'mt-2 inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium leading-none',
                        saveStatus === 'error'
                          ? 'border-red-400/25 bg-red-500/[0.08]'
                          : saveStatus === 'saving'
                            ? 'border-[#d4924a]/25 bg-[#d4924a]/[0.10]'
                            : 'border-white/[0.18] bg-transparent text-[#9cc48a]',
                      )}
                    >
                      <saveStateLabel.icon
                        className={cn(
                          'h-3.5 w-3.5 shrink-0',
                          saveStateLabel.className,
                          saveStatus === 'saving' && 'animate-spin',
                        )}
                      />
                      <span className={cn('truncate', saveStateLabel.className)}>{saveStateLabel.text}</span>
                    </span>
                  ) : null}
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => setStepsMenuOpen(true)}
                /* Compteur d'étapes : corail = les actions (c'était le violet #7B61FF). */
                className="ml-auto shrink-0 rounded-lg border-[#d97757]/35 bg-[#d97757]/10 text-[11px] font-semibold text-[#e8a97f] hover:bg-[#d97757]/20 lg:hidden"
              >
                <ListOrdered className="mr-1 h-3.5 w-3.5" />
                {currentStep}/{totalSteps}
              </Button>
            </div>
            <div className="live-studio-stepper-track min-w-0 flex-1 p-2 lg:max-w-[60%] xl:max-w-[64%]">
              <LiveStudioProgress
                steps={steps}
                currentStep={currentStep}
                onStepClick={goToStep}
                stepStates={stepStates}
              />
            </div>
          </div>
        ) : (
          <div
            className={cn(
              'flex min-h-[4.5rem] items-center gap-2 px-5 pt-[max(0.5rem,env(safe-area-inset-top))] pb-3 sm:px-6 sm:pb-3.5',
              'md:grid md:min-h-[5.25rem] md:grid-cols-[minmax(0,20rem)_1fr_minmax(0,17.5rem)] md:items-center md:gap-4 md:px-8 md:py-4 lg:grid-cols-[minmax(0,22rem)_1fr_minmax(0,17.5rem)]',
            )}
          >
            <div className="flex min-w-0 items-center gap-3 md:gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="h-9 w-9 shrink-0 text-white/45 hover:bg-white/[0.06] hover:text-white"
                aria-label="Fermer"
              >
                <X className="h-5 w-5" />
              </Button>
              <div className="min-w-0 flex-1 border-l border-[color-mix(in_srgb,var(--school-accent)_15%,transparent)] pl-3 md:pl-4">
                <h1 className="font-display truncate text-[1.0625rem] font-semibold leading-tight tracking-tight text-white sm:text-lg md:text-[1.125rem] md:leading-snug">
                  {title}
                </h1>
                <p className="mt-1 text-[11px] leading-relaxed text-white/40 md:text-xs md:text-[0.8125rem]">{subtitle}</p>
                {saveStateLabel ? (
                  <div className="mt-2 md:mt-2.5">
                    <span
                      className={cn(
                        'inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium leading-none shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]',
                        saveStatus === 'error'
                          ? 'border-red-400/25 bg-red-500/[0.08]'
                          : saveStatus === 'saving'
                            ? 'border-[#d4924a]/25 bg-[#d4924a]/[0.10]'
                            : 'border-[#5a8f52]/30 bg-[#5a8f52]/[0.10]',
                      )}
                    >
                      <saveStateLabel.icon
                        className={cn('h-3 w-3 shrink-0', saveStateLabel.className, saveStatus === 'saving' && 'animate-spin')}
                      />
                      <span className={cn('truncate', saveStateLabel.className)}>{saveStateLabel.text}</span>
                    </span>
                  </div>
                ) : null}
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => setStepsMenuOpen(true)}
                className="hidden shrink-0 border-[color-mix(in_srgb,var(--school-accent)_30%,transparent)] bg-[color-mix(in_srgb,var(--school-accent)_10%,transparent)] font-display text-xs font-semibold text-[#f5e6c8] hover:bg-[color-mix(in_srgb,var(--school-accent)_18%,transparent)] lg:hidden"
              >
                <ListOrdered className="mr-1.5 h-4 w-4" />
                {currentStep}/{totalSteps}
              </Button>
            </div>
            <div className="hidden min-w-0 justify-center justify-self-center overflow-x-auto md:flex">
              <StudioProgress
                steps={steps}
                currentStep={currentStep}
                onStepClick={goToStep}
                stepStates={stepStates}
              />
            </div>
            <div className="hidden md:block" aria-hidden />
            <div className="ml-auto flex shrink-0 items-center gap-2 md:hidden">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setStepsMenuOpen(true)}
                className="border-[color-mix(in_srgb,var(--school-accent)_30%,transparent)] bg-[color-mix(in_srgb,var(--school-accent)_10%,transparent)] font-display text-[11px] font-semibold text-[#f5e6c8] hover:bg-[color-mix(in_srgb,var(--school-accent)_18%,transparent)]"
              >
                <ListOrdered className="mr-1 h-3.5 w-3.5" />
                {currentStep}/{totalSteps}
              </Button>
              <StudioProgress
                steps={[steps[currentStep - 1]]}
                currentStep={currentStep}
                onStepClick={goToStep}
                compact
                stepStates={stepStates}
              />
            </div>
          </div>
        )}
      </header>
      )}

      {liveCreationShell && (
        <div className="live-studio-global-progress" role="presentation" aria-hidden>
          <div className="live-studio-global-progress-fill" style={{ width: `${progressPct}%` }} />
        </div>
      )}

      <Dialog open={stepsMenuOpen} onOpenChange={setStepsMenuOpen}>
        <DialogContent
          className={cn(
            'max-h-[88dvh] max-w-md overflow-hidden text-white sm:rounded-2xl',
            liveCreationShell ? 'border-[rgba(245,244,238,0.09)] bg-[#1f1e1c]' : 'border-[color-mix(in_srgb,var(--school-accent)_25%,transparent)] bg-[#0a0908]',
          )}
        >
          <DialogHeader>
            <DialogTitle className={cn('text-left text-lg text-white', !liveCreationShell && 'font-display')}>
              Choisir une étape
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[min(520px,62dvh)] overflow-y-auto pr-1">
            {liveCreationShell ? (
              <LiveStudioSidebar
                steps={steps}
                currentStep={currentStep}
                onStepClick={pickStepFromMenu}
                stepStates={stepStates}
              />
            ) : (
              <StudioSidebar
                steps={steps}
                currentStep={currentStep}
                onStepClick={pickStepFromMenu}
                stepStates={stepStates}
                compact
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {liveCreationShell ? (
        <div className="live-studio-frame relative z-10 flex min-h-0 flex-1">
          <main className="flex min-h-0 min-w-0 flex-1">
            <aside className="live-studio-pane-left hidden w-[210px] shrink-0 flex-col lg:flex">
              <div className="min-h-0 flex-1 overflow-y-auto px-2 py-4">
                <LiveStudioSidebar
                  steps={steps}
                  currentStep={currentStep}
                  onStepClick={goToStep}
                  stepStates={stepStates}
                />
              </div>
            </aside>
            <div className="live-studio-pane-center flex min-h-0 min-w-0 flex-1 flex-col">
              <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-3 sm:p-4 lg:p-5">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentStepKey}
                    initial={{ opacity: 0, x: 16 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -16 }}
                    transition={{ duration: 0.22, ease: 'easeOut' }}
                    className="mx-auto w-full max-w-[700px] rounded-xl border border-[rgba(245,244,238,0.09)] bg-[#1f1e1c]/95 p-6 shadow-[0_24px_50px_-32px_rgba(0,0,0,0.75)] backdrop-blur-md sm:p-7"
                  >
                    <StepComponent {...stepProps} />
                  </motion.div>
                </AnimatePresence>

                {showPreview && previewEl && (
                  <div className="mt-8 border-t border-[rgba(245,244,238,0.09)] pt-6 lg:hidden">
                    <Button
                      variant="outline"
                      onClick={() => setShowMobilePreview((prev) => !prev)}
                      className="rounded-lg border-[rgba(245,244,238,0.16)] text-gray-300 hover:bg-white/[0.04]"
                    >
                      {showMobilePreview ? <EyeOff className="mr-2 h-4 w-4" /> : <Eye className="mr-2 h-4 w-4" />}
                      {showMobilePreview ? 'Masquer aperçu' : 'Voir aperçu'}
                    </Button>
                    <AnimatePresence>
                      {showMobilePreview && (
                        <motion.div
                          key={currentStepKey}
                          initial={{ opacity: 0, y: 12, scale: 0.98 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -10, scale: 0.98 }}
                          transition={{ duration: 0.24 }}
                          className="mt-4 rounded-xl border border-[rgba(245,244,238,0.09)] bg-[#262624]/95 p-4 backdrop-blur-sm"
                        >
                          {previewEl}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}

                <div className="mx-auto mt-4 flex w-full max-w-[700px] items-center justify-between rounded-xl border border-[rgba(245,244,238,0.09)] bg-[#262624]/90 px-4 py-3 sm:px-5">
                  <Button
                    variant="outline"
                    onClick={goPrev}
                    disabled={!canGoPrev}
                    className="rounded-lg border-[rgba(245,244,238,0.16)] bg-transparent text-xs font-semibold uppercase tracking-wide text-gray-300 hover:bg-white/[0.04] disabled:opacity-40"
                  >
                    <ChevronLeft className="mr-2 h-4 w-4" /> Précédent
                  </Button>
                  <div className="flex min-w-0 flex-shrink-0 flex-wrap items-center justify-end gap-2">
                    {currentStep < totalSteps ? (
                      <Button
                        variant="accent"
                        onClick={goNext}
                        className="max-w-[min(100%,24rem)] px-5 text-xs font-semibold uppercase tracking-wide"
                      >
                        <span className="truncate">{liveNextLabel || 'Suivant'}</span>
                        <ChevronRight className="ml-2 h-4 w-4 shrink-0" />
                      </Button>
                    ) : lastStepScrollToActionsId ? (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={scrollToLastStepActions}
                        /* « Programmer ou lancer » = une ACTION → corail (c'était le violet #7B61FF). */
                        className="rounded-lg border-[#d97757]/40 text-[#e8a97f] hover:bg-[#d97757]/10"
                      >
                        <span className="hidden text-xs font-semibold uppercase tracking-wide sm:inline">
                          Programmer ou lancer
                        </span>
                        <span className="text-xs font-semibold uppercase tracking-wide sm:hidden">Actions finales</span>
                        <ChevronDown className="ml-2 h-4 w-4 shrink-0" />
                      </Button>
                    ) : null}
                  </div>
                </div>
                <AnimatePresence>
                  {validationPulse && (
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      className="mx-auto mt-2 inline-flex max-w-[700px] items-center gap-1.5 text-xs text-[#9cc48a]"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Étape validée: {validationPulse.label}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {showPreview && previewEl && (
              <aside className="live-studio-pane-right hidden w-[min(100%,320px)] shrink-0 flex-col lg:flex">
                <div className="live-studio-pane-head">
                  <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-white">
                    {/* Pastille « aperçu » : corail de la charte (c'était le violet #7B61FF). */}
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-[#d97757]/15 text-[#e08a5f]">
                      <Eye className="h-4 w-4" strokeWidth={2.25} />
                    </span>
                    APERÇU VISUEL
                  </p>
                  <p className="mt-2 text-xs leading-relaxed text-gray-500">
                    C&apos;est ainsi que les participants verront votre live.
                  </p>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto p-3">
                  <motion.div
                    key={currentStepKey}
                    initial={{ opacity: 0, x: 12, scale: 0.99 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    transition={{ duration: 0.28, ease: 'easeOut' }}
                    className="w-full"
                  >
                    {previewEl}
                  </motion.div>
                </div>
              </aside>
            )}
          </main>
        </div>
      ) : (
        <div className="relative z-10 flex min-h-0 flex-1">
          <main className="flex min-w-0 flex-1">
            <aside className="hidden min-h-0 w-64 flex-shrink-0 overflow-y-auto border-r border-[color-mix(in_srgb,var(--school-accent)_12%,transparent)] bg-[#080706]/80 backdrop-blur-md lg:block">
              <StudioSidebar
                steps={steps}
                currentStep={currentStep}
                onStepClick={goToStep}
                stepStates={stepStates}
              />
            </aside>
            <div className="flex min-h-0 min-w-0 flex-1 flex-col">
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-4 pb-6 sm:p-5 lg:p-8">
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={currentStepKey}
                      initial={{ opacity: 0, x: 20, scale: 0.99 }}
                      animate={{ opacity: 1, x: 0, scale: 1 }}
                      exit={{ opacity: 0, x: -20, scale: 0.99 }}
                      transition={{ duration: 0.28, ease: 'easeOut' }}
                      className="mx-auto w-full max-w-2xl xl:max-w-3xl"
                    >
                      <StepComponent {...stepProps} />
                    </motion.div>
                  </AnimatePresence>

                  {showPreview && previewEl && (
                    <div className="mt-8 border-t border-white/10 pt-6 xl:hidden">
                      <Button
                        variant="outline"
                        onClick={() => setShowMobilePreview((prev) => !prev)}
                        className="border-white/10 text-gray-300 hover:bg-white/5"
                      >
                        {showMobilePreview ? <EyeOff className="mr-2 h-4 w-4" /> : <Eye className="mr-2 h-4 w-4" />}
                        {showMobilePreview ? 'Masquer aperçu' : 'Voir aperçu'}
                      </Button>
                      <AnimatePresence>
                        {showMobilePreview && (
                          <motion.div
                            key={currentStepKey}
                            initial={{ opacity: 0, y: 12, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -10, scale: 0.98 }}
                            transition={{ duration: 0.24 }}
                            className="mt-4 rounded-2xl border border-[color-mix(in_srgb,var(--school-accent)_15%,transparent)] bg-[#0f0d0b]/80 p-4 backdrop-blur-sm"
                          >
                            {previewEl}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex-shrink-0 border-t border-[color-mix(in_srgb,var(--school-accent)_12%,transparent)] bg-[#0a0908]/90 px-4 py-3 backdrop-blur-xl md:px-6">
                <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
                  <Button
                    variant="outline"
                    onClick={goPrev}
                    disabled={!canGoPrev}
                    className="font-display border-white/[0.12] text-white/80 hover:bg-white/5"
                  >
                    <ChevronLeft className="mr-2 h-4 w-4" /> Précédent
                  </Button>
                  <div className="flex min-w-0 flex-shrink-0 flex-wrap items-center justify-end gap-2">
                    {currentStep < totalSteps ? (
                      <Button
                        onClick={goNext}
                        className="font-display max-w-[min(100%,24rem)] bg-gradient-to-r from-[var(--school-accent)] to-amber-500 font-semibold text-black shadow-[0_8px_32px_rgba(217,154,78,0.25)] hover:from-amber-400 hover:to-[var(--school-accent)]"
                      >
                        <span className="truncate">{liveNextLabel || 'Suivant'}</span>
                        <ChevronRight className="ml-2 h-4 w-4 shrink-0" />
                      </Button>
                    ) : lastStepScrollToActionsId ? (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={scrollToLastStepActions}
                        className="font-display border-[color-mix(in_srgb,var(--school-accent)_35%,transparent)] text-[#f5dd8a] hover:bg-[color-mix(in_srgb,var(--school-accent)_10%,transparent)]"
                      >
                        <span className="hidden sm:inline">Programmer ou lancer</span>
                        <span className="sm:hidden">Actions finales</span>
                        <ChevronDown className="ml-2 h-4 w-4 shrink-0" />
                      </Button>
                    ) : null}
                  </div>
                </div>
                <AnimatePresence>
                  {validationPulse && (
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      className="mt-2 inline-flex items-center gap-1.5 text-xs text-[#9cc48a]"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Étape validée: {validationPulse.label}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {showPreview && previewEl && (
              <aside className="hidden w-[400px] flex-shrink-0 border-l border-[color-mix(in_srgb,var(--school-accent)_12%,transparent)] bg-[#080706]/90 p-6 backdrop-blur-md xl:flex xl:min-h-0 xl:overflow-hidden">
                <div className="h-full min-h-0 w-full overflow-y-auto overscroll-contain">
                  <motion.div
                    key={currentStepKey}
                    initial={{ opacity: 0, x: 12, scale: 0.99 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    transition={{ duration: 0.28, ease: 'easeOut' }}
                    className="w-full"
                  >
                    {previewEl}
                  </motion.div>
                </div>
              </aside>
            )}
          </main>
        </div>
      )}
    </div>
  );
}
