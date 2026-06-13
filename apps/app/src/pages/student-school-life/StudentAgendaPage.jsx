import React, { useMemo, useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useStudentAppointments } from '@/hooks/useStudentAppointments';
import {
  Calendar as CalendarIcon, Clock, MapPin, Search, Video,
  ChevronLeft, ChevronRight, X, Plus, RefreshCw,
} from 'lucide-react';
import { format, startOfWeek, addDays, isSameDay, isValid } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useDemoMode } from '@/contexts/DemoModeContext';
import { schoolEventsForStudentWindow } from '@/lib/studentSchoolDataQueries';

/* ─── Thème ISNA (navy + or) ─── */
const T = {
  surface:   '#12111a',
  surface2:  'rgba(25,39,52,0.5)',
  border:    'rgba(255,255,255,0.07)',
  borderMid: 'rgba(255,255,255,0.12)',
  gold:      '#D4AF37',
  goldDim:   'rgba(212,175,55,0.12)',
  goldMid:   'rgba(212,175,55,0.28)',
  t1: '#F5F5F7',
  t2: 'rgba(245,245,247,0.65)',
  t3: 'rgba(245,245,247,0.38)',
  t4: 'rgba(245,245,247,0.16)',
  mono: "'JetBrains Mono','Fira Code',monospace",
};

const TYPE_META = {
  live:  { label: 'Cours / live', col: '#D4AF37', bg: 'rgba(212,175,55,0.14)',  bd: 'rgba(212,175,55,0.30)' },
  exam:  { label: 'Examen',       col: '#F0936B', bg: 'rgba(240,147,107,0.13)', bd: 'rgba(240,147,107,0.32)' },
  event: { label: 'Événement',    col: '#8B9CFF', bg: 'rgba(139,156,255,0.13)', bd: 'rgba(139,156,255,0.32)' },
};
const FILTERS = [
  { key: 'all',   label: 'Tout' },
  { key: 'live',  label: 'Cours & lives' },
  { key: 'exam',  label: 'Examens' },
  { key: 'event', label: 'Événements' },
];

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const detectType = (text) => {
  const n = norm(text);
  if (/(exam|evalu|controle|quiz|test|partiel)/.test(n)) return 'exam';
  if (/(live|direct|visio|webinaire|en ligne|distanciel)/.test(n)) return 'live';
  return 'event';
};
const safeFormat = (input, fmt) => {
  if (!input) return '';
  const d = new Date(input);
  return isValid(d) ? format(d, fmt, { locale: fr }) : '';
};

/* ─── Boutons ─── */
const Btn = ({ children, onClick, to, variant = 'ghost', disabled, title, style: extra }) => {
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
  if (to) return <Link to={to} style={style} title={title} {...handlers}>{children}</Link>;
  return <button onClick={onClick} disabled={disabled} style={style} title={title} {...handlers}>{children}</button>;
};

const IconBtn = ({ children, onClick, title }) => {
  const [hov, setHov] = useState(false);
  return (
    <button onClick={onClick} title={title} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        width: 32, height: 32, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: hov ? T.surface2 : 'transparent', border: `1px solid ${hov ? T.borderMid : T.border}`,
        color: hov ? T.t1 : T.t2, cursor: 'pointer', transition: 'all 150ms ease',
      }}>
      {children}
    </button>
  );
};

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

const TypeBadge = ({ type }) => {
  const tm = TYPE_META[type] || TYPE_META.event;
  return (
    <span style={{
      fontFamily: T.mono, fontSize: 9.5, fontWeight: 700, letterSpacing: '0.04em',
      color: tm.col, background: tm.bg, border: `1px solid ${tm.bd}`,
      borderRadius: 20, padding: '2px 9px', textTransform: 'uppercase', whiteSpace: 'nowrap',
    }}>{tm.label}</span>
  );
};

