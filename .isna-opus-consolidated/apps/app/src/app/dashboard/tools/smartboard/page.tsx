import React, { useMemo, useState } from 'react';
import SlideGenerationPanel from '@/components/smartboard/SlideGenerationPanel';
import SlideNavigator from '@/components/smartboard/SlideNavigator';
import SlideStepRail from '@/components/smartboard/SlideStepRail';
import SmartBoardStage from '@/components/smartboard/SmartBoardStage';
import { useSmartboardStore } from '@/stores/liri-smartboard-generator.store';
import type { SmartboardSlide } from '@/lib/liri-smartboard/types';

function inferChapters(source: string) {
  const lines = String(source || '').split('\n');
  const found = lines
    .map((line) => line.trim())
    .filter((line) => /^chapitre\s+\d+/i.test(line))
    .map((line, idx) => ({
      chapter_id: `chapter_${idx + 1}`,
      title: line.replace(/^chapitre\s+\d+\s*[—:\-]?\s*/i, '').trim() || `Chapitre ${idx + 1}`,
      objective: '',
      skill: '',
      knowledge: '',
    }));
  if (found.length) return found;
  return [
    {
      chapter_id: 'chapter_1',
      title: 'Chapitre 1',
      objective: '',
      skill: '',
      knowledge: '',
    },
  ];
}

