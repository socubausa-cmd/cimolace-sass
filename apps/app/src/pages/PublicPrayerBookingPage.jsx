import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Sparkles, Loader2, Check, ArrowRight, Calendar, Clock } from 'lucide-react';
import { bookingPublicApi } from '@/lib/api-v2';
import PhoneCountryField from '@/components/PhoneCountryField';

// Tenant qui reçoit les demandes (prorascience = isna).
const SLUG = 'isna';
const TZ = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return 'UTC'; } })();

const dayLabel = (d) => d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
const timeLabel = (d) => d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

// Regroupe des ISO par JOUR (fuseau visiteur), cap 8 jours / 16 créneaux.
function groupSlots(isos) {
  const byDay = new Map();
  for (const iso of isos.slice(0, 120)) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime()) || d.getTime() < Date.now()) continue;
    const key = d.toDateString();
    if (!byDay.has(key)) { if (byDay.size >= 8) continue; byDay.set(key, { date: d, slots: [] }); }
    const g = byDay.get(key);
    if (g.slots.length < 16) g.slots.push({ iso, d });
  }
  return [...byDay.values()];
}

// Repli : créneaux d'ouverture génériques (jours ouvrés, 09h–17h) — l'utilisateur
// choisit, le créneau est matérialisé côté serveur, le secrétariat confirme.
function genericSlots() {
  const out = [];
  const now = new Date();
  for (let day = 1; day <= 12 && out.length < 8 * 9; day++) {
    const base = new Date(now); base.setDate(now.getDate() + day); base.setHours(9, 0, 0, 0);
    const wd = base.getDay(); if (wd === 0) continue; // dimanche off
    for (let h = 9; h <= 17; h++) { const s = new Date(base); s.setHours(h); out.push(s.toISOString()); }
  }
  return groupSlots(out);
}

export default function PublicPrayerBookingPage() {
  const [requete, setRequete] = useState('');
  const [email, setEmail] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [waOk, setWaOk] = useState(false);
  const [days, setDays] = useState([]);
  const [activeDay, setActiveDay] = useState(0);
  const [chosenIso, setChosenIso] = useState(null);
  const [loadingSlots, setLoadingSlots] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const loadSlots = useCallback(async () => {
    setLoadingSlots(true);
    try {
      const now = new Date();
      const end = new Date(now.getTime() + 14 * 24 * 3600 * 1000);
      const res = await bookingPublicApi.availability(SLUG, { timezone: TZ, windowStart: now.toISOString(), windowEnd: end.toISOString() });
      const grid = Array.isArray(res?.slotGrid) ? res.slotGrid : [];
      const isos = grid.filter((c) => c?.state === 'available' && c?.slotUtc).map((c) => c.slotUtc);
      let grouped = groupSlots(isos);
      if (grouped.length === 0) grouped = genericSlots();
      setDays(grouped); setActiveDay(0);
    } catch { setDays(genericSlots()); }
    finally { setLoadingSlots(false); }
  }, []);
  useEffect(() => { loadSlots(); }, [loadSlots]);

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const canSubmit = requete.trim().length >= 3 && emailOk && waOk;

  const submit = async () => {
    setError('');
    if (!canSubmit) { setError('Renseignez votre requête, un e-mail et un numéro WhatsApp valides.'); return; }
    setSubmitting(true);
    try {
      await bookingPublicApi.request(SLUG, {
        subject: 'Séance de prière',
        description: requete.trim(),
        email: email.trim(),
        whatsapp: whatsapp.trim(),
        preferredIso: chosenIso || undefined,
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
          <h1 className="text-2xl font-extrabold">Votre séance est réservée 🙏</h1>
          <p className="mt-3 text-[15px] leading-relaxed text-[#f5f4ee]/[0.72]">
            {chosenLabel ? <>Nous vous attendons le <strong className="text-[#f5f4ee]">{chosenLabel}</strong>. </> : null}
            Vous recevrez une confirmation par e-mail et WhatsApp. Vous serez porté dans la prière.
          </p>
          <a href="/cagnotte" className="mt-6 inline-flex items-center gap-2 text-[13px] font-semibold text-[#e8a184] hover:underline">← Retour à la cagnotte</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#262624] text-[#f5f4ee]" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div className="mx-auto max-w-2xl px-5 py-14">
        <span className="inline-flex items-center gap-2 rounded-full border border-[#d97757]/40 bg-[#d97757]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-[#e8a184]">
          <Sparkles className="h-3.5 w-3.5" /> Séance de prière · offerte
        </span>
        <h1 className="mt-4 text-3xl font-extrabold leading-tight sm:text-4xl">Réservez votre séance de prière</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-[#f5f4ee]/[0.72]">
          En reconnaissance de votre offrande — un moment pour déposer votre requête et être porté dans la prière.
          Choisissez un créneau, nous vous confirmons par e-mail et WhatsApp.
        </p>

        <div className="mt-8 space-y-5 rounded-2xl border border-white/10 bg-[#2f2d2a] p-5 sm:p-6">
          <label className="block">
            <span className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wide text-[#f5f4ee]/50">Votre requête de prière</span>
            <textarea rows={3} value={requete} onChange={(e) => setRequete(e.target.value)} maxLength={600}
              placeholder="Ce que vous souhaitez confier à la prière…"
              className="w-full resize-none rounded-lg border border-white/10 bg-[#262624] px-3 py-2.5 text-sm text-[#f5f4ee] outline-none placeholder:text-[#f5f4ee]/35 focus:border-[#d97757]" />
          </label>
          <div className="grid gap-3 sm:grid-cols-[1fr_1.45fr]">
            <label className="block">
              <span className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wide text-[#f5f4ee]/50">E-mail</span>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vous@exemple.com"
                className="w-full rounded-lg border border-white/10 bg-[#262624] px-3 py-2.5 text-sm text-[#f5f4ee] outline-none placeholder:text-[#f5f4ee]/35 focus:border-[#d97757]" />
            </label>
            <PhoneCountryField label="WhatsApp" onChange={(e164, meta) => { setWhatsapp(e164); setWaOk(meta.ok); }} />
          </div>

          <div>
            <span className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide text-[#f5f4ee]/50">
              <Calendar className="h-3.5 w-3.5" /> Choisissez un créneau
            </span>
            {loadingSlots ? (
              <div className="flex items-center gap-2 py-4 text-sm text-[#f5f4ee]/55"><Loader2 className="h-4 w-4 animate-spin" /> Chargement des disponibilités…</div>
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
                <p className="mt-2 text-[11px] text-[#f5f4ee]/45">Aucun créneau ne convient ? Envoyez quand même — nous vous proposerons un horaire.</p>
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
