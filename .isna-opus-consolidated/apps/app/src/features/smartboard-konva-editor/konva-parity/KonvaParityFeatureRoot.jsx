/**
 * Parité fonctionnelle LIRI (exports, thème, blocs) — complète l’éditeur sans dupliquer
 * le bandeau « Projet & progression » (déjà dans SmartboardKonvaEditorV1).
 * La section lourde est repliable pour laisser la vue centrée sur le canvas (maquette type logiciel).
 */
import React, { useCallback, useState } from 'react';
import { ChevronDown, FileDown, FileJson, FileText, LayoutGrid, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCourseCopilotStore } from '../store/useCourseCopilotStore';
import { useSmartboardKonvaStore } from '../store/useSmartboardKonvaStore';
import SmartboardCourseThemeSection from '../components/SmartboardCourseThemeSection';
import {
  DESIGNER_PREVIEW_MODES,
  describeDesignerPreviewModeFr,
  labelDesignerPreviewModeFr,
} from '../lib/liriDesignerPreviewModes';
import {
  buildFlashcardsPlainText,
  buildProfessorScriptMarkdown,
  buildQuizMarkdown,
  buildSlidePackOutlineMarkdown,
  buildStudentHandoutMarkdown,
  triggerDownloadTextFile,
} from '../lib/liriWorkspaceTextExports';
import {
  PEDAGOGICAL_BLOCK_CATALOG,
  insertKonvaPedagogicalBlock,
} from '../lib/konvaPedagogicalBlocks';
import { buildWorkspacePayloadFromStores } from '../store/smartboardWorkspaceApi';

/**
 * @param {{
 *   className?: string;
 *   editorRef?: React.RefObject<{ exportCanvasPdf?: () => Promise<{ ok: boolean; error?: string }> } | null>;
 * }} props
 */
