/**
 * SmartBoard Streaming V2 — Visualisateur 21 segments pédagogiques
 * Layout : Chapitres | Segments (21) | Canvas | Contrôles
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Monitor, ArrowLeft, ChevronLeft, ChevronRight,
  Play, RotateCcw, CheckCircle2, Download,
  PenTool, Layers, Loader2, SkipForward,
  AlertCircle, Info, X, Zap,
} from 'lucide-react';
import { useOrchestratorLiveStore } from '@/stores/orchestrator-live.store';

// ─── Constante localStorage (bridge → Designer) ───────────────────────────────
const LIRI_AGENT_TO_KONVA_KEY = 'liri_agent_to_konva_v1';

// ─── Design tokens ────────────────────────────────────────────────────────────
const BG      = '#080c14';
const SURFACE = '#0f1520';
const PANEL   = '#141c2d';
const BORDER  = '#1e2a40';
const GOLD    = '#D4AF37';
const GREEN   = '#34d399';

// Canvas de référence (doit correspondre à liriSegmentsSlideSpec.js)
const CW = 1037;
const CH = 750;

// ─── 21 segments avec métadonnées UI ──────────────────────────────────────────
const SEGMENTS = [
  // Ouverture
  { name: 'Objectif',            color: '#D4AF37', phase: 'Ouverture',   icon: '🎯' },
  { name: 'Compétence',          color: '#a78bfa', phase: 'Ouverture',   icon: '💪' },
  { name: 'Connaissance',        color: '#38bdf8', phase: 'Ouverture',   icon: '📚' },
  // Accroche
  { name: 'Mise en situation',   color: '#f59e0b', phase: 'Accroche',    icon: '🎬' },
  { name: 'Tension',             color: '#f43f5e', phase: 'Accroche',    icon: '⚡' },
  { name: 'Expérience de pensée',color: '#c084fc', phase: 'Accroche',    icon: '🧠' },
  { name: 'Révélation',          color: '#fbbf24', phase: 'Accroche',    icon: '✨' },
  // Corps
  { name: 'Leçon simple',        color: '#34d399', phase: 'Corps',       icon: '📖' },
  { name: 'Leçon développée',    color: '#38bdf8', phase: 'Corps',       icon: '📝' },
  { name: 'Analogies',           color: '#c084fc', phase: 'Corps',       icon: '🔗' },
  { name: 'Exemples',            color: '#34d399', phase: 'Corps',       icon: '🔍' },
  { name: 'Reformulation',       color: '#94a3b8', phase: 'Corps',       icon: '🔄' },
  // Pratique
  { name: 'Atelier',             color: '#34d399', phase: 'Pratique',    icon: '⚒️' },
  { name: 'Erreurs attendues',   color: '#f43f5e', phase: 'Pratique',    icon: '❌' },
  { name: 'Correction',          color: '#34d399', phase: 'Pratique',    icon: '✅' },
  // Synthèse
  { name: 'JE RETIENS',          color: '#D4AF37', phase: 'Synthèse',    icon: '⭐' },
  { name: 'Test',                color: '#38bdf8', phase: 'Synthèse',    icon: '❓' },
  { name: 'Cas réel',            color: '#f59e0b', phase: 'Synthèse',    icon: '🌍' },
  { name: 'Lien conceptuel',     color: '#a78bfa', phase: 'Synthèse',    icon: '🕸️' },
  { name: 'Niveau de maîtrise',  color: '#34d399', phase: 'Synthèse',    icon: '📊' },
  { name: 'Transition',          color: '#64748b', phase: 'Synthèse',    icon: '▶️' },
];

const PHASES = ['Ouverture', 'Accroche', 'Corps', 'Pratique', 'Synthèse'];

const PHASE_COLOR = {
  'Ouverture': '#D4AF37',
  'Accroche':  '#f43f5e',
  'Corps':     '#38bdf8',
  'Pratique':  '#34d399',
  'Synthèse':  '#a78bfa',
};

// ─── Bridge : store → cours LIRI (format liriAgentToKonvaDesigner) ───────────

// ─── Utilitaire téléchargement sans fuite mémoire ────────────────────────────
function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

const SEGMENT_TO_TAG = {
  'Objectif':             'definition',
  'Compétence':           'definition',
  'Connaissance':         'definition',
  'Mise en situation':    'confrontation',
  'Tension':              'confrontation',
  'Expérience de pensée': 'confrontation',
  'Révélation':           'demonstration',
  'Leçon simple':         'definition',
  'Leçon développée':     'definition',
  'Analogies':            'exemple',
  'Exemples':             'exemple',
  'Reformulation':        'synthese',
  'Atelier':              'atelier',
  'Erreurs attendues':    'atelier',
  'Correction':           'synthese',
  'JE RETIENS':           'synthese',
  'Test':                 'confrontation',
  'Cas réel':             'exemple',
  'Lien conceptuel':      'synthese',
  'Niveau de maîtrise':   'synthese',
  'Transition':           'synthese',
};

function extractSlideContent(elements = []) {
  const titre        = elements.find(e => e.type === 'title')?.content ?? '';
  const idee         = elements.find(e => e.type === 'subtitle' || e.type === 'sub')?.content ?? '';
  const contenu      = elements
    .filter(e => e.type === 'paragraph' || e.type === 'bullet')
    .map(e => e.content ?? e.text ?? '').filter(Boolean).join('\n');
  const visualEl     = elements.find(e => e.type === 'image' || e.type === 'schema');
  const support_visuel = visualEl ? (visualEl.style ?? visualEl.type) : '';
  const questionEl   = elements.find(e => (e.content ?? e.text ?? '').includes('?'));
  const question_cle = questionEl ? (questionEl.content ?? questionEl.text ?? '') : '';
  return { titre, idee, contenu, support_visuel, question_cle };
}

function buildCoursFromStore(chapters, slides, activeChapterId) {
  const chapter = chapters.find(c => c.id === activeChapterId) ?? chapters[0];
  if (!chapter) return null;
  const chapterSlides = slides.filter(s => s.chapterId === chapter.id);
  const etapes = SEGMENTS
    .map(seg => {
      const slide = chapterSlides.find(s => s.segmentName === seg.name);
      if (!slide) return null;
      const sb = extractSlideContent(slide.elements ?? []);
      return {
        tag: SEGMENT_TO_TAG[seg.name] ?? 'definition',
        smartboard: {
          titre:           sb.titre  || seg.name,
          idee:            sb.idee   || chapter.summary || '',
          contenu:         sb.contenu,
          support_visuel:  sb.support_visuel,
          question_cle:    sb.question_cle,
        },
        masterscript: {
          script:              sb.contenu,
          intention:           `${seg.name} — ${seg.phase}`,
          questions:           [],
          reponses_attendues:  [],
          transition:          '',
        },
      };
    })
    .filter(Boolean);
  return {
    titre:      chapter.title   ?? 'Sans titre',
    sous_titre: chapter.summary ?? '',
    objectif:   chapter.objectives ?? '',
    etapes,
  };
}

// ─── Rendu d'un élément de slide ─────────────────────────────────────────────
function SlideElement({ el, scale }) {
  const x = (el.x ?? 0) * scale;
  const y = (el.y ?? 0) * scale;
  const w = (el.width ?? 200) * scale;
  const h = (el.height ?? 40) * scale;
  const fs = Math.max(8, ((el.fontSize ?? 14)) * scale);

  const base = {
    position:  'absolute',
    left:      x,
    top:       y,
    width:     w,
    height:    h,
    boxSizing: 'border-box',
    overflow:  'hidden',
  };

  const text = el.content ?? el.text ?? '';

  switch (el.type) {
    case 'rect':
      return (
        <div style={{
          ...base,
          background:   el.fill ?? 'rgba(255,255,255,0.04)',
          border:       `${Math.max(1, scale)}px solid ${el.border ?? '#1e2a40'}`,
          borderRadius: (el.radius ?? 0) * scale,
        }} />
      );

    case 'divider':
      return (
        <div style={{
          ...base,
          height:     Math.max(1, 2 * scale),
          background: el.color ?? '#1e2a40',
          opacity:    el.opacity ?? 1,
        }} />
      );

    case 'tag':
    case 'badge':
      return (
        <div style={{
          ...base,
          display:        'flex',
          alignItems:     'center',
          justifyContent: el.align === 'center' ? 'center' : 'flex-start',
          padding:        `${2 * scale}px ${8 * scale}px`,
          background:     el.bg ?? 'rgba(255,255,255,0.06)',
          border:         `${Math.max(0.5, scale)}px solid ${el.border ?? '#334155'}`,
          borderRadius:   20 * scale,
          color:          el.color ?? '#94a3b8',
          fontSize:       Math.max(7, 10 * scale),
          fontWeight:     700,
          letterSpacing:  '0.08em',
          whiteSpace:     'nowrap',
        }}>
          {el.text ?? text}
        </div>
      );

    case 'title':
      return (
        <div style={{
          ...base,
          display:    'flex',
          alignItems: 'center',
          color:      el.color ?? '#ffffff',
          fontSize:   Math.max(10, (el.fontSize ?? 28) * scale),
          fontWeight: el.fontWeight ?? 700,
          lineHeight: 1.2,
          textAlign:  el.align ?? 'left',
        }}>
          {text || 'Titre du slide'}
        </div>
      );

    case 'subtitle':
    case 'sub':
      return (
        <div style={{
          ...base,
          display:       'flex',
          alignItems:    'center',
          color:         el.color ?? '#94a3b8',
          fontSize:      Math.max(7, (el.fontSize ?? 11) * scale),
          fontWeight:    el.fontWeight ?? 600,
          letterSpacing: '0.07em',
          textTransform: 'uppercase',
          textAlign:     el.align ?? 'left',
        }}>
          {el.text ?? text}
        </div>
      );

    case 'paragraph':
      return (
        <div style={{
          ...base,
          color:      el.color ?? '#e2e8f0',
          fontSize:   Math.max(8, (el.fontSize ?? 14) * scale),
          fontWeight: el.fontWeight ?? 400,
          fontStyle:  el.italic ? 'italic' : 'normal',
          lineHeight: 1.55,
          textAlign:  el.align ?? 'left',
        }}>
          {text || '…'}
        </div>
      );

    case 'bullet':
      return (
        <div style={{
          ...base,
          display:    'flex',
          alignItems: 'flex-start',
          gap:        6 * scale,
          color:      el.color ?? '#e2e8f0',
          fontSize:   Math.max(8, (el.fontSize ?? 14) * scale),
          fontWeight: el.fontWeight ?? 500,
          lineHeight: 1.45,
        }}>
          <span style={{ color: el.color ?? GOLD, flexShrink: 0, marginTop: 1 * scale }}>
            {el.prefix ?? '▸'}
          </span>
          <span>{text || 'Point clé à compléter…'}</span>
        </div>
      );

    case 'quote':
      return (
        <div style={{
          ...base,
          display:      'flex',
          alignItems:   'center',
          padding:      `${6 * scale}px ${12 * scale}px`,
          background:   el.fill ?? 'rgba(255,255,255,0.03)',
          borderLeft:   el.border ? `${3 * scale}px solid ${el.border}` : `${3 * scale}px solid ${el.color ?? GOLD}`,
          color:        el.color ?? GOLD,
          fontSize:     Math.max(8, (el.fontSize ?? 15) * scale),
          fontStyle:    el.italic !== false ? 'italic' : 'normal',
          fontWeight:   el.fontWeight ?? 400,
          lineHeight:   1.5,
          textAlign:    el.align ?? 'left',
        }}>
          {text || '«  »'}
        </div>
      );

    case 'number':
      return (
        <div style={{
          ...base,
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
          color:          el.color ?? 'rgba(100,116,139,0.2)',
          fontSize:       Math.max(20, (el.fontSize ?? 90) * scale),
          fontWeight:     900,
          lineHeight:     1,
        }}>
          {text}
        </div>
      );

    case 'progress':
      return (
        <div style={{
          ...base,
          background:   el.fill ?? 'rgba(52,211,153,0.1)',
          border:       `${Math.max(0.5, scale)}px solid ${el.border ?? '#064e3b'}`,
          borderRadius: (el.radius ?? 10) * scale,
          overflow:     'hidden',
        }} />
      );

    case 'image':
    case 'schema':
      return (
        <div style={{
          ...base,
          background:   'rgba(255,255,255,0.03)',
          border:       `${Math.max(0.5, scale)}px dashed #1e2a40`,
          borderRadius: (el.radius ?? 8) * scale,
          display:      'flex',
          flexDirection:'column',
          alignItems:   'center',
          justifyContent:'center',
          color:        '#334155',
          gap:          4 * scale,
          fontSize:     Math.max(6, 10 * scale),
        }}>
          <span style={{ fontSize: Math.max(10, 18 * scale) }}>
            {el.type === 'schema' ? '🗺' : '🖼'}
          </span>
          <span style={{ textAlign: 'center', padding: `0 ${8 * scale}px` }}>
            {el.type === 'schema' ? (el.style === 'mindmap' ? 'Carte conceptuelle' : 'Schéma / Diagramme') : 'Illustration'}
          </span>
        </div>
      );

    case 'arrow':
      return (
        <div style={{
          ...base,
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
          color:          el.color ?? GOLD,
          fontSize:       Math.max(10, 20 * scale),
        }}>
          →
        </div>
      );

    default:
      return null;
  }
}

// ─── Canvas du slide ──────────────────────────────────────────────────────────
function SlideCanvas({ slide, segment, chapter, loading }) {
  const containerRef = useRef(null);
  const [scale, setScale] = useState(0.5);

  useEffect(() => {
    const obs = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setScale(Math.min((width - 48) / CW, (height - 48) / CH));
    });
    if (containerRef.current) obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  const segMeta  = SEGMENTS.find(s => s.name === segment) ?? SEGMENTS[0];
  const accent   = slide?.accentColor ?? segMeta?.color ?? GOLD;
  const elements = slide?.elements ?? [];
  const hasSlide = elements.length > 0;

  return (
    <div ref={containerRef} className="w-full h-full flex items-center justify-center">
      <motion.div
        key={`${chapter?.id}-${segment}`}
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.25 }}
        style={{
          position:     'relative',
          width:        CW * scale,
          height:       CH * scale,
          background:   'linear-gradient(135deg, #0d1828 0%, #0a1020 100%)',
          border:       `1px solid ${accent}30`,
          boxShadow:    `0 0 60px ${accent}10, 0 20px 60px rgba(0,0,0,0.5)`,
          borderRadius: 12 * scale,
          overflow:     'hidden',
          flexShrink:   0,
        }}
      >
        {/* Barre d'accent en haut */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0,
          height: 3 * scale, background: accent, zIndex: 10,
        }} />

        {/* Loading overlay */}
        {loading && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 20,
            background: 'rgba(8,12,20,0.7)',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 12,
          }}>
            <Loader2 size={24 * scale} color={accent} className="animate-spin" />
            <span style={{ color: accent, fontSize: 12 * scale, fontWeight: 600 }}>
              Génération en cours…
            </span>
          </div>
        )}

        {/* État vide */}
        {!hasSlide && !loading && (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            gap: 8 * scale, color: '#334155',
          }}>
            <span style={{ fontSize: 32 * scale }}>{segMeta?.icon ?? '📄'}</span>
            <span style={{ fontSize: 12 * scale, fontWeight: 600, color: '#475569' }}>
              {segment ?? 'Sélectionnez un segment'}
            </span>
            {segment && chapter && (
              <span style={{ fontSize: 10 * scale, color: '#334155' }}>
                Cliquez "Générer" pour créer ce slide
              </span>
            )}
          </div>
        )}

        {/* Éléments du slide */}
        {hasSlide && elements.map((el) => (
          <SlideElement key={el.id} el={el} scale={scale} />
        ))}

        {/* Watermark */}
        <div style={{
          position: 'absolute', bottom: 8 * scale, right: 12 * scale,
          fontSize: 8 * scale, color: '#1e2a40', fontWeight: 600,
          letterSpacing: '0.1em',
        }}>
          LIRI SmartBoard
        </div>
      </motion.div>
    </div>
  );
}

