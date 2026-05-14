import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  BookOpen, FileText, CheckCircle, AlertTriangle, FileSignature, 
  HelpCircle, Calendar, Mail, Gavel, Star, Clock, Loader2, CreditCard, ClipboardCheck
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { QuickActionModal } from './QuickActionModals';
import { generateRichStudentData } from '@/lib/mockSchoolLifeData';

// Import enriched sections
import ProgressionSection from '@/components/school-life-student/ProgressionSection';
import NotebookSection from '@/components/school-life-student/NotebookSection';
import EvaluationsSection from '@/components/school-life-student/EvaluationsSection';
import ContractsSection from '@/components/school-life-student/ContractsSection';
import ProblemsSection from '@/components/school-life-student/ProblemsSection';
import CalendarSection from '@/components/school-life-student/CalendarSection';
import WarningsSection from '@/components/school-life-student/WarningsSection';
function computeDocCompliance(profile) {
  if (!profile) {
    return { complete: false, missing: ['Profil non chargé'] };
  }
  const missing = [];
  if (!profile.identity_document_url) missing.push("pièce d'identité");
  if (!profile.residence_proof_url) missing.push('preuve de résidence');
  if (!profile.headshot_url) missing.push('photo');
  const piecesOk = missing.length === 0;
  const flaggedComplete = Boolean(profile.student_profile_completed);
  const complete = flaggedComplete && piecesOk;
  return { complete, missing, flaggedComplete, piecesOk };
}

function summarizeSubscription(row) {
  if (!row) return { kind: 'none' };
  return {
    kind: 'sub',
    status: String(row.status || '').toLowerCase(),
    expiresAt: row.expires_at || null,
    planName: row.billing_plans?.name || null,
  };
}

function subscriptionPresentation(info) {
  if (info.kind === 'none') {
    return {
      label: 'Pas d’abonnement',
      sub: 'Aucun forfait actif en base',
      className: 'bg-gray-500/15 text-gray-300 border-gray-500/30',
    };
  }
  const s = info.status;
  if (s === 'active') {
    return {
      label: 'Abonnement actif',
      sub: info.planName || null,
      className: 'bg-emerald-500/15 text-emerald-200 border-emerald-500/35',
    };
  }
  if (s === 'past_due') {
    return {
      label: 'Abonnement en retard',
      sub: info.planName || 'Paiement à régulariser',
      className: 'bg-amber-500/15 text-amber-200 border-amber-500/35',
    };
  }
  if (s === 'expired') {
    return {
      label: 'Abonnement expiré (désactivé)',
      sub: info.planName || null,
      className: 'bg-red-500/15 text-red-200 border-red-500/35',
    };
  }
  if (s === 'canceled' || s === 'cancelled') {
    return {
      label: 'Abonnement annulé',
      sub: null,
      className: 'bg-red-500/15 text-red-200 border-red-500/35',
    };
  }
  if (s === 'pending') {
    return {
      label: 'Abonnement en attente',
      sub: null,
      className: 'bg-slate-500/15 text-slate-200 border-slate-500/30',
    };
  }
  return {
    label: `Abonnement : ${s || '—'}`,
    sub: null,
    className: 'bg-slate-500/15 text-slate-200 border-slate-500/30',
  };
}

