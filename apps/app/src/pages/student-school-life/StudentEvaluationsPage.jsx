import React, { useEffect, useMemo, useState } from 'react';
import {
  ClipboardCheck, CalendarCheck, Clock, MapPin, ChevronDown,
  Award, FileText, MessageSquareText, Inbox,
} from 'lucide-react';
import { format, isValid } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useDemoMode } from '@/contexts/DemoModeContext';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useStudentEvaluationsParityData } from '@/hooks/useStudentEvaluationsParityData';
import { supabase } from '@/lib/customSupabaseClient';

/* ─── Thème ISNA (navy + or) ─── */
const T = {
  surface:   '#12111a',
  surface2:  'rgba(25,39,52,0.5)',
  border:    'rgba(255,255,255,0.07)',
  borderMid: 'rgba(255,255,255,0.12)',
  gold:      '#D4AF37',
  goldDim:   'rgba(212,175,55,0.12)',
  goldMid:   'rgba(212,175,55,0.28)',
  success:   '#22C55E',
  warning:   '#F59E0B',
  danger:    '#EF4444',
  t1: '#F5F5F7',
  t2: 'rgba(245,245,247,0.65)',
  t3: 'rgba(245,245,247,0.38)',
  t4: 'rgba(245,245,247,0.16)',
  mono: "'JetBrains Mono','Fira Code',monospace",
};

/* ─── Helpers ─── */
const norm = (s) =>
  String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

const isEvalLike = (text) => /(exam|evalu|controle|quiz|test|partiel|interro|devoir)/.test(norm(text));

const safeFormat = (input, fmt) => {
  if (!input) return '';
  const d = new Date(input);
  return isValid(d) ? format(d, fmt, { locale: fr }) : '';
};

const frNum = (n) => {
  if (n == null || Number.isNaN(Number(n))) return '—';
  const v = Number(n);
  const s = Number.isInteger(v) ? String(v) : v.toFixed(1);
  return s.replace('.', ',');
};

// Note normalisée /20 → couleur (≥16 vert, ≥10 or, <10 rouge)
const scoreTone = (norm20) => {
  if (norm20 == null) return { col: T.t2, bg: 'rgba(255,255,255,0.04)', bd: T.border };
  if (norm20 >= 16) return { col: T.success, bg: 'rgba(34,197,94,0.12)',  bd: 'rgba(34,197,94,0.30)' };
  if (norm20 >= 10) return { col: T.gold,    bg: T.goldDim,                bd: T.goldMid };
  return { col: T.danger, bg: 'rgba(239,68,68,0.12)', bd: 'rgba(239,68,68,0.32)' };
};

/* ─── Boutons (verbatim Agenda) ─── */
const Btn = ({ children, onClick, variant = 'ghost', disabled, title, style: extra }) => {
  const [hov, setHov] = useState(false);
  const gold = variant === 'gold';
  const style = {
    display: 'inline-flex', alignItems: 'center', gap: 7, borderRadius: 10,
    padding: '8px 14px', fontSize: 12.5, fontWeight: 600, fontFamily: 'inherit',
    cursor: disabled ? 'default' : 'pointer', textDecoration: 'none',
    transition: 'all 150ms ease', whiteSpace: 'nowrap',
    background: gold ? (hov && !disabled ? '#E5C66B' : T.gold) : (hov ? T.surface2 : 'transparent'),
    color: gold ? '#000' : (hov ? T.t1 : T.t2),
    border: gold ? '1px solid transparent' : `1px solid ${hov ? T.borderMid : T.border}`,
    opacity: disabled ? 0.55 : 1, ...extra,
  };
  const handlers = { onMouseEnter: () => setHov(true), onMouseLeave: () => setHov(false) };
  return <button onClick={onClick} disabled={disabled} style={style} title={title} {...handlers}>{children}</button>;
};

/* ─── FilterPill (verbatim Agenda) ─── */
const FilterPill = ({ active, label, count, onClick }) => {
  const [hov, setHov] = useState(false);
  return (
    <button onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 7,
        background: active ? T.gold : hov ? T.surface2 : 'transparent',
        border: `1px solid ${active ? 'transparent' : hov ? T.goldMid : T.border}`,
        borderRadius: 999, padding: '7px 14px', fontSize: 12.5, fontWeight: 600, fontFamily: 'inherit',
        color: active ? '#000' : hov ? T.gold : T.t2, cursor: 'pointer', transition: 'all 160ms ease', whiteSpace: 'nowrap',
      }}>
      {label}
      {count != null && count > 0 && (
        <span style={{
          fontFamily: T.mono, fontSize: 10, fontWeight: 700,
          color: active ? '#000' : T.gold, background: active ? 'rgba(0,0,0,0.14)' : T.goldDim,
          borderRadius: 999, padding: '0 6px', minWidth: 16, textAlign: 'center',
        }}>{count}</span>
      )}
    </button>
  );
};

