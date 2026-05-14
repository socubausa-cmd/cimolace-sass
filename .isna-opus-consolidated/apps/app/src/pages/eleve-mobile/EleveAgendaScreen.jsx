import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  RefreshCw,
  Video,
  GraduationCap,
  BookOpen,
} from 'lucide-react';
import { format, addDays, startOfWeek, isSameDay, isValid, addWeeks } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useDataSync } from '@/contexts/DataSyncContext';
import { EleveMobileShell } from '@/components/eleve-mobile/EleveMobileShell';
import { LiriStatusBar } from '@/pages/eleve-mobile/connection/EleveConnectionLayout';
import { useLiriMobileAgendaMerged } from '@/hooks/useLiriMobileAgendaMerged';
import { ELEVE_MOBILE } from '@/lib/eleveMobileRoutes';
import { cn } from '@/lib/utils';
import { LiriWordmark } from '@/components/brand/LiriWordmark';
import {
  EV_BG,
  EV_CARD,
  EV_MUTED,
  EV_ACCENT,
  EV_LINE,
  EV_R,
  EV_SH,
} from '@/pages/eleve-mobile/eleveMobileScreensShared';

const TYPE_STYLES = {
  live: 'bg-red-500/18 text-red-100 border-red-500/30',
  formation_live: 'bg-amber-500/12 text-amber-100 border-amber-500/28',
  appointment: 'bg-emerald-500/12 text-emerald-100 border-emerald-500/28',
  exam: 'bg-violet-500/15 text-violet-100 border-violet-500/30',
  school: 'bg-sky-500/12 text-sky-100 border-sky-500/25',
  calendar: 'bg-[rgba(123,97,255,0.2)] text-violet-100 border-violet-500/35',
};

/** Halos (lun–ven, idx 0–4) : bleu → indigo → violet — se détachent du fond noir. */
const WEEKDAY_TOP_HALO = [
  'rgba(59, 130, 246, 0.24)',
  'rgba(99, 102, 241, 0.22)',
  'rgba(124, 58, 237, 0.2)',
  'rgba(139, 92, 246, 0.2)',
  'rgba(79, 70, 229, 0.24)',
];

function getWeekdayCellSurface({ idx, today, isWeekday }) {
  if (!isWeekday) return null;
  if (today) {
    return {
      background: [
        'radial-gradient(ellipse 115% 88% at 50% 0%, rgba(167, 139, 250, 0.4) 0%, transparent 56%)',
        'linear-gradient(180deg, rgba(55, 35, 95, 0.78) 0%, rgba(20, 16, 42, 0.99) 100%)',
      ].join(', '),
      border: '1px solid rgba(196, 181, 253, 0.5)',
      boxShadow: [
        'inset 0 1px 0 rgba(255,255,255,0.14)',
        '0 0 24px -6px rgba(124, 58, 237, 0.48)',
        '0 2px 10px -2px rgba(0,0,0,0.4)',
      ].join(', '),
    };
  }
  const halo = WEEKDAY_TOP_HALO[idx] ?? WEEKDAY_TOP_HALO[0];
  return {
    background: [
      `radial-gradient(ellipse 100% 78% at 50% 0%, ${halo} 0%, transparent 60%)`,
      'radial-gradient(ellipse 70% 45% at 100% 100%, rgba(30, 64, 175, 0.14) 0%, transparent 58%)',
      'linear-gradient(195deg, rgba(26, 28, 44, 0.97) 0%, rgba(11, 12, 24, 0.99) 100%)',
    ].join(', '),
    border: '1px solid rgba(165, 180, 252, 0.22)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.09), 0 2px 12px -4px rgba(15, 23, 42, 0.55)',
  };
}

function typeLabel(t) {
  switch (t) {
    case 'live':
      return 'Live';
    case 'formation_live':
      return 'Live formation';
    case 'appointment':
      return 'Rendez-vous';
    case 'exam':
      return 'Examen';
    case 'calendar':
      return 'Planning';
    default:
      return 'Événement';
  }
}

/**
 * Agenda — même données que l’ancien mobile LIRI (`useLiriMobileAgendaMerged`), coque `EleveMobileShell`.
 * Route : `/m/eleve/agenda`
 */
