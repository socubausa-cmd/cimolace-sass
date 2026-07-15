/**
 * LiriRendezVousPage — Prise de rendez-vous conversationnelle + SÉLECTION DE CRÉNEAU (type Calendly),
 * PAGINÉE, dans LIRI.
 *
 * UX : l'assistant pose les questions UNE PAR ÉCRAN, PUIS propose de CHOISIR UN CRÉNEAU réel (grille
 * de disponibilités calculée par le moteur intelligent — heures d'ouverture / secrétaire dispo /
 * fuseau du visiteur), puis récapitule et valide. Le créneau choisi est matérialisé côté serveur
 * (booking_slot réservé + RDV rattaché). S'il n'y a aucun créneau, repli propre = demande sans
 * créneau (le secrétariat proposera un horaire) — le tunnel ne tombe jamais dans le vide.
 *
 * Couleurs = politique LIRI stricte : base #262624, coral réservé aux ACTIONS / à l'étape courante /
 * à la progression. Aucun navy, violet, or.
 *
 * Persistance : POST /booking/appointment-request (API NestJS, insert service-role) avec, si choisi,
 * `preferredIso` → le serveur crée le booking_slot + le RDV. Disponibilités : GET /booking/slots/availability.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Sparkles, Check, ArrowRight, ArrowLeft, ShieldCheck, RefreshCw, CalendarClock, Lock, Pencil, Clock, CalendarDays } from 'lucide-react';
import LiriSchoolShell from '@/pages/liri/LiriSchoolShell';
import { useAuth } from '@/hooks/useAuth';
import { api, bookingApi } from '@/lib/api';

const C = {
  ink: '#f5f1e9', muted: 'rgba(245,241,233,0.64)', faint: 'rgba(245,241,233,0.42)',
  coral: '#e08a5f', coralDeep: '#d97757',
  surface: 'rgba(255,255,255,0.04)', line: 'rgba(255,255,255,0.08)',
  userLine: 'rgba(224,138,95,0.34)',
};

const STEPS = [
  { key: 'subject', short: 'Sujet', title: 'Quel est le sujet de ton entretien ?', hint: 'En quelques mots, ce dont tu veux parler.', placeholder: 'Ex : inscription, question sur un cours…', kind: 'text',
    validate: (v) => v.trim().length >= 3 || "Donne un sujet un peu plus précis (au moins 3 caractères)." },
  { key: 'description', short: 'Détails', optional: true, title: 'Tu veux préciser quelque chose ?', hint: 'Contexte, questions, degré d’urgence… (facultatif)', placeholder: 'Quelques précisions utiles…', kind: 'textarea',
    validate: () => true },
  { key: 'email', short: 'E-mail', title: 'À quelle adresse e-mail te confirmer ?', hint: 'Tu recevras la confirmation ici.', placeholder: 'toi@exemple.com', kind: 'email',
    validate: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) || "Cette adresse ne semble pas valide." },
  { key: 'whatsapp', short: 'WhatsApp', title: 'Ton numéro WhatsApp ?', hint: 'Format international (ex : +241…), pour te joindre facilement.', placeholder: '+241 00 00 00 00', kind: 'tel',
    validate: (v) => v.replace(/\D/g, '').length >= 8 || "Numéro trop court — indique un numéro complet." },
];

const SLOT_STEP = STEPS.length;      // 4 — choisir un créneau
const RECAP_STEP = STEPS.length + 1; // 5 — récap + valider
const DONE_STEP = STEPS.length + 2;  // 6 — confirmation

const TZ = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return 'Europe/Paris'; } })();
const fmtDay = (iso) => { try { return new Date(iso).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }); } catch { return ''; } };
const fmtTime = (iso) => { try { return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }); } catch { return ''; } };

// Regroupe des créneaux ISO par JOUR (fuseau visiteur), cap 8 jours / 16 créneaux.
function groupSlots(items) {
  const byDay = new Map();
  for (const it of items) {
    const d = new Date(it.iso); if (Number.isNaN(d.getTime())) continue;
    const day = new Date(d); day.setHours(0, 0, 0, 0); const key = day.toISOString();
    if (!byDay.has(key)) byDay.set(key, []);
    const list = byDay.get(key); if (list.length < 16) list.push({ iso: it.iso, time: fmtTime(it.iso), recommended: !!it.recommended });
  }
  return [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(0, 8)
    .map(([dayIso, times]) => ({ dayIso, day: fmtDay(times[0].iso), times }));
}

// Grille générique d'horaires d'ouverture (lun-sam 9h→18h, pas de 30 min, dès demain). Sert de
// SOURCE fiable tant qu'aucun secrétaire n'est configuré (le moteur intelligent renvoie alors 0).
function generateGenericSlots() {
  const items = []; const now = new Date();
  for (let off = 1; off <= 16; off++) {
    const day = new Date(now); day.setDate(now.getDate() + off); day.setHours(0, 0, 0, 0);
    if (day.getDay() === 0) continue; // pas le dimanche
    for (let hh = 9; hh < 18; hh += 1) for (const mm of [0, 30]) {
      const s = new Date(day); s.setHours(hh, mm, 0, 0);
      items.push({ iso: s.toISOString(), recommended: hh >= 14 && hh < 17 });
    }
  }
  return groupSlots(items);
}

export default function LiriRendezVousPage() {
  const { user } = useAuth();

  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({ subject: '', description: '', email: '', whatsapp: '' });
  const [input, setInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef(null);

  // Créneaux
  const [days, setDays] = useState([]);          // [{ day, dayIso, times:[{iso,time,recommended}] }]
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState('');
  const [activeDay, setActiveDay] = useState(0);
  const [chosenIso, setChosenIso] = useState(null);
  const [secretary, setSecretary] = useState(null); // { name, region } — interlocuteur suggéré

  const cur = STEPS[step] || null;
  const progress = Math.min(step, STEPS.length) / STEPS.length;

  useEffect(() => { if (user?.email) setAnswers((a) => (a.email ? a : { ...a, email: user.email })); }, [user?.email]);

  useEffect(() => {
    if (step > 3) return;
    setErrorMsg('');
    setInput(answers[STEPS[step].key] || (STEPS[step].key === 'email' ? (user?.email || '') : ''));
    const t = setTimeout(() => inputRef.current?.focus(), 60);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // Charge les créneaux disponibles (grille intelligente) à l'entrée de l'étape créneau.
  const loadSlots = useCallback(async () => {
    setSlotsLoading(true); setSlotsError(''); setChosenIso(null);
    try {
      // 1. Moteur INTELLIGENT (créneaux réels selon secrétaires configurés + prime-hour).
      let grouped = [];
      try {
        const now = new Date();
        const end = new Date(now.getTime() + 14 * 24 * 3600 * 1000);
        const res = await bookingApi.slotAvailability({ timezone: TZ, windowStart: now.toISOString(), windowEnd: end.toISOString() });
        const grid = Array.isArray(res?.slotGrid) ? res.slotGrid : [];
        const reco = new Set((Array.isArray(res?.slots) ? res.slots : []).filter((s) => s?.isPrimeHour).map((s) => s.slotUtc));
        const available = grid.filter((c) => c?.state === 'available' && c?.slotUtc).map((c) => ({ iso: c.slotUtc, recommended: reco.has(c.slotUtc) }));
        grouped = groupSlots(available);
      } catch { /* moteur indispo */ }
      // 2. REPLI : grille d'horaires d'ouverture générique (toujours des créneaux à choisir tant
      //    qu'aucun secrétaire n'est configuré → le moteur renvoie 0). L'élève choisit un horaire,
      //    le créneau est matérialisé serveur, le secrétariat confirme.
      if (grouped.length === 0) grouped = generateGenericSlots();
      setDays(grouped);
      setActiveDay(0);
      // Interlocuteur suggéré (matching secrétaire) — best-effort, bandeau informatif.
      try {
        const sec = await bookingApi.availableSecretaries({ timezone: TZ });
        const first = Array.isArray(sec?.secretaries) ? sec.secretaries[0] : null;
        if (first?.name) setSecretary({ name: first.name, region: first.region || null, online: !!first.isOnline });
      } catch { /* non bloquant */ }
    } catch (e) {
      setDays(generateGenericSlots());
    } finally {
      setSlotsLoading(false);
    }
  }, []);

  useEffect(() => { if (step === SLOT_STEP) loadSlots(); }, [step, loadSlots]);

  const goNext = () => {
    const s = STEPS[step];
    const value = input.trim();
    if (!value && !s.optional) { setErrorMsg('Cette réponse est requise.'); return; }
    if (value) { const ok = s.validate(value); if (ok !== true) { setErrorMsg(ok); return; } }
    setAnswers((a) => ({ ...a, [s.key]: value }));
    setStep(step + 1);
  };
  const goBack = () => { if (step > 0) setStep(step - 1); };

  const submit = async () => {
    setSubmitting(true); setErrorMsg('');
    try {
      const resp = await api.post('/booking/appointment-request', {
        subject: answers.subject, description: answers.description, email: answers.email, whatsapp: answers.whatsapp,
        preferredIso: chosenIso || undefined,
      });
      const body = resp?.data;
      if (!(body?.data?.ok || body?.ok)) throw new Error('submit_failed');
      setStep(DONE_STEP);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[rdv] submit échec:', e?.message);
      setErrorMsg("Ta demande n'a pas pu être transmise pour le moment.");
    } finally { setSubmitting(false); }
  };

  const restart = () => { setAnswers({ subject: '', description: '', email: user?.email || '', whatsapp: '' }); setChosenIso(null); setDays([]); setErrorMsg(''); setStep(0); };

  const btnPrimary = { display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 22px', borderRadius: 12, border: 'none', cursor: 'pointer', background: `linear-gradient(180deg, ${C.coral}, ${C.coralDeep})`, color: '#1c140e', fontSize: 14, fontWeight: 800 };
  const btnGhost = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '11px 16px', borderRadius: 12, background: 'transparent', border: `1px solid ${C.line}`, cursor: 'pointer', color: C.muted, fontSize: 13.5, fontWeight: 600 };

  return (
    <LiriSchoolShell active="agenda">
      <div style={{ height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column', background: 'var(--base, #262624)', position: 'relative' }}>
        <style>{`
          @keyframes rdvIn { from { opacity: 0; transform: translateY(12px) } to { opacity: 1; transform: none } }
          @keyframes rdvSpin { to { transform: rotate(360deg) } }
          .rdv-spin { animation: rdvSpin .8s linear infinite; }
          .rdv-screen { animation: rdvIn .42s cubic-bezier(.22,1,.36,1) both; }
          .rdv-field::placeholder { color: rgba(245,241,233,0.34) }
          .rdv-slot:hover { border-color: ${C.userLine} !important; }
        `}</style>
        <div aria-hidden style={{ position: 'absolute', top: -70, left: '50%', width: 620, height: 300, transform: 'translateX(-50%)', borderRadius: '50%', background: 'radial-gradient(closest-side, rgba(217,119,87,0.10), transparent 72%)', filter: 'blur(60px)', pointerEvents: 'none' }} />

        {/* En-tête + progression */}
        <header style={{ position: 'relative', zIndex: 1, padding: '20px 22px 14px', borderBottom: `1px solid ${C.line}` }}>
          <div style={{ maxWidth: 660, margin: '0 auto', width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
              <span style={{ display: 'grid', placeItems: 'center', width: 34, height: 34, borderRadius: 11, background: 'rgba(224,138,95,0.16)', border: `1px solid ${C.userLine}` }}><Sparkles size={16} color={C.coral} /></span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: C.coral }}>Assistant rendez-vous</div>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: C.ink }}>{step >= SLOT_STEP ? 'Choisis ton créneau' : 'Une question à la fois'}</div>
              </div>
              <span style={{ fontSize: 11, fontFamily: "'JetBrains Mono',monospace", color: C.faint }}>{Math.min(step, STEPS.length)} / {STEPS.length}</span>
            </div>
            <div style={{ marginTop: 13, height: 4, borderRadius: 4, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${(step >= SLOT_STEP ? 1 : progress) * 100}%`, borderRadius: 4, background: `linear-gradient(90deg, ${C.coralDeep}, ${C.coral})`, transition: 'width .5s cubic-bezier(.22,1,.36,1)' }} />
            </div>
          </div>
        </header>

        {/* Corps : UN écran à la fois */}
        <div style={{ position: 'relative', zIndex: 1, flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '24px 22px' }}>
          <div style={{ maxWidth: 660, margin: '0 auto', width: '100%' }}>

            {/* Questions (0..3) */}
            {step <= 3 && cur && (
              <div key={step} className="rdv-screen">
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                  <span style={{ display: 'grid', placeItems: 'center', width: 26, height: 26, borderRadius: 8, background: 'rgba(224,138,95,0.14)', border: '1px solid rgba(224,138,95,0.3)' }}><Sparkles size={13} color={C.coral} /></span>
                  <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', color: C.faint }}>Étape {step + 1} sur {STEPS.length}</span>
                </div>
                <h2 style={{ fontSize: 25, fontWeight: 800, color: C.ink, lineHeight: 1.2, letterSpacing: '-0.01em', textWrap: 'balance', margin: 0 }}>{cur.title}</h2>
                {cur.hint && <p style={{ fontSize: 14, color: C.muted, marginTop: 8 }}>{cur.hint}</p>}

                <div style={{ marginTop: 20, background: C.surface, border: `1px solid ${errorMsg ? C.userLine : C.line}`, borderRadius: 14, padding: cur.kind === 'textarea' ? '10px 14px' : '4px 14px' }}>
                  {cur.kind === 'textarea' ? (
                    <textarea ref={inputRef} className="rdv-field" value={input} onChange={(e) => { setInput(e.target.value); if (errorMsg) setErrorMsg(''); }} placeholder={cur.placeholder}
                      onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); goNext(); } }} rows={3}
                      style={{ width: '100%', resize: 'none', background: 'transparent', border: 'none', outline: 'none', color: C.ink, fontSize: 15.5, lineHeight: 1.55 }} />
                  ) : (
                    <input ref={inputRef} className="rdv-field" value={input} onChange={(e) => { setInput(e.target.value); if (errorMsg) setErrorMsg(''); }} placeholder={cur.placeholder}
                      type={cur.kind === 'email' ? 'email' : cur.kind === 'tel' ? 'tel' : 'text'} inputMode={cur.kind === 'tel' ? 'tel' : undefined}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); goNext(); } }}
                      style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', color: C.ink, fontSize: 16, padding: '12px 0' }} />
                  )}
                </div>
                {errorMsg && <p style={{ marginTop: 8, fontSize: 12.5, color: C.coral }}>{errorMsg}</p>}

                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 22 }}>
                  {step > 0 && <button onClick={goBack} style={btnGhost}><ArrowLeft size={15} /> Retour</button>}
                  <button onClick={goNext} style={btnPrimary}>{step === 3 ? 'Choisir un créneau' : 'Continuer'} <ArrowRight size={16} /></button>
                  {cur.optional && <button onClick={() => { setInput(''); setStep(step + 1); }} style={{ marginLeft: 'auto', background: 'transparent', border: 'none', cursor: 'pointer', color: C.muted, fontSize: 12.5, fontWeight: 600 }}>Passer →</button>}
                </div>
                <p style={{ marginTop: 20, display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10.5, color: C.faint }}><Lock size={11} /> Traité par le secrétariat de ton école</p>
              </div>
            )}

            {/* Choisir un créneau (4) */}
            {step === SLOT_STEP && (
              <div key="slot" className="rdv-screen">
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                  <span style={{ display: 'grid', placeItems: 'center', width: 26, height: 26, borderRadius: 8, background: 'rgba(224,138,95,0.14)', border: '1px solid rgba(224,138,95,0.3)' }}><CalendarDays size={13} color={C.coral} /></span>
                  <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', color: C.faint }}>Choisis ta date et ton horaire</span>
                </div>
                <h2 style={{ fontSize: 24, fontWeight: 800, color: C.ink, lineHeight: 1.2, margin: 0 }}>Quand veux-tu ton rendez-vous ?</h2>
                {secretary && (
                  <p style={{ fontSize: 13, color: C.muted, marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: secretary.online ? '#7fb98a' : C.faint }} />
                    Ton interlocuteur : <strong style={{ color: C.ink }}>{secretary.name}</strong>{secretary.region ? ` · ${secretary.region}` : ''}{secretary.online ? ' · en ligne' : ''}
                  </p>
                )}

                {slotsLoading && (
                  <div style={{ marginTop: 26, display: 'flex', alignItems: 'center', gap: 10, color: C.muted, fontSize: 14 }}>
                    <RefreshCw size={16} className="rdv-spin" color={C.coral} /> Recherche des créneaux disponibles…
                  </div>
                )}

                {!slotsLoading && days.length > 0 && (
                  <>
                    {/* Onglets jours */}
                    <div style={{ marginTop: 18, display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
                      {days.map((d, i) => (
                        <button key={d.dayIso} onClick={() => setActiveDay(i)} style={{
                          flexShrink: 0, padding: '9px 14px', borderRadius: 11, cursor: 'pointer', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap',
                          background: i === activeDay ? 'rgba(224,138,95,0.16)' : C.surface,
                          border: `1px solid ${i === activeDay ? C.userLine : C.line}`, color: i === activeDay ? C.coral : C.muted,
                        }}>{d.day}</button>
                      ))}
                    </div>
                    {/* Créneaux du jour actif */}
                    <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(104px, 1fr))', gap: 10 }}>
                      {(days[activeDay]?.times || []).map((t) => {
                        const active = chosenIso === t.iso;
                        return (
                          <button key={t.iso} className="rdv-slot" onClick={() => setChosenIso(t.iso)} style={{
                            position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '13px 8px', borderRadius: 12, cursor: 'pointer',
                            fontSize: 15, fontWeight: 700, transition: 'all .15s',
                            background: active ? `linear-gradient(180deg, ${C.coral}, ${C.coralDeep})` : C.surface,
                            border: `1px solid ${active ? 'transparent' : C.line}`, color: active ? '#1c140e' : C.ink,
                          }}>
                            <Clock size={13} style={{ opacity: 0.7 }} /> {t.time}
                            {t.recommended && !active && <span style={{ position: 'absolute', top: -7, right: -6, fontSize: 8.5, fontWeight: 800, background: C.coral, color: '#1c140e', padding: '2px 5px', borderRadius: 6 }}>Reco</span>}
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}

                {/* Aucun créneau → repli sans créneau */}
                {!slotsLoading && days.length === 0 && (
                  <div style={{ marginTop: 20, background: C.surface, border: `1px solid ${C.line}`, borderRadius: 14, padding: '16px 18px' }}>
                    <p style={{ margin: 0, fontSize: 14, color: C.ink, fontWeight: 600 }}>Aucun créneau proposé pour l’instant.</p>
                    <p style={{ margin: '6px 0 0', fontSize: 13, color: C.muted, lineHeight: 1.5 }}>Pas de souci : envoie ta demande, et <strong>le secrétariat te proposera un horaire</strong> par e-mail et WhatsApp.</p>
                    <button onClick={loadSlots} style={{ marginTop: 12, ...btnGhost, padding: '8px 12px', fontSize: 12.5 }}><RefreshCw size={13} /> Réessayer</button>
                  </div>
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 24 }}>
                  <button onClick={() => setStep(3)} style={btnGhost}><ArrowLeft size={15} /> Retour</button>
                  <button onClick={() => setStep(RECAP_STEP)} disabled={days.length > 0 && !chosenIso}
                    style={{ ...btnPrimary, opacity: (days.length > 0 && !chosenIso) ? 0.5 : 1, cursor: (days.length > 0 && !chosenIso) ? 'not-allowed' : 'pointer' }}>
                    {days.length === 0 ? 'Continuer sans créneau' : (chosenIso ? 'Continuer' : 'Choisis un horaire')} <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            )}

            {/* Récap (5) */}
            {step === RECAP_STEP && (
              <div key="recap" className="rdv-screen">
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                  <span style={{ display: 'grid', placeItems: 'center', width: 26, height: 26, borderRadius: 8, background: 'rgba(224,138,95,0.14)', border: '1px solid rgba(224,138,95,0.3)' }}><Sparkles size={13} color={C.coral} /></span>
                  <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', color: C.faint }}>Dernière étape</span>
                </div>
                <h2 style={{ fontSize: 25, fontWeight: 800, color: C.ink, lineHeight: 1.2, margin: 0 }}>On récapitule, puis on valide.</h2>

                {chosenIso && (
                  <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(224,138,95,0.10)', border: `1px solid ${C.userLine}`, borderRadius: 14, padding: '14px 16px' }}>
                    <CalendarClock size={22} color={C.coral} />
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: C.ink, textTransform: 'capitalize' }}>{fmtDay(chosenIso)}</div>
                      <div style={{ fontSize: 13, color: C.muted }}>à {fmtTime(chosenIso)}</div>
                    </div>
                    <button onClick={() => setStep(SLOT_STEP)} style={{ marginLeft: 'auto', ...btnGhost, padding: '7px 11px', fontSize: 12 }}><Pencil size={12} /> Changer</button>
                  </div>
                )}

                <div style={{ marginTop: 14, background: C.surface, border: `1px solid ${C.line}`, borderRadius: 16, overflow: 'hidden' }}>
                  {[['Sujet', answers.subject, 0], ['Détails', answers.description || '—', 1], ['E-mail', answers.email, 2], ['WhatsApp', answers.whatsapp, 3]].map(([k, v, idx], row) => (
                    <button key={k} onClick={() => setStep(idx)} style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', padding: '13px 16px', background: 'transparent', border: 'none', borderTop: row ? `1px solid ${C.line}` : 'none', cursor: 'pointer' }}>
                      <span style={{ width: 76, flexShrink: 0, fontSize: 12, color: C.faint }}>{k}</span>
                      <span style={{ flex: 1, fontSize: 13.5, color: C.ink, overflowWrap: 'anywhere' }}>{v}</span>
                      <Pencil size={13} color={C.faint} />
                    </button>
                  ))}
                </div>
                {errorMsg && <p style={{ marginTop: 10, fontSize: 12.5, color: C.coral }}>⚠︎ {errorMsg} Réessaie, ou contacte le secrétariat.</p>}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 20 }}>
                  <button onClick={() => setStep(SLOT_STEP)} disabled={submitting} style={btnGhost}><ArrowLeft size={15} /> Retour</button>
                  <button onClick={submit} disabled={submitting} style={{ ...btnPrimary, cursor: submitting ? 'wait' : 'pointer', opacity: submitting ? 0.7 : 1 }}>
                    {submitting ? <RefreshCw size={15} className="rdv-spin" /> : <ShieldCheck size={15} />} {submitting ? 'Envoi…' : (chosenIso ? 'Réserver ce créneau' : 'Valider ma demande')}
                  </button>
                </div>
              </div>
            )}

            {/* Confirmation (6) */}
            {step === DONE_STEP && (
              <div key="done" className="rdv-screen" style={{ textAlign: 'center', padding: '10px 0' }}>
                <span style={{ display: 'grid', placeItems: 'center', width: 60, height: 60, borderRadius: '50%', margin: '0 auto 16px', background: 'rgba(224,138,95,0.16)', border: `1px solid ${C.userLine}` }}><CalendarClock size={28} color={C.coral} /></span>
                <h2 style={{ fontSize: 23, fontWeight: 800, color: C.ink, margin: 0 }}>{chosenIso ? 'Créneau réservé ✅' : 'Demande transmise ✅'}</h2>
                <p style={{ fontSize: 14, color: C.muted, marginTop: 8, maxWidth: 460, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.55 }}>
                  {chosenIso
                    ? <>Ton rendez-vous du <strong style={{ color: C.ink, textTransform: 'capitalize' }}>{fmtDay(chosenIso)} à {fmtTime(chosenIso)}</strong> est enregistré. Le secrétariat confirme par e-mail et WhatsApp. Tu le retrouves dans « Agenda ».</>
                    : <>Le secrétariat te proposera un créneau et te confirmera par e-mail et WhatsApp. Tu la retrouveras dans « Agenda ».</>}
                </p>
                <button onClick={restart} style={{ marginTop: 18, padding: '11px 18px', borderRadius: 12, background: 'transparent', border: `1px solid ${C.line}`, cursor: 'pointer', color: C.muted, fontSize: 13, fontWeight: 600 }}>Nouvelle demande</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </LiriSchoolShell>
  );
}
