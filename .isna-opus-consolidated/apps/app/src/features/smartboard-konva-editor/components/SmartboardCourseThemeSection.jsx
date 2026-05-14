import React from 'react';
import { cn } from '@/lib/utils';
import {
  COURSE_THEME_PALETTES,
  COURSE_THEME_PRESETS,
  COURSE_TYPO_PRESETS,
  labelCourseThemePresetFr,
  labelImageStyleFr,
  normalizeCourseThemePreset,
  normalizeImageStyle,
} from '../lib/liriCourseTheme';
import { useCourseCopilotStore } from '../store/useCourseCopilotStore';

/**
 * Paramètres de thème global du cours (Module 4) — persistés dans le workspace.
 * @param {{ className?: string; onApplyPalette?: (paletteId: string) => void; onApplyTypography?: (typographyPresetId: string) => void }} props
 */
export default function SmartboardCourseThemeSection({
  className,
  onApplyPalette,
  onApplyTypography,
}) {
  const courseTheme = useCourseCopilotStore((s) => s.courseTheme);
  const setCourseTheme = useCourseCopilotStore((s) => s.setCourseTheme);

  return (
    <div className={cn('space-y-2 px-3 pb-3', className)}>
      <label className="block text-[8px] font-medium uppercase tracking-wider text-white/40">Style du parcours</label>
      <select
        value={courseTheme.preset}
        onChange={(e) => setCourseTheme({ preset: normalizeCourseThemePreset(e.target.value) })}
        className="w-full rounded-lg border border-[rgba(212,175,55,0.22)] bg-[#0d1428]/90 py-1.5 pl-2 text-[10px] text-white"
      >
        {COURSE_THEME_PRESETS.map((p) => (
          <option key={p} value={p}>
            {labelCourseThemePresetFr(p)}
          </option>
        ))}
      </select>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div>
          <label className="mb-0.5 block text-[8px] text-white/38">Palette</label>
          <select
            value={courseTheme.paletteId}
            onChange={(e) => {
              const id = e.target.value;
              setCourseTheme({ paletteId: id });
              onApplyPalette?.(id);
            }}
            className="w-full rounded border border-white/12 bg-black/45 py-1 pl-1.5 text-[9px] text-white"
          >
            {COURSE_THEME_PALETTES.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-0.5 block text-[8px] text-white/38">Typographie</label>
          <select
            value={courseTheme.typographyPreset}
            onChange={(e) => {
              const v = e.target.value;
              setCourseTheme({ typographyPreset: v });
              onApplyTypography?.(v);
            }}
            className="w-full rounded border border-white/12 bg-black/45 py-1 pl-1.5 text-[9px] text-white"
          >
            {COURSE_TYPO_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="mb-0.5 block text-[8px] text-white/38">Type d’images privilégié</label>
        <select
          value={courseTheme.imageStyle}
          onChange={(e) => setCourseTheme({ imageStyle: normalizeImageStyle(e.target.value) })}
          className="w-full rounded border border-white/12 bg-black/45 py-1 pl-1.5 text-[9px] text-white"
        >
          {(['photo', 'illustration', 'diagram', 'mixed']).map((k) => (
            <option key={k} value={k}>
              {labelImageStyleFr(normalizeImageStyle(k))}
            </option>
          ))}
        </select>
      </div>

      <p className="text-[8px] leading-relaxed text-white/32">
        La <span className="text-white/45">palette</span> met à jour le fond du canvas Konva. Le préréglage{' '}
        <span className="text-white/45">typographie</span> s’applique aux blocs texte de toutes les scènes.
      </p>
    </div>
  );
}
