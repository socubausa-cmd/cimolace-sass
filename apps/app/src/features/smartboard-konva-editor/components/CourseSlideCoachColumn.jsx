import React, { useState, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Sparkles, Loader2, Wand2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/customSupabaseClient';
import { useCourseCopilotStore } from '../store/useCourseCopilotStore';
import { CopilotCard, CopyRow, ZoneCopyCard } from './CourseCopilotShared';

/**
 * Colonne « coach slide » — navigation, contenu slide, MasterScript, objectif (layout premium).
 * @param {{ hideSlideNavigation?: boolean, hideCoachTitleRow?: boolean }} props — masquer nav / en-tête si filmstrip externe
 */
export default function CourseSlideCoachColumn({
  className,
  embedded = false,
  hideSlideNavigation = false,
  hideCoachTitleRow = false,
}) {
  const course = useCourseCopilotStore((s) => s.course);
  const activeSlideIndex = useCourseCopilotStore((s) => s.activeSlideIndex);
  const analysisBusy = useCourseCopilotStore((s) => s.analysisBusy);
  const globalSuggestions = useCourseCopilotStore((s) => s.globalSuggestions);
  const setActiveSlideIndex = useCourseCopilotStore((s) => s.setActiveSlideIndex);
  const nextSlide = useCourseCopilotStore((s) => s.nextSlide);
  const prevSlide = useCourseCopilotStore((s) => s.prevSlide);
  const runGlobalImprovements = useCourseCopilotStore((s) => s.runGlobalImprovements);

  const slide = course?.slides?.[activeSlideIndex];
  const slideCount = course?.slides?.length ?? 0;

  const [aiScriptBusy, setAiScriptBusy] = useState(false);
  const [aiScriptResult, setAiScriptResult] = useState('');
  const [aiScriptMode, setAiScriptMode] = useState('improve');

  const generateAiScript = useCallback(async () => {
    if (!slide) return;
    setAiScriptBusy(true);
    setAiScriptResult('');
    const content = [
      slide.masterScript?.discourse || '',
      (slide.masterScript?.keyPoints || []).join(' | '),
    ].filter(Boolean).join('\n');
    const context = course?.title || '';
    try {
      const { data, error } = await supabase.functions.invoke('liri-script-ai-improve', {
        body: { content, context, mode: aiScriptMode, slideIndex: activeSlideIndex },
      });
      if (error) throw error;
      setAiScriptResult(data?.result || data?.improved || '');
    } catch (err) {
      setAiScriptResult('Erreur : ' + (err?.message || 'connexion impossible'));
    } finally {
      setAiScriptBusy(false);
    }
  }, [slide, course, aiScriptMode, activeSlideIndex]);

  const Root = embedded ? 'div' : 'aside';
  return (
    <Root
      className={cn(
        'flex flex-col gap-2.5 overflow-y-auto [scrollbar-width:thin]',
        embedded
          ? 'w-full'
          : 'w-[min(100%,360px)] shrink-0 rounded-2xl border border-[#D4AF37]/20 bg-gradient-to-b from-[#0c0a18] via-[#080c16] to-[#050810] p-2.5 shadow-[0_0_40px_-12px_rgba(212,175,55,0.12)]',
        className,
      )}
    >
      {!hideCoachTitleRow ? (
        <div className="flex items-center gap-2 rounded-xl border border-violet-500/20 bg-violet-950/20 px-3 py-2">
          <Sparkles className="h-4 w-4 text-[#D4AF37]" />
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#f5dd8a]">Coach slide</p>
            <p className="text-[9px] text-white/45">Consignes & script pour la scène active</p>
          </div>
        </div>
      ) : null}

      {!course ? (
        <p className="rounded-2xl border border-white/10 bg-black/30 p-4 text-center text-[10px] leading-relaxed text-white/45">
          Ouvrez un parcours depuis l'agent LIRI (Designer + Coach) pour afficher le guide de la scène.
        </p>
      ) : null}

      {course ? (
        <>
          <CopilotCard title="Slide en cours" accent="violet" icon={Sparkles}>
            <p className="text-[15px] font-semibold leading-snug text-white">{slide?.title ?? '—'}</p>
            <p className="mt-2 text-[11px] leading-relaxed text-white/60">
              {slide?.objective ?? 'Sélectionnez un slide ci-dessous.'}
            </p>
          </CopilotCard>

          {!hideSlideNavigation ? (
            <>
              <div className="flex items-center gap-2 rounded-2xl border border-white/[0.08] bg-black/35 px-2 py-2">
                <button
                  type="button"
                  onClick={() => prevSlide()}
                  disabled={activeSlideIndex <= 0}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 text-white/80 transition-colors hover:bg-white/[0.06] disabled:opacity-30"
                  aria-label="Slide précédent"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <div className="min-w-0 flex-1 text-center">
                  <p className="text-[9px] font-medium uppercase tracking-wider text-white/40">Navigation</p>
                  <p className="truncate text-[12px] font-semibold text-[#f5dd8a]">
                    {activeSlideIndex + 1} / {slideCount}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => nextSlide()}
                  disabled={activeSlideIndex >= slideCount - 1}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 text-white/80 transition-colors hover:bg-white/[0.06] disabled:opacity-30"
                  aria-label="Slide suivant"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {course.slides.map((s, i) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setActiveSlideIndex(i)}
                    className={cn(
                      'rounded-lg border px-2 py-1 text-[9px] font-medium transition-all',
                      i === activeSlideIndex
                        ? 'border-[#D4AF37]/50 bg-[#D4AF37]/15 text-[#f5dd8a] shadow-[0_0_12px_rgba(212,175,55,0.15)]'
                        : 'border-white/10 text-white/50 hover:border-white/25 hover:text-white/75',
                    )}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
            </>
          ) : null}

          {slide ? (
            <>
              <CopilotCard title="Texte à mettre sur le canvas" accent="teal">
                <div className="mb-2 inline-flex rounded-lg border border-violet-400/25 bg-violet-950/40 px-2 py-1 text-[9px] font-semibold uppercase tracking-wide text-violet-200">
                  {slide.type}
                </div>
                <CopyRow label="Titre recommandé" text={slide.content.title} />
                <CopyRow label="Sous-titre" text={slide.content.subtitle} className="mt-2" />
                <CopyRow label="Texte principal" text={slide.content.mainText} className="mt-2" />
                <p className="mb-2 mt-3 text-[8px] font-semibold uppercase tracking-wider text-white/40">
                  Puces
                </p>
                <ul className="space-y-2">
                  {slide.content.blocks.map((b, i) => (
                    <CopyRow key={i} label={`Bloc ${i + 1}`} text={b} />
                  ))}
                </ul>
                <p className="mb-2 mt-3 text-[8px] font-semibold uppercase tracking-wider text-white/40">
                  Zones du slide
                </p>
                <div className="space-y-2">
                  {slide.zones.map((z, i) => (
                    <ZoneCopyCard key={z.id} zone={z} index={i} />
                  ))}
                </div>
              </CopilotCard>

              <CopilotCard title="MasterScript" accent="gold">
                <CopyRow label="Discours suggere" text={slide.masterScript.discourse} />
                <p className="mb-2 mt-3 text-[8px] font-semibold uppercase tracking-wider text-white/40">
                  Points cles
                </p>
                <ul className="space-y-2">
                  {slide.masterScript.keyPoints.map((k, i) => (
                    <CopyRow key={i} label={'Point ' + (i + 1)} text={k} />
                  ))}
                </ul>
                <CopyRow label="Transition" text={slide.masterScript.transitions} className="mt-2" />
                <CopyRow label="Vue globale du cours" text={course.masterScriptOverview} className="mt-2" />

                {/* LONGIA — Amelioration IA du script */}
                <div className="mt-3 rounded-xl border border-[#D4AF37]/20 bg-[#1a1410]/60 p-2.5">
                  <p className="mb-2 text-[9px] font-semibold uppercase tracking-wider text-[#f5dd8a]">LONGIA — Ameliorer ce script</p>
                  <div className="mb-2 flex flex-wrap gap-1">
                    {[
                      { id: 'improve',    label: 'Fluidifier' },
                      { id: 'simplify',   label: 'Simplifier' },
                      { id: 'expand',     label: 'Enrichir' },
                      { id: 'transition', label: 'Transition' },
                    ].map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setAiScriptMode(m.id)}
                        className={cn(
                          'rounded-lg border px-2 py-0.5 text-[8px] transition-colors',
                          aiScriptMode === m.id
                            ? 'border-[#D4AF37]/50 bg-[#D4AF37]/15 text-[#f5dd8a]'
                            : 'border-white/10 text-white/45 hover:border-white/25',
                        )}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    disabled={aiScriptBusy}
                    onClick={generateAiScript}
                    className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-[#D4AF37]/30 bg-[#D4AF37]/8 py-2 text-[10px] font-medium text-[#f5dd8a] hover:bg-[#D4AF37]/15 disabled:opacity-50"
                  >
                    {aiScriptBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}
                    {aiScriptBusy ? 'Generation...' : 'Generer avec LONGIA'}
                  </button>
                  {aiScriptResult && (
                    <div className="mt-2 rounded-xl border border-white/10 bg-black/30 p-2.5">
                      <p className="mb-1 text-[8px] font-semibold uppercase tracking-wider text-[#D4AF37]/60">Resultat LONGIA</p>
                      <p className="whitespace-pre-wrap text-[10px] leading-relaxed text-white/85">{aiScriptResult}</p>
                      <button
                        type="button"
                        onClick={() => { navigator.clipboard?.writeText(aiScriptResult); }}
                        className="mt-2 rounded-lg border border-white/10 px-2 py-0.5 text-[8px] text-white/50 hover:bg-white/5"
                      >
                        Copier
                      </button>
                    </div>
                  )}
                </div>
              </CopilotCard>

              <CopilotCard title="Objectif pédagogique" accent="rose">
                <CopyRow label="Ce que l'élève doit comprendre" text={slide.objective} />
              </CopilotCard>

              <CopilotCard title="Suggestions visuelles" accent="violet">
                <p className="mb-2 text-[10px] text-white/55">
                  Type suggéré :{' '}
                  <span className="font-medium text-violet-200">{slide.suggestions.visualType}</span>
                </p>
                <CopyRow label="Idée de schéma" text={slide.suggestions.diagramHint} />
                {slide.suggestions.layoutTips.map((tip, i) => (
                  <CopyRow key={i} label={`Conseil ${i + 1}`} text={tip} className="mt-2" />
                ))}
              </CopilotCard>

              <CopilotCard title="Finalisation" accent="gold">
                <button
                  type="button"
                  disabled={analysisBusy}
                  onClick={() => void runGlobalImprovements()}
                  className="w-full rounded-xl border border-amber-500/30 bg-amber-950/35 py-2.5 text-[10px] font-medium text-amber-100/95 hover:bg-amber-950/50 disabled:opacity-50"
                >
                  {analysisBusy ? <Loader2 className="mr-1.5 inline h-3 w-3 animate-spin" /> : null}
                  Améliorations globales LONGIA
                </button>
                {globalSuggestions?.length ? (
                  <ul className="mt-3 space-y-2 text-[10px] text-white/75">
                    {globalSuggestions.map((g, i) => (
                      <li
                        key={i}
                        className="flex gap-2 rounded-xl border border-white/[0.06] bg-black/30 px-2.5 py-2"
                      >
                        <span className="font-semibold text-[#D4AF37]">{i + 1}.</span>
                        {g}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </CopilotCard>
            </>
          ) : null}
        </>
      ) : null}
    </Root>
  );
}
