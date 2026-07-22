import React from 'react';
import { Bell, Gauge, Grid2x2, PanelLeftClose, Sparkles } from 'lucide-react';
import { SlideLiveInspector } from '@/components/liri/smartboard-stream/SlideLiveInspector';
import { SmartBoardStreamStage } from '@/components/liri/smartboard-stream/SmartBoardStreamStage';
import { StepRail } from '@/components/liri/smartboard-stream/StepRail';
import { StreamingControls } from '@/components/liri/smartboard-stream/StreamingControls';
import { useOrchestratorLiveStore } from '@/stores/orchestrator-live.store';

export default function SmartBoardStreamPage() {
  const { slides, selectedChapterId, selectedStep, chapters } = useOrchestratorLiveStore();
  const currentSlide = slides.find((s) => s.chapterId === selectedChapterId && s.step === selectedStep) || null;
  const currentChapter = chapters.find((c) => c.chapter_id === selectedChapterId);
  const chapterSlides = slides.filter((s) => s.chapterId === selectedChapterId);
  const doneSlides = chapterSlides.filter((s) => String(s.status || s.state) === 'validated').length;
  const totalSlides = chapterSlides.length || 19;
  const progressPct = Math.round((doneSlides / Math.max(totalSlides, 1)) * 100);

  return (
    <main className="min-h-screen bg-[#040812] text-white">
      <div className="min-h-screen bg-[radial-gradient(50%_40%_at_50%_0%,rgba(217, 119, 87,0.22),transparent_70%),radial-gradient(35%_35%_at_85%_80%,rgba(6,182,212,0.14),transparent_70%),linear-gradient(180deg,#060d1d,#050914)] p-3">
        <div className="min-h-[calc(100vh-24px)] overflow-hidden rounded-[22px] border border-white/10 bg-[#050914]/55 p-4 shadow-[0_28px_80px_-42px_rgba(0,0,0,0.95)]">
        <header className="mb-3 flex items-center justify-between rounded-[18px] border border-white/10 bg-[#050b18]/85 px-4 py-3 backdrop-blur-xl">
          <div>
            <div className="flex items-center gap-3">
              <Sparkles className="text-[#d97757]" size={24} />
              <h1 className="text-[30px] font-black leading-none tracking-tight">SmartBoard Stream</h1>
              <span className="rounded-full border border-[#d97757]/35 bg-[#d97757]/20 px-2 py-0.5 text-[10px] text-[#d97757]">LIVE</span>
            </div>
            <p className="mt-1 text-sm text-white/55">Streaming en temps réel des stations pédagogiques</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
              Chapitre en cours <span className="ml-2 text-white">{currentChapter?.title || 'Chapitre 1'}</span>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-sm">{new Date().toLocaleTimeString()}</div>
            <button className="rounded-xl border border-white/10 bg-white/5 p-2"><Bell size={16} /></button>
            <button className="rounded-xl border border-white/10 bg-white/5 p-2"><Grid2x2 size={16} /></button>
            <button className="rounded-xl border border-white/10 bg-white/5 p-2"><Gauge size={16} /></button>
            <button className="rounded-xl border border-white/10 bg-white/5 p-2"><PanelLeftClose size={16} /></button>
          </div>
        </header>

        <div className="grid h-[calc(100vh-94px)] grid-cols-[280px_1fr_340px] gap-3.5">
          <div className="space-y-3">
            <StepRail />
            <div className="rounded-[16px] border border-white/10 bg-black/20 p-3">
              <p className="mb-2 text-xs text-white/55">Progression chapitre 1</p>
              <div className="h-2 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-gradient-to-r from-[#d97757] to-[#ebca5e]" style={{ width: `${progressPct}%` }} />
              </div>
              <p className="mt-2 text-xs text-white/65">{doneSlides}/{totalSlides} · {progressPct}%</p>
            </div>
          </div>
          <section className="flex min-h-0 flex-col gap-4">
            <div className="min-h-0 flex-1">
              <SmartBoardStreamStage slide={currentSlide as any} />
            </div>
            <StreamingControls />
            <div className="rounded-[16px] border border-white/10 bg-black/20 p-2">
              <div className="flex gap-2 overflow-x-auto">
                {chapterSlides.map((slide, idx) => (
                  <div
                    key={slide.id || `${slide.step}-${idx}`}
                    className={`min-w-[150px] rounded-[12px] border p-2 ${
                      slide.step === selectedStep
                        ? 'border-[#d97757]/40 bg-[#d97757]/15'
                        : 'border-white/10 bg-white/[0.03]'
                    }`}
                  >
                    <p className="text-[10px] text-white/70">{idx + 1}</p>
                    <p className="mt-1 line-clamp-2 text-xs font-semibold text-white/90">{slide.title}</p>
                    <p className="mt-1 text-[10px] text-[#ebca5e]/70">{slide.status || slide.state || 'waiting'}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
          <div className="space-y-3">
            <div className="rounded-[16px] border border-[#d97757]/20 bg-[#d97757]/10 p-3">
              <p className="text-xs text-white/60">Chapitre en cours</p>
              <p className="mt-1 font-semibold">{currentChapter?.title || 'Chapitre 1'}</p>
            </div>
            <SlideLiveInspector slide={currentSlide as any} />
          </div>
        </div>
        </div>
      </div>
    </main>
  );
}
