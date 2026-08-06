import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LiriPortalShell } from '@/components/liri/LiriPortalShell';
import { bookingApi } from '@/lib/api-v2';
import {
  CalendarRange, ChevronLeft, ChevronRight, Loader2, RefreshCw, Settings2,
  Search, LayoutList, LayoutGrid, X, ExternalLink, CalendarX2,
} from 'lucide-react';

/* ═══════════════════════════════════════════════════════════════════════════
   Calendrier maître — refonte 2026-08-06 (audit du fondateur : « trop bâclé »).
   Les quatre défauts mesurés qui ont motivé la refonte, à ne pas réintroduire :
   1. ⛔ Les événements simultanés se recouvraient à 100 % (aucun rangement en
      couloirs) : deux séances à la même heure = une seule visible.
   2. ⛔ Les plages « journée entière » (Occupé 08:00–20:00, Repos…) écrasaient
      la grille ET entraient en collision avec l'en-tête des jours. Elles vivent
      désormais dans une BANDE dédiée sous l'en-tête.
   3. ⛔ La légende était passive : ce sont maintenant des FILTRES (clic = montrer/
      masquer un type), avec compte par type et recherche plein texte.
   4. ⛔ Aucune lecture du temps : ni repère « maintenant », ni mise en avant
      d'aujourd'hui, amplitude figée 08–22 h même vide.
   ═══════════════════════════════════════════════════════════════════════════ */

const TZ = 'Africa/Libreville';
const HOUR_PX = 46;
const DOW_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
/* Une plage ≥ 8 h n'est pas un créneau, c'est une toile de fond : bande dédiée. */
const ALLDAY_MIN = 8 * 60;

/* Type d'événement → style (palette chaude LIRI : pas de navy/violet/teal/or). */
const KIND = {
  rdv:          { label: 'Rendez-vous',  bg: 'rgba(217,119,87,0.22)',  bd: '#d97757', tx: '#f6ded3' },
  teleconsult:  { label: 'Téléconsult',  bg: 'rgba(111,158,106,0.22)', bd: '#6f9e6a', tx: '#dcedd8' },
  masterclass:  { label: 'Masterclass',  bg: 'rgba(204,138,61,0.22)',  bd: '#cc8a3d', tx: '#f4e1c1' },
  live:         { label: 'Live TikTok',  bg: 'rgba(209,106,138,0.22)', bd: '#d16a8a', tx: '#f4d3e1' },
  enseignement: { label: 'Enseignement', bg: 'rgba(194,85,63,0.24)',   bd: '#c2553f', tx: '#f4cfc5' },
  repos:        { label: 'Repos',        bg: 'rgba(120,115,108,0.18)', bd: '#8a857e', tx: '#d6d1c9' },
  busy:         { label: 'Occupé',       bg: 'rgba(74,70,64,0.32)',    bd: '#6b665f', tx: '#b5afa7' },
};
const kindOf = (k) => KIND[k] || { label: k || 'Autre', bg: 'rgba(138,133,126,0.18)', bd: '#8a857e', tx: '#ddd8d0' };

/* Les rendez-vous et téléconsultations ont un écran de gestion : on y mène. */
const KINDS_GERABLES = new Set(['rdv', 'teleconsult']);

function gabonParts(iso) {
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date(iso));
  const g = (t) => p.find((x) => x.type === t)?.value || '';
  let h = Number(g('hour')); if (h === 24) h = 0;
  return { ymd: `${g('year')}-${g('month')}-${g('day')}`, min: h * 60 + Number(g('minute') || 0) };
}
const fmtMin = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
const hhmm = (iso) => fmtMin(gabonParts(iso).min);
const dayHeaderLabel = (ymd) => new Date(`${ymd}T12:00:00+01:00`)
  .toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', timeZone: TZ });
const dayLongLabel = (ymd) => new Date(`${ymd}T12:00:00+01:00`)
  .toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: TZ });
const todayYmd = () => gabonParts(new Date().toISOString()).ymd;
const nowMin = () => gabonParts(new Date().toISOString()).min;

/* Rangement en couloirs des événements qui se chevauchent : chaque grappe
   d'événements en collision partage la largeur de la colonne. C'est LE correctif
   du défaut n°1 — sans lui, deux créneaux simultanés = un seul visible. */
