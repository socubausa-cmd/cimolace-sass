import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Flame, HeartPulse, Hand, MapPinned, Plus, RefreshCw, ScrollText, Activity, CalendarClock,
} from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/hooks/useAuth';

function SectionHeader({ icon: Icon, title }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="w-4 h-4 text-[#D4AF37]" />
      <h3 className="text-sm font-semibold text-white">{title}</h3>
    </div>
  );
}

export default function NgowazuluOperationsPanel() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [cults, setCults] = useState([]);
  const [cases, setCases] = useState([]);
  const [travels, setTravels] = useState([]);
  const [rules, setRules] = useState([]);
  const [ngowStaff, setNgowStaff] = useState([]);
  const [travelRegs, setTravelRegs] = useState([]); // Inscriptions voyages
  const [selectedTravelId, setSelectedTravelId] = useState('');
  const [updatingRegId, setUpdatingRegId] = useState('');
  const [caseEvents, setCaseEvents] = useState([]);
  const [selectedCaseId, setSelectedCaseId] = useState('');
  const [newCaseEvent, setNewCaseEvent] = useState({ event_type: 'note', content: '' });
  const [kpiSplit, setKpiSplit] = useState({
    bookingNgowazuluOpen: 0,
    bookingProrascienceOpen: 0,
    membersNgowazulu: 0,
    membersIsna: 0,
  });
  const [caseFilterStatus, setCaseFilterStatus] = useState('all');
  const [caseFilterSeverity, setCaseFilterSeverity] = useState('all');
  const [caseFilterMine, setCaseFilterMine] = useState(false);
  const [caseSearch, setCaseSearch] = useState('');

  const [newCult, setNewCult] = useState({ title: '', service_day: 'sunday', starts_at: '' });
  const [newCase, setNewCase] = useState({ title: '', case_type: 'consultation', patient_id: '', summary: '' });
  const [newTravel, setNewTravel] = useState({ title: '', starts_at: '', location: '' });
  const [newRule, setNewRule] = useState({ code: '', title: '', body: '' });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [
        { data: cultRows },
        { data: caseRows },
        { data: travelRows },
        { data: ruleRows },
        { count: bookingNgowazuluOpen },
        { count: bookingProrascienceOpen },
        { data: staffRowsByFlag },
        { data: staffRowsByRole },
        { data: activeSubs },
      ] = await Promise.all([
        supabase.from('ngowazulu_cults').select('id,title,service_day,starts_at,status').order('starts_at', { ascending: true }).limit(20),
        supabase.from('ngowazulu_case_files').select('id,title,case_type,status,severity,opened_at,patient_id,assigned_staff_id').order('opened_at', { ascending: false }).limit(20),
        supabase.from('ngowazulu_initiatory_travels').select('id,title,location,status,starts_at,seats_total,seats_taken').order('starts_at', { ascending: true }).limit(20),
        supabase.from('ngowazulu_community_rules').select('id,code,title,required,active,published_at').order('published_at', { ascending: false }).limit(20),
        supabase
          .from('appointment_requests')
          .select('id', { count: 'exact', head: true })
          .eq('booking_channel', 'ngowazulu')
          .in('status', ['pending', 'confirmed']),
        supabase
          .from('appointment_requests')
          .select('id', { count: 'exact', head: true })
          .eq('booking_channel', 'prorascience')
          .in('status', ['pending', 'confirmed']),
        supabase
          .from('profiles')
          .select('id,name,email,role')
          .eq('is_ngowazulu_secretariat_active', true),
        supabase
          .from('profiles')
          .select('id,name,email,role')
          .in('role', ['admin', 'owner']),
        supabase
          .from('billing_subscriptions')
          .select('id,status,billing_plans(slug)')
          .in('status', ['active', 'past_due', 'pending'])
          .limit(500),
      ]);
      setCults(cultRows || []);
      setCases(caseRows || []);
      setTravels(travelRows || []);      setRules(ruleRows || []);
      const mergedStaff = [...(staffRowsByFlag || []), ...(staffRowsByRole || [])];
      const uniqStaff = mergedStaff.filter((row, idx, arr) => arr.findIndex((x) => x.id === row.id) === idx);
      setNgowStaff(uniqStaff);
      const subs = activeSubs || [];
      const membersNgowazulu = subs.filter((s) => String(s?.billing_plans?.slug || '').startsWith('ngowazulu-')).length;
      const membersIsna = subs.filter((s) => !String(s?.billing_plans?.slug || '').startsWith('ngowazulu-')).length;
      setKpiSplit({
        bookingNgowazuluOpen: Number(bookingNgowazuluOpen || 0),
        bookingProrascienceOpen: Number(bookingProrascienceOpen || 0),
        membersNgowazulu,
        membersIsna,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const stats = useMemo(() => {
    const openedCases = cases.filter((x) => x.status !== 'closed').length;
    const upcomingCults = cults.filter((x) => x.status === 'scheduled').length;
    const activeTravels = travels.filter((x) => x.status === 'open' || x.status === 'planned').length;
    return { openedCases, upcomingCults, activeTravels, rules: rules.length };
  }, [cases, cults, travels, rules]);

  const selectedCase = useMemo(
    () => cases.find((c) => c.id === selectedCaseId) || null,
    [cases, selectedCaseId]
  );

  const staffById = useMemo(
    () => Object.fromEntries(ngowStaff.map((row) => [row.id, row])),
    [ngowStaff]
  );

  const getSlaState = (row) => {
    const severity = String(row?.severity || 'medium').toLowerCase();
    const openedAt = row?.opened_at ? new Date(row.opened_at) : null;
    if (!openedAt || Number.isNaN(openedAt.getTime())) return { tone: 'text-gray-400', label: 'SLA n/a' };
    const elapsedHours = (Date.now() - openedAt.getTime()) / (1000 * 60 * 60);
    const slaHours = severity === 'critical' ? 6 : severity === 'high' ? 24 : severity === 'medium' ? 72 : 120;
    if (elapsedHours >= slaHours) return { tone: 'text-red-300', label: `SLA dépassée (${Math.round(elapsedHours)}h)` };
    if (elapsedHours >= slaHours * 0.75) return { tone: 'text-amber-300', label: `SLA proche (${Math.round(elapsedHours)}h)` };
    return { tone: 'text-emerald-300', label: `SLA ok (${Math.round(elapsedHours)}h)` };
  };

  const getSlaMeta = (row) => {
    const severity = String(row?.severity || 'medium').toLowerCase();
    const openedAt = row?.opened_at ? new Date(row.opened_at) : null;
    if (!openedAt || Number.isNaN(openedAt.getTime())) {
      return { elapsedHours: 0, slaHours: Infinity, state: 'na' };
    }
    const elapsedHours = (Date.now() - openedAt.getTime()) / (1000 * 60 * 60);
    const slaHours = severity === 'critical' ? 6 : severity === 'high' ? 24 : severity === 'medium' ? 72 : 120;
    if (elapsedHours >= slaHours) return { elapsedHours, slaHours, state: 'overdue' };
    if (elapsedHours >= slaHours * 0.75) return { elapsedHours, slaHours, state: 'warning' };
    return { elapsedHours, slaHours, state: 'ok' };
  };

  const staffInboxCases = useMemo(() => {
    const term = caseSearch.trim().toLowerCase();
    return cases
      .filter((row) => row.status !== 'closed')
      .filter((row) => (caseFilterStatus === 'all' ? true : row.status === caseFilterStatus))
      .filter((row) => (caseFilterSeverity === 'all' ? true : row.severity === caseFilterSeverity))
      .filter((row) => (caseFilterMine ? row.assigned_staff_id === user?.id : true))
      .filter((row) => {
        if (!term) return true;
        const staffName = staffById[row.assigned_staff_id]?.name || '';
        return `${row.title} ${row.case_type} ${row.patient_id} ${staffName}`.toLowerCase().includes(term);
      })
      .sort((a, b) => {
        const rank = { critical: 4, high: 3, medium: 2, low: 1 };
        const rA = rank[String(a.severity || 'medium')] || 2;
        const rB = rank[String(b.severity || 'medium')] || 2;
        if (rA !== rB) return rB - rA;
        return new Date(a.opened_at).getTime() - new Date(b.opened_at).getTime();
      });
  }, [caseFilterMine, caseFilterSeverity, caseFilterStatus, caseSearch, cases, staffById, user?.id]);

  const openCases = useMemo(
    () => cases.filter((row) => row.status !== 'closed'),
    [cases]
  );

  const slaSummary = useMemo(() => {
    const rows = openCases.map((row) => ({ row, meta: getSlaMeta(row) }));
    const overdue = rows.filter((x) => x.meta.state === 'overdue').length;
    const warning = rows.filter((x) => x.meta.state === 'warning').length;
    const ok = rows.filter((x) => x.meta.state === 'ok').length;
    const criticalUnassigned = openCases.filter(
      (x) => String(x.severity || '').toLowerCase() === 'critical' && !x.assigned_staff_id
    ).length;
    return {
      total: openCases.length,
      overdue,
      warning,
      ok,
      criticalUnassigned,
      overdueRate: openCases.length > 0 ? Math.round((overdue / openCases.length) * 100) : 0,
    };
  }, [openCases]);

  const staffSlaRows = useMemo(() => {
    const grouped = {};
    openCases.forEach((row) => {
      const key = row.assigned_staff_id || '__unassigned__';
      if (!grouped[key]) {
        grouped[key] = {
          staffId: row.assigned_staff_id || null,
          name: row.assigned_staff_id ? (staffById[row.assigned_staff_id]?.name || row.assigned_staff_id) : 'Non assigné',
          open: 0,
          overdue: 0,
          warning: 0,
          critical: 0,
        };
      }
      grouped[key].open += 1;
      if (String(row.severity || '').toLowerCase() === 'critical') grouped[key].critical += 1;
      const meta = getSlaMeta(row);
      if (meta.state === 'overdue') grouped[key].overdue += 1;
      if (meta.state === 'warning') grouped[key].warning += 1;
    });
    return Object.values(grouped).sort((a, b) => {
      if (b.overdue !== a.overdue) return b.overdue - a.overdue;
      if (b.critical !== a.critical) return b.critical - a.critical;
      return b.open - a.open;
    });
  }, [openCases, staffById]);

  const loadCaseEvents = useCallback(async (caseId) => {
    if (!caseId) {
      setCaseEvents([]);
      return;
    }
    const { data } = await supabase
      .from('ngowazulu_case_events')
      .select('id,event_type,content,scheduled_at,created_at,performed_by')
      .eq('case_id', caseId)
      .order('created_at', { ascending: false })
      .limit(50);
    setCaseEvents(data || []);
  }, []);

  useEffect(() => {
    if (!selectedCaseId) {
      setCaseEvents([]);
      return;
    }
    loadCaseEvents(selectedCaseId);
  }, [loadCaseEvents, selectedCaseId]);

  const createCult = async () => {
    if (!newCult.title || !newCult.starts_at) return;
    const { error } = await supabase.from('ngowazulu_cults').insert({
      title: newCult.title.trim(),
      service_day: newCult.service_day,
      starts_at: new Date(newCult.starts_at).toISOString(),
      status: 'scheduled',
      visibility: 'members_only',
    });
    if (error) {
      toast({ title: 'Erreur culte', description: error.message, variant: 'destructive' });
      return;
    }
    setNewCult({ title: '', service_day: 'sunday', starts_at: '' });
    toast({ title: 'Culte créé', description: 'Le culte a été ajouté au calendrier.' });
    loadData();
  };

  const createCase = async () => {
    if (!newCase.title || !newCase.patient_id) return;
    const { error } = await supabase.from('ngowazulu_case_files').insert({
      title: newCase.title.trim(),
      case_type: newCase.case_type,
      patient_id: newCase.patient_id.trim(),
      summary: newCase.summary || null,
      status: 'opened',
      severity: 'medium',
    });
    if (error) {
      toast({ title: 'Erreur dossier', description: error.message, variant: 'destructive' });
      return;
    }
    setNewCase({ title: '', case_type: 'consultation', patient_id: '', summary: '' });
    toast({ title: 'Dossier créé', description: 'Le dossier patient a été créé.' });
    loadData();
  };

  const createTravel = async () => {
    if (!newTravel.title || !newTravel.starts_at) return;
    const { error } = await supabase.from('ngowazulu_initiatory_travels').insert({
      title: newTravel.title.trim(),
      location: newTravel.location || null,
      starts_at: new Date(newTravel.starts_at).toISOString(),
      status: 'planned',
      visibility: 'members_only',
    });
    if (error) {
      toast({ title: 'Erreur voyage', description: error.message, variant: 'destructive' });
      return;
    }
    setNewTravel({ title: '', starts_at: '', location: '' });
    toast({ title: 'Voyage créé', description: 'Le voyage initiatique a été planifié.' });
    loadData();
  };

  const createRule = async () => {
    if (!newRule.code || !newRule.title || !newRule.body) return;
    const { error } = await supabase.from('ngowazulu_community_rules').insert({
      code: newRule.code.trim().toLowerCase(),
      title: newRule.title.trim(),
      body: newRule.body.trim(),
      required: true,
      active: true,
      version: 1,
    });
    if (error) {
      toast({ title: 'Erreur règlement', description: error.message, variant: 'destructive' });
      return;
    }
    setNewRule({ code: '', title: '', body: '' });
    toast({ title: 'Règle ajoutée', description: 'Le règlement communautaire a été mis à jour.' });
    loadData();
  };

  const updateCaseStatus = async (caseId, nextStatus) => {
    const payload = { status: nextStatus };
    if (nextStatus === 'closed') payload.closed_at = new Date().toISOString();
    const { error } = await supabase.from('ngowazulu_case_files').update(payload).eq('id', caseId);
    if (error) {
      toast({ title: 'Erreur statut', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Statut mis à jour', description: `Dossier passé en ${nextStatus}.` });
    loadData();
  };

  const assignCase = async (caseId, staffId) => {
    const { error } = await supabase
      .from('ngowazulu_case_files')
      .update({ assigned_staff_id: staffId || null })
      .eq('id', caseId);
    if (error) {
      toast({ title: 'Erreur affectation', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Affectation enregistrée', description: 'Le dossier a été réaffecté.' });
    loadData();
  };

  const assignCaseToMe = async (caseId) => {
    if (!user?.id) return;
    await assignCase(caseId, user.id);
  };

  const assignOldestCriticalToMe = async () => {
    if (!user?.id) return;
    const oldestCriticalUnassigned = openCases
      .filter((row) => String(row.severity || '').toLowerCase() === 'critical' && !row.assigned_staff_id)
      .sort((a, b) => new Date(a.opened_at).getTime() - new Date(b.opened_at).getTime())[0];
    if (!oldestCriticalUnassigned?.id) {
      toast({ title: 'Rien à assigner', description: 'Aucun dossier critique non assigné.' });
      return;
    }
    await assignCase(oldestCriticalUnassigned.id, user.id);
  };

  const assignBatchToMe = async () => {
    if (!user?.id) return;
    const batch = openCases
      .filter((row) => !row.assigned_staff_id)
      .sort((a, b) => {
        const rank = { critical: 4, high: 3, medium: 2, low: 1 };
        const rA = rank[String(a.severity || 'medium')] || 2;
        const rB = rank[String(b.severity || 'medium')] || 2;
        if (rA !== rB) return rB - rA;
        return new Date(a.opened_at).getTime() - new Date(b.opened_at).getTime();
      })
      .slice(0, 5)
      .map((row) => row.id);
    if (batch.length === 0) {
      toast({ title: 'Rien à assigner', description: 'Aucun dossier non assigné.' });
      return;
    }
    const { error } = await supabase
      .from('ngowazulu_case_files')
      .update({ assigned_staff_id: user.id })
      .in('id', batch);
    if (error) {
      toast({ title: 'Erreur assignation', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Assignation en lot', description: `${batch.length} dossier(s) assigné(s) à vous.` });
    loadData();
  };

  const addCaseEvent = async () => {
    if (!selectedCaseId || !newCaseEvent.content.trim()) return;
    const { error } = await supabase.from('ngowazulu_case_events').insert({
      case_id: selectedCaseId,
      event_type: newCaseEvent.event_type,
      content: newCaseEvent.content.trim(),
    });
    if (error) {
      toast({ title: 'Erreur timeline', description: error.message, variant: 'destructive' });
      return;
    }
    setNewCaseEvent({ event_type: 'note', content: '' });
    toast({ title: 'Événement ajouté', description: 'La timeline du dossier a été mise à jour.' });
    loadCaseEvents(selectedCaseId);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white">Opérations Temple Ngowazulu</h2>
          <p className="text-xs text-gray-500">Pilotage dédié : cultes, cas, interventions, voyages, règlement.</p>
        </div>
        <Button onClick={loadData} variant="outline" className="border-white/15 text-white hover:bg-white/5" disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Actualiser
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Dossiers actifs', value: stats.openedCases, icon: HeartPulse },
          { label: 'Cultes planifiés', value: stats.upcomingCults, icon: Flame },
          { label: 'Voyages ouverts', value: stats.activeTravels, icon: MapPinned },
          { label: 'Règles publiées', value: stats.rules, icon: ScrollText },
        ].map((s) => (
          <Card key={s.label} className="bg-[#151a21] border-white/10">
            <CardContent className="p-4 flex items-center gap-3">
              <s.icon className="w-5 h-5 text-[#D4AF37]" />
              <div>
                <p className="text-xs text-gray-400">{s.label}</p>
                <p className="text-xl font-bold text-white">{s.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className={`border ${slaSummary.overdue > 0 ? 'border-red-500/30 bg-red-500/10' : 'border-emerald-500/30 bg-emerald-500/10'}`}>
        <CardContent className="p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-white">Pilotage SLA global Ngowazulu</p>
            <p className="text-xs text-gray-300">
              {slaSummary.total} dossier(s) ouverts · {slaSummary.overdue} hors SLA · {slaSummary.warning} proches SLA · {slaSummary.overdueRate}% de retard.
            </p>
            {slaSummary.criticalUnassigned > 0 ? (
              <p className="text-xs text-red-200">
                {slaSummary.criticalUnassigned} dossier(s) critique(s) non assigné(s).
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              className="border-white/20 text-white hover:bg-white/10"
              onClick={assignOldestCriticalToMe}
            >
              Assigner 1 critique à moi
            </Button>
            <Button className="bg-[#D4AF37] text-black hover:bg-amber-500" onClick={assignBatchToMe}>
              Assigner 5 dossiers à moi
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Booking Ngowazulu (open)', value: kpiSplit.bookingNgowazuluOpen, icon: CalendarClock },
          { label: 'Booking Prorascience (open)', value: kpiSplit.bookingProrascienceOpen, icon: CalendarClock },
          { label: 'Membres Ngowazulu', value: kpiSplit.membersNgowazulu, icon: Activity },
          { label: 'Membres ISNA', value: kpiSplit.membersIsna, icon: Activity },
        ].map((s) => (
          <Card key={s.label} className="bg-[#101721] border-white/10">
            <CardContent className="p-4 flex items-center gap-3">
              <s.icon className="w-5 h-5 text-[#D4AF37]" />
              <div>
                <p className="text-[11px] text-gray-400">{s.label}</p>
                <p className="text-xl font-bold text-white">{s.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="bg-[#151a21] border-white/10">
        <CardHeader>
          <CardTitle><SectionHeader icon={Activity} title="File de traitement Ngowazulu (staff inbox)" /></CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
            <Input
              value={caseSearch}
              onChange={(e) => setCaseSearch(e.target.value)}
              placeholder="Recherche dossier..."
              className="bg-[#0f1419] border-white/10 md:col-span-2"
            />
            <select
              value={caseFilterStatus}
              onChange={(e) => setCaseFilterStatus(e.target.value)}
              className="h-10 rounded-md bg-[#0f1419] border border-white/10 px-3 text-xs text-white"
            >
              <option value="all">Tous statuts</option>
              <option value="opened">opened</option>
              <option value="in_treatment">in_treatment</option>
              <option value="stabilized">stabilized</option>
            </select>
            <select
              value={caseFilterSeverity}
              onChange={(e) => setCaseFilterSeverity(e.target.value)}
              className="h-10 rounded-md bg-[#0f1419] border border-white/10 px-3 text-xs text-white"
            >
              <option value="all">Toutes gravités</option>
              <option value="critical">critical</option>
              <option value="high">high</option>
              <option value="medium">medium</option>
              <option value="low">low</option>
            </select>
            <label className="h-10 rounded-md bg-[#0f1419] border border-white/10 px-3 text-xs text-white flex items-center gap-2">
              <input type="checkbox" checked={caseFilterMine} onChange={(e) => setCaseFilterMine(e.target.checked)} />
              Assignés à moi
            </label>
          </div>

          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {staffInboxCases.length > 0 ? (
              staffInboxCases.map((row) => {
                const sla = getSlaState(row);
                const staff = row.assigned_staff_id ? (staffById[row.assigned_staff_id]?.name || row.assigned_staff_id) : 'Non assigné';
                return (
                  <div key={row.id} className="rounded-lg border border-white/10 bg-black/20 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <button
                        type="button"
                        className="text-left text-sm font-semibold text-white hover:text-[#D4AF37]"
                        onClick={() => setSelectedCaseId(row.id)}
                      >
                        {row.title}
                      </button>
                      <span className={`text-[10px] uppercase ${sla.tone}`}>{sla.label}</span>
                    </div>
                    <p className="text-[11px] text-gray-400 mt-1">
                      {row.case_type} · {row.severity} · {row.status} · Staff: {staff}
                    </p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-white/15 text-white hover:bg-white/5"
                        onClick={() => setSelectedCaseId(row.id)}
                      >
                        Ouvrir timeline
                      </Button>
                      <Button
                        size="sm"
                        className="bg-[#D4AF37] text-black hover:bg-amber-500"
                        onClick={() => assignCaseToMe(row.id)}
                      >
                        M'assigner
                      </Button>
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-xs text-gray-500">Aucun dossier dans la file selon les filtres.</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-[#151a21] border-white/10">
        <CardHeader>
          <CardTitle><SectionHeader icon={Activity} title="Scoreboard SLA par staff" /></CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {staffSlaRows.length > 0 ? (
            staffSlaRows.map((row) => (
              <div key={row.staffId || 'unassigned'} className="rounded-lg border border-white/10 bg-black/20 p-3 text-xs text-gray-300">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-white">{row.name}</span>
                  <span className={row.overdue > 0 ? 'text-red-300' : 'text-emerald-300'}>
                    Hors SLA: {row.overdue}
                  </span>
                </div>
                <p className="text-gray-400 mt-1">
                  Ouverts: {row.open} · Proches SLA: {row.warning} · Critiques: {row.critical}
                </p>
              </div>
            ))
          ) : (
            <p className="text-xs text-gray-500">Aucune donnée staff pour le moment.</p>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card className="bg-[#151a21] border-white/10">
          <CardHeader>
            <CardTitle><SectionHeader icon={Flame} title="Cultes en ligne" /></CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {cults.slice(0, 6).map((c) => (
              <div key={c.id} className="text-xs text-gray-300 flex justify-between border-b border-white/5 pb-2 last:border-b-0">
                <span>{c.title}</span>
                <span className="text-[#D4AF37]">{new Date(c.starts_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}</span>
              </div>
            ))}
            <div className="pt-2 grid grid-cols-1 md:grid-cols-3 gap-2">
              <Input value={newCult.title} onChange={(e) => setNewCult((p) => ({ ...p, title: e.target.value }))} placeholder="Titre culte" className="bg-[#0f1419] border-white/10" />
              <Input type="datetime-local" value={newCult.starts_at} onChange={(e) => setNewCult((p) => ({ ...p, starts_at: e.target.value }))} className="bg-[#0f1419] border-white/10" />
              <Button onClick={createCult} className="bg-[#D4AF37] text-black hover:bg-amber-500"><Plus className="w-4 h-4 mr-1" />Ajouter</Button>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#151a21] border-white/10">
          <CardHeader>
            <CardTitle><SectionHeader icon={HeartPulse} title="Dossiers patients" /></CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {cases.slice(0, 6).map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedCaseId(c.id)}
                className={`w-full text-xs text-gray-300 flex justify-between border-b border-white/5 pb-2 last:border-b-0 text-left ${
                  selectedCaseId === c.id ? 'text-[#D4AF37]' : ''
                }`}
              >
                <span>{c.title}</span>
                <span className="uppercase">{c.case_type} · {c.status}</span>
              </button>
            ))}
            <div className="pt-2 space-y-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <Input value={newCase.title} onChange={(e) => setNewCase((p) => ({ ...p, title: e.target.value }))} placeholder="Titre dossier" className="bg-[#0f1419] border-white/10" />
                <Input value={newCase.patient_id} onChange={(e) => setNewCase((p) => ({ ...p, patient_id: e.target.value }))} placeholder="UUID patient" className="bg-[#0f1419] border-white/10" />
              </div>
              <Textarea value={newCase.summary} onChange={(e) => setNewCase((p) => ({ ...p, summary: e.target.value }))} placeholder="Résumé initial" className="bg-[#0f1419] border-white/10 min-h-[70px]" />
              <Button onClick={createCase} className="bg-[#D4AF37] text-black hover:bg-amber-500"><Plus className="w-4 h-4 mr-1" />Créer dossier</Button>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#151a21] border-white/10">
          <CardHeader>
            <CardTitle><SectionHeader icon={MapPinned} title="Voyages initiatiques" /></CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {travels.slice(0, 6).map((t) => {
              const pendingCount = travelRegs.filter((r) => r.travel_id === t.id && r.status === 'pending').length;
              return (
                <div key={t.id} className="text-xs text-gray-300 flex justify-between items-center border-b border-white/5 pb-2 last:border-b-0">
                  <div>
                    <span className="text-white">{t.title}</span>
                    {t.seats_total !== null && (
                      <span className="ml-2 text-gray-500">{t.seats_taken}/{t.seats_total} places</span>
                    )}
                    {pendingCount > 0 && (
                      <span className="ml-2 inline-flex items-center h-4 px-1.5 rounded-full bg-amber-500/15 border border-amber-500/25 text-amber-300 text-[10px]">
                        {pendingCount} demande{pendingCount > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[#D4AF37]">{new Date(t.starts_at).toLocaleDateString('fr-FR')}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedTravelId((prev) => prev === t.id ? '' : t.id);
                        if (selectedTravelId !== t.id) {
                          supabase
                            .from('ngowazulu_travel_registrations')
                            .select('id,travel_id,user_id,status,registered_at,profiles!user_id(name,email)')
                            .eq('travel_id', t.id)
                            .order('registered_at', { ascending: false })
                            .then(({ data }) => setTravelRegs((prev) => [
                              ...prev.filter((r) => r.travel_id !== t.id),
                              ...(data || []),
                            ]));
                        }
                      }}
                      className="text-[10px] text-white/40 underline hover:text-white/70"
                    >
                      {selectedTravelId === t.id ? 'Masquer' : 'Inscriptions'}
                    </button>
                  </div>
                </div>
              );
            })}

            {/* Panel inscriptions du voyage sélectionné */}
            {selectedTravelId && (() => {
              const regsForTravel = travelRegs.filter((r) => r.travel_id === selectedTravelId);
              return (
                <div className="rounded-xl border border-[#D4AF37]/15 bg-[#D4AF37]/5 p-3 space-y-2">
                  <p className="text-[11px] text-[#D4AF37] font-medium uppercase tracking-wider">
                    Demandes d'inscription ({regsForTravel.length})
                  </p>
                  {regsForTravel.length === 0 ? (
                    <p className="text-xs text-gray-500">Aucune inscription pour ce voyage.</p>
                  ) : regsForTravel.map((reg) => {
                    const isUpdating = updatingRegId === reg.id;
                    const statusColor = {
                      pending:   'text-amber-300',
                      confirmed: 'text-emerald-300',
                      rejected:  'text-red-300',
                      cancelled: 'text-white/30',
                    }[reg.status] || 'text-white/50';
                    return (
                      <div key={reg.id} className="flex items-center justify-between gap-2 text-xs border-b border-white/5 pb-2 last:border-b-0">
                        <div>
                          <p className="text-white">{reg.profiles?.name || reg.user_id}</p>
                          <p className="text-gray-500">{reg.profiles?.email || ''}</p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className={statusColor + ' text-[10px] uppercase'}>{reg.status}</span>
                          {reg.status === 'pending' && (
                            <>
                              <button
                                type="button"
                                disabled={isUpdating}
                                onClick={async () => {
                                  setUpdatingRegId(reg.id);
                                  await supabase.from('ngowazulu_travel_registrations').update({ status: 'confirmed' }).eq('id', reg.id);
                                  setTravelRegs((prev) => prev.map((r) => r.id === reg.id ? { ...r, status: 'confirmed' } : r));
                                  setUpdatingRegId('');
                                  toast({ title: 'Inscription confirmée' });
                                }}
                                className="h-6 px-2 rounded-full bg-emerald-500/15 border border-emerald-500/25 text-emerald-300 hover:bg-emerald-500/25 transition-colors"
                              >✓ Confirmer</button>
                              <button
                                type="button"
                                disabled={isUpdating}
                                onClick={async () => {
                                  setUpdatingRegId(reg.id);
                                  await supabase.from('ngowazulu_travel_registrations').update({ status: 'rejected' }).eq('id', reg.id);
                                  setTravelRegs((prev) => prev.map((r) => r.id === reg.id ? { ...r, status: 'rejected' } : r));
                                  setUpdatingRegId('');
                                  toast({ title: 'Inscription refusée' });
                                }}
                                className="h-6 px-2 rounded-full bg-red-500/15 border border-red-500/25 text-red-300 hover:bg-red-500/25 transition-colors"
                              >✗ Refuser</button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            <div className="pt-2 grid grid-cols-1 md:grid-cols-3 gap-2">
              <Input value={newTravel.title} onChange={(e) => setNewTravel((p) => ({ ...p, title: e.target.value }))} placeholder="Titre voyage" className="bg-[#0f1419] border-white/10" />
              <Input value={newTravel.location} onChange={(e) => setNewTravel((p) => ({ ...p, location: e.target.value }))} placeholder="Lieu" className="bg-[#0f1419] border-white/10" />
              <Input type="datetime-local" value={newTravel.starts_at} onChange={(e) => setNewTravel((p) => ({ ...p, starts_at: e.target.value }))} className="bg-[#0f1419] border-white/10" />
            </div>
            <Button onClick={createTravel} className="bg-[#D4AF37] text-black hover:bg-amber-500"><Plus className="w-4 h-4 mr-1" />Planifier</Button>
          </CardContent>
        </Card>

        <Card className="bg-[#151a21] border-white/10">
          <CardHeader>
            <CardTitle><SectionHeader icon={Hand} title="Règlement communauté" /></CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {rules.slice(0, 6).map((r) => (
              <div key={r.id} className="text-xs text-gray-300 flex justify-between border-b border-white/5 pb-2 last:border-b-0">
                <span>{r.title}</span>
                <span className="text-[#D4AF37]">{r.code}</span>
              </div>
            ))}
            <div className="pt-2 space-y-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <Input value={newRule.code} onChange={(e) => setNewRule((p) => ({ ...p, code: e.target.value }))} placeholder="code-regle" className="bg-[#0f1419] border-white/10" />
                <Input value={newRule.title} onChange={(e) => setNewRule((p) => ({ ...p, title: e.target.value }))} placeholder="Titre règle" className="bg-[#0f1419] border-white/10" />
              </div>
              <Textarea value={newRule.body} onChange={(e) => setNewRule((p) => ({ ...p, body: e.target.value }))} placeholder="Texte de la règle" className="bg-[#0f1419] border-white/10 min-h-[70px]" />
              <Button onClick={createRule} className="bg-[#D4AF37] text-black hover:bg-amber-500"><Plus className="w-4 h-4 mr-1" />Publier règle</Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-[#151a21] border-white/10">
        <CardHeader>
          <CardTitle><SectionHeader icon={HeartPulse} title="Pilotage dossier (timeline, affectation, clôture)" /></CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!selectedCase ? (
            <p className="text-sm text-gray-400">Sélectionnez un dossier dans “Dossiers patients” pour gérer sa timeline.</p>
          ) : (
            <>
              <div className="rounded-lg border border-white/10 bg-black/20 p-3 text-xs text-gray-300 flex flex-wrap items-center gap-2">
                <span className="text-white font-semibold">{selectedCase.title}</span>
                <span className="uppercase text-[#D4AF37]">{selectedCase.case_type}</span>
                <span className="uppercase">{selectedCase.status}</span>
                <span>Patient: {selectedCase.patient_id}</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <select
                  value={selectedCase.status}
                  onChange={(e) => updateCaseStatus(selectedCase.id, e.target.value)}
                  className="h-10 rounded-md bg-[#0f1419] border border-white/10 px-3 text-xs text-white"
                >
                  <option value="opened">opened</option>
                  <option value="in_treatment">in_treatment</option>
                  <option value="stabilized">stabilized</option>
                  <option value="closed">closed</option>
                </select>
                <select
                  value={selectedCase.assigned_staff_id || ''}
                  onChange={(e) => assignCase(selectedCase.id, e.target.value)}
                  className="h-10 rounded-md bg-[#0f1419] border border-white/10 px-3 text-xs text-white"
                >
                  <option value="">Aucun staff assigné</option>
                  {ngowStaff.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name || s.email || s.id}
                    </option>
                  ))}
                </select>
                <Button
                  variant="outline"
                  className="border-red-500/30 text-red-300 hover:bg-red-500/10"
                  onClick={() => updateCaseStatus(selectedCase.id, 'closed')}
                >
                  Clôturer dossier
                </Button>
              </div>
              <div className="rounded-lg border border-white/10 bg-black/20 p-3 space-y-2">
                <p className="text-xs uppercase tracking-wider text-gray-400">Ajouter événement de suivi</p>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                  <select
                    value={newCaseEvent.event_type}
                    onChange={(e) => setNewCaseEvent((p) => ({ ...p, event_type: e.target.value }))}
                    className="h-10 rounded-md bg-[#0f1419] border border-white/10 px-3 text-xs text-white"
                  >
                    <option value="note">note</option>
                    <option value="intervention">intervention</option>
                    <option value="ritual">ritual</option>
                    <option value="follow_up">follow_up</option>
                  </select>
                  <Textarea
                    value={newCaseEvent.content}
                    onChange={(e) => setNewCaseEvent((p) => ({ ...p, content: e.target.value }))}
                    placeholder="Compte rendu, action, décision..."
                    className="md:col-span-2 bg-[#0f1419] border-white/10 min-h-[40px]"
                  />
                  <Button onClick={addCaseEvent} className="bg-[#D4AF37] text-black hover:bg-amber-500">
                    Ajouter à timeline
                  </Button>
                </div>
              </div>
              <div className="rounded-lg border border-white/10 bg-black/20 p-3 space-y-2">
                <p className="text-xs uppercase tracking-wider text-gray-400">Timeline</p>
                {caseEvents.length > 0 ? (
                  caseEvents.map((evt) => (
                    <div key={evt.id} className="text-xs text-gray-300 border-b border-white/5 pb-2 last:border-b-0">
                      <p className="uppercase text-[#D4AF37]">{evt.event_type}</p>
                      <p>{evt.content}</p>
                      <p className="text-[10px] text-gray-500">
                        {new Date(evt.created_at).toLocaleString('fr-FR')}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-gray-500">Aucun événement enregistré.</p>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
