import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  getNgowazuluMentoratOffer,
  getSessionsQuotaForSlug,
  NGOWAZULU_SESSION_TYPE_LABELS,
} from '@/config/ngowazuluMentoratOffers';
import {
  addMinutesToIso,
  countSessionsInCalendarMonth,
  countSessionsInContractPeriod,
  fetchNgowazuluSessionConflicts,
} from '@/lib/ngowazuluMentoratSessions';
import { CalendarClock, Flame, Loader2, Plus, Users, AlertTriangle, Sparkles } from 'lucide-react';

function toDatetimeLocalValue(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromDatetimeLocalValue(s) {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export default function NgowazuluMentoratManagerTab() {
  const { toast } = useToast();
  const [loadingList, setLoadingList] = useState(true);
  const [students, setStudents] = useState([]);
  const [selected, setSelected] = useState(null);
  const [contracts, setContracts] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [globalMonthSessions, setGlobalMonthSessions] = useState([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [savingContract, setSavingContract] = useState(false);
  const [savingSession, setSavingSession] = useState(false);

  const [week1, setWeek1] = useState(() => new Date().toISOString().slice(0, 10));
  const [periodDays, setPeriodDays] = useState(30);
  const [contractNotes, setContractNotes] = useState('');

  const [sessionType, setSessionType] = useState('mentorat_meeting');
  const [sessionTitle, setSessionTitle] = useState('');
  const [sessionStartLocal, setSessionStartLocal] = useState('');
  const [sessionDurationMin, setSessionDurationMin] = useState(60);
  const [pendingConflicts, setPendingConflicts] = useState([]);

  const loadStudents = useCallback(async () => {
    setLoadingList(true);
    try {
      const { data: subs, error } = await supabase
        .from('billing_subscriptions')
        .select('id,user_id,plan_id,status,current_period_end')
        .in('status', ['active', 'past_due'])
        .order('updated_at', { ascending: false });
      if (error) throw error;
      const rows = (subs || []).filter((s) => String(s.plan_id || '').startsWith('ngowazulu-mentorat'));
      const ids = [...new Set(rows.map((r) => r.user_id).filter(Boolean))];
      let profileMap = {};
      if (ids.length) {
        const { data: profs } = await supabase.from('profiles').select('id,name,email').in('id', ids);
        (profs || []).forEach((p) => {
          profileMap[p.id] = p;
        });
      }
      setStudents(
        rows.map((r) => ({
          ...r,
          profile: profileMap[r.user_id] || null,
        }))
      );
    } catch (e) {
      toast({ title: 'Chargement impossible', description: e?.message || 'Erreur', variant: 'destructive' });
      setStudents([]);
    } finally {
      setLoadingList(false);
    }
  }, [toast]);

  const loadDetail = useCallback(
    async (subRow) => {
      if (!subRow?.user_id) return;
      setLoadingDetail(true);
      setPendingConflicts([]);
      try {
        const [{ data: cRows }, { data: sRows }, { data: gRows }] = await Promise.all([
          supabase
            .from('ngowazulu_mentorat_contracts')
            .select('*')
            .eq('student_id', subRow.user_id)
            .order('period_start', { ascending: false }),
          supabase
            .from('ngowazulu_mentorat_sessions')
            .select('*')
            .eq('student_id', subRow.user_id)
            .order('scheduled_start', { ascending: true }),
          supabase
            .from('ngowazulu_mentorat_sessions')
            .select('id,title,scheduled_start,scheduled_end,student_id,session_type,status')
            .neq('status', 'cancelled')
            .gte('scheduled_start', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString())
            .lt('scheduled_start', new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toISOString())
            .order('scheduled_start', { ascending: true }),
        ]);
        setContracts(cRows || []);
        setSessions(sRows || []);
        setGlobalMonthSessions(gRows || []);
      } catch (e) {
        toast({ title: 'Détail élève', description: e?.message || 'Erreur', variant: 'destructive' });
      } finally {
        setLoadingDetail(false);
      }
    },
    [toast]
  );

  useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  useEffect(() => {
    if (selected) loadDetail(selected);
  }, [selected, loadDetail]);

  const planSlug = selected?.plan_id || '';
  const offer = useMemo(() => getNgowazuluMentoratOffer(planSlug), [planSlug]);
  const defaultQuota = useMemo(() => getSessionsQuotaForSlug(planSlug) || 4, [planSlug]);

  const activeContract = useMemo(() => {
    const now = Date.now();
    return (contracts || []).find((c) => {
      const a = new Date(c.period_start).getTime();
      const b = new Date(c.period_end).getTime();
      return now >= a && now < b;
    });
  }, [contracts]);

  const usedInContract = useMemo(() => {
    if (!activeContract) return 0;
    return countSessionsInContractPeriod(sessions, activeContract.period_start, activeContract.period_end);
  }, [sessions, activeContract]);

  const usedThisMonth = useMemo(() => countSessionsInCalendarMonth(sessions), [sessions]);

  const remainingInPeriod = useMemo(() => {
    const q = activeContract?.sessions_quota;
    if (q == null || q < 0) return null;
    return Math.max(0, q - usedInContract);
  }, [activeContract, usedInContract]);

  const previewConflicts = useCallback(async () => {
    const startIso = fromDatetimeLocalValue(sessionStartLocal);
    if (!startIso) {
      toast({ title: 'Date requise', variant: 'destructive' });
      return;
    }
    const endIso = addMinutesToIso(startIso, sessionDurationMin);
    try {
      const hits = await fetchNgowazuluSessionConflicts(supabase, { startIso, endIso });
      setPendingConflicts(hits);
      if (hits.length) {
        toast({
          title: 'Créneau déjà occupé',
          description: `${hits.length} séance(s) chevauchent ce créneau (tous clients).`,
          variant: 'destructive',
        });
      } else {
        toast({ title: 'Créneau libre', description: 'Aucun chevauchement détecté.' });
      }
    } catch (e) {
      toast({ title: 'Vérification impossible', description: e?.message, variant: 'destructive' });
    }
  }, [sessionStartLocal, sessionDurationMin, toast]);

  const saveContract = async () => {
    if (!selected?.user_id || !planSlug) return;
    setSavingContract(true);
    try {
      const start = new Date();
      start.setUTCHours(12, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + Number(periodDays || 30));
      const quota = defaultQuota;
      const payload = {
        student_id: selected.user_id,
        subscription_id: selected.id,
        plan_slug: planSlug,
        period_start: start.toISOString(),
        period_end: end.toISOString(),
        week1_starts_on: week1,
        sessions_quota: quota,
        notes: contractNotes.trim() || null,
      };
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData?.user?.id;
      if (uid) payload.created_by = uid;

      const { error } = await supabase.from('ngowazulu_mentorat_contracts').insert(payload);
      if (error) throw error;
      toast({ title: 'Contrat enregistré', description: 'Période et quota posés pour cet élève.' });
      await loadDetail(selected);
    } catch (e) {
      toast({ title: 'Erreur contrat', description: e?.message, variant: 'destructive' });
    } finally {
      setSavingContract(false);
    }
  };

  const saveSession = async () => {
    if (!selected?.user_id) return;
    const startIso = fromDatetimeLocalValue(sessionStartLocal);
    if (!startIso) {
      toast({ title: 'Heure de début requise', variant: 'destructive' });
      return;
    }
    const endIso = addMinutesToIso(startIso, sessionDurationMin);
    if (!endIso) return;
    setSavingSession(true);
    try {
      const hits = await fetchNgowazuluSessionConflicts(supabase, { startIso, endIso });
      if (hits.length) {
        setPendingConflicts(hits);
        throw new Error('Créneau occupé : ajustez l\'horaire ou vérifiez le calendrier global.');
      }
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData?.user?.id;
      const row = {
        contract_id: activeContract?.id || null,
        student_id: selected.user_id,
        organizer_id: uid || null,
        session_type: sessionType,
        title: sessionTitle.trim() || NGOWAZULU_SESSION_TYPE_LABELS[sessionType] || 'Séance',
        scheduled_start: startIso,
        scheduled_end: endIso,
        status: 'planned',
      };
      const { error } = await supabase.from('ngowazulu_mentorat_sessions').insert(row);
      if (error) throw error;
      toast({ title: 'Atelier / séance créé' });
      setSessionTitle('');
      setPendingConflicts([]);
      await loadDetail(selected);
      await loadStudents();
    } catch (e) {
      toast({ title: 'Création impossible', description: e?.message, variant: 'destructive' });
    } finally {
      setSavingSession(false);
    }
  };

  const markDone = async (id) => {
    const { error } = await supabase.from('ngowazulu_mentorat_sessions').update({ status: 'completed' }).eq('id', id);
    if (error) {
      toast({ title: 'Mise à jour impossible', description: error.message, variant: 'destructive' });
      return;
    }
    if (selected) loadDetail(selected);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white font-serif flex items-center gap-2">
            <Flame className="w-7 h-7 text-[#D4AF37]" />
            Ngowazulu — Ateliers & mentorat
          </h2>
          <p className="text-sm text-gray-400 mt-1 max-w-2xl">
            Gestion par élève : contrat (quota, début de la 1ʳᵉ semaine), création d&apos;ateliers IRI, prière ou rencontres mentorat.
            Les créneaux déjà pris (tous clients) sont signalés avant enregistrement.
          </p>
        </div>
        <Button variant="outline" className="border-white/15 text-gray-200" onClick={() => loadStudents()} disabled={loadingList}>
          {loadingList ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          Actualiser la liste
        </Button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card className="premium-panel border-white/10 xl:col-span-1">
          <CardHeader>
            <CardTitle className="text-white text-base flex items-center gap-2">
              <Users className="w-4 h-4 text-[#D4AF37]" />
              Clients mentorat actifs
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-[480px] overflow-y-auto">
            {loadingList ? (
              <div className="flex justify-center py-8 text-gray-400">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : students.length === 0 ? (
              <p className="text-sm text-gray-500">Aucun abonnement ngowazulu-mentorat actif pour le moment.</p>
            ) : (
              students.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSelected(s)}
                  className={`w-full text-left rounded-xl border p-3 transition-colors ${
                    selected?.id === s.id ? 'border-[#D4AF37] bg-[#D4AF37]/10' : 'border-white/10 bg-black/20 hover:border-white/20'
                  }`}
                >
                  <p className="text-white font-medium text-sm">{s.profile?.name || s.profile?.email || s.user_id}</p>
                  <p className="text-xs text-gray-500">{s.plan_id}</p>
                  <Badge className="mt-1 text-[10px] bg-white/10 text-gray-300">{s.status}</Badge>
                </button>
              ))
            )}
          </CardContent>
        </Card>

        <div className="xl:col-span-2 space-y-6">
          {!selected ? (
            <Card className="premium-panel border-white/10">
              <CardContent className="p-8 text-center text-gray-500 text-sm">Sélectionnez un client dans la liste.</CardContent>
            </Card>
          ) : loadingDetail ? (
            <div className="flex justify-center py-16 text-gray-400">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
          ) : (
            <>
              <Card className="premium-panel border-[#D4AF37]/25">
                <CardHeader>
                  <CardTitle className="text-white text-lg">
                    {selected.profile?.name || selected.profile?.email} —{' '}
                    <span className="text-[#D4AF37]">{offer?.commercialName || planSlug}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                  <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                    <p className="text-gray-500 text-xs uppercase">Quota période en cours</p>
                    <p className="text-white text-xl font-bold mt-1">
                      {usedInContract} / {activeContract?.sessions_quota ?? '—'}
                    </p>
                    <p className="text-[#D4AF37] text-sm font-semibold mt-1">
                      Restant : {remainingInPeriod != null ? remainingInPeriod : '—'}
                    </p>
                    <p className="text-gray-500 text-xs mt-1">Rencontres non annulées sur la période du contrat actif</p>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                    <p className="text-gray-500 text-xs uppercase">Mois calendaire en cours</p>
                    <p className="text-white text-xl font-bold mt-1">{usedThisMonth}</p>
                    <p className="text-gray-500 text-xs mt-1">Séances (tous types) ce mois-ci pour ce client</p>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                    <p className="text-gray-500 text-xs uppercase">1ʳᵉ semaine (planification)</p>
                    <p className="text-[#D4AF37] font-semibold mt-1">{activeContract?.week1_starts_on || '—'}</p>
                    <p className="text-gray-500 text-xs mt-1">Ancrage pour organiser les rencontres</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="premium-panel border-white/10">
                <CardHeader>
                  <CardTitle className="text-white text-base flex items-center gap-2">
                    <CalendarClock className="w-4 h-4 text-emerald-400" />
                    Nouveau contrat / période
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-2">
                      <Label className="text-gray-400">Début de la 1ʳᵉ semaine</Label>
                      <Input type="date" value={week1} onChange={(e) => setWeek1(e.target.value)} className="bg-[#0F1419] border-white/10" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-gray-400">Durée période (jours)</Label>
                      <Input
                        type="number"
                        min={7}
                        max={120}
                        value={periodDays}
                        onChange={(e) => setPeriodDays(Number(e.target.value))}
                        className="bg-[#0F1419] border-white/10"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-gray-400">Quota (auto depuis contrat)</Label>
                      <Input readOnly value={defaultQuota} className="bg-black/30 border-white/10 text-gray-300" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-gray-400">Notes internes</Label>
                    <Input value={contractNotes} onChange={(e) => setContractNotes(e.target.value)} className="bg-[#0F1419] border-white/10" placeholder="Optionnel" />
                  </div>
                  <Button onClick={saveContract} disabled={savingContract} className="bg-[#D4AF37] text-black font-bold">
                    {savingContract ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                    Enregistrer la période
                  </Button>
                </CardContent>
              </Card>

              <Card className="premium-panel border-white/10">
                <CardHeader>
                  <CardTitle className="text-white text-base flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-violet-400" />
                    Créer un atelier / séance
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="text-gray-400">Type</Label>
                      <select
                        value={sessionType}
                        onChange={(e) => setSessionType(e.target.value)}
                        className="h-10 w-full rounded-md bg-[#0F1419] border border-white/10 px-3 text-white"
                      >
                        {Object.entries(NGOWAZULU_SESSION_TYPE_LABELS).map(([k, v]) => (
                          <option key={k} value={k}>
                            {v}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-gray-400">Titre</Label>
                      <Input
                        value={sessionTitle}
                        onChange={(e) => setSessionTitle(e.target.value)}
                        className="bg-[#0F1419] border-white/10"
                        placeholder="Ex. IRI — protection / Prière guidée"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-2 sm:col-span-2">
                      <Label className="text-gray-400">Début</Label>
                      <Input
                        type="datetime-local"
                        value={sessionStartLocal}
                        onChange={(e) => setSessionStartLocal(e.target.value)}
                        className="bg-[#0F1419] border-white/10"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-gray-400">Durée (min)</Label>
                      <Input
                        type="number"
                        min={15}
                        max={480}
                        step={15}
                        value={sessionDurationMin}
                        onChange={(e) => setSessionDurationMin(Number(e.target.value))}
                        className="bg-[#0F1419] border-white/10"
                      />
                    </div>
                  </div>
                  {pendingConflicts.length > 0 ? (
                    <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-100 flex gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-amber-200">Créneaux qui chevauchent</p>
                        <ul className="mt-1 space-y-1">
                          {pendingConflicts.slice(0, 6).map((c) => (
                            <li key={c.id}>
                              {new Date(c.scheduled_start).toLocaleString('fr-FR')} — {c.title}{' '}
                              <span className="text-gray-400">({NGOWAZULU_SESSION_TYPE_LABELS[c.session_type] || c.session_type})</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" className="border-white/15" onClick={previewConflicts}>
                      Vérifier le créneau
                    </Button>
                    <Button onClick={saveSession} disabled={savingSession} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold">
                      {savingSession ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                      Enregistrer la séance
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="premium-panel border-white/10">
                <CardHeader>
                  <CardTitle className="text-white text-base">Séances planifiées (élève sélectionné)</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 max-h-64 overflow-y-auto text-sm">
                  {(sessions || []).length === 0 ? (
                    <p className="text-gray-500">Aucune séance enregistrée.</p>
                  ) : (
                    sessions.map((s) => (
                      <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 border border-white/5 rounded-lg p-2">
                        <div>
                          <p className="text-white font-medium">{s.title}</p>
                          <p className="text-xs text-gray-500">
                            {new Date(s.scheduled_start).toLocaleString('fr-FR')} → {new Date(s.scheduled_end).toLocaleString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                          <Badge className="mt-1 text-[10px] bg-white/10">{NGOWAZULU_SESSION_TYPE_LABELS[s.session_type] || s.session_type}</Badge>
                        </div>
                        <div className="flex gap-2">
                          <Badge className={s.status === 'completed' ? 'bg-green-500/20 text-green-300' : 'bg-amber-500/20 text-amber-200'}>{s.status}</Badge>
                          {s.status === 'planned' ? (
                            <Button size="sm" variant="outline" className="h-8 border-white/15" onClick={() => markDone(s.id)}>
                              Terminé
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              <Card className="premium-panel border-white/10">
                <CardHeader>
                  <CardTitle className="text-white text-base">Créneaux occupés — mois en cours (tous clients)</CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-gray-400 max-h-48 overflow-y-auto space-y-1">
                  {(globalMonthSessions || []).length === 0 ? (
                    <p>Aucune séance ce mois-ci.</p>
                  ) : (
                    globalMonthSessions.map((s) => (
                      <div key={s.id} className="border-b border-white/5 py-1">
                        {new Date(s.scheduled_start).toLocaleString('fr-FR')} — {s.title}{' '}
                        <span className="text-gray-600">({s.student_id?.slice(0, 8)}…)</span>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
