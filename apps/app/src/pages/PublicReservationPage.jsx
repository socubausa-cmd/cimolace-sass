import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Sparkles, Loader2, Check, ArrowRight, Calendar, Clock, HeartHandshake, Video, GraduationCap, CalendarClock, X } from 'lucide-react';
import { bookingPublicApi } from '@/lib/api-v2';
import PhoneCountryField from '@/components/PhoneCountryField';

// Tenant qui reçoit les demandes (prorascience = isna).
const SLUG = 'isna';
const TZ = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return 'UTC'; } })();
const ICONS = { priere: HeartHandshake, teleconsult: Video, formation: GraduationCap };

// Fiche de consultation : champs déclarés par le service (metadata.booking_services[].champs).
const CHAMPS_FICHE = {
  age: { label: 'Âge', type: 'number', placeholder: 'Ex : 34' },
  taille: { label: 'Taille (cm)', type: 'number', placeholder: 'Ex : 175' },
  pointure: { label: 'Pointure', type: 'number', placeholder: 'Ex : 42' },
  naissance: { label: 'Date de naissance', type: 'date', placeholder: '' },
  probleme: { label: 'Racontez votre problème', type: 'textarea', placeholder: 'Ce qui vous amène : votre situation, vos questions…' },
};

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
  const [waOk, setWaOk] = useState(false);
  const [emailTouche, setEmailTouche] = useState(false);
  const [fiche, setFiche] = useState({ age: '', taille: '', pointure: '', naissance: '', probleme: '' });
  const [motifKey, setMotifKey] = useState('');
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
        // ⚠️ Ne JAMAIS écraser un choix déjà fait : sur connexion lente, le visiteur
        // peut cliquer une carte avant la fin du chargement du catalogue.
        if (list[0]?.key) setServiceKey((k) => k || list[0].key);
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
  // Champs de fiche exigés par le service sélectionné (ex : consultation Manikongo).
  const champsRequis = useMemo(() => (Array.isArray(svc?.champs) ? svc.champs.filter((k) => CHAMPS_FICHE[k]) : []), [svc]);
  const ficheOk = champsRequis.every((k) => (k === 'probleme' ? fiche[k].trim().length >= 10 : String(fiche[k]).trim().length > 0));
  // Motifs de consultation (prière, libation, songe, questions, couple, sagesse…).
  const motifs = useMemo(() => (Array.isArray(svc?.motifs) ? svc.motifs : []), [svc]);
  const motif = useMemo(() => motifs.find((m) => m.key === motifKey) || null, [motifs, motifKey]);
  const motifOk = motifs.length === 0 || !!motif;
  const canSubmit = !!serviceKey && emailOk && waOk && ficheOk && motifOk;
  // Ce qu'il reste à renseigner — un bouton désactivé ne doit jamais être un mystère.
  const manque = [
    !serviceKey && 'le type de séance',
    motifs.length > 0 && !motif && 'le motif de votre consultation',
    !emailOk && 'un e-mail valide',
    !waOk && 'votre numéro WhatsApp',
    champsRequis.length > 0 && !ficheOk && 'votre fiche de consultation',
  ].filter(Boolean);

  const submit = async () => {
    setError('');
    if (!canSubmit) { setError('Choisissez un service, puis renseignez un e-mail et un WhatsApp valides.'); return; }
    setSubmitting(true);
    try {
      // Fiche de consultation → lignes structurées, lisibles par le secrétariat
      // (elles atterrissent dans le récap notes du RDV).
      const lignesFiche = champsRequis.filter((k) => k !== 'probleme').map((k) => `${CHAMPS_FICHE[k].label} : ${String(fiche[k]).trim()}`);
      const probleme = champsRequis.includes('probleme') ? fiche.probleme.trim() : '';
      const description = [
        motif ? `Motif : ${motif.label}${motif.duo ? ' (séance pour deux)' : ''}\n` : '',
        probleme || message.trim() || '—',
        lignesFiche.length ? `\n${lignesFiche.join(' · ')}` : '',
      ].join('');
      await bookingPublicApi.request(SLUG, {
        subject: motif ? `${svc?.label || 'Consultation'} · ${motif.label}` : (svc?.label || 'Rendez-vous'),
        description,
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
          {svc?.priceEur ? (
            <>
              <p className="mt-4 text-[14px] font-semibold text-[#f5f4ee]">Dernière étape : le règlement de {svc.priceEur} € confirme votre séance.</p>
              <a href={`/paiement?type=consultation&plan=${encodeURIComponent(svc.key)}&label=${encodeURIComponent(svc.label)}&amount=${svc.priceEur}`}
                className="mt-3 inline-flex items-center justify-center gap-2 rounded-xl bg-[#d97757] px-6 py-3 text-[15px] font-bold text-[#1c1a18] shadow-[0_10px_30px_rgba(217,119,87,0.3)] transition-all hover:bg-[#e08b6d]">
                Régler la consultation — {svc.priceEur} € <ArrowRight className="h-4 w-4" />
              </a>
              <p className="mt-2 text-[12px] text-[#f5f4ee]/50">Carte bancaire ou mobile money — au nom de l'adresse e-mail indiquée.</p>
            </>
          ) : null}
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

        {/* Sélecteur de service — la consultation (payante, motifs) est mise en avant,
            les séances offertes suivent en rangée compacte. */}
        {(() => {
          const payants = services.filter((s) => s.priceEur);
          const offerts = services.filter((s) => !s.priceEur);
          const CartePayante = ({ s }) => {
            const active = serviceKey === s.key;
            const apercu = Array.isArray(s.motifs) ? s.motifs.map((m) => m.label) : [];
            return (
              <button type="button" onClick={() => { setServiceKey(s.key); setMotifKey(''); }}
                className={`flex w-full flex-col gap-3 rounded-2xl border p-5 text-left transition-colors sm:flex-row sm:items-start sm:gap-5 ${
                  active ? 'border-[#d97757] bg-[#d97757]/10' : 'border-[#d97757]/35 bg-[#2f2d2a] hover:border-[#d97757]/70'}`}>
                <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${active ? 'bg-[#d97757]/25 text-[#e8a184]' : 'bg-[#d97757]/10 text-[#e8a184]/80'}`}>
                  <HeartHandshake className="h-6 w-6" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-[16px] font-extrabold text-[#f5f4ee]">{s.label}</span>
                    <span className="inline-flex items-center rounded-md border border-[#d97757]/50 bg-[#d97757]/15 px-2 py-0.5 text-[11.5px] font-bold text-[#e8a184]">
                      {s.priceEur} € · {s.durationMin || 30} min
                    </span>
                  </span>
                  {s.desc && <span className="mt-1 block text-[13px] leading-snug text-[#f5f4ee]/70">{s.desc}</span>}
                  {apercu.length > 0 && (
                    <span className="mt-2 block text-[12px] leading-relaxed text-[#f5f4ee]/50">
                      {apercu.slice(0, 4).join(' · ')}{apercu.length > 4 ? ` · +${apercu.length - 4} autres motifs` : ''}
                    </span>
                  )}
                </span>
              </button>
            );
          };
          return (
            <div className="mt-7 space-y-3">
              {payants.map((s) => <CartePayante key={s.key} s={s} />)}
              {offerts.length > 0 && (
                <div className="grid gap-3 sm:grid-cols-3">
                  {offerts.map((s) => {
                    const Icon = ICONS[s.kind] || ICONS[s.key] || Sparkles;
                    const active = serviceKey === s.key;
                    return (
                      <button key={s.key} type="button" onClick={() => { setServiceKey(s.key); setMotifKey(''); }}
                        className={`flex flex-col items-start gap-2 rounded-2xl border p-4 text-left transition-colors ${
                          active ? 'border-[#d97757] bg-[#d97757]/10' : 'border-white/10 bg-[#2f2d2a] hover:border-white/25'}`}>
                        <span className={`grid h-9 w-9 place-items-center rounded-xl ${active ? 'bg-[#d97757]/20 text-[#e8a184]' : 'bg-white/5 text-[#f5f4ee]/60'}`}><Icon className="h-4.5 w-4.5" /></span>
                        <span className="text-[14px] font-bold text-[#f5f4ee]">{s.label}</span>
                        {s.desc && <span className="text-[12px] leading-snug text-[#f5f4ee]/60">{s.desc}</span>}
                        <span className={`mt-auto inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold ${
                          active ? 'border-[#d97757]/50 bg-[#d97757]/15 text-[#e8a184]' : 'border-white/10 text-[#f5f4ee]/55'}`}>
                          Offert{s.durationMin ? ` · ${s.durationMin} min` : ''}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()}

        {svc?.apropos && (
          <div className="mt-4 rounded-2xl border border-[#d97757]/25 bg-[#d97757]/[0.06] p-4">
            <p className="text-[13px] leading-relaxed text-[#f5f4ee]/80">{svc.apropos}</p>
            {svc.priceEur && <p className="mt-2 text-[12.5px] font-semibold text-[#e8a184]">La séance est à {svc.priceEur} € · {svc.durationMin || 30} minutes — règlement par carte ou mobile money après la réservation.</p>}
          </div>
        )}

        {motifs.length > 0 && (
          <div className="mt-4 rounded-2xl border border-white/10 bg-[#2f2d2a] p-5">
            <span className="mb-3 block text-[12px] font-semibold uppercase tracking-wide text-[#f5f4ee]/50">Quel est le motif de votre consultation ?</span>
            <div role="radiogroup" aria-label="Motif de consultation" className="space-y-2">
              {motifs.map((m) => {
                const actif = motifKey === m.key;
                return (
                  <button key={m.key} type="button" role="radio" aria-checked={actif} onClick={() => setMotifKey(m.key)}
                    className={`flex w-full items-start gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors ${
                      actif ? 'border-[#d97757] bg-[#d97757]/10' : 'border-white/10 hover:border-[#d97757]/50'}`}>
                    <span className={`mt-0.5 grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full border-2 ${
                      actif ? 'border-[#d97757]' : 'border-white/25'}`}>
                      {actif && <span className="h-2 w-2 rounded-full bg-[#d97757]" />}
                    </span>
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className={`text-[14px] font-bold ${actif ? 'text-[#f5f4ee]' : 'text-[#f5f4ee]/85'}`}>{m.label}</span>
                        {m.duo && <span className="inline-flex items-center rounded-md border border-[#d97757]/40 bg-[#d97757]/10 px-1.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-[#e8a184]">À deux</span>}
                      </span>
                      {m.desc && <span className="mt-0.5 block text-[12.5px] leading-snug text-[#f5f4ee]/60">{m.desc}</span>}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="mt-6 space-y-5 rounded-2xl border border-white/10 bg-[#2f2d2a] p-5 sm:p-6">
          {champsRequis.length > 0 && (
            <div>
              <span className="mb-2 block text-[12px] font-semibold uppercase tracking-wide text-[#f5f4ee]/50">Votre fiche de consultation</span>
              <div className="grid gap-3 sm:grid-cols-2">
                {champsRequis.filter((k) => CHAMPS_FICHE[k].type !== 'textarea').map((k) => {
                  const def = CHAMPS_FICHE[k];
                  return (
                    <label key={k} className="block">
                      <span className="mb-1.5 block text-[12px] font-semibold text-[#f5f4ee]/60">{def.label}</span>
                      <input type={def.type} inputMode={def.type === 'number' ? 'numeric' : undefined} value={fiche[k]}
                        onChange={(e) => setFiche((f) => ({ ...f, [k]: e.target.value }))} placeholder={def.placeholder}
                        className="w-full rounded-lg border border-white/10 bg-[#262624] px-3 py-2.5 text-sm text-[#f5f4ee] outline-none placeholder:text-[#f5f4ee]/50 focus:border-[#d97757] [color-scheme:dark]" />
                    </label>
                  );
                })}
              </div>
              {champsRequis.includes('probleme') && (
                <label className="mt-3 block">
                  <span className="mb-1.5 block text-[12px] font-semibold text-[#f5f4ee]/60">{CHAMPS_FICHE.probleme.label}</span>
                  <textarea rows={4} value={fiche.probleme} maxLength={1200}
                    onChange={(e) => setFiche((f) => ({ ...f, probleme: e.target.value }))}
                    placeholder={CHAMPS_FICHE.probleme.placeholder}
                    className="w-full resize-none rounded-lg border border-white/10 bg-[#262624] px-3 py-2.5 text-sm text-[#f5f4ee] outline-none placeholder:text-[#f5f4ee]/50 focus:border-[#d97757]" />
                  <p className="mt-1 min-h-[16px] text-[11px] text-[#f5f4ee]/50" aria-live="polite">
                    {fiche.probleme.trim().length > 0 && fiche.probleme.trim().length < 10 ? 'Quelques mots de plus — au moins 10 caractères.' : ''}
                  </p>
                </label>
              )}
            </div>
          )}
          {champsRequis.length === 0 && (
          <label className="block">
            <span className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wide text-[#f5f4ee]/50">Votre message {svc ? `(${svc.label})` : ''}</span>
            <textarea rows={3} value={message} onChange={(e) => setMessage(e.target.value)} maxLength={600}
              placeholder="Ce que vous souhaitez partager, votre demande…"
              className="w-full resize-none rounded-lg border border-white/10 bg-[#262624] px-3 py-2.5 text-sm text-[#f5f4ee] outline-none placeholder:text-[#f5f4ee]/50 focus:border-[#d97757]" />
          </label>
          )}
          <div className="grid gap-3 sm:grid-cols-[1fr_1.45fr]">
            <label className="block">
              <span className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wide text-[#f5f4ee]/50">E-mail</span>
              <div className={`flex items-center rounded-lg border bg-[#262624] transition-colors focus-within:border-[#d97757] ${
                email && !emailOk && emailTouche ? 'border-[#d97757]/70' : emailOk ? 'border-[#7fb98a]/50' : 'border-white/10'}`}>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} onBlur={() => setEmailTouche(true)}
                  placeholder="vous@exemple.com"
                  className="w-full min-w-0 bg-transparent px-3 py-2.5 text-sm text-[#f5f4ee] outline-none placeholder:text-[#f5f4ee]/50" />
                {emailOk && <Check className="mr-2.5 h-4 w-4 shrink-0 text-[#7fb98a]" />}
              </div>
              <p className="mt-1 min-h-[16px] text-[11px] text-[#e8a184]" aria-live="polite">
                {email && !emailOk && emailTouche ? 'Cette adresse semble incomplète (ex : vous@exemple.com).' : ''}
              </p>
            </label>
            <PhoneCountryField label="WhatsApp" onChange={(e164, meta) => { setWhatsapp(e164); setWaOk(meta.ok); }} />
          </div>

          <div>
            <span className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide text-[#f5f4ee]/50">
              <Calendar className="h-3.5 w-3.5" /> Choisissez un créneau
            </span>
            {loadingSlots ? (
              <div aria-label="Chargement des disponibilités">
                <div className="flex gap-2 overflow-hidden pb-1">
                  {[0, 1, 2, 3, 4].map((i) => <span key={i} className="h-8 w-24 shrink-0 animate-pulse rounded-lg bg-white/5" />)}
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => <span key={i} className="h-9 animate-pulse rounded-lg bg-white/5" />)}
                </div>
              </div>
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

          {chosenLabel && (
            <div className="flex items-center justify-between gap-2 rounded-lg border border-[#d97757]/40 bg-[#d97757]/10 px-3 py-2">
              <span className="text-[13px] font-semibold text-[#e8a184]">Créneau choisi : <span className="capitalize">{chosenLabel}</span></span>
              <button type="button" onClick={() => setChosenIso(null)} aria-label="Retirer ce créneau"
                className="rounded p-1 text-[#f5f4ee]/55 transition-colors hover:text-[#f5f4ee]">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {error && <p role="alert" className="rounded-lg bg-red-500/10 px-3 py-2 text-[13px] text-red-300">{error}</p>}
          {!error && !canSubmit && (
            <p className="text-[12px] text-[#f5f4ee]/50" aria-live="polite">
              Pour envoyer, il reste : {manque.join(' · ')}.
            </p>
          )}

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