// ─── Liste de chapitres ───────────────────────────────────────────────────────
function ChapterList({ chapters, selectedId, onSelect }) {
  const statusColor = {
    pending:    '#334155',
    processing: '#f59e0b',
    done:       '#22c55e',
    completed:  '#22c55e',   // alias store Factory
    validated:  '#22c55e',
    error:      '#f87171',
  };

  return (
    <div className="space-y-1.5">
      {chapters.map((ch, i) => {
        const id     = ch.id ?? i;
        const active = selectedId === id;
        return (
          <button key={id} onClick={() => onSelect(id, i)}
            className="w-full text-left rounded-xl px-3 py-2.5 transition-all"
            style={{
              background: active ? `${GOLD}10` : PANEL,
              border:     `1px solid ${active ? GOLD + '40' : BORDER}`,
            }}>
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-[9px] font-bold text-slate-500">CH {i + 1}</span>
              <div className="w-1.5 h-1.5 rounded-full"
                style={{ background: statusColor[ch.status] ?? '#334155' }} />
            </div>
            <p className="text-slate-300 text-[11px] font-medium leading-tight line-clamp-2">
              {ch.title}
            </p>
          </button>
        );
      })}
    </div>
  );
}

// ─── Rail des 21 segments ─────────────────────────────────────────────────────
function SegmentRail({ selectedSegment, onSelect, slideStates }) {
  return (
    <div className="space-y-3">
      {PHASES.map(phase => {
        const segs = SEGMENTS.filter(s => s.phase === phase);
        return (
          <div key={phase}>
            <p className="text-[9px] font-bold uppercase tracking-widest px-1 mb-1.5"
              style={{ color: PHASE_COLOR[phase] + '80' }}>
              {phase}
            </p>
            <div className="space-y-0.5">
              {segs.map(seg => {
                const active    = selectedSegment === seg.name;
                const state     = slideStates[seg.name];
                const validated = state === 'validated';
                const draft     = state === 'draft';
                return (
                  <button key={seg.name} onClick={() => onSelect(seg.name)}
                    className="w-full text-left rounded-lg px-2.5 py-2 transition-all group"
                    style={{
                      background: active
                        ? `${seg.color}15`
                        : 'transparent',
                      border: `1px solid ${active ? seg.color + '50' : 'transparent'}`,
                    }}>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] shrink-0">{seg.icon}</span>
                      <span className="text-[11px] flex-1 truncate font-medium"
                        style={{ color: active ? seg.color : validated ? '#22c55e' : '#64748b' }}>
                        {seg.name}
                      </span>
                      {validated && <CheckCircle2 size={9} color="#22c55e" className="shrink-0" />}
                      {draft && !validated && <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: seg.color }} />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Contrôles ────────────────────────────────────────────────────────────────
function ControlsPanel({
  segment, chapter, currentSlide, loading,
  onGenerate, onRegenerate, onValidate, onNextSeg, onExport, onOpenDesigner,
  autoMode, onToggleAuto,
}) {
  const segMeta = SEGMENTS.find(s => s.name === segment);
  const accent  = segMeta?.color ?? GOLD;

  return (
    <div className="space-y-4">
      {/* Info segment actif */}
      {segment && (
        <div className="rounded-xl p-3" style={{ background: PANEL, border: `1px solid ${BORDER}` }}>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-base">{segMeta?.icon}</span>
            <div>
              <p className="text-white text-xs font-bold">{segment}</p>
              <p className="text-[10px]" style={{ color: accent }}>{segMeta?.phase}</p>
            </div>
          </div>
          {currentSlide && (
            <div className="flex items-center gap-1.5 mt-1">
              <div className="w-1.5 h-1.5 rounded-full"
                style={{ background: currentSlide.state === 'validated' ? '#22c55e' : accent }} />
              <span className="text-[10px] text-slate-500">
                {currentSlide.state === 'validated' ? 'Validé' : 'Brouillon'}
              </span>
              <span className="text-[10px] text-slate-500 ml-auto">
                {currentSlide.elements?.length ?? 0} éléments
              </span>
            </div>
          )}
        </div>
      )}

      {/* Info mise en page */}
      {segment && !currentSlide && (
        <div className="rounded-lg p-3 flex items-start gap-2"
          style={{ background: `${accent}08`, border: `1px solid ${accent}20` }}>
          <Info size={12} color={accent} className="mt-0.5 shrink-0" />
          <p className="text-[10px]" style={{ color: accent + 'cc' }}>
            Cliquez "Générer" pour créer le slide avec le layout défini pour ce segment.
          </p>
        </div>
      )}

      {!segment && (
        <div className="rounded-lg p-3 flex items-start gap-2"
          style={{ background: PANEL, border: `1px solid ${BORDER}` }}>
          <AlertCircle size={12} color="#475569" className="mt-0.5 shrink-0" />
          <p className="text-[10px] text-slate-500">
            Sélectionnez un chapitre et un segment pour générer un slide.
          </p>
        </div>
      )}

      {/* Actions principales */}
      <div className="space-y-2">
        <p className="text-[9px] uppercase tracking-widest text-slate-500">Actions</p>

        <button onClick={onGenerate} disabled={loading || !segment || !chapter}
          className="w-full flex items-center gap-2.5 px-4 py-3 rounded-xl font-bold text-sm transition-all disabled:opacity-40"
          style={{ background: `${accent}20`, color: accent, border: `1px solid ${accent}40` }}>
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
          Générer slide
        </button>

        <button onClick={onRegenerate} disabled={loading || !currentSlide}
          className="w-full flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm transition-all disabled:opacity-40"
          style={{ background: '#38bdf810', color: '#38bdf8', border: '1px solid #38bdf825' }}>
          <RotateCcw size={13} />
          Régénérer
        </button>

        <button onClick={onValidate} disabled={!currentSlide || currentSlide?.state === 'validated'}
          className="w-full flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm transition-all disabled:opacity-40"
          style={{ background: '#22c55e10', color: '#22c55e', border: '1px solid #22c55e25' }}>
          <CheckCircle2 size={13} />
          Valider
        </button>

        <button onClick={onNextSeg} disabled={loading}
          className="w-full flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm transition-all disabled:opacity-40"
          style={{ background: '#a78bfa10', color: '#a78bfa', border: '1px solid #a78bfa25' }}>
          <SkipForward size={13} />
          Segment suivant
        </button>
      </div>

      {/* Sortie */}
      <div className="space-y-2 pt-3 border-t" style={{ borderColor: BORDER }}>
        <p className="text-[9px] uppercase tracking-widest text-slate-500">Sortie</p>

        <button onClick={onOpenDesigner}
          className="w-full flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-bold transition-all"
          style={{ background: `${GOLD}15`, color: GOLD, border: `1px solid ${GOLD}30` }}>
          <PenTool size={13} />
          Ouvrir dans Designer
        </button>

        <button onClick={onExport}
          className="w-full flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm transition-all"
          style={{ background: PANEL, color: '#475569', border: `1px solid ${BORDER}` }}>
          <Download size={13} />
          Export JSON
        </button>
      </div>

      {/* Auto mode */}
      <div className="flex items-center justify-between pt-3 border-t" style={{ borderColor: BORDER }}>
        <div>
          <p className="text-xs font-medium text-slate-400">Mode auto</p>
          <p className="text-[10px] text-slate-500">Génère les 21 segments</p>
        </div>
        <button onClick={onToggleAuto}
          className="relative w-10 h-5 rounded-full transition-colors"
          style={{ background: autoMode ? GREEN : '#1e2a40' }}>
          <div className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all"
            style={{ left: autoMode ? '22px' : '2px' }} />
        </button>
      </div>
    </div>
  );
}

// ─── Composant principal ──────────────────────────────────────────────────────
export default function SmartboardStreamingV2() {
  const navigate = useNavigate();

  const {
    chapters       = [],
    slides         = [],
    selectedChapterId,
    selectedSegment: storeSegment,
    setSelectedChapterId,
    selectSegment,
    generateCurrentSlide,
    regenerateCurrentSlide,
    validateCurrentSlide,
    exportStreamJson,
  } = useOrchestratorLiveStore?.() ?? {};

  const [localSegment, setLocalSegment]   = useState(SEGMENTS[0].name);
  const [chapterIndex, setChapterIndex]   = useState(0);
  const [autoMode, setAutoMode]           = useState(false);
  const [loading, setLoading]             = useState(false);
  const [mobilePanel, setMobilePanel]     = useState(null); // 'chapters'|'segments'|'controls'|null

  // Segment actif : priorité au store, sinon local
  const activeSegment  = storeSegment ?? localSegment;
  const activeChapter  = chapters[chapterIndex] ?? null;
  const activeChapterId = selectedChapterId ?? activeChapter?.id;

  // Slide correspondant au chapitre + segment actif
  const currentSlide = slides.find(
    s => s.chapterId === activeChapterId && s.segmentName === activeSegment
  ) ?? null;

  // Index des états de slides pour le segment rail
  const slideStates = {};
  slides.forEach(s => {
    if (s.chapterId === activeChapterId && s.segmentName) {
      slideStates[s.segmentName] = s.state;
    }
  });

  const handleSelectSegment = useCallback((name) => {
    setLocalSegment(name);
    selectSegment?.(name);
  }, [selectSegment]);

  const handleSelectChapter = useCallback((id, idx) => {
    setChapterIndex(idx);
    setSelectedChapterId?.(id);
  }, [setSelectedChapterId]);

  const handleNextSegment = useCallback(() => {
    const idx  = SEGMENTS.findIndex(s => s.name === activeSegment);
    const next = SEGMENTS[idx + 1];
    if (next) handleSelectSegment(next.name);
  }, [activeSegment, handleSelectSegment]);

  const handleAction = useCallback(async (fn) => {
    if (!fn) return;
    setLoading(true);
    try { await fn(); } finally { setLoading(false); }
  }, []);

  const handleOpenDesigner = useCallback(() => {
    const cours = buildCoursFromStore(chapters, slides, activeChapterId);
    if (cours?.etapes?.length) {
      try {
        localStorage.setItem(LIRI_AGENT_TO_KONVA_KEY, JSON.stringify(cours));
      } catch (e) {
        console.warn('[SmartboardV2] localStorage plein ou indisponible :', e.message);
      }
    }
    navigate('/dev/smartboard-designer');
  }, [chapters, slides, activeChapterId, navigate]);

  const handleExport = useCallback(() => {
    const data = exportStreamJson?.() ?? { chapters, slides };
    triggerDownload(
      new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
      'smartboard-stream.json'
    );
  }, [exportStreamJson, chapters, slides]);

  // Auto mode — parcourt les segments séquentiellement (pas de setInterval → pas de leak)
  useEffect(() => {
    if (!autoMode || !activeChapterId) return;
    let cancelled = false;

    const run = async () => {
      const startIdx = Math.max(0, SEGMENTS.findIndex(s => s.name === activeSegment));
      for (let i = startIdx; i < SEGMENTS.length; i++) {
        if (cancelled) return;
        const seg = SEGMENTS[i];
        // Sélectionner le segment dans le store ET localement
        setLocalSegment(seg.name);
        selectSegment?.(seg.name);
        // Laisser React re-render + store se mettre à jour
        await new Promise(r => setTimeout(r, 150));
        if (cancelled) return;
        // Générer le slide si absent
        await generateCurrentSlide?.();
        if (cancelled) return;
        // Pause avant le suivant
        await new Promise(r => setTimeout(r, 800));
      }
      if (!cancelled) setAutoMode(false);
    };

    run();
    return () => { cancelled = true; };
  // Intentionnellement minimal : on ne veut pas redémarrer la boucle à chaque segment
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoMode, activeChapterId]);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: BG, fontFamily: "'Inter', sans-serif" }}>

      {/* ── Header ───────────────────────────────────────────────────────────── */}
      <header className="px-5 py-3.5 flex items-center justify-between border-b shrink-0"
        style={{ borderColor: BORDER, background: SURFACE }}>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/dev/liri/studio')}
            className="p-1.5 rounded-lg transition-colors hover:bg-white/5"
            style={{ color: '#475569' }}>
            <ArrowLeft size={15} />
          </button>
          <div className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: `${GREEN}20` }}>
            <Monitor size={13} style={{ color: GREEN }} />
          </div>
          <div>
            <span className="text-white font-bold text-sm">SmartBoard Streaming</span>
            <span className="text-slate-500 text-[10px] ml-2">21 segments</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {activeChapter && (
            <span className="text-slate-500 text-xs hidden md:block">
              {activeChapter.title}
            </span>
          )}
          <button onClick={handleOpenDesigner}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold"
            style={{ background: `${GOLD}15`, color: GOLD, border: `1px solid ${GOLD}30` }}>
            <PenTool size={11} /> Designer
          </button>
        </div>
      </header>

      {/* ── Mobile overlay panel ────────────────────────────────────────────── */}
      {mobilePanel && (
        <div className="fixed inset-0 z-40 md:hidden flex flex-col" style={{ background: SURFACE }}>
          {/* Header panel mobile */}
          <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: BORDER }}>
            <span className="text-white font-semibold text-sm capitalize">
              {mobilePanel === 'chapters' ? `Chapitres · ${chapters.length}` : mobilePanel === 'segments' ? 'Segments · 21' : 'Contrôles'}
            </span>
            <button onClick={() => setMobilePanel(null)} className="p-1.5 rounded-lg hover:bg-white/5" style={{ color: '#64748b' }}>
              <X size={16} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            {mobilePanel === 'chapters' && (
              <div className="space-y-2">
                {chapters.map((ch, idx) => (
                  <button key={ch.id ?? idx}
                    onClick={() => { handleSelectChapter(ch.id, idx); setMobilePanel(null); }}
                    className="w-full text-left px-4 py-3 rounded-xl transition-all"
                    style={{ background: chapterIndex === idx ? `${GREEN}18` : PANEL, border: `1px solid ${chapterIndex === idx ? GREEN + '40' : BORDER}` }}>
                    <p className="text-[10px] font-bold mb-0.5" style={{ color: GREEN }}>CH {idx + 1}</p>
                    <p className="text-white text-sm font-medium">{ch.title}</p>
                  </button>
                ))}
              </div>
            )}
            {mobilePanel === 'segments' && (
              <SegmentRail
                selectedSegment={activeSegment}
                onSelect={(name) => { handleSelectSegment(name); setMobilePanel(null); }}
                slideStates={slideStates}
              />
            )}
            {mobilePanel === 'controls' && (
              <ControlsPanel
                segment={activeSegment}
                chapter={activeChapter}
                currentSlide={currentSlide}
                loading={loading}
                autoMode={autoMode}
                onToggleAuto={() => setAutoMode(a => !a)}
                onGenerate={() => { handleAction(generateCurrentSlide); setMobilePanel(null); }}
                onRegenerate={() => { handleAction(regenerateCurrentSlide); setMobilePanel(null); }}
                onValidate={() => { handleAction(validateCurrentSlide); setMobilePanel(null); }}
                onNextSeg={() => { handleNextSegment(); setMobilePanel(null); }}
                onExport={handleExport}
                onOpenDesigner={handleOpenDesigner}
              />
            )}
          </div>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">

        {/* ── Sidebar 1 : Chapitres — cachée sur mobile ─────────────────────── */}
        <aside className="hidden md:flex w-52 shrink-0 border-r flex-col"
          style={{ borderColor: BORDER, background: SURFACE }}>
          <div className="px-3 py-3 border-b" style={{ borderColor: BORDER }}>
            <p className="text-[9px] uppercase tracking-widest text-slate-500">
              Chapitres · {chapters.length}
            </p>
          </div>
          <div className="flex-1 overflow-y-auto p-2.5">
            {chapters.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-3 px-2">
                <Layers size={20} style={{ color: '#334155' }} />
                <p className="text-[11px] text-center leading-relaxed" style={{ color: '#64748b' }}>
                  Aucun chapitre chargé
                </p>
                <button onClick={() => navigate('/dev/liri/masterclass-v2')}
                  className="text-[10px] font-semibold px-3 py-1.5 rounded-lg w-full text-center transition-colors"
                  style={{ background: `${GREEN}15`, color: GREEN, border: `1px solid ${GREEN}30` }}>
                  ← Factory
                </button>
                <button onClick={() => navigate('/dev/liri/orchestrator-v2')}
                  className="text-[10px] font-semibold px-3 py-1.5 rounded-lg w-full text-center transition-colors"
                  style={{ background: '#38bdf815', color: '#38bdf8', border: '1px solid #38bdf830' }}>
                  Orchestrator
                </button>
              </div>
            ) : (
              <>
                {/* Nav chapitre */}
                <div className="flex items-center justify-between mb-2.5 px-1">
                  <button
                    onClick={() => {
                      const newIdx = Math.max(0, chapterIndex - 1);
                      const ch = chapters[newIdx];
                      if (ch) handleSelectChapter(ch.id, newIdx);
                    }}
                    disabled={chapterIndex === 0}
                    className="p-1 rounded disabled:opacity-30" style={{ color: '#475569' }}>
                    <ChevronLeft size={12} />
                  </button>
                  <span className="text-[10px] text-slate-500">
                    {chapterIndex + 1} / {chapters.length}
                  </span>
                  <button
                    onClick={() => {
                      const newIdx = Math.min(chapters.length - 1, chapterIndex + 1);
                      const ch = chapters[newIdx];
                      if (ch) handleSelectChapter(ch.id, newIdx);
                    }}
                    disabled={chapterIndex >= chapters.length - 1}
                    className="p-1 rounded disabled:opacity-30" style={{ color: '#475569' }}>
                    <ChevronRight size={12} />
                  </button>
                </div>
                <ChapterList
                  chapters={chapters}
                  selectedId={activeChapterId}
                  onSelect={handleSelectChapter}
                />
              </>
            )}
          </div>
        </aside>

        {/* ── Sidebar 2 : Segments — cachée sur mobile ─────────────────────── */}
        <aside className="hidden md:flex w-48 shrink-0 border-r flex-col"
          style={{ borderColor: BORDER, background: SURFACE }}>
          <div className="px-3 py-3 border-b" style={{ borderColor: BORDER }}>
            <p className="text-[9px] uppercase tracking-widest text-slate-500">
              Segments · 21
            </p>
          </div>
          <div className="flex-1 overflow-y-auto p-2.5">
            <SegmentRail
              selectedSegment={activeSegment}
              onSelect={handleSelectSegment}
              slideStates={slideStates}
            />
          </div>
        </aside>

        {/* ── Canvas central ────────────────────────────────────────────────── */}
        <main className="flex-1 overflow-hidden" style={{ background: '#07101d' }}>
          <SlideCanvas
            slide={currentSlide}
            segment={activeSegment}
            chapter={activeChapter}
            loading={loading}
          />
        </main>

        {/* ── Panneau contrôles — caché sur mobile ──────────────────────────── */}
        <aside className="hidden md:block w-64 shrink-0 border-l p-4 overflow-y-auto"
          style={{ borderColor: BORDER, background: SURFACE }}>
          <ControlsPanel
            segment={activeSegment}
            chapter={activeChapter}
            currentSlide={currentSlide}
            loading={loading}
            autoMode={autoMode}
            onToggleAuto={() => setAutoMode(a => !a)}
            onGenerate={() => handleAction(generateCurrentSlide)}
            onRegenerate={() => handleAction(regenerateCurrentSlide)}
            onValidate={() => handleAction(validateCurrentSlide)}
            onNextSeg={handleNextSegment}
            onExport={handleExport}
            onOpenDesigner={handleOpenDesigner}
          />
        </aside>
      </div>

      {/* ── Mobile bottom tab-bar ────────────────────────────────────────────── */}
      <nav className="md:hidden flex border-t shrink-0" style={{ borderColor: BORDER, background: SURFACE }}>
        {[
          { id: 'chapters', label: 'Chapitres', icon: Layers },
          { id: 'segments', label: activeSegment?.slice(0, 8) ?? 'Segments', icon: Monitor },
          { id: 'controls', label: 'Actions', icon: Play },
        ].map(tab => {
          const Icon = tab.icon;
          const active = mobilePanel === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setMobilePanel(active ? null : tab.id)}
              className="flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium transition-colors"
              style={{ color: active ? GREEN : '#475569' }}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
        {/* Raccourci génération rapide */}
        <button
          onClick={() => handleAction(generateCurrentSlide)}
          disabled={loading}
          className="flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-bold transition-colors disabled:opacity-40"
          style={{ color: loading ? '#475569' : GOLD }}
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
          {loading ? '...' : 'Générer'}
        </button>
      </nav>
    </div>
  );
}
