import React from 'react';
import { motion } from 'framer-motion';
import { useOrchestratorLiveStore } from '@/stores/orchestrator-live.store';

interface StepItem {
  key: string;
  label: string;
}

interface Props {
  steps: StepItem[];
  selectedStep: string;
  onSelectStep: (step: string) => void;
  getState: (step: string) => string;
}

function StepRailImpl({ steps, selectedStep, onSelectStep, getState }: Props) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/65">19 Steps</p>
      <div className="max-h-[68vh] space-y-1 overflow-y-auto pr-1">
        {steps.map((step, idx) => {
          const state = getState(step.key);
          return (
            <motion.button
              key={step.key}
              type="button"
              onClick={() => onSelectStep(step.key)}
              initial={{ opacity: 0.75, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18, delay: idx * 0.01 }}
              className={`w-full rounded-lg border px-2 py-1.5 text-left ${selectedStep === step.key ? 'border-violet-400/60 bg-violet-500/15' : 'border-white/10 bg-black/20'}`}
            >
              <p className="text-[10px] text-white/80">{idx + 1}. {step.label}</p>
              <p className={`text-[10px] ${state === 'generating' ? 'text-violet-200 animate-pulse' : 'text-cyan-200/70'}`}>{state}</p>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

export function StepRail(props?: Partial<Props>) {
  const store = useOrchestratorLiveStore();
  const defaultSteps = [
    'titre_chapitre',
    'objectif_competence_connaissance',
    'mise_en_situation',
    'tension_pedagogique',
    'experience_pensee',
    'revelation',
    'lecon_simple',
    'lecon_developpee',
    'analogies',
    'exemples',
    'reformulation',
    'atelier_application',
    'erreurs_attendues',
    'correction_pedagogique',
    'dictee_je_retiens',
    'test_comprehension',
    'cas_reel',
    'lien_avec_autres_concepts',
    'transition',
  ].map((key) => ({ key, label: key.replaceAll('_', ' ') }));

  const steps = props?.steps || defaultSteps;
  const selectedStep = props?.selectedStep || store.selectedStep;
  const onSelectStep = props?.onSelectStep || store.selectStep;
  const getState =
    props?.getState ||
    ((step: string) => {
      const slide = store.slides.find((s) => s.chapterId === store.selectedChapterId && s.step === step);
      return String(slide?.status || slide?.state || 'waiting');
    });

  return <StepRailImpl steps={steps} selectedStep={selectedStep} onSelectStep={onSelectStep} getState={getState} />;
}

export default StepRail;