/* ─── Petit badge type ─── */
const Pill = ({ children, col, bg, bd }) => (
  <span style={{
    fontFamily: T.mono, fontSize: 9.5, fontWeight: 700, letterSpacing: '0.04em',
    color: col, background: bg, border: `1px solid ${bd}`,
    borderRadius: 20, padding: '2px 9px', textTransform: 'uppercase', whiteSpace: 'nowrap',
  }}>{children}</span>
);

/* ─── Ligne « À venir » ─── */
const UpcomingRow = ({ ev, onDetails, delay }) => {
  const [hov, setHov] = useState(false);
  const ok = isValid(new Date(ev.date));
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px',
        background: hov ? 'rgba(25,39,52,0.6)' : 'rgba(25,39,52,0.34)',
        border: `1px solid ${hov ? T.goldMid : T.border}`, borderRadius: 14,
        transition: 'all 160ms ease', transform: hov ? 'translateY(-1px)' : 'none',
        animation: `evFade .4s ease ${delay}ms both`,
      }}>
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        minWidth: 58, height: 58, borderRadius: 12, background: 'rgba(0,0,0,0.28)', border: `1px solid ${T.border}`, flexShrink: 0,
      }}>
        <span style={{ fontFamily: T.mono, fontSize: 9.5, fontWeight: 700, color: T.gold, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          {ok ? safeFormat(ev.date, 'MMM') : '—'}
        </span>
        <span style={{ fontSize: 20, fontWeight: 700, color: T.t1, lineHeight: 1 }}>
          {ok ? safeFormat(ev.date, 'dd') : '--'}
        </span>
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5, flexWrap: 'wrap' }}>
          <Pill col="#F0936B" bg="rgba(240,147,107,0.13)" bd="rgba(240,147,107,0.32)">À venir</Pill>
          <span style={{ fontSize: 14.5, fontWeight: 600, color: T.t1 }}>{ev.title}</span>
        </div>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 12, color: T.t3, alignItems: 'center' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <Clock size={13} /> {ok ? safeFormat(ev.date, "EEE d MMM '·' HH:mm") : 'Date à confirmer'}
          </span>
          {ev.location && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <MapPin size={13} /> {ev.location}
            </span>
          )}
        </div>
      </div>

      <Btn onClick={() => onDetails(ev)} style={{ flexShrink: 0 }}>
        <FileText size={14} /> Voir détails
      </Btn>
    </div>
  );
};

