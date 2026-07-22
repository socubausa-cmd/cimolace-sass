/**
 * DebateCore — liste + création de débats (modérateur).
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { format, startOfToday } from 'date-fns';
import { fr as frLocale } from 'date-fns/locale';
import { ArrowLeft, Swords, Plus, Loader2, ChevronRight, Calendar as CalendarIcon, Clock } from 'lucide-react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/lib/customSupabaseClient';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import useTenantBranding from '@/hooks/useTenantBranding';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const STATUS_LABELS = {
  draft: 'Brouillon',
  awaiting_debaters: 'En attente des débatteurs',
  preparing: 'Préparation',
  ready_to_start: 'Prêt à démarrer',
  live: 'En direct',
  interactive_exchange: 'Échange libre',
  audience_questions: 'Questions public',
  round_break: 'Pause',
  finished: 'Terminé',
  archived: 'Archivé',
};

function formatWhen(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return '—';
  }
}

function dateFromYmd(ymd) {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return undefined;
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function ymdFromDate(d) {
  if (!d) return '';
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${day}`;
}

const DEBATE_HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const DEBATE_MINUTE_OPTIONS = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'));

const DEBATE_MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => ({
  value: String(i),
  label: format(new Date(2024, i, 1), 'LLLL', { locale: frLocale }),
}));

function debateYearOptions() {
  const y0 = new Date().getFullYear();
  return Array.from({ length: 8 }, (_, i) => String(y0 + i));
}

function parseDebateTimeHm(t) {
  const raw = (t || '14:00').trim().slice(0, 5);
  const [a, b] = raw.split(':');
  const h = String(Math.min(23, Math.max(0, parseInt(a, 10) || 14))).padStart(2, '0');
  let mi = parseInt(b, 10);
  if (Number.isNaN(mi)) mi = 0;
  mi = Math.min(55, Math.max(0, Math.round(mi / 5) * 5));
  const m = String(mi).padStart(2, '0');
  return { h, m };
}

export default function StudioDebateBuilderPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { branding, cssVars } = useTenantBranding();
  const [list, setList] = useState([]);
  const [debaterRows, setDebaterRows] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [debateScheduleOpen, setDebateScheduleOpen] = useState(false);

  const [title, setTitle] = useState('');
  const [topic, setTopic] = useState('');
  const [description, setDescription] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('14:00');
  /** Mois affiché dans le popover (navigation mois/année au clic, sans saisie manuelle). */
  const [calendarMonth, setCalendarMonth] = useState(() => startOfToday());

  const { h: debateHour, m: debateMinute } = useMemo(() => parseDebateTimeHm(scheduledTime), [scheduledTime]);

  const setDebateHour = useCallback((hh) => {
    const { m } = parseDebateTimeHm(scheduledTime);
    setScheduledTime(`${hh}:${m}`);
  }, [scheduledTime]);

  const setDebateMinute = useCallback((mm) => {
    const { h } = parseDebateTimeHm(scheduledTime);
    setScheduledTime(`${h}:${mm}`);
  }, [scheduledTime]);

  const debateYearChoices = useMemo(() => debateYearOptions(), []);

  useEffect(() => {
    if (!debateScheduleOpen) return;
    setCalendarMonth(dateFromYmd(scheduledDate) || startOfToday());
  }, [debateScheduleOpen, scheduledDate]);
  const [roundCount, setRoundCount] = useState(3);
  const [minutesPerTurn, setMinutesPerTurn] = useState(10);
  const [accessMode, setAccessMode] = useState('private');
  const [accessPassword, setAccessPassword] = useState('');
  const [voteType, setVoteType] = useState('per_round_ab');
  const [neuronqEnabled, setNeuronqEnabled] = useState(true);
  const [aiJudgeEnabled, setAiJudgeEnabled] = useState(false);
  const [aiWeight, setAiWeight] = useState(0.3);

  const loadList = useCallback(async () => {
    if (!user?.id) {
      setList([]);
      setDebaterRows([]);
      setLoadingList(false);
      return;
    }
    setLoadingList(true);
    setListError('');
    const { data, error } = await supabase
      .from('debates')
      .select('id, title, topic, status, scheduled_at, round_count, created_at, live_session_id')
      .eq('moderator_id', user.id)
      .order('scheduled_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false });

    const { data: parts, error: pErr } = await supabase
      .from('debate_participants')
      .select('debate_id, side, ready_status')
      .eq('user_id', user.id)
      .eq('role', 'debater');

    if (error) {
      setListError(error.message || 'Impossible de charger les débats.');
      setList([]);
      setDebaterRows([]);
      setLoadingList(false);
      return;
    }
    setList(data || []);

    if (pErr || !parts?.length) {
      setDebaterRows([]);
    } else {
      const ids = [...new Set(parts.map((p) => p.debate_id))];
      const { data: dbs, error: dErr } = await supabase
        .from('debates')
        .select('id, title, topic, status, scheduled_at, round_count, live_session_id')
        .in('id', ids);
      if (dErr) {
        setDebaterRows([]);
      } else {
        const byId = Object.fromEntries((dbs || []).map((d) => [d.id, d]));
        const rows = parts
          .map((p) => {
            const d = byId[p.debate_id];
            if (!d) return null;
            return { ...d, side: p.side, debater_ready: p.ready_status };
          })
          .filter(Boolean)
          .sort((a, b) => {
            const ta = a.scheduled_at ? new Date(a.scheduled_at).getTime() : 0;
            const tb = b.scheduled_at ? new Date(b.scheduled_at).getTime() : 0;
            return tb - ta;
          });
        setDebaterRows(rows);
      }
    }
    setLoadingList(false);
  }, [user?.id]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  const resetForm = () => {
    setTitle('');
    setTopic('');
    setDescription('');
    setScheduledDate('');
    setScheduledTime('14:00');
    setRoundCount(3);
    setMinutesPerTurn(10);
    setAccessMode('private');
    setAccessPassword('');
    setVoteType('per_round_ab');
    setNeuronqEnabled(true);
    setAiJudgeEnabled(false);
    setAiWeight(0.3);
    setFormError('');
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!user?.id) return;
    const t = title.trim();
    if (!t) {
      setFormError('Le titre est requis.');
      return;
    }
    const seconds = Math.min(7200, Math.max(30, Math.round(Number(minutesPerTurn) * 60) || 300));
    const rounds = Math.min(50, Math.max(1, parseInt(String(roundCount), 10) || 1));
    let scheduledIso = null;
    if (scheduledDate?.trim()) {
      const hm = (scheduledTime?.trim() || '14:00').slice(0, 5);
      const d = new Date(`${scheduledDate.trim()}T${hm}:00`);
      if (!Number.isNaN(d.getTime())) scheduledIso = d.toISOString();
    }

    setSaving(true);
    setFormError('');
    const row = {
      title: t,
      topic: topic.trim() || null,
      description: description.trim() || null,
      scheduled_at: scheduledIso,
      round_count: rounds,
      seconds_per_turn: seconds,
      access_mode: accessMode,
      access_password: accessMode === 'password' && accessPassword.trim() ? accessPassword.trim() : null,
      vote_type: voteType,
      neuronq_enabled: neuronqEnabled,
      ai_judge_enabled: aiJudgeEnabled,
      ai_weight: Math.min(1, Math.max(0, Number(aiWeight) || 0)),
      moderator_id: user.id,
      status: 'draft',
    };

    const { data: created, error: insErr } = await supabase.from('debates').insert(row).select('id').single();
    if (insErr || !created?.id) {
      setFormError(insErr?.message || 'Création impossible. Vérifiez que la migration DebateCore est appliquée.');
      setSaving(false);
      return;
    }

    const debateId = created.id;

    const roundsRows = Array.from({ length: rounds }, (_, i) => ({
      debate_id: debateId,
      round_number: i + 1,
      status: 'pending',
    }));
    const { error: rErr } = await supabase.from('debate_rounds').insert(roundsRows);
    if (rErr) {
      await supabase.from('debates').delete().eq('id', debateId);
      setFormError(rErr.message || 'Erreur lors de la création des rounds.');
      setSaving(false);
      return;
    }

    const { error: pErr } = await supabase.from('debate_participants').insert({
      debate_id: debateId,
      user_id: user.id,
      role: 'moderator',
      side: null,
      ready_status: 'ready',
    });
    if (pErr) {
      console.warn('[debate] moderator participant:', pErr.message);
    }

    setSaving(false);
    resetForm();
    setFormOpen(false);
    await loadList();
    navigate(`/studio/debate-builder/${debateId}`);
  };

  if (!user?.id) {
    return (
      <div
        className="min-h-screen text-white flex items-center justify-center px-4"
        data-school-shell="debate-builder"
        data-tenant-brand={branding.slug}
        style={{ ...cssVars, background: 'var(--school-background, #262624)', fontFamily: 'var(--school-font-family, Inter, sans-serif)' }}
      >
        <p className="text-sm text-white/50">Connectez-vous pour accéder au Debate Builder.</p>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen text-white"
      data-school-shell="debate-builder"
      data-tenant-brand={branding.slug}
      style={{ ...cssVars, background: 'var(--school-background, #262624)', fontFamily: 'var(--school-font-family, Inter, sans-serif)' }}
    >
      <div className="max-w-3xl mx-auto px-4 py-10 md:py-14">
        <Link
          to="/studio"
          className="inline-flex items-center gap-2 text-sm text-white/50 hover:text-[var(--school-accent,#D4AF37)] transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour au Studio
        </Link>

        <div className="flex items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-rose-500/20 flex items-center justify-center">
              <Swords className="w-6 h-6 text-rose-300" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-rose-300/80 font-semibold">DebateCore</p>
              <h1 className="text-xl md:text-2xl font-bold">Mes débats</h1>
            </div>
          </div>
          <button
            type="button"
            onClick={() => { setFormOpen((v) => !v); setFormError(''); }}
            className={cn(
              'inline-flex items-center gap-2 h-10 px-4 rounded-xl text-sm font-medium border transition-colors',
              formOpen
                ? 'border-white/20 bg-white/5 text-white/80'
                : 'border-rose-400/40 bg-rose-500/15 text-rose-200 hover:bg-rose-500/25',
            )}
          >
            {formOpen ? 'Fermer le formulaire' : <><Plus className="w-4 h-4" /> Nouveau débat</>}
          </button>
        </div>

        <div id="debater-invites" className="rounded-2xl border border-[#ebca5e]/20 bg-[#ebca5e]/[0.06] overflow-hidden mb-8 scroll-mt-24">
          <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2 text-[#ebca5e]/90 text-xs font-medium">
            En tant que débatteur
          </div>
          {loadingList ? (
            <div className="p-8 flex justify-center">
              <Loader2 className="w-6 h-6 text-[#ebca5e]/50 animate-spin" />
            </div>
          ) : debaterRows.length === 0 ? (
            <p className="p-6 text-center text-sm text-white/38">
              Aucun débat pour le moment. Acceptez une invitation par lien pour apparaître ici.
            </p>
          ) : (
            <ul className="divide-y divide-white/5">
              {debaterRows.map((d) => (
                <li key={`${d.id}-${d.side}`} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-white/90 truncate">{d.title}</p>
                    <p className="text-[11px] text-white/40 mt-0.5">
                      Camp {d.side} · {STATUS_LABELS[d.status] || d.status} · {formatWhen(d.scheduled_at)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 shrink-0">
                    <Link
                      to={`/studio/debate-prep/${d.id}`}
                      className="h-9 px-3 rounded-lg border border-white/15 text-xs font-medium text-white/80 hover:bg-white/5 inline-flex items-center"
                    >
                      Préparation
                    </Link>
                    {d.live_session_id ? (
                      <Link
                        to={`/studio/live-arena/${d.live_session_id}`}
                        className="h-9 px-3 rounded-lg bg-amber-600/80 hover:bg-amber-600 text-xs font-medium inline-flex items-center"
                      >
                        Arena
                      </Link>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {formOpen && (
          <motion.form
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            onSubmit={handleCreate}
            className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 mb-10 space-y-4"
          >
            <h2 className="text-sm font-semibold text-white/90">Créer un débat</h2>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="block md:col-span-2">
                <span className="text-[10px] uppercase tracking-wider text-white/40">Titre *</span>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="mt-1 w-full rounded-xl bg-black/40 border border-white/10 px-3 py-2 text-sm outline-none focus:border-rose-400/50"
                  placeholder="ex. Transhumanisme et spiritualité"
                />
              </label>
              <label className="block">
                <span className="text-[10px] uppercase tracking-wider text-white/40">Thème</span>
                <input
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="mt-1 w-full rounded-xl bg-black/40 border border-white/10 px-3 py-2 text-sm outline-none focus:border-rose-400/50"
                />
              </label>
              <div className="block md:col-span-2">
                <span className="text-[10px] uppercase tracking-wider text-white/40">Date & heure prévues</span>
                <div className="mt-1 flex flex-col gap-2">
                  <Popover open={debateScheduleOpen} onOpenChange={setDebateScheduleOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        className={cn(
                          'h-12 w-full justify-start text-left font-normal rounded-xl border-white/10 bg-black/40 text-white hover:bg-white/10 hover:text-white gap-2',
                          !scheduledDate && 'text-white/45',
                        )}
                      >
                        <CalendarIcon className="h-4 w-4 shrink-0 text-rose-400/90" />
                        <Clock className="h-4 w-4 shrink-0 text-rose-400/70" />
                        <span className="truncate">
                          {scheduledDate
                            ? `${format(dateFromYmd(scheduledDate), 'EEE d MMM yyyy', { locale: frLocale })} · ${debateHour}h${debateMinute}`
                            : 'Choisir la date, l\'année et l\'heure'}
                        </span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-auto max-w-[min(100vw-1.5rem,340px)] border-white/10 bg-[#151a22]/98 p-0 shadow-2xl"
                      align="start"
                    >
                      <div className="p-2 pb-1 space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <Label className="text-[10px] uppercase tracking-wider text-white/45">Mois</Label>
                            <Select
                              value={String(calendarMonth.getMonth())}
                              onValueChange={(mi) => {
                                setCalendarMonth(new Date(calendarMonth.getFullYear(), Number(mi), 1));
                              }}
                            >
                              <SelectTrigger
                                aria-label="Mois"
                                className="h-10 w-full rounded-lg border-white/12 bg-black/45 text-white text-sm"
                              >
                                <SelectValue placeholder="Mois" />
                              </SelectTrigger>
                              <SelectContent className="max-h-60 bg-[#1a1f28] border-white/10 text-white">
                                {DEBATE_MONTH_OPTIONS.map(({ value, label }) => (
                                  <SelectItem key={value} value={value} className="focus:bg-rose-500/20 focus:text-white">
                                    {label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[10px] uppercase tracking-wider text-white/45">Année</Label>
                            <Select
                              value={String(calendarMonth.getFullYear())}
                              onValueChange={(y) => {
                                setCalendarMonth(new Date(Number(y), calendarMonth.getMonth(), 1));
                              }}
                            >
                              <SelectTrigger
                                aria-label="Année"
                                className="h-10 w-full rounded-lg border-white/12 bg-black/45 text-white text-sm"
                              >
                                <SelectValue placeholder="Année" />
                              </SelectTrigger>
                              <SelectContent className="max-h-52 bg-[#1a1f28] border-white/10 text-white">
                                {debateYearChoices.map((yy) => (
                                  <SelectItem key={yy} value={yy} className="focus:bg-rose-500/20 focus:text-white">
                                    {yy}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <Calendar
                          mode="single"
                          month={calendarMonth}
                          onMonthChange={setCalendarMonth}
                          selected={dateFromYmd(scheduledDate)}
                          onSelect={(d) => setScheduledDate(d ? ymdFromDate(d) : '')}
                          disabled={{ before: startOfToday() }}
                          captionLayout="buttons"
                          initialFocus
                        />
                      </div>
                      <div className="border-t border-white/10 px-3 py-3 space-y-2">
                        <Label className="text-[10px] uppercase tracking-wider text-white/45">Heure</Label>
                        <div className="flex items-center gap-2">
                          <Select value={debateHour} onValueChange={setDebateHour}>
                            <SelectTrigger
                              aria-label="Heure"
                              className="h-10 flex-1 rounded-lg border-white/12 bg-black/45 text-white text-sm"
                            >
                              <SelectValue placeholder="Heure" />
                            </SelectTrigger>
                            <SelectContent className="max-h-60 bg-[#1a1f28] border-white/10 text-white">
                              {DEBATE_HOUR_OPTIONS.map((hh) => (
                                <SelectItem key={hh} value={hh} className="focus:bg-rose-500/20 focus:text-white">
                                  {hh} h
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <span className="text-white/40 text-lg font-light">:</span>
                          <Select value={debateMinute} onValueChange={setDebateMinute}>
                            <SelectTrigger
                              aria-label="Minutes"
                              className="h-10 flex-1 rounded-lg border-white/12 bg-black/45 text-white text-sm"
                            >
                              <SelectValue placeholder="Min" />
                            </SelectTrigger>
                            <SelectContent className="max-h-60 bg-[#1a1f28] border-white/10 text-white">
                              {DEBATE_MINUTE_OPTIONS.map((mm) => (
                                <SelectItem key={mm} value={mm} className="focus:bg-rose-500/20 focus:text-white">
                                  {mm}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <p className="text-[10px] text-white/35">Minutes par pas de 5.</p>
                      </div>
                      <div className="flex flex-col gap-2 border-t border-white/10 p-3">
                        <Button
                          type="button"
                          className="w-full h-9 bg-rose-500/90 hover:bg-rose-500 text-white text-sm"
                          onClick={() => setDebateScheduleOpen(false)}
                        >
                          Valider
                        </Button>
                        {scheduledDate ? (
                          <button
                            type="button"
                            onClick={() => {
                              setScheduledDate('');
                              setScheduledTime('14:00');
                            }}
                            className="text-[11px] text-rose-300/80 hover:text-rose-200 text-center w-full"
                          >
                            Effacer date & heure
                          </button>
                        ) : null}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
                <p className="mt-1.5 text-[10px] text-white/35">
                  Un clic ouvre le panneau : mois, année, jour au calendrier, puis heure en listes. Laissez vide si le créneau n&apos;est pas fixé.
                </p>
              </div>
              <label className="block md:col-span-2">
                <span className="text-[10px] uppercase tracking-wider text-white/40">Description</span>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-xl bg-black/40 border border-white/10 px-3 py-2 text-sm outline-none focus:border-rose-400/50 resize-y min-h-[72px]"
                />
              </label>
              <label className="block">
                <span className="text-[10px] uppercase tracking-wider text-white/40">Nombre de rounds</span>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={roundCount}
                  onChange={(e) => setRoundCount(parseInt(e.target.value, 10) || 1)}
                  className="mt-1 w-full rounded-xl bg-black/40 border border-white/10 px-3 py-2 text-sm outline-none focus:border-rose-400/50"
                />
              </label>
              <label className="block">
                <span className="text-[10px] uppercase tracking-wider text-white/40">Minutes / tour de parole</span>
                <input
                  type="number"
                  min={1}
                  max={120}
                  value={minutesPerTurn}
                  onChange={(e) => setMinutesPerTurn(parseInt(e.target.value, 10) || 5)}
                  className="mt-1 w-full rounded-xl bg-black/40 border border-white/10 px-3 py-2 text-sm outline-none focus:border-rose-400/50"
                />
              </label>
              <label className="block">
                <span className="text-[10px] uppercase tracking-wider text-white/40">Accès salle</span>
                <select
                  value={accessMode}
                  onChange={(e) => setAccessMode(e.target.value)}
                  className="mt-1 w-full rounded-xl bg-black/40 border border-white/10 px-3 py-2 text-sm outline-none focus:border-rose-400/50"
                >
                  <option value="private">Privé (invitation)</option>
                  <option value="public">Public</option>
                  <option value="password">Mot de passe</option>
                </select>
              </label>
              {accessMode === 'password' ? (
                <label className="block">
                  <span className="text-[10px] uppercase tracking-wider text-white/40">Mot de passe</span>
                  <input
                    type="text"
                    value={accessPassword}
                    onChange={(e) => setAccessPassword(e.target.value)}
                    className="mt-1 w-full rounded-xl bg-black/40 border border-white/10 px-3 py-2 text-sm outline-none focus:border-rose-400/50"
                    autoComplete="off"
                  />
                </label>
              ) : null}
              <label className="block">
                <span className="text-[10px] uppercase tracking-wider text-white/40">Type de vote</span>
                <select
                  value={voteType}
                  onChange={(e) => setVoteType(e.target.value)}
                  className="mt-1 w-full rounded-xl bg-black/40 border border-white/10 px-3 py-2 text-sm outline-none focus:border-rose-400/50"
                >
                  <option value="per_round_ab">Par round — A / B / égalité</option>
                  <option value="per_round_abc">Par round — A / B / neutre</option>
                  <option value="final_only">Vote final uniquement</option>
                </select>
              </label>
            </div>

            <div className="flex flex-wrap gap-6 pt-2 border-t border-white/10">
              <label className="flex items-center gap-2 text-xs text-white/70 cursor-pointer">
                <input type="checkbox" checked={neuronqEnabled} onChange={(e) => setNeuronqEnabled(e.target.checked)} className="rounded border-white/30" />
                NeuronQ (questions / file)
              </label>
              <label className="flex items-center gap-2 text-xs text-white/70 cursor-pointer">
                <input type="checkbox" checked={aiJudgeEnabled} onChange={(e) => setAiJudgeEnabled(e.target.checked)} className="rounded border-white/30" />
                Contrôleur IA (juge)
              </label>
              <label className="flex items-center gap-3 text-xs text-white/70">
                <span>Poids IA</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(aiWeight * 100)}
                  onChange={(e) => setAiWeight(Number(e.target.value) / 100)}
                  className="w-28 accent-rose-400"
                />
                <span className="tabular-nums text-white/50">{Math.round(aiWeight * 100)}%</span>
              </label>
            </div>

            {formError ? <p className="text-xs text-red-300/90">{formError}</p> : null}

            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 h-10 px-5 rounded-xl bg-rose-500/80 hover:bg-rose-500 text-sm font-medium disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Créer et ouvrir la fiche
            </button>
          </motion.form>
        )}

        <div className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden">
          <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2 text-white/50 text-xs">
            <CalendarIcon className="w-3.5 h-3.5" />
            {loadingList ? 'Chargement…' : `${list.length} débat${list.length !== 1 ? 's' : ''}`}
          </div>
          {listError ? (
            <div className="p-4 text-sm text-red-300/90">{listError}</div>
          ) : loadingList ? (
            <div className="p-12 flex justify-center">
              <Loader2 className="w-8 h-8 text-rose-400/50 animate-spin" />
            </div>
          ) : list.length === 0 ? (
            <p className="p-8 text-center text-sm text-white/40">Aucun débat. Créez-en un avec le bouton ci-dessus.</p>
          ) : (
            <ul className="divide-y divide-white/5">
              {list.map((d) => (
                <li key={d.id} className="flex items-stretch min-h-[52px]">
                  <Link
                    to={`/studio/debate-builder/${d.id}`}
                    className="flex flex-1 items-center justify-between gap-3 px-4 py-3 hover:bg-white/[0.04] transition-colors group min-w-0"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white/90 truncate">{d.title}</p>
                      <p className="text-[11px] text-white/40 mt-0.5">
                        {STATUS_LABELS[d.status] || d.status} · {d.round_count} rounds · {formatWhen(d.scheduled_at)}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-white/25 group-hover:text-rose-300/60 shrink-0" />
                  </Link>
                  {d.live_session_id ? (
                    <Link
                      to={`/studio/live-arena/${d.live_session_id}`}
                      className="shrink-0 px-3 flex items-center text-[11px] font-medium text-amber-300/90 hover:bg-amber-500/10 border-l border-white/10"
                    >
                      Arena
                    </Link>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
