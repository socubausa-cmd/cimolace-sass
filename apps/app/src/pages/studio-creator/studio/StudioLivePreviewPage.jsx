/**
 * StudioLivePreviewPage — mode prof / élève / live avec spotlight.
 * Route : /studio/live-preview
 */
import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ChevronLeft, Eye, GraduationCap, Radio, ChevronRight as Next, ChevronLeft as Prev,
  ZoomIn, Maximize2, Play, Square, Users, Crosshair,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSmartboardStore } from '@/stores/smartboard.store';
import { useLiveStore } from '@/stores/live.store';
import { applySpotlight, filterElementsByStep } from '@/engines/pedagogy-engine';
import { computeScale, DESIGN_WIDTH, DESIGN_HEIGHT } from '@/engines/konva-engine';

const VIEW_TABS = [
  { id: 'design', label: 'Aperçu', icon: Eye },
  { id: 'student', label: 'Élève', icon: GraduationCap },
  { id: 'teacher', label: 'Prof', icon: Eye },
  { id: 'live', label: 'Live', icon: Radio },
];

function SlidePreviewCanvas({ elements, scale }) {
  return (
    <div
      className="relative overflow-hidden rounded-lg border border-white/10 bg-[#0f1117]"
      style={{ width: DESIGN_WIDTH * scale, height: DESIGN_HEIGHT * scale }}
    >
      {elements.map((el) => {
        const opacity = el.opacity ?? 1;
        const base = {
          position: 'absolute',
          left: el.x * scale,
          top: el.y * scale,
          width: (el.width ?? 100) * scale,
          opacity,
          transition: 'opacity 0.4s ease',
        };

        if (el.type === 'text') {
          return (
            <div
              key={el.id}
              style={{
                ...base,
                fontSize: (el.style?.fontSize ?? 24) * scale,
                color: el.style?.fill ?? '#fff',
                fontFamily: el.style?.fontFamily ?? 'Inter, sans-serif',
                textAlign: el.style?.align ?? 'left',
                lineHeight: el.style?.lineHeight ?? 1.4,
              }}
            >
              {el.data?.text ?? ''}
            </div>
          );
        }

        if (el.type === 'shape' || el.type === 'image') {
          return (
            <div
              key={el.id}
              style={{
                ...base,
                height: (el.height ?? 100) * scale,
                background: el.type === 'image' ? `url(${el.data?.url}) center/cover` : (el.style?.fill ?? '#1e293b'),
                border: el.style?.stroke ? `${(el.style.strokeWidth ?? 1) * scale}px solid ${el.style.stroke}` : undefined,
                borderRadius: (el.style?.cornerRadius ?? 0) * scale,
              }}
            />
          );
        }

        return null;
      })}
    </div>
  );
}