function rangerEnCouloirs(evts) {
  const tri = [...evts].sort((a, b) => a.s - b.s || b.e - a.e);
  const out = [];
  let grappe = []; let finGrappe = -1; let finsCouloirs = [];
  const clore = () => {
    const n = Math.max(1, ...grappe.map((x) => x.couloir + 1));
    grappe.forEach((x) => { x.couloirs = n; });
    out.push(...grappe);
    grappe = []; finsCouloirs = [];
  };
  for (const ev of tri) {
    if (grappe.length && ev.s >= finGrappe) clore();
    let c = 0;
    while (finsCouloirs[c] !== undefined && finsCouloirs[c] > ev.s) c++;
    finsCouloirs[c] = ev.e;
    ev.couloir = c;
    grappe.push(ev);
    finGrappe = Math.max(finGrappe, ev.e);
  }
  if (grappe.length) clore();
  return out;
}

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
  const [vue, setVue] = useState('semaine'); // 'semaine' | 'liste'
  const [q, setQ] = useState('');
  /* null = tous les types visibles ; sinon Set des types actifs. */
  const [typesActifs, setTypesActifs] = useState(null);
  const [detail, setDetail] = useState(null); // événement ouvert dans le volet
  const rechercheRef = useRef(null);

  const load = useCallback(async (ws) => {
    setLoading(true); setErr('');
    try { setData(await bookingApi.masterCalendar(ws || undefined)); }
    catch (e) { setErr(e?.response?.data?.error?.message || 'Impossible de charger le calendrier.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(weekStart); }, [load, weekStart]);

  /* Échap ferme le volet de détail ; ⌘F / Ctrl+F laisse la recherche du
     navigateur tranquille, mais « / » (convention des outils) focalise la nôtre. */
  useEffect(() => {
    const h = (e) => {
      if (e.key === 'Escape') setDetail(null);
      if (e.key === '/' && !/input|textarea/i.test(e.target?.tagName || '')) {
        e.preventDefault(); rechercheRef.current?.focus();
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  const shiftWeek = (deltaDays) => {
    const anchor = data?.weekStart ? new Date(data.weekStart) : new Date();
    setDetail(null);
    setWeekStart(new Date(anchor.getTime() + deltaDays * 24 * 3600 * 1000).toISOString());
  };

  const days = data?.days || [];
  const aujourdhui = todayYmd();

  /* Normalisation une fois : minutes locales, type, texte de recherche. */
  const evenements = useMemo(() => (data?.events || []).map((ev, i) => {
    const s = gabonParts(ev.start).min;
    const e = ev.end ? gabonParts(ev.end).min : s + 30;
    return {
      ...ev, _i: i, ymd: gabonParts(ev.start).ymd, s, e: Math.max(e, s + 20),
      jourEntier: (e - s) >= ALLDAY_MIN,
      texte: `${ev.title || ''} ${kindOf(ev.kind).label}`.toLowerCase(),
    };
  }), [data]);

  const comptesParType = useMemo(() => {
    const m = {};
    for (const ev of evenements) m[ev.kind] = (m[ev.kind] || 0) + 1;
    return m;
  }, [evenements]);

  const visibles = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return evenements.filter((ev) =>
      (typesActifs === null || typesActifs.has(ev.kind))
      && (!ql || ev.texte.includes(ql)));
  }, [evenements, typesActifs, q]);
  const masques = evenements.length - visibles.length;

  const parJour = useMemo(() => {
    const grille = {}; const bande = {};
    for (const ev of visibles) {
      (ev.jourEntier ? (bande[ev.ymd] = bande[ev.ymd] || []) : (grille[ev.ymd] = grille[ev.ymd] || [])).push(ev);
    }
    for (const ymd of Object.keys(grille)) grille[ymd] = rangerEnCouloirs(grille[ymd]);
    return { grille, bande };
  }, [visibles]);

  /* Amplitude auto : jamais moins de 08–20 h, étendue si un créneau déborde —
     un événement à 6 h du matin ne doit plus être écrêté sous l'en-tête. */
  const [hDebut, hFin] = useMemo(() => {
    let d = 8, f = 20;
    for (const ev of visibles) {
      if (ev.jourEntier) continue;
      d = Math.min(d, Math.floor(ev.s / 60));
      f = Math.max(f, Math.ceil(ev.e / 60));
    }
    return [Math.max(0, d), Math.min(24, f)];
  }, [visibles]);
  const gridHeight = (hFin - hDebut) * HOUR_PX;
  const hours = []; for (let h = hDebut; h <= hFin; h++) hours.push(h);

  const basculerType = (k) => {
    setTypesActifs((prev) => {
      const tous = new Set(Object.keys(KIND));
      const cur = prev === null ? tous : new Set(prev);
      if (prev === null) return new Set([k]); // 1er clic = isoler ce type
      if (cur.has(k)) { cur.delete(k); } else { cur.add(k); }
      return cur.size === 0 || cur.size === tous.size ? null : cur;
    });
  };

  const weekLabel = days.length ? `${dayHeaderLabel(days[0])} — ${dayHeaderLabel(days[6])}` : '';
  const minuteNow = nowMin();
  const rienCetteSemaine = !loading && !err && evenements.length === 0;
  const toutFiltre = !loading && !err && evenements.length > 0 && visibles.length === 0;

  return (
    <div className="flex h-full min-h-0 flex-col px-4 py-5 md:px-7">
      {/* ── En-tête : titre + navigation ─────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#d97757]/15 text-[#e8a184]">
            <CalendarRange className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-xl font-bold text-[#f5f4ee]">Calendrier maître</h1>
            <p className="text-[12.5px] text-[#f5f4ee]/55">{weekLabel || 'Vue globale de la semaine'}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={() => shiftWeek(-7)} className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 text-[#f5f4ee]/60 transition-colors hover:text-[#f5f4ee]" title="Semaine précédente"><ChevronLeft className="h-4 w-4" /></button>
          <button type="button" onClick={() => { setDetail(null); setWeekStart(null); }} className="rounded-xl border border-white/10 px-3 py-2 text-[12.5px] font-semibold text-[#f5f4ee]/70 transition-colors hover:text-[#f5f4ee]">Aujourd&apos;hui</button>
          <button type="button" onClick={() => shiftWeek(7)} className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 text-[#f5f4ee]/60 transition-colors hover:text-[#f5f4ee]" title="Semaine suivante"><ChevronRight className="h-4 w-4" /></button>
          <span className="mx-1 h-5 w-px bg-white/10" />
          <div className="flex overflow-hidden rounded-xl border border-white/10">
            <button type="button" onClick={() => setVue('semaine')} title="Vue semaine"
              className={`grid h-9 w-9 place-items-center transition-colors ${vue === 'semaine' ? 'bg-[#d97757]/20 text-[#e8a184]' : 'text-[#f5f4ee]/50 hover:text-[#f5f4ee]'}`}>
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => setVue('liste')} title="Vue liste"
              className={`grid h-9 w-9 place-items-center transition-colors ${vue === 'liste' ? 'bg-[#d97757]/20 text-[#e8a184]' : 'text-[#f5f4ee]/50 hover:text-[#f5f4ee]'}`}>
              <LayoutList className="h-4 w-4" />
            </button>
          </div>
          <button type="button" onClick={() => load(weekStart)} disabled={loading} className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 text-[#f5f4ee]/60 transition-colors hover:text-[#f5f4ee] disabled:opacity-50" title="Rafraîchir"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></button>
          <a href="/liri/calendrier/reglages" className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 text-[#f5f4ee]/60 transition-colors hover:text-[#f5f4ee]" title="Réglages de l'agenda"><Settings2 className="h-4 w-4" /></a>
        </div>
      </div>

      {/* ── Recherche + filtres par type (la légende EST le filtre) ──────── */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <label className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#f5f4ee]/40" />
          <input
            ref={rechercheRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher…  ( / )"
            className="h-8 w-52 rounded-lg border border-white/10 bg-white/[0.04] pl-8 pr-7 text-[12.5px] text-[#f5f4ee] placeholder:text-[#f5f4ee]/45 outline-none transition-colors focus:border-[#d97757]/60"
          />
          {q && (
            <button type="button" onClick={() => setQ('')} className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-[#f5f4ee]/45 hover:text-[#f5f4ee]" title="Effacer la recherche">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </label>
        <span className="h-4 w-px bg-white/10" />
        {Object.entries(KIND).map(([k, v]) => {
          const actif = typesActifs === null || typesActifs.has(k);
          const compte = comptesParType[k] || 0;
          return (
            <button
              key={k}
              type="button"
              onClick={() => basculerType(k)}
              title={actif ? `Masquer : ${v.label}` : `Afficher : ${v.label}`}
              aria-pressed={actif}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[11.5px] transition-all ${
                actif
                  ? 'border-white/15 bg-white/[0.05] text-[#f5f4ee]/85'
                  : 'border-transparent bg-transparent text-[#f5f4ee]/35 hover:text-[#f5f4ee]/60'
              }`}
            >
              <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: v.bg, border: `1px solid ${v.bd}`, opacity: actif ? 1 : 0.4 }} />
              {v.label}
              {compte > 0 && <span className={`tabular-nums text-[10.5px] ${actif ? 'text-[#f5f4ee]/50' : 'text-[#f5f4ee]/30'}`}>{compte}</span>}
            </button>
          );
        })}
        {(typesActifs !== null || q) && (
          <button type="button" onClick={() => { setTypesActifs(null); setQ(''); }}
            className="rounded-lg px-2 py-1 text-[11.5px] font-semibold text-[#e8a184] transition-colors hover:text-[#f0b9a2]">
            Tout afficher{masques > 0 ? ` (${masques} masqué${masques > 1 ? 's' : ''})` : ''}
          </button>
        )}
      </div>

      {err && (
        <div className="mt-3 flex items-center justify-between rounded-lg bg-red-500/10 px-3 py-2 text-[13px] text-red-300">
          {err}
          <button type="button" onClick={() => load(weekStart)} className="font-semibold underline-offset-2 hover:underline">Réessayer</button>
        </div>
      )}

      {/* ── Corps ────────────────────────────────────────────────────────── */}
      <div className="relative mt-4 min-h-0 flex-1 overflow-auto rounded-2xl border border-white/[0.08] bg-white/[0.02]">
        {loading && !data ? (
          <SkeletonSemaine />
        ) : rienCetteSemaine ? (
          <EtatVide
            titre="Aucun événement cette semaine"
            texte="Les rendez-vous confirmés, masterclass, lives et plages de repos apparaissent ici automatiquement."
          />
        ) : toutFiltre ? (
          <EtatVide
            titre="Tout est masqué par vos filtres"
            texte={`${evenements.length} événement${evenements.length > 1 ? 's' : ''} existent cette semaine mais aucun ne correspond à la recherche ou aux types actifs.`}
            action={<button type="button" onClick={() => { setTypesActifs(null); setQ(''); }} className="mt-3 rounded-xl bg-[#d97757] px-4 py-2 text-[13px] font-semibold text-white transition-opacity hover:opacity-90">Tout afficher</button>}
          />
        ) : vue === 'liste' ? (
          <VueListe days={days} visibles={visibles} aujourdhui={aujourdhui} onOuvrir={setDetail} />
        ) : (
          <div className="min-w-[760px]">
            {/* En-têtes jours + bande « journée entière » */}
            <div className="sticky top-0 z-10 border-b border-white/10 bg-[#2b2926]">
              <div className="grid grid-cols-[52px_repeat(7,1fr)]">
                <div />
                {days.map((ymd, i) => {
                  const estAuj = ymd === aujourdhui;
                  return (
                    <div key={ymd} className={`border-l border-white/[0.06] px-2 py-1.5 text-center ${estAuj ? 'bg-[#d97757]/[0.09]' : ''}`}>
                      <div className={`text-[12px] font-bold ${estAuj ? 'text-[#e8a184]' : 'text-[#f5f4ee]'}`}>{DOW_LABELS[i]}</div>
                      <div className={`text-[11px] ${estAuj ? 'text-[#e8a184]/80' : 'text-[#f5f4ee]/45'}`}>{dayHeaderLabel(ymd)}</div>
                    </div>
                  );
                })}
              </div>
              {Object.keys(parJour.bande).length > 0 && (
                <div className="grid grid-cols-[52px_repeat(7,1fr)] border-t border-white/[0.06]">
                  <div className="px-1 py-1 text-right text-[9.5px] uppercase leading-tight text-[#f5f4ee]/35">jour<br />entier</div>
                  {days.map((ymd) => (
                    <div key={ymd} className={`flex min-h-[26px] flex-col gap-0.5 border-l border-white/[0.06] p-1 ${ymd === aujourdhui ? 'bg-[#d97757]/[0.09]' : ''}`}>
                      {(parJour.bande[ymd] || []).map((ev) => {
                        const c = kindOf(ev.kind);
                        return (
                          <button key={ev._i} type="button" onClick={() => setDetail(ev)}
                            className="truncate rounded-md border px-1.5 py-0.5 text-left text-[10.5px] font-semibold transition-transform hover:scale-[1.01]"
                            style={{ background: c.bg, borderColor: c.bd, color: c.tx }}>
                            {ev.title} · {fmtMin(ev.s)}–{fmtMin(ev.e)}
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Grille horaire */}
            <div className="grid grid-cols-[52px_repeat(7,1fr)]">
              <div className="relative" style={{ height: gridHeight }}>
                {hours.map((h) => (
                  <div key={h} className="absolute right-1.5 -translate-y-1/2 text-[10.5px] tabular-nums text-[#f5f4ee]/40" style={{ top: (h - hDebut) * HOUR_PX }}>{String(h).padStart(2, '0')}h</div>
                ))}
              </div>
              {days.map((ymd) => {
                const estAuj = ymd === aujourdhui;
                return (
                  <div key={ymd} className={`relative border-l border-white/[0.06] ${estAuj ? 'bg-[#d97757]/[0.05]' : ''}`} style={{ height: gridHeight }}>
                    {hours.map((h) => (
                      <div key={h} className="absolute left-0 right-0 border-t border-white/[0.05]" style={{ top: (h - hDebut) * HOUR_PX }} />
                    ))}
                    {/* Repère « maintenant » — seulement sur la colonne du jour. */}
                    {estAuj && minuteNow >= hDebut * 60 && minuteNow <= hFin * 60 && (
                      <div className="pointer-events-none absolute left-0 right-0 z-[5]" style={{ top: ((minuteNow - hDebut * 60) / 60) * HOUR_PX }}>
                        <div className="h-px bg-[#d97757]" />
                        <div className="-mt-[3px] ml-0.5 h-1.5 w-1.5 rounded-full bg-[#d97757]" />
                      </div>
                    )}
                    {(parJour.grille[ymd] || []).map((ev) => {
                      const top = ((ev.s - hDebut * 60) / 60) * HOUR_PX;
                      const height = Math.max(20, ((ev.e - ev.s) / 60) * HOUR_PX - 2);
                      const largeur = 100 / ev.couloirs;
                      const c = kindOf(ev.kind);
                      const compact = height < 34;
                      return (
                        <button
                          key={ev._i}
                          type="button"
                          onClick={() => setDetail(ev)}
                          className="absolute overflow-hidden rounded-md border px-1.5 py-0.5 text-left transition-transform hover:z-[6] hover:scale-[1.02]"
                          style={{
                            top,
                            height,
                            left: `calc(${ev.couloir * largeur}% + 2px)`,
                            width: `calc(${largeur}% - 4px)`,
                            background: c.bg,
                            borderColor: c.bd,
                          }}
                          title={`${c.label} · ${fmtMin(ev.s)}–${fmtMin(ev.e)} · ${ev.title}`}
                        >
                          {compact ? (
                            <div className="truncate text-[11px] font-semibold leading-[1.35]" style={{ color: c.tx }}>
                              {ev.title} <span className="font-normal opacity-75">· {fmtMin(ev.s)}</span>
                            </div>
                          ) : (
                            <>
                              <div className="truncate text-[11px] font-semibold leading-tight" style={{ color: c.tx }}>{ev.title}</div>
                              <div className="truncate text-[10px] tabular-nums leading-tight" style={{ color: c.tx, opacity: 0.78 }}>{fmtMin(ev.s)}–{fmtMin(ev.e)}</div>
                            </>
                          )}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Volet de détail — s'ouvre au clic, Échap le ferme. */}
        {detail && (
          <VoletDetail ev={detail} onClose={() => setDetail(null)} />
        )}
      </div>
    </div>
  );
}

/* ── Vue liste : dense, groupée par jour — c'est aussi la lecture mobile. ── */
function VueListe({ days, visibles, aujourdhui, onOuvrir }) {
  const parJour = useMemo(() => {
    const m = {};
    for (const ev of visibles) (m[ev.ymd] = m[ev.ymd] || []).push(ev);
    for (const k of Object.keys(m)) m[k].sort((a, b) => a.s - b.s);
    return m;
  }, [visibles]);
  return (
    <div className="divide-y divide-white/[0.06]">
      {days.map((ymd) => {
        const evts = parJour[ymd] || [];
        if (!evts.length) return null;
        const estAuj = ymd === aujourdhui;
        return (
          <section key={ymd} className="px-4 py-3">
            <h2 className={`text-[12.5px] font-bold capitalize ${estAuj ? 'text-[#e8a184]' : 'text-[#f5f4ee]/80'}`}>
              {dayLongLabel(ymd)}{estAuj ? ' · aujourd’hui' : ''}
            </h2>
            <ul className="mt-1.5 space-y-1">
              {evts.map((ev) => {
                const c = kindOf(ev.kind);
                return (
                  <li key={ev._i}>
                    <button type="button" onClick={() => onOuvrir(ev)}
                      className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-white/[0.04]">
                      <span className="w-[86px] shrink-0 text-[11.5px] tabular-nums text-[#f5f4ee]/55">{fmtMin(ev.s)}–{fmtMin(ev.e)}</span>
                      <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: c.bg, border: `1px solid ${c.bd}` }} />
                      <span className="truncate text-[12.5px] text-[#f5f4ee]/90">{ev.title}</span>
                      <span className="ml-auto shrink-0 text-[10.5px] text-[#f5f4ee]/40">{c.label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

/* ── Volet de détail (pas de modal : un panneau latéral, Échap ferme). ──── */
function VoletDetail({ ev, onClose }) {
  const c = kindOf(ev.kind);
  return (
    <aside
      className="absolute right-0 top-0 z-20 flex h-full w-[290px] flex-col border-l border-white/10 bg-[#2b2926] shadow-[-16px_0_40px_rgba(0,0,0,0.35)]"
      role="dialog"
      aria-label={`Détail : ${ev.title}`}
    >
      <div className="flex items-center justify-between border-b border-white/[0.08] px-3.5 py-2.5">
        <span className="inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-semibold" style={{ background: c.bg, borderColor: c.bd, color: c.tx }}>
          {c.label}
        </span>
        <button type="button" onClick={onClose} className="grid h-7 w-7 place-items-center rounded-lg text-[#f5f4ee]/50 transition-colors hover:bg-white/[0.06] hover:text-[#f5f4ee]" title="Fermer (Échap)">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-3.5 py-3">
        <h3 className="text-[15px] font-bold leading-snug text-[#f5f4ee]">{ev.title}</h3>
        <p className="mt-1.5 text-[12.5px] capitalize text-[#f5f4ee]/70">{dayLongLabel(ev.ymd)}</p>
        <p className="text-[12.5px] tabular-nums text-[#f5f4ee]/70">{fmtMin(ev.s)} – {fmtMin(ev.e)}{ev.jourEntier ? ' · journée entière' : ''}</p>
        {ev.description ? (
          <p className="mt-3 whitespace-pre-wrap text-[12.5px] leading-relaxed text-[#f5f4ee]/80">{ev.description}</p>
        ) : null}
      </div>
      {KINDS_GERABLES.has(ev.kind) && (
        <div className="border-t border-white/[0.08] p-3">
          <a href="/liri/rdv" className="flex items-center justify-center gap-1.5 rounded-xl bg-[#d97757] px-3 py-2 text-[12.5px] font-semibold text-white transition-opacity hover:opacity-90">
            Gérer dans Rendez-vous <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      )}
    </aside>
  );
}

/* ── États vides / chargement ─────────────────────────────────────────────── */
function EtatVide({ titre, texte, action = null }) {
  return (
    <div className="flex h-64 flex-col items-center justify-center px-6 text-center">
      <CalendarX2 className="h-8 w-8 text-[#f5f4ee]/25" />
      <p className="mt-3 text-[14px] font-semibold text-[#f5f4ee]/80">{titre}</p>
      <p className="mt-1 max-w-[46ch] text-[12.5px] leading-relaxed text-[#f5f4ee]/50">{texte}</p>
      {action}
    </div>
  );
}

function SkeletonSemaine() {
  return (
    <div className="animate-pulse p-4" aria-label="Chargement du calendrier">
      <div className="grid grid-cols-[52px_repeat(7,1fr)] gap-2">
        <div />
        {Array.from({ length: 7 }).map((_, i) => <div key={i} className="h-9 rounded-lg bg-white/[0.05]" />)}
      </div>
      <div className="mt-3 grid grid-cols-[52px_repeat(7,1fr)] gap-2">
        <div />
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="space-y-2">
            {Array.from({ length: 2 + (i % 3) }).map((_, j) => (
              <div key={j} className="rounded-md bg-white/[0.04]" style={{ height: 34 + ((i + j) % 3) * 26, marginTop: j === 0 ? (i % 4) * 30 : 0 }} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
