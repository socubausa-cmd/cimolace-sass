import React, { useCallback, useEffect, useState } from 'react';
import { LiriPortalShell } from '@/components/liri/LiriPortalShell';
import { bookingApi } from '@/lib/api-v2';
import { Settings2, Loader2, Plus, Trash2, Save, Clock, Sparkles, CalendarDays, CalendarOff, ArrowLeft } from 'lucide-react';

// Jours ordonnés Lun→Dim (dow JS : 0=dim..6=sam).
const DAYS = [
  { dow: 1, label: 'Lundi' }, { dow: 2, label: 'Mardi' }, { dow: 3, label: 'Mercredi' },
  { dow: 4, label: 'Jeudi' }, { dow: 5, label: 'Vendredi' }, { dow: 6, label: 'Samedi' }, { dow: 0, label: 'Dimanche' },
];
const SERVICE_KINDS = [
  { key: 'priere', label: 'Prière' }, { key: 'teleconsult', label: 'Téléconsultation' },
  { key: 'formation', label: 'Formation / Coaching' }, { key: 'consultation', label: 'Consultation' },
];
const ACTIVITY_KINDS = [
  { key: 'busy', label: 'Occupé' }, { key: 'masterclass', label: 'Masterclass' },
  { key: 'live', label: 'Live' }, { key: 'enseignement', label: 'Enseignement' }, { key: 'repos', label: 'Repos' },
];
const min2t = (m) => `${String(Math.floor((Number(m) || 0) / 60)).padStart(2, '0')}:${String((Number(m) || 0) % 60).padStart(2, '0')}`;
const t2min = (t) => { const [h, m] = String(t || '0:0').split(':').map(Number); return (h || 0) * 60 + (m || 0); };

const INPUT = 'rounded-lg border border-white/10 bg-[#262624] px-2.5 py-2 text-sm text-[#f5f4ee] outline-none focus:border-[#d97757] [color-scheme:dark]';
const BTN_GHOST = 'inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-[13px] font-semibold text-[#f5f4ee]/75 transition-colors hover:border-[#d97757]/40 hover:text-[#f5f4ee]';

export default function LiriAgendaReglagesPage() {
  return (
    <LiriPortalShell active="calendrier">
      <ReglagesBody />
    </LiriPortalShell>
  );
}

function Card({ icon: Icon, title, sub, children }) {
  return (
    <section className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
      <div className="mb-4 flex items-center gap-2.5">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#d97757]/15 text-[#e8a184]"><Icon className="h-4.5 w-4.5" /></span>
        <div><h2 className="text-[15px] font-bold text-[#f5f4ee]">{title}</h2>{sub && <p className="text-[12px] text-[#f5f4ee]/50">{sub}</p>}</div>
      </div>
      {children}
    </section>
  );
}

