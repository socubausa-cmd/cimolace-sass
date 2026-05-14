/**
 * Master Script Panel — Zone 3 LIRI Phase 4
 *
 * Modes :
 * - 'list'     : toutes les sections, section courante surlignée
 * - 'prompter' : overlay plein écran avec défilement automatique
 * - 'edit'     : formulaire d'ajout/modification
 */
import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  FileText, Plus, Trash2, ChevronUp, ChevronDown,
  Sparkles, Check, X, Edit3, BookOpen, AlignLeft,
  Maximize2, Minimize2, Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Carte d'une section ────────────────────────────────────────────────────────
function SectionCard({
  section,
  isCurrent,
  isImproving,
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
  onImprove,
  onApplyAi,
  canMoveUp,
  canMoveDown,
}) {
  const [showAi, setShowAi] = useState(false);
  const displayContent = showAi && section.ai_content ? section.ai_content : section.content;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      className={cn(
        'rounded-xl border transition-all',
        isCurrent
          ? 'bg-[#D4AF37]/10 border-[#D4AF37]/30 shadow-[0_0_16px_rgba(212,175,55,0.12)]'
          : 'bg-white/[0.03] border-white/10 hover:border-white/18'
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-1.5 px-3 pt-2.5 pb-1">
        {section.slide_index != null ? (
          <span className="h-4 px-1.5 rounded bg-[#D4AF37]/15 border border-[#D4AF37]/25 text-[8px] font-bold text-[#D4AF37]">
            Diapo #{section.slide_index + 1}
          </span>
        ) : (
          <span className="h-4 px-1.5 rounded bg-white/8 border border-white/12 text-[8px] text-gray-500">
            Général
          </span>
        )}
        {isCurrent && (
          <span className="flex items-center gap-0.5 h-4 px-1.5 rounded bg-emerald-500/12 border border-emerald-400/22 text-[8px] text-emerald-300 font-semibold">
            ▶ En cours
          </span>
        )}
        <div className="flex-1" />
        {/* Ordre */}
        <button type="button" disabled={!canMoveUp}   onClick={onMoveUp}   className="h-5 w-5 rounded hover:bg-white/10 disabled:opacity-20 text-gray-400 flex items-center justify-center"><ChevronUp   className="w-3 h-3" /></button>
        <button type="button" disabled={!canMoveDown} onClick={onMoveDown} className="h-5 w-5 rounded hover:bg-white/10 disabled:opacity-20 text-gray-400 flex items-center justify-center"><ChevronDown className="w-3 h-3" /></button>
        <button type="button" onClick={onEdit}   className="h-5 w-5 rounded hover:bg-white/10 text-gray-400 flex items-center justify-center"><Edit3  className="w-3 h-3" /></button>
        <button type="button" onClick={onDelete} className="h-5 w-5 rounded hover:bg-red-500/15 text-gray-500 hover:text-red-400 flex items-center justify-center"><Trash2 className="w-3 h-3" /></button>
      </div>

      {/* Content */}
      <div className="px-3 pb-2.5">
        {(section.title || section.slide_title) && (
          <p className="text-[10px] font-semibold text-[#D4AF37]/85 mb-1.5 leading-tight">
            {section.title || section.slide_title}
          </p>
        )}
        <p className={cn(
          'text-[11px] leading-relaxed whitespace-pre-wrap',
          showAi && section.ai_content ? 'text-[#D4AF37]/85' : 'text-white/80'
        )}>
          {displayContent}
        </p>
      </div>

      {/* AI actions */}
      <div className="flex items-center gap-1 px-3 pb-2.5">
        <button
          type="button"
          disabled={isImproving}
          onClick={() => onImprove('improve')}
          className="flex items-center gap-1 h-5 px-2 rounded bg-[#D4AF37]/8 border border-[#D4AF37]/18 text-[8px] text-[#D4AF37]/70 hover:bg-[#D4AF37]/15 hover:text-[#D4AF37] disabled:opacity-40 transition-colors"
        >
          {isImproving ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Sparkles className="w-2.5 h-2.5" />}
          Améliorer
        </button>
        <button
          type="button"
          disabled={isImproving}
          onClick={() => onImprove('expand')}
          className="h-5 px-2 rounded bg-white/[0.04] border border-white/10 text-[8px] text-gray-500 hover:text-white disabled:opacity-40"
        >Enrichir</button>
        <button
          type="button"
          disabled={isImproving}
          onClick={() => onImprove('simplify')}
          className="h-5 px-2 rounded bg-white/[0.04] border border-white/10 text-[8px] text-gray-500 hover:text-white disabled:opacity-40"
        >Simplifier</button>

        {section.ai_content && (
          <>
            <div className="flex-1" />
            <button
              type="button"
              onClick={() => setShowAi((v) => !v)}
              className={cn(
                'h-5 px-2 rounded border text-[8px] transition-colors',
                showAi
                  ? 'bg-[#D4AF37]/15 border-[#D4AF37]/30 text-[#D4AF37]'
                  : 'bg-white/[0.04] border-white/10 text-gray-500 hover:text-white'
              )}
            >
              {showAi ? 'Voir original' : 'Voir IA ✦'}
            </button>
            {showAi && (
              <button
                type="button"
                onClick={() => onApplyAi(section.id)}
                className="h-5 px-2 rounded bg-emerald-500/12 border border-emerald-400/22 text-[8px] text-emerald-300 hover:bg-emerald-500/20"
              >
                Appliquer
              </button>
            )}
          </>
        )}
      </div>
    </motion.div>
  );
}

// ── Formulaire d'édition ───────────────────────────────────────────────────────
function SectionEditForm({ initial, totalSlides, onSave, onCancel }) {
  const [content,    setContent]    = useState(initial?.content    || '');
  const [slideIndex, setSlideIndex] = useState(initial?.slide_index ?? '');

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-[#D4AF37]/28 bg-[#D4AF37]/8 p-3 space-y-2.5"
    >
      <p className="text-[10px] font-semibold text-[#D4AF37]/80">
        {initial ? 'Modifier la section' : 'Nouvelle section'}
      </p>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Saisissez votre texte de script…"
        rows={4}
        className="w-full bg-black/20 border border-white/12 rounded-xl px-3 py-2 text-xs text-white placeholder:text-gray-500 outline-none focus:border-[#D4AF37]/40 resize-none"
      />
      <div className="flex items-center gap-2">
        <label className="text-[9px] text-gray-400 flex-shrink-0">Diapo associée :</label>
        <select
          value={slideIndex}
          onChange={(e) => setSlideIndex(e.target.value === '' ? '' : Number(e.target.value))}
          className="flex-1 h-7 rounded-lg bg-black/20 border border-white/12 text-[10px] text-white px-2 outline-none"
        >
          <option value="">Aucune (général)</option>
          {Array.from({ length: Math.max(totalSlides, 1) }, (_, i) => (
            <option key={i} value={i}>Diapo #{i + 1}</option>
          ))}
        </select>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onSave(content, slideIndex === '' ? null : Number(slideIndex))}
          disabled={!content.trim()}
          className="flex-1 h-7 rounded-xl bg-[#D4AF37]/20 border border-[#D4AF37]/35 text-xs text-[#D4AF37] font-semibold flex items-center justify-center gap-1 hover:bg-[#D4AF37]/30 disabled:opacity-40"
        >
          <Check className="w-3 h-3" /> Enregistrer
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="h-7 px-3 rounded-xl bg-white/[0.04] border border-white/10 text-xs text-gray-400 hover:text-white"
        >
          Annuler
        </button>
      </div>
    </motion.div>
  );
}

