import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useAdminDashboard } from '@/hooks/useAdmin';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Users,
  BookOpen,
  GraduationCap,
  CreditCard,
  RefreshCw,
  Activity,
  Bell,
  CheckCircle,
  XCircle,
  FileCheck,
  AlertTriangle,
  History,
  Download,
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { motion } from 'framer-motion';
import { useToast } from '@/components/ui/use-toast';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import DashboardLiveSessionsPanel from '@/components/live/DashboardLiveSessionsPanel';

const isMissingRelationError = (error) => {
  const code = String(error?.code || '');
  const msg = String(error?.message || '').toLowerCase();
  return code === '42P01' || code === 'PGRST205' || msg.includes('does not exist') || msg.includes('could not find the table');
};

const SecretariatOverview = () => {
  const { stats: dashboardStats, activities, loading, error, refresh } = useAdminDashboard();
  const { supabase: supabaseClient, session, user } = useAuth();
  const { toast } = useToast();
  const [administrativeQueue, setAdministrativeQueue] = useState([]);
  const [taskLoading, setTaskLoading] = useState({});
  const [recentlyProcessed, setRecentlyProcessed] = useState([]);
  const [queueLoading, setQueueLoading] = useState(true);
  const [dismissedAlerts, setDismissedAlerts] = useState([]);
  const [currentDate, setCurrentDate] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentDate(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const loadQueue = useCallback(async () => {
    setQueueLoading(true);
    try {
      const [billingRes, pendingEnrollmentsRes] = await Promise.all([
        supabaseClient
          .from('billing_subscriptions')
          .select('id,user_id,status,expires_at')
          .in('status', ['past_due', 'expired'])
          .limit(50),
        supabaseClient
          .from('student_progress')
          .select('id,status,created_at,user_id,courses(title)')
          .in('status', ['pending', 'active'])
          .order('created_at', { ascending: false })
          .limit(6),
      ]);

      const billingRows = isMissingRelationError(billingRes.error) ? [] : (billingRes.data || []);
      const pendingRows = isMissingRelationError(pendingEnrollmentsRes.error) ? [] : (pendingEnrollmentsRes.data || []);
      const actorIds = [...new Set([...billingRows.map((r) => r.user_id), ...pendingRows.map((r) => r.user_id)].filter(Boolean))];
      let profileMap = {};
      if (actorIds.length > 0) {
        const { data: profileRows } = await supabaseClient.from('profiles').select('id,name,email').in('id', actorIds);
        profileMap = Object.fromEntries((profileRows || []).map((p) => [p.id, p.name || p.email || p.id]));
      }

      const queueItems = [
        ...pendingRows.map((row) => ({
          id: `enr-${row.id}`,
          targetId: row.id,
          type: 'inscription',
          title: row.courses?.title || 'Formation',
          subject: profileMap[row.user_id] || 'Étudiant',
          status: row.status || 'pending',
          date: row.created_at || new Date().toISOString(),
          actionLabel: 'Traiter',
        })),
        ...billingRows.slice(0, 6).map((row) => ({
          id: `bill-${row.id}`,
          targetId: row.id,
          type: 'facturation',
          title: 'Abonnement à régulariser',
          subject: profileMap[row.user_id] || 'Client',
          status: row.status || 'past_due',
          date: row.expires_at || new Date().toISOString(),
          actionLabel: 'Relancer',
        })),
      ]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 8);
      setAdministrativeQueue(queueItems);
    } catch {
      setAdministrativeQueue([]);
    } finally {
      setQueueLoading(false);
    }
  }, [supabaseClient]);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  const callSecretariatAction = async (endpoint, payload) => {
    const token = session?.access_token;
    if (!token) throw new Error('Session expirée.');
    const res = await fetch(`/.netlify/functions/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || 'Action impossible');
    return data;
  };

  const handleTaskAction = async (task) => {
    setTaskLoading((prev) => ({ ...prev, [task.id]: true }));
    try {
      if (task.type === 'inscription') {
        await callSecretariatAction('secretariat-process-enrollment', { enrollmentId: task.targetId, nextStatus: 'active' });
        toast({ title: 'Inscription traitée', description: `${task.subject} est maintenant actif.` });
      } else {
        await callSecretariatAction('secretariat-mark-billing-followup', { subscriptionId: task.targetId });
        toast({ title: 'Relance enregistrée', description: `Suivi facturation appliqué pour ${task.subject}.` });
      }
      setAdministrativeQueue((prev) => prev.filter((item) => item.id !== task.id));
      setRecentlyProcessed((prev) => [
        { id: task.id, type: task.type, subject: task.subject, processedBy: user?.name || user?.email || 'Secrétariat', processedAt: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) },
        ...prev.slice(0, 9),
      ]);
      await refresh();
    } catch (err) {
      toast({ title: 'Action impossible', description: err?.message || 'Réessaie.', variant: 'destructive' });
    } finally {
      setTaskLoading((prev) => ({ ...prev, [task.id]: false }));
    }
  };

  const handleDismissTask = (task) => {
    setAdministrativeQueue((prev) => prev.filter((item) => item.id !== task.id));
    toast({ title: 'Tâche retirée', description: `${task.subject} retiré de la file.` });
  };

  const handleRefresh = async () => {
    await Promise.all([refresh(), loadQueue()]);
  };

  const handleExport = () => {
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.setTextColor(212, 175, 55);
    doc.text('Secrétariat - Rapport Dashboard', 14, 22);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Généré le: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, 30);
    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text('Statistiques', 14, 45);
    const statsData = [
      ['Total Étudiants', dashboardStats.usersCount || 0],
      ['Formations Actives', dashboardStats.publishedFormations || 0],
      ['Formations Publiées', dashboardStats.publishedFormations || 0],
    ];
    doc.autoTable({ startY: 50, head: [['Métrique', 'Valeur']], body: statsData });
    doc.save(`secretariat-report-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  };

  const stats = {
    totalStudents: dashboardStats.usersCount || 0,
    activeToday: dashboardStats.activityCount24h || 0,
    publishedFormations: dashboardStats.publishedFormations || 0,
    confirmedPayments: dashboardStats.confirmedPayments || 0,
    pendingWebhooks: dashboardStats.pendingWebhooks || 0,
  };

  const alertsRaw = [
    dashboardStats.pendingWebhooks > 0 ? { id: 'webhooks', title: 'Webhooks en attente', message: `${dashboardStats.pendingWebhooks} non traités`, severity: 'high' } : null,
    administrativeQueue.length > 5 ? { id: 'queue', title: 'File d\'attente', message: `${administrativeQueue.length} demandes à traiter`, severity: 'medium' } : null,
  ].filter(Boolean);
  const alerts = alertsRaw.filter((a) => !dismissedAlerts.includes(a.id));
  const dismissAlert = (id) => setDismissedAlerts((prev) => [...prev, id]);
  const getAlertColor = (s) => (s === 'high' ? 'border-red-500/30 bg-red-500/10 text-red-200' : 'border-amber-500/30 bg-amber-500/10 text-amber-200');

  const trendMap = (() => {
    const out = {};
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      out[d.toISOString().slice(0, 10)] = { date: format(d, 'dd/MM', { locale: fr }), count: 0 };
    }
    (activities || []).forEach((a) => {
      const key = String(a.created_at || '').slice(0, 10);
      if (out[key]) out[key].count += 1;
    });
    return Object.values(out);
  })();

  const statCards = [
    { title: 'Total Étudiants', value: stats.totalStudents || 0, icon: Users, color: 'text-blue-400', bg: 'bg-blue-500/10' },
    { title: 'Actifs Aujourd\'hui', value: stats.activeToday || 0, icon: Activity, color: 'text-green-400', bg: 'bg-green-500/10' },
    { title: 'Formations Publiées', value: stats.publishedFormations || 0, icon: BookOpen, color: 'text-purple-400', bg: 'bg-purple-500/10' },
    { title: 'Paiements Confirmés', value: stats.confirmedPayments || 0, icon: CreditCard, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    { title: 'Webhooks en attente', value: stats.pendingWebhooks || 0, icon: Activity, color: 'text-amber-400', bg: 'bg-amber-500/10' },
    { title: 'Demandes à traiter', value: administrativeQueue.length || 0, icon: FileCheck, color: 'text-[#D4AF37]', bg: 'bg-[#D4AF37]/10' },
  ];

  const recentActivities = (activities || []).slice(0, 10).map((a) => ({
    id: a.id,
    description: `${String(a.action || '').toUpperCase()} sur ${a.resource_type || 'ressource'}`,
    details: { user: a.profiles?.full_name || a.user_id || 'Système', item: a.resource_id ? `#${String(a.resource_id).slice(0, 8)}` : '' },
    timestamp: a.created_at,
    type: String(a.action || 'event'),
  }));

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header - même style que Owner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-[#192734] p-6 rounded-xl border border-white/10">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">Aperçu Secrétariat <span className="text-[#D4AF37]">.</span></h1>
          <p className="text-gray-400 text-sm mt-1 capitalize">{format(currentDate, 'EEEE d MMMM yyyy • HH:mm', { locale: fr })}</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
          <Button variant="outline" onClick={handleRefresh} className="border-white/10 text-white hover:bg-white/5 w-full sm:w-auto" disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Actualiser
          </Button>
          <Button onClick={handleExport} className="bg-[#D4AF37] text-black hover:bg-yellow-500 font-bold w-full sm:w-auto">
            <Download className="w-4 h-4 mr-2" /> Rapport
          </Button>
        </div>
      </div>

      <DashboardLiveSessionsPanel />

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {statCards.map((stat, idx) => (
          <motion.div key={idx} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }}>
            <Card className="bg-[#192734] border-white/10 hover:border-[#D4AF37]/30 transition-all group">
              <CardContent className="p-5 flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-xs font-medium uppercase tracking-wider">{stat.title}</p>
                  <p className="text-2xl font-bold text-white mt-1 group-hover:text-[#D4AF37] transition-colors">{stat.value}</p>
                </div>
                <div className={`p-3 rounded-xl ${stat.bg}`}>
                  <stat.icon className={`w-6 h-6 ${stat.color}`} />
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart */}
        <Card className="lg:col-span-2 bg-[#192734] border-white/10">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Activity className="w-5 h-5 text-[#D4AF37]" /> Tendances d'Activité (7 jours)
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendMap}>
                <defs>
                  <linearGradient id="colorSecActivity" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#D4AF37" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#D4AF37" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                <XAxis dataKey="date" stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ backgroundColor: '#15202B', border: '1px solid #ffffff20', borderRadius: '8px', color: '#fff' }} />
                <Area type="monotone" dataKey="count" stroke="#D4AF37" strokeWidth={2} fillOpacity={1} fill="url(#colorSecActivity)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Demandes à traiter + Alertes */}
        <div className="space-y-6">
          <Card className="bg-[#192734] border-white/10">
            <CardHeader className="pb-2">
              <CardTitle className="text-white flex items-center gap-2 text-base">
                <FileCheck className="w-4 h-4 text-[#D4AF37]" /> Demandes à traiter
                {administrativeQueue.length > 0 && <Badge className="ml-auto bg-[#D4AF37] text-black">{administrativeQueue.length}</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[220px] pr-4">
                {queueLoading ? (
                  <div className="flex items-center justify-center py-8 text-gray-400">
                    <RefreshCw className="w-6 h-6 animate-spin" />
                  </div>
                ) : administrativeQueue.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-gray-500">
                    <CheckCircle className="w-10 h-10 mb-2 opacity-20" />
                    <p className="text-sm">Aucune demande urgente</p>
                  </div>
                ) : (
                  administrativeQueue.map((task) => (
                    <div key={task.id} className="p-3 rounded-lg border border-white/10 bg-white/5 mb-2 flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-3 text-xs text-gray-400">
                          {task.type === 'facturation' ? <CreditCard className="w-3.5 h-3.5 text-amber-400" /> : <AlertTriangle className="w-3.5 h-3.5 text-[#D4AF37]" />}
                          {task.type}
                        </div>
                        <p className="text-white font-medium truncate">{task.title}</p>
                        <p className="text-gray-400 text-xs truncate">{task.subject}</p>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Button
                          size="sm"
                          className="bg-[#D4AF37] text-black hover:bg-amber-500 h-8 text-xs"
                          onClick={() => handleTaskAction(task)}
                          disabled={Boolean(taskLoading[task.id])}
                        >
                          {taskLoading[task.id] ? <RefreshCw className="w-3 h-3 animate-spin" /> : task.actionLabel}
                        </Button>
                        <Button size="sm" variant="ghost" className="text-gray-400 h-8 hover:bg-white/5" onClick={() => handleDismissTask(task)}>
                          <XCircle className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </ScrollArea>
            </CardContent>
          </Card>

          <Card className="bg-[#192734] border-white/10">
            <CardHeader className="pb-2">
              <CardTitle className="text-white flex items-center gap-2 text-base">
                <Bell className="w-4 h-4 text-red-400" /> Alertes
                {alerts.length > 0 && <Badge variant="destructive" className="ml-auto">{alerts.length}</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[120px] pr-4">
                {alerts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-6 text-gray-500">
                    <CheckCircle className="w-8 h-8 mb-2 opacity-20" />
                    <p className="text-sm">Tout semble normal</p>
                  </div>
                ) : (
                  alerts.map((alert) => (
                    <div key={alert.id} className={`p-3 rounded-lg border flex items-start justify-between gap-3 mb-2 ${getAlertColor(alert.severity)}`}>
                      <div>
                        <p className="font-bold text-sm">{alert.title}</p>
                        <p className="text-xs opacity-80">{alert.message}</p>
                      </div>
                      <button onClick={() => dismissAlert(alert.id)} className="hover:bg-black/10 p-1 rounded">
                        <XCircle className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                )}
              </ScrollArea>
            </CardContent>
          </Card>

          {recentlyProcessed.length > 0 && (
            <Card className="bg-[#192734] border-white/10">
              <CardHeader className="pb-2">
                <CardTitle className="text-white flex items-center gap-2 text-base">
                  <History className="w-4 h-4 text-[#D4AF37]" /> Dernières actions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {recentlyProcessed.slice(0, 4).map((item) => (
                    <li key={item.id} className="text-sm text-gray-400 flex justify-between gap-2">
                      <span><span className="text-[#D4AF37]">{item.type}</span> — {item.subject}</span>
                      <span className="text-gray-500 text-xs">{item.processedAt}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Activité récente */}
      <Card className="bg-[#192734] border-white/10">
        <CardHeader>
          <CardTitle className="text-white">Activité Récente</CardTitle>
          {error ? <p className="text-xs text-red-300">Erreur: {String(error?.message || error)}</p> : null}
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-gray-400">
              <thead className="text-sm text-gray-500 uppercase bg-[#0F1419]/50">
                <tr>
                  <th className="px-6 py-3">Action</th>
                  <th className="px-6 py-3">Utilisateur / Élément</th>
                  <th className="px-6 py-3">Date</th>
                  <th className="px-6 py-3">Type</th>
                </tr>
              </thead>
              <tbody>
                {recentActivities.map((act) => (
                  <tr key={act.id} className="border-b border-white/5 hover:bg-white/5">
                    <td className="px-6 py-4 font-medium text-white">{act.description}</td>
                    <td className="px-6 py-4">
                      {act.details?.user && <div className="text-white">{act.details.user}</div>}
                      {act.details?.item && <div className="text-[#D4AF37] text-xs">{act.details.item}</div>}
                    </td>
                    <td className="px-6 py-4">{format(new Date(act.timestamp), 'dd MMM HH:mm', { locale: fr })}</td>
                    <td className="px-6 py-4">
                      <Badge variant="outline" className="border-white/10 bg-white/5 text-gray-300">{act.type.replace(/_/g, ' ')}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {recentActivities.length === 0 && <div className="text-center py-8 text-gray-500">Aucune activité récente.</div>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SecretariatOverview;
