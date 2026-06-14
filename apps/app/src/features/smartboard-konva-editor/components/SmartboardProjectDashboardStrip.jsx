import React from 'react';
import { BarChart3, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { labelCourseThemePresetFr } from '../lib/liriCourseTheme';
import { useCourseCopilotStore } from '../store/useCourseCopilotStore';
import SmartboardQualityBreakdown from './SmartboardQualityBreakdown';
import SmartboardValidationChecklist from './SmartboardValidationChecklist';
import {
  countValidationChecked,
  DEFAULT_VALIDATION_CHECKLIST,
} from '../lib/liriValidationChecklist';
import { sumSlideTimingMinutes } from '../lib/liriSlideTiming';

/** @param {'faible'|'moyen'|'bon'|'excellent'} band */
function qualityChipClass(band) {
  switch (band) {
    case 'faible':
      return 'border-red-500/35 bg-red-950/35 text-red-200/95';
    case 'moyen':
      return 'border-amber-500/35 bg-amber-950/30 text-amber-100/95';
    case 'bon':
      return 'border-emerald-500/30 bg-emerald-950/25 text-emerald-100/95';
    case 'excellent':
      return 'border-[color-mix(in_srgb,var(--school-accent)_40%,transparent)] bg-[#1a1810] text-[#f5dd8a]';
    default:
      return 'border-white/8 bg-white/[0.03] text-white/38';
  }
}

function labelComplexityFr(c) {
  switch (c) {
    case 'debutant':
      return 'Débutant';
    case 'intermediaire':
      return 'Intermédiaire';
    case 'avance':
      return 'Avancé';
    default:
      return c || '—';
  }
}

/**
 * Tableau de bord projet (Module 14) + score qualité (Module 2).
 * @param {{ className?: string; quality?: import('../lib/computeSmartboardQualityScore').SmartboardQualityResult | null }} props
 */
export default function SmartboardProjectDashboardStrip({ className, quality = null }) {
  const course = useCourseCopilotStore((s) => s.course);
  const activeSlideIndex = useCourseCopilotStore((s) => s.activeSlideIndex);
  const courseTheme = useCourseCopilotStore((s) => s.courseTheme);
  const validationChecklist = useCourseCopilotStore((s) => s.validationChecklist);
  const slideTimingMinutes = useCourseCopilotStore((s) => s.slideTimingMinutes);
  const designerPreviewMode = useCourseCopilotStore((s) => s.designerPreviewMode);

  if (!course) return null;

  if (designerPreviewMode === 'student' || designerPreviewMode === 'live') return null;

  const validationDone = countValidationChecked(validationChecklist);
  const validationTotal = Object.keys(DEFAULT_VALIDATION_CHECKLIST).length;

  const slideCount = course.slides?.length ?? 0;
  const pos = slideCount > 0 ? Math.min(activeSlideIndex + 1, slideCount) : 0;
  const duration = course.analysis?.estimatedDurationMinutes ?? '—';
  const planTimingSum = sumSlideTimingMinutes(slideTimingMinutes);
  const rec = Number(course.analysis?.estimatedDurationMinutes);
  const timingMismatch =
    Number.isFinite(rec) && rec > 0 && Math.abs(planTimingSum - rec) > 0.51;

  return (
    <div
      className={cn(
        'shrink-0 border-b border-[rgba(251,191,36,0.1)] bg-gradient-to-r from-[#12101c] via-[#0c0e18] to-[#080a10]',
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[rgba(212,175,55,0.2)] bg-[rgba(212,175,55,0.07)]">
          <Sparkles className="h-4 w-4 text-[#f5dd8a]" />
        </span>
        <div className="min-w-0">
          <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-[#7d89b0]">
            Projet & progression
          </p>
          <p className="truncate text-[13px] font-semibold tracking-tight text-white">{course.title}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span
          className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] text-white/75"
          title="Durée recommandée (analyse Copilot)"
        >
          <BarChart3 className="h-3 w-3 text-white/45" strokeWidth={2} />
          Reco. {duration} min
        </span>
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[10px]',
            timingMismatch
              ? 'border-amber-500/35 bg-amber-950/30 text-amber-100/95'
              : 'border-white/10 bg-white/[0.04] text-white/75',
          )}
          title="Somme des durées par fiche (plan) — ajuster dans le filmstrip"
        >
          Plan Σ {planTimingSum ? `${Math.round(planTimingSum * 10) / 10}` : '—'} min
        </span>
        <span className="rounded-lg border border-[color-mix(in_srgb,var(--school-accent)_28%,transparent)] bg-[#1a1510] px-3 py-1 text-[10px] font-medium text-[#f5dd8a]">
          {slideCount} fiche{slideCount > 1 ? 's' : ''} (plan)
        </span>
        <span
          className="rounded-lg border border-cyan-500/22 bg-cyan-950/25 px-2.5 py-1 text-[10px] text-cyan-100/90"
          title="Position dans le parcours Copilot"
        >
          {slideCount === 0 ? 'Parcours : —' : `Actif ${pos}/${slideCount}`}
        </span>
        <span className="rounded-lg border border-white/10 bg-black/35 px-2.5 py-1 text-[10px] text-white/55">
          Niveau : {labelComplexityFr(course.analysis?.complexity)}
        </span>
        <span
          className="max-w-[140px] truncate rounded-lg border border-violet-500/20 bg-violet-950/20 px-2.5 py-1 text-[10px] text-violet-100/90"
          title="Thème visuel du cours"
        >
          Thème : {labelCourseThemePresetFr(courseTheme.preset)}
        </span>
        <span
          className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] text-white/70"
          title="Cases cochées — voir section checklist ci-dessous"
        >
          Validation : {validationDone}/{validationTotal}
        </span>
        {quality ? (
          <span
            className={cn(
              'max-w-[200px] truncate rounded-lg border px-2.5 py-1 text-[10px] font-medium',
              qualityChipClass(quality.band),
            )}
            title={
              quality.hints?.length
                ? `${quality.score}/100 — ${quality.hints.join(' ')}`
                : `Score ${quality.score}/100 (heuristique locale)`
            }
          >
            Qualité : {quality.labelFr}{' '}
            <span className="font-mono opacity-90">({quality.score})</span>
          </span>
        ) : (
          <span
            className="rounded-lg border border-white/8 bg-white/[0.03] px-2.5 py-1 text-[10px] text-white/38"
            title="Score indisponible"
          >
            Qualité : —
          </span>
        )}
      </div>
      </div>
      {quality ? (
        <details className="group border-t border-white/[0.06] bg-[#080a12]/95 px-4 py-2">
          <summary className="cursor-pointer list-none text-[9px] font-medium text-[color-mix(in_srgb,var(--school-accent)_85%,transparent)] marker:content-none [&::-webkit-details-marker]:hidden">
            <span className="underline-offset-2 group-open:underline">Détail qualité — slide actif</span>
            <span className="ml-2 text-white/35">({quality.score}/100)</span>
          </summary>
          <div className="mt-2 max-w-lg pb-1">
            <SmartboardQualityBreakdown quality={quality} />
          </div>
        </details>
      ) : null}
      <details className="group border-t border-white/[0.06] bg-[#080a12]/95 px-4 py-2">
        <summary className="cursor-pointer list-none text-[9px] font-medium text-[color-mix(in_srgb,var(--school-accent)_85%,transparent)] marker:content-none [&::-webkit-details-marker]:hidden">
          <span className="underline-offset-2 group-open:underline">Checklist validation finale</span>
          <span className="ml-2 text-white/35">
            ({validationDone}/{validationTotal})
          </span>
        </summary>
        <div className="mt-2 max-w-lg pb-1">
          <SmartboardValidationChecklist />
        </div>
      </details>
    </div>
  );
}
