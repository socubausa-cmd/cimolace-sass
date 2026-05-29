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
import { LiriWordmark } from '@/components/brand/LiriWordmark';
import { cn } from '@/lib/utils';
import { LiriMobileScreenShell, LiriGoldCard, LiriSectionLabel } from '@/components/mobile-liri/LiriMobileScreenShell';
import { LIRI_MOBILE } from '@/lib/liriMobileRoutes';
import { useLiriMobileAgendaMerged } from '@/hooks/useLiriMobileAgendaMerged';
import { Button } from '@/components/ui/button';

const TYPE_STYLES = {
  live: 'bg-red-500/20 text-red-200 border-red-500/30',
  formation_live: 'bg-amber-500/15 text-amber-200 border-amber-500/25',
  appointment: 'bg-emerald-500/15 text-emerald-200 border-emerald-500/25',
  exam: 'bg-violet-500/15 text-violet-200 border-violet-500/25',
  school: 'bg-sky-500/15 text-sky-200 border-sky-500/25',
  calendar: 'bg-[#D4AF37]/12 text-[#f0e6c8] border-[#D4AF37]/28',
};

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

export default function MobileEventsCalendarScreen() {
  const { user } = useAuth();
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

  const safeFmt = (iso, fmt) => {
    if (!iso) return '';
    const d = new Date(iso);
    return isValid(d) ? format(d, fmt, { locale: fr }) : '';
  };

  return (
    <LiriMobileScreenShell contentClassName="overflow-y-auto [scrollbar-width:thin] pb-6">
      <div className="flex items-start justify-between gap-2 pt-1 pb-3">
        <div>
          <LiriWordmark size="kicker" className="text-[#D4AF37]/80" />
          <h1 className="font-serif text-lg text-[#faf3e6] tracking-tight">Agenda & événements</h1>
          <p className="text-xs text-white/45 mt-0.5">École, calendrier, vos rendez-vous et lives</p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-9 w-9 shrink-0 border-[#D4AF37]/35 text-[#D4AF37] hover:bg-[#D4AF37]/10"
          disabled={loading}
          onClick={() => refresh()}
          aria-label="Actualiser"
        >
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
        </Button>
      </div>

      <LiriGoldCard className="p-3 mb-4">
        <div className="flex items-center justify-between gap-2 mb-3">
          <button
            type="button"
            className="rounded-lg border border-white/12 p-1.5 text-white/70 hover:bg-white/10"
            onClick={() => setWeekAnchor((w) => addWeeks(w, -1))}
            aria-label="Semaine précédente"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="text-center min-w-0 flex-1">
            <p className="text-[11px] text-[#D4AF37]/80 font-medium">Semaine du</p>
            <p className="text-sm font-semibold text-white truncate">{safeFmt(weekStart, 'd MMMM yyyy')}</p>
            {displayedWeekCount > 0 ? (
              <p className="text-[10px] text-white/40 mt-0.5">
                {displayedWeekCount} événement{displayedWeekCount > 1 ? 's' : ''} sur cette semaine
              </p>
            ) : null}
          </div>
          <button
            type="button"
            className="rounded-lg border border-white/12 p-1.5 text-white/70 hover:bg-white/10"
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
            return (
              <div
                key={idx}
                className={cn(
                  'min-h-[72px] rounded-lg border p-1 flex flex-col',
                  today ? 'border-[#D4AF37]/50 bg-[#D4AF37]/8' : 'border-white/8 bg-black/25',
                )}
              >
                <div className="text-center mb-1">
                  <div className="text-[8px] text-white/40 uppercase leading-none">{safeFmt(day, 'EEE')}</div>
                  <div className={cn('text-xs font-bold leading-tight', today ? 'text-[#D4AF37]' : 'text-white/90')}>
                    {safeFmt(day, 'd')}
                  </div>
                </div>
                <div className="flex flex-col gap-0.5 flex-1 min-h-0">
                  {dayEvents.slice(0, 3).map((ev) => (
                    <div
                      key={ev.id}
                      className={cn(
                        'text-[7px] leading-tight rounded px-0.5 py-0.5 truncate border',
                        TYPE_STYLES[ev.type] || TYPE_STYLES.school,
                      )}
                      title={ev.title}
                    >
                      {ev.title}
                    </div>
                  ))}
                  {dayEvents.length > 3 ? (
                    <span className="text-[7px] text-white/35 text-center">+{dayEvents.length - 3}</span>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </LiriGoldCard>

      <LiriSectionLabel className="mb-2 text-white/40">Liste — semaine affichée</LiriSectionLabel>

      {loading && events.length === 0 ? (
        <p className="text-sm text-white/45 py-8 text-center">Chargement…</p>
      ) : filteredForWeek.length === 0 ? (
        <LiriGoldCard className="p-5 text-center">
          <CalendarIcon className="h-10 w-10 text-[#D4AF37]/30 mx-auto mb-2" />
          <p className="text-sm text-white/55">Aucun événement cette semaine.</p>
          <Link
            to={LIRI_MOBILE.live}
            className="inline-flex mt-3 text-xs font-semibold text-[#D4AF37] hover:underline"
          >
            Voir les lives & replays
          </Link>
        </LiriGoldCard>
      ) : (
        <ul className="space-y-2 mb-4">
          {filteredForWeek.map((ev, i) => (
            <motion.li
              key={ev.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.04, 0.35) }}
            >
              <LiriGoldCard className="p-3">
                <div className="flex items-start gap-2">
                  <div
                    className={cn(
                      'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border',
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
                    <p className="text-[10px] uppercase tracking-wide text-[#D4AF37]/70">{typeLabel(ev.type)}</p>
                    <p className="text-sm font-semibold text-white/95 leading-snug">{ev.title}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-white/45">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3 shrink-0" />
                        {safeFmt(ev.startAt, "EEE d MMM · HH:mm")}
                      </span>
                      {ev.location ? (
                        <span className="inline-flex items-center gap-1 min-w-0">
                          <MapPin className="h-3 w-3 shrink-0" />
                          <span className="truncate">{ev.location}</span>
                        </span>
                      ) : null}
                    </div>
                    {ev.href ? (
                      <Link
                        to={ev.href}
                        className="mt-2 inline-flex text-xs font-semibold text-[#D4AF37] hover:underline"
                      >
                        Ouvrir →
                      </Link>
                    ) : null}
                    {ev.videoUrl && !ev.href ? (
                      <a
                        href={ev.videoUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-flex text-xs font-semibold text-[#D4AF37] hover:underline"
                      >
                        Rejoindre la visio →
                      </a>
                    ) : null}
                  </div>
                </div>
              </LiriGoldCard>
            </motion.li>
          ))}
        </ul>
      )}

      <Link
        to={LIRI_MOBILE.home}
        className="flex items-center justify-center rounded-2xl border border-white/12 py-2.5 text-xs text-white/55 hover:bg-white/5"
      >
        Retour à l'accueil LIRI
      </Link>
    </LiriMobileScreenShell>
  );
}
