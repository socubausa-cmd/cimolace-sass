/**
 * StudentDashboardPage — Charte LIRI Prorascience
 * Source design : /Downloads/interface studio/Prorascience Dashboard & Forum.html
 * Tokens : Gold #D4AF37 · Violet #7C3AED · Cyan #00E5FF · Fond #0b0b0f
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useStudentDashboardParityData } from '@/hooks/useStudentDashboardParityData';
import { useStudentCurrentCourse } from '@/hooks/useStudentCurrentCourse';
import { supabase } from '@/lib/customSupabaseClient';

/* ─── Design tokens ─── */
const T = {
  bg:         '#0b0b0f',
  surface:    '#12111a',
  surface2:   '#192734',
  surface3:   '#1e2840',
  border:     'rgba(255,255,255,0.07)',
  borderMid:  'rgba(255,255,255,0.12)',
  gold:       '#D4AF37',
  goldDim:    'rgba(212,175,55,0.12)',
  goldMid:    'rgba(212,175,55,0.28)',
  violet:     '#7C3AED',
  violetDim:  'rgba(124,58,237,0.12)',
  violetMid:  'rgba(124,58,237,0.28)',
  cyan:       '#00E5FF',
  teal:       '#14B8A6',
  success:    '#22C55E',
  successDim: 'rgba(34,197,94,0.10)',
  warning:    '#F59E0B',
  warningDim: 'rgba(245,158,11,0.10)',
  danger:     '#EF4444',
  dangerDim:  'rgba(239,68,68,0.10)',
  t1: '#F5F5F7',
  t2: 'rgba(245,245,247,0.65)',
  t3: 'rgba(245,245,247,0.38)',
  t4: 'rgba(245,245,247,0.16)',
  mono: "'JetBrains Mono','Fira Code',monospace",
};

const ACCENTS = [T.violet, T.cyan, T.teal, T.gold, '#F43F5E', '#38BDF8'];

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1], delay: delay / 1000 },
});

const todayStr = () => {
  const s = new Intl.DateTimeFormat('fr-FR', { weekday:'long', day:'numeric', month:'long', year:'numeric' }).format(new Date());
  return s.charAt(0).toUpperCase() + s.slice(1);
};

/* ─── SVG helpers ─── */
const IconCalendar = ({ col = 'currentColor', size = 14 }) => (
  <svg viewBox="0 0 20 20" width={size} height={size} fill="none">
    <rect x="3" y="4" width="14" height="13" rx="2" stroke={col} strokeWidth="1.5"/>
    <line x1="3" y1="9" x2="17" y2="9" stroke={col} strokeWidth="1.5"/>
    <line x1="7" y1="2" x2="7" y2="6" stroke={col} strokeWidth="1.5" strokeLinecap="round"/>
    <line x1="13" y1="2" x2="13" y2="6" stroke={col} strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);
