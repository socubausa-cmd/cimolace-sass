/**
 * SlideProgressionPanel — Plan du slide avec sections a, b, c et Spotlight.
 */
import React, { useMemo, useState } from 'react';
import { Plus, Trash2, GripVertical, Lightbulb, RotateCcw, BookmarkPlus, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { sceneHasLiveDraft } from '../lib/slideLiveDraft';

export default function SlideProgressionPanel({
  scene,
  activeSection,
  onActivateSection,
  selectedIds,
  onAddSection,
  onRenameSection,
  onDeleteSection,
  onReorderSections,
  onSetObjectSection,
  onSaveInitialState,
  onResetToInitialState,
  className,
}) {
  const sections = scene?.sections || [];
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState('');
  const [dragIdx, setDragIdx] = useState(null);

  const hasLiveDraft = useMemo(() => sceneHasLiveDraft(scene), [scene]);

  const LABELS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

  function commitRename(id) {
    if (editDraft.trim()) onRenameSection(id, editDraft.trim());
    setEditingId(null);
    setEditDraft('');
  }

  return (
    <div className={cn('flex flex-col gap-3 p-3', className)}>

      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <Lightbulb className="h-4 w-4 shrink-0 text-[#D4AF37]" />
          <span className="text-[13px] font-bold text-white/90">Plan du slide</span>
          {scene?.stateInitial != null ? (
            hasLiveDraft ? (
              <span
                className="shrink-0 rounded-full border border-amber-500/40 bg-amber-950/50 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-100/95"
                title="Le canvas diffère du snapshot — Réinitialiser revient à la base enregistrée."
              >
                Brouillon live
              </span>
            ) : (
              <span
                className="shrink-0 rounded-full border border-emerald-500/35 bg-emerald-950/45 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-emerald-200/95"
                title="État identique à la base — Réinitialiser ne changera rien."
              >
                Base à jour
              </span>
            )
          ) : (
            <span
              className="shrink-0 rounded-full border border-white/12 bg-white/[0.04] px-2 py-0.5 text-[9px] font-medium uppercase tracking-wide text-white/40"
              title="Enregistrez une base avant une démo live pour pouvoir rétablir le canvas."
            >
              Pas de base
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => {
            const label = `Section ${sections.length + 1}`;
            onAddSection(label);
          }}
          className="flex items-center gap-1 rounded-lg border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-2 py-1 text-[11px] text-[#f5dd8a] hover:bg-[#D4AF37]/20"
        >
          <Plus className="h-3 w-3" />
          Ajouter
        </button>
      </div>

      {/* Spotlight all off */}
      {activeSection && (
        <button
          type="button"
          onClick={() => onActivateSection(null)}
          className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-white/15 py-1.5 text-[11px] text-white/50 hover:bg-white/[0.05] hover:text-white/80"
        >
          Voir toutes les sections
        </button>
      )}

      {/* No sections hint */}
      {sections.length === 0 && (
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-4 text-center">
          <p className="text-[12px] text-white/40">Aucune section.</p>
          <p className="mt-1 text-[11px] text-white/25">Ajoutez des sections pour organiser la progression du slide.</p>
        </div>
      )}

      {/* Sections list */}
      <div className="flex flex-col gap-1.5">
        {sections.map((sec, idx) => {
          const isActive = activeSection === sec.id;
          const letter = LABELS[idx] || String(idx + 1);
          const isEditing = editingId === sec.id;

          return (
            <div
              key={sec.id}
              draggable
              onDragStart={() => setDragIdx(idx)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (dragIdx !== null && dragIdx !== idx) onReorderSections(dragIdx, idx);
                setDragIdx(null);
              }}
              onDragEnd={() => setDragIdx(null)}
              className={cn(
                'group flex items-center gap-2 rounded-xl border px-3 py-2.5 transition-all',
                isActive
                  ? 'border-[#D4AF37]/45 bg-[#D4AF37]/12 shadow-[0_0_12px_rgba(212,175,55,0.15)]'
                  : 'border-white/[0.08] bg-white/[0.025] hover:border-white/[0.15]',
                dragIdx === idx && 'opacity-40',
              )}
            >
              {/* Drag handle */}
              <GripVertical className="h-3.5 w-3.5 shrink-0 cursor-grab text-white/25 active:cursor-grabbing" />

              {/* Letter badge */}
              <div className={cn(
                'flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold',
                isActive
                  ? 'bg-[#D4AF37] text-[#0b0f1a]'
                  : 'bg-white/[0.08] text-white/50',
              )}>
                {letter}
              </div>

              {/* Label / edit */}
              {isEditing ? (
                <input
                  autoFocus
                  value={editDraft}
                  onChange={(e) => setEditDraft(e.target.value)}
                  onBlur={() => commitRename(sec.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRename(sec.id);
                    if (e.key === 'Escape') { setEditingId(null); setEditDraft(''); }
                    e.stopPropagation();
                  }}
                  className="min-w-0 flex-1 rounded-lg border border-[#D4AF37]/40 bg-black/40 px-2 py-0.5 text-[12px] text-white focus:outline-none"
                />
              ) : (
                <button
                  type="button"
                  onDoubleClick={() => { setEditingId(sec.id); setEditDraft(sec.label); }}
                  onClick={() => onActivateSection(isActive ? null : sec.id)}
                  className={cn(
                    'min-w-0 flex-1 text-left text-[12px] font-medium',
                    isActive ? 'text-[#f5dd8a]' : 'text-white/70',
                  )}
                >
                  {sec.label}
                </button>
              )}

              {/* Assign selected objects */}
              {selectedIds?.length > 0 && !isEditing && (
                <button
                  type="button"
                  title={`Assigner les objets selectionnes a cette section`}
                  onClick={() => selectedIds.forEach((id) => onSetObjectSection(id, sec.id))}
                  className="shrink-0 text-white/30 opacity-0 transition-opacity group-hover:opacity-100 hover:text-[#D4AF37]"
                >
                  <BookmarkPlus className="h-3.5 w-3.5" />
                </button>
              )}

              {/* Spotlight / focus button */}
              {!isEditing && (
                <button
                  type="button"
                  title="Spotlight cette section"
                  onClick={() => onActivateSection(isActive ? null : sec.id)}
                  className={cn(
                    'shrink-0 transition-all',
                    isActive
                      ? 'text-[#D4AF37]'
                      : 'text-white/20 opacity-0 group-hover:opacity-100 hover:text-white/60',
                  )}
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              )}

              {/* Delete */}
              {!isEditing && (
                <button
                  type="button"
                  onClick={() => onDeleteSection(sec.id)}
                  className="shrink-0 text-white/20 opacity-0 transition-opacity group-hover:opacity-100 hover:text-red-400"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Assign selected to "global" (no section) */}
      {selectedIds?.length > 0 && sections.length > 0 && (
        <button
          type="button"
          onClick={() => selectedIds.forEach((id) => onSetObjectSection(id, null))}
          className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-white/10 py-1.5 text-[11px] text-white/40 hover:bg-white/[0.04] hover:text-white/70"
        >
          Retirer de la section (global)
        </button>
      )}

      {/* State initial / reset */}
      <div className="mt-1 flex flex-col gap-1.5 border-t border-white/[0.06] pt-3">
        <p className="text-[11px] font-semibold text-white/40 uppercase tracking-wider">Etats du slide</p>
        <p className="text-[10px] leading-snug text-white/35">
          Enregistrez une base de référence avant une démo ou un live, puis rétablissez le canvas après manipulation
          (déplacement, taille). Annuler (Ctrl+Z) restaure aussi l'étape précédente.
        </p>
        {hasLiveDraft && scene?.stateInitial != null ? (
          <p className="text-[10px] leading-snug text-amber-200/70">
            Brouillon live : le contenu a bougé par rapport à la base — utilisez Réinitialiser pour retrouver le snapshot.
          </p>
        ) : null}
        <button
          type="button"
          onClick={onSaveInitialState}
          className="flex items-center gap-2 rounded-xl border border-[#D4AF37]/25 bg-[#D4AF37]/[0.05] px-3 py-2 text-[12px] text-[#f5dd8a] hover:bg-[#D4AF37]/[0.12]"
        >
          <BookmarkPlus className="h-4 w-4" />
          Sauvegarder etat initial
        </button>
        <button
          type="button"
          onClick={onResetToInitialState}
          disabled={!scene?.stateInitial}
          className="flex items-center gap-2 rounded-xl border border-white/15 px-3 py-2 text-[12px] text-white/60 hover:bg-white/[0.06] disabled:opacity-30"
        >
          <RotateCcw className="h-4 w-4" />
          {scene?.stateInitial ? 'Reinitialiser' : 'Aucun etat sauvegarde'}
        </button>
      </div>
    </div>
  );
}
