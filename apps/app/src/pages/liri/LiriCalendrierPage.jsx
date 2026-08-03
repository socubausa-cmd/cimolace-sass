import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { LiriPortalShell } from '@/components/liri/LiriPortalShell';
import { bookingApi } from '@/lib/api-v2';
import { CalendarRange, ChevronLeft, ChevronRight, Loader2, RefreshCw } from 'lucide-react';

const TZ = 'Africa/Libreville';
const HOUR_START = 8;
const HOUR_END = 22;
const HOUR_PX = 46;
const DOW_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

// Type d'événement → style (palette chaude LIRI : pas de navy/violet/teal/or métallique).
const KIND = {
  rdv:           { label: 'Rendez-vous',   bg: 'rgba(217,119,87,0.20)',  bd: '#d97757', tx: '#f3d9cd' },
  teleconsult:   { label: 'Téléconsult',   bg: 'rgba(111,158,106,0.20)', bd: '#6f9e6a', tx: '#d8ebd4' },
  masterclass:   { label: 'Masterclass',   bg: 'rgba(204,138,61,0.20)',  bd: '#cc8a3d', tx: '#f2ddb9' },
  live:          { label: 'Live TikTok',   bg: 'rgba(209,106,138,0.20)', bd: '#d16a8a', tx: '#f2cede' },
  enseignement:  { label: 'Enseignement',  bg: 'rgba(194,85,63,0.22)',   bd: '#c2553f', tx: '#f2cabf' },
  repos:         { label: 'Repos',         bg: 'rgba(120,115,108,0.16)', bd: '#6b665f', tx: '#cdc8c0' },
  busy:          { label: 'Occupé',        bg: 'rgba(74,70,64,0.30)',    bd: '#4a4640', tx: '#a8a29a' },
};
const kindOf = (k) => KIND[k] || { label: k, bg: 'rgba(138,133,126,0.18)', bd: '#8a857e', tx: '#ddd8d0' };

