import React, { useCallback, useEffect, useRef, useState } from 'react';
import PedagogicalBlockRenderer from "@/components/liri-ecosystem/PedagogicalBlockRenderer";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Play,
  Video,
  Presentation,
  Brain,
  FlaskConical,
  X,
  BarChart3,
  FileText,
  Zap,
  Clock,
  CheckCircle2,
  Circle,
  Loader2,
  BookOpen,
  Radio,
  Map,
  Award,
  AlertCircle,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';

// ── Design tokens (ISNA dark theme) ──────────────────────────────────────────
const T = {
  bg:       '#0b0b0f',
  surface:  '#12111a',
  card:     '#17161f',
  border:   'rgba(255,255,255,0.07)',
  borderMid:'rgba(255,255,255,0.12)',
  gold:     '#D4AF37',
  goldDim:  'rgba(212,175,55,0.10)',
  goldMid:  'rgba(212,175,55,0.25)',
  goldBright:'rgba(212,175,55,0.40)',
  teal:     '#2dd4bf',
  tealDim:  'rgba(45,212,191,0.12)',
  tealMid:  'rgba(45,212,191,0.25)',
  t1:       '#f0eeff',
  t2:       '#9d9ab8',
  t3:       '#6b6888',
  success:  '#4ade80',
  successDim:'rgba(74,222,128,0.12)',
  danger:   '#f87171',
  dangerDim: 'rgba(248,113,113,0.12)',
  warn:     '#fbbf24',
  warnDim:  'rgba(251,191,36,0.12)',
  purple:   '#a78bfa',
  purpleDim:'rgba(167,139,250,0.12)',
};

// ── Constants ─────────────────────────────────────────────────────────────────

const WEEKDAY_LABELS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi'];
const WEEKDAY_SHORT  = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven'];

const MONTH_LABELS = [
  'jan', 'fév', 'mars', 'avr', 'mai', 'juin',
  'juil', 'août', 'sep', 'oct', 'nov', 'déc',
];

const MONTH_LABELS_FULL = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

// pedagogy_type badge colors
const PEDAGOGY_COLORS = {
  opening_live:         { bg: 'rgba(45,212,191,0.15)', border: 'rgba(45,212,191,0.35)', color: '#2dd4bf' },
  closure_live:         { bg: 'rgba(45,212,191,0.15)', border: 'rgba(45,212,191,0.35)', color: '#2dd4bf' },
  smartboard_session:   { bg: 'rgba(167,139,250,0.15)', border: 'rgba(167,139,250,0.35)', color: '#a78bfa' },
  friction_block:       { bg: 'rgba(251,191,36,0.15)', border: 'rgba(251,191,36,0.35)', color: '#fbbf24' },
  recall_block:         { bg: 'rgba(212,175,55,0.15)', border: 'rgba(212,175,55,0.35)', color: '#D4AF37' },
  experiment_block:     { bg: 'rgba(74,222,128,0.15)', border: 'rgba(74,222,128,0.35)', color: '#4ade80' },
  previsualisation_video:{ bg: 'rgba(248,113,113,0.15)', border: 'rgba(248,113,113,0.35)', color: '#f87171' },
  doctrinal_video:      { bg: 'rgba(248,113,113,0.15)', border: 'rgba(248,113,113,0.35)', color: '#f87171' },
  quiz_block:           { bg: 'rgba(167,139,250,0.15)', border: 'rgba(167,139,250,0.35)', color: '#a78bfa' },
  mindmap_block:        { bg: 'rgba(45,212,191,0.15)', border: 'rgba(45,212,191,0.35)', color: '#2dd4bf' },
  summary_block:        { bg: 'rgba(156,163,175,0.15)', border: 'rgba(156,163,175,0.35)', color: '#9ca3af' },
  generic:              { bg: 'rgba(255,255,255,0.06)', border: 'rgba(255,255,255,0.12)', color: '#9d9ab8' },
};

const PEDAGOGY_LABELS = {
  opening_live:         "Live d'ouverture",
  closure_live:         "Live de clôture",
  smartboard_session:   'SmartBoard',
  friction_block:       'Friction',
  recall_block:         'Recall',
  experiment_block:     'Expérimentation',
  previsualisation_video:'Prévisualisation',
  doctrinal_video:      'Vidéo doctrinale',
  quiz_block:           'Quiz',
  mindmap_block:        'Mindmap',
  summary_block:        'Synthèse',
  generic:              'Jour générique',
};

// block type → lucide icon
const BLOCK_ICONS = {
  opening_live:          Radio,
  closure_live:          Radio,
  smartboard_session:    Presentation,
  friction_block:        Zap,
  doctrinal_video:       Video,
  previsualisation_video:Play,
  experiment_block:      FlaskConical,
  recall_block:          Brain,
  quiz_block:            BarChart3,
  mindmap_block:         Map,
  summary_block:         FileText,
};

