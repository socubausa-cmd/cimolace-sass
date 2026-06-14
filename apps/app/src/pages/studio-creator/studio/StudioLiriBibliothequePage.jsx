/**
 * StudioLiriBibliothequePage — Bibliothèque communautaire LIRI
 * Route : /studio/liri/bibliotheque
 *
 * 3 colonnes : Filtres | Grille d'assets | Détail
 */

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Library, Search, SlidersHorizontal, Grid3X3, List,
  Star, Heart, Download, Upload, BookOpen, Layers,
  FileText, Image, Film, Package, ArrowRight,
  Lock, Globe, Tag, Clock, Filter,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import StudioDesignerLikeShell from '@/components/liri/liri-ecosystem/StudioDesignerLikeShell';

// ─── Mock data ────────────────────────────────────────────────────────────────

const ASSET_TYPES = [
  { id: 'all', label: 'Tout', icon: Grid3X3 },
  { id: 'template', label: 'Templates', icon: BookOpen },
  { id: 'asset', label: 'Assets', icon: Image },
  { id: 'lut', label: 'LUT & Presets', icon: Layers },
  { id: 'project', label: 'Projets', icon: Package },
];

const TABS = [
  { id: 'personal', label: 'Personnel', icon: Lock },
  { id: 'community', label: 'Communauté', icon: Globe },
];

const MOCK_ASSETS = [
  { id: 1, title: 'Template Sciences Premium', type: 'template', author: 'NGOWAZULU', likes: 84, downloads: 312, starred: true, compat: 'high', tags: ['sciences', 'LIRI', 'smartboard'] },
  { id: 2, title: 'LUT Spiritual Glow', type: 'lut', author: 'LIRI', likes: 56, downloads: 198, starred: false, compat: 'high', tags: ['LUT', 'visuel', 'premium'] },
  { id: 3, title: 'Pack SmartBoard Mathématiques', type: 'project', author: 'Mme. Diallo', likes: 43, downloads: 127, starred: true, compat: 'medium', tags: ['maths', 'cours'] },
  { id: 4, title: 'Background Abstract Dark', type: 'asset', author: 'Studio LIRI', likes: 29, downloads: 89, starred: false, compat: 'high', tags: ['fond', 'dark', 'abstrait'] },
  { id: 5, title: 'Template Bootcamp Intensif', type: 'template', author: 'ProraCoach', likes: 71, downloads: 244, starred: false, compat: 'high', tags: ['bootcamp', 'formation'] },
  { id: 6, title: 'Hollywood Poster Preset', type: 'lut', author: 'CinéStudio', likes: 38, downloads: 156, starred: true, compat: 'medium', tags: ['cinéma', 'poster'] },
];

const COMPAT_CLASSES = {
  high: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
  medium: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
  low: 'bg-red-500/15 text-red-400 border-red-500/25',
};
const COMPAT_LABELS = { high: 'Compatib.', medium: 'Partiel', low: 'Limité' };