function gabonParts(iso) {
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date(iso));
  const g = (t) => p.find((x) => x.type === t)?.value || '';
  let h = Number(g('hour')); if (h === 24) h = 0;
  return { ymd: `${g('year')}-${g('month')}-${g('day')}`, min: h * 60 + Number(g('minute') || 0) };
}
const hhmm = (iso) => { const { min } = gabonParts(iso); return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`; };
const dayHeaderLabel = (ymd) => {
  const d = new Date(`${ymd}T12:00:00+01:00`);
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', timeZone: TZ });
};

export default function LiriCalendrierPage() {
  return (
    <LiriPortalShell active="calendrier">
      <CalBody />
    </LiriPortalShell>
  );
}

function CalBody() {
  const [weekStart, setWeekStart] = useState(null); // ISO ; null = semaine courante
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const load = useCallback(async (ws) => {
    setLoading(true); setErr('');
    try { setData(await bookingApi.masterCalendar(ws || undefined)); }
    catch (e) { setErr(e?.response?.data?.error?.message || 'Impossible de charger le calendrier.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(weekStart); }, [load, weekStart]);

  const shiftWeek = (deltaDays) => {
    const anchor = data?.weekStart ? new Date(data.weekStart) : new Date();
    setWeekStart(new Date(anchor.getTime() + deltaDays * 24 * 3600 * 1000).toISOString());
  };

  const days = data?.days || [];
  const eventsByDay = useMemo(() => {
    const map = {};
    for (const ev of data?.events || []) {
      const { ymd } = gabonParts(ev.start);
      (map[ymd] = map[ymd] || []).push(ev);
    }
    return map;
  }, [data]);

  const hours = [];
  for (let h = HOUR_START; h <= HOUR_END; h++) hours.push(h);
  const gridHeight = (HOUR_END - HOUR_START) * HOUR_PX;
  const weekLabel = days.length
    ? `${dayHeaderLabel(days[0])} — ${dayHeaderLabel(days[6])}`
    : '';

  return (
    <div className="flex h-full min-h-0 flex-col px-4 py-5 md:px-7">
      {/* En-tête */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#d97757]/15 text-[#e8a184]">
            <CalendarRange className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-xl font-bold text-[#f5f4ee]">Calendrier maître</h1>
            <p className="text-[12.5px] text-[#f5f4ee]/50">Vue globale — RDV, masterclass, live, enseignement, MedOS, repos.</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={() => shiftWeek(-7)} className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 text-[#f5f4ee]/60 hover:text-[#f5f4ee]" title="Semaine précédente"><ChevronLeft className="h-4 w-4" /></button>
          <button type="button" onClick={() => setWeekStart(null)} className="rounded-xl border border-white/10 px-3 py-2 text-[12.5px] font-semibold text-[#f5f4ee]/70 hover:text-[#f5f4ee]">Cette semaine</button>
          <button type="button" onClick={() => shiftWeek(7)} className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 text-[#f5f4ee]/60 hover:text-[#f5f4ee]" title="Semaine suivante"><ChevronRight className="h-4 w-4" /></button>
          <button type="button" onClick={() => load(weekStart)} disabled={loading} className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 text-[#f5f4ee]/60 hover:text-[#f5f4ee] disabled:opacity-50" title="Rafraîchir"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></button>
        </div>
      </div>

      {/* Légende + semaine */}
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="text-[13px] font-semibold text-[#e8a184]">{weekLabel}</span>
        <span className="h-3 w-px bg-white/10" />
        {Object.entries(KIND).map(([k, v]) => (
          <span key={k} className="inline-flex items-center gap-1 text-[11.5px] text-[#f5f4ee]/55">
            <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: v.bg, border: `1px solid ${v.bd}` }} /> {v.label}
          </span>
        ))}
      </div>

      {err && <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-[13px] text-red-300">{err}</p>}

      {/* Grille */}
      <div className="mt-4 min-h-0 flex-1 overflow-auto rounded-2xl border border-white/[0.08] bg-white/[0.02]">
        {loading && !data ? (
          <div className="flex h-40 items-center justify-center gap-2 text-[#f5f4ee]/50"><Loader2 className="h-5 w-5 animate-spin" /> Chargement…</div>
        ) : (
          <div className="min-w-[720px]">
            {/* En-têtes jours */}
            <div className="sticky top-0 z-10 grid grid-cols-[52px_repeat(7,1fr)] border-b border-white/10 bg-[#2b2926]">
              <div />
              {days.map((ymd, i) => (
                <div key={ymd} className="border-l border-white/[0.06] px-2 py-2 text-center">
                  <div className="text-[12px] font-bold text-[#f5f4ee]">{DOW_LABELS[i]}</div>
                  <div className="text-[11px] text-[#f5f4ee]/45">{dayHeaderLabel(ymd)}</div>
                </div>
              ))}
            </div>
            {/* Corps : axe horaire + 7 colonnes */}
            <div className="grid grid-cols-[52px_repeat(7,1fr)]">
              {/* Axe horaire */}
              <div className="relative" style={{ height: gridHeight }}>
                {hours.map((h) => (
                  <div key={h} className="absolute right-1.5 -translate-y-1/2 text-[10.5px] text-[#f5f4ee]/40" style={{ top: (h - HOUR_START) * HOUR_PX }}>{String(h).padStart(2, '0')}h</div>
                ))}
              </div>
              {/* Colonnes jours */}
              {days.map((ymd) => (
                <div key={ymd} className="relative border-l border-white/[0.06]" style={{ height: gridHeight }}>
                  {hours.map((h) => (
                    <div key={h} className="absolute left-0 right-0 border-t border-white/[0.05]" style={{ top: (h - HOUR_START) * HOUR_PX }} />
                  ))}
                  {(eventsByDay[ymd] || []).map((ev, idx) => {
                    const s = gabonParts(ev.start).min;
                    const e = ev.end ? gabonParts(ev.end).min : s + 30;
                    const top = Math.max(0, ((s - HOUR_START * 60) / 60) * HOUR_PX);
                    const height = Math.max(18, ((Math.max(e, s + 20) - s) / 60) * HOUR_PX - 2);
                    const c = kindOf(ev.kind);
                    return (
                      <div key={idx} className="absolute left-0.5 right-0.5 overflow-hidden rounded-md px-1.5 py-0.5"
                        style={{ top, height, background: c.bg, borderLeft: `2.5px solid ${c.bd}` }}
                        title={`${c.label} · ${hhmm(ev.start)}${ev.end ? `–${hhmm(ev.end)}` : ''} · ${ev.title}`}>
                        <div className="truncate text-[10.5px] font-semibold leading-tight" style={{ color: c.tx }}>{ev.title}</div>
                        <div className="truncate text-[9.5px] leading-tight" style={{ color: c.tx, opacity: 0.75 }}>{hhmm(ev.start)}{ev.end ? `–${hhmm(ev.end)}` : ''}</div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