const IconBook = ({ col = 'currentColor', size = 14 }) => (
  <svg viewBox="0 0 20 20" width={size} height={size} fill="none">
    <path d="M4 3h10a1 1 0 011 1v13a1 1 0 01-1 1H4a1 1 0 01-1-1V4a1 1 0 011-1z" stroke={col} strokeWidth="1.5"/>
    <line x1="3" y1="9" x2="15" y2="9" stroke={col} strokeWidth="1.5"/>
  </svg>
);
const IconChevR = ({ col = 'currentColor', size = 14 }) => (
  <svg viewBox="0 0 20 20" width={size} height={size} fill="none">
    <polyline points="7,5 13,10 7,15" stroke={col} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const IconMsg = ({ col = 'currentColor', size = 14 }) => (
  <svg viewBox="0 0 20 20" width={size} height={size} fill="none">
    <path d="M3 5a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2H7l-4 3V5z" stroke={col} strokeWidth="1.5" strokeLinejoin="round"/>
  </svg>
);
const IconLive = ({ col = 'currentColor', size = 20 }) => (
  <svg viewBox="0 0 20 20" width={size} height={size} fill="none">
    <circle cx="10" cy="10" r="7" stroke={col} strokeWidth="1.5"/>
    <circle cx="10" cy="10" r="3" fill={col}/>
  </svg>
);

/* ═══════════════════════════════ STAT CARD ════════════════════════════════ */
const StatCard = ({ label, value, sub, icon, color, bgColor, delay }) => {
  const [hov, setHov] = useState(false);
  return (
    <motion.div {...fadeUp(delay)}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: T.surface2,
        border: `1px solid ${hov ? color + '50' : T.border}`,
        borderRadius: 14, padding: '16px 18px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        transition: 'all 150ms ease',
        transform: hov ? 'translateY(-1px)' : 'none',
        cursor: 'default',
      }}
    >
      <div>
        <div style={{ fontFamily: T.mono, fontSize: 9, fontWeight: 600, color: T.t3, letterSpacing: '0.10em', marginBottom: 6, textTransform: 'uppercase' }}>
          {label}
        </div>
        <div style={{ fontSize: 24, fontWeight: 700, color: T.t1, letterSpacing: '-0.02em', lineHeight: 1 }}>
          {value}
        </div>
        <div style={{ fontSize: 10, color: T.t3, marginTop: 4 }}>{sub}</div>
      </div>
      <div style={{
        width: 42, height: 42, borderRadius: 12, background: bgColor,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 18, color, fontWeight: 700, flexShrink: 0,
      }}>
        {icon}
      </div>
    </motion.div>
  );
};

