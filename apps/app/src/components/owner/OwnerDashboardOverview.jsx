import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { Link } from 'react-router-dom';
import { useAdminDashboard } from '@/hooks/useAdmin';
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

/* ------------------------------------------------------------------ */
/*  Langage visuel « élève » — réf. src/pages/eleve-mobile/           */
/*  eleveMobileScreensShared.js + vieScolaire/vieScolaireSharedUI.jsx */
/* ------------------------------------------------------------------ */
const EV_MUTED = '#8E8E93';
const EV_ACCENT = '#7B61FF';
const EV_LAVENDER = '#c4b5fd';
const EV_CREAM = '#fbf3df';
const EV_PAGE_AMBIENT =
  'radial-gradient(50% 32% at 50% 0%, rgba(123, 97, 255, 0.14), transparent 70%)';

// Surface « panneau » (en-tête, graphe, alertes, tableau) — réf. pagePanelSurface()
const panelSurface = {
  background: [
    'radial-gradient(ellipse 100% 80% at 0% 0%, rgba(99, 102, 241, 0.12) 0%, transparent 55%)',
    'linear-gradient(195deg, rgba(20, 22, 40, 0.96) 0%, rgba(8, 10, 20, 0.98) 100%)',
  ].join(', '),
  border: '1px solid rgba(165, 180, 252, 0.14)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05), 0 4px 16px -4px rgba(0,0,0,0.4)',
};

// Surface « carte liste » (cartes stats, tuiles actions) — réf. listCardSurface()
const cardSurface = {
  background: [
    'radial-gradient(ellipse 90% 70% at 8% 0%, rgba(123, 97, 255, 0.1) 0%, transparent 50%)',
    'linear-gradient(198deg, rgba(22, 24, 38, 0.95) 0%, rgba(12, 14, 24, 0.99) 100%)',
  ].join(', '),
  border: '1px solid rgba(255,255,255,0.08)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), 0 2px 14px -4px rgba(0,0,0,0.4)',
};

// Palette de tons — barre latérale dégradée + puce d'icône + halo coloré (réf. TONE de StatBox)
const TONES = {
  violet: { from: '#7c5cff', to: '#5b3dcf', rgb: '124, 92, 255' },
  emerald: { from: '#10b981', to: '#047857', rgb: '16, 185, 129' },
  indigo: { from: '#6366f1', to: '#4338ca', rgb: '99, 102, 241' },
  amber: { from: '#f59e0b', to: '#b45309', rgb: '245, 158, 11' },
  sky: { from: '#38bdf8', to: '#0369a1', rgb: '56, 189, 248' },
  rose: { from: '#fb7185', to: '#be123c', rgb: '251, 113, 133' },
  blue: { from: '#3b82f6', to: '#1d4ed8', rgb: '59, 130, 246' },
  green: { from: '#22c55e', to: '#15803d', rgb: '34, 197, 94' },
};

function toneGlow(rgb) {
  return `0 0 24px -6px rgba(${rgb}, 0.22), inset 0 1px 0 rgba(255,255,255,0.05), 0 2px 14px -4px rgba(0,0,0,0.4)`;
}

