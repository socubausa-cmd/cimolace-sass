/**
 * EleveCalendrierAnnuelScreen — Vue élève du programme scolaire annuel
 * Route : /m/eleve/calendrier-annuel
 */
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  CalendarDays, ChevronRight, BookOpen,
  CheckCircle2, Clock, Sparkles, ChevronDown,
  GraduationCap, Star, Loader2, AlertCircle,
  Play, Video,
} from 'lucide-react';
import { EleveMobileShell } from '@/components/eleve-mobile/EleveMobileShell';
import { LiriStatusBar } from '@/pages/eleve-mobile/connection/EleveConnectionLayout';
import { LiriWordmark } from '@/components/brand/LiriWordmark';
import {
  EV_BG, EV_CARD, EV_MUTED, EV_ACCENT, EV_LINE, EV_R, EV_SH,
  EV_PAGE_AMBIENT,
} from '@/pages/eleve-mobile/eleveMobileScreensShared';
import { useAnnualProgram, CURRENT_SCHOOL_YEAR } from '@/hooks/useAnnualProgram';
import { ELEVE_MOBILE } from '@/lib/eleveMobileRoutes';

// ── Couleurs session ──────────────────────────────────────────────────────────
const SESSION_STYLES = {
  cours:      { dot: '#38bdf8', label: 'Cours',       bg: 'rgba(56,189,248,0.1)'  },
  live:       { dot: '#f43f5e', label: 'Live',        bg: 'rgba(244,63,94,0.1)'   },
  atelier:    { dot: '#34d399', label: 'Atelier',     bg: 'rgba(52,211,153,0.1)'  },
  evaluation: { dot: '#D4AF37', label: 'Évaluation',  bg: 'rgba(212,175,55,0.1)'  },
  revision:   { dot: '#a78bfa', label: 'Révision',    bg: 'rgba(167,139,250,0.1)' },
  conge:      { dot: '#475569', label: 'Congé',       bg: 'rgba(71,85,105,0.08)'  },
};

const CYCLE_META = {
  fondements:        { label: 'Fondements',        icon: '📗', color: '#38bdf8' },
  approfondissement: { label: 'Approfondissement',  icon: '📘', color: '#7B61FF' },
  maitrise:          { label: 'Maîtrise',           icon: '📙', color: '#D4AF37' },
};

// ── Helpers surface ───────────────────────────────────────────────────────────
const cardSurface = (active = false) => ({
  background: active
    ? `radial-gradient(ellipse 100% 80% at 10% 0%, rgba(123,97,255,0.18), transparent 65%), ${EV_CARD}`
    : EV_CARD,
  border:     `1px solid ${active ? 'rgba(123,97,255,0.3)' : EV_LINE}`,
  borderRadius: EV_R.lg,
  boxShadow:    active ? `0 0 0 1px rgba(123,97,255,0.15), ${EV_SH.md}` : EV_SH.md,
});

// ── Barre de progression ──────────────────────────────────────────────────────
function ProgressBar({ pct, color = EV_ACCENT }) {
  return (
    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
      <motion.div
        className="h-full rounded-full"
        style={{ background: color }}
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.7, ease: 'easeOut' }}
      />
    </div>
  );
}

// ── Bouton Entrer en Classe ───────────────────────────────────────────────────
function EnterClassBtn({ week, isLive = false, onPress }) {
  return (
    <motion.button
      whileTap={{ scale: 0.96 }}
      onClick={onPress}
      className="w-full flex items-center justify-center gap-2 mt-3 py-2.5 rounded-xl font-bold text-xs"
      style={{
        background: isLive
          ? 'linear-gradient(135deg,#f43f5e,#e11d48)'
          : `linear-gradient(135deg,${EV_ACCENT}30,${EV_ACCENT}15)`,
        color:  isLive ? '#fff' : EV_ACCENT,
        border: isLive ? 'none' : `1px solid ${EV_ACCENT}35`,
        boxShadow: isLive ? '0 0 16px rgba(244,63,94,0.35)' : 'none',
      }}
    >
      {isLive ? <Video size={13} /> : <Play size={13} fill="currentColor" />}
      {isLive ? 'Rejoindre le LIVE' : 'Entrer en classe'}
      <ChevronRight size={12} />
    </motion.button>
  );
}

