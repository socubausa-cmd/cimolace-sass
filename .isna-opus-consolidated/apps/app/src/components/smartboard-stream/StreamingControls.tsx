import React from 'react';
import { Play, RefreshCcw, CheckCircle, Download, ChevronRight } from 'lucide-react';
import { useOrchestratorLiveStore } from '@/stores/orchestrator-live.store';

interface Props {
  onGenerate?: () => void;
  onRegenerate?: () => void;
  onValidate?: () => void;
  onNext?: () => void;
  onToggleAuto?: () => void;
  onExportJson?: () => void;
  autoMode?: boolean;
}

export function StreamingControls({
  onGenerate,
  onRegenerate,
  onValidate,
  onNext,
  onToggleAuto,
  onExportJson,
  autoMode,
}: Props) {
  const store = useOrchestratorLiveStore();
  const doGenerate = onGenerate || (() => void store.generateCurrentSlide());
  const doRegenerate = onRegenerate || (() => void store.regenerateCurrentSlide());
  const doValidate = onValidate || (() => void store.validateCurrentSlide());
  const doNext = onNext || (() => void store.nextStep());
  const doToggleAuto = onToggleAuto || (() => store.setStreaming(!store.isStreaming));
  const doExport = onExportJson || store.exportStreamJson;
  const resolvedAutoMode = Boolean(autoMode ?? store.isStreaming);

  const btn = 'rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-[11px] text-white/80 hover:bg-white/10';
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/65">Streaming Controls</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={doToggleAuto} className="rounded-lg bg-violet-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-violet-500">
          <Play className="mr-1 inline h-3.5 w-3.5" />
          {resolvedAutoMode ? 'Pause' : 'Auto'}
        </button>
        <button type="button" onClick={doRegenerate} className={btn}><RefreshCcw className="mr-1 inline h-3.5 w-3.5" />Regenerer</button>
        <button type="button" onClick={doValidate} className={btn}><CheckCircle className="mr-1 inline h-3.5 w-3.5" />Valider</button>
        <button type="button" onClick={doNext} className={btn}>Suivant<ChevronRight className="ml-1 inline h-3.5 w-3.5" /></button>
        <button type="button" onClick={doGenerate} className={btn}>Generer ce slide</button>
        <button type="button" onClick={doExport} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-emerald-500"><Download className="mr-1 inline h-3.5 w-3.5" />Export</button>
      </div>
    </div>
  );
}

export default StreamingControls;
