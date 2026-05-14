import React, { useMemo } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import frLocale from '@fullcalendar/core/locales/fr';

/**
 * Vue calendrier compacte pour l'onglet RDV prévus (messagerie unifiée).
 * @param {{ items: Array<{ id: string, title?: string, scheduled_at?: string, duration_minutes?: number }>, onEventClick?: (item: object) => void }} props
 */
export default function SecretariatAppointmentsMiniCalendar({ items = [], onEventClick }) {
  const fcEvents = useMemo(() => {
    return (items || [])
      .filter((a) => a?.scheduled_at)
      .map((a) => {
        const start = new Date(a.scheduled_at);
        const dur = Number(a.duration_minutes) > 0 ? Number(a.duration_minutes) : 30;
        const end = new Date(start.getTime() + dur * 60 * 1000);
        return {
          id: String(a.id),
          title: a.title || 'Rendez-vous',
          start: start.toISOString(),
          end: end.toISOString(),
          backgroundColor: 'rgba(212, 175, 55, 0.35)',
          borderColor: '#D4AF37',
          textColor: '#f8fafc',
          extendedProps: { item: a },
        };
      });
  }, [items]);

  return (
    <div className="secretariat-mini-cal rounded-2xl border border-white/10 bg-[#0f1419]/80 overflow-hidden [&_.fc]:text-gray-200 [&_.fc-button]:bg-white/10 [&_.fc-button]:border-white/20 [&_.fc-button]:text-gray-200 [&_.fc-button:hover]:bg-white/15">
      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
        initialView="timeGridWeek"
        locale={frLocale}
        headerToolbar={{
          left: 'prev,next today',
          center: 'title',
          right: 'dayGridMonth,timeGridWeek,listWeek',
        }}
        height={440}
        slotMinTime="07:00:00"
        slotMaxTime="21:00:00"
        allDaySlot={false}
        events={fcEvents}
        eventClick={(info) => {
          info.jsEvent.preventDefault();
          const item = info.event.extendedProps?.item;
          if (item && onEventClick) onEventClick(item);
        }}
      />
    </div>
  );
}
