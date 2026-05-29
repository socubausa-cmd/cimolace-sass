import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Flame, Users, HeartPulse, Hand, MapPinned, ScrollText, Radio, Stethoscope,
  Loader2, CheckCircle2, ChevronDown, ChevronUp, FileText, Swords, Sparkles, RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';

// ─── Timeline événements d'un dossier de cas ─────────────────────────────────
const EVENT_ICONS = {
  note:         { icon: FileText,  color: 'text-blue-300  bg-blue-500/10  border-blue-500/20'  },
  intervention: { icon: Swords,    color: 'text-[#D4AF37] bg-[#D4AF37]/10 border-[#D4AF37]/20' },
  ritual:       { icon: Sparkles,  color: 'text-purple-300 bg-purple-500/10 border-purple-500/20' },
  follow_up:    { icon: RefreshCw, color: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20' },
};

function CaseTimeline({ caseId }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    if (!caseId || !open) return;
    setLoading(true);
    const { data } = await supabase
      .from('ngowazulu_case_events')
      .select('id,event_type,content,scheduled_at,created_at,profiles:performed_by(name)')
      .eq('case_id', caseId)
      .order('created_at', { ascending: false })
      .limit(20);
    setEvents(data || []);
    setLoading(false);
  }, [caseId, open]);

  useEffect(() => { void load(); }, [load]);

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-[11px] text-[#D4AF37] hover:text-amber-300 transition-colors"
      >
        {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        {open ? 'Masquer la timeline' : 'Voir la timeline'}
      </button>

      {open && (
        <div className="mt-2 space-y-2 pl-3 border-l border-[#D4AF37]/20">
          {loading && <Loader2 className="w-3.5 h-3.5 animate-spin text-[#D4AF37]" />}
          {!loading && events.length === 0 && (
            <p className="text-[11px] text-gray-500">Aucun événement enregistré.</p>
          )}
          {events.map((ev) => {
            const meta = EVENT_ICONS[ev.event_type] || EVENT_ICONS.note;
            const Icon = meta.icon;
            return (
              <div key={ev.id} className="flex items-start gap-2">
                <div className={cn('w-6 h-6 rounded-full border flex items-center justify-center flex-shrink-0', meta.color)}>
                  <Icon className="w-3 h-3" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-white leading-snug">{ev.content}</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">
                    {ev.profiles?.name ? `${ev.profiles.name} · ` : ''}
                    {new Date(ev.scheduled_at || ev.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const SECTION_ITEMS = [
  {
    id: 'cultes',
    icon: Radio,
    title: 'Culte en ligne',
    description: 'Ouverture dominicale et fermeture du vendredi pour les membres du temple.',
  },
  {
    id: 'consultations',
    icon: Stethoscope,
    title: 'Consultations',
    description: 'Diagnostic, orientation et résolution des cas spirituels.',
  },
  {
    id: 'interventions',
    icon: Hand,
    title: 'Interventions mystiques',
    description: 'Délivrance, purification et rupture karmique selon le cas.',
  },
  {
    id: 'hopital',
    icon: HeartPulse,
    title: 'Hôpital traditionnel',
    description: 'Prise en charge profonde des cas lourds et suivi d\'évolution.',
  },
  {
    id: 'voyages',
    icon: MapPinned,
    title: 'Voyages initiatiques',
    description: 'Rites de passage, débaptisation et sortie des anciens pactes.',
  },
  {
    id: 'communaute',
    icon: Users,
    title: 'Communauté Ngowazulu',
    description: 'Membres actifs, entraide structurée et accompagnement collectif.',
  },
  {
    id: 'reglement',
    icon: ScrollText,
    title: 'Règlement intérieur',
    description: 'Code de conduite et règles de sécurité spirituelle de la communauté.',
  },
];

export default function NgowazuluTemplePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { section } = useParams();
  const activeSection = String(section || '').toLowerCase();
  const selected = SECTION_ITEMS.find((item) => item.id === activeSection) || null;
  const [loadingData, setLoadingData] = useState(false);
  const [sectionError, setSectionError] = useState('');
  const [cults, setCults] = useState([]);
  const [consultCases, setConsultCases] = useState([]);
  const [interventionCases, setInterventionCases] = useState([]);
  const [hospitalCases, setHospitalCases] = useState([]);
  const [travels, setTravels] = useState([]);
  const [rules, setRules] = useState([]);
  const [acceptedRuleIds, setAcceptedRuleIds] = useState([]);
  const [acceptingRuleId, setAcceptingRuleId] = useState('');
  const [myTravelRegs, setMyTravelRegs] = useState({}); // { [travelId]: 'pending'|'confirmed'|'rejected'|'cancelled' }
  const [registeringTravelId, setRegisteringTravelId] = useState('');

  useEffect(() => {
    if (!selected || !user?.id) return;
    let alive = true;
    const run = async () => {
      setLoadingData(true);
      setSectionError('');
      try {
        if (selected.id === 'cultes') {
          const { data, error } = await supabase
            .from('ngowazulu_cults')
            .select('id,title,service_day,starts_at,status,visibility')
            .order('starts_at', { ascending: true })
            .limit(10);
          if (error) throw error;
          if (!alive) return;
          setCults(data || []);
          return;
        }

        if (selected.id === 'consultations') {
          const { data, error } = await supabase
            .from('ngowazulu_case_files')
            .select('id,title,status,severity,opened_at')
            .eq('case_type', 'consultation')
            .eq('patient_id', user.id)
            .order('opened_at', { ascending: false })
            .limit(10);
          if (error) throw error;
          if (!alive) return;
          setConsultCases(data || []);
          return;
        }

        if (selected.id === 'interventions') {
          const { data, error } = await supabase
            .from('ngowazulu_case_files')
            .select('id,title,status,severity,opened_at')
            .eq('case_type', 'intervention')
            .eq('patient_id', user.id)
            .order('opened_at', { ascending: false })
            .limit(10);
          if (error) throw error;
          if (!alive) return;
          setInterventionCases(data || []);
          return;
        }

        if (selected.id === 'hopital') {
          const { data, error } = await supabase
            .from('ngowazulu_case_files')
            .select('id,title,status,severity,opened_at')
            .eq('case_type', 'hospital')
            .eq('patient_id', user.id)
            .order('opened_at', { ascending: false })
            .limit(10);
          if (error) throw error;
          if (!alive) return;
          setHospitalCases(data || []);
          return;
        }

        if (selected.id === 'voyages') {
          const [{ data: travelsData, error: travelsErr }, { data: regsData }] = await Promise.all([
            supabase
              .from('ngowazulu_initiatory_travels')
              .select('id,title,location,status,starts_at,ends_at,seats_total,seats_taken')
              .order('starts_at', { ascending: true })
              .limit(10),
            supabase
              .from('ngowazulu_travel_registrations')
              .select('travel_id,status')
              .eq('user_id', user.id),
          ]);
          if (travelsErr) throw travelsErr;
          if (!alive) return;
          setTravels(travelsData || []);
          const regMap = {};
          (regsData || []).forEach((r) => { regMap[r.travel_id] = r.status; });
          setMyTravelRegs(regMap);
          return;
        }

        if (selected.id === 'communaute' || selected.id === 'reglement') {
          const [{ data: rulesData, error: rulesError }, { data: acceptedData, error: acceptedError }] = await Promise.all([
            supabase
              .from('ngowazulu_community_rules')
              .select('id,code,title,body,required,active,version,published_at')
              .eq('active', true)
              .order('published_at', { ascending: false }),
            supabase
              .from('ngowazulu_rule_acceptances')
              .select('rule_id')
              .eq('user_id', user.id),
          ]);
          if (rulesError) throw rulesError;
          if (acceptedError) throw acceptedError;
          if (!alive) return;
          setRules(rulesData || []);
          setAcceptedRuleIds((acceptedData || []).map((x) => x.rule_id).filter(Boolean));
        }
      } catch (err) {
        if (!alive) return;
        setSectionError(String(err?.message || 'Impossible de charger les données de section.'));
      } finally {
        if (alive) setLoadingData(false);
      }
    };
    run();
    return () => {
      alive = false;
    };
  }, [selected, user?.id]);

  const pendingRequiredRules = useMemo(() => {
    return rules.filter((r) => r.required && !acceptedRuleIds.includes(r.id));
  }, [rules, acceptedRuleIds]);

  const acceptRule = async (ruleId) => {
    if (!user?.id || !ruleId) return;
    setAcceptingRuleId(ruleId);
    try {
      const { error } = await supabase
        .from('ngowazulu_rule_acceptances')
        .insert({ rule_id: ruleId, user_id: user.id });
      if (error && !String(error?.message || '').toLowerCase().includes('duplicate')) throw error;
      setAcceptedRuleIds((prev) => (prev.includes(ruleId) ? prev : [...prev, ruleId]));
      toast({ title: 'Règlement validé', description: 'Votre acceptation a été enregistrée.' });
    } catch (err) {
      toast({ title: 'Impossible de valider', description: String(err?.message || 'Réessayez.'), variant: 'destructive' });
    } finally {
      setAcceptingRuleId('');
    }
  };

  const registerTravel = async (travelId) => {
    if (!user?.id || !travelId) return;
    setRegisteringTravelId(travelId);
    try {
      const { error } = await supabase
        .from('ngowazulu_travel_registrations')
        .insert({ travel_id: travelId, user_id: user.id, status: 'pending' });
      if (error && !String(error?.message || '').toLowerCase().includes('duplicate')) throw error;
      setMyTravelRegs((prev) => ({ ...prev, [travelId]: 'pending' }));
      toast({ title: 'Inscription envoyée', description: 'Votre demande est en cours de validation par le staff.' });
    } catch (err) {
      toast({ title: 'Inscription impossible', description: String(err?.message || 'Réessayez.'), variant: 'destructive' });
    } finally {
      setRegisteringTravelId('');
    }
  };

  const cancelTravelRegistration = async (travelId) => {
    if (!user?.id || !travelId) return;
    setRegisteringTravelId(travelId);
    try {
      const { error } = await supabase
        .from('ngowazulu_travel_registrations')
        .update({ status: 'cancelled' })
        .eq('travel_id', travelId)
        .eq('user_id', user.id)
        .eq('status', 'pending');
      if (error) throw error;
      setMyTravelRegs((prev) => ({ ...prev, [travelId]: 'cancelled' }));
      toast({ title: 'Inscription annulée' });
    } catch (err) {
      toast({ title: 'Erreur', description: String(err?.message || 'Réessayez.'), variant: 'destructive' });
    } finally {
      setRegisteringTravelId('');
    }
  };

  return (
    <div className="min-h-screen bg-[#0F1419] text-white pt-24 pb-12 px-4 md:px-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="rounded-2xl border border-[#D4AF37]/25 bg-[#D4AF37]/10 p-6 md:p-8">
          <p className="text-xs uppercase tracking-[0.2em] text-[#D4AF37] mb-2">PRORASCIENCE · Temple</p>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Flame className="w-7 h-7 text-[#D4AF37]" />
            Espace Ngowazulu
          </h1>
          <p className="text-sm text-gray-300 mt-2 max-w-3xl">
            Pôle de transformation, intervention et guérison. Cet espace regroupe les consultations,
            les interventions mystiques, les cultes et la communauté.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {SECTION_ITEMS.map((item) => (
            <Card
              key={item.id}
              className={`border ${
                selected?.id === item.id
                  ? 'border-[#D4AF37]/60 bg-[#D4AF37]/10'
                  : 'border-white/10 bg-[#151a21]'
              }`}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-white text-base flex items-center gap-2">
                  <item.icon className="w-4 h-4 text-[#D4AF37]" />
                  {item.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-gray-300">{item.description}</p>
                <Link to={`/ngowazulu/${item.id}`}>
                  <Button variant="outline" className="w-full border-white/15 text-white hover:bg-white/5">
                    Ouvrir
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>

        {selected ? (
          <Card className="border-[#D4AF37]/25 bg-[#151a21]">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <selected.icon className="w-5 h-5 text-[#D4AF37]" />
                {selected.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-gray-300">
              <p>{selected.description}</p>
              {sectionError ? (
                <p className="text-xs text-red-300">{sectionError}</p>
              ) : null}
              {loadingData ? (
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <Loader2 className="w-4 h-4 animate-spin text-[#D4AF37]" />
                  Chargement...
                </div>
              ) : null}
              {selected.id === 'consultations' ? (
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <Link to="/services-spirituels#ngowazulu">
                      <Button className="bg-[#D4AF37] text-black hover:bg-amber-500 font-bold">
                        Voir les offres Ngowazulu
                      </Button>
                    </Link>
                    <Link to="/appointment/request?flow=ngowazulu-consultation">
                      <Button variant="outline" className="border-[#D4AF37]/40 text-[#D4AF37] hover:bg-[#D4AF37]/10">
                        Réserver une consultation
                      </Button>
                    </Link>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-black/20 p-3 space-y-2">
                    <p className="text-xs uppercase tracking-wider text-gray-400">Suivi de mes consultations</p>
                    {consultCases.length > 0 ? (
                      consultCases.map((row) => (
                        <div key={row.id} className="text-xs text-gray-300 border-b border-white/5 pb-3 last:border-b-0 last:pb-0">
                          <div className="flex items-center justify-between">
                            <span className="text-white font-medium">{row.title}</span>
                            <span className="uppercase text-[10px] text-[#D4AF37]">{row.status}</span>
                          </div>
                          <CaseTimeline caseId={row.id} />
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-gray-500">Aucun dossier consultation pour le moment.</p>
                    )}
                  </div>
                </div>
              ) : selected.id === 'cultes' ? (
                <div className="rounded-xl border border-white/10 bg-black/20 p-3 space-y-2">
                  <p className="text-xs uppercase tracking-wider text-gray-400">Calendrier des cultes</p>
                  {cults.length > 0 ? (
                    cults.map((row) => (
                      <div key={row.id} className="text-xs text-gray-300 flex items-center justify-between border-b border-white/5 pb-2 last:border-b-0 last:pb-0">
                        <span>{row.title}</span>
                        <span className="text-[10px] uppercase text-[#D4AF37]">
                          {new Date(row.starts_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-gray-500">Aucun culte planifié actuellement.</p>
                  )}
                </div>
              ) : selected.id === 'interventions' ? (
                <div className="rounded-xl border border-white/10 bg-black/20 p-3 space-y-2">
                  <p className="text-xs uppercase tracking-wider text-gray-400">Mes interventions</p>
                  {interventionCases.length > 0 ? (
                    interventionCases.map((row) => (
                      <div key={row.id} className="text-xs text-gray-300 border-b border-white/5 pb-3 last:border-b-0 last:pb-0">
                        <div className="flex items-center justify-between">
                          <span className="text-white font-medium">{row.title}</span>
                          <span className="uppercase text-[10px] text-[#D4AF37]">{row.status}</span>
                        </div>
                        <CaseTimeline caseId={row.id} />
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-gray-500">Aucune intervention ouverte sur votre compte.</p>
                  )}
                </div>
              ) : selected.id === 'hopital' ? (
                <div className="rounded-xl border border-white/10 bg-black/20 p-3 space-y-2">
                  <p className="text-xs uppercase tracking-wider text-gray-400">Dossiers hôpital traditionnel</p>
                  {hospitalCases.length > 0 ? (
                    hospitalCases.map((row) => (
                      <div key={row.id} className="text-xs text-gray-300 border-b border-white/5 pb-3 last:border-b-0 last:pb-0">
                        <div className="flex items-center justify-between">
                          <span className="text-white font-medium">{row.title}</span>
                          <span className="uppercase text-[10px] text-[#D4AF37]">{row.status}</span>
                        </div>
                        <CaseTimeline caseId={row.id} />
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-gray-500">Aucun dossier hôpital actif pour le moment.</p>
                  )}
                </div>
              ) : selected.id === 'voyages' ? (
                <div className="space-y-3">
                  <p className="text-xs uppercase tracking-wider text-gray-400 pb-1">Voyages initiatiques</p>
                  {travels.length > 0 ? travels.map((row) => {
                    const regStatus = myTravelRegs[row.id];
                    const isFull    = row.seats_total !== null && row.seats_taken >= row.seats_total;
                    const canJoin   = row.status === 'open' && !isFull && !regStatus;
                    const isLoading = registeringTravelId === row.id;

                    const regBadge = {
                      pending:   { label: 'En attente',  cls: 'text-amber-300 bg-amber-500/10 border-amber-500/25' },
                      confirmed: { label: 'Confirmé',    cls: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/25' },
                      rejected:  { label: 'Refusé',      cls: 'text-red-300 bg-red-500/10 border-red-500/25' },
                      cancelled: { label: 'Annulé',      cls: 'text-white/30 bg-white/5 border-white/10' },
                    }[regStatus];

                    return (
                      <div key={row.id} className="rounded-xl border border-white/10 bg-black/20 p-3 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-white text-sm">{row.title}</p>
                            <p className="text-xs text-gray-400 mt-0.5">{row.location || 'Lieu à confirmer'}</p>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <span className="text-[10px] uppercase text-[#D4AF37]">
                                {new Date(row.starts_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
                              </span>
                              {row.seats_total !== null && (
                                <span className={`text-[10px] ${isFull ? 'text-red-300' : 'text-gray-400'}`}>
                                  {isFull ? 'Complet' : `${row.seats_total - row.seats_taken} place(s) restante(s)`}
                                </span>
                              )}
                              {row.status === 'planned' && (
                                <span className="text-[10px] text-white/30">Ouverture bientôt</span>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                            {regBadge && (
                              <span className={`inline-flex h-5 px-2 rounded-full border text-[10px] font-medium ${regBadge.cls}`}>
                                {regBadge.label}
                              </span>
                            )}
                            {canJoin && (
                              <button
                                type="button"
                                onClick={() => registerTravel(row.id)}
                                disabled={isLoading}
                                className="h-7 px-3 rounded-full bg-[#D4AF37]/15 border border-[#D4AF37]/30 text-[#D4AF37] text-[11px] font-semibold hover:bg-[#D4AF37]/25 transition-colors disabled:opacity-50 flex items-center gap-1"
                              >
                                {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                                S'inscrire
                              </button>
                            )}
                            {regStatus === 'pending' && (
                              <button
                                type="button"
                                onClick={() => cancelTravelRegistration(row.id)}
                                disabled={isLoading}
                                className="h-6 px-2.5 rounded-full bg-white/5 border border-white/10 text-white/40 text-[10px] hover:bg-white/10 transition-colors disabled:opacity-50"
                              >
                                {isLoading ? <Loader2 className="w-2.5 h-2.5 animate-spin inline" /> : 'Annuler'}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  }) : (
                    <p className="text-xs text-gray-500">Aucun voyage initiatique publié.</p>
                  )}
                </div>
              ) : selected.id === 'communaute' || selected.id === 'reglement' ? (
                <div className="space-y-3">
                  {pendingRequiredRules.length > 0 ? (
                    <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                      {pendingRequiredRules.length} règle(s) obligatoire(s) en attente d&apos;acceptation.
                    </div>
                  ) : (
                    <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200 flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Toutes les règles obligatoires sont acceptées.
                    </div>
                  )}
                  <div className="space-y-2">
                    {rules.length > 0 ? (
                      rules.map((rule) => {
                        const accepted = acceptedRuleIds.includes(rule.id);
                        return (
                          <div key={rule.id} className="rounded-xl border border-white/10 bg-black/20 p-3 space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm font-semibold text-white">{rule.title}</p>
                              <span className={`text-[10px] uppercase ${accepted ? 'text-emerald-300' : 'text-amber-300'}`}>
                                {accepted ? 'Acceptée' : 'À valider'}
                              </span>
                            </div>
                            <p className="text-xs text-gray-300">{rule.body}</p>
                            {!accepted ? (
                              <Button
                                size="sm"
                                onClick={() => acceptRule(rule.id)}
                                disabled={acceptingRuleId === rule.id}
                                className="bg-[#D4AF37] text-black hover:bg-amber-500 font-bold"
                              >
                                {acceptingRuleId === rule.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'J\'accepte cette règle'}
                              </Button>
                            ) : null}
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-xs text-gray-500">Aucun règlement publié pour le moment.</p>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-gray-500">
                  Cette section est prête côté navigation. Le contenu opérationnel détaillé peut être branché
                  progressivement (workflows, documents, automatisations et suivi).
                </p>
              )}
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