/* ─── Ligne « Terminée » (expand → appréciation) ─── */
const DoneRow = ({ ev, onToggle, expanded, delay }) => {
  const [hov, setHov] = useState(false);
  const tone = scoreTone(ev.norm20);
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: hov || expanded ? 'rgba(25,39,52,0.6)' : 'rgba(25,39,52,0.34)',
        border: `1px solid ${hov || expanded ? T.goldMid : T.border}`, borderRadius: 14,
        transition: 'all 160ms ease', transform: hov && !expanded ? 'translateY(-1px)' : 'none',
        animation: `evFade .4s ease ${delay}ms both`, overflow: 'hidden',
      }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px' }}>
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          minWidth: 58, height: 58, borderRadius: 12, background: tone.bg, border: `1px solid ${tone.bd}`, flexShrink: 0,
        }}>
          <span style={{ fontSize: 17, fontWeight: 800, color: tone.col, lineHeight: 1, fontFamily: T.mono }}>
            {ev.norm20 == null ? '—' : frNum(ev.norm20)}
          </span>
          <span style={{ fontFamily: T.mono, fontSize: 9, fontWeight: 700, color: tone.col, opacity: 0.7, marginTop: 2 }}>/ 20</span>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5, flexWrap: 'wrap' }}>
            {ev.type && <Pill col={T.t2} bg="rgba(255,255,255,0.05)" bd={T.border}>{ev.type}</Pill>}
            <span style={{ fontSize: 14.5, fontWeight: 600, color: T.t1 }}>{ev.title}</span>
          </div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 12, color: T.t3, alignItems: 'center' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <CalendarCheck size={13} /> {safeFormat(ev.date, 'd MMM yyyy') || 'Date inconnue'}
            </span>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              fontFamily: T.mono, fontWeight: 700, color: tone.col,
              background: tone.bg, border: `1px solid ${tone.bd}`, borderRadius: 8, padding: '1px 8px',
            }}>
              {frNum(ev.score)} / {frNum(ev.maxScore)}
            </span>
          </div>
        </div>

        <Btn onClick={() => onToggle(ev)} style={{ flexShrink: 0 }} title={ev.comment ? 'Voir l’appréciation' : 'Aucune appréciation'}>
          <MessageSquareText size={14} /> Revoir
          <ChevronDown size={14} style={{ transition: 'transform 180ms ease', transform: expanded ? 'rotate(180deg)' : 'none' }} />
        </Btn>
      </div>

      {expanded && (
        <div style={{
          padding: '0 16px 15px 16px', animation: 'evFade .25s ease both',
        }}>
          <div style={{
            display: 'flex', gap: 10, padding: '12px 14px', borderRadius: 12,
            background: 'rgba(0,0,0,0.24)', border: `1px solid ${T.border}`,
          }}>
            <MessageSquareText size={15} color={T.gold} style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ minWidth: 0 }}>
              <div style={{
                fontFamily: T.mono, fontSize: 9.5, fontWeight: 700, letterSpacing: '0.05em',
                color: T.gold, textTransform: 'uppercase', marginBottom: 4,
              }}>Appréciation</div>
              <p style={{ fontSize: 13, color: T.t2, lineHeight: 1.55, margin: 0 }}>
                {ev.comment && String(ev.comment).trim()
                  ? ev.comment
                  : 'Aucune appréciation n’a été laissée pour cette évaluation.'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* ─── État vide ─── */
const EmptyState = ({ icon: Icon, text }) => (
  <div style={{
    textAlign: 'center', padding: '44px 24px', color: T.t3, fontSize: 13,
    background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14,
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
  }}>
    <Icon size={26} color={T.t4} />
    {text}
  </div>
);

/* ═══════════════════════ PAGE ═══════════════════════ */
const StudentEvaluationsPage = () => {
  const { isDemoMode, demoData, restrictedAction } = useDemoMode();
  const { user } = useAuth();
  // Upcoming réutilise le hook (déjà filtré exam/évaluation, start_at ≥ maintenant)
  const { upcomingRows } = useStudentEvaluationsParityData(isDemoMode ? null : user?.id);

  // Completed : requête directe (le hook n'expose pas comment/type)
  const [doneRows, setDoneRows] = useState([]);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    if (isDemoMode || !user?.id) { setDoneRows([]); return; }
    let alive = true;
    (async () => {
      const { data, error } = await supabase
        .from('student_evaluations')
        .select('id,title,score,max_score,evaluated_at,comment,type')
        .eq('student_id', user.id)
        .order('evaluated_at', { ascending: false });
      if (!alive) return;
      setDoneRows(error ? [] : (Array.isArray(data) ? data : []));
    })();
    return () => { alive = false; };
  }, [isDemoMode, user?.id]);

  /* ─── Normalisation ─── */
  const upcoming = useMemo(() => {
    if (isDemoMode) {
      return (demoData?.evaluations?.upcoming || []).map((r) => ({
        id: r.id, title: r.title || 'Évaluation', date: r.date, location: r.module || null,
      }));
    }
    return (upcomingRows || [])
      .filter((r) => isEvalLike(`${r.title || ''} ${r.description || ''}`))
      .map((r) => ({
        id: r.id,
        title: r.title || 'Évaluation',
        date: r.start_at,
        location: r.location || null,
      }));
  }, [isDemoMode, demoData, upcomingRows]);

  const completed = useMemo(() => {
    const rows = isDemoMode
      ? (demoData?.evaluations?.completed || []).map((r) => ({
          id: r.id, title: r.title, score: r.score, max_score: r.maxScore,
          evaluated_at: r.date, comment: null, type: r.module || null,
        }))
      : doneRows;
    return rows.map((r) => {
      const score = r.score == null ? null : Number(r.score);
      const maxScore = r.max_score == null || Number(r.max_score) === 0 ? 20 : Number(r.max_score);
      const norm20 = score == null ? null : Math.max(0, Math.min(20, (score / maxScore) * 20));
      return {
        id: r.id,
        title: r.title || 'Évaluation',
        score,
        maxScore,
        norm20,
        date: r.evaluated_at,
        comment: r.comment ?? null,
        type: r.type ?? null,
      };
    });
  }, [isDemoMode, demoData, doneRows]);

  /* ─── Moyenne générale (/20) ─── */
  const average = useMemo(() => {
    const vals = completed.map((e) => e.norm20).filter((v) => v != null && !Number.isNaN(v));
    if (!vals.length) return null;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  }, [completed]);
  const avgTone = scoreTone(average);

  /* ─── Onglet par défaut ─── */
  const [tab, setTab] = useState('upcoming');
  const [tabPinned, setTabPinned] = useState(false);
  useEffect(() => {
    if (tabPinned) return;
    setTab(upcoming.length > 0 ? 'upcoming' : completed.length > 0 ? 'completed' : 'upcoming');
  }, [upcoming.length, completed.length, tabPinned]);
  const pickTab = (v) => { setTabPinned(true); setTab(v); };

  /* ─── Handlers ─── */
  const handleDetails = (ev) => restrictedAction(`Détails : ${ev.title}`);
  const handleToggle = (ev) => {
    if (isDemoMode) { restrictedAction('Revoir l’appréciation'); return; }
    setExpandedId((cur) => (cur === ev.id ? null : ev.id));
  };

  const totalCount = upcoming.length + completed.length;

  return (
    <div style={{ paddingBottom: 8 }}>
      <style>{`
        @keyframes evFade { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: translateY(0) } }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 14, background: T.goldDim, border: `1px solid ${T.goldMid}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <ClipboardCheck size={22} color={T.gold} />
          </div>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: T.t1, letterSpacing: '-0.02em', lineHeight: 1.15, margin: 0 }}>Évaluations</h1>
            <p style={{ fontSize: 13, color: T.t3, marginTop: 3 }}>Tes contrôles à venir et tes résultats.</p>
          </div>
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: T.surface, border: `1px solid ${T.border}`, borderRadius: 20,
          padding: '5px 12px', fontFamily: T.mono, fontSize: 11, color: T.t2,
          flexShrink: 0, whiteSpace: 'nowrap',
        }}>
          <span style={{ color: T.gold }}>◎</span>
          {totalCount} évaluation{totalCount !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Moyenne générale */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 14, marginBottom: 22,
        background: 'rgba(25,39,52,0.34)', border: `1px solid ${T.border}`, borderRadius: 16, padding: '16px 18px',
      }}>
        <div style={{
          width: 46, height: 46, borderRadius: 12, background: avgTone.bg, border: `1px solid ${avgTone.bd}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Award size={22} color={avgTone.col} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: T.mono, fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', color: T.t3, textTransform: 'uppercase' }}>
            Moyenne générale
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 3 }}>
            <span style={{ fontSize: 26, fontWeight: 800, color: avgTone.col, lineHeight: 1, fontFamily: T.mono }}>
              {average == null ? '—' : frNum(average)}
            </span>
            <span style={{ fontSize: 13, color: T.t3, fontWeight: 600 }}>/ 20</span>
            <span style={{ fontSize: 12, color: T.t3, marginLeft: 4 }}>
              · {completed.length} évaluation{completed.length !== 1 ? 's' : ''} notée{completed.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      </div>

      {/* Onglets */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
        <FilterPill active={tab === 'upcoming'} label="À venir" count={upcoming.length} onClick={() => pickTab('upcoming')} />
        <FilterPill active={tab === 'completed'} label="Terminées" count={completed.length} onClick={() => pickTab('completed')} />
      </div>

      {/* Liste */}
      {tab === 'upcoming' ? (
        upcoming.length === 0 ? (
          <EmptyState icon={CalendarCheck} text="Aucune évaluation à venir pour le moment." />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {upcoming.map((ev, i) => (
              <UpcomingRow key={ev.id ?? i} ev={ev} onDetails={handleDetails} delay={i * 40} />
            ))}
          </div>
        )
      ) : (
        completed.length === 0 ? (
          <EmptyState icon={Inbox} text="Aucune évaluation terminée pour l’instant." />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {completed.map((ev, i) => (
              <DoneRow
                key={ev.id ?? i}
                ev={ev}
                expanded={!isDemoMode && expandedId === ev.id}
                onToggle={handleToggle}
                delay={i * 40}
              />
            ))}
          </div>
        )
      )}
    </div>
  );
};

export default StudentEvaluationsPage;