// block type → CTA label
const BLOCK_CTA = {
  opening_live:          'Rejoindre',
  closure_live:          'Rejoindre',
  smartboard_session:    'Ouvrir',
  friction_block:        'Commencer',
  doctrinal_video:       'Regarder',
  previsualisation_video:'Regarder',
  experiment_block:      'Commencer',
  recall_block:          'Réviser',
  quiz_block:            'Commencer',
  mindmap_block:         'Explorer',
  summary_block:         'Lire',
};

// ── Date helpers ──────────────────────────────────────────────────────────────

/**
 * Returns the Monday of the ISO week containing `date`.
 */
function getMondayOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0 Sun … 6 Sat
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Format a date as "D mois" e.g. "10 mars"
 */
function formatDayMonth(date) {
  const d = new Date(date);
  return `${d.getDate()} ${MONTH_LABELS[d.getMonth()]}`;
}

/**
 * Full date label for day column header: "LUNDI 10 mars"
 */
function formatDayLabel(weekMonday, dayIndex) {
  const d = new Date(weekMonday);
  d.setDate(d.getDate() + dayIndex);
  return {
    full: `${WEEKDAY_LABELS[dayIndex].toUpperCase()} ${d.getDate()} ${MONTH_LABELS[d.getMonth()]}`,
    date: d,
  };
}

/**
 * Number of full weeks between two dates (floor).
 */
function weeksBetween(a, b) {
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  const start = getMondayOfWeek(a);
  const end   = getMondayOfWeek(b);
  return Math.floor((end - start) / msPerWeek);
}

function isToday(date) {
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth()    === now.getMonth() &&
    date.getDate()     === now.getDate()
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

/** Skeleton shimmer block */
function Skeleton({ width = '100%', height = 16, radius = 6 }) {
  const [shimmerPos, setShimmerPos] = useState(0);
  useEffect(() => {
    let frame;
    let start = null;
    function step(ts) {
      if (!start) start = ts;
      const elapsed = ts - start;
      setShimmerPos((elapsed % 1800) / 1800);
      frame = requestAnimationFrame(step);
    }
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, []);
  const pct = shimmerPos * 200 - 100;
  return (
    <div style={{
      width, height, borderRadius: radius,
      background: `linear-gradient(90deg, ${T.surface} 0%, rgba(255,255,255,0.06) ${50 + pct}%, ${T.surface} 100%)`,
      backgroundSize: '200% 100%',
      flexShrink: 0,
    }} />
  );
}

/** Pedagogy type badge */
function PedagogyBadge({ type }) {
  const cfg = PEDAGOGY_COLORS[type] || PEDAGOGY_COLORS.generic;
  const label = PEDAGOGY_LABELS[type] || type;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
      textTransform: 'uppercase',
      color: cfg.color,
      background: cfg.bg,
      border: `1px solid ${cfg.border}`,
      borderRadius: 20, padding: '2px 8px',
      whiteSpace: 'nowrap', flexShrink: 0,
    }}>
      {label}
    </span>
  );
}

/** Block status badge */
function StatusBadge({ status }) {
  const map = {
    termine:  { label: 'Terminé',  color: T.success, bg: T.successDim },
    en_cours: { label: 'En cours', color: T.warn,    bg: T.warnDim    },
    a_faire:  { label: 'À faire',  color: T.t3,      bg: 'rgba(255,255,255,0.05)' },
  };
  const cfg = map[status] || map.a_faire;
  const Icon = status === 'termine' ? CheckCircle2 : status === 'en_cours' ? Loader2 : Circle;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: 10, fontWeight: 600,
      color: cfg.color, background: cfg.bg,
      border: `1px solid ${cfg.color}22`,
      borderRadius: 20, padding: '2px 8px',
      flexShrink: 0,
    }}>
      <Icon size={9} />
      {cfg.label}
    </span>
  );
}

/** Duration chip */
function DurationChip({ minutes }) {
  if (!minutes) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const label = h > 0 ? `${h}h${m > 0 ? m : ''}` : `${m} min`;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: 10, fontWeight: 500, color: T.t3,
      background: 'rgba(255,255,255,0.04)',
      border: `1px solid ${T.border}`,
      borderRadius: 20, padding: '2px 8px',
      flexShrink: 0,
    }}>
      <Clock size={9} style={{ color: T.t3 }} />
      {label}
    </span>
  );
}

