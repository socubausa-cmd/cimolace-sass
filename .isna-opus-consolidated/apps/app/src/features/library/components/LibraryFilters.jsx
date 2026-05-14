/**
 * LibraryFilters — filtres type / thème / compatibilité / source + recherche.
 */
import React from 'react';
import { Search, X, Filter } from 'lucide-react';
import { cn } from '@/lib/utils';

const CATEGORIES = [
  { id: 'all', label: 'Tout' },
  { id: 'image', label: 'Images' },
  { id: 'vector', label: 'Vecteurs' },
  { id: 'lut', label: 'LUT' },
  { id: 'template', label: 'Templates' },
  { id: 'project', label: 'Projets' },
];

const THEMES = [
  { id: 'all', label: 'Tous thèmes' },
  { id: 'education', label: 'Éducation' },
  { id: 'science', label: 'Science' },
  { id: 'spiritual', label: 'Spirituel' },
  { id: 'business', label: 'Business' },
  { id: 'art', label: 'Art' },
  { id: 'technology', label: 'Tech' },
  { id: 'nature', label: 'Nature' },
  { id: 'history', label: 'Histoire' },
];

const COMPAT = [
  { id: 'all', label: 'Tout' },
  { id: 100, label: '100% ✓' },
  { id: 70, label: '70% ~' },
  { id: 30, label: '30% !' },
];

const SOURCES = [
  { id: 'all', label: 'Tous' },
  { id: 'personal', label: 'Personnel' },
  { id: 'community', label: 'Communauté' },
];

function ChipGroup({ options, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-1">
      {options.map((opt) => (
        <button
          key={opt.id}
          onClick={() => onChange(opt.id)}
          className={cn(
            'rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors',
            value === opt.id
              ? 'border-[#D4AF37]/50 bg-[#D4AF37]/15 text-[#D4AF37]'
              : 'border-white/10 text-white/45 hover:border-white/20 hover:text-white/70',
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export default function LibraryFilters({ filters, onFilter, onReset, stats }) {
  const hasActiveFilters =
    filters.category !== 'all' ||
    filters.theme !== 'all' ||
    filters.compatibility !== 'all' ||
    filters.source !== 'all' ||
    filters.search !== '';

  return (
    <div className="flex flex-col gap-3 border-b border-white/8 p-3">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/30" />
        <input
          value={filters.search}
          onChange={(e) => onFilter('search', e.target.value)}
          placeholder="Rechercher..."
          className="w-full rounded-lg border border-white/10 bg-white/[0.04] py-2 pl-8 pr-3 text-[12px] text-white/80 placeholder-white/25 outline-none focus:border-[#D4AF37]/30"
        />
        {filters.search && (
          <button
            onClick={() => onFilter('search', '')}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Category chips */}
      <div className="flex flex-col gap-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-white/30">Type</span>
        <ChipGroup options={CATEGORIES} value={filters.category} onChange={(v) => onFilter('category', v)} />
      </div>

      {/* Source */}
      <div className="flex items-center gap-3">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-white/30">Source</span>
        <ChipGroup options={SOURCES} value={filters.source} onChange={(v) => onFilter('source', v)} />
      </div>

      {/* Compatibility */}
      <div className="flex items-center gap-3">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-white/30">Compat.</span>
        <ChipGroup options={COMPAT} value={filters.compatibility} onChange={(v) => onFilter('compatibility', v)} />
      </div>

      {/* Theme */}
      <div className="flex flex-col gap-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-white/30">Thème</span>
        <ChipGroup options={THEMES} value={filters.theme} onChange={(v) => onFilter('theme', v)} />
      </div>

      {/* Stats + reset */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-white/30">
          {stats?.total ?? 0} résultat(s) — {stats?.personal ?? 0} perso · {stats?.community ?? 0} communauté
        </span>
        {hasActiveFilters && (
          <button onClick={onReset} className="flex items-center gap-1 text-[10px] text-[#D4AF37]/60 hover:text-[#D4AF37]">
            <X className="h-3 w-3" />
            Reset
          </button>
        )}
      </div>
    </div>
  );
}
