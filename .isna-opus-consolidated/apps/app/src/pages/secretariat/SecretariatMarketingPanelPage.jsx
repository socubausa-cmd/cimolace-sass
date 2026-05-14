import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import { resolveNetlifyApiUrl } from '@/lib/resolveNetlifyApiUrl';
import { fetchTenantContext } from '@/lib/tenant/fetchTenantContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { CalendarPlus, Loader2, Megaphone, RefreshCw, Send, ShieldCheck, Target, HeartHandshake, Brain, TrendingUp, AlertTriangle, Workflow } from 'lucide-react';

export default function SecretariatMarketingPanelPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [leads, setLeads] = useState([]);
  const [qualifiedThreads, setQualifiedThreads] = useState([]);
  const [selectedThreadId, setSelectedThreadId] = useState('');
  const [threadMessages, setThreadMessages] = useState([]);
  const [secretaryReply, setSecretaryReply] = useState('');
  const [search, setSearch] = useState('');
  const [processingLeadId, setProcessingLeadId] = useState(null);
  const [metrics, setMetrics] = useState({ conversionRate: 0, revenue: 0 });

  const authFetch = useCallback(async (url, options = {}) => {
    const { data: sessData } = await supabase.auth.getSession();
    const token = sessData?.session?.access_token;
    if (!token) throw new Error('Session invalide');
    const resolved = resolveNetlifyApiUrl(url);
    const res = await fetch(resolved, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(options.headers || {}),
      },
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(payload?.error || 'Erreur API');
    return payload;
  }, []);

  const loadLeads = useCallback(async () => {
    setLoading(true);
    try {
      const tenantCtx = await fetchTenantContext().catch(() => null);
      const tenantSlug = tenantCtx?.slug ? String(tenantCtx.slug).trim().toLowerCase() : '';
      const leadsQs = new URLSearchParams();
      if (search.trim()) leadsQs.set('search', search.trim());
      if (tenantSlug) leadsQs.set('tenant_slug', tenantSlug);
      const leadsPath = leadsQs.toString() ? `/api/marketing/leads?${leadsQs.toString()}` : '/api/marketing/leads';
      const analyticsPath = tenantSlug
        ? `/api/marketing/analytics?tenant_slug=${encodeURIComponent(tenantSlug)}`
        : '/api/marketing/analytics';

      const [payload, analyticsPayload, threadPayload] = await Promise.all([
        authFetch(leadsPath),
        authFetch(analyticsPath),
        authFetch(`/api/response/secretariat/threads?view=all${search ? `&search=${encodeURIComponent(search)}` : ''}`),
      ]);
      setLeads(Array.isArray(payload?.leads) ? payload.leads : []);
      setQualifiedThreads(Array.isArray(threadPayload?.threads) ? threadPayload.threads : []);
      setMetrics({
        conversionRate: Number(analyticsPayload?.metrics?.conversionRate || 0),
        revenue: Number(analyticsPayload?.metrics?.revenue || 0),
      });
    } catch (e) {
      toast({ title: 'Leads', description: String(e?.message || e), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [authFetch, search, toast]);

  useEffect(() => {
    loadLeads();
  }, [loadLeads]);

  const sorted = useMemo(() => [...leads].sort((a, b) => Number(b.score || 0) - Number(a.score || 0)), [leads]);
  const prospectsTreated = leads.length;
  const conversions = leads.filter((lead) => String(lead.status || '').toLowerCase() === 'customer').length;
  const conversionRateDisplay = metrics.conversionRate || (prospectsTreated ? Math.round((conversions / prospectsTreated) * 100) : 0);

  const missionCards = [
    {
      icon: HeartHandshake,
      title: 'Mission 1 - Accueillir',
      points: ['repondre rapidement', 'etre clair', 'creer un climat de confiance'],
      note: 'Premiere impression decisive',
    },
    {
      icon: Brain,
      title: 'Mission 2 - Comprendre',
      points: ['identifier le besoin reel', 'evaluer le niveau du prospect', 'comprendre son objectif'],
      note: 'Poser les bonnes questions',
    },
    {
      icon: Target,
      title: 'Mission 3 - Orienter',
      points: ['module = besoin precis', 'cursus = comprehension', 'coaching = metier', 'special = avance'],
      note: 'Jamais proposer au hasard',
    },
    {
      icon: TrendingUp,
      title: 'Mission 4 - Convertir',
      points: ['rassurer', 'expliquer', 'clarifier', 'conclure'],
      note: 'Amener a l achat',
    },
    {
      icon: RefreshCw,
      title: 'Mission 5 - Relancer',
      points: ['relance douce', 'rappel', 'suivi'],
      note: 'Ne jamais abandonner un prospect',
    },
    {
      icon: CalendarPlus,
      title: 'Mission 6 - Preparer le rendez-vous',
      points: ['valider le besoin', 'preparer le contexte', 'orienter la discussion'],
      note: 'Preparer la conversion',
    },
    {
      icon: Megaphone,
      title: 'Mission 7 - Utiliser le chat immersif',
      points: ['creer un echange reel', 'approfondir', 'accompagner'],
      note: 'Transformer la discussion en decision',
    },
  ];

  const quickAction = async (lead, mode) => {
    setProcessingLeadId(`${lead.id}-${mode}`);
    try {
      if (mode === 'followup') {
        await authFetch('/api/marketing/automation/run', {
          method: 'POST',
          body: JSON.stringify({ trigger: 'lead_created', leadId: lead.id }),
        });
        toast({ title: 'Relance envoyee', description: 'Scenario de relance execute.' });
      } else if (mode === 'campaign') {
        await authFetch('/api/marketing/publish', {
          method: 'POST',
          body: JSON.stringify({
            channel: 'email',
            immediate: true,
            message: `Bonjour ${lead.name || ''}, nous vous proposons un accompagnement personnalise.`,
            audience: `lead:${lead.id}`,
          }),
        });
        toast({ title: 'Message envoye', description: 'Campagne one-shot envoyee au lead.' });
      } else if (mode === 'booking') {
        await authFetch('/api/marketing/publish', {
          method: 'POST',
          body: JSON.stringify({
            channel: 'email',
            immediate: true,
            message: 'Prenez votre rendez-vous marketing ici: /appointment/request',
            audience: `lead:${lead.id}`,
          }),
        });
        toast({ title: 'Proposition rendez-vous', description: 'Lien Smart Booking envoye.' });
      }
    } catch (e) {
      toast({ title: 'Action impossible', description: String(e?.message || e), variant: 'destructive' });
    } finally {
      setProcessingLeadId(null);
    }
  };

  const loadThreadMessages = useCallback(async (threadId) => {
    if (!threadId) {
      setThreadMessages([]);
      return;
    }
    try {
      const payload = await authFetch(`/api/response/secretariat/messages?threadId=${encodeURIComponent(threadId)}`);
      setThreadMessages(Array.isArray(payload?.messages) ? payload.messages : []);
    } catch (e) {
      toast({ title: 'Conversations', description: String(e?.message || e), variant: 'destructive' });
    }
  }, [authFetch, toast]);

  const selectedThread = useMemo(
    () => qualifiedThreads.find((thread) => thread.id === selectedThreadId) || null,
    [qualifiedThreads, selectedThreadId]
  );

  const sendSecretaryReply = async () => {
    if (!selectedThreadId || !secretaryReply.trim()) return;
    try {
      await authFetch('/api/response/secretariat/reply', {
        method: 'POST',
        body: JSON.stringify({
          threadId: selectedThreadId,
          message: secretaryReply,
          status: 'qualified',
        }),
      });
      setSecretaryReply('');
      await loadThreadMessages(selectedThreadId);
      await loadLeads();
      toast({ title: 'Reponse envoyee', description: 'Message secretaire envoye au prospect.' });
    } catch (e) {
      toast({ title: 'Reponse impossible', description: String(e?.message || e), variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-4">
      <div className="premium-panel p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-[#D4AF37]" />
              Secrétariat Prorascience — Missions commerciales
            </h2>
            <p className="text-sm text-gray-400">Le secrétariat est le premier point de conversion.</p>
          </div>
          <Badge className="bg-[#D4AF37]/15 text-[#D4AF37] border-[#D4AF37]/30">
            Prospect - Echange - Comprehension - Orientation - Conversion
          </Badge>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <div className="rounded-lg border border-white/10 bg-[#0F1419]/70 p-3">
            <p className="text-xs text-gray-500">Prospects traités</p>
            <p className="text-white font-bold text-lg">{prospectsTreated}</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-[#0F1419]/70 p-3">
            <p className="text-xs text-gray-500">Conversions</p>
            <p className="text-white font-bold text-lg">{conversions}</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-[#0F1419]/70 p-3">
            <p className="text-xs text-gray-500">Taux de conversion</p>
            <p className="text-white font-bold text-lg">{conversionRateDisplay}%</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-[#0F1419]/70 p-3">
            <p className="text-xs text-gray-500">Montant généré</p>
            <p className="text-white font-bold text-lg">{metrics.revenue}</p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
          {missionCards.map((mission) => (
            <div key={mission.title} className="rounded-xl border border-white/10 bg-[#0F1419]/70 p-4">
              <p className="text-sm font-semibold text-white flex items-center gap-2 mb-2">
                <mission.icon className="w-4 h-4 text-[#D4AF37]" />
                {mission.title}
              </p>
              <div className="space-y-1">
                {mission.points.map((point) => (
                  <p key={`${mission.title}-${point}`} className="text-xs text-gray-400">
                    - {point}
                  </p>
                ))}
              </div>
              <p className="text-xs text-[#D4AF37] mt-3">{mission.note}</p>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
          <p className="text-sm font-semibold text-white">Regle d or</p>
          <p className="text-sm text-gray-300 mt-1">Chaque interaction doit mener a une decision.</p>
          <div className="flex flex-wrap gap-2 mt-3">
            <Badge className="bg-white/10 text-gray-200 border-white/10">convertir</Badge>
            <Badge className="bg-white/10 text-gray-200 border-white/10">orienter</Badge>
            <Badge className="bg-white/10 text-gray-200 border-white/10">accompagner</Badge>
            <Badge className="bg-white/10 text-gray-200 border-white/10">vendre</Badge>
          </div>
          <p className="text-sm text-[#D4AF37] mt-3">Le secretariat ne gere pas les messages: il transforme les prospects en clients.</p>
        </div>

        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4">
          <p className="text-sm font-semibold text-white flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-300" />
            Erreurs a eviter
          </p>
          <div className="grid md:grid-cols-2 gap-2 mt-2">
            <p className="text-xs text-gray-300">- repondre sans ecouter</p>
            <p className="text-xs text-gray-300">- proposer au hasard</p>
            <p className="text-xs text-gray-300">- ne pas relancer</p>
            <p className="text-xs text-gray-300">- manquer de clarte</p>
          </div>
        </div>
      </div>

      <div className="premium-panel p-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Megaphone className="w-5 h-5 text-[#D4AF37]" />
            Secretary Marketing Panel
          </h2>
          <p className="text-sm text-gray-400">Relance leads, message direct et proposition rendez-vous.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline" size="sm" className="border-violet-500/35 text-violet-200 hover:bg-violet-500/10">
            <Link to="/admin/marketing">
              <Megaphone className="w-4 h-4 mr-1" />
              Growth Engine complet
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="border-[#D4AF37]/35 text-[#D4AF37] hover:bg-[#D4AF37]/10">
            <Link to="/admin/marketing?tab=automation">
              <Workflow className="w-4 h-4 mr-1" />
              Automation
            </Link>
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher lead..."
            className="w-52"
          />
          <Button variant="outline" className="border-white/10 text-white hover:bg-white/5" onClick={loadLeads} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          </Button>
          <Button
            variant="outline"
            className="border-[#D4AF37]/40 text-[#D4AF37] hover:bg-[#D4AF37]/10"
            onClick={async () => {
              try {
                const payload = await authFetch('/api/response/followup/run', { method: 'POST' });
                toast({
                  title: 'Follow-up prepare',
                  description: `${payload.remindersPrepared || 0} relances preparees.`,
                });
              } catch (e) {
                toast({ title: 'Follow-up impossible', description: String(e?.message || e), variant: 'destructive' });
              }
            }}
          >
            Relances auto
          </Button>
        </div>
      </div>

      <div className="premium-panel p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-white font-semibold">Conversations qualifiees (Smart Response Engine)</h3>
          <Badge className="bg-white/10 text-gray-200 border-white/10">{qualifiedThreads.length} threads</Badge>
        </div>
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
            {qualifiedThreads.slice(0, 40).map((thread) => (
              <button
                key={thread.id}
                type="button"
                onClick={() => {
                  setSelectedThreadId(thread.id);
                  loadThreadMessages(thread.id);
                }}
                className={`w-full text-left rounded-lg border p-3 transition-colors ${
                  selectedThreadId === thread.id
                    ? 'border-[#D4AF37]/40 bg-[#D4AF37]/10'
                    : 'border-white/10 bg-[#0F1419]/60 hover:bg-white/5'
                }`}
              >
                <p className="text-sm text-white font-medium">{thread.visitor_name || thread.visitor_email || 'Prospect'}</p>
                <p className="text-xs text-gray-400 mt-1">
                  {thread.last_intent || 'information'} | {thread.last_temperature || 'cold'} | {thread.status}
                </p>
                <p className="text-xs text-gray-500 mt-1">{thread.recommended_offer || 'cursus'}</p>
              </button>
            ))}
            {!qualifiedThreads.length ? <p className="text-xs text-gray-500">Aucune conversation qualifiee.</p> : null}
          </div>

          <div className="rounded-lg border border-white/10 bg-[#0F1419]/70 p-3 space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline" className="border-white/10 text-white hover:bg-white/5">
                <Link to="/messages">Ouvrir chat immersif</Link>
              </Button>
              <Button asChild className="bg-[#D4AF37] text-black hover:bg-amber-500">
                <Link to="/appointment/request">Programmer rendez-vous</Link>
              </Button>
              <Button
                variant="outline"
                className="border-[#D4AF37]/40 text-[#D4AF37] hover:bg-[#D4AF37]/10"
                onClick={async () => {
                  if (!selectedThread) return;
                  try {
                    await authFetch('/api/marketing/publish', {
                      method: 'POST',
                      body: JSON.stringify({
                        channel: 'email',
                        immediate: true,
                        message: 'Voici votre lien de paiement Prorascience: /forfaits',
                        audience: selectedThread.visitor_email ? `email:${selectedThread.visitor_email}` : `thread:${selectedThread.id}`,
                      }),
                    });
                    toast({ title: 'Lien envoye', description: 'Lien de paiement envoye au prospect.' });
                  } catch (e) {
                    toast({ title: 'Envoi impossible', description: String(e?.message || e), variant: 'destructive' });
                  }
                }}
                disabled={!selectedThread}
              >
                Envoyer lien de paiement
              </Button>
            </div>

            {selectedThread ? (
              <>
                <div className="rounded border border-white/10 bg-black/20 p-2 text-xs text-gray-300">
                  <p>Prospect: {selectedThread.visitor_name || selectedThread.visitor_email || 'N/A'}</p>
                  <p>Besoin detecte: {selectedThread.last_intent || 'information'}</p>
                  <p>Niveau chaleur: {selectedThread.last_temperature || 'cold'}</p>
                  <p>Offre recommandee: {selectedThread.recommended_offer || 'cursus'}</p>
                  <p>Timezone: {selectedThread.visitor_timezone || '-'}</p>
                  <p>Pays: {selectedThread.visitor_country || '-'}</p>
                </div>
                <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1">
                  {threadMessages.map((message) => (
                    <div key={message.id} className="rounded border border-white/10 bg-black/20 p-2">
                      <p className="text-[11px] text-gray-400">{message.sender_type}</p>
                      <p className="text-xs text-gray-200 mt-1">{message.message}</p>
                    </div>
                  ))}
                  {!threadMessages.length ? <p className="text-xs text-gray-500">Aucun message.</p> : null}
                </div>
                <div className="flex gap-2">
                  <Input
                    value={secretaryReply}
                    onChange={(e) => setSecretaryReply(e.target.value)}
                    placeholder="Reponse secretaire..."
                  />
                  <Button onClick={sendSecretaryReply} disabled={!secretaryReply.trim()}>
                    Repondre
                  </Button>
                </div>
              </>
            ) : (
              <p className="text-xs text-gray-500">Selectionnez une conversation pour afficher le dossier qualifie.</p>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {sorted.slice(0, 60).map((lead) => (
          <div key={lead.id} className="premium-panel border border-white/10 p-4 rounded-xl flex flex-col lg:flex-row lg:items-center gap-3">
            <div className="flex-1">
              <p className="text-sm text-white font-medium">{lead.name || lead.email || lead.phone || 'Lead'}</p>
              <p className="text-xs text-gray-400 mt-1">
                {lead.email || '-'} | score {lead.score} | {lead.status}
              </p>
              <div className="flex flex-wrap gap-1 mt-2">
                {(lead.segments || []).map((s) => (
                  <Badge key={`${lead.id}-${s}`} className="bg-white/10 text-gray-200 border-white/10">{s}</Badge>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                className="border-white/10 text-white hover:bg-white/5"
                onClick={() => quickAction(lead, 'followup')}
                disabled={processingLeadId === `${lead.id}-followup`}
              >
                {processingLeadId === `${lead.id}-followup` ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                Relancer
              </Button>
              <Button
                variant="outline"
                className="border-[#D4AF37]/40 text-[#D4AF37] hover:bg-[#D4AF37]/10"
                onClick={() => quickAction(lead, 'campaign')}
                disabled={processingLeadId === `${lead.id}-campaign`}
              >
                Campagne
              </Button>
              <Button
                className="bg-[#D4AF37] text-black hover:bg-amber-500"
                onClick={() => quickAction(lead, 'booking')}
                disabled={processingLeadId === `${lead.id}-booking`}
              >
                <CalendarPlus className="w-4 h-4 mr-2" />
                Proposer RDV
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
