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
import useTenantBranding from '@/hooks/useTenantBranding';

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

  /**
   * Carte de la modale : le fond 0d1020 était un navy froid ÉCRIT EN DUR — pas un
   * repli, donc appliqué en toutes circonstances, coque du portail comprise. Il passe
   * sur #1f1e1c, le ton « bloc/aperçu » de la charte : plus sombre que la page
   * (#262624), la carte se détache toujours, mais du côté chaud.
   * Conséquence à assumer : #1f1e1c est un poil plus clair que l'ancien navy, donc les
   * encres à faible alpha (labels et placeholders à 40 % / 25 %, déjà sous la norme à
   * 3,83:1 et 2,22:1 AVANT cette passe) devaient monter. Elles passent à l'encre de la
   * charte : 65 % pour les labels (7,08:1) et 55 % pour les placeholders (5,49:1).
   */
  return (
    <div className="flex flex-col items-center justify-center h-full p-8">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#1f1e1c] p-6 shadow-2xl">
        <div className="mb-5 flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl"
            style={{ backgroundColor: 'color-mix(in srgb, var(--school-accent, #d99a4e) 15%, transparent)' }}
          >
            <BookOpen className="h-5 w-5 text-[var(--school-accent,#d99a4e)]" />
          </div>
          <div>
            <h2 className="text-[15px] font-bold text-white">Nouveau cours</h2>
            <p className="text-[12px] text-[#f5f4ee]/65">Course Builder LIRI Pro</p>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <div>
            <label className="mb-1 block text-[11px] text-[#f5f4ee]/65 uppercase tracking-wider">Titre du cours *</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Introduction à la physique quantique"
              className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-[13px] text-white placeholder-[#f5f4ee]/55 outline-none focus:border-[color:var(--school-accent,#d99a4e)]"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] text-[#f5f4ee]/65 uppercase tracking-wider">Thème / matière</label>
            <input
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              placeholder="Ex: Sciences, Mathématiques, Histoire..."
              className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-[13px] text-white placeholder-[#f5f4ee]/55 outline-none focus:border-[color:var(--school-accent,#d99a4e)]"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] text-[#f5f4ee]/65 uppercase tracking-wider">Prompt IA (optionnel)</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
              placeholder="Décrivez le niveau, le public, les objectifs..."
              className="w-full resize-none rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-[13px] text-white placeholder-[#f5f4ee]/55 outline-none focus:border-[color:var(--school-accent,#d99a4e)]"
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
              /* Aplat d'accent : l'encre reste NOIRE, comme l'exige un aplat chaud
                 (noir sur corail #d97757 = 6,73:1, sur or #d99a4e = 8,68:1 ;
                 du blanc y tomberait à 3,12:1). */
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-[12px] font-semibold text-black transition-colors hover:brightness-110 disabled:opacity-40"
              style={{ background: 'var(--school-accent, #d99a4e)' }}
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

  /**
   * Statut de validation : les deux couleurs PORTENT le sens (validé / en erreur),
   * donc on les prend dans la rampe de la charte plutôt que dans la palette Tailwind.
   *   valide  → olive #8fbf7a, la teinte « succès/validé » (7,85:1 sur #1f1e1c) ;
   *   invalide→ alerte #f28a74 (6,87:1) — l'ancien rouge Tailwind #f87171 était plus
   *             froid et plus criard sans mieux contraster.
   * L'état neutre reste une encre atténuée, mais montée à 60 % : à 40 % il tombait
   * à 3,56:1, sous la norme pour un texte de 11 px.
   */
  const statusColor = validationStatus === 'valid'
    ? 'text-[#8fbf7a]'
    : validationStatus === 'invalid'
      ? 'text-[#f28a74]'
      : 'text-[#f5f4ee]/60';

  return (
    /* L'ancien fond 080a12 : navy froid écrit en dur (toujours appliqué, pas un repli).
       → #1f1e1c, le ton « bloc » de la charte : la barre reste plus sombre que le
       corps de page #262624, mais du côté chaud. */
    <div className="flex shrink-0 items-center gap-3 border-t border-white/10 bg-[#1f1e1c] px-4 py-2.5">
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
        /* Aplat d'accent → encre NOIRE conservée (cf. commentaire de la modale). */
        className="ml-auto flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold text-black transition-colors hover:brightness-110"
        style={{ background: 'var(--school-accent, #d99a4e)' }}
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
  const { branding, cssVars, shellTheme } = useTenantBranding();
  const courseDraft = useCourseBuilderStore((s) => s.courseDraft);
  const activeSegmentId = useCourseBuilderStore((s) => s.activeSegmentId);
  const activeSubchapterId = useCourseBuilderStore((s) => s.activeSubchapterId);
  const { sendToSmartboard, totalSubchapters, totalSegments } = useCourseBuilder();
  const [showInit, setShowInit] = useState(!courseDraft);

  const handleSend = () => {
    const ok = sendToSmartboard();
    if (ok) navigate(ROUTES.smartboard);
  };

  /**
   * REPLI DE FOND — le même piège que dans StudioFormationPage, et il est atteint.
   * `--school-accent` a bien une déclaration au :root (index.css), donc ses replis
   * sont du code mort ; `--school-background`, elle, n'en a AUCUNE. Elle n'existe que
   * si `cssVars` (useTenantBranding) la pose sur cette racine, ou si la page est
   * montée dans la coque du portail (studioWarm.css la force alors à #262624).
   * Hors coque et sans branding tenant, le repli s'appliquait littéralement : 05070c,
   * un quasi-noir bleuté banni par la charte, sur toute la hauteur (h-[100dvh]).
   * → base chaude #262624.
   */
  return (
    <div
      className="flex h-[100dvh] flex-col overflow-hidden text-white"
      data-school-shell="course-builder"
      data-tenant-brand={branding.slug}
      style={{
        ...cssVars,
        background: 'var(--school-background, #262624)',
        fontFamily: 'var(--school-font-family, Inter, sans-serif)',
      }}
    >
      {/* Header */}
      <div
        className="flex shrink-0 items-center gap-3 border-b border-white/10 px-4 py-2.5"
        style={{ background: shellTheme.topBarBackground }}
      >
        <Link
          to="/studio"
          className="flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-[11px] text-white/60 hover:border-[color:var(--school-accent,#d99a4e)] hover:text-[var(--school-accent,#d99a4e)]"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Studio
        </Link>
        <div className="h-5 w-px bg-white/10" />
        <BookOpen className="h-4 w-4 text-[var(--school-accent,#d99a4e)]" />
        <h1 className="text-[14px] font-bold text-white">Course Builder Pro</h1>
        {courseDraft && (
          /* 40 % = 3,5:1 sur une topbar sombre : sous la norme pour du 12 px. → 65 %. */
          <span className="text-[12px] text-[#f5f4ee]/65">
            {totalSubchapters} sous-chap · {totalSegments} segments
          </span>
        )}
        {courseDraft && (
          <button
            onClick={() => setShowInit(true)}
            /* Commande réelle (rouvre la modale) laissée à 30 % ≈ 2,4:1 : illisible.
               → 70 %, et l'état survolé passe à l'encre pleine. */
            className="ml-auto text-[11px] text-[#f5f4ee]/70 underline underline-offset-2 hover:text-[#f5f4ee]"
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
          <div className="flex w-64 shrink-0 flex-col overflow-y-auto border-r border-white/10">
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
                  {/* Icône purement décorative (le texte dit tout) : laissée en filigrane. */}
                  <Layers className="h-10 w-10 text-white/15" />
                  {/* Consignes de l'état vide : 40 % ≈ 3,4:1 et 25 % ≈ 2,1:1 sur #262624,
                      toutes deux sous la norme. → encre de la charte à 80 % et 65 %. */}
                  <p className="text-[13px] text-[#f5f4ee]/80">
                    Sélectionnez un élément dans l'arbre pour l\'éditer.
                  </p>
                  <p className="text-[12px] text-[#f5f4ee]/65">
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