/** Inline video modal */
function VideoModal({ videoUrl, title, onClose }) {
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Build embed URL (YouTube / Vimeo)
  let embedUrl = videoUrl;
  if (videoUrl) {
    const ytMatch = videoUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{11})/);
    if (ytMatch) {
      embedUrl = `https://www.youtube.com/embed/${ytMatch[1]}?autoplay=1&rel=0`;
    }
    const vimeoMatch = videoUrl.match(/vimeo\.com\/(\d+)/);
    if (vimeoMatch) {
      embedUrl = `https://player.vimeo.com/video/${vimeoMatch[1]}?autoplay=1`;
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title || 'Vidéo'}
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9000,
        background: 'rgba(0,0,0,0.85)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 860,
          background: T.card, borderRadius: 16,
          border: `1px solid ${T.border}`,
          overflow: 'hidden',
          boxShadow: '0 32px 80px rgba(0,0,0,0.7)',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 18px',
          borderBottom: `1px solid ${T.border}`,
        }}>
          <span style={{ color: T.t1, fontSize: 14, fontWeight: 600 }}>{title || 'Vidéo'}</span>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.06)', border: 'none',
              borderRadius: 8, width: 30, height: 30, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.t2,
            }}
          >
            <X size={16} />
          </button>
        </div>
        {/* Video */}
        <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0 }}>
          {embedUrl ? (
            <iframe
              src={embedUrl}
              title={title || 'Vidéo'}
              frameBorder="0"
              allow="autoplay; fullscreen"
              allowFullScreen
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
            />
          ) : (
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: T.t3, fontSize: 14,
            }}>
              URL vidéo non disponible
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Inline expanded content panel (friction/experiment/mindmap/summary) */
function ExpandedPanel({ block, onClose }) {
  return (
    <div style={{
      marginTop: 10, padding: '14px 16px',
      background: 'rgba(255,255,255,0.03)',
      border: `1px solid ${T.border}`,
      borderRadius: 10,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <span style={{ color: T.t2, fontSize: 12, fontWeight: 600 }}>Contenu du bloc</span>
        <button
          onClick={onClose}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: T.t3, padding: 2,
          }}
        >
          <X size={13} />
        </button>
      </div>
      {block.data?.description && (
        <p style={{ color: T.t2, fontSize: 13, lineHeight: 1.6, margin: '0 0 10px' }}>
          {block.data.description}
        </p>
      )}
      {block.data?.instructions && (
        <p style={{ color: T.t2, fontSize: 13, lineHeight: 1.6, margin: '0 0 10px' }}>
          {block.data.instructions}
        </p>
      )}
      {block.data?.content && (
        <p style={{ color: T.t2, fontSize: 13, lineHeight: 1.6, margin: 0 }}>
          {block.data.content}
        </p>
      )}
      {!block.data?.description && !block.data?.instructions && !block.data?.content && (
        <p style={{ color: T.t3, fontSize: 13, fontStyle: 'italic', margin: 0 }}>
          Aucun contenu détaillé pour ce bloc.
        </p>
      )}
    </div>
  );
}

