import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Sparkles, Loader2, Check, ArrowRight, Calendar, Clock, HeartHandshake, Video, GraduationCap, CalendarClock } from 'lucide-react';
import { bookingPublicApi } from '@/lib/api-v2';

// Tenant qui reçoit les demandes (prorascience = isna).
const SLUG = 'isna';
const TZ = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return 'UTC'; } })();
const ICONS = { priere: HeartHandshake, teleconsult: Video, formation: GraduationCap };

const dayLabel = (d) => d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
const timeLabel = (d) => d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

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

export default function PublicReservationPage() {
  const [services, setServices] = useState([]);
  const [serviceKey, setServiceKey] = useState('');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [days, setDays] = useState([]);
  const [activeDay, setActiveDay] = useState(0);
  const [chosenIso, setChosenIso] = useState(null);
  const [loadingSlots, setLoadingSlots] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await bookingPublicApi.services(SLUG);
        const list = Array.isArray(r?.services) ? r.services : [];
        setServices(list);
        if (list[0]?.key) setServiceKey(list[0].key);
      } catch { setServices([]); }
    })();
  }, []);

  const loadSlots = useCallback(async () => {
    setLoadingSlots(true);
    try {
      const now = new Date();
      const end = new Date(now.getTime() + 14 * 24 * 3600 * 1000);
      const res = await bookingPublicApi.availability(SLUG, { timezone: TZ, windowStart: now.toISOString(), windowEnd: end.toISOString() });
      const grid = Array.isArray(res?.slotGrid) ? res.slotGrid : [];
      const isos = grid.filter((c) => c?.state === 'available' && c?.slotUtc).map((c) => c.slotUtc);
      setDays(groupSlots(isos)); setActiveDay(0);
    } catch { setDays([]); }
    finally { setLoadingSlots(false); }
  }, []);
  useEffect(() => { loadSlots(); }, [loadSlots]);

  const svc = useMemo(() => services.find((s) => s.key === serviceKey) || null, [services, serviceKey]);
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const waOk = whatsapp.replace(/\D/g, '').length >= 8;
  const canSubmit = !!serviceKey && emailOk && waOk;

  const submit = async () => {
    setError('');
    if (!canSubmit) { setError('Choisissez un service, puis renseignez un e-mail et un WhatsApp valides.'); return; }
    setSubmitting(true);
    try {
      await bookingPublicApi.request(SLUG, {
        subject: svc?.label || 'Rendez-vous',
        description: message.trim() || '—',
        email: email.trim(),
        whatsapp: whatsapp.trim(),
        preferredIso: chosenIso || undefined,
        serviceKey,
      });
      setDone(true);
    } catch (e) { setError(e?.response?.data?.error?.message || e?.response?.data?.message || 'Envoi impossible pour le moment. Réessayez.'); }
    finally { setSubmitting(false); }
  };

  const chosenLabel = useMemo(() => {
    if (!chosenIso) return null; const d = new Date(chosenIso);
    return `${dayLabel(d)} · ${timeLabel(d)}`;
  }, [chosenIso]);

  if (done) {
    return (
      <div className="min-h-screen bg-[#262624] text-[#f5f4ee] flex items-center justify-center px-5" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
        <div className="max-w-md text-center">
          <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#d97757]/20 text-[#e8a184]"><Check className="h-7 w-7" /></span>
          <h1 className="text-2xl font-extrabold">Votre demande est enregistrée 🙏</h1>
          <p className="mt-3 text-[15px] leading-relaxed text-[#f5f4ee]/70">
            {svc?.label ? <><strong className="text-[#f5f4ee]">{svc.label}</strong>{chosenLabel ? <> — {chosenLabel}</> : ''}. </> : null}
            Vous recevrez une confirmation par e-mail et WhatsApp.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#262624] text-[#f5f4ee]" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div className="mx-auto max-w-2xl px-5 py-14">
        <span className="inline-flex items-center gap-2 rounded-full border border-[#d97757]/40 bg-[#d97757]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-[#e8a184]">
          <CalendarClock className="h-3.5 w-3.5" /> Prendre rendez-vous
        </span>
        <h1 className="mt-4 text-3xl font-extrabold leading-tight sm:text-4xl">Réservez votre séance</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-[#f5f4ee]/70">Choisissez le type de séance, un créneau, et nous vous confirmons par e-mail et WhatsApp.</p>

        {/* Sélecteur de service */}
        <div className="mt-7 grid gap-3 sm:grid-cols-3">
          {services.map((s) => {
            const Icon = ICONS[s.kind] || ICONS[s.key] || Sparkles;
            const active = serviceKey === s.key;
            return (
              <button key={s.key} type="button" onClick={() => setServiceKey(s.key)}
                className={`flex flex-col items-start gap-2 rounded-2xl border p-4 text-left transition-colors ${
                  active ? 'border-[#d97757] bg-[#d97757]/10' : 'border-white/10 bg-[#2f2d2a] hover:border-white/25'}`}>
                <span className={`grid h-9 w-9 place-items-center rounded-xl ${active ? 'bg-[#d97757]/20 text-[#e8a184]' : 'bg-white/5 text-[#f5f4ee]/60'}`}><Icon className="h-4.5 w-4.5" /></span>
                <span className="text-[14px] font-bold text-[#f5f4ee]">{s.label}</span>
                {s.desc && <span className="text-[12px] leading-snug text-[#f5f4ee]/60">{s.desc}</span>}
              </button>
            );
          })}
        </div>

        <div className="mt-6 space-y-5 rounded-2xl border border-white/10 bg-[#2f2d2a] p-5 sm:p-6">
          <label className="block">
            <span className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wide text-[#f5f4ee]/50">Votre message {svc ? `(${svc.label})` : ''}</span>
            <textarea rows={3} value={message} onChange={(e) => setMessage(e.target.value)} maxLength={600}
              placeholder="Ce que vous souhaitez partager, votre demande…"
              className="w-full resize-none rounded-lg border border-white/10 bg-[#262624] px-3 py-2.5 text-sm text-[#f5f4ee] outline-none placeholder:text-[#f5f4ee]/40 focus:border-[#d97757]" />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wide text-[#f5f4ee]/50">E-mail</span>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vous@exemple.com"
                className="w-full rounded-lg border border-white/10 bg-[#262624] px-3 py-2.5 text-sm text-[#f5f4ee] outline-none placeholder:text-[#f5f4ee]/40 focus:border-[#d97757]" />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wide text-[#f5f4ee]/50">WhatsApp</span>
              <input type="tel" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="+241 6 00 00 00 00"
                className="w-full rounded-lg border border-white/10 bg-[#262624] px-3 py-2.5 text-sm text-[#f5f4ee] outline-none placeholder:text-[#f5f4ee]/40 focus:border-[#d97757]" />
            </label>
          </div>

          <div>
            <span className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide text-[#f5f4ee]/50">
              <Calendar className="h-3.5 w-3.5" /> Choisissez un créneau
            </span>
            {loadingSlots ? (
              <div className="flex items-center gap-2 py-4 text-sm text-[#f5f4ee]/50"><Loader2 className="h-4 w-4 animate-spin" /> Chargement des disponibilités…</div>
            ) : days.length === 0 ? (
              <p className="py-3 text-[13px] text-[#f5f4ee]/50">Aucun créneau pour l'instant — envoyez quand même, nous vous proposerons un horaire.</p>
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

          <button type="button" disabled={submitting || !canSubmit} onClick={submit}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#d97757] py-3.5 text-[15px] font-bold text-[#1c1a18] shadow-[0_10px_30px_rgba(217,119,87,0.3)] transition-all hover:bg-[#e08b6d] disabled:cursor-not-allowed disabled:opacity-50">
            {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
            {submitting ? 'Envoi…' : chosenIso ? 'Réserver ce créneau' : 'Envoyer ma demande'}
            {!submitting && <ArrowRight className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