/* ─── Bande semaine ─── */
const WeekStrip = ({ weekStart, events, onPrev, onNext, onToday, onPick }) => {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  return (
    <div style={{ background: 'rgba(25,39,52,0.34)', border: `1px solid ${T.border}`, borderRadius: 16, padding: 16, marginBottom: 22 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <CalendarIcon size={17} color={T.gold} />
          <span style={{ fontSize: 14, fontWeight: 600, color: T.t1 }}>
            Semaine du {safeFormat(weekStart, 'd MMM')}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <IconBtn onClick={onPrev} title="Semaine précédente"><ChevronLeft size={16} /></IconBtn>
          <Btn onClick={onToday} style={{ padding: '6px 12px' }}>Aujourd&apos;hui</Btn>
          <IconBtn onClick={onNext} title="Semaine suivante"><ChevronRight size={16} /></IconBtn>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}>
        {days.map((day, i) => {
          const today = isSameDay(day, new Date());
          const dayEvents = events.filter((ev) => ev._dateObj && isSameDay(ev._dateObj, day));
          return (
            <div key={i} style={{
              minHeight: 112, borderRadius: 12, padding: 8,
              background: today ? T.goldDim : 'rgba(0,0,0,0.22)',
              border: `1px solid ${today ? T.goldMid : T.border}`,
            }}>
              <div style={{ textAlign: 'center', marginBottom: 7 }}>
                <div style={{ fontFamily: T.mono, fontSize: 9, color: T.t3, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {safeFormat(day, 'EEE')}
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: today ? T.gold : T.t1 }}>
                  {safeFormat(day, 'd')}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {dayEvents.slice(0, 3).map((ev, j) => {
                  const tm = TYPE_META[ev.type] || TYPE_META.event;
                  return (
                    <div key={j} title={ev.title} onClick={() => onPick && onPick(ev)}
                      style={{
                        fontSize: 9.5, fontWeight: 600, color: tm.col, background: tm.bg,
                        border: `1px solid ${tm.bd}`, borderRadius: 5, padding: '2px 5px',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer',
                      }}>
                      {ev.title}
                    </div>
                  );
                })}
                {dayEvents.length > 3 && (
                  <div style={{ fontSize: 9, color: T.t3, textAlign: 'center', fontFamily: T.mono }}>
                    +{dayEvents.length - 3}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/* ─── Ligne événement ─── */
const EventRow = ({ ev, onJoin, onDetails, delay }) => {
  const [hov, setHov] = useState(false);
  const canJoin = !!(ev.liveSessionId || ev.video_url);
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px',
        background: hov ? 'rgba(25,39,52,0.6)' : 'rgba(25,39,52,0.34)',
        border: `1px solid ${hov ? T.goldMid : T.border}`, borderRadius: 14,
        transition: 'all 160ms ease', animation: `agFade .4s ease ${delay}ms both`,
      }}>
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        minWidth: 58, height: 58, borderRadius: 12, background: 'rgba(0,0,0,0.28)', border: `1px solid ${T.border}`, flexShrink: 0,
      }}>
        <span style={{ fontFamily: T.mono, fontSize: 9.5, fontWeight: 700, color: T.gold, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{ev.month}</span>
        <span style={{ fontSize: 20, fontWeight: 700, color: T.t1, lineHeight: 1 }}>{ev.day}</span>
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5, flexWrap: 'wrap' }}>
          <TypeBadge type={ev.type} />
          <span style={{ fontSize: 14.5, fontWeight: 600, color: T.t1 }}>{ev.title}</span>
        </div>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 12, color: T.t3, alignItems: 'center' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <Clock size={13} /> {ev.weekday} {ev.time}
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <MapPin size={13} /> {ev.location}
          </span>
          {ev.instructor && <span style={{ color: T.gold }}>Avec {ev.instructor}</span>}
        </div>
      </div>

      {canJoin ? (
        <Btn variant="gold" onClick={() => onJoin(ev)} style={{ flexShrink: 0 }}>
          <Video size={14} /> Rejoindre
        </Btn>
      ) : (
        <Btn onClick={() => onDetails(ev)} style={{ flexShrink: 0 }}>Détails</Btn>
      )}
    </div>
  );
};

/* ═══════════════════════ PAGE ═══════════════════════ */
const StudentAgendaPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { upcomingEvents, appointmentRequests, studentReports, loading, refresh } = useStudentAppointments(user?.id);
  const { isDemoMode, demoData, restrictedAction } = useDemoMode();

  const [currentDate, setCurrentDate] = useState(new Date());
  const [filterType, setFilterType] = useState('all');
  const [search, setSearch] = useState('');
  const [focused, setFocused] = useState(false);
  const [schoolEvents, setSchoolEvents] = useState([]);

  useEffect(() => {
    if (isDemoMode) return;
    let alive = true;
    (async () => {
      const { data, error } = await schoolEventsForStudentWindow({ limit: 100, openEnd: true });
      if (!alive) return;
      setSchoolEvents(error ? [] : (data || []));
    })();
    return () => { alive = false; };
  }, [isDemoMode]);

  const events = useMemo(() => {
    const raw = isDemoMode
      ? (demoData.agenda || []).map((e) => ({ ...e, type: e.type || detectType(e.title) }))
      : [
          ...upcomingEvents.map((e) => ({
            id: e.id,
            title: e.title,
            type: e.type === 'live' ? 'live' : 'event',
            date: e.scheduled_at,
            location: e.video_url || e.type === 'live' ? 'Visioconférence' : 'Sur rendez-vous',
            instructor: e.instructor || null,
            video_url: e.video_url || null,
            liveSessionId: e.type === 'live' ? e.id : null,
            description: '',
          })),
          ...schoolEvents.map((e) => ({
            id: `school-${e.id}`,
            title: e.title || 'Événement',
            type: detectType(`${e.title || ''} ${e.description || ''}`),
            date: e.start_at,
            location: e.location || 'Campus ISNA',
            instructor: null,
            video_url: null,
            liveSessionId: null,
            description: e.description || '',
          })),
        ];
    return raw
      .map((e) => {
        const d = new Date(e.date);
        const ok = isValid(d);
        return {
          ...e,
          _dateObj: ok ? d : null,
          month: ok ? format(d, 'MMM', { locale: fr }) : '',
          day: ok ? format(d, 'dd', { locale: fr }) : '--',
          time: e.time || (ok ? format(d, 'HH:mm', { locale: fr }) : ''),
          weekday: ok ? format(d, 'EEE', { locale: fr }) : '',
        };
      })
      .sort((a, b) => (a._dateObj?.getTime() || 0) - (b._dateObj?.getTime() || 0));
  }, [isDemoMode, demoData.agenda, upcomingEvents, schoolEvents]);

  const counts = useMemo(() => {
    const m = { all: events.length, live: 0, exam: 0, event: 0 };
    events.forEach((e) => { m[e.type] = (m[e.type] || 0) + 1; });
    return m;
  }, [events]);

  const q = norm(search);
  const filteredEvents = events.filter((ev) =>
    (filterType === 'all' || ev.type === filterType) &&
    (!q || norm(`${ev.title} ${ev.location} ${ev.instructor || ''} ${ev.description || ''}`).includes(q))
  );

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const pendingCount = appointmentRequests?.filter((r) => r.status === 'pending').length || 0;

  const handleJoin = (ev) => {
    if (isDemoMode) return restrictedAction('Rejoindre la session');
    if (ev.liveSessionId) navigate(`/live/${ev.liveSessionId}`);
    else if (ev.video_url) window.open(ev.video_url, '_blank', 'noopener');
  };
  const handleDetails = (ev) => restrictedAction(`Détails : ${ev.title}`);

  return (
    <div style={{ paddingBottom: 8 }}>
      <style>{`
        @keyframes agFade { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: translateY(0) } }
        @keyframes agSpin { to { transform: rotate(360deg) } }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 14, background: T.goldDim, border: `1px solid ${T.goldMid}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <CalendarIcon size={22} color={T.gold} />
          </div>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: T.t1, letterSpacing: '-0.02em', lineHeight: 1.15, margin: 0 }}>Agenda</h1>
            <p style={{ fontSize: 13, color: T.t3, marginTop: 3 }}>Tes cours en direct, examens et événements de l&apos;institut.</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {!isDemoMode && (
            <Btn onClick={refresh} disabled={loading} title="Actualiser">
              <RefreshCw size={14} style={loading ? { animation: 'agSpin 1s linear infinite' } : undefined} /> Actualiser
            </Btn>
          )}
          {!isDemoMode && (
            <Btn variant="gold" to="/appointment/request"><Plus size={14} /> Demander un rendez-vous</Btn>
          )}
        </div>
      </div>

      {/* Filtres + recherche */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 22 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {FILTERS.map((f) => (
            <FilterPill key={f.key} active={filterType === f.key} label={f.label} count={counts[f.key]} onClick={() => setFilterType(f.key)} />
          ))}
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto', minWidth: 220, flex: '1 1 240px', maxWidth: 360,
          background: T.surface, border: `1px solid ${focused ? T.goldMid : T.border}`, borderRadius: 11, padding: '8px 12px', transition: 'border-color 150ms ease',
        }}>
          <Search size={15} color={T.t3} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="Rechercher un événement…"
            style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: T.t1, fontSize: 13, fontFamily: 'inherit' }}
          />
          {search && (
            <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.t3, display: 'flex', padding: 0 }}>
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Semaine */}
      <WeekStrip
        weekStart={weekStart}
        events={filteredEvents}
        onPrev={() => setCurrentDate(addDays(weekStart, -7))}
        onNext={() => setCurrentDate(addDays(weekStart, 7))}
        onToday={() => setCurrentDate(new Date())}
        onPick={(ev) => (ev._dateObj ? setCurrentDate(ev._dateObj) : null)}
      />

      {/* Bannières */}
      {!isDemoMode && pendingCount > 0 && (
        <div style={{ borderRadius: 14, border: '1px solid rgba(245,158,11,0.30)', background: 'rgba(245,158,11,0.08)', padding: 16, marginBottom: 16 }}>
          <h3 style={{ fontWeight: 700, color: '#F5C26B', margin: 0, marginBottom: 4, fontSize: 14 }}>Demande(s) de rendez-vous en attente</h3>
          <p style={{ fontSize: 12.5, color: T.t2, margin: 0 }}>
            Tu as {pendingCount} demande(s). Le secrétariat te contactera pour confirmer.
          </p>
        </div>
      )}
      {!isDemoMode && studentReports?.length > 0 && (
        <div style={{ borderRadius: 14, border: `1px solid ${T.goldMid}`, background: T.goldDim, padding: 16, marginBottom: 16 }}>
          <h3 style={{ fontWeight: 700, color: T.gold, margin: 0, marginBottom: 4, fontSize: 14 }}>Résumés de sessions</h3>
          <p style={{ fontSize: 12.5, color: T.t2, margin: 0 }}>
            {studentReports.length} compte(s) rendu de session(s) live disponible(s).
          </p>
        </div>
      )}

      {/* Liste */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', margin: '4px 0 14px' }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: T.t1, margin: 0 }}>Prochains événements</h2>
        <span style={{ fontFamily: T.mono, fontSize: 11, color: T.t3 }}>
          {filteredEvents.length} événement{filteredEvents.length !== 1 ? 's' : ''}
        </span>
      </div>

      {filteredEvents.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '44px 24px', color: T.t3, fontSize: 13, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14 }}>
          {search || filterType !== 'all'
            ? 'Aucun événement ne correspond à ta recherche.'
            : 'Aucun événement à venir pour le moment.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filteredEvents.map((ev, i) => (
            <EventRow key={ev.id} ev={ev} onJoin={handleJoin} onDetails={handleDetails} delay={i * 40} />
          ))}
        </div>
      )}
    </div>
  );
};

export default StudentAgendaPage;
