/**
 * StudentCalendarTimeline — Vue ruban annuel élève
 *
 * Affiche toutes les semaines du programme annuel groupées par trimestre.
 * - Semaine actuelle : mise en évidence + scroll auto
 * - Clic semaine → détail (segments, objectifs, type)
 * - Couleur par statut : completed (vert) / in_progress (or) / planned (gris) / vacances
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronDown, ChevronUp, BookOpen, Star,
  CheckCircle2, Clock, Coffee, Calendar,
} from 'lucide-react';
import { format, isValid } from 'date-fns';
import { fr } from 'date-fns/locale';
import { SESSION_STYLES, WEEK_STATUS_COLOR } from '@/hooks/useStudentCurrentCourse';

// ── Design tokens ─────────────────────────────────────────────────────────────
const T = {
  bg:     '#0f1520',
  card:   '#131c2b',
  line:   'rgba(255,255,255,0.07)',
  muted:  'rgba(255,255,255,0.4)',
  accent: '#D4AF37',
  r:      '12px',
  sh:     '0 4px 20px rgba(0,0,0,0.3)',
};

const TRIMESTER_META = [
  { label: '1er Trimestre', color: '#38bdf8', weeks: '1–14'  },
  { label: '2e Trimestre',  color: '#a78bfa', weeks: '15–28' },
  { label: '3e Trimestre',  color: '#D4AF37', weeks: '29–42' },
];

// ── Pastille semaine ──────────────────────────────────────────────────────────
function WeekPill({ week, isCurrent, isSelected, onClick }) {
  const status  = week.is_holiday ? 'holiday' : (week.status || 'planned');
  const bgColor = week.is_holiday
    ? 'rgba(71,85,105,0.15)'
    : isCurrent
    ? 'rgba(212,175,55,0.2)'
    : status === 'completed'
    ? 'rgba(34,197,94,0.15)'
    : 'rgba(255,255,255,0.04)';

  const borderColor = isCurrent
    ? T.accent
    : isSelected
    ? 'rgba(212,175,55,0.5)'
    : status === 'completed'
    ? 'rgba(34,197,94,0.3)'
    : T.line;

  return (
    <motion.button
      whileTap={{ scale: 0.93 }}
      onClick={() => onClick(week)}
      title={week.theme || week.module_title || `Semaine ${week.week_number}`}
      style={{
        width:        isCurrent ? 44 : 36,
        height:       isCurrent ? 44 : 36,
        borderRadius: '50%',
        background:   bgColor,
        border:       `2px solid ${borderColor}`,
        display:      'flex',
        flexDirection: 'column',
        alignItems:   'center',
        justifyContent: 'center',
        cursor:       'pointer',
        flexShrink:   0,
        position:     'relative',
        transition:   'all 0.2s ease',
      }}
    >
      {/* Numéro */}
      <span style={{
        fontSize:   isCurrent ? 11 : 9,
        fontWeight: isCurrent ? 800 : 500,
        color:      isCurrent ? T.accent : status === 'completed' ? '#22c55e' : week.is_holiday ? '#475569' : T.muted,
        lineHeight: 1,
      }}>
        {week.week_number}
      </span>
      {/* Indicateur statut */}
      {status === 'completed' && !isCurrent && (
        <div style={{
          position:   'absolute', bottom: 2, right: 2,
          width: 7, height: 7, borderRadius: '50%',
          background: '#22c55e',
        }} />
      )}
      {isCurrent && (
        <motion.div
          animate={{ opacity: [1, 0.3, 1] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
          style={{
            position:   'absolute', top: -2, right: -2,
            width: 10, height: 10, borderRadius: '50%',
            background: T.accent,
            border: `2px solid ${T.card}`,
          }}
        />
      )}
    </motion.button>
  );
}