/** Inline quiz modal */
function QuizModal({ block, onClose }) {
  const questions = block.data?.questions || [];
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState(null);
  const [answers, setAnswers] = useState({});
  const [finished, setFinished] = useState(false);

  const q = questions[current];

  function handleAnswer(optIdx) {
    if (selected !== null) return;
    setSelected(optIdx);
    setAnswers((prev) => ({ ...prev, [current]: optIdx }));
  }

  function handleNext() {
    if (current < questions.length - 1) {
      setCurrent((c) => c + 1);
      setSelected(null);
    } else {
      setFinished(true);
    }
  }

  const score = Object.entries(answers).filter(([qi, ans]) => {
    const qq = questions[Number(qi)];
    return qq && qq.correct_index === ans;
  }).length;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Quiz"
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9000,
        background: 'rgba(0,0,0,0.85)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 560,
          background: T.card, borderRadius: 16,
          border: `1px solid ${T.goldMid}`,
          padding: 28,
          boxShadow: '0 32px 80px rgba(0,0,0,0.7)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <span style={{ color: T.gold, fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Quiz — {block.title || 'Bloc quiz'}
          </span>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.06)', border: 'none',
              borderRadius: 8, width: 30, height: 30, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.t2,
            }}
          >
            <X size={16} />
          </button>
        </div>

        {questions.length === 0 && (
          <p style={{ color: T.t3, textAlign: 'center', fontStyle: 'italic', padding: '20px 0' }}>
            Aucune question configurée pour ce quiz.
          </p>
        )}

        {questions.length > 0 && !finished && q && (
          <>
            <div style={{ marginBottom: 6, color: T.t3, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Question {current + 1}/{questions.length}
            </div>
            <div style={{ background: T.surface, borderRadius: 10, padding: '20px 0', marginBottom: 8 }}>
              <div style={{
                width: `${((current + 1) / questions.length) * 100}%`,
                height: 3, background: T.gold, borderRadius: 2, marginBottom: 18,
                transition: 'width 0.3s ease',
              }} />
              <p style={{ color: T.t1, fontSize: 16, fontWeight: 600, lineHeight: 1.5, margin: '0 0 20px', padding: '0 20px' }}>
                {q.question}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '0 20px' }}>
                {(q.options || []).map((opt, i) => {
                  let optBg = 'rgba(255,255,255,0.04)';
                  let optBorder = T.border;
                  let optColor = T.t2;
                  if (selected !== null) {
                    if (i === q.correct_index) { optBg = T.successDim; optBorder = T.success; optColor = T.success; }
                    else if (i === selected && i !== q.correct_index) { optBg = T.dangerDim; optBorder = T.danger; optColor = T.danger; }
                  } else if (selected === i) {
                    optBg = T.goldDim; optBorder = T.gold; optColor = T.gold;
                  }
                  return (
                    <button
                      key={i}
                      onClick={() => handleAnswer(i)}
                      disabled={selected !== null}
                      style={{
                        background: optBg, border: `1px solid ${optBorder}`,
                        borderRadius: 8, padding: '10px 14px',
                        color: optColor, fontSize: 14, textAlign: 'left',
                        cursor: selected !== null ? 'default' : 'pointer',
                        transition: 'all 0.2s',
                      }}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
            </div>
            {selected !== null && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
                <button
                  onClick={handleNext}
                  style={{
                    background: T.gold, color: '#0b0b0f',
                    border: 'none', borderRadius: 8,
                    padding: '9px 22px', fontWeight: 700, fontSize: 13,
                    cursor: 'pointer',
                  }}
                >
                  {current < questions.length - 1 ? 'Question suivante' : 'Voir les résultats'}
                </button>
              </div>
            )}
          </>
        )}

        {finished && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <Award size={48} style={{ color: T.gold, marginBottom: 14 }} />
            <div style={{ color: T.t1, fontSize: 26, fontWeight: 800, marginBottom: 4 }}>
              {score}/{questions.length}
            </div>
            <div style={{ color: T.t2, fontSize: 14, marginBottom: 24 }}>
              {score === questions.length ? 'Parfait !' : score >= questions.length / 2 ? 'Bien joué !' : 'Continuez à réviser.'}
            </div>
            <button
              onClick={onClose}
              style={{
                background: T.goldDim, color: T.gold,
                border: `1px solid ${T.goldMid}`,
                borderRadius: 8, padding: '9px 22px',
                fontWeight: 700, fontSize: 13, cursor: 'pointer',
              }}
            >
              Fermer
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Block card ────────────────────────────────────────────────────────────────

function BlockCard({ block, onNavigate, onOpenVideo, onOpenQuiz }) {
  const [expanded, setExpanded] = useState(false);
  const type   = block.type || 'summary_block';
  const Icon   = BLOCK_ICONS[type] || BookOpen;
  const ctaLabel = BLOCK_CTA[type] || 'Ouvrir';
  const status = block.status || 'a_faire';
  const duration = block.data?.duration_minutes || null;

  function handleCTA() {
    switch (type) {
      case 'opening_live':
      case 'closure_live':
        onNavigate('/t/isna/live');
        break;
      case 'previsualisation_video':
      case 'doctrinal_video':
        onOpenVideo(block);
        break;
      case 'smartboard_session':
        onNavigate('/studio/smartboard-designer');
        break;
      case 'recall_block':
        onNavigate('/student-school-life/neuro-recall');
        break;
      case 'quiz_block':
        onOpenQuiz(block);
        break;
      case 'friction_block':
      case 'experiment_block':
      case 'mindmap_block':
      case 'summary_block':
        setExpanded((v) => !v);
        break;
      default:
        setExpanded((v) => !v);
    }
  }

  const isExpandable = ['friction_block', 'experiment_block', 'mindmap_block', 'summary_block'].includes(type);

  return (
    <div style={{
      background: T.card,
      border: `1px solid ${status === 'en_cours' ? T.goldMid : T.border}`,
      borderRadius: 10,
      padding: '12px 14px',
      transition: 'border-color 0.2s, box-shadow 0.2s',
      boxShadow: status === 'en_cours' ? `0 0 0 1px ${T.goldMid}, 0 4px 20px rgba(212,175,55,0.08)` : 'none',
    }}>
      {/* Block header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
        <div style={{
          width: 30, height: 30, borderRadius: 8, flexShrink: 0,
          background: (PEDAGOGY_COLORS[type] || PEDAGOGY_COLORS.generic).bg,
          border: `1px solid ${(PEDAGOGY_COLORS[type] || PEDAGOGY_COLORS.generic).border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={14} style={{ color: (PEDAGOGY_COLORS[type] || PEDAGOGY_COLORS.generic).color }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            color: T.t1, fontSize: 12, fontWeight: 600, lineHeight: 1.4,
            overflow: 'hidden', textOverflow: 'ellipsis',
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
          }}>
            {block.title || ctaLabel}
          </div>
        </div>
      </div>

      {/* Status + duration row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
        <StatusBadge status={status} />
        {duration && <DurationChip minutes={duration} />}
      </div>

      {/* CTA */}
      <button
        onClick={handleCTA}
        style={{
          width: '100%',
          background: status === 'termine' ? 'rgba(255,255,255,0.04)' : T.goldDim,
          border: `1px solid ${status === 'termine' ? T.border : T.goldMid}`,
          borderRadius: 7,
          padding: '7px 12px',
          color: status === 'termine' ? T.t3 : T.gold,
          fontSize: 11, fontWeight: 700, letterSpacing: '0.04em',
          cursor: 'pointer',
          textTransform: 'uppercase',
          transition: 'all 0.18s',
        }}
        onMouseEnter={(e) => { if (status !== 'termine') e.currentTarget.style.background = T.goldMid; }}
        onMouseLeave={(e) => { if (status !== 'termine') e.currentTarget.style.background = T.goldDim; }}
      >
        {isExpandable && expanded ? 'Replier' : ctaLabel}
      </button>

      {/* Expanded inline panel */}
      {isExpandable && expanded && (
        <ExpandedPanel block={block} onClose={() => setExpanded(false)} />
      )}
    </div>
  );
}

// ── Day column ────────────────────────────────────────────────────────────────

function DayColumn({ dayLabel, dayDate, dayData, isMobile, onNavigate, onOpenVideo, onOpenQuiz, completedBlocks, onBlockComplete }) {
  const today    = isToday(dayDate);
  const dayTitle = dayData?.title || null;
  const pedagogy = dayData?.pedagogy_type || 'generic';
  const blocks   = dayData?.pedagogical_blocks || [];

  const sortedBlocks = [...blocks].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

  return (
    <div style={{
      background: T.surface,
      border: `1px solid ${today ? T.gold : T.border}`,
      borderRadius: 12,
      overflow: 'hidden',
      flex: isMobile ? undefined : '1 1 0',
      minWidth: 0,
      boxShadow: today ? `0 0 0 1px ${T.goldBright}, 0 8px 30px rgba(212,175,55,0.10)` : 'none',
      transition: 'box-shadow 0.2s',
    }}>
      {/* Day header */}
      <div style={{
        padding: '12px 14px 10px',
        borderBottom: `1px solid ${today ? T.goldMid : T.border}`,
        background: today ? T.goldDim : 'transparent',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{
            color: today ? T.gold : T.t1,
            fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase',
          }}>
            {dayLabel}
          </span>
          {today && (
            <span style={{
              fontSize: 9, fontWeight: 700, letterSpacing: '0.06em',
              color: T.gold, background: T.goldDim,
              border: `1px solid ${T.goldMid}`,
              borderRadius: 20, padding: '2px 7px', textTransform: 'uppercase',
            }}>
              Aujourd'hui
            </span>
          )}
        </div>
        {dayTitle && (
          <div style={{
            color: T.t2, fontSize: 11, marginBottom: 6,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {dayTitle}
          </div>
        )}
        <PedagogyBadge type={pedagogy} />
      </div>

      {/* Blocks */}
      <div style={{ padding: '10px 10px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {!dayData && (
          <p style={{ color: T.t3, fontSize: 11, fontStyle: 'italic', textAlign: 'center', padding: '12px 0' }}>
            Jour non configuré
          </p>
        )}
        {dayData && sortedBlocks.length === 0 && (
          <p style={{ color: T.t3, fontSize: 11, fontStyle: 'italic', textAlign: 'center', padding: '12px 0' }}>
            Aucun bloc
          </p>
        )}
        {sortedBlocks.map((block) => (
          <PedagogicalBlockRenderer
            key={block.id}
            block={block}
            isActive={false}
            isCompleted={completedBlocks ? completedBlocks.has(block.id) : false}
            onComplete={(score) => onBlockComplete && onBlockComplete(block.id, score)}
            onNavigate={(path) => onNavigate(path)}
          />
        ))}
      </div>
    </div>
  );
}

// ── Week progress bar ─────────────────────────────────────────────────────────

function WeekProgressBar({ days }) {
  const allBlocks = days.flatMap((d) => d?.pedagogical_blocks || []);
  const total     = allBlocks.length;
  const done      = allBlocks.filter((b) => b.status === 'termine').length;
  const pct       = total > 0 ? Math.round((done / total) * 100) : 0;

  if (total === 0) return null;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ flex: 1, height: 5, background: 'rgba(255,255,255,0.08)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${pct}%`,
          background: `linear-gradient(90deg, ${T.gold} 0%, ${T.teal} 100%)`,
          borderRadius: 4,
          transition: 'width 0.4s ease',
        }} />
      </div>
      <span style={{ color: T.t2, fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }}>
        {done}/{total} blocs
      </span>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function StudentWeeklySchedulePage() {
  const { user } = useAuth();
  const navigate  = useNavigate();

  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);
  const [noPath,    setNoPath]    = useState(false);

  // school path meta
  const [schoolPath,  setSchoolPath]  = useState(null);  // { id, title, starts_on }
  const [weekOffset,  setWeekOffset]  = useState(0);     // 0 = current week
  const [currentWeek, setCurrentWeek] = useState(null);  // module_week row
  const [weekIndex,   setWeekIndex]   = useState(0);     // global week index from starts_on

  // days data: array indexed 0–4 (Mon–Fri), each = { day_number, pedagogy_type, title, pedagogical_blocks[] }
  const [days, setDays] = useState(Array(5).fill(null));

  // UI state
  const [videoModal, setVideoModal] = useState(null); // { block }
  const [quizModal,  setQuizModal]  = useState(null); // { block }

  // Completed blocks tracking
  const [completedBlocks, setCompletedBlocks] = useState(new Set());

  const markBlockCompleted = (blockId, score) => {
    setCompletedBlocks(prev => {
      const next = new Set([...prev, blockId]);
      // Task A: persist to localStorage (learning_analytics table has no block_id/week_id columns)
      try {
        const weekId = currentWeek?.id;
        const userId = user?.id;
        if (userId && weekId) {
          const storageKey = 'progress_' + userId + '_' + weekId;
          localStorage.setItem(storageKey, JSON.stringify([...next]));
        }
      } catch (_) {
        // silent fail
      }
      return next;
    });
  };

  const [mobile, setMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    function onResize() { setMobile(window.innerWidth < 768); }
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // ── Data loading ─────────────────────────────────────────────────────────────

  const loadWeekData = useCallback(async (pathId, startsOn, offset) => {
    setLoading(true);
    setError(null);
    try {
      const today   = new Date();
      const baseWeek = getMondayOfWeek(startsOn ? new Date(startsOn) : today);
      const nowWeek  = getMondayOfWeek(today);
      const naturalWeekIdx = weeksBetween(baseWeek, nowWeek);
      const targetWeekIdx  = naturalWeekIdx + offset;
      setWeekIndex(targetWeekIdx);

      // Fetch ALL module_weeks for this path in sorted order
      // Walk school_paths → path_courses (course_id) → course_modules → module_weeks
      const { data: pathCourses, error: ce } = await supabase
        .from('path_courses')
        .select('id, course_id')
        .eq('path_id', pathId)
        .order('created_at', { ascending: true });
      if (ce) throw ce;

      if (!pathCourses || pathCourses.length === 0) {
        setCurrentWeek(null);
        setDays(Array(5).fill(null));
        setLoading(false);
        return;
      }

      // Use course_id (FK to courses table) — filter out rows without course_id
      const courseIds = pathCourses
        .map((c) => c.course_id)
        .filter(Boolean);

      if (courseIds.length === 0) {
        setCurrentWeek(null);
        setDays(Array(5).fill(null));
        setLoading(false);
        return;
      }

      const { data: modules, error: me } = await supabase
        .from('course_modules')
        .select('id')
        .in('course_id', courseIds)
        .order('order_index', { ascending: true });
      if (me) throw me;

      if (!modules || modules.length === 0) {
        setCurrentWeek(null);
        setDays(Array(5).fill(null));
        setLoading(false);
        return;
      }

      const moduleIds = modules.map((m) => m.id);

      const { data: weeks, error: we } = await supabase
        .from('module_weeks')
        .select('id, module_id, title, sort_order')
        .in('module_id', moduleIds)
        .order('sort_order', { ascending: true });
      if (we) throw we;

      if (!weeks || weeks.length === 0) {
        setCurrentWeek(null);
        setDays(Array(5).fill(null));
        setLoading(false);
        return;
      }

      const idx  = Math.max(0, Math.min(targetWeekIdx, weeks.length - 1));
      const week = weeks[idx] || null;
      setCurrentWeek(week);

      if (!week) {
        setDays(Array(5).fill(null));
        setLoading(false);
        return;
      }

      // Load week_days + pedagogical_blocks
      const { data: rawDays, error: de } = await supabase
        .from('week_days')
        .select('id, week_id, day_number, title, pedagogy_type, sort_order, pedagogical_blocks(*)')
        .eq('week_id', week.id)
        .order('day_number', { ascending: true });
      if (de) throw de;

      // Map to Mon–Fri (day_number 1–5)
      const mapped = Array(5).fill(null);
      (rawDays || []).forEach((d) => {
        const idx = (d.day_number || 1) - 1;
        if (idx >= 0 && idx < 5) mapped[idx] = d;
      });
      setDays(mapped);

      // Task B: load persisted progress for this week from localStorage
      try {
        const userId = (await supabase.auth.getUser()).data?.user?.id;
        if (userId && week?.id) {
          const storageKey = 'progress_' + userId + '_' + week.id;
          const stored = localStorage.getItem(storageKey);
          if (stored) {
            setCompletedBlocks(new Set(JSON.parse(stored)));
          } else {
            setCompletedBlocks(new Set());
          }
        } else {
          setCompletedBlocks(new Set());
        }
      } catch (_) {
        setCompletedBlocks(new Set());
      }
    } catch (err) {
      console.error('[StudentWeeklySchedulePage] load error', err);
      setError(err?.message || 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load: fetch user profile → school_path_id → school_path
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setError(null);

        const { data: profile, error: pe } = await supabase
          .from('profiles')
          .select('metadata')
          .eq('id', user.id)
          .maybeSingle();
        if (pe) throw pe;

        const pathId = profile?.metadata?.school_path_id;
        if (!pathId) {
          if (!cancelled) { setNoPath(true); setLoading(false); }
          return;
        }

        const { data: path, error: spErr } = await supabase
          .from('school_paths')
          .select('id, title')
          .eq('id', pathId)
          .maybeSingle();
        if (spErr) throw spErr;

        if (!path) {
          if (!cancelled) { setNoPath(true); setLoading(false); }
          return;
        }

        if (!cancelled) {
          // starts_on not in schema — use null (page falls back to current Monday)
          setSchoolPath({ ...path, starts_on: null });
          await loadWeekData(path.id, null, 0);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('[StudentWeeklySchedulePage] init error', err);
          setError(err?.message || 'Erreur de chargement');
          setLoading(false);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [user?.id, loadWeekData]);

  // Week navigation
  function handlePrevWeek() {
    const next = weekOffset - 1;
    setWeekOffset(next);
    if (schoolPath) loadWeekData(schoolPath.id, null, next);
  }
  function handleNextWeek() {
    const next = weekOffset + 1;
    setWeekOffset(next);
    if (schoolPath) loadWeekData(schoolPath.id, null, next);
  }

  // Current week Monday
  const today = new Date();
  const baseMonday = getMondayOfWeek(
    schoolPath?.starts_on ? new Date(schoolPath.starts_on) : today
  );
  const weekMonday = new Date(baseMonday);
  weekMonday.setDate(weekMonday.getDate() + (weekIndex ?? 0) * 7);
  const weekFriday = new Date(weekMonday);
  weekFriday.setDate(weekFriday.getDate() + 4);

  const weekRangeLabel = `${formatDayMonth(weekMonday)} — ${weekFriday.getDate()} ${MONTH_LABELS[weekFriday.getMonth()]} ${weekFriday.getFullYear()}`;
  const weekNavLabel   = `Semaine ${(weekIndex ?? 0) + 1} — ${MONTH_LABELS_FULL[weekMonday.getMonth()]} ${weekMonday.getFullYear()}`;

  // ── Render ────────────────────────────────────────────────────────────────────

  // No path assigned
  if (!loading && noPath) {
    return (
      <div style={{
        minHeight: '100vh', background: T.bg,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: 32, textAlign: 'center',
      }}>
        <AlertCircle size={48} style={{ color: T.t3, marginBottom: 20 }} />
        <h2 style={{ color: T.t1, fontSize: 22, fontWeight: 700, margin: '0 0 10px' }}>
          Aucun parcours assigné
        </h2>
        <p style={{ color: T.t2, fontSize: 14, lineHeight: 1.6, maxWidth: 380, margin: '0 0 28px' }}>
          Vous n'avez pas encore de parcours scolaire. Consultez le catalogue pour rejoindre un programme.
        </p>
        <button
          onClick={() => navigate('/t/isna')}
          style={{
            background: T.goldDim, color: T.gold,
            border: `1px solid ${T.goldMid}`,
            borderRadius: 10, padding: '11px 28px',
            fontWeight: 700, fontSize: 14, cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', gap: 8,
          }}
        >
          <BookOpen size={16} />
          Voir le catalogue
        </button>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: T.bg, color: T.t1, fontFamily: 'inherit' }}>
      {/* Page container */}
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: mobile ? '20px 14px 40px' : '28px 24px 60px' }}>

        {/* ── Header ── */}
        <div style={{ marginBottom: 24 }}>
          {/* Title row */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            flexWrap: 'wrap', gap: 12, marginBottom: 16,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 11,
                background: T.goldDim, border: `1px solid ${T.goldMid}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <Calendar size={19} style={{ color: T.gold }} />
              </div>
              <div>
                <h1 style={{ color: T.t1, fontSize: mobile ? 20 : 24, fontWeight: 800, margin: 0, lineHeight: 1.2 }}>
                  Ma semaine
                </h1>
                <p style={{ color: T.t2, fontSize: 12, margin: 0, marginTop: 2 }}>
                  {weekRangeLabel}
                </p>
              </div>
            </div>

            {/* Week nav */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: T.surface, border: `1px solid ${T.border}`,
              borderRadius: 10, padding: '6px 10px',
            }}>
              <button
                onClick={handlePrevWeek}
                disabled={loading}
                style={{
                  background: 'rgba(255,255,255,0.05)', border: `1px solid ${T.border}`,
                  borderRadius: 7, width: 28, height: 28, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: T.t2, opacity: loading ? 0.4 : 1,
                }}
              >
                <ChevronLeft size={15} />
              </button>
              <span style={{
                color: T.t1, fontSize: 12, fontWeight: 600,
                whiteSpace: 'nowrap', padding: '0 4px',
                minWidth: mobile ? 120 : 160, textAlign: 'center',
              }}>
                {weekNavLabel}
              </span>
              <button
                onClick={handleNextWeek}
                disabled={loading}
                style={{
                  background: 'rgba(255,255,255,0.05)', border: `1px solid ${T.border}`,
                  borderRadius: 7, width: 28, height: 28, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: T.t2, opacity: loading ? 0.4 : 1,
                }}
              >
                <ChevronRight size={15} />
              </button>
            </div>
          </div>

          {/* Week progress bar */}
          {!loading && <WeekProgressBar days={days} />}
          {loading && <Skeleton width="100%" height={5} radius={4} />}

          {/* Week title from module_week */}
          {!loading && currentWeek?.title && (
            <div style={{
              marginTop: 10, color: T.t3, fontSize: 12, fontStyle: 'italic',
            }}>
              {currentWeek.title}
            </div>
          )}
        </div>

        {/* ── Error state ── */}
        {error && (
          <div style={{
            background: T.dangerDim, border: `1px solid ${T.danger}22`,
            borderRadius: 10, padding: '14px 18px',
            display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20,
          }}>
            <AlertCircle size={16} style={{ color: T.danger, flexShrink: 0 }} />
            <span style={{ color: T.danger, fontSize: 13 }}>{error}</span>
          </div>
        )}

        {/* ── Week grid (desktop) / list (mobile) ── */}
        {loading ? (
          <div style={{
            display: 'flex', flexDirection: mobile ? 'column' : 'row',
            gap: 10,
          }}>
            {Array(5).fill(null).map((_, i) => (
              <div
                key={i}
                style={{
                  flex: mobile ? undefined : '1 1 0',
                  background: T.surface, border: `1px solid ${T.border}`,
                  borderRadius: 12, padding: '14px 14px',
                  minHeight: 220,
                }}
              >
                <Skeleton width="70%" height={14} radius={5} />
                <div style={{ marginTop: 10 }}><Skeleton width="45%" height={11} radius={20} /></div>
                <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <Skeleton width="100%" height={70} radius={8} />
                  <Skeleton width="100%" height={70} radius={8} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{
            display: 'flex',
            flexDirection: mobile ? 'column' : 'row',
            gap: 10,
            alignItems: 'stretch',
          }}>
            {Array(5).fill(null).map((_, i) => {
              const { full: dayLabelFull, date: dayDate } = formatDayLabel(weekMonday, i);
              const dayData = days[i];
              return (
                <DayColumn
                  key={i}
                  dayLabel={dayLabelFull}
                  dayDate={dayDate}
                  dayData={dayData}
                  isMobile={mobile}
                  onNavigate={(path) => navigate(path)}
                  onOpenVideo={(block) => setVideoModal({ block })}
                  onOpenQuiz={(block) => setQuizModal({ block })}
                  completedBlocks={completedBlocks}
                  onBlockComplete={markBlockCompleted}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* ── Video modal ── */}
      {videoModal && (
        <VideoModal
          videoUrl={videoModal.block.data?.video_url}
          title={videoModal.block.title}
          onClose={() => setVideoModal(null)}
        />
      )}

      {/* ── Quiz modal ── */}
      {quizModal && (
        <QuizModal
          block={quizModal.block}
          onClose={() => setQuizModal(null)}
        />
      )}
    </div>
  );
}