/* ═══════════════════════════ FORMATION ROW ════════════════════════════════ */
const FormationRow = ({ f, index, delay, onClick }) => {
  const [hov, setHov] = useState(false);
  const accent = ACCENTS[index % ACCENTS.length];
  const abbr = (f.title || 'F').slice(0, 2).toUpperCase();
  return (
    <motion.div {...fadeUp(delay)}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '12px 16px', borderRadius: 10,
        background: hov ? T.surface3 : T.surface,
        border: `1px solid ${hov ? T.borderMid : T.border}`,
        transition: 'all 150ms ease', cursor: 'pointer',
      }}
    >
      <div style={{
        width: 36, height: 36, borderRadius: 10, flexShrink: 0,
        background: accent + '18', border: `1px solid ${accent}30`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 13, color: accent, fontWeight: 700,
      }}>{abbr}</div>
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <div style={{ fontWeight: 600, fontSize: 13, color: T.t1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {f.title || 'Formation'}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 5 }}>
          <div style={{ flex: 1, height: 3, background: T.border, borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${f.progress || 0}%`, background: accent, borderRadius: 2, transition: 'width 0.6s ease' }}/>
          </div>
          <span style={{ fontFamily: T.mono, fontSize: 10, color: accent, fontWeight: 600, flexShrink: 0 }}>
            {f.progress || 0}%
          </span>
        </div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontFamily: T.mono, fontSize: 10, color: T.t3, marginBottom: 2 }}>
          {f.completed ?? '—'}/{f.total ?? '—'}
        </div>
        <div style={{ fontSize: 10, color: T.t3 }}>modules</div>
      </div>
      <IconChevR col={hov ? T.gold : T.t4} size={14}/>
    </motion.div>
  );
};

/* ═══════════════════════════ AGENDA ITEM ══════════════════════════════════ */
const AgendaItem = ({ item, delay }) => {
  const [hov, setHov] = useState(false);
  const color = item.color || T.gold;
  const isLive = item.type === 'live';
  return (
    <motion.div {...fadeUp(delay)}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '10px 14px', borderRadius: 10,
        background: T.surface, border: `1px solid ${hov ? T.borderMid : T.border}`,
        transition: 'border-color 150ms ease', cursor: 'pointer',
      }}
    >
      <div style={{
        width: 32, height: 32, borderRadius: 9, flexShrink: 0,
        background: color + '15', border: `1px solid ${color}30`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {isLive ? <IconLive col={color} size={14}/> : <IconCalendar col={color} size={14}/>}
      </div>
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <div style={{ fontWeight: 500, fontSize: 12.5, color: T.t1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {item.title}
        </div>
        <div style={{ fontFamily: T.mono, fontSize: 10, color: T.t3, marginTop: 2 }}>{item.date}</div>
      </div>
      {isLive && (
        <div style={{
          fontFamily: T.mono, fontSize: 8, fontWeight: 700,
          color, background: color + '15', border: `1px solid ${color}30`,
          borderRadius: 20, padding: '2px 7px', letterSpacing: '0.08em',
          display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0,
        }}>
          <div style={{ width: 4, height: 4, borderRadius: '50%', background: color, animation: 'dashPulse 1.5s infinite' }}/>
          LIVE
        </div>
      )}
    </motion.div>
  );
};

/* ═══════════════════════════ SECTION LABEL ════════════════════════════════ */
const SectionLabel = ({ label, color = T.gold, onAction, actionLabel }) => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ width: 3, height: 16, background: color, borderRadius: 1 }}/>
      <span style={{ fontFamily: T.mono, fontSize: 10, fontWeight: 700, color: T.t3, letterSpacing: '0.10em' }}>
        {label}
      </span>
    </div>
    {actionLabel && (
      <button onClick={onAction} style={{
        fontFamily: T.mono, fontSize: 9, color, background: 'none', border: 'none',
        letterSpacing: '0.06em', cursor: 'pointer',
      }}>{actionLabel} →</button>
    )}
  </div>
);

/* ═══════════════════════════ LIVE BANNER ══════════════════════════════════ */
const LiveBanner = ({ session }) => {
  const navigate = useNavigate();
  if (!session) return null;
  return (
    <motion.div {...fadeUp(50)} style={{
      background: 'linear-gradient(135deg,rgba(239,68,68,0.12),rgba(124,58,237,0.08))',
      border: '1px solid rgba(239,68,68,0.25)',
      borderRadius: 14, padding: '14px 18px', marginBottom: 24,
      display: 'flex', alignItems: 'center', gap: 14,
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: 12, flexShrink: 0,
        background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.30)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <IconLive col={T.danger} size={20}/>
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
          <div style={{
            fontFamily: T.mono, fontSize: 9, fontWeight: 700, color: T.danger,
            letterSpacing: '0.10em', background: 'rgba(239,68,68,0.12)',
            border: '1px solid rgba(239,68,68,0.25)', borderRadius: 20, padding: '2px 8px',
            display: 'flex', alignItems: 'center', gap: 4,
          }}>
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: T.danger, animation: 'dashPulse 1.4s infinite' }}/>
            EN DIRECT
          </div>
          <span style={{ fontWeight: 600, fontSize: 13, color: T.t1 }}>
            {session.title || session.topic || 'Session Live en cours'}
          </span>
        </div>
        <div style={{ fontSize: 11, color: T.t3 }}>Cliquez pour rejoindre la session</div>
      </div>
      <button onClick={() => navigate('/classroom')} style={{
        display: 'flex', alignItems: 'center', gap: 7,
        background: T.danger, border: 'none', borderRadius: 9,
        padding: '8px 16px', fontWeight: 700, fontSize: 12,
        color: 'white', cursor: 'pointer', flexShrink: 0, transition: 'opacity 150ms ease',
      }}
        onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
        onMouseLeave={e => e.currentTarget.style.opacity = '1'}
      >
        Rejoindre →
      </button>
    </motion.div>
  );
};

/* ═══════════════════════════ EMPTY STATE ══════════════════════════════════ */
const EmptyState = ({ icon, text, action, onAction }) => (
  <div style={{
    textAlign: 'center', padding: '28px 16px',
    background: T.surface, border: `1px solid ${T.border}`,
    borderRadius: 14, color: T.t3, fontSize: 12,
  }}>
    <div style={{ fontSize: 20, marginBottom: 8, opacity: 0.4 }}>{icon}</div>
    <div style={{ marginBottom: action ? 10 : 0 }}>{text}</div>
    {action && (
      <button onClick={onAction} style={{
        fontFamily: T.mono, fontSize: 10, color: T.gold,
        background: T.goldDim, border: `1px solid ${T.goldMid}`,
        borderRadius: 8, padding: '5px 12px', cursor: 'pointer',
        letterSpacing: '0.05em', fontWeight: 600,
      }}>{action}</button>
    )}
  </div>
);

/* ═══════════════════════════ MAIN COMPONENT ═══════════════════════════════ */
const StudentDashboardPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const userId = user?.id;

  const {
    formations = [],
    absences = [],
    delays = [],
    evaluations = [],
    agenda = [],
    loading,
  } = useStudentDashboardParityData(userId);

  const {
    activeLiveSession,
    progressPct = 0,
    completedCount = 0,
    totalActive = 0,
  } = useStudentCurrentCourse({ userId });

  /* ── Recent forum posts (real data) ── */
  const [recentPosts, setRecentPosts] = useState([]);
  const [formationTitleMap, setFormationTitleMap] = useState({});

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data: posts } = await supabase
        .from('formation_student_questions')
        .select('id,question,formation_id,created_at,reply_count')
        .eq('is_public', true)
        .order('created_at', { ascending: false })
        .limit(3);

      if (!alive || !posts?.length) return;
      setRecentPosts(posts);

      const fIds = [...new Set(posts.map(p => p.formation_id).filter(Boolean))];
      if (fIds.length) {
        const { data: courses } = await supabase
          .from('courses')
          .select('id,title')
          .in('id', fIds);
        if (!alive) return;
        const map = {};
        (courses || []).forEach(c => { map[c.id] = c.title; });
        setFormationTitleMap(map);
      }
    })();
    return () => { alive = false; };
  }, []);

  /* ── Agenda items — hook maps start_at → ev.date ── */
  const agendaItems = agenda.slice(0, 4).map(ev => {
    const raw = ev.date || ev.start_date || ev.start_at || null;
    const dateLabel = raw
      ? (() => { try { return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(raw)); } catch { return '—'; } })()
      : '—';
    const titleLower = (ev.title || '').toLowerCase();
    const isLive  = titleLower.includes('live') || titleLower.includes('session');
    const isEval  = titleLower.includes('examen') || titleLower.includes('évaluation');
    return {
      id: ev.id,
      title: ev.title || 'Événement',
      date: dateLabel,
      type: isLive ? 'live' : isEval ? 'eval' : 'devoir',
      color: isLive ? T.danger : isEval ? T.violet : T.warning,
    };
  });

  /* ── Stats — hook pre-filters absences/delays by status ── */
  const absenceCount = absences.length;
  const delayCount   = delays.length;
  const avgNote = evaluations.length
    ? (evaluations.reduce((s, e) => s + (e.max > 0 ? (e.score / e.max) * 20 : 0), 0) / evaluations.length).toFixed(1)
    : null;

  const STATS = [
    { label: 'Moyenne Générale', value: avgNote ? `${avgNote}/20` : '—/20', sub: evaluations.length ? `${evaluations.length} éval.` : 'Aucune évaluation', icon: '◈', color: T.gold, bgColor: T.goldDim },
    { label: 'Semaines Validées', value: totalActive ? `${completedCount}/${totalActive}` : '—', sub: totalActive ? `${Math.round(progressPct)}% du parcours` : 'Non démarré', icon: '✓', color: T.success, bgColor: T.successDim },
    { label: 'Absences', value: String(absenceCount), sub: 'Cette année scolaire', icon: '!', color: T.danger, bgColor: T.dangerDim },
    { label: 'Retards', value: String(delayCount), sub: 'Cette semaine', icon: '◷', color: T.warning, bgColor: T.warningDim },
  ];

  /* ── Formations with accent colors ── */
  const formationsRich = formations.slice(0, 5).map((f, i) => ({
    ...f,
    accentColor: ACCENTS[i % ACCENTS.length],
  }));

  const avgProgress = formationsRich.length
    ? Math.round(formationsRich.reduce((s, f) => s + (f.progress || 0), 0) / formationsRich.length)
    : 0;

  /* ── Loader ── */
  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 28, height: 28, border: `2px solid ${T.goldMid}`, borderTopColor: T.gold, borderRadius: '50%', margin: '0 auto 12px', animation: 'dashSpin 0.8s linear infinite' }}/>
          <div style={{ fontFamily: T.mono, fontSize: 10, letterSpacing: '0.1em', color: T.t3 }}>CHARGEMENT</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100%', paddingBottom: 48 }}>
      <style>{`
        @keyframes dashSpin  { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes dashPulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
      `}</style>

      {/* ── Header ── */}
      <motion.div {...fadeUp(0)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: T.t1, letterSpacing: '-0.025em', marginBottom: 4, lineHeight: 1.2 }}>
            Tableau de Bord
          </h1>
          <p style={{ fontSize: 13, color: T.t3 }}>Bienvenue, voici votre aperçu hebdomadaire.</p>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontFamily: T.mono, fontSize: 11, color: T.gold, fontWeight: 600 }}>{todayStr()}</div>
          <div style={{ fontFamily: T.mono, fontSize: 9, color: T.t3, marginTop: 2 }}>Année Académique 2025–2026</div>
        </div>
      </motion.div>

      {/* ── Live banner (si session active) ── */}
      <LiveBanner session={activeLiveSession}/>

      {/* ── 4 stat cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 24 }}>
        {STATS.map((s, i) => <StatCard key={s.label} {...s} delay={i * 60}/>)}
      </div>

      {/* ── Main 2-col grid ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20 }}>

        {/* ── Left col ── */}
        <div>
          <SectionLabel label="MES FORMATIONS" color={T.gold} actionLabel="VOIR TOUT" onAction={() => navigate('formations')}/>
          {formationsRich.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {formationsRich.map((f, i) => (
                <FormationRow key={f.id} f={f} index={i} delay={300 + i * 60} onClick={() => navigate('formations')}/>
              ))}
            </div>
          ) : (
            <EmptyState icon="📚" text="Aucune formation inscrite" action="Explorer le catalogue →" onAction={() => navigate('/catalogue')}/>
          )}

          {/* Forum activity */}
          <div style={{ marginTop: 28 }}>
            <SectionLabel label="ACTIVITÉ FORUM" color={T.violet} actionLabel="VOIR TOUT" onAction={() => navigate('forum')}/>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {recentPosts.length === 0 ? (
                <EmptyState icon="◷" text="Aucune activité forum récente" action="Aller au forum →" onAction={() => navigate('forum')}/>
              ) : recentPosts.map((p, i) => {
                const fTitle = formationTitleMap[p.formation_id] || 'Forum';
                const relDate = (() => {
                  if (!p.created_at) return '';
                  const d = new Date(p.created_at);
                  const diffDays = Math.floor((Date.now() - d.getTime()) / 86400000);
                  if (diffDays === 0) return "Aujourd'hui";
                  if (diffDays === 1) return 'Hier';
                  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
                })();
                return (
                  <motion.div key={p.id} {...fadeUp(600 + i * 60)}
                    onClick={() => navigate(`forum/thread/${p.id}`)}
                    style={{
                      display: 'flex', alignItems: 'flex-start', gap: 10,
                      padding: '10px 14px', borderRadius: 10,
                      background: T.surface, border: `1px solid ${T.border}`,
                      cursor: 'pointer', transition: 'border-color 150ms ease',
                    }}
                    whileHover={{ borderColor: T.borderMid }}
                  >
                    <IconMsg col={T.t3} size={13}/>
                    <div style={{ flex: 1, overflow: 'hidden' }}>
                      <div style={{ fontSize: 12.5, fontWeight: 500, color: T.t1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 3 }}>
                        {p.question}
                      </div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span style={{ fontFamily: T.mono, fontSize: 9, color: T.violet, background: T.violetDim, borderRadius: 4, padding: '1px 5px' }}>{fTitle}</span>
                        <span style={{ fontFamily: T.mono, fontSize: 9, color: T.t3 }}>{p.reply_count || 0} rép.</span>
                        <span style={{ fontFamily: T.mono, fontSize: 9, color: T.t3 }}>{relDate}</span>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Right col ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Agenda */}
          <motion.div {...fadeUp(200)} style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ padding: '14px 16px 12px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <IconCalendar col={T.gold} size={14}/>
                <span style={{ fontWeight: 700, fontSize: 13, color: T.t1 }}>Agenda</span>
              </div>
              <button onClick={() => navigate('agenda')} style={{ fontFamily: T.mono, fontSize: 8, color: T.gold, background: 'none', border: 'none', letterSpacing: '0.06em', cursor: 'pointer' }}>
                VOIR TOUT
              </button>
            </div>
            <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {agendaItems.length > 0
                ? agendaItems.map((item, i) => <AgendaItem key={item.id} item={item} delay={400 + i * 60}/>)
                : <EmptyState icon="📅" text="Aucun événement à venir"/>
              }
            </div>
          </motion.div>

          {/* Progression globale */}
          <motion.div {...fadeUp(280)} style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ padding: '14px 16px 12px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', gap: 7 }}>
              <IconBook col={T.violet} size={14}/>
              <span style={{ fontWeight: 700, fontSize: 13, color: T.t1 }}>Progression globale</span>
            </div>
            <div style={{ padding: '14px 16px' }}>
              {formationsRich.length > 0 ? (
                <>
                  {formationsRich.map((f) => (
                    <div key={f.id} style={{ marginBottom: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                        <span style={{ fontSize: 11, color: T.t2, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '72%' }}>
                          {f.title}
                        </span>
                        <span style={{ fontFamily: T.mono, fontSize: 10, color: f.accentColor, fontWeight: 600 }}>{f.progress}%</span>
                      </div>
                      <div style={{ height: 4, background: T.border, borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${f.progress}%`, background: `linear-gradient(90deg,${f.accentColor}99,${f.accentColor})`, borderRadius: 2, transition: 'width 0.6s ease' }}/>
                      </div>
                    </div>
                  ))}
                  <div style={{ marginTop: 4, padding: '12px 0 0', borderTop: `1px solid ${T.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontFamily: T.mono, fontSize: 9, color: T.t3, letterSpacing: '0.06em' }}>MOYENNE</span>
                    <span style={{ fontFamily: T.mono, fontSize: 14, fontWeight: 700, color: T.gold, background: T.goldDim, border: `1px solid ${T.goldMid}`, borderRadius: 8, padding: '3px 10px' }}>
                      {avgProgress}%
                    </span>
                  </div>
                </>
              ) : (
                <div style={{ fontSize: 11, color: T.t3, textAlign: 'center', padding: '8px 0' }}>Aucune formation active</div>
              )}
            </div>
          </motion.div>

          {/* Quick nav links */}
          <motion.div {...fadeUp(360)} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {[
              { label: 'Évaluations', icon: '⊛', path: 'evaluations', color: T.violet },
              { label: 'Notes',       icon: '◈', path: 'notes',       color: T.gold   },
              { label: 'Absences',    icon: '!',  path: 'absences',    color: T.danger },
              { label: 'Documents',   icon: '⊡', path: 'documents',   color: T.teal   },
            ].map(item => (
              <button key={item.label} onClick={() => navigate(item.path)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '10px 12px', borderRadius: 8,
                  background: T.surface, border: `1px solid ${T.border}`,
                  color: T.t2, fontSize: 12, fontWeight: 500,
                  cursor: 'pointer', transition: 'all 150ms ease', textAlign: 'left',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = item.color + '40'; e.currentTarget.style.color = item.color; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.t2; }}
              >
                <span style={{ fontSize: 14 }}>{item.icon}</span>
                {item.label}
              </button>
            ))}
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default StudentDashboardPage;