const StudentProfileModal = ({ student, isOpen, onClose, dataSync }) => {
  const [activeTab, setActiveTab] = useState('progression');
  const [actionModal, setActionModal] = useState({ open: false, type: null });
  const [richData, setRichData] = useState(null);
  const [reportedProblems, setReportedProblems] = useState([]);
  const [problemsLoading, setProblemsLoading] = useState(false);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [subscriptionInfo, setSubscriptionInfo] = useState({ kind: 'none' });
  const [docCompliance, setDocCompliance] = useState({
    complete: false,
    missing: [],
    flaggedComplete: false,
    piecesOk: false,
  });

  const loadStudentOverview = useCallback(async () => {
    if (!student?.id) return;
    setOverviewLoading(true);
    try {
      const [subRes, profileRes] = await Promise.all([
        supabase
          .from('billing_subscriptions')
          .select('id,status,expires_at,started_at,billing_plans(name,slug)')
          .eq('user_id', student.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('profiles')
          .select('student_profile_completed,identity_document_url,residence_proof_url,headshot_url')
          .eq('id', student.id)
          .maybeSingle(),
      ]);
      setSubscriptionInfo(summarizeSubscription(subRes.error ? null : subRes.data));
      setDocCompliance(computeDocCompliance(profileRes.error ? null : profileRes.data));
    } finally {
      setOverviewLoading(false);
    }
  }, [student?.id]);

  const loadReportedProblems = useCallback(async () => {
    if (!student?.id) return;
    setProblemsLoading(true);
    const { data, error } = await supabase
      .from('student_reported_problems')
      .select(
        'id,title,description,status,assigned_to_label,solution,next_steps,created_at,updated_at,created_by'
      )
      .eq('student_id', student.id)
      .order('created_at', { ascending: false });
    if (!error) setReportedProblems(data || []);
    setProblemsLoading(false);
  }, [student?.id]);

  useEffect(() => {
    if (student) {
      // Données enrichies (progression, cahier, etc.) — encore mock ; problèmes = Supabase
      setRichData(generateRichStudentData(student.id));
    }
  }, [student]);

  useEffect(() => {
    if (!isOpen || !student?.id) return;
    void loadReportedProblems();
    void loadStudentOverview();
  }, [isOpen, student?.id, loadReportedProblems, loadStudentOverview]);

  if (!student || !richData) return null;

  const openAction = (type) => setActionModal({ open: true, type });
  const subUi = subscriptionPresentation(subscriptionInfo);
  const expiresLabel =
    subscriptionInfo.kind === 'sub' &&
    subscriptionInfo.status === 'active' &&
    subscriptionInfo.expiresAt
      ? format(new Date(subscriptionInfo.expiresAt), 'd MMM yyyy', { locale: fr })
      : null;
  const yearLabel =
    student.year != null && student.year !== ''
      ? `${student.year}ère année`
      : student.formation || 'Parcours';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-[#15202B] border-white/10 text-white max-w-[95vw] w-full h-[95vh] p-0 gap-0 overflow-hidden flex flex-col">
        <DialogHeader className="sr-only">
          <DialogTitle>Profil étudiant</DialogTitle>
        </DialogHeader>
        {/* Header */}
        <div className="p-6 border-b border-white/10 bg-[#192734] flex flex-col md:flex-row justify-between gap-6 shrink-0">
           <div className="flex items-start gap-4">
              <Avatar className="h-20 w-20 border-2 border-[#D4AF37] shadow-lg shadow-black/50">
                <AvatarImage src={student.avatar} />
                <AvatarFallback>{student.name.charAt(0)}</AvatarFallback>
              </Avatar>
              <div className="space-y-1">
                 <h2 className="text-2xl font-bold text-white tracking-tight">{student.name}</h2>
                 <div className="flex flex-wrap gap-2 items-center text-sm">
                    <span className="text-gray-400">{student.email}</span>
                    <span className="text-gray-600">•</span>
                    <span className="text-[#D4AF37] font-medium capitalize">{yearLabel}</span>
                 </div>
                 <div className="flex flex-wrap gap-2 mt-2 items-center">
                    <Badge className={student.status === 'active' ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-red-500/20 text-red-400 border-red-500/30'}>
                      Compte : {student.status === 'active' ? 'actif' : 'inactif'}
                    </Badge>
                 </div>

                 <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl">
                    {overviewLoading ? (
                      <div className="flex items-center gap-2 text-gray-500 text-sm col-span-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Chargement abonnement et dossier…
                      </div>
                    ) : (
                      <>
                        <div className={`rounded-lg border p-3 ${subUi.className}`}>
                          <div className="flex items-start gap-2">
                            <CreditCard className="w-4 h-4 mt-0.5 shrink-0 opacity-80" />
                            <div className="min-w-0">
                              <p className="text-xs font-semibold uppercase tracking-wide opacity-80">Facturation</p>
                              <p className="text-sm font-bold mt-0.5">{subUi.label}</p>
                              {subUi.sub ? <p className="text-xs opacity-90 mt-0.5 truncate">{subUi.sub}</p> : null}
                              {expiresLabel ? (
                                <p className="text-xs mt-1 opacity-80">Expire le {expiresLabel}</p>
                              ) : null}
                            </div>
                          </div>
                        </div>

                        <div
                          className={`rounded-lg border p-3 ${
                            docCompliance.complete
                              ? 'bg-emerald-500/10 text-emerald-100 border-emerald-500/30'
                              : 'bg-amber-500/10 text-amber-100 border-amber-500/35'
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            <ClipboardCheck className="w-4 h-4 mt-0.5 shrink-0 opacity-80" />
                            <div className="min-w-0">
                              <p className="text-xs font-semibold uppercase tracking-wide opacity-80">Dossier administratif</p>
                              <p className="text-sm font-bold mt-0.5">
                                {docCompliance.complete
                                  ? 'Documentation complète'
                                  : 'Documentation incomplète'}
                              </p>
                              {!docCompliance.complete ? (
                                <p className="text-xs mt-1 leading-relaxed">
                                  Manquant : {docCompliance.missing.join(', ') || '—'}
                                  {!docCompliance.flaggedComplete && docCompliance.piecesOk ? (
                                    <span className="block mt-1 text-amber-200/80">
                                      Profil non marqué comme complété par l’élève.
                                    </span>
                                  ) : null}
                                </p>
                              ) : (
                                <p className="text-xs mt-1 opacity-90">
                                  Pièces présentes et profil marqué complété.
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                 </div>
              </div>
           </div>

           <div className="flex flex-wrap content-start gap-2 max-w-xl justify-end">
              <Button size="sm" onClick={() => openAction('warning')} className="bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 border border-orange-500/30"><AlertTriangle className="w-4 h-4 mr-2"/> Avertissement</Button>
              <Button size="sm" onClick={() => openAction('behavior')} className="bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20 border border-yellow-500/30"><Star className="w-4 h-4 mr-2"/> Comportement</Button>
              <Button size="sm" onClick={() => openAction('absence')} className="bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 border border-purple-500/30"><Clock className="w-4 h-4 mr-2"/> Absence</Button>
              <Button size="sm" onClick={() => openAction('message')} className="bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border border-blue-500/30"><Mail className="w-4 h-4 mr-2"/> Message</Button>
              <Button size="sm" onClick={() => openAction('convocation')} className="bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 border border-indigo-500/30"><Gavel className="w-4 h-4 mr-2"/> Convoquer</Button>
           </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col">
           <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
              <div className="px-6 py-2 bg-[#192734] border-b border-white/10 shrink-0 overflow-x-auto">
                 <TabsList className="bg-transparent p-0 h-auto gap-1">
                    <TabTrig value="progression" icon={BookOpen} label="Progression" />
                    <TabTrig value="notebook" icon={FileSignature} label="Cahier" />
                    <TabTrig value="evaluations" icon={CheckCircle} label="Évaluations" />
                    <TabTrig value="calendar" icon={Calendar} label="Calendrier" />
                    <TabTrig value="contracts" icon={FileText} label="Contrats" />
                    <TabTrig value="problems" icon={HelpCircle} label="Problèmes" />
                    <TabTrig value="warnings" icon={AlertTriangle} label="Discipline" />
                 </TabsList>
              </div>

              <ScrollArea className="flex-1 bg-[#15202B]">
                 <div className="p-6">
                    <TabsContent value="progression" className="mt-0"><ProgressionSection data={richData} /></TabsContent>
                    <TabsContent value="notebook" className="mt-0"><NotebookSection data={richData} /></TabsContent>
                    <TabsContent value="evaluations" className="mt-0"><EvaluationsSection data={richData} /></TabsContent>
                    <TabsContent value="calendar" className="mt-0"><CalendarSection data={richData} /></TabsContent>
                    <TabsContent value="contracts" className="mt-0"><ContractsSection data={richData} /></TabsContent>
                    <TabsContent value="problems" className="mt-0">
                      <ProblemsSection
                        studentId={student.id}
                        problems={reportedProblems}
                        loading={problemsLoading}
                        onRefresh={loadReportedProblems}
                      />
                    </TabsContent>
                    <TabsContent value="warnings" className="mt-0"><WarningsSection data={dataSync.warnings.filter(w => w.studentId === student.id)} /></TabsContent>
                 </div>
              </ScrollArea>
           </Tabs>
        </div>
      </DialogContent>
      
      {actionModal.open && <QuickActionModal isOpen={actionModal.open} onClose={() => setActionModal({ open: false, type: null })} type={actionModal.type} student={student} />}
    </Dialog>
  );
};

const TabTrig = ({ value, icon: Icon, label }) => (
  <TabsTrigger value={value} className="data-[state=active]:bg-[#D4AF37] data-[state=active]:text-black text-gray-400 px-4 py-2 rounded-md transition-all gap-2">
     <Icon className="w-4 h-4" /> <span className="hidden md:inline">{label}</span>
  </TabsTrigger>
);

export default StudentProfileModal;