// ── Card semaine ──────────────────────────────────────────────────────────────
function WeekCard({ week, isCurrent, isExpanded, onToggle, onEnterClass }) {
  const ss = SESSION_STYLES[week.session_type] ?? SESSION_STYLES.cours;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        ...cardSurface(isCurrent),
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {isCurrent && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0,
          height: 2, background: EV_ACCENT,
        }} />
      )}
      <button
        onClick={week.is_holiday ? undefined : onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
      >
        {/* Dot statut */}
        <div className="w-2 h-2 rounded-full shrink-0 mt-0.5"
          style={{ background: week.is_holiday ? '#334155' : ss.dot }} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[9px] font-bold" style={{ color: EV_MUTED }}>
              S{week.week_number} · {week.week_start}
            </span>
            {isCurrent && (
              <span className="text-[8px] px-1.5 py-0.5 rounded-full font-bold"
                style={{ background: `${EV_ACCENT}25`, color: EV_ACCENT }}>
                En cours
              </span>
            )}
          </div>
          <p className="text-white text-xs font-semibold truncate">
            {week.is_holiday
              ? `🌴 ${week.holiday_name ?? 'Congé'}`
              : (week.theme ?? week.module_title ?? `Module ${week.module_number}`)}
          </p>
        </div>

        {/* Badge type */}
        <span className="text-[8px] px-2 py-0.5 rounded-full font-medium shrink-0"
          style={{ background: ss.bg, color: ss.dot }}>
          {ss.label}
        </span>

        {!week.is_holiday && (
          <ChevronDown size={12} color={EV_MUTED}
            style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform .2s', flexShrink: 0 }} />
        )}
      </button>

      <AnimatePresence>
        {isExpanded && !week.is_holiday && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            style={{ overflow: 'hidden', borderTop: `1px solid ${EV_LINE}` }}
          >
            <div className="px-4 py-3 space-y-2.5">
              {week.module_number && (
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-bold uppercase tracking-widest"
                    style={{ color: EV_ACCENT }}>Module {week.module_number}</span>
                  <span className="text-[10px] text-white font-medium">{week.module_title}</span>
                </div>
              )}
              {week.pedagogical_objective && (
                <p className="text-xs leading-relaxed" style={{ color: EV_MUTED }}>
                  🎯 {week.pedagogical_objective}
                </p>
              )}
              {week.liri_segments?.length > 0 && (
                <div>
                  <p className="text-[9px] uppercase tracking-widest mb-1.5" style={{ color: EV_MUTED }}>
                    Segments LIRI
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {week.liri_segments.map(seg => (
                      <span key={seg} className="text-[9px] px-2 py-0.5 rounded-full"
                        style={{ background: 'rgba(56,189,248,0.1)', color: '#38bdf8' }}>
                        {seg}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {week.assignments?.length > 0 && (
                <div>
                  <p className="text-[9px] uppercase tracking-widest mb-1.5" style={{ color: EV_MUTED }}>
                    Travaux
                  </p>
                  {week.assignments.map((a, i) => (
                    <p key={i} className="text-[10px] flex items-start gap-1.5" style={{ color: '#94a3b8' }}>
                      <span style={{ color: EV_ACCENT, marginTop: 1 }}>▸</span>
                      {a.description ?? a}
                    </p>
                  ))}
                </div>
              )}
              {/* Bouton Entrer en classe — uniquement semaine active */}
              {isCurrent && (
                <EnterClassBtn
                  week={week}
                  isLive={week.session_type === 'live'}
                  onPress={() => onEnterClass(week)}
                />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Composant principal ───────────────────────────────────────────────────────
export default function EleveCalendrierAnnuelScreen() {
  const navigate = useNavigate();
  const [activeTrimester, setActiveTrimester] = useState(() => {
    const month = new Date().getMonth() + 1;
    return month <= 4 ? 1 : month <= 8 ? 2 : 3;
  });
  const [expandedWeek, setExpandedWeek] = useState(null);
  const [activeCycle,  setActiveCycle]  = useState('fondements');

  const {
    calendar, weeks, loading, error,
    currentWeek, progressPct, completedCount, totalActive,
    byTrimester, hasProgram, isPublished,
  } = useAnnualProgram({ schoolYear: CURRENT_SCHOOL_YEAR, cycle: activeCycle, autoLoad: true });

  /** Navigue vers la bonne page selon le type de session */
  const handleEnterClass = (week) => {
    if (week?.session_type === 'live') {
      navigate(ELEVE_MOBILE.live);
    } else {
      // Passe weekId + weekNumber en state pour que ClassroomPage sache quoi charger
      navigate(ELEVE_MOBILE.classe, {
        state: {
          weekId:     week?.id,
          weekNumber: week?.week_number,
          weekTitle:  week?.theme ?? week?.module_title,
          fromCalendar: true,
        },
      });
    }
  };

  const trimesterWeeks = (byTrimester[activeTrimester] ?? []);

  return (
    <EleveMobileShell>
      <LiriStatusBar />

      {/* ── Ambient background ──────────────────────────────────────────── */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none',
        background: EV_PAGE_AMBIENT,
      }} />

      <div className="relative z-10 pb-24">

        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="px-4 pt-5 pb-4">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: `${EV_ACCENT}20`, border: `1px solid ${EV_ACCENT}30` }}>
              <CalendarDays size={15} color={EV_ACCENT} />
            </div>
            <div>
              <h1 className="text-white font-bold text-base">Programme Annuel</h1>
              <p className="text-[10px]" style={{ color: EV_MUTED }}>{CURRENT_SCHOOL_YEAR}</p>
            </div>
          </div>
        </div>

        {/* ── Sélecteur cycle ─────────────────────────────────────────── */}
        <div className="px-4 mb-4">
          <div className="flex gap-2 p-1 rounded-xl" style={{ background: EV_CARD, border: `1px solid ${EV_LINE}` }}>
            {Object.entries(CYCLE_META).map(([k, v]) => (
              <button key={k} onClick={() => setActiveCycle(k)}
                className="flex-1 py-2 rounded-lg text-[10px] font-bold transition-all"
                style={{
                  background: activeCycle === k ? `${v.color}20` : 'transparent',
                  color:      activeCycle === k ? v.color : EV_MUTED,
                  border:     activeCycle === k ? `1px solid ${v.color}30` : '1px solid transparent',
                }}>
                {v.icon} {v.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Loading / Erreur ────────────────────────────────────────── */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 size={22} color={EV_ACCENT} className="animate-spin" />
            <p className="text-xs" style={{ color: EV_MUTED }}>Chargement du programme…</p>
          </div>
        )}

        {!loading && error && (
          <div className="mx-4 px-4 py-3 rounded-xl flex items-center gap-2 text-xs"
            style={{ background: 'rgba(244,63,94,0.1)', color: '#f43f5e', border: '1px solid rgba(244,63,94,0.2)' }}>
            <AlertCircle size={13} /> {error}
          </div>
        )}

        {!loading && !error && !hasProgram && (
          <div className="flex flex-col items-center justify-center py-20 gap-4 text-center px-8">
            <span className="text-5xl">📅</span>
            <div>
              <p className="text-white font-bold mb-1">Programme non disponible</p>
              <p className="text-xs leading-relaxed" style={{ color: EV_MUTED }}>
                Le programme {activeCycle} pour {CURRENT_SCHOOL_YEAR} n'a pas encore été publié.
                Contactez votre établissement.
              </p>
            </div>
          </div>
        )}

        {!loading && !error && hasProgram && (
          <>
            {/* ── Résumé progression ────────────────────────────────── */}
            <div className="px-4 mb-4">
              <motion.div style={cardSurface()}>
                <div className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{CYCLE_META[activeCycle]?.icon}</span>
                      <div>
                        <p className="text-white font-bold text-sm">{calendar?.title}</p>
                        <p className="text-[10px]" style={{ color: EV_MUTED }}>
                          {completedCount}/{totalActive} semaines complétées
                        </p>
                      </div>
                    </div>
                    <span className="text-xl font-black" style={{ color: EV_ACCENT }}>
                      {progressPct}%
                    </span>
                  </div>
                  <ProgressBar pct={progressPct} color={CYCLE_META[activeCycle]?.color ?? EV_ACCENT} />
                </div>

                {/* Semaine en cours + bouton Entrer en classe */}
                {currentWeek && !currentWeek.is_holiday && (
                  <div className="px-4 pb-4">
                    <div className="rounded-xl px-3 py-2.5"
                      style={{ background: `${EV_ACCENT}12`, border: `1px solid ${EV_ACCENT}20` }}>
                      <p className="text-[8px] uppercase tracking-widest mb-0.5" style={{ color: EV_ACCENT }}>
                        📍 Cette semaine · S{currentWeek.week_number}
                      </p>
                      <p className="text-white font-semibold text-xs">
                        {currentWeek.theme ?? currentWeek.module_title}
                      </p>
                      {currentWeek.pedagogical_objective && (
                        <p className="text-[10px] mt-0.5 line-clamp-2" style={{ color: EV_MUTED }}>
                          {currentWeek.pedagogical_objective}
                        </p>
                      )}
                      <EnterClassBtn
                        week={currentWeek}
                        isLive={currentWeek.session_type === 'live'}
                        onPress={() => handleEnterClass(currentWeek)}
                      />
                    </div>
                  </div>
                )}
              </motion.div>
            </div>

            {/* ── Onglets trimestres ─────────────────────────────────── */}
            <div className="px-4 mb-3">
              <div className="flex gap-1.5">
                {[1, 2, 3].map(t => (
                  <button key={t} onClick={() => setActiveTrimester(t)}
                    className="flex-1 py-2 rounded-xl text-[10px] font-bold transition-all"
                    style={{
                      background: activeTrimester === t ? `${EV_ACCENT}20` : EV_CARD,
                      color:      activeTrimester === t ? EV_ACCENT : EV_MUTED,
                      border:     `1px solid ${activeTrimester === t ? EV_ACCENT + '35' : EV_LINE}`,
                    }}>
                    Trim. {t}
                    <span className="block text-[8px] font-normal opacity-60">
                      {byTrimester[t]?.length ?? 0} sem.
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* ── Liste semaines ─────────────────────────────────────── */}
            <div className="px-4 space-y-2">
              {trimesterWeeks.length === 0 && (
                <p className="text-center py-10 text-xs" style={{ color: EV_MUTED }}>
                  Aucune semaine active ce trimestre
                </p>
              )}
              {trimesterWeeks.map(w => (
                <WeekCard
                  key={w.id ?? w.week_number}
                  week={w}
                  isCurrent={currentWeek?.week_number === w.week_number}
                  isExpanded={expandedWeek === w.week_number}
                  onToggle={() => setExpandedWeek(n => n === w.week_number ? null : w.week_number)}
                  onEnterClass={handleEnterClass}
                />
              ))}
            </div>

            {/* ── Légende ───────────────────────────────────────────── */}
            <div className="px-4 mt-5">
              <p className="text-[9px] uppercase tracking-widest mb-2" style={{ color: EV_MUTED }}>Légende</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(SESSION_STYLES).filter(([k]) => k !== 'conge').map(([k, v]) => (
                  <span key={k} className="flex items-center gap-1.5 text-[9px] px-2 py-1 rounded-full"
                    style={{ background: v.bg, color: v.dot }}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: v.dot }} />
                    {v.label}
                  </span>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ── Footer ──────────────────────────────────────────────────── */}
        <div className="px-4 mt-8">
          <LiriWordmark className="opacity-20" />
        </div>
      </div>
    </EleveMobileShell>
  );
}
