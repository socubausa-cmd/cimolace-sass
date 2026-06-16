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
          backgroundColor: 'rgba(212, 175, 55, 0.85)',
          borderColor: '#B8941F',
          textColor: '#3a2f0a',
          extendedProps: { item: a },
        };
      });
  }, [items]);

  return (
    <div className="secretariat-mini-cal rounded-[14px] border border-[var(--lt-border)] shadow-[var(--lt-card-shadow)] overflow-hidden [&_.fc]:text-[var(--lt-text)] [&_.fc-toolbar-title]:text-[var(--lt-text)] [&_.fc-col-header-cell]:text-[var(--lt-sub)] [&_.fc-daygrid-day-number]:text-[var(--lt-sub)] [&_.fc-timegrid-slot-label]:text-[var(--lt-muted)] [&_.fc-button]:bg-[var(--lt-inner-bg)] [&_.fc-button]:border-[var(--lt-border)] [&_.fc-button]:text-[var(--lt-text)] [&_.fc-button:hover]:bg-black/[0.06] [&_.fc-button-active]:bg-[color-mix(in_srgb,var(--school-accent)_22%,transparent)] [&_.fc-button-active]:text-[var(--lt-gold-ink)] [&_.fc-theme-standard_td]:border-[var(--lt-border)] [&_.fc-theme-standard_th]:border-[var(--lt-border)]" style={{ background: 'var(--lt-card-bg)' }}>
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
