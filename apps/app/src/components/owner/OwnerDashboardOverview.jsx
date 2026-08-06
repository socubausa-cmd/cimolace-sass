import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAdminDashboard } from '@/hooks/useAdmin';
import { useSchoolYear } from '@/hooks/useSchoolYear';
import { useShellTint } from '@/lib/useShellTint';
import { Badge } from '@/components/ui/badge';
import { Users, BookOpen, GraduationCap, FileText, CreditCard, Download, RefreshCw, Activity, CheckCircle, X, Plus, Bell, Sparkles, Link2, Workflow, CalendarDays } from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { motion } from 'framer-motion';

const TAP_SOFT = { scale: 0.99 };
const FADE_UP = { duration: 0.22, ease: 'easeOut' };

/* ------------------------------------------------------------------ */
/*  Vue d'ensemble du back-office école. Surfaces pilotées par les    */
/*  variables --lt-* (teinte clair/sombre du shell) : un seul jeu     */
/*  de styles, cf. liri-brand-theme.css.                              */
/* ------------------------------------------------------------------ */
const LT_TEXT = 'var(--lt-text)'; // primaire
const LT_SUB = 'var(--lt-sub)'; // secondaire
const LT_MUTED = 'var(--lt-muted)'; // atténué (labels)
const LT_BORDER = 'var(--lt-border)';

// Corail = actions et sélection (directive artistique LIRI). Pas de dégradés décoratifs.
const CORAL = '#d97757';

// Surface « panneau » (en-tête, graphe, alertes, tableau).
const panelSurface = {
  background: 'var(--lt-card-bg)',
  border: '1px solid var(--lt-card-border)',
  boxShadow: 'var(--lt-card-shadow)',
};

/* Année scolaire = septembre → août : en août on est ENCORE sur l'année entamée
   au septembre précédent. Rien en dur — sinon la liste ment dès la rentrée suivante. */
const schoolYearOf = (d) => {
  const y = d.getFullYear();
  return d.getMonth() + 1 >= 9 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
};
const buildYearOptions = (stored) => {
  const start = Number(schoolYearOf(new Date()).slice(0, 4));
  // L'année à VENIR est proposée aussi : en fin d'année scolaire on prépare déjà la rentrée.
  const opts = [-1, 0, 1, 2].map((i) => `${start - i}-${start - i + 1}`);
  // Une année mémorisée hors fenêtre reste proposée : on montre, on ne décide pas.
  if (stored && !opts.includes(stored)) opts.push(stored);
  return opts;
};
const SCHOOL_YEAR_KEY = 'prora_school_year'; // même clé que useSchoolYear