function ReglagesBody() {
  const [avail, setAvail] = useState({ timezone: 'Africa/Libreville', slotMinutes: 30, bufferMinutes: 30, weekly: {}, blackoutDates: [] });
  const [services, setServices] = useState([]);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setErr('');
    try {
      const s = await bookingApi.getSettings();
      setAvail({ timezone: 'Africa/Libreville', slotMinutes: 30, bufferMinutes: 30, weekly: {}, blackoutDates: [], ...(s?.availability || {}) });
      setServices(Array.isArray(s?.services) ? s.services : []);
      setActivities(Array.isArray(s?.activities) ? s.activities : []);
    } catch (e) { setErr(e?.response?.data?.error?.message || 'Impossible de charger les réglages.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setSaving(true); setErr(''); setMsg('');
    try {
      const s = await bookingApi.updateSettings({ availability: avail, services, activities });
      setAvail({ timezone: 'Africa/Libreville', slotMinutes: 30, bufferMinutes: 30, weekly: {}, blackoutDates: [], ...(s?.availability || {}) });
      setServices(Array.isArray(s?.services) ? s.services : []);
      setActivities(Array.isArray(s?.activities) ? s.activities : []);
      setMsg('Réglages enregistrés ✓ Ils s\'appliquent immédiatement à la réservation et au calendrier.');
    } catch (e) { setErr(e?.response?.data?.error?.message || 'Enregistrement impossible.'); }
    finally { setSaving(false); }
  };

  // Disponibilités
  const winOf = (dow) => avail.weekly?.[String(dow)] || [];
  const setWeekly = (dow, wins) => setAvail((a) => ({ ...a, weekly: { ...a.weekly, [String(dow)]: wins } }));
  const addWin = (dow) => setWeekly(dow, [...winOf(dow), [600, 660]]);
  const updWin = (dow, i, idx, t) => setWeekly(dow, winOf(dow).map((w, j) => (j === i ? (idx === 0 ? [t2min(t), w[1]] : [w[0], t2min(t)]) : w)));
  const rmWin = (dow, i) => setWeekly(dow, winOf(dow).filter((_, j) => j !== i));

  // Services
  const updSvc = (i, patch) => setServices((arr) => arr.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const addSvc = () => setServices((arr) => [...arr, { key: '', label: '', kind: 'consultation', durationMin: 30, desc: '' }]);
  const rmSvc = (i) => setServices((arr) => arr.filter((_, j) => j !== i));

  // Activités
  const updAct = (i, patch) => setActivities((arr) => arr.map((a, j) => (j === i ? { ...a, ...patch } : a)));
  const addAct = () => setActivities((arr) => [...arr, { kind: 'busy', label: '', dow: 1, start: '08:00', end: '20:00' }]);
  const rmAct = (i) => setActivities((arr) => arr.filter((_, j) => j !== i));

  if (loading) {
    return <div className="flex h-full items-center justify-center gap-2 text-[#f5f4ee]/50"><Loader2 className="h-5 w-5 animate-spin" /> Chargement…</div>;
  }

  return (
    <div className="h-full min-h-0 overflow-y-auto px-4 py-5 md:px-7">
      <div className="mx-auto w-full max-w-3xl space-y-5 pb-24">
        {/* En-tête */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <a href="/liri/calendrier" className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 text-[#f5f4ee]/60 hover:text-[#f5f4ee]" title="Retour au calendrier"><ArrowLeft className="h-4 w-4" /></a>
            <div>
              <h1 className="text-xl font-bold text-[#f5f4ee]">Réglages de l'agenda</h1>
              <p className="text-[12.5px] text-[#f5f4ee]/50">Tes horaires, services et activités — modifiables sans code.</p>
            </div>
          </div>
        </div>

        {err && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-[13px] text-red-300">{err}</p>}
        {msg && <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-[13px] text-emerald-300">{msg}</p>}

        {/* Disponibilités */}
        <Card icon={Clock} title="Disponibilités" sub="Les jours et heures où l'on peut réserver un rendez-vous.">
          <div className="mb-4 flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-[13px] text-[#f5f4ee]/70">Durée d'un RDV (min)
              <input type="number" min="10" max="240" value={avail.slotMinutes} onChange={(e) => setAvail((a) => ({ ...a, slotMinutes: Number(e.target.value) }))} className={`${INPUT} w-20`} /></label>
            <label className="flex items-center gap-2 text-[13px] text-[#f5f4ee]/70">Battement entre RDV (min)
              <input type="number" min="0" max="240" value={avail.bufferMinutes} onChange={(e) => setAvail((a) => ({ ...a, bufferMinutes: Number(e.target.value) }))} className={`${INPUT} w-20`} /></label>
          </div>
          <div className="space-y-2.5">
            {DAYS.map(({ dow, label }) => {
              const wins = winOf(dow);
              return (
                <div key={dow} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                  <div className="flex items-center justify-between">
                    <span className={`text-[13.5px] font-semibold ${wins.length ? 'text-[#f5f4ee]' : 'text-[#f5f4ee]/40'}`}>{label}{!wins.length && ' · fermé'}</span>
                    <button type="button" onClick={() => addWin(dow)} className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#e8a184] hover:underline"><Plus className="h-3.5 w-3.5" /> créneau</button>
                  </div>
                  {wins.map((w, i) => (
                    <div key={i} className="mt-2 flex items-center gap-2">
                      <input type="time" value={min2t(w[0])} onChange={(e) => updWin(dow, i, 0, e.target.value)} className={INPUT} />
                      <span className="text-[#f5f4ee]/40">→</span>
                      <input type="time" value={min2t(w[1])} onChange={(e) => updWin(dow, i, 1, e.target.value)} className={INPUT} />
                      <button type="button" onClick={() => rmWin(dow, i)} className="grid h-8 w-8 place-items-center rounded-lg text-[#f5f4ee]/40 hover:text-red-300"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
          {/* Jours fermés (blackout) */}
          <div className="mt-4 border-t border-white/[0.06] pt-3">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-[13px] font-semibold text-[#f5f4ee]/70"><CalendarOff className="h-3.5 w-3.5" /> Jours fermés exceptionnels</span>
              <button type="button" onClick={() => setAvail((a) => ({ ...a, blackoutDates: [...(a.blackoutDates || []), ''] }))} className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#e8a184] hover:underline"><Plus className="h-3.5 w-3.5" /> date</button>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {(avail.blackoutDates || []).map((d, i) => (
                <div key={i} className="flex items-center gap-1">
                  <input type="date" value={d} onChange={(e) => setAvail((a) => ({ ...a, blackoutDates: a.blackoutDates.map((x, j) => (j === i ? e.target.value : x)) }))} className={INPUT} />
                  <button type="button" onClick={() => setAvail((a) => ({ ...a, blackoutDates: a.blackoutDates.filter((_, j) => j !== i) }))} className="grid h-8 w-8 place-items-center rounded-lg text-[#f5f4ee]/40 hover:text-red-300"><Trash2 className="h-4 w-4" /></button>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* Services */}
        <Card icon={Sparkles} title="Services réservables" sub="Les types de séance proposés sur la page de réservation.">
          <div className="space-y-2.5">
            {services.map((s, i) => (
              <div key={i} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <input value={s.label} onChange={(e) => updSvc(i, { label: e.target.value })} placeholder="Nom du service" className={`${INPUT} min-w-[150px] flex-1`} />
                  <select value={s.kind} onChange={(e) => updSvc(i, { kind: e.target.value })} className={INPUT}>
                    {SERVICE_KINDS.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}
                  </select>
                  <input type="number" min="10" max="240" value={s.durationMin} onChange={(e) => updSvc(i, { durationMin: Number(e.target.value) })} className={`${INPUT} w-20`} title="Durée (min)" />
                  <button type="button" onClick={() => rmSvc(i)} className="grid h-8 w-8 place-items-center rounded-lg text-[#f5f4ee]/40 hover:text-red-300"><Trash2 className="h-4 w-4" /></button>
                </div>
                <input value={s.desc || ''} onChange={(e) => updSvc(i, { desc: e.target.value })} placeholder="Petite description (optionnel)" className={`${INPUT} mt-2 w-full`} />
              </div>
            ))}
          </div>
          <button type="button" onClick={addSvc} className={`${BTN_GHOST} mt-3`}><Plus className="h-4 w-4" /> Ajouter un service</button>
        </Card>

        {/* Activités fixes */}
        <Card icon={CalendarDays} title="Activités fixes récurrentes" sub="Masterclass, live, enseignement, repos, occupé — affichés dans le calendrier maître.">
          <div className="space-y-2.5">
            {activities.map((a, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                <input value={a.label} onChange={(e) => updAct(i, { label: e.target.value })} placeholder="Intitulé" className={`${INPUT} min-w-[130px] flex-1`} />
                <select value={a.kind} onChange={(e) => updAct(i, { kind: e.target.value })} className={INPUT}>
                  {ACTIVITY_KINDS.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}
                </select>
                <select value={a.dow} onChange={(e) => updAct(i, { dow: Number(e.target.value) })} className={INPUT}>
                  {DAYS.map((d) => <option key={d.dow} value={d.dow}>{d.label}</option>)}
                </select>
                <input type="time" value={a.start} onChange={(e) => updAct(i, { start: e.target.value })} className={INPUT} />
                <span className="text-[#f5f4ee]/40">→</span>
                <input type="time" value={a.end} onChange={(e) => updAct(i, { end: e.target.value })} className={INPUT} />
                <button type="button" onClick={() => rmAct(i)} className="grid h-8 w-8 place-items-center rounded-lg text-[#f5f4ee]/40 hover:text-red-300"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
          </div>
          <button type="button" onClick={addAct} className={`${BTN_GHOST} mt-3`}><Plus className="h-4 w-4" /> Ajouter une activité</button>
        </Card>
      </div>

      {/* Barre d'enregistrement */}
      <div className="sticky bottom-0 -mx-4 mt-4 border-t border-white/10 bg-[#262624]/95 px-4 py-3 backdrop-blur md:-mx-7 md:px-7">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-end gap-3">
          {msg && <span className="text-[12.5px] text-emerald-300">{msg}</span>}
          <button type="button" disabled={saving} onClick={save}
            className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-xl bg-[#d97757] px-6 text-[14px] font-bold text-[#1c1a18] hover:bg-[#e08b6d] disabled:opacity-60">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}
