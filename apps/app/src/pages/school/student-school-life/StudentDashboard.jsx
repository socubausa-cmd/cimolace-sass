/**
 * StudentDashboard — Tableau de bord élève
 *
 * Branchement réel sur :
 *   - useStudentCurrentCourse() → semaine active, live sessions, formations
 *   - useStudentDashboardParityData() → évaluations, absences, notifications, agenda
 *
 * Remplace les données hardcodées de la version précédente.
 */
import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Calendar, Bell, CheckCircle, Clock,
  Award, AlertTriangle, ArrowRight, BookOpen,
  TrendingUp, Users,
} from 'lucide-react';
import { useDemoMode } from '@/contexts/DemoModeContext';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useStudentDashboardParityData } from '@/hooks/useStudentDashboardParityData';
import { useStudentCurrentCourse } from '@/hooks/useStudentCurrentCourse';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { format, isValid } from 'date-fns';
import { fr } from 'date-fns/locale';
import DashboardLiveSessionsPanel from '@/components/liri/live/DashboardLiveSessionsPanel';
import CourseWeekCard from '@/components/school/student/CourseWeekCard';
import StudentCalendarTimeline from '@/components/school/student/StudentCalendarTimeline';

// ── Helpers ───────────────────────────────────────────────────────────────────
const safeFormat = (dateInput, formatStr) => {
  if (!dateInput) return '';
  const date = new Date(dateInput);
  return isValid(date) ? format(date, formatStr, { locale: fr }) : '';
};

// ── Carte générique dashboard ─────────────────────────────────────────────────
const DashboardCard = ({ title, icon: Icon, children, link, linkText = 'Voir tout' }) => (
  <Card className="bg-[#192734] border-white/10 hover:border-[#D4AF37]/30 transition-all duration-300 shadow-lg">
    <CardHeader className="flex flex-row items-center justify-between pb-2 border-b border-white/5">
      <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
        <Icon className="w-5 h-5 text-[#D4AF37]" />
        {title}
      </CardTitle>
      {link && (
        <Link to={link} className="text-xs text-[#D4AF37] hover:underline flex items-center gap-1">
          {linkText} <ArrowRight className="w-3 h-3" />
        </Link>
      )}
    </CardHeader>
    <CardContent className="pt-4">
      {children}
    </CardContent>
  </Card>
);