/** Tuile « action rapide » — puce corail plate + libellé. Toute la tuile est cliquable. */
function QuickAction({ icon: Icon, label, to, full, onClick }) {
  const inner = (
    <motion.div
      whileHover={{ y: -2 }}
      whileTap={TAP_SOFT}
      transition={FADE_UP}
      className="flex h-full cursor-pointer items-center gap-2.5 rounded-[12px] p-2.5 transition-colors hover:bg-black/5"
      style={{
        background: 'var(--lt-card-bg)',
        border: '1px solid var(--lt-card-border)',
        boxShadow: 'var(--lt-card-shadow)',
      }}
    >
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px]"
        style={{ background: 'rgba(217,119,87,0.15)', color: CORAL }}
      >
        <Icon className="h-[16px] w-[16px]" strokeWidth={2.2} />
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

const OwnerDashboardOverview = ({ basePath = '/owner-dashboard' }) => {
  const { stats: dashboardStats, activities, loading, error, refresh } = useAdminDashboard();
  const [tint] = useShellTint();
  const chartDark = tint === 'dark'; // recharts : les attributs SVG stroke ne résolvent pas var() → bascule JS
  const [dismissedAlerts, setDismissedAlerts] = useState([]);
  const [currentDate, setCurrentDate] = useState(new Date());

  // Lu AVANT le premier effet du hook (qui persiste aussitôt sa valeur par défaut) :
  // sans mémorisation explicite, on se cale sur l'année scolaire réellement en cours.
  const [hadStoredYear] = useState(() => {
    try { return !!window.localStorage.getItem(SCHOOL_YEAR_KEY); } catch { return true; }
  });
  const { currentYear, setSchoolYear } = useSchoolYear();
  useEffect(() => {
    const now = schoolYearOf(new Date());
    if (!hadStoredYear && currentYear !== now) setSchoolYear(now);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const yearOptions = buildYearOptions(currentYear);

  useEffect(() => {
    const timer = setInterval(() => setCurrentDate(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  // Modules / leçons / vidéos viennent désormais du hook (API /growth/stats,
  // tables vivantes tenant-scopées) — les requêtes directes lisaient les tables
  // jumelles mortes (modules/formation_day_contents) sans scope tenant → 0 partout.
  const details = {
    totalModules: dashboardStats.totalModules || 0,
    totalVideos: dashboardStats.totalVideos || 0,
    totalQuizzes: dashboardStats.totalLessons || 0,
  };

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

  // Le jargon technique ne parle pas au fondateur : un webhook en attente est
  // « un paiement qui attend une vérification », pas une tuile permanente à 0.
  const alertsRaw = [
    dashboardStats.pendingWebhooks > 0
      ? {
          id: 'pending-webhooks',
          title: 'Des paiements attendent une vérification technique',
          message: `${dashboardStats.pendingWebhooks} notification(s) de paiement ne sont pas encore traitées — si un règlement n'apparaît pas, c'est ici que ça bloque.`,
          severity: 'high',
          to: `${basePath}?tab=payments`,
        }
      : null,
    dashboardStats.systemStatus === 'Alerte'
      ? {
          id: 'system-alert',
          title: 'Vérification nécessaire côté paiements',
          message: 'Un incident récent demande un contrôle des règlements.',
          severity: 'high',
          to: `${basePath}?tab=payments`,
        }
      : null,
    dashboardStats.confirmedPayments === 0
      ? {
          id: 'no-payments',
          title: 'Aucun paiement confirmé récent',
          message: "Aucun règlement n'a été confirmé récemment. Vérifie les moyens de paiement et le parcours d'achat.",
          severity: 'medium',
          to: `${basePath}?tab=payments`,
        }
      : null,
  ].filter(Boolean);

  const alerts = alertsRaw.filter((a) => !dismissedAlerts.includes(a.id));
  const dismissAlert = (id) => setDismissedAlerts((prev) => [...prev, id]);
  const getAlertColor = (severity) => {
    if (severity === 'high') return 'border-red-200 bg-red-50 text-red-800';
    if (severity === 'medium') return 'border-amber-200 bg-amber-50 text-amber-900';
    return 'border-zinc-200 bg-zinc-50 text-zinc-700';
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
  const trendTotal = trendMap.reduce((sum, d) => sum + d.count, 0);

  const handleExport = () => {
    const doc = new jsPDF();

    // Header
    doc.setFontSize(20);
    doc.setTextColor(217, 119, 87); // corail LIRI
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

  /* Les métriques qui comptent, en UNE rangée compacte. Les compteurs à zéro permanent
     (webhooks, actifs, vidéos) ne méritent pas de tuile : un zéro devient une alerte
     quand il pose problème, ou disparaît. Les paiements n'apparaissent ici que
     confirmés > 0 — à zéro, l'alerte à droite le dit déjà (pas deux fois). */
  const metricRow = [
    { title: 'Étudiants', value: stats.totalStudents, icon: Users },
    { title: 'Formations publiées', value: stats.publishedFormations, icon: BookOpen },
    { title: 'Modules', value: stats.totalModules, icon: GraduationCap },
    { title: 'Leçons', value: stats.totalQuizzes, icon: FileText },
    ...(stats.confirmedPayments > 0
      ? [{ title: 'Paiements confirmés', value: stats.confirmedPayments, sub: `${stats.totalRevenue} €`, icon: CreditCard }]
      : []),
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
      {/* En-tête : titre + date à gauche, année scolaire + actions à droite (plus de bloc flottant). */}
      <div
        className="flex flex-col gap-4 rounded-[14px] p-5 lg:flex-row lg:items-center lg:justify-between"
        style={panelSurface}
      >
        <div>
          <h1 className="text-xl font-bold tracking-tight" style={{ color: LT_TEXT }}>
            Aperçu rapide
          </h1>
          <p className="text-[13px] mt-0.5 capitalize" style={{ color: LT_SUB }}>
            {format(currentDate, 'EEEE d MMMM yyyy • HH:mm', { locale: fr })}
          </p>
          <p className="text-[11px] mt-0.5" style={{ color: LT_MUTED }}>
            Données en direct
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div
            role="group"
            aria-label="Année scolaire"
            title="Année scolaire (septembre à août)"
            className="flex items-center gap-1 rounded-[10px] border p-1"
            style={{ borderColor: LT_BORDER, background: 'var(--lt-inner-bg)' }}
          >
            {yearOptions.map((year) => {
              const active = year === currentYear;
              return (
                <button
                  key={year}
                  type="button"
                  onClick={() => setSchoolYear(year)}
                  aria-pressed={active}
                  className={`h-7 cursor-pointer rounded-[7px] px-2.5 text-[12px] font-semibold tabular-nums transition-colors ${active ? 'text-white' : 'hover:bg-black/5'}`}
                  style={active ? { background: CORAL } : { color: LT_SUB }}
                >
                  {year}
                </button>
              );
            })}
          </div>
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-[10px] border px-3.5 text-[13px] font-semibold transition-colors hover:bg-black/5 disabled:opacity-50"
            style={{ background: 'var(--lt-card-bg)', borderColor: LT_BORDER, color: LT_SUB }}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Actualiser
          </button>
          <button
            onClick={handleExport}
            className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-[10px] px-3.5 text-[13px] font-semibold text-white transition-[filter,transform] hover:brightness-95 active:scale-[0.98]"
            style={{ background: CORAL }}
          >
            <Download className="w-4 h-4" /> Rapport
          </button>
        </div>
      </div>

      {error ? (
        <div className="flex items-center justify-between gap-3 rounded-[14px] border border-red-200 bg-red-50 p-4 text-[13px] text-red-800">
          <span>Les données n'ont pas pu être chargées : {String(error?.message || error)}</span>
          <button
            type="button"
            onClick={handleRefresh}
            className="shrink-0 cursor-pointer rounded-[8px] border border-red-300 px-3 py-1.5 font-semibold transition-colors hover:bg-red-100"
          >
            Réessayer
          </button>
        </div>
      ) : null}

      {/* Rangée de métriques — une seule surface, pas de grille de tuiles identiques. */}
      <div className="grid grid-cols-2 rounded-[14px] md:flex md:flex-wrap" style={panelSurface}>
        {metricRow.map((metric, idx) => (
          <div
            key={metric.title}
            className={`flex items-center gap-3 px-5 py-4 md:flex-1 ${idx > 0 ? 'md:border-l' : ''}`}
            style={{ borderColor: 'var(--lt-card-border)' }}
          >
            <metric.icon className="h-4 w-4 shrink-0" style={{ color: LT_MUTED }} strokeWidth={2} />
            <div className="min-w-0">
              <p className="truncate text-[12px] font-medium" style={{ color: LT_MUTED }}>{metric.title}</p>
              {loading && !metric.value ? (
                <div className="mt-1.5 h-5 w-10 animate-pulse rounded" style={{ background: 'var(--lt-inner-bg)' }} />
              ) : (
                <p className="text-[22px] font-bold tabular-nums leading-tight tracking-tight" style={{ color: LT_TEXT }}>
                  {metric.value}
                  {metric.sub ? (
                    <span className="ml-2 text-[12.5px] font-semibold tabular-nums" style={{ color: LT_SUB }}>{metric.sub}</span>
                  ) : null}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Activité des 7 derniers jours */}
        <div className="lg:col-span-2 rounded-[14px] p-5" style={panelSurface}>
          <h2 className="font-semibold text-[15px] flex items-center gap-2 mb-4" style={{ color: LT_TEXT }}>
            <Activity className="w-[18px] h-[18px]" style={{ color: CORAL }} /> Activité (7 derniers jours)
          </h2>
          <div className="h-[280px]">
            {trendTotal === 0 ? (
              /* Des axes nus sur zéro donnée mentiraient une courbe : état vide honnête. */
              <div className="flex h-full flex-col items-center justify-center px-6 text-center">
                <Activity className="mb-3 h-8 w-8" style={{ color: LT_MUTED, opacity: 0.6 }} />
                <p className="text-[13.5px] font-medium" style={{ color: LT_SUB }}>
                  Pas encore d'activité sur les 7 derniers jours
                </p>
                <p className="mt-1 max-w-[38ch] text-[12.5px]" style={{ color: LT_MUTED }}>
                  Les actions effectuées dans l'école apparaîtront ici, jour par jour.
                </p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendMap}>
                  <defs>
                    <linearGradient id="colorActivity" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CORAL} stopOpacity={0.22}/>
                      <stop offset="95%" stopColor={CORAL} stopOpacity={0}/>
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
                  <Area type="monotone" dataKey="count" stroke={CORAL} strokeWidth={2} fillOpacity={1} fill="url(#colorActivity)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Alertes & actions rapides */}
        <div className="space-y-5">
          <div className="rounded-[14px] p-4" style={panelSurface}>
            <h3 className="flex items-center gap-2 text-[15px] font-semibold mb-3" style={{ color: LT_TEXT }}>
              <Bell className="w-4 h-4 text-red-500" /> Alertes importantes
              {alerts.length > 0 && <Badge variant="destructive" className="ml-auto">{alerts.length}</Badge>}
            </h3>
            {/* Pas de hauteur figée : une alerte coupée en plein mot n'alerte plus personne. */}
            {alerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8" style={{ color: LT_MUTED }}>
                 <CheckCircle className="w-9 h-9 mb-2" style={{ color: '#22c55e', opacity: 0.55 }} />
                 <p className="text-[13px]">Tout semble normal</p>
              </div>
            ) : (
              alerts.map(alert => (
                 <div key={alert.id} className={`p-3 rounded-[10px] border flex items-start justify-between gap-3 mb-2 last:mb-0 ${getAlertColor(alert.severity)}`}>
                    <div className="min-w-0">
                       <p className="font-semibold text-[13px]">{alert.title}</p>
                       <p className="mt-0.5 text-xs leading-snug opacity-90">{alert.message}</p>
                       {alert.to ? (
                         <Link to={alert.to} className="mt-1.5 inline-block text-xs font-semibold underline underline-offset-2 hover:opacity-75">
                           Ouvrir les paiements
                         </Link>
                       ) : null}
                    </div>
                    <button
                      onClick={() => dismissAlert(alert.id)}
                      className="shrink-0 cursor-pointer rounded p-1 transition-colors hover:bg-black/10"
                      aria-label="Masquer cette alerte"
                      title="Masquer cette alerte"
                    >
                       <X className="w-4 h-4" />
                    </button>
                 </div>
              ))
            )}
          </div>

          <div className="rounded-[14px] p-4" style={panelSurface}>
            <h3 className="text-[15px] font-semibold mb-3" style={{ color: LT_TEXT }}>Actions rapides</h3>
            <div className="grid grid-cols-2 gap-2">
              {/* Chaque tuile mène quelque part : un bouton qui ne fait rien est interdit. */}
              <QuickAction icon={Plus} label="Formation" to={`${basePath}?tab=formations`} />
              <QuickAction icon={Users} label="Étudiants" to={`${basePath}?tab=users`} />
              <QuickAction icon={Activity} label="Coaching" to={`${basePath}?tab=coaching-mentoring`} />
              <QuickAction icon={CalendarDays} label="Prise de RDV" to="/appointment/request" />
              <QuickAction icon={Sparkles} label="Studio créateur" to="/studio" full />
              <QuickAction icon={Link2} label="Chariow Externes" to="/admin/billing?tab=external" full />
              <QuickAction icon={Workflow} label="Marketing & automation" to="/liri/crm?tab=automation" full />
            </div>
          </div>
        </div>
      </div>

      {/* Activité récente */}
      <div className="rounded-[14px] p-5" style={panelSurface}>
        <h2 className="font-semibold text-[15px] mb-3" style={{ color: LT_TEXT }}>Activité récente</h2>
        <div className="relative overflow-x-auto">
          <table className="w-full text-[13px] text-left">
            {/* Fond via variable de teinte : un fond clair en dur faisait une bande blanche sous la coque sombre. */}
            <thead className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: LT_MUTED, backgroundColor: 'var(--lt-inner-bg)' }}>
              <tr>
                <th className="px-4 py-2.5 rounded-l-[8px]">Action</th>
                <th className="px-4 py-2.5">Utilisateur / Élément</th>
                <th className="px-4 py-2.5">Date</th>
                <th className="px-4 py-2.5 rounded-r-[8px]">Type</th>
              </tr>
            </thead>
            <tbody>
              {recentActivities.map((act) => (
                <tr key={act.id} className="border-b transition-colors hover:bg-black/5" style={{ borderColor: LT_BORDER }}>
                  <td className="px-4 py-3 font-medium" style={{ color: LT_TEXT }}>{act.description}</td>
                  <td className="px-4 py-3">
                     {act.details?.user && <div style={{ color: LT_TEXT }}>{act.details.user}</div>}
                     {act.details?.item && <div className="text-xs" style={{ color: LT_SUB }}>{act.details.item}</div>}
                  </td>
                  <td className="px-4 py-3" style={{ color: LT_SUB }}>{format(new Date(act.timestamp), 'dd MMM HH:mm', { locale: fr })}</td>
                  <td className="px-4 py-3">
                     <Badge variant="outline" className="font-medium" style={{ borderColor: LT_BORDER, background: 'var(--lt-inner-bg)', color: LT_SUB }}>
                       {act.type.replace(/_/g, ' ')}
                     </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {recentActivities.length === 0 && (
             <div className="text-center py-8 text-[13px]" style={{ color: LT_MUTED }}>
               Aucune activité récente — les actions de l'équipe et des membres s'afficheront ici.
             </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OwnerDashboardOverview;