function TypeIcon({ type }) {
  const map = { template: BookOpen, asset: Image, lut: Layers, project: Package };
  const Icon = map[type] || FileText;
  return <Icon className="h-4 w-4" />;
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function StudioLiriBibliothequePage() {
  const [activeType, setActiveType] = useState('all');
  const [activeTab, setActiveTab] = useState('personal');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [viewMode, setViewMode] = useState('grid');

  const filtered = MOCK_ASSETS.filter((a) => {
    if (activeType !== 'all' && a.type !== activeType) return false;
    if (search && !a.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <StudioDesignerLikeShell
      railActiveKey="bib"
      pageLabel="Bibliothèque"
      pageAccent="emerald"
      TitleIcon={Library}
      titleLine="Assets & presets"
      topBarActions={(
        <button type="button" className="flex items-center gap-1.5 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-1.5 text-[11px] font-medium text-emerald-400 transition-all hover:bg-emerald-500/20">
          <Upload className="h-3 w-3" />
          Publier un asset
        </button>
      )}
    >
      <div className="flex min-h-0 w-full flex-1">

        {/* ── Filtres ── */}
        <aside className="flex w-52 flex-shrink-0 flex-col border-r border-white/[0.07] overflow-hidden">
          <div className="flex items-center gap-2 border-b border-white/[0.07] px-4 py-3">
            <Filter className="h-3.5 w-3.5 text-emerald-400" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/50">Filtres</span>
          </div>

          {/* Tabs personnel / communauté */}
          <div className="p-3 border-b border-white/[0.07]">
            <div className="flex rounded-xl border border-white/10 bg-white/[0.03] p-0.5 gap-0.5">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      'flex flex-1 items-center justify-center gap-1 rounded-lg py-1.5 text-[11px] font-medium transition-all',
                      activeTab === tab.id
                        ? 'bg-emerald-600/80 text-white shadow-sm'
                        : 'text-white/40 hover:text-white/70',
                    )}
                  >
                    <Icon className="h-3 w-3" />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Types */}
          <nav className="flex flex-col gap-0.5 p-3">
            <div className="text-[10px] uppercase tracking-[0.12em] text-white/25 mb-2 px-1">Type</div>
            {ASSET_TYPES.map((type) => {
              const Icon = type.icon;
              return (
                <button
                  key={type.id}
                  onClick={() => setActiveType(type.id)}
                  className={cn(
                    'flex items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-all',
                    activeType === type.id
                      ? 'bg-emerald-500/15 border border-emerald-500/25 text-emerald-300'
                      : 'text-white/45 hover:bg-white/5 border border-transparent',
                  )}
                >
                  <Icon className="h-3.5 w-3.5 flex-shrink-0" />
                  <span className="text-[12px] font-medium">{type.label}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* ── Grille ── */}
        <main className="flex flex-1 flex-col overflow-hidden">
          {/* Search bar */}
          <div className="flex items-center gap-3 border-b border-white/[0.07] px-5 py-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/25" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher..."
                className="w-full rounded-xl border border-white/10 bg-white/[0.04] py-2 pl-9 pr-3 text-[12px] text-white placeholder-white/25 outline-none focus:border-white/20"
              />
            </div>
            <div className="flex items-center gap-1 ml-auto">
              <button
                onClick={() => setViewMode('grid')}
                className={cn('flex h-7 w-7 items-center justify-center rounded-lg transition-all', viewMode === 'grid' ? 'bg-white/10 text-white/80' : 'text-white/25 hover:text-white/50')}
              >
                <Grid3X3 className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={cn('flex h-7 w-7 items-center justify-center rounded-lg transition-all', viewMode === 'list' ? 'bg-white/10 text-white/80' : 'text-white/25 hover:text-white/50')}
              >
                <List className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Assets */}
          <div className="flex-1 overflow-y-auto p-5">
            <div className={cn(
              viewMode === 'grid'
                ? 'grid grid-cols-2 gap-3 xl:grid-cols-3'
                : 'flex flex-col gap-2',
            )}>
              {filtered.map((asset) => (
                <button
                  key={asset.id}
                  onClick={() => setSelected(asset)}
                  className={cn(
                    'text-left rounded-xl border transition-all hover:border-white/20',
                    selected?.id === asset.id
                      ? 'border-emerald-500/30 bg-emerald-500/5'
                      : 'border-white/[0.07] bg-white/[0.02] hover:bg-white/[0.04]',
                    viewMode === 'list' && 'flex items-center gap-4',
                  )}
                >
                  {viewMode === 'grid' ? (
                    <div className="p-4">
                      {/* Preview placeholder */}
                      <div className="mb-3 flex h-20 items-center justify-center rounded-lg bg-white/[0.04] border border-white/[0.06]">
                        <TypeIcon type={asset.type} />
                      </div>
                      <div className="text-[12px] font-medium text-white/80 truncate mb-1">{asset.title}</div>
                      <div className="text-[10px] text-white/35 mb-2">{asset.author}</div>
                      <div className="flex items-center gap-2">
                        <span className={cn('rounded-full border px-2 py-0.5 text-[9px] font-medium', COMPAT_CLASSES[asset.compat])}>
                          {COMPAT_LABELS[asset.compat]}
                        </span>
                        <span className="ml-auto flex items-center gap-1 text-[10px] text-white/30">
                          <Heart className="h-3 w-3" />{asset.likes}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-white/[0.05] border border-white/[0.07] ml-3">
                        <TypeIcon type={asset.type} />
                      </div>
                      <div className="flex-1 min-w-0 py-3 pr-3">
                        <div className="text-[12px] font-medium text-white/80 truncate">{asset.title}</div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-white/30">{asset.author}</span>
                          <span className={cn('rounded-full border px-1.5 py-px text-[9px]', COMPAT_CLASSES[asset.compat])}>
                            {COMPAT_LABELS[asset.compat]}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 px-4 text-[10px] text-white/25">
                        <span className="flex items-center gap-1"><Heart className="h-3 w-3" />{asset.likes}</span>
                        <span className="flex items-center gap-1"><Download className="h-3 w-3" />{asset.downloads}</span>
                      </div>
                    </>
                  )}
                </button>
              ))}
            </div>
          </div>
        </main>

        {/* ── Détail ── */}
        {selected && (
          <aside className="flex w-64 flex-shrink-0 flex-col border-l border-white/[0.07] overflow-hidden">
            <div className="flex items-center justify-between border-b border-white/[0.07] px-4 py-3">
              <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/50">Détail</span>
              <button onClick={() => setSelected(null)} className="text-white/25 hover:text-white/60 text-xs">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
              {/* Preview */}
              <div className="flex h-32 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.03]">
                <TypeIcon type={selected.type} />
              </div>

              <div>
                <h3 className="text-[14px] font-semibold text-white mb-0.5">{selected.title}</h3>
                <p className="text-[11px] text-white/40">{selected.author}</p>
              </div>

              {/* Tags */}
              <div className="flex flex-wrap gap-1.5">
                {selected.tags.map((tag) => (
                  <span key={tag} className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] text-white/40">
                    {tag}
                  </span>
                ))}
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Likes', value: selected.likes, icon: Heart },
                  { label: 'Téléch.', value: selected.downloads, icon: Download },
                ].map(({ label, value, icon: Icon }) => (
                  <div key={label} className="flex flex-col items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.02] py-3">
                    <Icon className="h-3.5 w-3.5 text-white/30 mb-1" />
                    <div className="text-[14px] font-bold text-white/80">{value}</div>
                    <div className="text-[10px] text-white/30">{label}</div>
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-2">
                <button className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-[12px] font-semibold text-white transition-all hover:bg-emerald-500">
                  <Download className="h-3.5 w-3.5" />
                  Utiliser dans LIRI
                </button>
                <Link
                  to="/studio/liri/import"
                  className="flex items-center justify-center gap-2 rounded-xl border border-white/10 py-2 text-[12px] text-white/50 transition-all hover:border-white/20 hover:text-white/80"
                >
                  <ArrowRight className="h-3.5 w-3.5" />
                  Importer
                </Link>
              </div>
            </div>
          </aside>
        )}

      </div>
    </StudioDesignerLikeShell>
  );
}
