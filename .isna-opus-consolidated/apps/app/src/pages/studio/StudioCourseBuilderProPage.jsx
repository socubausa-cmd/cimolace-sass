/**
 * StudioCourseBuilderProPage — Course Builder LIRI Pro.
 * Architecture : useCourseBuilderStore + CourseTreePanel + SegmentEditor.
 * Route : /studio/course-builder-pro
 */
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ChevronLeft, BookOpen, Layers, FileText, Sparkles, ArrowRight,
  CheckCircle, AlertTriangle, Loader2, RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCourseBuilderStore } from '@/stores/course-builder.store';
import { useCourseBuilder } from '@/features/course-builder/hooks/useCourseBuilder';
import CourseTreePanel from '@/features/course-builder/components/CourseTreePanel';
import SegmentEditor from '@/features/course-builder/components/SegmentEditor';
import SubchapterEditor from '@/features/course-builder/components/SubchapterEditor';
import { ROUTES } from '@/lib/constants';

// ── Init modal ───────────────────────────────────────────────────────────────

function InitModal({ onInit }) {
  const [title, setTitle] = useState('');
  const [theme, setTheme] = useState('');
  const [prompt, setPrompt] = useState('');
  const initCourse = useCourseBuilderStore((s) => s.initCourse);
  const { generateCourseBlueprint } = useCourseBuilder();
  const [generating, setGenerating] = useState(false);

  const handleManual = () => {
    if (!title.trim()) return;
    initCourse(title.trim(), theme.trim());
    onInit();
  };

  const handleAI = async () => {
    if (!title.trim()) return;
    initCourse(title.trim(), theme.trim());
    setGenerating(true);
    await generateCourseBlueprint(prompt || title);
    setGenerating(false);
    onInit();
  };

  return (
    <div className="flex flex-col items-center justify-center h-full p-8">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0d1020] p-6 shadow-2xl">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#D4AF37]/15">
            <BookOpen className="h-5 w-5 text-[#D4AF37]" />
          </div>
          <div>
            <h2 className="text-[15px] font-bold text-white">Nouveau cours</h2>
            <p className="text-[12px] text-white/40">Course Builder LIRI Pro</p>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <div>
            <label className="mb-1 block text-[11px] text-white/40 uppercase tracking-wider">Titre du cours *</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Introduction à la physique quantique"
              className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-[13px] text-white placeholder-white/25 outline-none focus:border-[#D4AF37]/40"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] text-white/40 uppercase tracking-wider">Thème / matière</label>
            <input
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              placeholder="Ex: Sciences, Mathématiques, Histoire..."
              className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-[13px] text-white placeholder-white/25 outline-none focus:border-[#D4AF37]/40"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] text-white/40 uppercase tracking-wider">Prompt IA (optionnel)</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
              placeholder="Décrivez le niveau, le public, les objectifs..."
              className="w-full resize-none rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-[13px] text-white placeholder-white/25 outline-none focus:border-[#D4AF37]/40"
            />
          </div>

          <div className="flex gap-2 pt-1">
            <button
              disabled={!title.trim()}
              onClick={handleManual}
              className="flex-1 rounded-lg border border-white/15 py-2 text-[12px] text-white/70 transition-colors hover:border-white/25 hover:text-white disabled:opacity-40"
            >
              Manuel
            </button>
            <button
              disabled={!title.trim() || generating}
              onClick={handleAI}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#D4AF37] py-2 text-[12px] font-semibold text-black transition-colors hover:bg-[#e5c448] disabled:opacity-40"
            >
              {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              Générer avec LIRI
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Validation bar ────────────────────────────────────────────────────────────

function ValidationBar({ onSendToSmartboard }) {
  const validationResult = useCourseBuilderStore((s) => s.validationResult);
  const validationStatus = useCourseBuilderStore((s) => s.validationStatus);
  const validateCourse = useCourseBuilderStore((s) => s.validateCourse);

  const statusColor = validationStatus === 'valid' ? 'text-emerald-400' : validationStatus === 'invalid' ? 'text-red-400' : 'text-white/40';

  return (
    <div className="flex shrink-0 items-center gap-3 border-t border-white/8 bg-[#080a12] px-4 py-2.5">
      <button
        onClick={validateCourse}
        className="flex items-center gap-1.5 rounded-md border border-white/15 px-3 py-1.5 text-[11px] text-white/60 hover:border-white/25 hover:text-white"
      >
        <RefreshCw className="h-3 w-3" />
        Valider
      </button>

      {validationResult && (
        <div className={cn('flex items-center gap-1.5 text-[11px]', statusColor)}>
          {validationStatus === 'valid'
            ? <CheckCircle className="h-3.5 w-3.5" />
            : <AlertTriangle className="h-3.5 w-3.5" />
          }
          Score : {validationResult.score}/100
          {validationResult.errors.length > 0 && ` · ${validationResult.errors.length} erreur(s)`}
          {validationResult.warnings.length > 0 && ` · ${validationResult.warnings.length} avert.`}
        </div>
      )}

      <button
        onClick={onSendToSmartboard}
        className="ml-auto flex items-center gap-1.5 rounded-lg bg-[#D4AF37] px-3 py-1.5 text-[12px] font-semibold text-black transition-colors hover:bg-[#e5c448]"
      >
        Envoyer au Designer
        <ArrowRight className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function StudioCourseBuilderProPage() {
  const navigate = useNavigate();
  const courseDraft = useCourseBuilderStore((s) => s.courseDraft);
  const activeSegmentId = useCourseBuilderStore((s) => s.activeSegmentId);
  const activeSubchapterId = useCourseBuilderStore((s) => s.activeSubchapterId);
  const { sendToSmartboard, totalSubchapters, totalSegments } = useCourseBuilder();
  const [showInit, setShowInit] = useState(!courseDraft);

  const handleSend = () => {
    const ok = sendToSmartboard();
    if (ok) navigate(ROUTES.smartboard);
  };

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-[#05070c] text-white">
      {/* Header */}
      <div className="flex shrink-0 items-center gap-3 border-b border-white/8 bg-[#080a12] px-4 py-2.5">
        <Link
          to="/studio"
          className="flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-[11px] text-white/60 hover:border-[#D4AF37]/30 hover:text-[#D4AF37]"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Studio
        </Link>
        <div className="h-5 w-px bg-white/10" />
        <BookOpen className="h-4 w-4 text-[#D4AF37]" />
        <h1 className="text-[14px] font-bold text-white">Course Builder Pro</h1>
        {courseDraft && (
          <span className="text-[12px] text-white/40">
            {totalSubchapters} sous-chap · {totalSegments} segments
          </span>
        )}
        {courseDraft && (
          <button
            onClick={() => setShowInit(true)}
            className="ml-auto text-[11px] text-white/30 underline underline-offset-2 hover:text-white/60"
          >
            Nouveau cours
          </button>
        )}
      </div>

      {/* Body */}
      {showInit && !courseDraft ? (
        <InitModal onInit={() => setShowInit(false)} />
      ) : (
        <div className="flex min-h-0 flex-1">
          {/* Left — tree */}
          <div className="flex w-64 shrink-0 flex-col overflow-y-auto border-r border-white/8">
            <CourseTreePanel />
          </div>

          {/* Right — editor */}
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="flex min-h-0 flex-1 overflow-hidden">
              {activeSegmentId ? (
                <SegmentEditor />
              ) : activeSubchapterId ? (
                <SubchapterEditor />
              ) : (
                <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center p-8">
                  <Layers className="h-10 w-10 text-white/15" />
                  <p className="text-[13px] text-white/40">
                    Sélectionnez un élément dans l'arbre pour l'éditer.
                  </p>
                  <p className="text-[12px] text-white/25">
                    Chapitres → Sous-chapitres → Segments
                  </p>
                </div>
              )}
            </div>
            <ValidationBar onSendToSmartboard={handleSend} />
          </div>
        </div>
      )}
    </div>
  );
}
