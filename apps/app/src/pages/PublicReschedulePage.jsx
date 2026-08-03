import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CalendarClock, Loader2, Check, ArrowRight, Calendar, Clock, AlertTriangle } from 'lucide-react';
import { bookingPublicApi } from '@/lib/api-v2';

// Fuseau du visiteur (les créneaux sont affichés à SON heure locale).
const TZ = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return 'UTC'; } })();
const dayLabel = (d) => d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
const timeLabel = (d) => d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
const fullLabel = (iso) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? null : `${dayLabel(d)} · ${timeLabel(d)}`; };

// Regroupe des ISO par JOUR (fuseau visiteur), cap 8 jours / 16 créneaux.
function groupSlots(isos) {
  const byDay = new Map();
  for (const iso of isos.slice(0, 160)) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime()) || d.getTime() < Date.now()) continue;
    const key = d.toDateString();
    if (!byDay.has(key)) { if (byDay.size >= 8) continue; byDay.set(key, { date: d, slots: [] }); }
    const g = byDay.get(key);
    if (g.slots.length < 16) g.slots.push({ iso, d });
  }
  return [...byDay.values()];
}

const Page = ({ children }) => (
  <div className="min-h-screen bg-[#262624] text-[#f5f4ee]" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
    {children}
  </div>
);