// ── Overlay Prompteur ──────────────────────────────────────────────────────────
function PrompterOverlay({ sections, currentSection, onClose }) {
  const [autoScroll, setAutoScroll] = useState(false);
  const [speed, setSpeed]           = useState(1.5); // px/frame
  const scrollRef  = useRef(null);
  const rafRef     = useRef(null);
  const activeRef  = useRef(null);

  // Auto-scroll
  useEffect(() => {
    if (!autoScroll) { cancelAnimationFrame(rafRef.current); return; }
    const tick = () => {
      if (scrollRef.current) scrollRef.current.scrollTop += speed;
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [autoScroll, speed]);

  // Scroll to current section on mount
  useEffect(() => {
    if (activeRef.current) activeRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-50 flex flex-col bg-[#050a12]/97 backdrop-blur-xl"
    >
      {/* Controls */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-white/8 flex-shrink-0">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-[#D4AF37]" />
          <span className="text-xs font-semibold text-white/80">Mode Prompteur</span>
        </div>
        <div className="flex items-center gap-3">
          {/* Speed */}
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] text-gray-500">Vitesse</span>
            <input
              type="range" min={0.3} max={4} step={0.1} value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
              className="w-20 accent-[#D4AF37]"
            />
          </div>
          <button
            type="button"
            onClick={() => setAutoScroll((v) => !v)}
            className={cn(
              'h-7 px-3 rounded-xl text-xs font-semibold border transition-all',
              autoScroll
                ? 'bg-[#D4AF37]/20 border-[#D4AF37]/35 text-[#D4AF37]'
                : 'bg-white/[0.06] border-white/12 text-white/60 hover:text-white'
            )}
          >
            {autoScroll ? '⏸ Pause' : '▶ Défilement auto'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="h-7 w-7 rounded-full bg-white/8 border border-white/12 text-gray-400 flex items-center justify-center hover:text-white"
          >
            <Minimize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-8 py-6 space-y-8">
        {sections.map((s) => {
          const isCurrent = currentSection?.id === s.id;
          return (
            <div
              key={s.id}
              ref={isCurrent ? activeRef : null}
              className={cn(
                'transition-all duration-500',
                isCurrent ? 'opacity-100' : 'opacity-30'
              )}
            >
              {s.slide_index != null && (
                <p className="text-[10px] uppercase tracking-widest text-[#D4AF37]/50 mb-2">
                  Diapositive #{s.slide_index + 1}
                </p>
              )}
              <p className={cn(
                'leading-relaxed whitespace-pre-wrap',
                isCurrent ? 'text-xl text-white' : 'text-base text-white/50'
              )}>
                {s.ai_content || s.content}
              </p>
            </div>
          );
        })}
        {sections.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-600">
            <AlignLeft className="w-8 h-8 opacity-30" />
            <p className="text-sm">Aucune section de script</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ── Main MasterScriptPanel ─────────────────────────────────────────────────────
export default function MasterScriptPanel({
  sections = [],
  currentSection,
  loading = false,
  improving = null,
  onAddSection,
  onUpdateSection,
  onDeleteSection,
  onMoveSection,
  onImproveSection,
  totalSlides = 1,
}) {
  const [editingId, setEditingId]     = useState(null); // null = pas d'édition, 'new' = nouveau
  const [prompterOpen, setPrompterOpen] = useState(false);

  const handleApplyAi = async (id) => {
    const s = sections.find((x) => x.id === id);
    if (s?.ai_content) await onUpdateSection(id, { content: s.ai_content, ai_content: null });
  };

  if (loading && sections.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 gap-2 text-gray-500">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-xs">Chargement du script…</span>
      </div>
    );
  }

  return (
    <div className="relative space-y-2">
      {/* Header actions */}
      <div className="flex items-center justify-between">
        <p className="text-[9px] uppercase tracking-widest text-gray-500">
          {sections.length} section{sections.length > 1 ? 's' : ''}
        </p>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setPrompterOpen(true)}
            disabled={sections.length === 0}
            className="flex items-center gap-1 h-6 px-2 rounded-lg bg-white/[0.05] border border-white/10 text-[9px] text-gray-400 hover:text-white hover:bg-white/8 disabled:opacity-30 transition-colors"
          >
            <Maximize2 className="w-2.5 h-2.5" /> Prompteur
          </button>
          <button
            type="button"
            onClick={() => setEditingId('new')}
            className="flex items-center gap-1 h-6 px-2 rounded-lg bg-[#D4AF37]/12 border border-[#D4AF37]/25 text-[9px] text-[#D4AF37] hover:bg-[#D4AF37]/20 transition-colors"
          >
            <Plus className="w-2.5 h-2.5" /> Ajouter
          </button>
        </div>
      </div>

      {/* New section form */}
      <AnimatePresence>
        {editingId === 'new' && (
          <SectionEditForm
            totalSlides={totalSlides}
            onSave={async (content, slideIndex) => {
              await onAddSection(content, slideIndex);
              setEditingId(null);
            }}
            onCancel={() => setEditingId(null)}
          />
        )}
      </AnimatePresence>

      {/* Sections list */}
      {sections.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-24 text-gray-600 gap-2">
          <FileText className="w-5 h-5 opacity-30" />
          <p className="text-xs">Aucun script — cliquez Ajouter</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          <AnimatePresence>
            {sections.map((s, idx) => (
              editingId === s.id ? (
                <SectionEditForm
                  key={s.id}
                  initial={s}
                  totalSlides={totalSlides}
                  onSave={async (content, slideIndex) => {
                    await onUpdateSection(s.id, { content, slide_index: slideIndex });
                    setEditingId(null);
                  }}
                  onCancel={() => setEditingId(null)}
                />
              ) : (
                <SectionCard
                  key={s.id}
                  section={s}
                  isCurrent={currentSection?.id === s.id}
                  isImproving={improving === s.id}
                  canMoveUp={idx > 0}
                  canMoveDown={idx < sections.length - 1}
                  onEdit={() => setEditingId(s.id)}
                  onDelete={() => onDeleteSection(s.id)}
                  onMoveUp={() => onMoveSection(s.id, 'up')}
                  onMoveDown={() => onMoveSection(s.id, 'down')}
                  onImprove={(mode) => onImproveSection(s.id, mode)}
                  onApplyAi={handleApplyAi}
                />
              )
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Prompter overlay */}
      <AnimatePresence>
        {prompterOpen && (
          <PrompterOverlay
            sections={sections}
            currentSection={currentSection}
            onClose={() => setPrompterOpen(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
