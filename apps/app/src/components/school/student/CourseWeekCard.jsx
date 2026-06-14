/**
 * CourseWeekCard — Carte "Cette semaine" de l'élève
 *
 * Affiche :
 *   - Semaine active du programme annuel (titre, module, segments LIRI)
 *   - Bouton "▶ Entrer en Classe" (live actif OU session programmée OU contenu)
 *   - Progression L-Ma-Me-J-V animée
 *   - Badge état : En cours / Live maintenant / Vacances / Pas de programme
 */

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  BookOpen, Play, Video, Calendar, Clock,
  ChevronRight, Sparkles, AlertTriangle, Coffee,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format, isValid, differenceInCalendarDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import { SESSION_STYLES } from '@/hooks/useStudentCurrentCourse';

// ── Design tokens dark ────────────────────────────────────────────────────────
const T = {
  bg:     '#0f1520',
  card:   '#131c2b',
  line:   'rgba(255,255,255,0.07)',
  muted:  'rgba(255,255,255,0.4)',
  accent: '#D4AF37',
  r:      '14px',
  sh:     '0 4px 24px rgba(0,0,0,0.35)',
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function safeDate(str) {
  if (!str) return null;
  const d = new Date(str);
  return isValid(d) ? d : null;
}

function dayProgress(weekStart, weekEnd) {
  const today = new Date();
  const start = safeDate(weekStart);
  const end   = safeDate(weekEnd);
  if (!start || !end) return 0;
  const total  = differenceInCalendarDays(end, start) + 1; // 5 jours
  const passed = Math.max(0, differenceInCalendarDays(today, start));
  return Math.min(1, passed / total);
}

const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven'];

// ── Composant barre jours ─────────────────────────────────────────────────────
function WeekDayBar({ weekStart, weekEnd, accent = T.accent }) {
  const progress  = dayProgress(weekStart, weekEnd);
  const activeDay = Math.floor(progress * 5); // 0-4

  return (
    <div className="flex items-end gap-1.5 w-full">
      {DAYS.map((day, i) => {
        const isDone    = i < activeDay;
        const isCurrent = i === activeDay;
        return (
          <div key={day} className="flex flex-col items-center gap-1 flex-1">
            <motion.div
              className="w-full rounded-full"
              style={{
                height:     isCurrent ? 6 : 4,
                background: isDone
                  ? '#22c55e'
                  : isCurrent
                  ? accent
                  : 'rgba(255,255,255,0.08)',
              }}
              animate={isCurrent ? { opacity: [1, 0.6, 1] } : {}}
              transition={{ repeat: Infinity, duration: 1.8 }}
            />
            <span style={{
              fontSize:   10,
              color:      isCurrent ? '#fff' : T.muted,
              fontWeight: isCurrent ? 700 : 400,
            }}>
              {day}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Segments LIRI pills ───────────────────────────────────────────────────────
function SegmentPills({ segments = [] }) {
  const visible = (Array.isArray(segments) ? segments : []).slice(0, 4);
  if (!visible.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {visible.map((seg, i) => (
        <span
          key={i}
          style={{
            fontSize:        10,
            padding:         '2px 8px',
            borderRadius:    20,
            background:      'rgba(212,175,55,0.12)',
            color:           T.accent,
            border:          '1px solid rgba(212,175,55,0.2)',
            textTransform:   'uppercase',
            letterSpacing:   '0.04em',
            fontWeight:      600,
          }}
        >
          {seg}
        </span>
      ))}
      {segments.length > 4 && (
        <span style={{ fontSize: 10, color: T.muted, alignSelf: 'center' }}>
          +{segments.length - 4}
        </span>
      )}
    </div>
  );
}

// ── Bouton Entrer en Classe ───────────────────────────────────────────────────
function EnterClassButton({ activeLiveSession, nextLiveSession, currentWeek, onClick }) {
  // Priorité : session live active → session programmée → contenu du cours
  if (activeLiveSession) {
    return (
      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={() => onClick('live', activeLiveSession)}
        style={{
          display:        'flex',
          alignItems:     'center',
          gap:            8,
          background:     'linear-gradient(135deg, #f43f5e, #e11d48)',
          color:          '#fff',
          border:         'none',
          borderRadius:   10,
          padding:        '10px 18px',
          fontWeight:     700,
          fontSize:       14,
          cursor:         'pointer',
          width:          '100%',
          justifyContent: 'center',
          boxShadow:      '0 0 20px rgba(244,63,94,0.4)',
        }}
      >
        <motion.div
          animate={{ scale: [1, 1.3, 1] }}
          transition={{ repeat: Infinity, duration: 1.2 }}
          style={{ width: 8, height: 8, borderRadius: '50%', background: '#fff' }}
        />
        <Video size={15} />
        LIVE — Rejoindre maintenant
      </motion.button>
    );
  }

  if (nextLiveSession) {
    const d = safeDate(nextLiveSession.scheduled_at);
    const label = d ? format(d, "EEEE d MMM 'à' HH'h'mm", { locale: fr }) : '';
    return (
      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={() => onClick('scheduled', nextLiveSession)}
        style={{
          display:        'flex',
          alignItems:     'center',
          gap:            8,
          background:     'rgba(212,175,55,0.12)',
          color:          T.accent,
          border:         `1px solid rgba(212,175,55,0.3)`,
          borderRadius:   10,
          padding:        '10px 18px',
          fontWeight:     600,
          fontSize:       13,
          cursor:         'pointer',
          width:          '100%',
          justifyContent: 'center',
        }}
      >
        <Clock size={14} />
        Prochain live : {label}
        <ChevronRight size={14} />
      </motion.button>
    );
  }

  // Pas de live → accès contenu du cours
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      onClick={() => onClick('content', null)}
      style={{
        display:        'flex',
        alignItems:     'center',
        gap:            8,
        background:     `linear-gradient(135deg, rgba(212,175,55,0.2), rgba(212,175,55,0.08))`,
        color:          T.accent,
        border:         `1px solid rgba(212,175,55,0.25)`,
        borderRadius:   10,
        padding:        '10px 18px',
        fontWeight:     700,
        fontSize:       14,
        cursor:         'pointer',
        width:          '100%',
        justifyContent: 'center',
      }}
    >
      <Play size={15} fill="currentColor" />
      Entrer en classe
      <ChevronRight size={14} />
    </motion.button>
  );
}

// ── Composant principal ───────────────────────────────────────────────────────
export default function CourseWeekCard({
  currentWeek,
  activeLiveSession,
  nextLiveSession,
  progressPct       = 0,
  completedCount    = 0,
  totalActive       = 0,
  loading           = false,
  className         = '',
}) {
  const navigate = useNavigate();

  const sessionStyle = useMemo(
    () => SESSION_STYLES[currentWeek?.session_type] ?? SESSION_STYLES.cours,
    [currentWeek?.session_type]
  );

  function handleEnterClass(mode, session) {
    if (mode === 'live' && session?.video_room_url) {
      window.open(session.video_room_url, '_blank', 'noopener');
    } else if (mode === 'live') {
      navigate('/live');
    } else if (mode === 'scheduled') {
      navigate('/classroom');
    } else {
      navigate('/classroom');
    }
  }

  // ── État chargement ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ ...cardStyle, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200 }}>
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
          style={{ width: 24, height: 24, border: `2px solid ${T.accent}`, borderTopColor: 'transparent', borderRadius: '50%' }}
        />
      </div>
    );
  }

  // ── Pas de programme (calendrier non publié) ──────────────────────────────
  if (!currentWeek) {
    return (
      <div style={{ ...cardStyle, textAlign: 'center', padding: 32 }}>
        <Calendar size={32} color={T.muted} style={{ margin: '0 auto 12px' }} />
        <p style={{ color: '#fff', fontWeight: 600, marginBottom: 4 }}>Programme non disponible</p>
        <p style={{ color: T.muted, fontSize: 13 }}>Le calendrier de cette période n'a pas encore été publié.</p>
      </div>
    );
  }

  // ── Vacances ──────────────────────────────────────────────────────────────
  if (currentWeek.is_holiday) {
    return (
      <div style={{ ...cardStyle, textAlign: 'center', padding: 32 }}>
        <Coffee size={32} color={T.accent} style={{ margin: '0 auto 12px' }} />
        <p style={{ color: '#fff', fontWeight: 700, fontSize: 18, marginBottom: 4 }}>Vacances scolaires</p>
        <p style={{ color: T.muted, fontSize: 13 }}>Profites-en pour réviser et te reposer. 🌿</p>
      </div>
    );
  }

  const weekStart = safeDate(currentWeek.week_start);
  const weekEnd   = safeDate(currentWeek.week_end);
  const weekLabel = weekStart && weekEnd
    ? `${format(weekStart, 'd MMM', { locale: fr })} – ${format(weekEnd, 'd MMM', { locale: fr })}`
    : '';

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      style={cardStyle}
      className={className}
    >
      {/* Barre de couleur session en haut */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        height: 3,
        background: activeLiveSession
          ? 'linear-gradient(90deg, #f43f5e, #fb7185)'
          : `linear-gradient(90deg, ${sessionStyle.dot}, ${T.accent})`,
        borderRadius: '14px 14px 0 0',
      }} />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ flex: 1 }}>
          {/* Badges */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
            <span style={{
              fontSize: 10, padding: '2px 8px', borderRadius: 20,
              background: sessionStyle.bg, color: sessionStyle.dot,
              border: `1px solid ${sessionStyle.dot}33`,
              fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
            }}>
              {sessionStyle.label}
            </span>
            {activeLiveSession && (
              <span style={{
                fontSize: 10, padding: '2px 10px', borderRadius: 20,
                background: 'rgba(244,63,94,0.15)', color: '#f43f5e',
                border: '1px solid rgba(244,63,94,0.3)',
                fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
                display: 'flex', alignItems: 'center', gap: 4,
              }}>
                <motion.span
                  animate={{ opacity: [1, 0, 1] }}
                  transition={{ repeat: Infinity, duration: 1 }}
                  style={{ display: 'inline-block', width: 5, height: 5, borderRadius: '50%', background: '#f43f5e' }}
                />
                EN DIRECT
              </span>
            )}
            <span style={{ fontSize: 11, color: T.muted }}>
              Semaine {currentWeek.week_number} · {weekLabel}
            </span>
          </div>

          {/* Titre semaine */}
          <h3 style={{ color: '#fff', fontWeight: 700, fontSize: 18, lineHeight: 1.3, margin: 0 }}>
            {currentWeek.theme || currentWeek.module_title || `Semaine ${currentWeek.week_number}`}
          </h3>
          {currentWeek.module_number && (
            <p style={{ color: T.muted, fontSize: 13, marginTop: 4 }}>
              Module {currentWeek.module_number}
              {currentWeek.objectives && ` · ${String(currentWeek.objectives).slice(0, 60)}…`}
            </p>
          )}
        </div>

        {/* Progression annuelle */}
        <div style={{
          textAlign: 'center',
          background: 'rgba(212,175,55,0.08)',
          border: '1px solid rgba(212,175,55,0.15)',
          borderRadius: 10,
          padding: '8px 14px',
          minWidth: 70,
          flexShrink: 0,
          marginLeft: 12,
        }}>
          <p style={{ color: T.accent, fontSize: 22, fontWeight: 800, margin: 0, lineHeight: 1 }}>{progressPct}%</p>
          <p style={{ color: T.muted, fontSize: 10, marginTop: 2 }}>{completedCount}/{totalActive} sem.</p>
        </div>
      </div>

      {/* Segments LIRI */}
      {currentWeek.liri_segments?.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <p style={{ fontSize: 10, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6, fontWeight: 600 }}>
            Segments LIRI cette semaine
          </p>
          <SegmentPills segments={currentWeek.liri_segments} />
        </div>
      )}

      {/* Barre de progression jours */}
      <div style={{ marginBottom: 16 }}>
        <WeekDayBar weekStart={currentWeek.week_start} weekEnd={currentWeek.week_end} accent={T.accent} />
      </div>

      {/* Barre progression annuelle */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontSize: 11, color: T.muted }}>Progression annuelle</span>
          <span style={{ fontSize: 11, color: T.accent, fontWeight: 700 }}>{progressPct}%</span>
        </div>
        <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden' }}>
          <motion.div
            style={{ height: '100%', background: `linear-gradient(90deg, ${T.accent}, #f59e0b)`, borderRadius: 4 }}
            initial={{ width: 0 }}
            animate={{ width: `${progressPct}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
        </div>
      </div>

      {/* CTA Entrer en Classe */}
      <EnterClassButton
        activeLiveSession={activeLiveSession}
        nextLiveSession={nextLiveSession}
        currentWeek={currentWeek}
        onClick={handleEnterClass}
      />
    </motion.div>
  );
}

// ── Style carte (partagé) ─────────────────────────────────────────────────────
const cardStyle = {
  background:   T.card,
  border:       `1px solid ${T.line}`,
  borderRadius: T.r,
  padding:      24,
  position:     'relative',
  overflow:     'hidden',
  boxShadow:    T.sh,
};
