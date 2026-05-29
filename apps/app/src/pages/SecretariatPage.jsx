import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import {
  BookOpen,
  GraduationCap,
  MessageSquare,
  Users,
  Loader2,
  AlertTriangle,
  CreditCard,
  History,
  School,
  Inbox,
  FileCheck,
  ArrowRight,
  Clock,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import TeacherCard from '@/components/TeacherCard';
import AnnouncementCard from '@/components/AnnouncementCard';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/ui/use-toast';

const SecretariatPage = () => {
  const { supabase, session, user } = useAuth();
  const { toast } = useToast();
  const [teachers, setTeachers] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [stats, setStats] = useState({
    students: 0,
    teachers: 0,
    formations: 0,
    billingAlerts: 0,
  });
  const [loadingData, setLoadingData] = useState(true);
  const [administrativeQueue, setAdministrativeQueue] = useState([]);
  const [taskLoading, setTaskLoading] = useState({});
  const [recentlyProcessed, setRecentlyProcessed] = useState([]);

  const isMissingRelationError = (error) => {
    const code = String(error?.code || '');
    const msg = String(error?.message || '').toLowerCase();
    return code === '42P01' || code === 'PGRST205' || msg.includes('does not exist') || msg.includes('could not find the table');
  };

  useEffect(() => {
    const fetchSecretariatData = async () => {
      setLoadingData(true);
      try {
        const [teachersRes, studentsCountRes, formationsCountRes, billingRes, enrollmentsRes, pendingEnrollmentsRes] = await Promise.all([
          supabase
            .from('profiles')
            .select('id,name,email,role,avatar_url')
            .in('role', ['teacher', 'owner', 'admin'])
            .limit(6),
          supabase
            .from('profiles')
            .select('id', { count: 'exact', head: true })
            .in('role', ['student', 'visitor']),
          supabase
            .from('courses')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'published'),
          supabase
            .from('billing_subscriptions')
            .select('id,user_id,status,expires_at')
            .in('status', ['past_due', 'expired'])
            .limit(50),
          supabase
            .from('student_progress')
            .select('id,status,created_at,courses(title)')
            .order('created_at', { ascending: false })
            .limit(4),
          supabase
            .from('student_progress')
            .select('id,status,created_at,user_id,courses(title)')
            .in('status', ['pending', 'active'])
            .order('created_at', { ascending: false })
            .limit(6),
        ]);

        const teachersRows = isMissingRelationError(teachersRes.error) ? [] : (teachersRes.data || []);
        setTeachers(
          teachersRows.map((row) => ({
            id: row.id,
            name: row.name || row.email?.split('@')[0] || 'Professeur',
            role:
              row.role === 'teacher'
                ? 'Professeur'
                : row.role === 'admin'
                  ? 'Administration'
                  : 'Direction',
            avatar: row.avatar_url || '',
          }))
        );

        const studentsCount = isMissingRelationError(studentsCountRes.error) ? 0 : Number(studentsCountRes.count || 0);
        const formationsCount = isMissingRelationError(formationsCountRes.error) ? 0 : Number(formationsCountRes.count || 0);
        const billingAlerts = isMissingRelationError(billingRes.error) ? 0 : (billingRes.data || []).length;
        setStats({
          students: studentsCount,
          teachers: teachersRows.length,
          formations: formationsCount,
          billingAlerts,
        });

        const billingRows = isMissingRelationError(billingRes.error) ? [] : (billingRes.data || []);
        const pendingRows = isMissingRelationError(pendingEnrollmentsRes.error) ? [] : (pendingEnrollmentsRes.data || []);
        const actorIds = [
          ...new Set(
            [
              ...billingRows.map((row) => row.user_id),
              ...pendingRows.map((row) => row.user_id),
            ].filter(Boolean)
          ),
        ];
        let profileMap = {};
        if (actorIds.length > 0) {
          const { data: profileRows, error: profilesErr } = await supabase
            .from('profiles')
            .select('id,name,email')
            .in('id', actorIds);
          if (!profilesErr) {
            profileMap = Object.fromEntries(
              (profileRows || []).map((p) => [p.id, p.name || p.email || p.id])
            );
          }
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

        if (isMissingRelationError(enrollmentsRes.error)) {
          setAnnouncements([
            {
              id: 'fallback-1',
              date: new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }),
              title: 'Tableau de bord connecté',
              description: 'Le secrétariat est opérationnel. Les annonces dynamiques apparaîtront avec les nouvelles inscriptions.',
            },
          ]);
        } else {
          const dynamicAnnouncements = (enrollmentsRes.data || []).map((item, idx) => ({
            id: item.id || `enr-${idx}`,
            date: item.enrolled_at
              ? new Date(item.enrolled_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
              : '--',
            title: `Nouvelle inscription: ${item.formations?.title || 'Formation'}`,
            description:
              item.status === 'completed'
                ? 'Parcours marqué comme terminé.'
                : 'Inscription en cours de traitement par le secrétariat.',
          }));
          setAnnouncements(
            dynamicAnnouncements.length > 0
              ? dynamicAnnouncements
              : [
                  {
                    id: 'fallback-2',
                    date: new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }),
                    title: 'Aucune nouvelle inscription',
                    description: 'Aucun événement récent détecté sur les inscriptions.',
                  },
                ]
          );
        }
      } catch {
        setTeachers([]);
        setStats({ students: 0, teachers: 0, formations: 0, billingAlerts: 0 });
        setAdministrativeQueue([]);
        setAnnouncements([
          {
            id: 'fallback-3',
            date: new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }),
            title: 'Connexion données indisponible',
            description: 'Le secrétariat reste accessible. Réessaie dans quelques instants.',
          },
        ]);
      } finally {
        setLoadingData(false);
      }
    };

    fetchSecretariatData();
  }, [supabase]);

  const quickActions = [
    { icon: BookOpen, label: 'Catalogue des cours', link: '/secretariat-space/courses', color: 'text-blue-400' },
    { icon: School, label: 'Vie Scolaire', link: '/secretariat-space/vie-scolaire', color: 'text-emerald-400' },
    { icon: Inbox, label: 'Messagerie', link: '/secretariat-space/messagerie', color: 'text-violet-400' },
    { icon: Users, label: 'Équipe pédagogique', link: '/secretariat-space/teachers', color: 'text-amber-400' },
    { icon: GraduationCap, label: 'Aller en classe', link: '/classroom', color: 'text-cyan-400' },
    { icon: FileCheck, label: 'Fonctionnement', link: '/secretariat-space/how-it-works', color: 'text-orange-400' },
  ];

  const callSecretariatAction = async (endpoint, payload) => {
    const token = session?.access_token;
    if (!token) {
      throw new Error('Session expirée. Reconnecte-toi puis réessaie.');
    }

    const res = await fetch(`/.netlify/functions/${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data?.error || 'Action impossible');
    }
    return data;
  };

  const handleTaskAction = async (task) => {
    setTaskLoading((prev) => ({ ...prev, [task.id]: true }));
    try {
      if (task.type === 'inscription') {
        await callSecretariatAction('secretariat-process-enrollment', {
          enrollmentId: task.targetId,
          nextStatus: 'active',
        });
        toast({
          title: 'Inscription traitée',
          description: `${task.subject} est maintenant actif.`,
        });
      } else {
        await callSecretariatAction('secretariat-mark-billing-followup', {
          subscriptionId: task.targetId,
        });
        toast({
          title: 'Relance enregistrée',
          description: `Suivi facturation appliqué pour ${task.subject}.`,
        });
      }

      setAdministrativeQueue((prev) => prev.filter((item) => item.id !== task.id));
      setStats((prev) =>
        task.type === 'facturation'
          ? { ...prev, billingAlerts: Math.max(0, Number(prev.billingAlerts || 0) - 1) }
          : prev
      );
      const processedBy = user?.name || user?.email || 'Secrétariat';
      const processedAt = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      setRecentlyProcessed((prev) => [
        { id: task.id, type: task.type, title: task.title, subject: task.subject, processedBy, processedAt },
        ...prev.slice(0, 9),
      ]);
    } catch (error) {
      toast({
        title: 'Action impossible',
        description: error?.message || 'Réessaie dans quelques instants.',
        variant: 'destructive',
      });
    } finally {
      setTaskLoading((prev) => ({ ...prev, [task.id]: false }));
    }
  };

  const handleDismissTask = (task) => {
    setAdministrativeQueue((prev) => prev.filter((item) => item.id !== task.id));
    toast({
      title: 'Tâche retirée',
      description: `${task.subject} a été retiré de la file.`,
    });
  };

  return (
    <div className="min-h-screen bg-[#0F1419] font-sans">
      <Helmet>
        <title>Tableau de bord Secrétariat | PRORASCIENCE</title>
      </Helmet>

      <div className="space-y-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
        >
          <div>
            <h1 className="text-2xl md:text-3xl font-serif font-bold text-white">Tableau de bord</h1>
            <p className="text-gray-400 mt-1">Espace Secrétariat — gestion administrative et suivi</p>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Clock className="w-4 h-4" />
            {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-2 lg:grid-cols-4 gap-4"
        >
          {[
            { label: 'Élèves / Visiteurs', value: stats.students, icon: Users },
            { label: 'Enseignants', value: stats.teachers, icon: GraduationCap },
            { label: 'Formations publiées', value: stats.formations, icon: BookOpen },
            { label: 'Alertes facturation', value: stats.billingAlerts, icon: CreditCard, alert: stats.billingAlerts > 0 },
          ].map((item) => (
            <div
              key={item.label}
              className={`rounded-xl border p-5 transition-colors ${
                item.alert ? 'border-amber-500/40 bg-amber-500/5' : 'border-white/10 bg-[#151a21]/80'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-wider text-gray-400">{item.label}</span>
                <item.icon className={`w-5 h-5 ${item.alert ? 'text-amber-400' : 'text-[#D4AF37]'}`} />
              </div>
              <div className="mt-3 text-2xl font-bold text-white">
                {loadingData ? <Loader2 className="w-6 h-6 animate-spin text-[#D4AF37]" /> : item.value}
              </div>
            </div>
          ))}
        </motion.div>

        {/* Quick actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <h2 className="text-lg font-semibold text-white mb-4">Accès rapide</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {quickActions.map((action, idx) => (
              <Link
                key={idx}
                to={action.link}
                className="group flex items-center gap-3 p-4 rounded-xl border border-white/10 bg-[#151a21]/60 hover:border-[#D4AF37]/40 hover:bg-[#192734]/80 transition-all"
              >
                <div className={`p-2 rounded-lg bg-white/5 ${action.color} group-hover:bg-white/10`}>
                  <action.icon className="w-5 h-5" />
                </div>
                <span className="text-sm font-medium text-gray-200 group-hover:text-white truncate">{action.label}</span>
                <ArrowRight className="w-4 h-4 text-gray-500 group-hover:text-[#D4AF37] group-hover:translate-x-1 transition-all ml-auto flex-shrink-0" />
              </Link>
            ))}
          </div>
        </motion.div>

        {/* Administrative queue + content grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Queue - 2 cols */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="lg:col-span-2"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-[#D4AF37]" />
                Demandes à traiter
              </h2>
              <span className="text-xs text-gray-500">
                {loadingData ? '...' : `${administrativeQueue.length} en attente`}
              </span>
            </div>

            <div className="space-y-3">
              {loadingData ? (
                <div className="rounded-xl border border-white/10 bg-[#151a21]/60 p-6 flex items-center justify-center gap-2 text-gray-400">
                  <Loader2 className="w-5 h-5 animate-spin text-[#D4AF37]" />
                  Chargement...
                </div>
              ) : administrativeQueue.length > 0 ? (
                administrativeQueue.map((task) => (
                  <div
                    key={task.id}
                    className="rounded-xl border border-white/10 bg-[#151a21]/60 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-xs text-gray-400 uppercase">
                        {task.type === 'facturation' ? (
                          <CreditCard className="w-3.5 h-3.5 text-amber-400" />
                        ) : (
                          <AlertTriangle className="w-3.5 h-3.5 text-[#D4AF37]" />
                        )}
                        {task.type}
                      </div>
                      <p className="text-white font-medium mt-1 truncate">{task.title}</p>
                      <p className="text-gray-400 text-sm truncate">{task.subject}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Button
                        size="sm"
                        className="bg-[#D4AF37] text-black hover:bg-amber-500 font-semibold"
                        onClick={() => handleTaskAction(task)}
                        disabled={Boolean(taskLoading[task.id])}
                      >
                        {taskLoading[task.id] ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          task.actionLabel
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-white/20 text-gray-400 hover:bg-white/5"
                        onClick={() => handleDismissTask(task)}
                      >
                        Retirer
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-xl border border-white/10 bg-[#151a21]/40 p-6 text-center">
                  <CheckCircle2 className="w-10 h-10 text-emerald-500/50 mx-auto mb-2" />
                  <p className="text-gray-500 text-sm">Aucune demande urgente</p>
                </div>
              )}
            </div>

            {recentlyProcessed.length > 0 && (
              <div className="mt-6 pt-6 border-t border-white/10">
                <h3 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
                  <History className="w-4 h-4 text-[#D4AF37]" />
                  Dernières actions
                </h3>
                <ul className="space-y-2">
                  {recentlyProcessed.slice(0, 4).map((item) => (
                    <li key={item.id} className="text-sm text-gray-400 flex justify-between gap-2">
                      <span>
                        <span className="text-[#D4AF37]">{item.type}</span> — {item.subject}
                      </span>
                      <span className="text-gray-500 text-xs whitespace-nowrap">{item.processedAt}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </motion.div>

          {/* Right column: announcements + teachers */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="space-y-6"
          >
            <div>
              <h2 className="text-lg font-semibold text-white mb-4">Annonces</h2>
              <div className="space-y-3">
                {loadingData ? (
                  <div className="text-gray-400 text-sm flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Chargement...
                  </div>
                ) : (
                  announcements.map((a) => (
                    <AnnouncementCard key={a.id} announcement={a} />
                  ))
                )}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-white">Équipe pédagogique</h2>
                <Link
                  to="/secretariat-space/teachers"
                  className="text-xs text-[#D4AF37] hover:text-amber-400 transition-colors"
                >
                  Voir tout →
                </Link>
              </div>
              <div className="space-y-3">
                {loadingData ? (
                  <div className="text-gray-400 text-sm flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Chargement...
                  </div>
                ) : teachers.length > 0 ? (
                  teachers.slice(0, 3).map((t) => (
                    <div key={t.id} className="transform scale-95 origin-top">
                      <TeacherCard teacher={t} onContact={() => {}} />
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500 text-sm">Aucun enseignant</p>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default SecretariatPage;
