/**
 * AnnualProgramPage — Teacher / Admin
 * Génère et gère le programme scolaire annuel LIRI
 */
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CalendarDays, Sparkles, BookOpen, CheckCircle2,
  ChevronRight, Loader2, Globe, Settings2,
  GraduationCap, Layers, Play, AlertCircle,
  Clock, Award, RefreshCw, Eye, Download, Route,
} from 'lucide-react';
import { useAnnualProgram, CURRENT_SCHOOL_YEAR, schoolYearOptions } from '@/hooks/useAnnualProgram';
import { SCHOOL_HOLIDAY_COUNTRY_OPTIONS, holidaysForSchoolYearAndCountry } from '@/lib/schoolYearHolidays';
import { supabase } from '@/lib/customSupabaseClient';
import { listSchoolPaths, listPathCourses, listCourseModules } from '@/lib/schoolPathsApi';
import { syncAnnualProgramToPathModule } from '@/lib/annualProgramSchoolPathBridge';

// ── Design tokens ─────────────────────────────────────────────────────────────
const BG      = '#07090f';
const PANEL   = '#0e1320';
const BORDER  = '#1a2236';
const GOLD    = '#D4AF37';
const VIOLET  = '#7B61FF';
const GREEN   = '#34d399';
const CYAN    = '#38bdf8';
const RED     = '#f43f5e';

// ── Couleurs par type de session ─────────────────────────────────────────────
const SESSION_COLORS = {
  cours:      { bg: '#38bdf815', text: CYAN,   label: 'Cours' },
  live:       { bg: '#f43f5e15', text: RED,    label: 'Live'  },
  atelier:    { bg: '#34d39915', text: GREEN,  label: 'Atelier' },
  evaluation: { bg: '#D4AF3715', text: GOLD,   label: 'Évaluation' },
  revision:   { bg: '#a78bfa15', text: '#a78bfa', label: 'Révision' },
  conge:      { bg: '#64748b12', text: '#64748b', label: 'Congé' },
};

// ── Couleurs par cycle ────────────────────────────────────────────────────────
const CYCLE_CONFIG = {
  fondements:        { label: 'Fondements',       color: CYAN,   icon: '📗', sub: '1ère année — Les bases de la connaissance' },
  approfondissement: { label: 'Approfondissement', color: VIOLET, icon: '📘', sub: '2e année — Approfondissement doctrinal' },
  maitrise:          { label: 'Maîtrise',          color: GOLD,   icon: '📙', sub: '3e année — Maîtrise et transmission' },
};

// ── Petit composant badge statut ──────────────────────────────────────────────
function StatusBadge({ status }) {
  const MAP = {
    draft:     { label: 'Brouillon', color: '#64748b' },
    published: { label: 'Publié',    color: GREEN },
    archived:  { label: 'Archivé',   color: '#475569' },
  };
  const s = MAP[status] ?? MAP.draft;
  return (
    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
      style={{ background: `${s.color}20`, color: s.color, border: `1px solid ${s.color}30` }}>
      {s.label}
    </span>
  );
}

// ── Card semaine ──────────────────────────────────────────────────────────────
function WeekCard({ week, isCurrent }) {
  const sc = SESSION_COLORS[week.session_type] ?? SESSION_COLORS.cours;
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl p-4 relative overflow-hidden"
      style={{
        background: isCurrent ? `${VIOLET}12` : PANEL,
        border: `1px solid ${isCurrent ? VIOLET + '40' : BORDER}`,
      }}
    >
      {isCurrent && (
        <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: VIOLET }} />
      )}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded"
            style={{ background: `${GOLD}15`, color: GOLD }}>S{week.week_number}</span>
          <span className="text-[10px] text-slate-500">
            {week.week_start} — {week.week_end}
          </span>
        </div>
        <span className="text-[9px] px-2 py-0.5 rounded-full font-medium shrink-0"
          style={{ background: sc.bg, color: sc.text }}>
          {sc.label}
        </span>
      </div>

      {week.is_holiday ? (
        <p className="text-slate-500 text-xs italic">{week.holiday_name ?? 'Congé'}</p>
      ) : (
        <>
          {week.module_number && (
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-[9px] font-bold text-slate-600">MODULE {week.module_number}</span>
            </div>
          )}
          <p className="text-white font-semibold text-xs leading-tight mb-1 line-clamp-1">
            {week.theme ?? week.module_title ?? '—'}
          </p>
          {week.pedagogical_objective && (
            <p className="text-slate-500 text-[10px] leading-relaxed line-clamp-2">
              {week.pedagogical_objective}
            </p>
          )}
          {week.liri_segments?.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {week.liri_segments.slice(0, 3).map(seg => (
                <span key={seg} className="text-[8px] px-1.5 py-0.5 rounded"
                  style={{ background: `${CYAN}10`, color: CYAN }}>
                  {seg}
                </span>
              ))}
            </div>
          )}
        </>
      )}
    </motion.div>
  );
}

