/**
 * Studio de création live — Wizard premium étape par étape
 */
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronRight, ChevronLeft, CheckCircle2, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LiveStudioProgress } from './LiveStudioProgress';
import { LiveStudioSidebar } from './LiveStudioSidebar';
import { LiveStudioPreview } from './LiveStudioPreview';
import { Step1Informations } from './steps/Step1Informations';
import { Step2Couverture } from './steps/Step2Couverture';
import { Step3DateHoraire } from './steps/Step3DateHoraire';
import { Step4Securite } from './steps/Step4Securite';
import { Step5Inviter } from './steps/Step5Inviter';
import { Step6SalleVirtuelle } from './steps/Step6SalleVirtuelle';
import { Step7Interactions } from './steps/Step7Interactions';
import { Step8Validation } from './steps/Step8Validation';
import { LIVE_STUDIO_STEPS as STEPS } from './liveStudioSteps';
import { LiriWordmark } from '@/components/brand/LiriWordmark';

const STEP_COMPONENTS = {
  informations: Step1Informations,
  couverture: Step2Couverture,
  date: Step3DateHoraire,
  securite: Step4Securite,
  inviter: Step5Inviter,
  salle: Step6SalleVirtuelle,
  interactions: Step7Interactions,
  validation: Step8Validation,
};

/** Salle virtuelle (étape 6) : 3 sous-écrans successifs avant l'étape 7 */
const STEP6_SUB_STEPS = 3;
/** Interactions & IA (étape 7) : 3 sous-écrans avant l'étape 8 (validation) */
const STEP7_SUB_STEPS = 3;