export default function KonvaParityFeatureRoot({ className, editorRef }) {
  const [hint, setHint] = useState('');
  const [pblockHint, setPblockHint] = useState('');
  const [themeHint, setThemeHint] = useState('');
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfHint, setPdfHint] = useState('');
  const [workspaceJsonHint, setWorkspaceJsonHint] = useState('');
  const designerPreviewMode = useCourseCopilotStore((s) => s.designerPreviewMode);
  const setDesignerPreviewMode = useCourseCopilotStore((s) => s.setDesignerPreviewMode);
  const project = useSmartboardKonvaStore((s) => s.project);

  const isMinimalPreview =
    designerPreviewMode === 'student' || designerPreviewMode === 'live';

  const runExport = (kind) => {
    const copilot = useCourseCopilotStore.getState();
    const { course: c, slideTimingMinutes: st } = copilot;
    if (!c?.slides?.length) {
      setHint('Importez un parcours LIRI (plan Copilot) avant export.');
      window.setTimeout(() => setHint(''), 4000);
      return;
    }
    const ts = Date.now();
    try {
      if (kind === 'prof') {
        triggerDownloadTextFile(
          `liri-script-prof-${ts}.md`,
          buildProfessorScriptMarkdown(c, { slideTimingMinutes: st }),
          'text/markdown;charset=utf-8',
        );
      } else if (kind === 'student') {
        triggerDownloadTextFile(
          `liri-support-eleve-${ts}.md`,
          buildStudentHandoutMarkdown(c),
          'text/markdown;charset=utf-8',
        );
      } else if (kind === 'quiz') {
        triggerDownloadTextFile(
          `liri-quiz-${ts}.md`,
          buildQuizMarkdown(c),
          'text/markdown;charset=utf-8',
        );
      } else if (kind === 'pack') {
        triggerDownloadTextFile(
          `liri-pack-plan-${ts}.md`,
          buildSlidePackOutlineMarkdown(c, { slideTimingMinutes: st }),
          'text/markdown;charset=utf-8',
        );
      } else {
        triggerDownloadTextFile(
          `liri-flashcards-${ts}.txt`,
          buildFlashcardsPlainText(c),
          'text/plain;charset=utf-8',
        );
      }
      setHint('Fichier téléchargé.');
      window.setTimeout(() => setHint(''), 3500);
    } catch (e) {
      console.warn('[KonvaParityFeatureRoot]', e);
      setHint('Export impossible.');
      window.setTimeout(() => setHint(''), 4000);
    }
  };

  const runPedagogicalInsert = (blockId) => {
    const { error } = insertKonvaPedagogicalBlock(blockId);
    if (error) {
      setPblockHint(error);
      window.setTimeout(() => setPblockHint(''), 3500);
      return;
    }
    setPblockHint('Bloc inséré sur la scène.');
    window.setTimeout(() => setPblockHint(''), 2500);
  };

  const applyPaletteToCanvas = useCallback((paletteId) => {
    useSmartboardKonvaStore.getState().applyCoursePaletteToCanvas(paletteId);
  }, []);

  const runExportWorkspaceJson = useCallback(() => {
    try {
      const payload = buildWorkspacePayloadFromStores();
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `liri-workspace-konva-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      setWorkspaceJsonHint('Workspace JSON (v1 Konva) téléchargé.');
      window.setTimeout(() => setWorkspaceJsonHint(''), 4000);
    } catch (e) {
      console.warn('[KonvaParityFeatureRoot] workspace JSON', e);
      setWorkspaceJsonHint('Export workspace impossible.');
      window.setTimeout(() => setWorkspaceJsonHint(''), 5000);
    }
  }, []);

  const runPdfExport = useCallback(async () => {
    const api = editorRef?.current;
    if (!api?.exportCanvasPdf) {
      setPdfHint('Éditeur non prêt.');
      window.setTimeout(() => setPdfHint(''), 4000);
      return;
    }
    setPdfBusy(true);
    setPdfHint('');
    try {
      const r = await api.exportCanvasPdf();
      if (r?.ok) {
        setPdfHint('PDF généré.');
      } else {
        setPdfHint(r?.error || 'Export PDF impossible.');
      }
    } catch (e) {
      console.warn('[KonvaParityFeatureRoot] PDF', e);
      setPdfHint('Export PDF impossible.');
    } finally {
      setPdfBusy(false);
      window.setTimeout(() => setPdfHint(''), 6000);
    }
  }, [editorRef]);

  const applyTypographyToCanvas = useCallback((typographyPresetId) => {
    try {
      const { updated } = useSmartboardKonvaStore
        .getState()
        .applyTypographyPresetGlobally(typographyPresetId);
      setThemeHint(
        updated > 0
          ? `Typographie appliquée à ${updated} bloc${updated > 1 ? 's' : ''} texte.`
          : 'Aucun bloc texte sur le projet — ajoutez du texte puis réessayez.',
      );
      window.setTimeout(() => setThemeHint(''), 4500);
    } catch (e) {
      console.warn('[KonvaParityFeatureRoot] typography', e);
      setThemeHint('Application typographie impossible.');
      window.setTimeout(() => setThemeHint(''), 5000);
    }
  }, []);

  return (
    <div
      data-konva-parity-root
      className={cn(
        'flex shrink-0 flex-col border-b border-[rgba(212,175,55,0.14)] bg-[#0a0c14]/95',
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.05] px-3 py-2">
        <span className="text-[9px] font-semibold uppercase tracking-[0.16em] text-white/40">Aperçu</span>
        {DESIGNER_PREVIEW_MODES.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setDesignerPreviewMode(m)}
            title={describeDesignerPreviewModeFr(m)}
            className={cn(
              'rounded-lg border px-2.5 py-1 text-[10px] font-medium transition-colors',
              designerPreviewMode === m
                ? 'border-[#D4AF37]/45 bg-[rgba(212,175,55,0.14)] text-[#f5dd8a]'
                : 'border-white/12 bg-white/[0.04] text-white/65 hover:bg-white/[0.08]',
            )}
          >
            {labelDesignerPreviewModeFr(m)}
          </button>
        ))}
      </div>
      <details className="group border-t border-white/[0.06]">
        <summary
          className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-left text-[10px] font-medium text-[#D4AF37]/85 transition-colors hover:bg-white/[0.03] [&::-webkit-details-marker]:hidden"
          aria-label="Ouvrir exports LIRI, thème et blocs pédagogiques"
        >
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[#D4AF37]/70 transition-transform group-open:rotate-180" />
          <span>
            Exports &amp; parité LIRI <span className="font-normal text-white/45">— PDF, scripts, thème, blocs</span>
          </span>
        </summary>
      <div className="max-h-[min(42vh,380px)] overflow-y-auto overflow-x-hidden border-t border-white/[0.04] [scrollbar-width:thin]">
      <div className="flex flex-wrap items-center gap-2 px-3 py-2">
        <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/40">
          Parité · exports texte
        </span>
        {(['prof', 'student', 'quiz', 'pack', 'flash']).map((k) => {
          const labels = {
            prof: 'Script prof',
            student: 'Élève',
            quiz: 'Quiz',
            pack: 'Pack plan',
            flash: 'Flashcards',
          };
          return (
            <button
              key={k}
              type="button"
              onClick={() => runExport(k)}
              className="inline-flex items-center gap-1 rounded-lg border border-white/12 bg-white/[0.05] px-2 py-1 text-[10px] text-white/80 hover:bg-white/[0.09]"
            >
              <FileText className="h-3 w-3 opacity-80" />
              {labels[k]}
            </button>
          );
        })}
        <span className="hidden h-4 w-px bg-white/15 sm:inline" aria-hidden />
        <button
          type="button"
          disabled={pdfBusy}
          onClick={() => void runPdfExport()}
          title="PDF — une page A4 paysage par scène Konva (raster)"
          className="inline-flex items-center gap-1 rounded-lg border border-cyan-500/25 bg-cyan-950/35 px-2 py-1 text-[10px] text-cyan-100/90 hover:bg-cyan-950/55 disabled:opacity-50"
        >
          {pdfBusy ? (
            <Loader2 className="h-3 w-3 animate-spin opacity-90" />
          ) : (
            <FileDown className="h-3 w-3 opacity-85" />
          )}
          PDF
        </button>
        <button
          type="button"
          onClick={runExportWorkspaceJson}
          title="Bundle workspace : konvaProject + Course Copilot (JSON v1)"
          className="inline-flex items-center gap-1 rounded-lg border border-violet-500/25 bg-violet-950/35 px-2 py-1 text-[10px] text-violet-100/90 hover:bg-violet-950/55"
        >
          <FileJson className="h-3 w-3 opacity-85" />
          Workspace JSON
        </button>
        {hint ? <span className="text-[10px] text-emerald-200/90">{hint}</span> : null}
        {pdfHint ? <span className="text-[10px] text-cyan-200/85">{pdfHint}</span> : null}
        {workspaceJsonHint ? (
          <span className="text-[10px] text-violet-200/85">{workspaceJsonHint}</span>
        ) : null}
      </div>
      <div
        className={cn(
          'border-t border-white/[0.06] px-3 pb-3 pt-2',
          isMinimalPreview && 'hidden',
        )}
      >
        <p className="mb-1.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-white/40">
          Parité · thème du cours
        </p>
        <SmartboardCourseThemeSection
          className="!px-0 !pb-0"
          onApplyPalette={applyPaletteToCanvas}
          onApplyTypography={applyTypographyToCanvas}
        />
        {themeHint ? (
          <p className="mt-1.5 text-[9px] text-emerald-200/85">{themeHint}</p>
        ) : null}
      </div>
      <div
        className={cn(
          'flex flex-wrap items-start gap-2 border-t border-white/[0.06] px-3 py-2',
          isMinimalPreview && 'hidden',
        )}
      >
        <span className="mt-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-white/40">
          Parité · blocs pédago
        </span>
        <div className="flex flex-1 flex-wrap gap-1.5">
          {PEDAGOGICAL_BLOCK_CATALOG.map((b) => (
            <button
              key={b.id}
              type="button"
              title={b.hint}
              onClick={() => runPedagogicalInsert(b.id)}
              className="inline-flex max-w-[11rem] items-center gap-1 rounded-md border border-[#D4AF37]/25 bg-[#1a1510]/80 px-2 py-1 text-left text-[10px] leading-tight text-[#e9bf72]/95 hover:bg-[#2a2218]/90"
            >
              <LayoutGrid className="h-3 w-3 shrink-0 opacity-75" />
              <span className="truncate">{b.label}</span>
            </button>
          ))}
        </div>
        {pblockHint ? (
          <span className="text-[10px] text-emerald-200/85">{pblockHint}</span>
        ) : null}
      </div>
      </div>
      </details>
    </div>
  );
}
