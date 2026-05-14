import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { SMARTBOARD_STEPS } from '@/lib/liri-smartboard/steps';
import StepRail from '@/components/smartboard-stream/StepRail';
import SmartBoardStreamStage from '@/components/smartboard-stream/SmartBoardStreamStage';
import SlideLiveInspector from '@/components/smartboard-stream/SlideLiveInspector';
import StreamingControls from '@/components/smartboard-stream/StreamingControls';
import { useOrchestratorLiveStore } from '@/stores/orchestrator-live.store';

export default function SmartboardStreamingPage() {
  const [autoMode, setAutoMode] = useState(false);
  const {
    chapters,
    slides,
    selectedChapterId,
    selectedStep,
    selectChapter,
    selectStep,
    pollStatus,
    projectId,
    generateCurrentSlide,
    regenerateCurrentSlide,
    validateCurrentSlide,
    nextStep,
    exportStreamJson,
  } = useOrchestratorLiveStore();

  const selectedChapter = chapters.find((c) => c.chapter_id === selectedChapterId) || chapters[0] || null;
  const selectedSlide = useMemo(
    () =>
      slides.find(
        (slide) =>
          slide.chapterId === (selectedChapter?.chapter_id || selectedChapterId) &&
          slide.step === selectedStep,
      ) || null,
    [slides, selectedChapter, selectedChapterId, selectedStep],
  );

  const stepStateResolver = (stepKey) => {
    const slide = slides.find((s) => s.chapterId === (selectedChapter?.chapter_id || selectedChapterId) && s.step === stepKey);
    return slide?.state || 'waiting';
  };

  return (
    <main className="min-h-[100dvh] bg-[radial-gradient(80%_60%_at_50%_0%,rgba(6,182,212,0.12),transparent_65%),#060a13] p-4 text-white">
      <motion.div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-0 opacity-50"
        animate={{ backgroundPosition: ['0% 0%', '100% 100%'] }}
        transition={{ duration: 26, repeat: Infinity, repeatType: 'reverse', ease: 'linear' }}
        style={{
          backgroundImage:
            'radial-gradient(38% 32% at 15% 12%, rgba(124,58,237,0.16), transparent 70%), radial-gradient(34% 25% at 84% 20%, rgba(34,211,238,0.14), transparent 72%), radial-gradient(32% 25% at 55% 88%, rgba(251,191,36,0.1), transparent 75%)',
          backgroundSize: '140% 140%',
        }}
      />
      <div className="mx-auto max-w-[1600px]">
        <div className="mb-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3">
          <p className="text-sm font-semibold">SmartBoard Streaming Temps Reel</p>
          <p className="text-xs text-white/60">Je vois le cours se construire en direct.</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[10px]">
              projectId: {projectId || '—'}
            </span>
            <button
              type="button"
              onClick={() => {
                if (projectId) void pollStatus(projectId);
              }}
              className="rounded-full border border-cyan-300/40 bg-cyan-500/20 px-3 py-1 text-[10px]"
            >
              Refresh live
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 xl:grid-cols-[270px_1fr_340px]">
          <div className="space-y-2">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-2">
              <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-white/65">Chapitres</p>
              <div className="space-y-1">
                {chapters.map((chapter) => (
                  <button
                    key={chapter.chapter_id}
                    type="button"
                    onClick={() => selectChapter(chapter.chapter_id)}
                    className={`w-full rounded-lg border px-2 py-1 text-left text-[10px] ${selectedChapter?.chapter_id === chapter.chapter_id ? 'border-violet-400/50 bg-violet-500/20' : 'border-white/10 bg-black/20'}`}
                  >
                    Ch {chapter.chapter_id} · {chapter.status}
                  </button>
                ))}
              </div>
            </div>
            <StepRail
              steps={SMARTBOARD_STEPS.map((step) => ({ key: step.key, label: step.label }))}
              selectedStep={selectedStep}
              onSelectStep={selectStep}
              getState={stepStateResolver}
            />
          </div>

          <SmartBoardStreamStage slide={selectedSlide} />

          <div className="space-y-2">
            <SlideLiveInspector
              slide={selectedSlide}
              chapterTitle={selectedChapter?.title || ''}
            />
            <StreamingControls
              onGenerate={generateCurrentSlide}
              onRegenerate={regenerateCurrentSlide}
              onValidate={validateCurrentSlide}
              onNext={nextStep}
              onToggleAuto={() => setAutoMode((v) => !v)}
              onExportJson={exportStreamJson}
              autoMode={autoMode}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