// ── Panel config génération ───────────────────────────────────────────────────
function GeneratePanel({ onGenerate, generating, cycle, setCycle, schoolYear, setSchoolYear }) {
  const [sessionsPerWeek,  setSessionsPerWeek]  = useState(2);
  const [pedagogicalNotes, setPedagogicalNotes] = useState('');
  const [holidayCountry,   setHolidayCountry]   = useState('FR');
  const [holidayBreaks,    setHolidayBreaks]    = useState(() =>
    holidaysForSchoolYearAndCountry(schoolYear, 'FR'),
  );

  useEffect(() => {
    setHolidayBreaks(holidaysForSchoolYearAndCountry(schoolYear, holidayCountry));
  }, [schoolYear, holidayCountry]);

  const applyCountryPreset = () => {
    setHolidayBreaks(holidaysForSchoolYearAndCountry(schoolYear, holidayCountry));
  };

  const normalizedHolidays = () =>
    holidayBreaks
      .map((h) => ({
        name: String(h.name || '').trim(),
        start: String(h.start || '').trim(),
        end: String(h.end || '').trim(),
      }))
      .filter((h) => h.name && h.start && h.end);

  const updateBreak = (index, field, value) => {
    setHolidayBreaks((rows) => {
      const next = [...rows];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const addBreak = () => {
    setHolidayBreaks((rows) => [...rows, { name: 'Congé', start: '', end: '' }]);
  };

  const removeBreak = (index) => {
    setHolidayBreaks((rows) => rows.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: `${VIOLET}20`, border: `1px solid ${VIOLET}30` }}>
          <Sparkles size={16} color={VIOLET} />
        </div>
        <div>
          <h3 className="text-white font-bold">Générer le programme annuel</h3>
          <p className="text-slate-500 text-xs">L'IA planifie les 21 modules sur 10 mois</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Année scolaire */}
        <div>
          <label className="block text-[10px] uppercase tracking-widest text-slate-500 mb-1.5">
            Année scolaire
          </label>
          <select value={schoolYear} onChange={e => setSchoolYear(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl text-sm text-white outline-none"
            style={{ background: '#0a1020', border: `1px solid ${BORDER}` }}>
            {schoolYearOptions().map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>

        {/* Cycle */}
        <div>
          <label className="block text-[10px] uppercase tracking-widest text-slate-500 mb-1.5">
            Cycle
          </label>
          <select value={cycle} onChange={e => setCycle(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl text-sm text-white outline-none"
            style={{ background: '#0a1020', border: `1px solid ${BORDER}` }}>
            {Object.entries(CYCLE_CONFIG).map(([k, v]) => (
              <option key={k} value={k}>{v.icon} {v.label}</option>
            ))}
          </select>
        </div>

        {/* Séances/semaine */}
        <div>
          <label className="block text-[10px] uppercase tracking-widest text-slate-500 mb-1.5">
            Séances / semaine
          </label>
          <select value={sessionsPerWeek} onChange={e => setSessionsPerWeek(Number(e.target.value))}
            className="w-full px-3 py-2.5 rounded-xl text-sm text-white outline-none"
            style={{ background: '#0a1020', border: `1px solid ${BORDER}` }}>
            {[1,2,3].map(n => <option key={n} value={n}>{n} séance{n > 1 ? 's' : ''}/semaine</option>)}
          </select>
        </div>

        {/* Pays — modèle de vacances */}
        <div className="sm:col-span-2">
          <label className="block text-[10px] uppercase tracking-widest text-slate-500 mb-1.5">
            <span className="inline-flex items-center gap-1.5">
              <Globe size={11} className="opacity-60" />
              Pays / calendrier vacances (modèle)
            </span>
          </label>
          <div className="flex flex-col sm:flex-row gap-2 sm:items-stretch">
            <select value={holidayCountry} onChange={e => setHolidayCountry(e.target.value)}
              className="flex-1 px-3 py-2.5 rounded-xl text-sm text-white outline-none"
              style={{ background: '#0a1020', border: `1px solid ${BORDER}` }}>
              {SCHOOL_HOLIDAY_COUNTRY_OPTIONS.map((o) => (
                <option key={o.code} value={o.code}>{o.label}</option>
              ))}
            </select>
            <button type="button" onClick={applyCountryPreset}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap"
              style={{ background: `${CYAN}18`, color: CYAN, border: `1px solid ${CYAN}35` }}>
              Réappliquer le modèle
            </button>
          </div>
          <p className="text-[10px] text-slate-500 mt-1.5 leading-relaxed">
            {SCHOOL_HOLIDAY_COUNTRY_OPTIONS.find((o) => o.code === holidayCountry)?.hint ?? ''} Ajustez les dates ci-dessous si votre académie ou zone diffère.
          </p>
        </div>
      </div>

      {/* Vacances — édition */}
      <div className="rounded-xl p-4 space-y-3" style={{ background: '#080d18', border: `1px solid ${BORDER}` }}>
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] uppercase tracking-widest text-slate-500">Jours de vacances (congés)</p>
          <button type="button" onClick={addBreak}
            className="text-[10px] font-bold px-2 py-1 rounded-lg"
            style={{ background: `${VIOLET}15`, color: VIOLET }}>
            + Période
          </button>
        </div>
        <div className="space-y-2">
          {holidayBreaks.map((h, i) => (
            <div key={`${i}-${h.name}`} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_1fr_auto] gap-2 items-end">
              <div>
                <label className="block text-[9px] text-slate-600 mb-0.5">Libellé</label>
                <input type="text" value={h.name}
                  onChange={e => updateBreak(i, 'name', e.target.value)}
                  className="w-full px-2.5 py-2 rounded-lg text-xs text-white outline-none"
                  style={{ background: '#0a1020', border: `1px solid ${BORDER}` }}
                />
              </div>
              <div>
                <label className="block text-[9px] text-slate-600 mb-0.5">Début</label>
                <input type="date" value={h.start}
                  onChange={e => updateBreak(i, 'start', e.target.value)}
                  className="w-full px-2.5 py-2 rounded-lg text-xs text-white outline-none [color-scheme:dark]"
                  style={{ background: '#0a1020', border: `1px solid ${BORDER}` }}
                />
              </div>
              <div>
                <label className="block text-[9px] text-slate-600 mb-0.5">Fin</label>
                <input type="date" value={h.end}
                  onChange={e => updateBreak(i, 'end', e.target.value)}
                  className="w-full px-2.5 py-2 rounded-lg text-xs text-white outline-none [color-scheme:dark]"
                  style={{ background: '#0a1020', border: `1px solid ${BORDER}` }}
                />
              </div>
              <button type="button" onClick={() => removeBreak(i)}
                className="py-2 text-[10px] font-bold text-rose-400 hover:text-rose-300 shrink-0"
                disabled={holidayBreaks.length <= 1}>
                Retirer
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Notes pédagogiques */}
      <div>
        <label className="block text-[10px] uppercase tracking-widest text-slate-500 mb-1.5">
          Intentions pédagogiques (optionnel)
        </label>
        <textarea
          value={pedagogicalNotes}
          onChange={e => setPedagogicalNotes(e.target.value)}
          rows={3}
          placeholder="Ex. : Commencer par la purification du cœur, insister sur la pratique quotidienne…"
          className="w-full px-4 py-3 rounded-xl text-sm text-slate-200 resize-none outline-none leading-relaxed"
          style={{ background: '#0a1020', border: `1px solid ${BORDER}` }}
        />
      </div>

      <button
        onClick={() => onGenerate({
          sessionsPerWeek,
          pedagogicalNotes,
          holidays: normalizedHolidays(),
          holiday_country: holidayCountry,
        })}
        disabled={generating || normalizedHolidays().length === 0}
        className="w-full flex items-center justify-center gap-3 py-3.5 rounded-xl font-bold text-sm transition-all disabled:opacity-50"
        style={{ background: generating ? `${VIOLET}20` : `linear-gradient(135deg, ${VIOLET}, #5b46d9)`, color: '#fff' }}>
        {generating
          ? <><Loader2 size={16} className="animate-spin" /> Génération en cours…</>
          : <><Sparkles size={16} /> Générer avec l'IA</>}
      </button>
    </div>
  );
}

// ── Vue d'ensemble du programme ───────────────────────────────────────────────
function ProgramOverview({ calendar, weeks, progressPct, completedCount, totalActive, currentWeek, onPublish, publishing }) {
  const cycleConf = CYCLE_CONFIG[calendar.cycle] ?? CYCLE_CONFIG.fondements;

  // Stats rapides
  const stats = [
    { label: 'Semaines totales',  value: calendar.weeks_count,         color: CYAN  },
    { label: 'Semaines actives',  value: totalActive,                  color: VIOLET },
    { label: 'Modules prévus',    value: calendar.total_modules,       color: GOLD  },
    { label: 'Séances/sem.',      value: calendar.sessions_per_week,   color: GREEN },
  ];

  return (
    <div className="space-y-6">
      {/* En-tête programme */}
      <div className="rounded-2xl p-5 relative overflow-hidden"
        style={{ background: PANEL, border: `1px solid ${cycleConf.color}30` }}>
        <div className="absolute top-0 left-0 right-0 h-0.5"
          style={{ background: `linear-gradient(90deg, ${cycleConf.color}, transparent)` }} />
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{cycleConf.icon}</span>
            <div>
              <p className="text-[10px] uppercase tracking-widest mb-0.5"
                style={{ color: cycleConf.color }}>{cycleConf.label}</p>
              <h2 className="text-white font-bold text-lg leading-tight">{calendar.title}</h2>
              <p className="text-slate-500 text-xs mt-0.5">{calendar.school_year} · {calendar.start_date} → {calendar.end_date}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <StatusBadge status={calendar.status} />
            {calendar.status === 'draft' && (
              <button onClick={onPublish} disabled={publishing}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                style={{ background: `${GREEN}20`, color: GREEN, border: `1px solid ${GREEN}30` }}>
                {publishing ? <Loader2 size={10} className="animate-spin" /> : <Globe size={10} />}
                Publier
              </button>
            )}
          </div>
        </div>

        {/* Barre de progression */}
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-slate-500">{completedCount} semaines complétées</span>
            <span className="font-bold" style={{ color: cycleConf.color }}>{progressPct}%</span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: '#1e2a40' }}>
            <div className="h-full rounded-full transition-all duration-700"
              style={{ width: `${progressPct}%`, background: `linear-gradient(90deg, ${cycleConf.color}, ${cycleConf.color}99)` }} />
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {stats.map(s => (
          <div key={s.label} className="rounded-xl p-4 text-center"
            style={{ background: PANEL, border: `1px solid ${BORDER}` }}>
            <p className="text-2xl font-black mb-0.5" style={{ color: s.color }}>{s.value}</p>
            <p className="text-[10px] text-slate-500">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Semaine en cours */}
      {currentWeek && !currentWeek.is_holiday && (
        <div className="rounded-xl p-4" style={{ background: `${VIOLET}10`, border: `1px solid ${VIOLET}30` }}>
          <p className="text-[9px] uppercase tracking-widest mb-2" style={{ color: VIOLET }}>
            📍 Semaine en cours — S{currentWeek.week_number}
          </p>
          <p className="text-white font-semibold text-sm">{currentWeek.theme ?? currentWeek.module_title}</p>
          {currentWeek.pedagogical_objective && (
            <p className="text-slate-400 text-xs mt-1">{currentWeek.pedagogical_objective}</p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Vue calendrier (grille trimestre) ────────────────────────────────────────
function CalendarGrid({ weeks, byTrimester, currentWeek }) {
  const [activeTrimester, setActiveTrimester] = useState(1);
  const trimesterWeeks = byTrimester[activeTrimester] ?? [];

  return (
    <div className="space-y-4">
      {/* Onglets trimestres */}
      <div className="flex gap-2">
        {[1, 2, 3].map(t => (
          <button key={t} onClick={() => setActiveTrimester(t)}
            className="flex-1 py-2.5 rounded-xl text-xs font-bold transition-all"
            style={{
              background: activeTrimester === t ? `${VIOLET}20` : PANEL,
              color:      activeTrimester === t ? VIOLET : '#64748b',
              border:     `1px solid ${activeTrimester === t ? VIOLET + '40' : BORDER}`,
            }}>
            T{t} <span className="font-normal opacity-60">({byTrimester[t]?.length ?? 0} sem.)</span>
          </button>
        ))}
      </div>

      {/* Grille semaines */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {trimesterWeeks.map(w => (
          <WeekCard
            key={w.id ?? w.week_number}
            week={w}
            isCurrent={currentWeek?.week_number === w.week_number}
          />
        ))}
        {trimesterWeeks.length === 0 && (
          <div className="col-span-3 py-12 text-center text-slate-600 text-sm">
            Aucune semaine pour ce trimestre
          </div>
        )}
      </div>
    </div>
  );
}

// ── Pont vers parcours LIRI (school_paths / module_weeks) ─────────────────────
function PathSyncSection({ calendar }) {
  const [paths, setPaths] = useState([]);
  const [courses, setCourses] = useState([]);
  const [modules, setModules] = useState([]);
  const [pathId, setPathId] = useState('');
  const [courseId, setCourseId] = useState('');
  const [moduleId, setModuleId] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    let on = true;
    (async () => {
      const { data } = await listSchoolPaths(supabase);
      if (on && data) setPaths(data);
    })();
    return () => { on = false; };
  }, []);

  useEffect(() => {
    if (calendar?.school_path_id) setPathId(calendar.school_path_id);
  }, [calendar?.school_path_id]);

  useEffect(() => {
    if (!pathId) {
      setCourses([]);
      setCourseId('');
      return;
    }
    let on = true;
    listPathCourses(supabase, pathId).then(({ data }) => {
      if (!on || !data?.length) {
        if (on) { setCourses([]); setCourseId(''); }
        return;
      }
      setCourses(data);
      setCourseId((prev) => (data.some((c) => c.id === prev) ? prev : data[0].id));
    });
    return () => { on = false; };
  }, [pathId]);

  useEffect(() => {
    if (!courseId) {
      setModules([]);
      setModuleId('');
      return;
    }
    let on = true;
    listCourseModules(supabase, courseId).then(({ data }) => {
      if (!on || !data?.length) {
        if (on) { setModules([]); setModuleId(''); }
        return;
      }
      setModules(data);
      setModuleId((prev) => (data.some((m) => m.id === prev) ? prev : data[0].id));
    });
    return () => { on = false; };
  }, [courseId]);

  const onSync = async () => {
    if (!calendar?.id || !pathId || !moduleId) return;
    setBusy(true);
    setMsg(null);
    const r = await syncAnnualProgramToPathModule(supabase, {
      calendarId: calendar.id,
      pathId,
      moduleId,
    });
    setBusy(false);
    if (r.error) setMsg(r.error);
    else setMsg(`${r.created} semaine(s) créée(s), ${r.updated} mise(s) à jour. Calendrier parcours (starts_on) aligné.`);
  };

  if (!calendar?.id) return null;

  return (
    <div className="rounded-2xl p-5 mt-6"
      style={{ background: PANEL, border: `1px solid ${BORDER}` }}>
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: `${CYAN}18`, border: `1px solid ${CYAN}35` }}>
          <Route size={14} color={CYAN} />
        </div>
        <div>
          <h3 className="text-white font-bold text-sm">Parcours LIRI (Pédagogie du futur)</h3>
          <p className="text-slate-500 text-[10px]">Projeter les semaines actives vers un module (titres, grammar_key, lien). Nécessite d’être propriétaire du parcours — même règle que l’éditeur Pédagogie du futur.</p>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <div>
          <label className="block text-[9px] uppercase tracking-widest text-slate-500 mb-1">Parcours</label>
          <select value={pathId} onChange={(e) => setPathId(e.target.value)}
            className="w-full px-3 py-2 rounded-xl text-xs text-white outline-none"
            style={{ background: '#0a1020', border: `1px solid ${BORDER}` }}>
            <option value="">— Choisir —</option>
            {paths.map((p) => (
              <option key={p.id} value={p.id}>{p.title}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[9px] uppercase tracking-widest text-slate-500 mb-1">Cours</label>
          <select value={courseId} onChange={(e) => setCourseId(e.target.value)}
            disabled={!pathId}
            className="w-full px-3 py-2 rounded-xl text-xs text-white outline-none disabled:opacity-40"
            style={{ background: '#0a1020', border: `1px solid ${BORDER}` }}>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[9px] uppercase tracking-widest text-slate-500 mb-1">Module récepteur</label>
          <select value={moduleId} onChange={(e) => setModuleId(e.target.value)}
            disabled={!courseId}
            className="w-full px-3 py-2 rounded-xl text-xs text-white outline-none disabled:opacity-40"
            style={{ background: '#0a1020', border: `1px solid ${BORDER}` }}>
            {modules.map((m) => (
              <option key={m.id} value={m.id}>{m.title}</option>
            ))}
          </select>
        </div>
      </div>
      <button type="button"
        onClick={onSync}
        disabled={busy || !pathId || !moduleId}
        className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold disabled:opacity-45"
        style={{ background: `${CYAN}22`, color: CYAN, border: `1px solid ${CYAN}40` }}>
        {busy ? <Loader2 size={12} className="animate-spin" /> : <Layers size={12} />}
        Synchroniser vers le parcours
      </button>
      {msg && (
        <p className={`mt-3 text-[11px] ${String(msg).includes('créée') || String(msg).includes('mise') ? 'text-emerald-400' : 'text-rose-400'}`}>
          {msg}
        </p>
      )}
    </div>
  );
}

// ── Composant principal ───────────────────────────────────────────────────────
export default function AnnualProgramPage() {
  const [activeTab,   setActiveTab]   = useState('overview');   // 'overview' | 'calendar' | 'generate'
  const [cycle,       setCycle]       = useState('fondements');
  const [schoolYear,  setSchoolYear]  = useState(CURRENT_SCHOOL_YEAR);
  const [publishing,  setPublishing]  = useState(false);

  const {
    calendar, weeks, loading, generating, error,
    generate, publish, updateWeek,
    currentWeek, upcomingWeeks, completedCount, totalActive, progressPct,
    byTrimester, hasProgram, isPublished,
  } = useAnnualProgram({ schoolYear, cycle, autoLoad: true });

  const handleGenerate = async ({ sessionsPerWeek, pedagogicalNotes, holidays, holiday_country }) => {
    await generate({ sessionsPerWeek, pedagogicalNotes, holidays, holiday_country });
    if (!hasProgram) setActiveTab('overview');
    else setActiveTab('calendar');
  };

  const handlePublish = async () => {
    setPublishing(true);
    await publish();
    setPublishing(false);
  };

  const TABS = [
    { id: 'overview',  label: 'Vue d\'ensemble', icon: Eye        },
    { id: 'calendar',  label: 'Calendrier',       icon: CalendarDays },
    { id: 'generate',  label: 'Générer / Config', icon: Sparkles   },
  ];

  return (
    <div className="min-h-screen" style={{ background: BG, fontFamily: "'Inter', sans-serif" }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="px-6 py-5 border-b" style={{ borderColor: BORDER }}>
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: `${GOLD}20`, border: `1px solid ${GOLD}30` }}>
              <CalendarDays size={18} color={GOLD} />
            </div>
            <div>
              <h1 className="text-white font-bold text-xl">Programme Scolaire Annuel</h1>
              <p className="text-slate-500 text-xs">Pédagogie du Futur — LIRI {schoolYear}</p>
            </div>
          </div>
          {hasProgram && <StatusBadge status={calendar?.status} />}
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">

        {/* ── Onglets ──────────────────────────────────────────────────────── */}
        <div className="flex gap-2">
          {TABS.map(tab => {
            const Icon = tab.icon;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
                style={{
                  background: activeTab === tab.id ? `${VIOLET}20` : PANEL,
                  color:      activeTab === tab.id ? VIOLET : '#64748b',
                  border:     `1px solid ${activeTab === tab.id ? VIOLET + '40' : BORDER}`,
                }}>
                <Icon size={14} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* ── Erreur ───────────────────────────────────────────────────────── */}
        {error && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm"
            style={{ background: `${RED}10`, border: `1px solid ${RED}25`, color: RED }}>
            <AlertCircle size={14} />
            {error}
          </div>
        )}

        {/* ── Loading ──────────────────────────────────────────────────────── */}
        {loading && (
          <div className="flex items-center justify-center py-24 gap-3 text-slate-500">
            <Loader2 size={20} className="animate-spin" />
            Chargement du programme…
          </div>
        )}

        {/* ── Contenu ──────────────────────────────────────────────────────── */}
        {!loading && (
          <AnimatePresence mode="wait">
            <motion.div key={activeTab}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.18 }}>

              {/* Vue d'ensemble */}
              {activeTab === 'overview' && (
                hasProgram ? (
                  <>
                  <ProgramOverview
                    calendar={calendar}
                    weeks={weeks}
                    progressPct={progressPct}
                    completedCount={completedCount}
                    totalActive={totalActive}
                    currentWeek={currentWeek}
                    onPublish={handlePublish}
                    publishing={publishing}
                  />
                  <PathSyncSection calendar={calendar} />
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center py-24 gap-5 text-center">
                    <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
                      style={{ background: `${GOLD}15`, border: `1px solid ${GOLD}25` }}>
                      <CalendarDays size={28} color={GOLD} />
                    </div>
                    <div>
                      <h3 className="text-white font-bold text-lg mb-2">Aucun programme pour {schoolYear}</h3>
                      <p className="text-slate-500 text-sm max-w-sm">
                        Générez le programme annuel avec l'IA — les 21 modules LIRI planifiés semaine par semaine sur 10 mois.
                      </p>
                    </div>
                    <button onClick={() => setActiveTab('generate')}
                      className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm"
                      style={{ background: `linear-gradient(135deg, ${VIOLET}, #5b46d9)`, color: '#fff' }}>
                      <Sparkles size={14} /> Générer le programme
                    </button>
                  </div>
                )
              )}

              {/* Calendrier */}
              {activeTab === 'calendar' && (
                hasProgram ? (
                  <CalendarGrid
                    weeks={weeks}
                    byTrimester={byTrimester}
                    currentWeek={currentWeek}
                  />
                ) : (
                  <div className="py-24 text-center text-slate-600">
                    Aucun programme disponible — générez-en un d'abord
                  </div>
                )
              )}

              {/* Générer */}
              {activeTab === 'generate' && (
                <div className="max-w-2xl">
                  <GeneratePanel
                    onGenerate={handleGenerate}
                    generating={generating}
                    cycle={cycle}
                    setCycle={setCycle}
                    schoolYear={schoolYear}
                    setSchoolYear={setSchoolYear}
                  />
                  {hasProgram && (
                    <div className="mt-4 p-4 rounded-xl flex items-center gap-3"
                      style={{ background: `${GREEN}08`, border: `1px solid ${GREEN}20` }}>
                      <CheckCircle2 size={14} color={GREEN} />
                      <p className="text-xs" style={{ color: GREEN }}>
                        Un programme existe déjà pour {schoolYear} ({cycle}) — la génération le remplacera.
                      </p>
                    </div>
                  )}
                </div>
              )}

            </motion.div>
          </AnimatePresence>
        )}

      </div>
    </div>
  );
}
