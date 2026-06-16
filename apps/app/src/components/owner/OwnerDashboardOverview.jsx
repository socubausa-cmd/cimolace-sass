import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { Link } from 'react-router-dom';
import { useAdminDashboard } from '@/hooks/useAdmin';
import { useShellTint } from '@/lib/useShellTint';
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

const HOVER_LIFT = { y: -3 };
const TAP_SOFT = { scale: 0.99 };
const FADE_UP = { duration: 0.22, ease: 'easeOut' };

/* ------------------------------------------------------------------ */
/*  Thème CLAIR « Wix Studio » — contenu du dashboard owner.          */
/*  Canvas (#F4F5F7) fourni par le shell ; ici surfaces blanches.     */
/*  La sidebar LORI dark/gold et le branding ISNA ne changent PAS.    */
/* ------------------------------------------------------------------ */
// Teinte pilotée par le bouton du shell via variables CSS (cf. liri-brand-theme.css).
// Clair (défaut) = crème/blanc ; sombre = cartes #16161E + texte clair. Un seul jeu de styles.
const LT_TEXT = 'var(--lt-text)'; // primaire
const LT_SUB = 'var(--lt-sub)'; // secondaire
const LT_MUTED = 'var(--lt-muted)'; // atténué (labels)
const LT_BORDER = 'var(--lt-border)';
const LT_GOLD = 'var(--lt-gold)'; // accent ISNA décoratif
const LT_GOLD_INK = 'var(--lt-gold-ink)'; // or lisible (texte/lien) selon la teinte

// Surface « panneau » (en-tête, graphe, alertes, tableau).
const panelSurface = {
  background: 'var(--lt-card-bg)',
  border: '1px solid var(--lt-card-border)',
  boxShadow: 'var(--lt-card-shadow)',
};

// Surface « carte liste » (cartes stats, tuiles actions) — identique, contenue.
const cardSurface = {
  background: 'var(--lt-card-bg)',
  border: '1px solid var(--lt-card-border)',
  boxShadow: 'var(--lt-card-shadow)',
};

// Palette de tons — puce d'icône colorée (on la GARDE, ressort sur blanc).
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

