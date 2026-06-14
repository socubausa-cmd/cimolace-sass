/**
 * LibraryPanel — panneau principal de la bibliothèque communautaire.
 * Filtres + grille de cartes + import + drag & drop vers le Designer.
 */
import React, { useState } from 'react';
import {
  BookMarked, Plus, Globe, User, LayoutGrid, List, Share2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLibrary } from '../hooks/useLibrary';
import LibraryCard from './LibraryCard';
import LibraryFilters from './LibraryFilters';
import LibraryImportModal from './LibraryImportModal';

function EmptyState({ hasFilters }) {
  return (
    <div className="flex flex-col items-center gap-3 py-12 text-center">
      <BookMarked className="h-10 w-10 text-white/15" />
      <p className="text-[13px] font-medium text-white/40">
        {hasFilters ? 'Aucun résultat pour ces filtres.' : 'Bibliothèque vide.'}
      </p>
      <p className="text-[11px] text-white/25">
        {hasFilters ? 'Essayez de changer les filtres.' : 'Importez des assets ou explorez la communauté.'}
      </p>
    </div>
  );
}

export default function LibraryPanel({
  className,
  compact = false,
  onUseItem,
}) {
  const {
    filteredItems,
    stats,
    filters,
    setFilter,
    resetFilters,
    selectedItemId,
    setSelectedItem,
    importModalOpen,
    openImportModal,
    closeImportModal,
    likeItem,
    publishToCommunity,
    importFromCommunity,
  } = useLibrary();

  const [viewMode, setViewMode] = useState('grid');
  const [activeTab, setActiveTab] = useState('all');

  const hasActiveFilters =
    filters.category !== 'all' ||
    filters.theme !== 'all' ||
    filters.compatibility !== 'all' ||
    filters.source !== 'all' ||
    filters.search !== '';

  const handleUse = (item) => {
    if (onUseItem) {
      onUseItem(item);
    } else {
      // Auto-import from community if not personal
      if (item.source === 'community') {
        importFromCommunity(item);
      }
    }
  };

  const handleDragStart = (e, item) => {
    e.dataTransfer.setData('application/liri-library', JSON.stringify({ type: 'library-item', item }));
    e.dataTransfer.effectAllowed = 'copy';
  };

  return (
    <div className={cn('flex flex-col bg-[#07090f]', className)}>
      {/* Header */}
      <div className="flex shrink-0 items-center gap-2 border-b border-white/8 px-3 py-2">
        <BookMarked className="h-4 w-4 text-[var(--school-accent)]" />
        <span className="text-[12px] font-semibold text-white">Bibliothèque</span>
        <div className="ml-auto flex items-center gap-1.5">
          <button
            onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
            className="rounded p-1 text-white/30 hover:text-white/60"
          >
            {viewMode === 'grid' ? <List className="h-3.5 w-3.5" /> : <LayoutGrid className="h-3.5 w-3.5" />}
          </button>
          <button
            onClick={openImportModal}
            className="flex items-center gap-1 rounded-lg border border-[color-mix(in_srgb,var(--school-accent)_30%,transparent)] px-2 py-1 text-[11px] text-[var(--school-accent)] hover:bg-[color-mix(in_srgb,var(--school-accent)_10%,transparent)]"
          >
            <Plus className="h-3 w-3" />
            Importer
          </button>
        </div>
      </div>

      {/* Source tabs */}
      <div className="flex shrink-0 border-b border-white/8">
        {[
          { id: 'all', label: 'Tout', icon: BookMarked },
          { id: 'personal', label: 'Personnel', icon: User },
          { id: 'community', label: 'Communauté', icon: Globe },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => { setActiveTab(id); setFilter('source', id); }}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 py-2 text-[11px] transition-colors',
              activeTab === id
                ? 'border-b-2 border-[var(--school-accent)] text-[var(--school-accent)]'
                : 'text-white/40 hover:text-white/70',
            )}
          >
            <Icon className="h-3 w-3" />
            {!compact && label}
          </button>
        ))}
      </div>

      {/* Filters */}
      {!compact && (
        <LibraryFilters
          filters={filters}
          onFilter={setFilter}
          onReset={resetFilters}
          stats={stats}
        />
      )}

      {/* Grid */}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-3">
        {filteredItems.length === 0 ? (
          <EmptyState hasFilters={hasActiveFilters} />
        ) : viewMode === 'grid' ? (
          <div className={cn('grid gap-3', compact ? 'grid-cols-1' : 'grid-cols-2')}>
            {filteredItems.map((item) => (
              <div
                key={item.id}
                draggable
                onDragStart={(e) => handleDragStart(e, item)}
              >
                <LibraryCard
                  item={item}
                  selected={selectedItemId === item.id}
                  onSelect={(i) => setSelectedItem(i.id === selectedItemId ? null : i.id)}
                  onUse={handleUse}
                  onLike={likeItem}
                />
              </div>
            ))}
          </div>
        ) : (
          /* List view */
          <div className="flex flex-col gap-1">
            {filteredItems.map((item) => (
              <button
                key={item.id}
                draggable
                onDragStart={(e) => handleDragStart(e, item)}
                onClick={() => setSelectedItem(item.id === selectedItemId ? null : item.id)}
                className={cn(
                  'flex items-center gap-3 rounded-lg border p-2.5 text-left transition-colors',
                  selectedItemId === item.id
                    ? 'border-[color-mix(in_srgb,var(--school-accent)_40%,transparent)] bg-[color-mix(in_srgb,var(--school-accent)_8%,transparent)]'
                    : 'border-white/6 hover:border-white/15',
                )}
              >
                {item.preview ? (
                  <img src={item.preview} alt="" className="h-10 w-16 shrink-0 rounded-md object-cover" />
                ) : (
                  <div className="h-10 w-16 shrink-0 rounded-md bg-white/5" />
                )}
                <div className="flex-1 overflow-hidden">
                  <p className="truncate text-[12px] font-medium text-white/80">{item.title}</p>
                  <p className="text-[10px] text-white/35">{item.category} · {item.compatibility}%</p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); handleUse(item); }}
                  className="shrink-0 rounded border border-[color-mix(in_srgb,var(--school-accent)_30%,transparent)] px-2 py-1 text-[10px] text-[var(--school-accent)] hover:bg-[color-mix(in_srgb,var(--school-accent)_10%,transparent)]"
                >
                  Utiliser
                </button>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Import modal */}
      <LibraryImportModal open={importModalOpen} onClose={closeImportModal} />
    </div>
  );
}
