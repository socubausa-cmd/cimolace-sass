/**
 * CourseTreePanel — arbre hierarchique Chapitres / Sous-chap / Segments.
 * Connecte useCourseBuilderStore.
 */
import React, { useState } from 'react';
import { ChevronRight, ChevronDown, Plus, Trash2, BookOpen, Layers, FileText, GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCourseBuilderStore } from '@/stores/course-builder.store';

function TreeItem({ label, icon: Icon, active, onClick, onDelete, depth = 0, children, badge }) {
  const [open, setOpen] = useState(true);
  const hasChildren = React.Children.count(children) > 0;

  return (
    <div>
      <div
        className={cn(
          'group flex items-center gap-1.5 rounded-md px-2 py-1.5 cursor-pointer text-[12px] transition-colors',
          active ? 'bg-[#D4AF37]/15 text-[#D4AF37]' : 'text-white/60 hover:bg-white/5 hover:text-white/90',
        )}
        style={{ paddingLeft: `${8 + depth * 14}px` }}
        onClick={onClick}
      >
        {hasChildren ? (
          <button
            className="shrink-0 text-white/30 hover:text-white/60"
            onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
          >
            {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </button>
        ) : (
          <span className="w-3 shrink-0" />
        )}
        {Icon && <Icon className="h-3 w-3 shrink-0" />}
        <span className="flex-1 truncate">{label}</span>
        {badge != null && (
          <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] text-white/40">{badge}</span>
        )}
        {onDelete && (
          <button
            className="invisible ml-auto shrink-0 rounded p-0.5 text-red-400/60 hover:bg-red-500/15 hover:text-red-400 group-hover:visible"
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
          >
            <Trash2 className="h-3 w-3" />
          </button>
        )}
      </div>
      {hasChildren && open && <div>{children}</div>}
    </div>
  );
}

function AddButton({ label, onClick }) {
  return (
    <button
      className="flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-[11px] text-white/30 transition-colors hover:bg-white/5 hover:text-white/60"
      onClick={onClick}
    >
      <Plus className="h-3 w-3" />
      {label}
    </button>
  );
}

export default function CourseTreePanel() {
  const courseDraft = useCourseBuilderStore((s) => s.courseDraft);
  const activeChapterId = useCourseBuilderStore((s) => s.activeChapterId);
  const activeSubchapterId = useCourseBuilderStore((s) => s.activeSubchapterId);
  const activeSegmentId = useCourseBuilderStore((s) => s.activeSegmentId);
  const setActiveChapter = useCourseBuilderStore((s) => s.setActiveChapter);
  const setActiveSubchapter = useCourseBuilderStore((s) => s.setActiveSubchapter);
  const setActiveSegment = useCourseBuilderStore((s) => s.setActiveSegment);
  const addChapter = useCourseBuilderStore((s) => s.addChapter);
  const addSubchapter = useCourseBuilderStore((s) => s.addSubchapter);
  const addSegment = useCourseBuilderStore((s) => s.addSegment);
  const deleteChapter = useCourseBuilderStore((s) => s.deleteChapter);
  const deleteSubchapter = useCourseBuilderStore((s) => s.deleteSubchapter);
  const deleteSegment = useCourseBuilderStore((s) => s.deleteSegment);

  if (!courseDraft) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 p-6 text-center">
        <BookOpen className="h-8 w-8 text-white/20" />
        <p className="text-[12px] text-white/40">Aucun cours. Initialisez un cours pour commencer.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0.5 py-2">
      {/* Course title */}
      <div className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-widest text-white/30">
        {courseDraft.title || 'Cours sans titre'}
      </div>

      {courseDraft.chapters.map((chapter) => (
        <TreeItem
          key={chapter.id}
          label={chapter.title || 'Chapitre sans titre'}
          icon={BookOpen}
          active={activeChapterId === chapter.id && !activeSubchapterId}
          onClick={() => { setActiveChapter(chapter.id); setActiveSubchapter(null); setActiveSegment(null); }}
          onDelete={() => deleteChapter(chapter.id)}
          badge={chapter.subchapters.length}
        >
          {chapter.subchapters.map((sub) => (
            <TreeItem
              key={sub.id}
              label={sub.title || 'Sous-chapitre'}
              icon={Layers}
              active={activeSubchapterId === sub.id && !activeSegmentId}
              onClick={() => { setActiveChapter(chapter.id); setActiveSubchapter(sub.id); setActiveSegment(null); }}
              onDelete={() => deleteSubchapter(sub.id)}
              depth={1}
              badge={sub.segments.length}
            >
              {sub.segments.map((seg) => (
                <TreeItem
                  key={seg.id}
                  label={seg.title || 'Segment'}
                  icon={FileText}
                  active={activeSegmentId === seg.id}
                  onClick={() => { setActiveChapter(chapter.id); setActiveSubchapter(sub.id); setActiveSegment(seg.id); }}
                  onDelete={() => deleteSegment(seg.id)}
                  depth={2}
                />
              ))}
              <div style={{ paddingLeft: '36px' }}>
                <AddButton label="Ajouter segment" onClick={() => addSegment(sub.id, 'Nouveau segment')} />
              </div>
            </TreeItem>
          ))}
          <div style={{ paddingLeft: '22px' }}>
            <AddButton label="Ajouter sous-chapitre" onClick={() => addSubchapter(chapter.id, 'Nouveau sous-chapitre')} />
          </div>
        </TreeItem>
      ))}

      <div className="mt-1 px-2">
        <AddButton label="Ajouter chapitre" onClick={() => addChapter('Nouveau chapitre')} />
      </div>
    </div>
  );
}