// ── Composant principal ───────────────────────────────────────────────────────
const StudentDashboard = () => {
  const { user }                         = useAuth();
  const { isDemoMode, demoData }         = useDemoMode();

  // ── Données calendrier + live (réelles ou démo) ───────────────────────────
  const {
    currentWeek,
    upcomingWeeks,
    calendarWeeks,
    byTrimester,
    completedCount,
    totalActive,
    progressPct,
    activeLiveSession,
    nextLiveSession,
    activeFormations,
    enrolledFormations,
    loading: courseLoading,
  } = useStudentCurrentCourse({ userId: isDemoMode ? null : user?.id });

  // ── Données vie scolaire (parité) ─────────────────────────────────────────
  const parity = useStudentDashboardParityData(isDemoMode ? null : user?.id);

  const formations    = isDemoMode ? demoData.formations     : enrolledFormations;
  const notifications = isDemoMode ? demoData.notifications  : (parity.notifications || []);
  const absences      = isDemoMode ? demoData.absences       : (parity.absences       || []);
  const evaluations   = isDemoMode ? demoData.evaluations.completed : (parity.evaluations || []);
  const agenda        = isDemoMode ? demoData.agenda         : (parity.agenda          || []);
  const delayCount    = isDemoMode ? (demoData.stats?.delays ?? 0) : parity.delays?.length ?? 0;

  // ── Statistiques ──────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    if (isDemoMode) return [
      { label: 'Moyenne Générale',  value: demoData.stats.average + '/20',                                 icon: Award,         color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
      { label: 'Semaines Validées', value: `${demoData.stats.validatedWeeks}/${demoData.stats.totalWeeks}`, icon: CheckCircle,   color: 'text-green-500',  bg: 'bg-green-500/10'  },
      { label: 'Absences',          value: demoData.stats.absences,                                        icon: AlertTriangle, color: 'text-red-500',    bg: 'bg-red-500/10'    },
      { label: 'Retards',           value: demoData.stats.delays,                                          icon: Clock,         color: 'text-orange-500', bg: 'bg-orange-500/10' },
    ];

    const avgScore = evaluations.length
      ? (evaluations.reduce((a, e) => a + ((Number(e.score || 0) / Number(e.max || 20)) * 20), 0) / evaluations.length).toFixed(1)
      : 'N/A';

    return [
      { label: 'Moyenne Générale',  value: `${avgScore}/20`,                           icon: Award,         color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
      { label: 'Semaines Validées', value: `${completedCount}/${totalActive}`,          icon: CheckCircle,   color: 'text-green-500',  bg: 'bg-green-500/10'  },
      { label: 'Absences',          value: String(absences.length || 0),                icon: AlertTriangle, color: 'text-red-500',    bg: 'bg-red-500/10'    },
      { label: 'Retards',           value: String(delayCount),                          icon: Clock,         color: 'text-orange-500', bg: 'bg-orange-500/10' },
    ];
  }, [isDemoMode, demoData, evaluations, completedCount, totalActive, absences.length, delayCount]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">

      {/* ── En-tête ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-serif font-bold text-white">Tableau de Bord</h1>
          <p className="text-slate-400">
            {isDemoMode
              ? "Mode Démo : Aperçu de l'espace étudiant."
              : activeLiveSession
              ? '🔴 Une session est en cours — rejoins maintenant !'
              : 'Bienvenue, voici ton aperçu hebdomadaire.'}
          </p>
        </div>
        <div className="text-right hidden md:block">
          <p className="text-sm text-[#D4AF37] font-bold">{safeFormat(new Date(), 'EEEE d MMMM yyyy')}</p>
          <p className="text-sm text-slate-500">Année Académique 2025-2026</p>
        </div>
      </div>

      {/* ── Sessions live (panel global) ───────────────────────────────────── */}
      {!isDemoMode && <DashboardLiveSessionsPanel />}

      {/* ── Statistiques ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.08 }}
          >
            <Card className="bg-[#192734] border-white/10">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wider">{stat.label}</p>
                  <p className="text-2xl font-bold text-white mt-1">{stat.value}</p>
                </div>
                <div className={`p-3 rounded-full ${stat.bg} ${stat.color}`}>
                  <stat.icon className="w-5 h-5" />
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* ── Ligne principale : Cette semaine + Notifications ───────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Carte "Cette semaine" — branchée sur le vrai calendrier */}
        <div className="lg:col-span-2">
          <CourseWeekCard
            currentWeek={currentWeek}
            activeLiveSession={isDemoMode ? null : activeLiveSession}
            nextLiveSession={isDemoMode ? null : nextLiveSession}
            progressPct={isDemoMode ? demoData.stats.progressPct ?? 45 : progressPct}
            completedCount={isDemoMode ? demoData.stats.validatedWeeks ?? 6 : completedCount}
            totalActive={isDemoMode ? demoData.stats.totalWeeks ?? 36 : totalActive}
            loading={!isDemoMode && courseLoading}
          />
        </div>

        {/* Notifications */}
        <DashboardCard title="Notifications" icon={Bell} link="/student-school-life/notifications">
          <div className="space-y-4">
            {notifications.slice(0, 3).map((notif) => (
              <div key={notif.id} className="flex gap-3 items-start p-2 rounded hover:bg-white/5 transition-colors">
                <div className="w-2 h-2 mt-2 rounded-full bg-[#D4AF37] flex-shrink-0" />
                <div>
                  <p className="text-sm text-white line-clamp-2">{notif.message}</p>
                  <p className="text-xs text-slate-500 mt-1">{safeFormat(notif.date, 'dd MMM')}</p>
                </div>
              </div>
            ))}
            {notifications.length === 0 && (
              <p className="text-slate-500 text-sm italic">Aucune nouvelle notification.</p>
            )}
          </div>
        </DashboardCard>
      </div>

      {/* ── Calendrier annuel élève ─────────────────────────────────────────── */}
      {!isDemoMode && (
        <StudentCalendarTimeline
          calendarWeeks={calendarWeeks}
          currentWeek={currentWeek}
          byTrimester={byTrimester}
          completedCount={completedCount}
          totalActive={totalActive}
          progressPct={progressPct}
          loading={courseLoading}
        />
      )}

      {/* ── Grille secondaire : Formations + Évals + Agenda ────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">

        {/* Mes Formations */}
        <DashboardCard title="Mes Formations" icon={BookOpen} link="/student-school-life/formations">
          <div className="space-y-4">
            {formations.slice(0, 3).map((fmt) => {
              // Calcul progression réelle basé sur completedCount si disponible
              const pct = fmt.progress ?? (fmt.status === 'completed' ? 100 : Math.round((completedCount / Math.max(totalActive, 1)) * 100));
              return (
                <div key={fmt.id} className="group cursor-pointer">
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="text-white group-hover:text-[#D4AF37] transition-colors font-medium line-clamp-1">
                      {fmt.title}
                    </span>
                    <span className="text-slate-400 ml-2 shrink-0">{pct}%</span>
                  </div>
                  <Progress
                    value={pct}
                    className="h-1.5 bg-gray-700"
                    indicatorClassName={pct === 100 ? 'bg-green-500' : 'bg-[#D4AF37]'}
                  />
                </div>
              );
            })}
            {formations.length === 0 && (
              <p className="text-slate-500 text-sm">Aucune formation en cours.</p>
            )}
          </div>
        </DashboardCard>

        {/* Dernières évaluations */}
        <DashboardCard title="Dernières Évaluations" icon={Award} link="/student-school-life/evaluations">
          <div className="space-y-3">
            {evaluations.slice(0, 2).map((ev) => (
              <div key={ev.id} className="flex items-center justify-between p-2 bg-black/20 rounded-lg">
                <div>
                  <p className="text-sm text-white font-medium">{ev.title}</p>
                  <p className="text-xs text-slate-500">{safeFormat(ev.date, 'dd MMM yyyy')}</p>
                </div>
                <Badge
                  variant="outline"
                  className={`border-none ${Number(ev.score) >= 10 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}
                >
                  {ev.score}/{ev.maxScore || ev.max}
                </Badge>
              </div>
            ))}
            {evaluations.length === 0 && (
              <p className="text-slate-500 text-sm">Aucune évaluation récente.</p>
            )}
          </div>
        </DashboardCard>

        {/* Agenda */}
        <DashboardCard title="Agenda" icon={Calendar} link="/student-school-life/agenda">
          <div className="space-y-3">
            {/* Prochaines semaines du calendrier */}
            {upcomingWeeks.slice(0, 2).map((w) => (
              <div key={w.id} className="flex gap-3">
                <div className="flex flex-col items-center bg-[#D4AF37]/10 p-2 rounded text-[#D4AF37] min-w-[50px]">
                  <span className="text-xs font-bold uppercase">{safeFormat(w.week_start, 'MMM')}</span>
                  <span className="text-xl font-bold">{safeFormat(w.week_start, 'dd')}</span>
                </div>
                <div>
                  <p className="text-white font-medium text-sm">
                    {w.theme || w.module_title || `Semaine ${w.week_number}`}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Sem. {w.week_number} · {w.session_type || 'cours'}
                  </p>
                </div>
              </div>
            ))}
            {/* Événements agenda */}
            {upcomingWeeks.length === 0 && agenda.slice(0, 2).map((item) => (
              <div key={item.id} className="flex gap-3">
                <div className="flex flex-col items-center bg-[#D4AF37]/10 p-2 rounded text-[#D4AF37] min-w-[50px]">
                  <span className="text-xs font-bold uppercase">{safeFormat(item.date, 'MMM')}</span>
                  <span className="text-xl font-bold">{safeFormat(item.date, 'dd')}</span>
                </div>
                <div>
                  <p className="text-white font-medium">{item.title}</p>
                  <p className="text-xs text-slate-500">{item.time} · {item.location}</p>
                </div>
              </div>
            ))}
            {upcomingWeeks.length === 0 && agenda.length === 0 && (
              <p className="text-slate-500 text-sm">Rien de prévu cette semaine.</p>
            )}
          </div>
        </DashboardCard>

      </div>
    </div>
  );
};

export default StudentDashboard;