/** Tuile « action rapide » — puce d'icône dégradée + libellé, surface liste élève. */
function QuickAction({ icon: Icon, label, tone = 'violet', to, full, onClick }) {
  const t = TONES[tone] || TONES.violet;
  const inner = (
    <motion.div
      whileHover={{ y: -2 }}
      whileTap={TAP_SOFT}
      transition={FADE_UP}
      className="flex h-full cursor-pointer items-center gap-2.5 rounded-[12px] p-2.5 transition-colors hover:bg-black/[0.02]"
      style={cardSurface}
    >
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px]"
        style={{
          background: `linear-gradient(140deg, ${t.from} 0%, ${t.to} 100%)`,
          boxShadow: `0 4px 10px -4px rgba(${t.rgb}, 0.5)`,
        }}
      >
        <Icon className="h-[16px] w-[16px] text-white" strokeWidth={2.2} />
      </div>
      <span className="truncate text-[12.5px] font-semibold" style={{ color: LT_TEXT }}>{label}</span>
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
  const [tint] = useShellTint();
  const chartDark = tint === 'dark'; // recharts : les attributs SVG stroke ne résolvent pas var() → bascule JS
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
    if (severity === 'high') return 'border-red-200 bg-red-50 text-red-800';
    if (severity === 'medium') return 'border-violet-200 bg-violet-50 text-violet-800';
    return 'border-blue-200 bg-blue-50 text-blue-800';
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
    <div className="space-y-5 animate-in fade-in duration-500">
      {/* Header */}
      <div
        className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 rounded-[14px] p-5"
        style={panelSurface}
      >
        <div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-1" style={{ color: LT_TEXT }}>
            Aperçu Rapide <span style={{ color: LT_GOLD }}>.</span>
          </h1>
          <p className="text-[13px] mt-0.5 capitalize" style={{ color: LT_SUB }}>
            {format(currentDate, 'EEEE d MMMM yyyy • HH:mm', { locale: fr })}
          </p>
          <p className="text-[11px] mt-0.5" style={{ color: LT_MUTED }}>
            Source : Supabase live
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-[10px] border px-3.5 text-[13px] font-semibold transition-colors hover:opacity-80 disabled:opacity-50"
            style={{ background: 'var(--lt-card-bg)', borderColor: LT_BORDER, color: LT_SUB }}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Actualiser
          </button>
          <button
            onClick={handleExport}
            className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-[10px] px-3.5 text-[13px] font-semibold text-white transition-transform active:scale-[0.98]"
            style={{
              background: `linear-gradient(90deg, ${LT_GOLD_INK} 0%, #6F5614 100%)`,
              boxShadow: '0 2px 8px -2px rgba(138, 109, 26, 0.45)',
            }}
          >
            <Download className="w-4 h-4" /> Rapport
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {statCards.map((stat, idx) => {
          const t = TONES[stat.tone] || TONES.violet;
          return (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.04 }}
              whileHover={HOVER_LIFT}
              whileTap={TAP_SOFT}
            >
              <div
                className="relative flex min-h-[92px] flex-col justify-between overflow-hidden rounded-[14px] p-3.5"
                style={cardSurface}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: LT_MUTED }}>
                    {stat.title}
                  </span>
                  <div
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px]"
                    style={{
                      background: `linear-gradient(140deg, ${t.from} 0%, ${t.to} 100%)`,
                      boxShadow: `0 4px 12px -4px rgba(${t.rgb}, 0.5)`,
                    }}
                  >
                    <stat.icon className="h-[16px] w-[16px] text-white" strokeWidth={2.1} />
                  </div>
                </div>
                <p
                  className="mt-2 truncate text-[26px] font-bold tabular-nums leading-none tracking-tight"
                  style={{ color: LT_TEXT }}
                >
                  {stat.value}
                </p>
              </div>
            </motion.div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Main Chart Area */}
        <div className="lg:col-span-2 rounded-[14px] p-5" style={panelSurface}>
          <h2 className="font-semibold text-[15px] flex items-center gap-2 mb-4" style={{ color: LT_TEXT }}>
            <Activity className="w-[18px] h-[18px]" style={{ color: LT_GOLD_INK }} /> Tendances d'Activité (7 jours)
          </h2>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendMap}>
                <defs>
                  <linearGradient id="colorActivity" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#7c5cff" stopOpacity={0.22}/>
                    <stop offset="95%" stopColor="#7c5cff" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={chartDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'} vertical={false} />
                <XAxis dataKey="date" stroke={chartDark ? '#8E8E93' : '#71717A'} fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke={chartDark ? '#8E8E93' : '#71717A'} fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip
                  cursor={{ stroke: chartDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.12)' }}
                  contentStyle={chartDark
                    ? { backgroundColor: '#16161E', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: '#F4F4F5', boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }
                    : { backgroundColor: '#FFFFFF', border: '1px solid rgba(0,0,0,0.08)', borderRadius: '10px', color: '#18181B', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                  labelStyle={{ color: chartDark ? '#A1A1AA' : '#52525B' }}
                />
                <Area type="monotone" dataKey="count" stroke="#7c5cff" strokeWidth={2} fillOpacity={1} fill="url(#colorActivity)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Alerts & Quick Actions */}
        <div className="space-y-5">
          <div className="rounded-[14px] p-4" style={panelSurface}>
            <h3 className="flex items-center gap-2 text-[15px] font-semibold mb-3" style={{ color: LT_TEXT }}>
              <Bell className="w-4 h-4 text-red-500" /> Alertes Importantes
              {alerts.length > 0 && <Badge variant="destructive" className="ml-auto">{alerts.length}</Badge>}
            </h3>
            <ScrollArea className="h-[200px] pr-3">
              {alerts.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full py-8" style={{ color: LT_MUTED }}>
                   <CheckCircle className="w-9 h-9 mb-2" style={{ color: '#22c55e', opacity: 0.55 }} />
                   <p className="text-[13px]">Tout semble normal</p>
                </div>
              ) : (
                alerts.map(alert => (
                   <div key={alert.id} className={`p-3 rounded-[10px] border flex items-start justify-between gap-3 mb-2 ${getAlertColor(alert.severity)}`}>
                      <div>
                         <p className="font-semibold text-[13px]">{alert.title}</p>
                         <p className="text-xs opacity-90">{alert.message}</p>
                      </div>
                      <button onClick={() => dismissAlert(alert.id)} className="cursor-pointer rounded p-1 transition-colors hover:bg-black/10" aria-label="Ignorer l'alerte">
                         <XCircle className="w-4 h-4" />
                      </button>
                   </div>
                ))
              )}
            </ScrollArea>
          </div>

          <div className="rounded-[14px] p-4" style={panelSurface}>
            <h3 className="text-[15px] font-semibold mb-3" style={{ color: LT_TEXT }}>Actions Rapides</h3>
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
      <div className="rounded-[14px] p-5" style={panelSurface}>
        <h2 className="font-semibold text-[15px] mb-3" style={{ color: LT_TEXT }}>Activité Récente</h2>
        {error ? <p className="text-xs text-red-600 mb-2">Erreur données: {String(error?.message || error)}</p> : null}
        <div className="relative overflow-x-auto">
          <table className="w-full text-[13px] text-left">
            <thead className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: LT_MUTED, backgroundColor: '#F8F8FA' }}>
              <tr>
                <th className="px-4 py-2.5 rounded-l-[8px]">Action</th>
                <th className="px-4 py-2.5">Utilisateur / Élément</th>
                <th className="px-4 py-2.5">Date</th>
                <th className="px-4 py-2.5 rounded-r-[8px]">Type</th>
              </tr>
            </thead>
            <tbody>
              {recentActivities.map((act) => (
                <tr key={act.id} className="border-b transition-colors hover:bg-zinc-50" style={{ borderColor: LT_BORDER }}>
                  <td className="px-4 py-3 font-medium" style={{ color: LT_TEXT }}>{act.description}</td>
                  <td className="px-4 py-3">
                     {act.details?.user && <div style={{ color: LT_TEXT }}>{act.details.user}</div>}
                     {act.details?.item && <div className="text-xs" style={{ color: LT_GOLD_INK }}>{act.details.item}</div>}
                  </td>
                  <td className="px-4 py-3" style={{ color: LT_SUB }}>{format(new Date(act.timestamp), 'dd MMM HH:mm', { locale: fr })}</td>
                  <td className="px-4 py-3">
                     <Badge variant="outline" className="border-zinc-200 bg-zinc-50 font-medium text-zinc-600">
                       {act.type.replace(/_/g, ' ')}
                     </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {recentActivities.length === 0 && (
             <div className="text-center py-8 text-[13px]" style={{ color: LT_MUTED }}>Aucune activité récente.</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OwnerDashboardOverview;
