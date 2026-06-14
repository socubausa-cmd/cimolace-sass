/**
 * Vue mois / liste des jours pédagogiques du parcours (FullCalendar).
 */
import React, { useCallback, useEffect, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import listPlugin from '@fullcalendar/list';
import frLocale from '@fullcalendar/core/locales/fr';
import { Loader2, Calendar } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { fetchPathTreeForCalendar } from '@/lib/schoolPathsApi';
import { buildSchoolPathCalendarEvents } from '@/lib/schoolPathCalendarEvents';

export default function SchoolPathFullCalendarPanel({ pathId, startsOnDraft, refreshKey = 0 }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadErr, setLoadErr] = useState(null);

  const load = useCallback(async () => {
    if (!pathId) {
      setEvents([]);
      return;
    }
    setLoading(true);
    setLoadErr(null);
    const { path, courses, error } = await fetchPathTreeForCalendar(supabase, pathId);
    setLoading(false);
    if (error) {
      setLoadErr(error.message || 'Chargement');
      setEvents([]);
      return;
    }
    const effectivePath = {
      ...path,
      starts_on: (startsOnDraft && String(startsOnDraft).trim()) || path?.starts_on || null,
    };
    setEvents(buildSchoolPathCalendarEvents(effectivePath, courses || []));
  }, [pathId, startsOnDraft, refreshKey]);

  useEffect(() => {
    load();
  }, [load]);

  const anchor = (startsOnDraft && String(startsOnDraft).trim()) || '';

  return (
    <div
      className="school-path-fc mt-4 rounded-xl border border-white/[0.08] bg-[#0a0908] p-3"
      style={
        {
          '--fc-border-color': 'rgba(255,255,255,0.08)',
          '--fc-page-bg-color': 'transparent',
          '--fc-neutral-bg-color': 'rgba(255,255,255,0.04)',
          '--fc-list-event-hover-bg-color': 'rgba(139,92,246,0.12)',
          '--fc-today-bg-color': 'rgba(45,212,191,0.08)',
          '--fc-button-bg-color': 'rgba(139,92,246,0.35)',
          '--fc-button-border-color': 'rgba(139,92,246,0.45)',
          '--fc-button-hover-bg-color': 'rgba(139,92,246,0.5)',
          '--fc-button-active-bg-color': 'rgba(139,92,246,0.55)',
          '--fc-button-text-color': '#fff',
          '--fc-event-bg-color': 'rgba(45,212,191,0.35)',
          '--fc-event-border-color': 'rgba(45,212,191,0.5)',
        }
      }
    >
      <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold text-white/55">
        <Calendar className="h-3.5 w-3.5 text-teal-400" />
        Calendrier du parcours
      </div>
      {!anchor ? (
        <p className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-200/90">
          Indiquez la date de début (lundi de la 1ʳᵉ semaine) dans les métadonnées du parcours pour afficher les jours sur la grille.
        </p>
      ) : null}
      {loadErr ? <p className="mb-2 text-[11px] text-red-300">{loadErr}</p> : null}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-white/20" />
        </div>
      ) : (
        <div className="min-h-[420px] text-white/90 [&_.fc]:text-[11px] [&_.fc-toolbar-title]:text-sm [&_.fc-toolbar-title]:text-white/88 [&_.fc-col-header-cell]:text-white/45 [&_.fc-daygrid-day-number]:text-white/65">
          <FullCalendar
            plugins={[dayGridPlugin, listPlugin]}
            initialView="dayGridMonth"
            locale={frLocale}
            events={events}
            headerToolbar={{
              left: 'prev,next today',
              center: 'title',
              right: 'dayGridMonth,listMonth',
            }}
            height="auto"
            contentHeight={420}
            eventDisplay="block"
            displayEventTime={false}
          />
        </div>
      )}
    </div>
  );
}