export default function SmartboardToolPage() {
  const {
    sourceText,
    setSourceText,
    setChapters,
    generateAll,
    status,
    error,
    progress,
    slides,
    activeStepKey,
    setActiveStep,
    chapters,
    updateSlideField,
  } = useSmartboardStore();
  const [activeSlideId, setActiveSlideId] = useState<string | null>(null);

  const activeSlide = useMemo(() => {
    if (!slides.length) return null;
    return slides.find((s) => s.slide_id === activeSlideId) || slides[slides.length - 1];
  }, [slides, activeSlideId]);

  const progressLabel =
    status === 'running'
      ? `Chapitre ${progress.chapterIndex + 1} · Étape ${progress.stepIndex + 1} (${progress.done}/${progress.total})`
      : status === 'done'
        ? `Terminé (${slides.length} slides)`
        : 'En attente';

  const currentChapter = useMemo(() => {
    if (!activeSlide) return null;
    return chapters.find((ch) => ch.chapter_id === activeSlide.chapter_id) || null;
  }, [chapters, activeSlide]);

  const exportSmartBoardJson = () => {
    const chapter = currentChapter;
    const data = {
      chapter,
      slides,
      smartboard_designer_import: {
        version: '1.0',
        source: 'liri-smartboard-engine',
        smartboard_element_scenes: slides.map((slide, index) => ({
          id: slide.slide_id,
          name: slide.title,
          order_index: index,
          scene_type: 'progressive_build',
          ia_data: {
            title: slide.title,
            subtitle: slide.content?.support_text || '',
            core_idea: slide.pedagogical_goal || '',
            slide_summary: slide.content?.main_text || '',
            development: [
              {
                label: 'Contenu',
                points: [slide.content?.main_text || ''],
              },
            ],
            visual_description: slide.visual?.prompt || '',
            illustration: {
              scene: slide.visual?.prompt || '',
            },
            layout_mode: 'smartboard_horizontal',
          },
          elements: [],
        })),
        smartboard_master_script_sections: slides.map((slide, index) => ({
          id: `ms_${slide.slide_id}`,
          slide_index: index,
          title: slide.title,
          script: slide.teacher_note || slide.content?.main_text || '',
          content: slide.content?.main_text || '',
          objective: slide.pedagogical_goal || '',
          description: slide.content?.support_text || '',
          retention: slide.transition || '',
        })),
      },
      exported_at: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${chapter?.chapter_id || 'smartboard'}-slides.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const updateField = (slide: SmartboardSlide, field: string, value: string) => {
    updateSlideField(slide.step, field, value);
  };

  const onGenerate = async () => {
    setChapters(inferChapters(sourceText));
    await generateAll();
  };

  return (
    <main className="min-h-screen bg-[#070B14] p-4 text-white">
      <div className="mx-auto max-w-[1400px] space-y-4">
        <header className="rounded-2xl border border-violet-400/30 bg-violet-500/10 p-4">
          <h1 className="text-xl font-bold">LIRI SmartBoard Engine</h1>
          <p className="text-sm text-violet-200/80">Génération slide par slide (1 étape pédagogique = 1 slide).</p>
        </header>

        <div className="grid gap-4 lg:grid-cols-[320px_1fr_360px]">
          <div className="space-y-4">
            <SlideGenerationPanel
              sourceText={sourceText}
              onSourceChange={setSourceText}
              onGenerate={onGenerate}
              status={status}
              error={error}
              progressLabel={progressLabel}
            />
            <SlideStepRail activeStepKey={activeStepKey} onSelect={setActiveStep} />
            <button
              onClick={exportSmartBoardJson}
              className="w-full rounded-xl bg-emerald-600 px-5 py-4 font-bold text-white hover:bg-emerald-500"
            >
              Exporter JSON SmartBoard
            </button>
          </div>

          <SmartBoardStage slide={activeSlide} />

          <div className="space-y-4">
            <SlideNavigator slides={slides} activeSlideId={activeSlideId} onSelect={setActiveSlideId} />

            {activeSlide && (
              <div className="rounded-2xl border border-white/10 bg-[#060B16] p-4">
                <h3 className="mb-4 font-black">Éditer ce slide</h3>
                <label className="text-xs text-white/45">Titre</label>
                <input
                  value={activeSlide.title}
                  onChange={(e) => updateField(activeSlide, 'title', e.target.value)}
                  className="mb-3 mt-1 w-full rounded-xl border border-white/10 bg-white/[0.04] p-3 text-sm outline-none"
                />
                <label className="text-xs text-white/45">Texte principal</label>
                <textarea
                  value={activeSlide.content.main_text}
                  onChange={(e) => updateField(activeSlide, 'content.main_text', e.target.value)}
                  className="mb-3 mt-1 h-24 w-full rounded-xl border border-white/10 bg-white/[0.04] p-3 text-sm outline-none"
                />
                <label className="text-xs text-white/45">Texte secondaire</label>
                <textarea
                  value={activeSlide.content.support_text || ''}
                  onChange={(e) => updateField(activeSlide, 'content.support_text', e.target.value)}
                  className="mb-3 mt-1 h-20 w-full rounded-xl border border-white/10 bg-white/[0.04] p-3 text-sm outline-none"
                />
                <label className="text-xs text-white/45">Action élève</label>
                <textarea
                  value={activeSlide.student_action || ''}
                  onChange={(e) => updateField(activeSlide, 'student_action', e.target.value)}
                  className="mb-3 mt-1 h-20 w-full rounded-xl border border-white/10 bg-white/[0.04] p-3 text-sm outline-none"
                />
                <label className="text-xs text-white/45">Note professeur</label>
                <textarea
                  value={activeSlide.teacher_note || ''}
                  onChange={(e) => updateField(activeSlide, 'teacher_note', e.target.value)}
                  className="mb-3 mt-1 h-20 w-full rounded-xl border border-white/10 bg-white/[0.04] p-3 text-sm outline-none"
                />
                <label className="text-xs text-white/45">Transition</label>
                <textarea
                  value={activeSlide.transition || ''}
                  onChange={(e) => updateField(activeSlide, 'transition', e.target.value)}
                  className="mt-1 h-20 w-full rounded-xl border border-white/10 bg-white/[0.04] p-3 text-sm outline-none"
                />
              </div>
            )}

            <div className="rounded-2xl border border-white/10 bg-[#060B16] p-4">
              <p className="text-sm text-white/45">Prompt image IA</p>
              <p className="mt-2 text-sm leading-relaxed text-white/70">
                {activeSlide?.visual?.prompt || 'Aucun prompt image généré pour ce slide.'}
              </p>
              <button
                disabled={!activeSlide?.visual?.prompt}
                className="mt-4 w-full rounded-xl border border-violet-400/30 bg-violet-500/10 px-5 py-3 font-bold text-violet-200 disabled:opacity-40"
              >
                Générer image du slide
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