export function LiveStudioWizard({ draft, updateDraft, lastSavedAt, onClose, onSubmit, creating, isStaff, teachers, selectedTeacherId, onTeacherChange, user }) {
  const [currentStep, setCurrentStep] = useState(1);
  /** 0 = Salle & interaction, 1 = Programme SmartBoard, 2 = Joker (switch de scènes) */
  const [step6SubIndex, setStep6SubIndex] = useState(0);
  /** 0 = IA & outils, 1 = Ambiance, 2 = Scènes LIRI */
  const [step7SubIndex, setStep7SubIndex] = useState(0);
  const currentStepKey = STEPS.find((s) => s.id === currentStep)?.key || 'informations';
  const StepComponent = STEP_COMPONENTS[currentStepKey];
  const canGoNext = currentStep < 8;
  const canGoPrev = currentStep > 1;

  const goNext = () => {
    if (currentStep === 6) {
      if (step6SubIndex < STEP6_SUB_STEPS - 1) {
        setStep6SubIndex((i) => i + 1);
        return;
      }
      setStep7SubIndex(0);
      setCurrentStep(7);
      return;
    }
    if (currentStep === 7) {
      if (step7SubIndex < STEP7_SUB_STEPS - 1) {
        setStep7SubIndex((i) => i + 1);
        return;
      }
      setCurrentStep(8);
      return;
    }
    if (!canGoNext) return;
    const next = Math.min(currentStep + 1, 8);
    if (currentStep === 5 && next === 6) setStep6SubIndex(0);
    setCurrentStep(next);
  };

  const goPrev = () => {
    if (currentStep === 6 && step6SubIndex > 0) {
      setStep6SubIndex((i) => i - 1);
      return;
    }
    if (currentStep === 7 && step7SubIndex > 0) {
      setStep7SubIndex((i) => i - 1);
      return;
    }
    if (!canGoPrev) return;
    const prev = Math.max(currentStep - 1, 1);
    if (currentStep === 7 && prev === 6) setStep6SubIndex(STEP6_SUB_STEPS - 1);
    if (currentStep === 8 && prev === 7) setStep7SubIndex(STEP7_SUB_STEPS - 1);
    setCurrentStep(prev);
  };

  const goToStep = (stepId) => {
    if (stepId >= 1 && stepId <= 8) {
      // Ne pas réinitialiser les sous-étapes 6 / 7 : un clic dans la barre de progression
      // ramène au dernier sous-écran visité. Le flux « Suivant » remet à 0 quand il faut
      // (ex. 5→6, fin de l'étape 6→7).
      setCurrentStep(stepId);
    }
  };

  const nextButtonLabel = (() => {
    if (currentStep === 6 && step6SubIndex === 0) return 'Suivant : Programme SmartBoard';
    if (currentStep === 6 && step6SubIndex === 1) return 'Suivant : Joker — scènes';
    if (currentStep === 6 && step6SubIndex === 2) return 'Suivant : Interactions & IA';
    if (currentStep === 7 && step7SubIndex === 0) return 'Suivant : Ambiance sonore';
    if (currentStep === 7 && step7SubIndex === 1) return 'Suivant : Scènes LIRI';
    if (currentStep === 7 && step7SubIndex === 2) return 'Suivant : Validation';
    return 'Suivant';
  })();

  const progressPct = Math.max(0, Math.min(100, (currentStep / STEPS.length) * 100));

  return (
    <div className="live-studio-premium fixed inset-0 z-[2000] flex flex-col overflow-hidden bg-[#0a0c10] text-white">
      <header
        className="premium-topbar shrink-0 border-b border-[#2D3139] px-4 py-3 lg:px-6"
        aria-label="Live Studio Créateur — Configuration étape par étape"
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between lg:gap-6">
          <div className="flex min-w-0 items-start gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-9 w-9 shrink-0 rounded-lg border border-[#2D3139] bg-[#181B22] text-gray-400 hover:border-white/15 hover:bg-white/5 hover:text-white"
              aria-label="Fermer"
            >
              <X className="h-4 w-4" />
            </Button>
            <div className="flex min-w-0 flex-1 gap-3">
              <div className="shrink-0 pt-0.5">
                <LiriWordmark
                  size="compact"
                  letterClassName="text-white"
                  className="drop-shadow-[0_2px_12px_rgba(91,141,239,0.2)]"
                />
                <p className="mt-1 text-[8px] font-bold uppercase tracking-[0.35em] text-white/45">
                  LEARN • LIVE • GROW
                </p>
              </div>
              <div className="min-w-0">
                <p className="text-xs text-gray-500">Configuration étape par étape</p>
                {lastSavedAt != null && (
                  <span className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-white/18 bg-transparent px-2.5 py-1 text-[11px] font-medium text-emerald-400">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" strokeWidth={2.25} />
                    Brouillon enregistré
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="live-studio-stepper-track min-w-0 flex-1 p-2 lg:max-w-[60%] xl:max-w-[64%]">
            <LiveStudioProgress steps={STEPS} currentStep={currentStep} onStepClick={goToStep} />
          </div>
        </div>
      </header>

      {/* Progression globale 1→8 (lisible d'un coup d'œil) */}
      <div className="live-studio-global-progress" role="presentation" aria-hidden>
        <div className="live-studio-global-progress-fill" style={{ width: `${progressPct}%` }} />
      </div>

      <div className="live-studio-frame flex min-h-0 flex-1">
        {/* Volet gauche — navigation verticale */}
        <aside className="live-studio-pane-left hidden w-[210px] shrink-0 flex-col lg:flex">
          <div className="min-h-0 flex-1 overflow-y-auto px-2 py-4">
            <LiveStudioSidebar steps={STEPS} currentStep={currentStep} onStepClick={goToStep} />
          </div>
        </aside>

        {/* Volet centre — formulaire */}
        <main className="live-studio-pane-center">
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-3 sm:p-4 lg:p-5">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStepKey}
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={{ duration: 0.22, ease: 'easeOut' }}
                className="mx-auto w-full max-w-[700px] rounded-xl border border-[#2D3139] bg-[#12141a]/95 p-6 shadow-[0_24px_50px_-32px_rgba(0,0,0,0.75)] backdrop-blur-md sm:p-7"
              >
                <StepComponent
                  draft={draft}
                  updateDraft={updateDraft}
                  isStaff={isStaff}
                  teachers={teachers}
                  selectedTeacherId={selectedTeacherId}
                  onTeacherChange={onTeacherChange}
                  user={user}
                  onSubmit={onSubmit}
                  creating={creating}
                  {...(currentStep === 6 ? { salleSubStepIndex: step6SubIndex } : {})}
                  {...(currentStep === 7 ? { interactionsSubStepIndex: step7SubIndex } : {})}
                />
              </motion.div>
            </AnimatePresence>

            <div className="mx-auto mt-4 flex w-full max-w-[700px] items-center justify-between rounded-2xl border border-[#2D3139] bg-[#14161c]/90 px-4 py-3 sm:px-5">
              <Button
                variant="outline"
                onClick={goPrev}
                disabled={!canGoPrev}
                className="rounded-lg border-[#3D424C] bg-transparent text-xs font-semibold uppercase tracking-wide text-gray-300 hover:bg-white/[0.04] disabled:opacity-40"
              >
                <ChevronLeft className="mr-2 h-4 w-4" /> Précédent
              </Button>
              {currentStep < 8 && (
                <Button
                  variant="accent"
                  onClick={goNext}
                  className="max-w-[min(100%,24rem)] px-5 font-semibold uppercase tracking-wide"
                >
                  <span className="truncate">{nextButtonLabel}</span>
                  <ChevronRight className="ml-2 h-4 w-4 shrink-0" />
                </Button>
              )}
            </div>
          </div>
        </main>

        {/* Volet droit — aperçu participant */}
        <aside className="live-studio-pane-right hidden w-[min(100%,320px)] shrink-0 flex-col lg:flex">
          <div className="live-studio-pane-head">
            <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-white">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-[#d97757]/12 text-[#d97757]">
                <Eye className="h-4 w-4" strokeWidth={2.25} />
              </span>
              APERÇU VISUEL
            </p>
            <p className="mt-2 text-xs leading-relaxed text-gray-500">
              C&apos;est ainsi que les participants verront votre live.
            </p>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            <LiveStudioPreview
              draft={draft}
              embedded
              onGoToDateStep={() => goToStep(3)}
            />
          </div>
        </aside>
      </div>
    </div>
  );
}
