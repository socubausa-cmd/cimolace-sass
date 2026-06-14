import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  BookOpen, ClipboardCopy, FileText, Loader2, Sparkles, TreePine,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { extractTextFromFile } from '@/lib/extractDocumentText';
import { useCourseCopilotStore } from '../store/useCourseCopilotStore';
import { seedCanvasFromPlainText } from '../lib/seedCanvasFromPlainText';
import { useSmartboardKonvaStore } from '../store/useSmartboardKonvaStore';
import {
  copyText,
  MindmapTree,
  CopilotCard,
  filterMindmapNodeByQuery,
} from './CourseCopilotShared';

/**
 * Colonne « structure du cours » — document, analyse, plan, mindmap (layout premium studio).
 * @param {{ hideIntroBanner?: boolean, structureFilter?: string }} props
 */
export default function CourseStructureColumn({
  className,
  embedded = false,
  hideIntroBanner = false,
  structureFilter = '',
}) {
  const docFileRef = useRef(null);
  const [docImportBusy, setDocImportBusy] = useState(false);
  const [docImportErr, setDocImportErr] = useState('');
  const [seedErr, setSeedErr] = useState('');

  const sourceText = useCourseCopilotStore((s) => s.sourceText);
  const setSourceText = useCourseCopilotStore((s) => s.setSourceText);
  const course = useCourseCopilotStore((s) => s.course);
  const analysisBusy = useCourseCopilotStore((s) => s.analysisBusy);
  const runAnalysis = useCourseCopilotStore((s) => s.runAnalysis);
  const resetCourse = useCourseCopilotStore((s) => s.resetCourse);

  const slideCount = course?.slides?.length ?? 0;

  const sf = (structureFilter || '').trim().toLowerCase();
  const planMatchesSf = useMemo(() => {
    if (!sf || !course) return true;
    const blob = [
      course.title,
      course.description,
      course.analysis?.mainTopic,
      ...(course.analysis?.subthemes || []),
      ...(course.chapters || []).flatMap((ch) => [ch.title, ch.summary]),
      course.progression?.narrative,
      ...(course.progression?.pedagogicalPhases || []),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return blob.includes(sf);
  }, [sf, course]);

  const filteredChapters = useMemo(() => {
    if (!course?.chapters?.length) return [];
    if (!sf) return course.chapters;
    return course.chapters.filter(
      (ch) =>
        String(ch.title).toLowerCase().includes(sf) || String(ch.summary || '').toLowerCase().includes(sf),
    );
  }, [course?.chapters, sf]);

  const filteredSubthemes = useMemo(() => {
    const st = course?.analysis?.subthemes;
    if (!st?.length) return [];
    if (!sf) return st;
    return st.filter((t) => String(t).toLowerCase().includes(sf));
  }, [course?.analysis?.subthemes, sf]);

  const filteredPedagogicalPhases = useMemo(() => {
    const ph = course?.progression?.pedagogicalPhases;
    if (!ph?.length) return [];
    if (!sf) return ph;
    return ph.filter((p) => String(p).toLowerCase().includes(sf));
  }, [course?.progression?.pedagogicalPhases, sf]);

  const narrativeMatchesFilter = useMemo(() => {
    if (!sf) return true;
    const n = course?.progression?.narrative;
    if (!n) return false;
    return String(n).toLowerCase().includes(sf);
  }, [sf, course?.progression?.narrative]);

  const filteredMindmapRoot = useMemo(
    () => filterMindmapNodeByQuery(course?.mindmap, structureFilter),
    [course?.mindmap, structureFilter],
  );

  const sourceMatchCount = useMemo(() => {
    if (!sf || !sourceText) return null;
    try {
      const re = new RegExp(sf.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      const m = sourceText.match(re);
      return m ? m.length : 0;
    } catch {
      return 0;
    }
  }, [sf, sourceText]);

  const onAnalyze = useCallback(() => {
    void runAnalysis();
  }, [runAnalysis]);

  const onSeedCanvas = useCallback(() => {
    setSeedErr('');
    const t = useCourseCopilotStore.getState().sourceText || '';
    const { objects, error } = seedCanvasFromPlainText(t, { maxBlocks: 28 });
    if (error) {
      setSeedErr(error);
      return;
    }
    if (!objects.length) return;
    const { pushHistory, addObjects } = useSmartboardKonvaStore.getState();
    pushHistory();
    addObjects(objects);
  }, []);

  const onPickDocument = useCallback(
    async (e) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file) return;
      setDocImportErr('');
      setDocImportBusy(true);
      try {
        const text = await extractTextFromFile(file);
        if (!text) {
          setDocImportErr('Aucun texte extrait (PDF scanné ou vide).');
          return;
        }
        const prev = useCourseCopilotStore.getState().sourceText;
        setSourceText(prev.trim() ? `${prev.trim()}\n\n---\n\n${text}` : text);
      } catch (err) {
        setDocImportErr(err instanceof Error ? err.message : String(err));
      } finally {
        setDocImportBusy(false);
      }
    },
    [setSourceText],
  );

  const Root = embedded ? 'div' : 'aside';
  return (
    <Root
      className={cn(
        'flex flex-col gap-2.5 overflow-y-auto [scrollbar-width:thin]',
        embedded
          ? 'w-full'
          : 'w-[min(100%,300px)] shrink-0 rounded-2xl border border-white/[0.08] bg-gradient-to-b from-[#0a1022] to-[#060a14] p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]',
        className,
      )}
    >
      {!hideIntroBanner ? (
        <div className="rounded-xl border border-[color-mix(in_srgb,var(--school-accent)_20%,transparent)] bg-[#0d1428]/80 px-3 py-2.5">
          <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-[#c9a227]">Structure</p>
          <p className="mt-0.5 text-[11px] text-white/55">IA cadre le cours · vous composez sur le canvas</p>
        </div>
      ) : null}

      <CopilotCard title="Document source" icon={BookOpen} accent="violet">
        <textarea
          value={sourceText}
          onChange={(e) => setSourceText(e.target.value)}
          placeholder="Texte, transcription, notes…"
          rows={5}
          className="mb-2 w-full resize-y rounded-xl border border-white/10 bg-black/45 px-2.5 py-2 text-[11px] text-white placeholder:text-white/25"
        />
        {sf && sourceMatchCount !== null ? (
          <p className="mb-2 text-[9px] leading-snug text-white/40">
            Document source :{' '}
            {sourceMatchCount === 0 ? (
              <>aucune occurrence de « {structureFilter.trim()} ».</>
            ) : (
              <>
                {sourceMatchCount} occurrence(s) de « {structureFilter.trim()} ».
              </>
            )}
          </p>
        ) : null}
        <div className="mb-2 flex flex-wrap gap-1.5">
          <button
            type="button"
            disabled={docImportBusy}
            onClick={() => docFileRef.current?.click()}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-white/12 bg-white/[0.05] px-2 py-2 text-[10px] text-white/85 hover:border-violet-400/35 disabled:opacity-50"
          >
            {docImportBusy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <FileText className="h-3.5 w-3.5 text-[var(--school-accent)]" />
            )}
            PDF / .txt
          </button>
          <input
            ref={docFileRef}
            type="file"
            accept=".pdf,.txt,.md,.markdown,text/plain,application/pdf"
            className="hidden"
            onChange={(ev) => void onPickDocument(ev)}
          />
        </div>
        {docImportErr ? (
          <p className="mb-2 text-[9px] text-amber-300/90">{docImportErr}</p>
        ) : null}
        <button
          type="button"
          disabled={analysisBusy}
          onClick={onAnalyze}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-violet-500/35 bg-gradient-to-r from-violet-950/50 to-violet-900/30 py-2.5 text-[11px] font-medium text-violet-100 shadow-sm hover:from-violet-900/55 hover:to-violet-800/35 disabled:opacity-50"
        >
          {analysisBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          Analyser le cours
        </button>
        <button
          type="button"
          disabled={!sourceText.trim()}
          onClick={onSeedCanvas}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] py-2 text-[10px] text-white/80 hover:border-[color-mix(in_srgb,var(--school-accent)_30%,transparent)] disabled:opacity-45"
        >
          Texte → blocs canvas
        </button>
        {seedErr ? <p className="mt-1.5 text-[9px] text-amber-300/90">{seedErr}</p> : null}
        {course ? (
          <button
            type="button"
            onClick={() => resetCourse()}
            className="mt-2 w-full text-[9px] text-white/40 underline-offset-2 hover:text-white/65 hover:underline"
          >
            Réinitialiser le plan
          </button>
        ) : null}
      </CopilotCard>

      {!course ? (
        <div className="rounded-2xl border border-dashed border-white/12 bg-black/25 p-3 text-[10px] leading-relaxed text-white/50">
          Lancez une analyse pour obtenir chapitres, mindmap et feuille de route slide par slide.
        </div>
      ) : null}

      {course ? (
        <>
          <CopilotCard title="Plan du cours" icon={BookOpen} accent="gold">
            {sf && !planMatchesSf ? (
              <p className="mb-2 rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-[10px] text-white/45">
                Aucune correspondance dans le résumé du plan pour « {structureFilter.trim()} » — chapitres / sous-thèmes filtrés
                ci-dessous.
              </p>
            ) : null}
            <p className="mb-1.5 text-[13px] font-semibold leading-snug text-white">{course.title}</p>
            <p className="mb-3 text-[10px] leading-relaxed text-white/55">{course.description}</p>
            <div className="mb-3 grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-white/[0.06] bg-black/35 px-2.5 py-2 text-[9px] text-white/50">
                Complexité
                <span className="ml-1 font-medium text-[var(--school-accent)]">{course.analysis.complexity}</span>
              </div>
              <div className="rounded-xl border border-white/[0.06] bg-black/35 px-2.5 py-2 text-[9px] text-white/50">
                Durée
                <span className="ml-1 font-medium text-white/90">
                  {course.analysis.estimatedDurationMinutes} min
                </span>
              </div>
            </div>
            <p className="mb-1 text-[8px] font-medium uppercase tracking-wider text-white/35">Sujet</p>
            <p className="text-[10px] text-[#e8c76b]">{course.analysis.mainTopic}</p>
            <ul className="mt-2 list-inside list-disc text-[9px] text-white/55">
              {filteredSubthemes.length === 0 && sf ? (
                <li className="list-none text-white/35">Aucun sous-thème ne correspond.</li>
              ) : (
                filteredSubthemes.map((st, i) => (
                  <li key={i}>{st}</li>
                ))
              )}
            </ul>
            <p className="mb-1.5 mt-3 text-[8px] font-medium uppercase tracking-wider text-white/35">Chapitres</p>
            <ul className="space-y-2">
              {filteredChapters.length === 0 && sf ? (
                <li className="list-none rounded-xl border border-dashed border-white/10 px-2.5 py-2 text-[10px] text-white/40">
                  Aucun chapitre ne correspond au filtre.
                </li>
              ) : (
                filteredChapters.map((ch) => (
                  <li
                    key={ch.id}
                    className="rounded-xl border border-white/[0.06] bg-black/30 px-2.5 py-2 text-[10px]"
                  >
                    <span className="font-medium text-white/90">{ch.title}</span>
                    <p className="mt-1 text-[9px] leading-snug text-white/50">{ch.summary}</p>
                  </li>
                ))
              )}
            </ul>
            <p className="mt-3 text-[9px] text-white/45">
              <span className="font-semibold text-[var(--school-accent)]">{slideCount}</span> slides ·{' '}
              {sf && !narrativeMatchesFilter ? (
                <span className="italic text-white/35">
                  Fil narratif sans « {structureFilter.trim()} » — élargissez ou videz le filtre.
                </span>
              ) : (
                <span className="italic text-white/40">
                  {course.progression.narrative.length > 140
                    ? `${course.progression.narrative.slice(0, 140)}…`
                    : course.progression.narrative}
                </span>
              )}
            </p>
            <p className="mb-1 mt-2 text-[8px] font-medium uppercase tracking-wider text-white/35">
              Phases pédagogiques
            </p>
            <ol className="list-inside list-decimal text-[8px] leading-tight text-white/45">
              {filteredPedagogicalPhases.length === 0 && sf ? (
                <li className="list-none text-white/35">Aucune phase ne correspond.</li>
              ) : (
                filteredPedagogicalPhases.map((ph) => (
                  <li key={ph}>{ph}</li>
                ))
              )}
            </ol>
          </CopilotCard>

          <CopilotCard title="Mindmap" icon={TreePine} accent="gold">
            {sf && !filteredMindmapRoot ? (
              <p className="rounded-lg border border-white/10 bg-black/25 px-2 py-2 text-[10px] text-white/45">
                Aucun nœud de mindmap ne correspond au filtre.
              </p>
            ) : (
              <>
            <div className="relative overflow-hidden rounded-xl border border-[color-mix(in_srgb,var(--school-accent)_20%,transparent)] bg-[radial-gradient(ellipse_at_center,rgba(212,175,55,0.07),transparent_65%)] px-2 py-4">
              <div className="relative z-[1] flex min-h-[100px] items-center justify-center">
                <div className="rounded-full border border-[color-mix(in_srgb,var(--school-accent)_35%,transparent)] bg-[#0c1224] px-4 py-2.5 text-center text-[11px] font-medium text-[#f0d78c] shadow-[0_0_20px_rgba(212,175,55,0.12)]">
                  {(sf ? filteredMindmapRoot?.label : course.mindmap?.label) || course.title}
                </div>
              </div>
            </div>
            <ul className="mt-2 space-y-0.5">
              <MindmapTree node={sf ? filteredMindmapRoot : course.mindmap} />
            </ul>
              </>
            )}
            <button
              type="button"
              onClick={() => copyText(JSON.stringify(course.mindmap, null, 2))}
              className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-white/10 py-2 text-[9px] text-white/55 hover:bg-white/[0.04]"
            >
              <ClipboardCopy className="h-3 w-3" />
              Copier JSON
            </button>
          </CopilotCard>
        </>
      ) : null}
    </Root>
  );
}
