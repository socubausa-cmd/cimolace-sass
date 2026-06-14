import React from 'react';
import { cn } from '@/lib/utils';
import CourseStructureColumn from './CourseStructureColumn';
import CourseSlideCoachColumn from './CourseSlideCoachColumn';

/**
 * Panneau Copilot complet (structure + coach) en une seule colonne défilante.
 * L'éditeur principal utilise les colonnes séparément pour le layout premium.
 */
export default function CourseCopilotPanel({ className }) {
  return (
    <div
      className={cn(
        'flex w-[min(100%,400px)] shrink-0 flex-col gap-3 overflow-y-auto rounded-2xl border border-[color-mix(in_srgb,var(--school-accent)_20%,transparent)] bg-[#060a12] p-2 [scrollbar-width:thin]',
        className,
      )}
    >
      <CourseStructureColumn embedded />
      <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      <CourseSlideCoachColumn embedded />
    </div>
  );
}
