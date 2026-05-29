import React from 'react';
import { Atom, Star } from 'lucide-react';
import { ECOLES_SCIENCE_COLOR_PALETTE, ECOLES_SCIENCE_ICONS } from '@/data/ecoles21SciencesData';

/**
 * Carte d'une des 21 sciences (page web /ecoles + vitrine mobile).
 */
export function Ecoles21SciencesScienceCard({ science }) {
  const idx = science.number - 1;
  const palette = ECOLES_SCIENCE_COLOR_PALETTE[idx] || ECOLES_SCIENCE_COLOR_PALETTE[0];
  const Icon = ECOLES_SCIENCE_ICONS[idx] || Atom;
  return (
    <div
      className={`group relative bg-gradient-to-br ${palette.color} border ${palette.border} rounded-2xl p-5 md:p-6 transition-all duration-500 hover:scale-[1.02] hover:shadow-2xl hover:shadow-black/30`}
    >
      <div className="absolute -top-3 -left-3">
        <div className={`w-9 h-9 rounded-lg ${palette.bg} border ${palette.border} flex items-center justify-center`}>
          <span className={`text-sm font-bold ${palette.accent}`}>{science.number}</span>
        </div>
      </div>
      <div className="flex items-start gap-3 mb-4 mt-1">
        <div className={`p-2.5 rounded-xl ${palette.bg} shrink-0`}>
          <Icon className={`w-5 h-5 ${palette.accent}`} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-base md:text-lg font-serif font-bold text-white leading-tight">{science.name}</h3>
          <p className={`text-sm ${palette.accent} font-medium mt-0.5`}>{science.subtitle}</p>
        </div>
      </div>
      <ul className="space-y-1.5 mb-4">
        {science.content.map((item, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-gray-300 leading-relaxed">
            <span className={`${palette.accent} mt-0.5 shrink-0 text-xs`}>&#9670;</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
      <div className={`${palette.bg} border ${palette.border} rounded-xl p-3`}>
        <div className="flex items-start gap-2">
          <Star className={`w-4 h-4 ${palette.accent} shrink-0 mt-0.5`} />
          <p className="text-sm text-white font-medium">{science.objective}</p>
        </div>
      </div>
    </div>
  );
}