export default function PublicReschedulePage() {
  const { token } = useParams();
  const [ctx, setCtx] = useState(null);
  const [days, setDays] = useState([]);
  const [activeDay, setActiveDay] = useState(0);
  const [chosenIso, setChosenIso] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fatal, setFatal] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [doneIso, setDoneIso] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true); setFatal('');
      try {
        const c = await bookingPublicApi.rescheduleContext(token);
        if (!alive) return;
        setCtx(c);
        const now = new Date();
        const end = new Date(now.getTime() + 14 * 24 * 3600 * 1000);
        const res = await bookingPublicApi.availability(c?.slug || 'isna', {
          timezone: TZ, windowStart: now.toISOString(), windowEnd: end.toISOString(),
        });
        const grid = Array.isArray(res?.slotGrid) ? res.slotGrid : [];
        const isos = grid.filter((x) => x?.state === 'available' && x?.slotUtc).map((x) => x.slotUtc);
        if (!alive) return;
        setDays(groupSlots(isos)); setActiveDay(0);
      } catch (e) {
        if (!alive) return;
        setFatal(e?.response?.data?.error?.message || e?.response?.data?.message || 'Ce lien est invalide ou expiré.');
      } finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [token]);

  const currentLabel = useMemo(() => (ctx?.currentStart ? fullLabel(ctx.currentStart) : null), [ctx]);

  const submit = async () => {
    if (!chosenIso) { setError('Choisissez un créneau.'); return; }
    setError(''); setSubmitting(true);
    try {
      const r = await bookingPublicApi.applyReschedule(token, chosenIso);
      setDoneIso(r?.newStart || chosenIso);
    } catch (e) {
      setError(e?.response?.data?.error?.message || e?.response?.data?.message || 'Impossible d’enregistrer ce créneau. Réessayez.');
    } finally { setSubmitting(false); }
  };

  if (loading) {
    return <Page><div className="flex min-h-screen items-center justify-center gap-2 text-[#f5f4ee]/60"><Loader2 className="h-5 w-5 animate-spin" /> Chargement…</div></Page>;
  }
  if (fatal) {
    return (
      <Page>
        <div className="flex min-h-screen items-center justify-center px-5">
          <div className="max-w-md text-center">
            <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-500/15 text-red-300"><AlertTriangle className="h-7 w-7" /></span>
            <h1 className="text-2xl font-extrabold">Lien indisponible</h1>
            <p className="mt-3 text-[15px] leading-relaxed text-[#f5f4ee]/[0.72]">{fatal}</p>
            <a href="/rendez-vous-priere" className="mt-6 inline-flex items-center gap-2 text-[13px] font-semibold text-[#e8a184] hover:underline">Prendre un nouveau rendez-vous <ArrowRight className="h-4 w-4" /></a>
          </div>
        </div>
      </Page>
    );
  }
  if (doneIso) {
    const lbl = fullLabel(doneIso);
    return (
      <Page>
        <div className="flex min-h-screen items-center justify-center px-5">
          <div className="max-w-md text-center">
            <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#d97757]/20 text-[#e8a184]"><Check className="h-7 w-7" /></span>
            <h1 className="text-2xl font-extrabold">C'est reprogrammé 🙏</h1>
            <p className="mt-3 text-[15px] leading-relaxed text-[#f5f4ee]/[0.72]">
              {lbl ? <>Votre nouveau rendez-vous est fixé au <strong className="text-[#f5f4ee]">{lbl}</strong>. </> : null}
              Vous recevrez une confirmation par e-mail et WhatsApp.
            </p>
          </div>
        </div>
      </Page>
    );
  }

  return (
    <Page>
      <div className="mx-auto max-w-2xl px-5 py-14">
        <span className="inline-flex items-center gap-2 rounded-full border border-[#d97757]/40 bg-[#d97757]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-[#e8a184]">
          <CalendarClock className="h-3.5 w-3.5" /> Reprogrammer votre rendez-vous
        </span>
        <h1 className="mt-4 text-3xl font-extrabold leading-tight sm:text-4xl">Choisissez un nouveau créneau</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-[#f5f4ee]/[0.72]">
          Concernant votre rendez-vous « <strong className="text-[#f5f4ee]">{ctx?.subject || 'séance'}</strong> »
          {currentLabel ? <> initialement prévu le <strong className="text-[#f5f4ee]">{currentLabel}</strong></> : null}, sélectionnez l'horaire qui vous convient.
        </p>
        {ctx?.reason && (
          <p className="mt-3 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[13.5px] text-[#f5f4ee]/70">{ctx.reason}</p>
        )}

        <div className="mt-8 space-y-5 rounded-2xl border border-white/10 bg-[#2f2d2a] p-5 sm:p-6">
          <div>
            <span className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide text-[#f5f4ee]/50">
              <Calendar className="h-3.5 w-3.5" /> Disponibilités
            </span>
            {days.length === 0 ? (
              <p className="py-4 text-sm text-[#f5f4ee]/55">Aucun créneau disponible pour l'instant. Réessayez plus tard.</p>
            ) : (
              <>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {days.map((d, i) => (
                    <button key={i} type="button" onClick={() => setActiveDay(i)}
                      className={`shrink-0 rounded-lg border px-3 py-1.5 text-[12px] font-semibold capitalize transition-colors ${
                        i === activeDay ? 'border-[#d97757] bg-[#d97757]/15 text-[#e8a184]' : 'border-white/10 text-[#f5f4ee]/70 hover:border-white/25'}`}>
                      {dayLabel(d.date)}
                    </button>
                  ))}
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {(days[activeDay]?.slots || []).map(({ iso, d }) => (
                    <button key={iso} type="button" onClick={() => setChosenIso(iso)}
                      className={`flex items-center justify-center gap-1 rounded-lg border py-2 text-[13px] font-semibold transition-colors ${
                        chosenIso === iso ? 'border-[#d97757] bg-[#d97757] text-[#1c1a18]' : 'border-white/10 text-[#f5f4ee]/80 hover:border-[#d97757]/60'}`}>
                      <Clock className="h-3 w-3 opacity-70" /> {timeLabel(d)}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-[13px] text-red-300">{error}</p>}

          <button type="button" disabled={submitting || !chosenIso} onClick={submit}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#d97757] py-3.5 text-[15px] font-bold text-[#1c1a18] shadow-[0_10px_30px_rgba(217,119,87,0.3)] transition-all hover:bg-[#e08b6d] disabled:cursor-not-allowed disabled:opacity-50">
            {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}
            {submitting ? 'Enregistrement…' : 'Confirmer ce créneau'}
            {!submitting && <ArrowRight className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </Page>
  );
}