export default function EleveAgendaScreen() {
  const { user } = useAuth();
  const { notifications: sync } = useDataSync();
  const [weekAnchor, setWeekAnchor] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const { events, loading, refresh } = useLiriMobileAgendaMerged(user?.id);

  const weekStart = startOfWeek(weekAnchor, { weekStartsOn: 1 });
  const weekEnd = addDays(weekStart, 7);
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  const filteredForWeek = useMemo(
    () =>
      events.filter((ev) => {
        const d = new Date(ev.startAt);
        if (!isValid(d)) return false;
        return d >= weekStart && d < weekEnd;
      }),
    [events, weekStart, weekEnd],
  );

  const displayedWeekCount = filteredForWeek.length;
  const inboxUnread = (Array.isArray(sync) ? sync : []).filter((n) => !n.isRead).length;

  const safeFmt = (iso, fmt) => {
    if (!iso) return '';
    const d = new Date(iso);
    return isValid(d) ? format(d, fmt, { locale: fr }) : '';
  };

  return (
    <EleveMobileShell user={user} notificationCount={inboxUnread} hideHeader contentClassName="!px-0">
      <div
        className="flex w-full flex-1 flex-col"
        style={{
          minHeight: '100dvh',
          backgroundColor: EV_BG,
          backgroundImage: 'radial-gradient(50% 32% at 50% 0%, rgba(123, 97, 255, 0.14), transparent 70%)',
        }}
      >
        <div className="px-4 pt-[max(0.35rem,env(safe-area-inset-top))]">
          <LiriStatusBar />
        </div>

        <div className="px-4 pb-2 pt-0.5">
          <div className="mb-1 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <LiriWordmark size="kicker" className="text-white/40" />
              <h1 className="mt-0.5 text-[22px] font-extrabold leading-tight tracking-[-0.02em] text-white">Agenda</h1>
              <p className="mt-1 text-[13px] font-medium" style={{ color: EV_MUTED }}>
                École, calendrier, rendez-vous &amp; lives
              </p>
            </div>
            <button
              type="button"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition active:scale-95"
              style={{ borderColor: EV_LINE, background: 'rgba(255,255,255,0.06)' }}
              disabled={loading}
              onClick={() => refresh()}
              aria-label="Actualiser"
            >
              <RefreshCw className={cn('h-4 w-4 text-white/80', loading && 'animate-spin')} />
            </button>
          </div>
        </div>

        <div className="px-4 pb-6">
          <div
            className="mb-4 border p-3"
            style={{ borderRadius: EV_R.lg, background: EV_CARD, borderColor: EV_LINE, boxShadow: EV_SH.md }}
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <button
                type="button"
                className="rounded-xl border p-2 text-white/75 transition active:scale-95"
                style={{ borderColor: EV_LINE, background: 'rgba(255,255,255,0.04)' }}
                onClick={() => setWeekAnchor((w) => addWeeks(w, -1))}
                aria-label="Semaine précédente"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <div className="min-w-0 flex-1 text-center">
                <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: EV_MUTED }}>
                  Semaine du
                </p>
                <p className="text-sm font-bold text-white">{safeFmt(weekStart, 'd MMMM yyyy')}</p>
                {displayedWeekCount > 0 ? (
                  <p className="mt-0.5 text-[11px] text-white/40">
                    {displayedWeekCount} événement{displayedWeekCount > 1 ? 's' : ''}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                className="rounded-xl border p-2 text-white/75 transition active:scale-95"
                style={{ borderColor: EV_LINE, background: 'rgba(255,255,255,0.04)' }}
                onClick={() => setWeekAnchor((w) => addWeeks(w, 1))}
                aria-label="Semaine suivante"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1">
              {weekDays.map((day, idx) => {
                const dayEvents = filteredForWeek.filter((ev) => {
                  const ed = new Date(ev.startAt);
                  return isValid(ed) && isSameDay(ed, day);
                });
                const today = isSameDay(day, new Date());
                const isWeekend = idx >= 5;
                const isWeekday = !isWeekend;
                const cellSurface = getWeekdayCellSurface({ idx, today, isWeekday });
                return (
                  <div
                    key={idx}
                    className={cn(
                      'flex min-h-[76px] flex-col rounded-xl p-1',
                      isWeekend && !today && 'border border-white/[0.08] bg-black/25',
                      today && isWeekend && 'border border-violet-500/45 bg-violet-500/10',
                    )}
                    style={cellSurface ?? undefined}
                  >
                    <div className="mb-1 text-center">
                      <div
                        className={cn(
                          'text-[8px] uppercase leading-none',
                          today
                            ? 'text-violet-200/65'
                            : isWeekday
                              ? 'text-indigo-200/48'
                              : 'text-white/30',
                        )}
                      >
                        {safeFmt(day, 'EEE')}
                      </div>
                      <div
                        className={cn(
                          'text-xs font-bold leading-tight',
                          today ? 'text-violet-200' : isWeekday ? 'text-white/92' : 'text-white/88',
                        )}
                      >
                        {safeFmt(day, 'd')}
                      </div>
                    </div>
                    <div className="flex min-h-0 flex-1 flex-col gap-0.5">
                      {dayEvents.slice(0, 3).map((ev) => (
                        <div
                          key={ev.id}
                          className={cn(
                            'truncate rounded border px-0.5 py-0.5 text-[7px] font-semibold leading-tight',
                            TYPE_STYLES[ev.type] || TYPE_STYLES.school,
                          )}
                          title={ev.title}
                        >
                          {ev.title}
                        </div>
                      ))}
                      {dayEvents.length > 3 ? (
                        <span className="text-center text-[7px] text-white/30">+{dayEvents.length - 3}</span>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/35">Cette semaine</p>

          {loading && events.length === 0 ? (
            <p className="py-12 text-center text-[14px]" style={{ color: EV_MUTED }}>
              Chargement de ton agenda…
            </p>
          ) : filteredForWeek.length === 0 ? (
            <div
              className="relative overflow-hidden p-6 text-center"
              style={{
                borderRadius: EV_R.lg,
                border: '1px solid rgba(123, 97, 255, 0.22)',
                background: [
                  'radial-gradient(ellipse 95% 65% at 50% 0%, rgba(123, 97, 255, 0.2) 0%, transparent 58%)',
                  'radial-gradient(ellipse 55% 45% at 0% 100%, rgba(59, 130, 246, 0.12) 0%, transparent 65%)',
                  'radial-gradient(ellipse 50% 40% at 100% 85%, rgba(168, 85, 247, 0.1) 0%, transparent 60%)',
                  'linear-gradient(170deg, rgba(32, 30, 48, 0.98) 0%, rgba(22, 22, 32, 0.99) 45%, rgba(16, 14, 28, 1) 100%)',
                ].join(', '),
                boxShadow: [
                  'inset 0 1px 0 rgba(255, 255, 255, 0.1)',
                  'inset 0 0 0 1px rgba(255, 255, 255, 0.04)',
                  '0 8px 28px -6px rgba(99, 102, 241, 0.22)',
                  '0 4px 16px -4px rgba(0, 0, 0, 0.45)',
                ].join(', '),
              }}
            >
              <div
                aria-hidden
                className="pointer-events-none absolute -right-6 -top-8 h-32 w-32 rounded-full opacity-50 blur-3xl"
                style={{ background: 'radial-gradient(circle, rgba(124, 92, 255, 0.45) 0%, transparent 70%)' }}
              />
              <div
                aria-hidden
                className="pointer-events-none absolute -bottom-6 -left-4 h-24 w-24 rounded-full opacity-40 blur-2xl"
                style={{ background: 'radial-gradient(circle, rgba(59, 130, 246, 0.35) 0%, transparent 70%)' }}
              />
              <div className="relative">
                <div
                  className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-amber-300/40 shadow-[0_4px_18px_-4px_rgba(245,158,11,0.45),inset_0_1px_0_rgba(255,255,255,0.25)]"
                  style={{
                    background: 'linear-gradient(160deg, #fbbf24 0%, #d97706 45%, #b45309 100%)',
                  }}
                >
                  <CalendarIcon
                    className="h-6 w-6 text-yellow-100"
                    strokeWidth={2}
                    style={{
                      filter: 'drop-shadow(0 1px 0 rgba(0,0,0,0.2))',
                    }}
                  />
                </div>
                <p className="text-[14px] text-white/85">Aucun événement sur cette période.</p>
                <p className="mt-1 text-[12px] text-violet-200/55">Change de semaine ou jette un œil aux lives.</p>
                <Link
                  to={ELEVE_MOBILE.live}
                  className="mt-4 inline-flex items-center justify-center rounded-full px-5 py-2.5 text-[13px] font-bold text-white transition-transform active:scale-[0.98]"
                  style={{ background: `linear-gradient(135deg, ${EV_ACCENT} 0%, #5B21B6 100%)`, boxShadow: EV_SH.cta }}
                >
                  Voir les lives
                </Link>
              </div>
            </div>
          ) : (
            <ul className="mb-2 space-y-2.5">
              {filteredForWeek.map((ev, i) => (
                <motion.li
                  key={ev.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.04, 0.35) }}
                >
                  <div
                    className="border p-3"
                    style={{ borderRadius: EV_R.md, background: EV_CARD, borderColor: EV_LINE, boxShadow: EV_SH.sm }}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={cn(
                          'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border',
                          TYPE_STYLES[ev.type] || TYPE_STYLES.school,
                        )}
                      >
                        {ev.type === 'formation_live' ? (
                          <GraduationCap className="h-4 w-4" />
                        ) : ev.type === 'live' ? (
                          <Video className="h-4 w-4" />
                        ) : ev.type === 'exam' ? (
                          <BookOpen className="h-4 w-4" />
                        ) : (
                          <CalendarIcon className="h-4 w-4" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: EV_MUTED }}>
                          {typeLabel(ev.type)}
                        </p>
                        <p className="text-[15px] font-semibold leading-snug text-white/95">{ev.title}</p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]" style={{ color: EV_MUTED }}>
                          <span className="inline-flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5 shrink-0" />
                            {safeFmt(ev.startAt, "EEE d MMM · HH:mm")}
                          </span>
                          {ev.location ? (
                            <span className="inline-flex min-w-0 items-center gap-1">
                              <MapPin className="h-3.5 w-3.5 shrink-0" />
                              <span className="truncate">{ev.location}</span>
                            </span>
                          ) : null}
                        </div>
                        {ev.href ? (
                          <Link
                            to={ev.href}
                            className="mt-2 inline-flex text-[12px] font-bold"
                            style={{ color: EV_ACCENT }}
                          >
                            Ouvrir →
                          </Link>
                        ) : null}
                        {ev.videoUrl && !ev.href ? (
                          <a
                            href={ev.videoUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-2 inline-flex text-[12px] font-bold"
                            style={{ color: EV_ACCENT }}
                          >
                            Rejoindre la visio →
                          </a>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </motion.li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </EleveMobileShell>
  );
}
