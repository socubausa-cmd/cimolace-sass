import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { Link } from 'react-router-dom';
import { useAdminDashboard } from '@/hooks/useAdmin';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Users, BookOpen, GraduationCap, Video, FileText, CreditCard, Clock3, Download, RefreshCw, Activity, CheckCircle, XCircle, Plus, Bell, Sparkles, Link2, Workflow, CalendarDays } from 'lucide-react';
import { 
  LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, 
  CartesianGrid, Tooltip, ResponsiveContainer, Cell 
} from 'recharts';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { motion } from 'framer-motion';

const HOVER_LIFT = { y: -4 };
const TAP_SOFT = { scale: 0.99 };
const FADE_UP = { duration: 0.22, ease: 'easeOut' };

const OwnerDashboardOverview = () => {
  const { stats: dashboardStats, activities, loading, error, refresh } = useAdminDashboard();
  const [details, setDetails] = useState({
    totalModules: 0,
    totalVideos: 0,
    totalQuizzes: 0,
  });
  const [dismissedAlerts, setDismissedAlerts] = useState([]);
  const [currentDate, setCurrentDate] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentDate(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let alive = true;
    const loadDetails = async () => {
      const [modulesRes, videosRes, quizzesRes] = await Promise.all([
        supabase.from('modules').select('id', { count: 'exact', head: true }),
        supabase.from('formation_day_contents').select('id', { count: 'exact', head: true }).eq('type', 'video'),
        supabase.from('formation_day_contents').select('id', { count: 'exact', head: true }).eq('type', 'quiz'),
      ]);

      if (!alive) return;
      setDetails({
        totalModules: modulesRes.error ? 0 : Number(modulesRes.count || 0),
        totalVideos: videosRes.error ? 0 : Number(videosRes.count || 0),
        totalQuizzes: quizzesRes.error ? 0 : Number(quizzesRes.count || 0),
      });
    };
    loadDetails();
    return () => {
      alive = false;
    };
  }, [dashboardStats.activityCount24h]);

  const handleRefresh = async () => {
    await refresh();
  };

  const stats = {
    totalStudents: dashboardStats.usersCount || 0,
    activeToday: dashboardStats.activityCount24h || 0,
    publishedFormations: dashboardStats.publishedFormations || 0,
    totalRevenue: Number(dashboardStats.revenueConfirmed || 0).toFixed(2),
    confirmedPayments: dashboardStats.confirmedPayments || 0,
    pendingWebhooks: dashboardStats.pendingWebhooks || 0,
    totalModules: details.totalModules || 0,
    totalVideos: details.totalVideos || 0,
    totalQuizzes: details.totalQuizzes || 0,
  };

  const alertsRaw = [
    dashboardStats.pendingWebhooks > 0
      ? {
          id: 'pending-webhooks',
          title: 'Webhooks en attente',
          message: `${dashboardStats.pendingWebhooks} webhook(s) non traités.`,
          severity: 'high',
        }
      : null,
    dashboardStats.systemStatus === 'Alerte'
      ? {
          id: 'system-alert',
          title: 'Système en alerte',
          message: 'Vérifie les paiements et logs de webhook.',
          severity: 'high',
        }
      : null,
    dashboardStats.confirmedPayments === 0
      ? {
          id: 'no-payments',
          title: 'Aucun paiement confirmé récent',
          message: 'Contrôle les méthodes de paiement et le tunnel checkout.',
          severity: 'medium',
        }
      : null,
  ].filter(Boolean);

  const alerts = alertsRaw.filter((a) => !dismissedAlerts.includes(a.id));
  const dismissAlert = (id) => setDismissedAlerts((prev) => [...prev, id]);
  const getAlertColor = (severity) => {
    if (severity === 'high') return 'border-red-500/30 bg-red-500/10 text-red-200';
    if (severity === 'medium') return 'border-violet-500/30 bg-violet-500/10 text-violet-200';
    return 'border-blue-500/30 bg-blue-500/10 text-blue-200';
  };

  const trendMap = (() => {
    const out = {};
    const now = new Date();
    for (let i = 6; i >= 0; i -= 1) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      out[key] = { date: format(d, 'dd/MM', { locale: fr }), count: 0 };
    }
    (activities || []).forEach((a) => {
      const key = String(a.created_at || '').slice(0, 10);
      if (out[key]) out[key].count += 1;
    });
    return Object.values(out);
  })();

  const handleExport = () => {
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(20);
    doc.setTextColor(123, 97, 255); // #7B61FF
    doc.text('Prorascience - Rapport Dashboard', 14, 22);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Généré le: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, 30);
    
    // Stats
    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text('Statistiques Clés', 14, 45);
    
    const statsData = [
      ['Total Étudiants', stats.totalStudents],
      ['Formations Actives', stats.publishedFormations],
      ['Paiements Confirmés', stats.confirmedPayments],
      ['Revenus', `${stats.totalRevenue} €`]
    ];

    doc.autoTable({
      startY: 50,
      head: [['Métrique', 'Valeur']],
      body: statsData,
    });

    // Alerts
    if (alerts.length > 0) {
      doc.text('Alertes en cours', 14, doc.lastAutoTable.finalY + 15);
      const alertsData = alerts.map(a => [a.title, a.message, a.severity]);
      doc.autoTable({
        startY: doc.lastAutoTable.finalY + 20,
        head: [['Titre', 'Message', 'Sévérité']],
        body: alertsData,
      });
    }

    doc.save(`dashboard-report-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  };

  const statCards = [
    { title: 'Total Étudiants', value: stats.totalStudents || 0, icon: Users, color: 'text-blue-400', bg: 'bg-blue-500/10' },
    { title: 'Actifs Aujourd\'hui', value: stats.activeToday || 0, icon: Activity, color: 'text-green-400', bg: 'bg-green-500/10' },
    { title: 'Formations Publiées', value: stats.publishedFormations || 0, icon: BookOpen, color: 'text-purple-400', bg: 'bg-purple-500/10' },
    { title: 'Paiements Confirmés', value: stats.confirmedPayments || 0, icon: CreditCard, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    { title: 'Webhooks en attente', value: stats.pendingWebhooks || 0, icon: Clock3, color: 'text-violet-400', bg: 'bg-violet-500/10' },
    { title: 'Modules', value: stats.totalModules || 0, icon: GraduationCap, color: 'text-violet-300', bg: 'bg-violet-500/10' },
    { title: 'Vidéos', value: stats.totalVideos || 0, icon: Video, color: 'text-pink-400', bg: 'bg-pink-500/10' },
    { title: 'Quizzes', value: stats.totalQuizzes || 0, icon: FileText, color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
  ];

  const recentActivities = (activities || []).slice(0, 10).map((a) => ({
    id: a.id,
    description: `${String(a.action || '').toUpperCase()} sur ${a.resource_type || 'ressource'}`,
    details: {
      user: a.profiles?.full_name || a.user_id || 'Système',
      item: a.resource_id ? `#${String(a.resource_id).slice(0, 8)}` : '',
    },
    timestamp: a.created_at,
    type: String(a.action || 'event'),
  }));

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 premium-panel p-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            Aperçu Rapide <span className="text-[#7B61FF]">.</span>
          </h1>
          <p className="text-gray-400 text-sm mt-1 capitalize">
            {format(currentDate, 'EEEE d MMMM yyyy • HH:mm', { locale: fr })}
          </p>
          <p className="text-[11px] text-[#7B61FF] mt-1">
            Source: Supabase live | build: owner-dashboard-20260318-3
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleRefresh} className="border-white/10 text-white hover:bg-white/5" disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Actualiser
          </Button>
          <Button variant="accent" onClick={handleExport} className="font-bold">
            <Download className="w-4 h-4 mr-2" /> Rapport
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map((stat, idx) => (
          <motion.div 
            key={idx}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            whileHover={HOVER_LIFT}
            whileTap={TAP_SOFT}
          >
            <Card className="premium-panel border-white/10 hover:border-[#7B61FF]/35 transition-all group overflow-hidden">
              <CardContent className="relative p-5 flex items-center justify-between min-h-[108px]">
                <div className="pointer-events-none absolute -top-10 -right-10 h-24 w-24 rounded-full bg-[#7B61FF]/10 blur-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
                <div>
                  <p className="text-gray-400 text-xs font-medium uppercase tracking-wider">{stat.title}</p>
                  <p className="text-2xl font-bold text-white mt-1 group-hover:text-[#7B61FF] transition-colors">{stat.value}</p>
                </div>
                <div className={`p-3 rounded-xl border border-white/10 ${stat.bg}`}>
                  <stat.icon className={`w-6 h-6 ${stat.color} group-hover:scale-110 transition-transform`} />
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Chart Area */}
        <Card className="lg:col-span-2 premium-panel border-white/10 hover:border-[#7B61FF]/30 transition-colors">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Activity className="w-5 h-5 text-[#7B61FF]" /> Tendances d'Activité (7 jours)
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendMap}>
                <defs>
                  <linearGradient id="colorActivity" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#7B61FF" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#7B61FF" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                <XAxis dataKey="date" stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#15202B', border: '1px solid #ffffff20', borderRadius: '8px', color: '#fff' }}
                />
                <Area type="monotone" dataKey="count" stroke="#7B61FF" strokeWidth={2} fillOpacity={1} fill="url(#colorActivity)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Alerts & Quick Actions */}
        <div className="space-y-6">
          <Card className="premium-panel border-white/10 hover:border-[#7B61FF]/30 transition-colors flex-1">
             <CardHeader className="pb-2">
               <CardTitle className="text-white flex items-center gap-2 text-base">
                 <Bell className="w-4 h-4 text-red-400" /> Alertes Importantes
                 {alerts.length > 0 && <Badge variant="destructive" className="ml-auto">{alerts.length}</Badge>}
               </CardTitle>
             </CardHeader>
             <CardContent className="space-y-3">
               <ScrollArea className="h-[200px] pr-4">
                 {alerts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-500 py-8">
                       <CheckCircle className="w-10 h-10 mb-2 opacity-20" />
                       <p className="text-sm">Tout semble normal</p>
                    </div>
                 ) : (
                    alerts.map(alert => (
                       <div key={alert.id} className={`p-3 rounded-xl border flex items-start justify-between gap-3 mb-2 backdrop-blur-sm ${getAlertColor(alert.severity)}`}>
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

          <Card className="premium-panel border-white/10 hover:border-[#7B61FF]/30 transition-colors">
             <CardHeader className="pb-2">
               <CardTitle className="text-white text-base">Actions Rapides</CardTitle>
             </CardHeader>
             <CardContent className="grid grid-cols-2 gap-2">
                <motion.button
                  whileHover={{ y: -2, scale: 1.01 }}
                  whileTap={TAP_SOFT}
                  transition={FADE_UP}
                  className="group rounded-xl border border-white/10 bg-[#0F1419]/70 text-white hover:border-[#7B61FF]/40 hover:bg-[#7B61FF]/10 text-xs h-auto py-3 px-3 text-left transition-all duration-200"
                >
                  <span className="inline-flex items-center">
                    <Plus className="w-3 h-3 mr-2 text-[#7B61FF]" /> Formation
                  </span>
                </motion.button>
                <motion.button
                  whileHover={{ y: -2, scale: 1.01 }}
                  whileTap={TAP_SOFT}
                  transition={FADE_UP}
                  className="group rounded-xl border border-white/10 bg-[#0F1419]/70 text-white hover:border-[#7B61FF]/40 hover:bg-[#7B61FF]/10 text-xs h-auto py-3 px-3 text-left transition-all duration-200"
                >
                  <span className="inline-flex items-center">
                    <Users className="w-3 h-3 mr-2 text-[#7B61FF]" /> Etudiant
                  </span>
                </motion.button>
                <motion.button
                  whileHover={{ y: -2, scale: 1.01 }}
                  whileTap={TAP_SOFT}
                  transition={FADE_UP}
                  className="group rounded-xl border border-white/10 bg-[#0F1419]/70 text-white hover:border-[#7B61FF]/40 hover:bg-[#7B61FF]/10 text-xs h-auto py-3 px-3 text-left transition-all duration-200"
                >
                  <span className="inline-flex items-center">
                    <Activity className="w-3 h-3 mr-2 text-[#7B61FF]" /> Coaching
                  </span>
                </motion.button>
                <motion.button
                  whileHover={{ y: -2, scale: 1.01 }}
                  whileTap={TAP_SOFT}
                  transition={FADE_UP}
                  className="group rounded-xl border border-white/10 bg-[#0F1419]/70 text-white hover:border-[#7B61FF]/40 hover:bg-[#7B61FF]/10 text-xs h-auto py-3 px-3 text-left transition-all duration-200"
                >
                  <span className="inline-flex items-center">
                    <FileText className="w-3 h-3 mr-2 text-[#7B61FF]" /> Quiz
                  </span>
                </motion.button>
                <Link to="/studio" className="col-span-2">
                  <motion.div whileHover={{ y: -2 }} whileTap={TAP_SOFT} transition={FADE_UP}>
                    <Button
                      variant="outline"
                      className="w-full border-[#7B61FF]/40 text-[#c4b5fd] hover:bg-[#7B61FF] hover:text-white justify-start text-xs h-auto py-3 shadow-lg shadow-[#7B61FF]/10 transition-all duration-200"
                    >
                       <Sparkles className="w-3 h-3 mr-2" /> Studio Createur
                    </Button>
                  </motion.div>
                </Link>
                <Link to="/admin/billing?tab=external" className="col-span-2">
                  <motion.div whileHover={{ y: -2 }} whileTap={TAP_SOFT} transition={FADE_UP}>
                    <Button
                      variant="outline"
                      className="w-full border-emerald-500/40 text-emerald-300 hover:bg-emerald-500 hover:text-black justify-start text-xs h-auto py-3 shadow-lg shadow-emerald-500/10 transition-all duration-200"
                    >
                      <Link2 className="w-3 h-3 mr-2" /> Chariow Externes
                    </Button>
                  </motion.div>
                </Link>
                <Link to="/admin/marketing?tab=automation" className="col-span-2">
                  <motion.div whileHover={{ y: -2 }} whileTap={TAP_SOFT} transition={FADE_UP}>
                    <Button
                      variant="outline"
                      className="w-full border-violet-500/40 text-violet-300 hover:bg-violet-500 hover:text-black justify-start text-xs h-auto py-3 shadow-lg shadow-violet-500/10 transition-all duration-200"
                    >
                      <Workflow className="w-3 h-3 mr-2" /> Marketing &amp; automation
                    </Button>
                  </motion.div>
                </Link>
                <Link to="/appointment/request" className="col-span-2">
                  <motion.div whileHover={{ y: -2 }} whileTap={TAP_SOFT} transition={FADE_UP}>
                    <Button
                      variant="outline"
                      className="w-full border-sky-500/40 text-sky-200 hover:bg-sky-500 hover:text-black justify-start text-xs h-auto py-3 shadow-lg shadow-sky-500/10 transition-all duration-200"
                    >
                      <CalendarDays className="w-3 h-3 mr-2" /> Calendrier — prise de RDV
                    </Button>
                  </motion.div>
                </Link>
             </CardContent>
          </Card>
        </div>
      </div>

      {/* Recent Activity */}
      <Card className="premium-panel border-white/10 hover:border-[#7B61FF]/30 transition-colors">
        <CardHeader>
          <CardTitle className="text-white">Activité Récente</CardTitle>
          {error ? <p className="text-xs text-red-300">Erreur données: {String(error?.message || error)}</p> : null}
        </CardHeader>
        <CardContent>
          <div className="relative overflow-x-auto">
            <table className="w-full text-sm text-left text-gray-400">
              <thead className="text-sm text-gray-500 uppercase bg-[#0F1419]/60">
                <tr>
                  <th className="px-6 py-3">Action</th>
                  <th className="px-6 py-3">Utilisateur / Élément</th>
                  <th className="px-6 py-3">Date</th>
                  <th className="px-6 py-3">Type</th>
                </tr>
              </thead>
              <tbody>
                {recentActivities.map((act) => (
                  <tr key={act.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4 font-medium text-white">{act.description}</td>
                    <td className="px-6 py-4">
                       {act.details?.user && <div className="text-white">{act.details.user}</div>}
                       {act.details?.item && <div className="text-[#7B61FF] text-xs">{act.details.item}</div>}
                    </td>
                    <td className="px-6 py-4">{format(new Date(act.timestamp), 'dd MMM HH:mm', { locale: fr })}</td>
                    <td className="px-6 py-4">
                       <Badge variant="outline" className="border-white/10 bg-white/5 text-gray-300">
                         {act.type.replace(/_/g, ' ')}
                       </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {recentActivities.length === 0 && (
               <div className="text-center py-8 text-gray-500">Aucune activité récente.</div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default OwnerDashboardOverview;