// ── Détail semaine sélectionnée ───────────────────────────────────────────────
function WeekDetail({ week, onClose }) {
  if (!week) return null;

  const ss = SESSION_STYLES[week.session_type] ?? SESSION_STYLES.cours;
  const safeD = (s) => { const d = new Date(s); return isValid(d) ? format(d, 'd MMM yyyy', { locale: fr }) : '—'; };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 4 }}
      style={{
        background:   '#1a2540',
        border:       `1px solid ${T.line}`,
        borderRadius: T.r,
        padding:      16,
        marginTop:    12,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div>
          <span style={{
            fontSize: 10, padding: '2px 8px', borderRadius: 20,
            background: ss.bg, color: ss.dot,
            border: `1px solid ${ss.dot}33`,
            fontWeight: 700, textTransform: 'uppercase',
          }}>
            {ss.label}
          </span>
          <h4 style={{ color: '#fff', fontWeight: 700, fontSize: 15, marginTop: 6, marginBottom: 2 }}>
            {week.theme || week.module_title || `Semaine ${week.week_number}`}
          </h4>
          <p style={{ color: T.muted, fontSize: 12 }}>
            {safeD(week.week_start)} – {safeD(week.week_end)}
          </p>
        </div>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', color: T.muted, cursor: 'pointer', padding: 4 }}
        >
          ✕
        </button>
      </div>

      {week.objectives && (
        <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, lineHeight: 1.5, marginBottom: 10 }}>
          {week.objectives}
        </p>
      )}

      {/* Segments LIRI */}
      {week.liri_segments?.length > 0 && (
        <div>
          <p style={{ fontSize: 10, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6, fontWeight: 600 }}>
            Segments LIRI
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {week.liri_segments.map((seg, i) => (
              <span key={i} style={{
                fontSize: 11, padding: '3px 8px', borderRadius: 20,
                background: 'rgba(212,175,55,0.1)', color: T.accent,
                border: '1px solid rgba(212,175,55,0.2)',
                fontWeight: 600,
              }}>
                {seg}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Statut */}
      <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center' }}>
        <div style={{
          width: 8, height: 8, borderRadius: '50%',
          background: week.is_holiday ? '#475569' : WEEK_STATUS_COLOR[week.status] ?? '#334155',
        }} />
        <span style={{ fontSize: 12, color: T.muted }}>
          {week.is_holiday ? 'Vacances' :
           week.status === 'completed' ? 'Semaine terminée' :
           week.status === 'in_progress' ? 'En cours' :
           'Planifiée'}
        </span>
      </div>
    </motion.div>
  );
}

// ── Composant principal ───────────────────────────────────────────────────────
export default function StudentCalendarTimeline({
  calendarWeeks  = [],
  currentWeek    = null,
  byTrimester    = {},
  completedCount = 0,
  totalActive    = 0,
  progressPct    = 0,
  loading        = false,
  className      = '',
}) {
  const [selectedWeek,      setSelectedWeek]      = useState(null);
  const [expandedTrimester, setExpandedTrimester]  = useState(1);
  const currentPillRef = useRef(null);

  // Scroll auto sur la semaine actuelle
  useEffect(() => {
    if (currentPillRef.current) {
      currentPillRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [currentWeek?.week_number]);

  // Auto-expand le trimestre courant
  useEffect(() => {
    if (!currentWeek) return;
    const t = currentWeek.week_number <= 14 ? 1 : currentWeek.week_number <= 28 ? 2 : 3;
    setExpandedTrimester(t);
  }, [currentWeek?.week_number]);

  const handleWeekClick = useCallback((week) => {
    setSelectedWeek(prev => prev?.id === week.id ? null : week);
  }, []);

  if (loading) {
    return (
      <div style={cardStyle} className={className}>
        <p style={{ color: T.muted, fontSize: 13, textAlign: 'center', padding: '24px 0' }}>
          Chargement du calendrier…
        </p>
      </div>
    );
  }

  if (!calendarWeeks.length) {
    return (
      <div style={{ ...cardStyle, textAlign: 'center', padding: 28 }} className={className}>
        <Calendar size={28} color={T.muted} style={{ margin: '0 auto 10px' }} />
        <p style={{ color: T.muted, fontSize: 13 }}>Aucun programme disponible pour cette période.</p>
      </div>
    );
  }

  return (
    <div style={cardStyle} className={className}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <BookOpen size={18} color={T.accent} />
          <span style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>Calendrier annuel</span>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ color: T.accent, fontWeight: 700, fontSize: 13 }}>{progressPct}%</p>
          <p style={{ color: T.muted, fontSize: 11 }}>{completedCount} / {totalActive} semaines</p>
        </div>
      </div>

      {/* Légende */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        {[
          { color: T.accent,   label: 'Actuelle' },
          { color: '#22c55e',  label: 'Terminée' },
          { color: '#334155',  label: 'Planifiée' },
          { color: '#475569',  label: 'Vacances'  },
        ].map(({ color, label }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
            <span style={{ fontSize: 11, color: T.muted }}>{label}</span>
          </div>
        ))}
      </div>

      {/* Trimestres */}
      {[1, 2, 3].map(t => {
        const weeks    = byTrimester[t] ?? [];
        const meta     = TRIMESTER_META[t - 1];
        const isOpen   = expandedTrimester === t;
        const doneInT  = weeks.filter(w => w.status === 'completed').length;
        const totalInT = weeks.length;
        const pctT     = totalInT > 0 ? Math.round((doneInT / totalInT) * 100) : 0;

        if (!weeks.length) return null;

        return (
          <div key={t} style={{ marginBottom: 12 }}>
            {/* Entête trimestre */}
            <button
              onClick={() => setExpandedTrimester(isOpen ? null : t)}
              style={{
                display:        'flex',
                alignItems:     'center',
                justifyContent: 'space-between',
                width:          '100%',
                background:     'none',
                border:         'none',
                cursor:         'pointer',
                padding:        '8px 0',
                borderBottom:   `1px solid ${T.line}`,
                marginBottom:   isOpen ? 12 : 0,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: meta.color }} />
                <span style={{ color: '#fff', fontWeight: 600, fontSize: 13 }}>{meta.label}</span>
                <span style={{ color: T.muted, fontSize: 11 }}>{meta.weeks}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 11, color: meta.color, fontWeight: 600 }}>{pctT}%</span>
                {isOpen ? <ChevronUp size={14} color={T.muted} /> : <ChevronDown size={14} color={T.muted} />}
              </div>
            </button>

            {/* Barre progression trimestre */}
            {isOpen && (
              <div style={{ marginBottom: 10 }}>
                <div style={{ height: 3, background: 'rgba(255,255,255,0.05)', borderRadius: 2, overflow: 'hidden' }}>
                  <motion.div
                    style={{ height: '100%', background: meta.color, borderRadius: 2 }}
                    initial={{ width: 0 }}
                    animate={{ width: `${pctT}%` }}
                    transition={{ duration: 0.6, ease: 'easeOut' }}
                  />
                </div>
              </div>
            )}

            {/* Pastilles semaines */}
            <AnimatePresence>
              {isOpen && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  style={{ overflow: 'hidden' }}
                >
                  <div style={{
                    display:    'flex',
                    flexWrap:   'wrap',
                    gap:        8,
                    paddingBottom: 4,
                  }}>
                    {weeks.map(week => {
                      const isCurrent  = currentWeek?.id === week.id;
                      const isSelected = selectedWeek?.id === week.id;
                      return (
                        <div
                          key={week.id}
                          ref={isCurrent ? currentPillRef : null}
                        >
                          <WeekPill
                            week={week}
                            isCurrent={isCurrent}
                            isSelected={isSelected}
                            onClick={handleWeekClick}
                          />
                        </div>
                      );
                    })}
                  </div>

                  {/* Détail semaine sélectionnée dans ce trimestre */}
                  <AnimatePresence>
                    {selectedWeek && weeks.some(w => w.id === selectedWeek.id) && (
                      <WeekDetail week={selectedWeek} onClose={() => setSelectedWeek(null)} />
                    )}
                  </AnimatePresence>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}

const cardStyle = {
  background:   T.card,
  border:       `1px solid ${T.line}`,
  borderRadius: T.r,
  padding:      20,
  boxShadow:    T.sh,
};