/** Tuile « action rapide » — puce d'icône dégradée + libellé, surface liste élève. */
function QuickAction({ icon: Icon, label, tone = 'violet', to, full, onClick }) {
  const t = TONES[tone] || TONES.violet;
  const inner = (
    <motion.div
      whileHover={{ y: -2 }}
      whileTap={TAP_SOFT}
      transition={FADE_UP}
      className="flex h-full items-center gap-2.5 rounded-[16px] p-2.5"
      style={cardSurface}
    >
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
        style={{
          background: `linear-gradient(140deg, ${t.from} 0%, ${t.to} 100%)`,
          boxShadow: `0 8px 18px -8px rgba(${t.rgb}, 0.55)`,
        }}
      >
        <Icon className="h-[17px] w-[17px] text-white" strokeWidth={2.2} />
      </div>
      <span className="truncate text-[12.5px] font-bold text-white/90">{label}</span>
    </motion.div>
  );
  if (to) {
    return (
      <Link to={to} className={full ? 'col-span-2 block' : 'block'}>
        {inner}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={`block text-left ${full ? 'col-span-2' : ''}`}>
      {inner}
    </button>
  );
}

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
    { title: 'Total Étudiants', value: stats.totalStudents || 0, icon: Users, tone: 'violet' },
    { title: 'Actifs Aujourd\'hui', value: stats.activeToday || 0, icon: Activity, tone: 'emerald' },
    { title: 'Formations Publiées', value: stats.publishedFormations || 0, icon: BookOpen, tone: 'indigo' },
    { title: 'Paiements Confirmés', value: stats.confirmedPayments || 0, icon: CreditCard, tone: 'green' },
    { title: 'Webhooks en attente', value: stats.pendingWebhooks || 0, icon: Clock3, tone: 'amber' },
    { title: 'Modules', value: stats.totalModules || 0, icon: GraduationCap, tone: 'sky' },
    { title: 'Vidéos', value: stats.totalVideos || 0, icon: Video, tone: 'rose' },
    { title: 'Quizzes', value: stats.totalQuizzes || 0, icon: FileText, tone: 'blue' },
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
    <div
      className="space-y-6 animate-in fade-in duration-500"
      style={{ backgroundImage: EV_PAGE_AMBIENT }}
    >
      {/* Header */}
      <div
        className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 rounded-[20px] p-6"
        style={panelSurface}
      >
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white flex items-center gap-1.5">
            Aperçu Rapide <span style={{ color: EV_LAVENDER }}>.</span>
          </h1>
          <p className="text-sm mt-1 capitalize" style={{ color: EV_MUTED }}>
            {format(currentDate, 'EEEE d MMMM yyyy • HH:mm', { locale: fr })}
          </p>
          <p className="text-[11px] mt-1" style={{ color: EV_LAVENDER }}>
            Source: Supabase live | build: owner-dashboard-eleve-20260614
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="inline-flex h-10 items-center gap-2 rounded-[14px] border border-white/10 bg-white/[0.04] px-4 text-[13px] font-bold text-white/80 transition-colors hover:bg-white/[0.08] disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Actualiser
          </button>
          <button
            onClick={handleExport}
            className="inline-flex h-10 items-center gap-2 rounded-[14px] px-4 text-[13px] font-bold text-white transition-transform active:scale-[0.98]"
            style={{
              background: `linear-gradient(90deg, ${EV_ACCENT} 0%, #3b41de 100%)`,
              boxShadow: '0 8px 28px -6px rgba(123, 97, 255, 0.42), inset 0 1px 0 rgba(255,255,255,0.18)',
            }}
          >
            <Download className="w-4 h-4" /> Rapport
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map((stat, idx) => {
          const t = TONES[stat.tone] || TONES.violet;
          return (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              whileHover={HOVER_LIFT}
              whileTap={TAP_SOFT}
            >
              <div
                className="relative flex min-h-[112px] flex-col justify-between overflow-hidden rounded-[20px] p-4"
                style={{ ...cardSurface, boxShadow: toneGlow(t.rgb) }}
              >
                <div
                  aria-hidden
                  className="pointer-events-none absolute left-0 top-0 h-full w-[3px]"
                  style={{ background: `linear-gradient(180deg, ${t.from} 0%, ${t.to}22 100%)` }}
                />
                <div className="flex items-start justify-between gap-2 pl-2">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider" style={{ color: EV_MUTED }}>
                    {stat.title}
                  </span>
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl"
                    style={{
                      background: `linear-gradient(140deg, ${t.from} 0%, ${t.to} 100%)`,
                      boxShadow: `0 8px 20px -8px rgba(${t.rgb}, 0.55)`,
                    }}
                  >
                    <stat.icon className="h-[18px] w-[18px] text-white" strokeWidth={2.1} />
                  </div>
                </div>
                <p
                  className="mt-2 truncate pl-2 font-serif text-3xl font-extrabold tabular-nums leading-none tracking-tight"
                  style={{ color: EV_CREAM }}
                >
                  {stat.value}
                </p>
              </div>
            </motion.div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Chart Area */}
        <div className="lg:col-span-2 rounded-[20px] p-6" style={panelSurface}>
          <h2 className="text-white font-bold flex items-center gap-2 mb-4">
            <Activity className="w-5 h-5" style={{ color: EV_ACCENT }} /> Tendances d'Activité (7 jours)
          </h2>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendMap}>
                <defs>
                  <linearGradient id="colorActivity" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#7B61FF" stopOpacity={0.35}/>
                    <stop offset="95%" stopColor="#7B61FF" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis dataKey="date" stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#16161E', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', color: '#fff' }}
                />
                <Area type="monotone" dataKey="count" stroke="#7B61FF" strokeWidth={2} fillOpacity={1} fill="url(#colorActivity)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Alerts & Quick Actions */}
        <div className="space-y-6">
          <div className="rounded-[20px] p-5" style={panelSurface}>
            <h3 className="text-white flex items-center gap-2 text-base font-bold mb-3">
              <Bell className="w-4 h-4 text-red-400" /> Alertes Importantes
              {alerts.length > 0 && <Badge variant="destructive" className="ml-auto">{alerts.length}</Badge>}
            </h3>
            <ScrollArea className="h-[200px] pr-4">
              {alerts.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full py-8" style={{ color: EV_MUTED }}>
                   <CheckCircle className="w-10 h-10 mb-2 opacity-20" />
                   <p className="text-sm">Tout semble normal</p>
                </div>
              ) : (
                alerts.map(alert => (
                   <div key={alert.id} className={`p-3 rounded-[14px] border flex items-start justify-between gap-3 mb-2 backdrop-blur-sm ${getAlertColor(alert.severity)}`}>
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
          </div>

          <div className="rounded-[20px] p-5" style={panelSurface}>
            <h3 className="text-white text-base font-bold mb-3">Actions Rapides</h3>
            <div className="grid grid-cols-2 gap-2">
              <QuickAction icon={Plus} label="Formation" tone="violet" />
              <QuickAction icon={Users} label="Etudiant" tone="blue" />
              <QuickAction icon={Activity} label="Coaching" tone="emerald" />
              <QuickAction icon={FileText} label="Quiz" tone="amber" />
              <QuickAction icon={Sparkles} label="Studio Createur" tone="violet" to="/studio" full />
              <QuickAction icon={Link2} label="Chariow Externes" tone="emerald" to="/admin/billing?tab=external" full />
              <QuickAction icon={Workflow} label="Marketing & automation" tone="indigo" to="/admin/marketing?tab=automation" full />
              <QuickAction icon={CalendarDays} label="Calendrier — prise de RDV" tone="sky" to="/appointment/request" full />
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="rounded-[20px] p-6" style={panelSurface}>
        <h2 className="text-white font-bold mb-1">Activité Récente</h2>
        {error ? <p className="text-xs text-red-300 mb-2">Erreur données: {String(error?.message || error)}</p> : null}
        <div className="relative overflow-x-auto">
          <table className="w-full text-sm text-left" style={{ color: EV_MUTED }}>
            <thead className="text-sm uppercase bg-white/[0.03]" style={{ color: EV_MUTED }}>
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
                     {act.details?.item && <div className="text-xs" style={{ color: EV_LAVENDER }}>{act.details.item}</div>}
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
             <div className="text-center py-8" style={{ color: EV_MUTED }}>Aucune activité récente.</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OwnerDashboardOverview;