export default function StudioLivePreviewPage() {
  const containerRef = useRef(null);
  const [scale, setScale] = useState(0.4);

  const slides = useSmartboardStore((s) => s.slides);
  const activeSlideId = useSmartboardStore((s) => s.activeSlideId);
  const setActiveSlide = useSmartboardStore((s) => s.setActiveSlide);
  const activeSection = useSmartboardStore((s) => s.activeSection);
  const setActiveSection = useSmartboardStore((s) => s.setActiveSection);

  const {
    liveStep, maxSteps, nextStep, prevStep, resetSteps, setMaxSteps,
    isLiveActive, startLive, stopLive, participantCount,
  } = useLiveStore();

  const [viewMode, setViewMode] = useState('design');

  const activeSlide = slides.find((s) => s.id === activeSlideId) ?? slides[0];
  const activeIndex = slides.findIndex((s) => s.id === (activeSlide?.id ?? ''));

  useEffect(() => {
    if (!activeSlide) return;
    const allElements = activeSlide.initialState?.elements ?? [];
    const max = allElements.reduce((m, el) => Math.max(m, el.step ?? 0), 0);
    setMaxSteps(max);
    resetSteps();
  }, [activeSlide?.id, setMaxSteps, resetSteps]);

  useEffect(() => {
    const obs = new ResizeObserver(() => {
      if (!containerRef.current) return;
      const { width, height } = containerRef.current.getBoundingClientRect();
      setScale(computeScale(width - 80, height - 80));
    });
    if (containerRef.current) obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  const rawElements = activeSlide?.initialState?.elements ?? [];
  const filteredByStep = filterElementsByStep(rawElements, liveStep);
  const filteredByView = viewMode === 'student'
    ? filteredByStep.filter((e) => !e.visibleFor || e.visibleFor === 'student' || e.visibleFor === 'both')
    : viewMode === 'teacher'
    ? filteredByStep.filter((e) => !e.visibleFor || e.visibleFor === 'teacher' || e.visibleFor === 'both')
    : filteredByStep;

  const displayElements = applySpotlight(filteredByView, activeSlide?.sections ?? [], activeSection);

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-[#05070c] text-white">
      {/* Header */}
      <div className="flex shrink-0 items-center gap-3 border-b border-white/8 bg-[#080a12] px-4 py-2">
        <Link to="/studio" className="flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-[11px] text-white/60 hover:text-[#D4AF37]">
          <ChevronLeft className="h-3.5 w-3.5" />Studio
        </Link>
        <div className="h-5 w-px bg-white/10" />
        <h1 className="text-[14px] font-bold text-white">Live Preview</h1>

        {/* View tabs */}
        <div className="ml-4 flex rounded-lg border border-white/10 bg-black/30 p-0.5">
          {VIEW_TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setViewMode(id)}
              className={cn(
                'flex items-center gap-1.5 rounded-md px-3 py-1 text-[11px] transition-colors',
                viewMode === id ? 'bg-[#D4AF37] text-black font-semibold' : 'text-white/50 hover:text-white',
              )}
            >
              <Icon className="h-3 w-3" />
              {label}
            </button>
          ))}
        </div>

        {/* Live session */}
        {viewMode === 'live' && (
          <div className="ml-auto flex items-center gap-2">
            {isLiveActive && (
              <span className="flex items-center gap-1.5 text-[11px] text-emerald-400">
                <Users className="h-3.5 w-3.5" />
                {participantCount} participant(s)
              </span>
            )}
            <button
              onClick={() => isLiveActive ? stopLive() : startLive(crypto.randomUUID().slice(0, 8))}
              className={cn(
                'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold transition-colors',
                isLiveActive ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' : 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30',
              )}
            >
              {isLiveActive ? <><Square className="h-3.5 w-3.5" />Arrêter</> : <><Play className="h-3.5 w-3.5" />Démarrer</>}
            </button>
          </div>
        )}
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Left filmstrip */}
        <div className="flex w-48 shrink-0 flex-col gap-1 overflow-y-auto border-r border-white/8 p-2">
          {slides.map((slide, i) => (
            <button
              key={slide.id}
              onClick={() => setActiveSlide(slide.id)}
              className={cn(
                'flex flex-col gap-1 rounded-lg border p-2 text-left transition-colors',
                slide.id === activeSlide?.id
                  ? 'border-[#D4AF37]/40 bg-[#D4AF37]/10'
                  : 'border-white/8 bg-white/[0.02] hover:border-white/15',
              )}
            >
              <div className="h-16 w-full rounded-md bg-[#0f1117]" />
              <span className="truncate text-[10px] text-white/50">
                {i + 1}. {slide.title}
              </span>
            </button>
          ))}
        </div>

        {/* Center canvas */}
        <div ref={containerRef} className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-hidden p-6">
          {activeSlide ? (
            <SlidePreviewCanvas elements={displayElements} scale={scale} />
          ) : (
            <p className="text-white/30">Aucun slide. Créez un cours et envoyez-le au Designer.</p>
          )}
        </div>

        {/* Right controls */}
        <div className="flex w-56 shrink-0 flex-col gap-4 overflow-y-auto border-l border-white/8 p-3">
          {/* Step control */}
          <div className="flex flex-col gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-white/40">Progression</p>
            <div className="flex items-center gap-2">
              <button onClick={prevStep} disabled={liveStep === 0} className="rounded border border-white/10 p-1 disabled:opacity-30 hover:bg-white/5">
                <Prev className="h-3.5 w-3.5" />
              </button>
              <div className="flex-1 text-center text-[13px] font-bold text-white">
                {liveStep} / {maxSteps}
              </div>
              <button onClick={nextStep} disabled={liveStep >= maxSteps} className="rounded border border-white/10 p-1 disabled:opacity-30 hover:bg-white/5">
                <Next className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full bg-[#D4AF37] transition-all"
                style={{ width: maxSteps > 0 ? `${(liveStep / maxSteps) * 100}%` : '0%' }}
              />
            </div>
          </div>

          {/* Spotlight sections */}
          {(activeSlide?.sections?.length ?? 0) > 0 && (
            <div className="flex flex-col gap-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-white/40">Spotlight</p>
              <button
                onClick={() => setActiveSection(null)}
                className={cn('rounded-md border px-2 py-1 text-[11px] transition-colors',
                  !activeSection ? 'border-[#D4AF37]/40 bg-[#D4AF37]/10 text-[#D4AF37]' : 'border-white/10 text-white/50 hover:border-white/20')}
              >
                Tout visible
              </button>
              {activeSlide.sections.map((sec) => (
                <button
                  key={sec.id}
                  onClick={() => setActiveSection(activeSection === sec.id ? null : sec.id)}
                  className={cn('flex items-center gap-1.5 rounded-md border px-2 py-1 text-left text-[11px] transition-colors',
                    activeSection === sec.id ? 'border-[#D4AF37]/40 bg-[#D4AF37]/10 text-[#D4AF37]' : 'border-white/10 text-white/50 hover:border-white/20')}
                >
                  <Crosshair className="h-3 w-3 shrink-0" />
                  {sec.label}
                </button>
              ))}
            </div>
          )}

          {/* Slide nav */}
          <div className="flex flex-col gap-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-white/40">Slide</p>
            <div className="flex gap-2">
              <button
                disabled={activeIndex <= 0}
                onClick={() => setActiveSlide(slides[activeIndex - 1].id)}
                className="flex flex-1 items-center justify-center gap-1 rounded border border-white/10 py-1.5 text-[11px] text-white/50 disabled:opacity-30 hover:bg-white/5"
              >
                <Prev className="h-3.5 w-3.5" />Préc.
              </button>
              <button
                disabled={activeIndex >= slides.length - 1}
                onClick={() => setActiveSlide(slides[activeIndex + 1].id)}
                className="flex flex-1 items-center justify-center gap-1 rounded border border-white/10 py-1.5 text-[11px] text-white/50 disabled:opacity-30 hover:bg-white/5"
              >
                Suiv.<Next className="h-3.5 w-3.5" />
              </button>
            </div>
            <p className="text-center text-[10px] text-white/30">{activeIndex + 1} / {slides.length}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
