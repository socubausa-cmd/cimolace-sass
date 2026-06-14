import React from 'react';
import { cn } from '@/lib/utils';

const LABELS = {
  lisibilite: 'Lisibilité',
  clarte: 'Clarté',
  densite: 'Densité',
  impactVisuel: 'Impact visuel',
  memorisation: 'Mémorisation',
  coherencePedagogique: 'Cohérence pédagogique',
};

const INDICATOR_KEYS = /** @type {(keyof typeof LABELS)[]} */ ([
  'lisibilite',
  'clarte',
  'densite',
  'impactVisuel',
  'memorisation',
  'coherencePedagogique',
]);

/**
 * @param {{ value: number; className?: string }} props
 */
function IndicatorBar({ value, className }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className={cn('h-1.5 w-full overflow-hidden rounded-full bg-white/[0.08]', className)}>
      <div
        className="h-full rounded-full bg-gradient-to-r from-[#7d89b0]/90 to-[color-mix(in_srgb,var(--school-accent)_95%,transparent)] transition-[width] duration-300"
        style={{ width: `${v}%` }}
      />
    </div>
  );
}

/**
 * Détail des 6 indicateurs — slide actif (canvas partagé, partie script par fiche).
 * @param {{ quality: import('../lib/computeSmartboardQualityScore').SmartboardQualityResult; className?: string }} props
 */
export default function SmartboardQualityBreakdown({ quality, className }) {
  const ind = quality.indicators;

  return (
    <div className={cn('space-y-2.5', className)}>
      {INDICATOR_KEYS.map((key) => (
        <div key={key}>
          <div className="mb-0.5 flex items-center justify-between gap-2 text-[9px]">
            <span className="text-white/55">{LABELS[key]}</span>
            <span className="font-mono text-[#e9bf72]/95">{ind[key]}</span>
          </div>
          <IndicatorBar value={ind[key]} />
        </div>
      ))}
      {quality.hints?.length ? (
        <ul className="mt-2 space-y-1 border-t border-white/[0.07] pt-2 text-[8px] leading-relaxed text-white/42">
          {quality.hints.map((h, i) => (
            <li key={i}>· {h}</li>
          ))}
        </ul>
      ) : null}
      <p className="text-[8px] text-white/28">
        Canvas : {quality.elementCount} objet(s), {quality.textChars} car. texte — score partagé entre les fiches
        (sauf mémorisation / cohérence par script).
      </p>
    </div>
  );
}
