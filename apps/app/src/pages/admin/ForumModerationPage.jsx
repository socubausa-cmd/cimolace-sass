import React, { useEffect, useState, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield,
  Flag,
  CheckCircle,
  XCircle,
  Eye,
  MessageSquare,
  User,
  TrendingUp,
  AlertTriangle,
  Ban,
  Trash2,
  CheckCircle2,
  Clock,
  Search,
  Filter,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  MoreHorizontal,
  AlertOctagon,
  Award,
} from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { cn } from '@/lib/utils';
import CimolacePremiumShell from '@/components/cimolace/CimolacePremiumShell';
import { REPUTATION_BADGES, REPUTATION_LEVELS } from '@/hooks/useForumNotifications';

/**
 * Page de modération complète pour le forum
 *
 * Features:
 * - Queue de signalements (reports)
 * - Liste des utilisateurs avec réputation
 * - Actions rapides (ban, delete, warn)
 * - Stats du forum
 * - Recherche utilisateur
 */
export default function ForumModerationPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('reports'); // reports | users | stats
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  // Reports
  const [reports, setReports] = useState([]);
  const [reportsFilter, setReportsFilter] = useState('pending'); // pending | resolved | all

  // Users
  const [users, setUsers] = useState([]);
  const [userSearch, setUserSearch] = useState('');
  const [userSort, setUserSort] = useState('points'); // points | questions | answers | reports

  // Stats
  const [stats, setStats] = useState({
    totalQuestions: 0,
    totalAnswers: 0,
    totalUsers: 0,
    pendingReports: 0,
    todayQuestions: 0,
    todayAnswers: 0,
  });

  // Auth check
  useEffect(() => {
    const checkAdmin = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/login');
        return;
      }

      // Check if user has admin role
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      const adminRoles = ['admin', 'moderator', 'super_admin'];
      if (!adminRoles.includes(profile?.role)) {
        navigate('/');
        return;
      }

      setIsAdmin(true);
      loadData();
    };

    checkAdmin();
  }, [navigate]);

  // Load all data
  const loadData = async () => {
    setLoading(true);
    await Promise.all([loadReports(), loadUsers(), loadStats()]);
    setLoading(false);
  };

  // Load reports queue
  const loadReports = async () => {
    let query = supabase
      .from('forum_moderation')
      .select('*, reporter:reporter_id(*), resolver:resolved_by(*)')
      .order('created_at', { ascending: false });

    if (reportsFilter === 'pending') {
      query = query.eq('status', 'pending');
    } else if (reportsFilter === 'resolved') {
      query = query.in('status', ['resolved', 'dismissed']);
    }

    const { data } = await query.limit(100);
    setReports(data || []);
  };

  // Load users with reputation
  const loadUsers = async () => {
    let query = supabase
      .from('user_reputation_leaderboard')
      .select('*');

    if (userSearch) {
      query = query.ilike('display_name', `%${userSearch}%`);
    }

    const { data } = await query.limit(100);
    setUsers(data || []);
  };

  // Load forum stats
  const loadStats = async () => {
    const today = new Date().toISOString().split('T')[0];

    const [
      { count: totalQuestions },
      { count: totalAnswers },
      { count: totalUsers },
      { count: pendingReports },
      { count: todayQuestions },
      { count: todayAnswers },
    ] = await Promise.all([
      supabase.from('formation_student_questions').select('*', { count: 'exact', head: true }),
      supabase.from('formation_question_answers').select('*', { count: 'exact', head: true }),
      supabase.from('user_reputation').select('*', { count: 'exact', head: true }),
      supabase.from('forum_moderation').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('formation_student_questions').select('*', { count: 'exact', head: true }).gte('created_at', today),
      supabase.from('formation_question_answers').select('*', { count: 'exact', head: true }).gte('created_at', today),
    ]);

    setStats({
      totalQuestions: totalQuestions || 0,
      totalAnswers: totalAnswers || 0,
      totalUsers: totalUsers || 0,
      pendingReports: pendingReports || 0,
      todayQuestions: todayQuestions || 0,
      todayAnswers: todayAnswers || 0,
    });
  };

  // Resolve report
  const resolveReport = async (reportId, action, notes = '') => {
    await supabase
      .from('forum_moderation')
      .update({
        status: 'resolved',
        resolution_action: action,
        resolution_notes: notes,
        resolved_at: new Date().toISOString(),
      })
      .eq('id', reportId);

    await loadReports();
  };

  // Dismiss report
  const dismissReport = async (reportId, notes = '') => {
    await supabase
      .from('forum_moderation')
      .update({
        status: 'dismissed',
        resolution_notes: notes,
        resolved_at: new Date().toISOString(),
      })
      .eq('id', reportId);

    await loadReports();
  };

  // Hide post
  const hidePost = async (postId, postType) => {
    const table = postType === 'question' ? 'formation_student_questions' : 'formation_question_answers';
    await supabase
      .from(table)
      .update({ is_public: false })
      .eq('id', postId);
  };

  // Ban user (soft delete / mark as banned)
  const banUser = async (userId, reason) => {
    await supabase
      .from('profiles')
      .update({
        is_banned: true,
        banned_at: new Date().toISOString(),
        ban_reason: reason,
      })
      .eq('id', userId);
  };

  // Warn user
  const warnUser = async (userId, message) => {
    await supabase.from('forum_notifications').insert({
      user_id: userId,
      type: 'moderation',
      message: `Avertissement modération: ${message}`,
      is_read: false,
    });
  };

  // Format relative time
  const formatRelative = (value) => {
    if (!value) return '';
    const d = new Date(value);
    const now = new Date();
    const diffMins = Math.floor((now - d) / 60000);
    const diffHours = Math.floor((now - d) / 3600000);
    const diffDays = Math.floor((now - d) / 86400000);

    if (diffMins < 1) return "À l'instant";
    if (diffMins < 60) return `Il y a ${diffMins} min`;
    if (diffHours < 24) return `Il y a ${diffHours}h`;
    if (diffDays === 1) return 'Hier';
    return `Il y a ${diffDays} jours`;
  };

  if (!isAdmin) {
    return (
      <CimolacePremiumShell>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <Shield className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">Vérification des permissions...</p>
          </div>
        </div>
      </CimolacePremiumShell>
    );
  }

  return (
    <CimolacePremiumShell>
      <Helmet>
        <title>Modération Forum | Admin</title>
      </Helmet>

      <div className="min-h-screen pt-24 pb-16">
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-orange-500 rounded-xl flex items-center justify-center">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-[#0a0a0f]">Modération Forum</h1>
                <p className="text-[#6e6e73]">Gérez les signalements, utilisateurs et statistiques</p>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-white border border-[#e5e5ea] rounded-xl p-4">
                <div className="flex items-center gap-2 text-[#6e6e73] text-sm mb-1">
                  <Flag className="w-4 h-4" />
                  Signalements en attente
                </div>
                <p className="text-2xl font-bold text-[#0a0a0f]">{stats.pendingReports}</p>
              </div>
              <div className="bg-white border border-[#e5e5ea] rounded-xl p-4">
                <div className="flex items-center gap-2 text-[#6e6e73] text-sm mb-1">
                  <MessageSquare className="w-4 h-4" />
                  Questions aujourd'hui
                </div>
                <p className="text-2xl font-bold text-[#0a0a0f]">{stats.todayQuestions}</p>
              </div>
              <div className="bg-white border border-[#e5e5ea] rounded-xl p-4">
                <div className="flex items-center gap-2 text-[#6e6e73] text-sm mb-1">
                  <CheckCircle2 className="w-4 h-4" />
                  Réponses aujourd'hui
                </div>
                <p className="text-2xl font-bold text-[#0a0a0f]">{stats.todayAnswers}</p>
              </div>
              <div className="bg-white border border-[#e5e5ea] rounded-xl p-4">
                <div className="flex items-center gap-2 text-[#6e6e73] text-sm mb-1">
                  <User className="w-4 h-4" />
                  Utilisateurs actifs
                </div>
                <p className="text-2xl font-bold text-[#0a0a0f]">{stats.totalUsers}</p>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 border-b border-[#e5e5ea]">
              {[
                { id: 'reports', label: 'Signalements', icon: Flag, count: stats.pendingReports },
                { id: 'users', label: 'Utilisateurs', icon: User },
                { id: 'stats', label: 'Statistiques', icon: TrendingUp },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'flex items-center gap-2 px-4 py-3 font-medium transition-colors relative',
                    activeTab === tab.id
                      ? 'text-[#d97757]'
                      : 'text-[#6e6e73] hover:text-[#0a0a0f]'
                  )}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                  {tab.count > 0 && (
                    <span className="ml-1 px-1.5 py-0.5 bg-red-500 text-white text-xs rounded-full">
                      {tab.count}
                    </span>
                  )}
                  {activeTab === tab.id && (
                    <motion.div
                      layoutId="activeTab"
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#d97757]"
                    />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          <AnimatePresence mode="wait">
            {loading ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center justify-center py-20"
              >
                <RefreshCw className="w-8 h-8 animate-spin text-[#d97757]" />
              </motion.div>
            ) : (
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.2 }}
              >
                {/* Reports Tab */}
                {activeTab === 'reports' && (
                  <div className="space-y-4">
                    {/* Filters */}
                    <div className="flex gap-2">
                      {['pending', 'resolved', 'all'].map((filter) => (
                        <button
                          key={filter}
                          onClick={() => {
                            setReportsFilter(filter);
                            loadReports();
                          }}
                          className={cn(
                            'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                            reportsFilter === filter
                              ? 'bg-[#0a0a0f] text-white'
                              : 'bg-[#f5f5f7] text-[#6e6e73] hover:text-[#0a0a0f]'
                          )}
                        >
                          {filter === 'pending' && 'En attente'}
                          {filter === 'resolved' && 'Résolus'}
                          {filter === 'all' && 'Tous'}
                        </button>
                      ))}
                    </div>

                    {/* Reports List */}
                    {reports.length === 0 ? (
                      <div className="text-center py-12 bg-[#f5f5f7] rounded-xl">
                        <CheckCircle className="w-12 h-12 text-[#2cc275] mx-auto mb-4" />
                        <p className="text-[#6e6e73]">Aucun signalement {reportsFilter === 'pending' ? 'en attente' : ''}</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {reports.map((report) => (
                          <div
                            key={report.id}
                            className="bg-white border border-[#e5e5ea] rounded-xl p-5"
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <span className={cn(
                                    'px-2 py-0.5 rounded text-xs font-medium',
                                    report.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                                    report.status === 'resolved' ? 'bg-green-100 text-green-700' :
                                    'bg-gray-100 text-gray-600'
                                  )}>
                                    {report.status === 'pending' ? 'En attente' :
                                     report.status === 'resolved' ? 'Résolu' : 'Rejeté'}
                                  </span>
                                  <span className="px-2 py-0.5 bg-[#f5f5f7] text-[#6e6e73] text-xs rounded">
                                    {report.post_type === 'question' ? 'Question' : 'Réponse'}
                                  </span>
                                  <span className="text-xs text-[#6e6e73]">
                                    {formatRelative(report.created_at)}
                                  </span>
                                </div>

                                <p className="font-medium text-[#0a0a0f] mb-2">
                                  Motif: {report.reason}
                                </p>

                                {report.description && (
                                  <p className="text-sm text-[#6e6e73] mb-3">
                                    "{report.description}"
                                  </p>
                                )}

                                <div className="flex items-center gap-4 text-sm text-[#6e6e73]">
                                  <span>Signalé par: {report.reporter?.full_name || report.reporter?.email || 'Anonyme'}</span>
                                  {report.resolved_by && (
                                    <span>Résolu par: {report.resolver?.full_name}</span>
                                  )}
                                </div>
                              </div>

                              {/* Actions */}
                              {report.status === 'pending' && (
                                <div className="flex flex-col gap-2">
                                  <Link
                                    to={`/student-school-life/forum/thread/${report.post_id}`}
                                    target="_blank"
                                    className="flex items-center gap-1 px-3 py-1.5 text-sm text-[#d97757] hover:bg-[#d97757]/10 rounded-lg transition-colors"
                                  >
                                    <Eye className="w-4 h-4" />
                                    Voir
                                  </Link>
                                  <button
                                    onClick={() => resolveReport(report.id, 'content_removed', 'Contenu masqué par modération')}
                                    className="flex items-center gap-1 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                  >
                                    <Eye className="w-4 h-4" />
                                    Masquer
                                  </button>
                                  <button
                                    onClick={() => resolveReport(report.id, 'user_warned', 'Utilisateur averti')}
                                    className="flex items-center gap-1 px-3 py-1.5 text-sm text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                                  >
                                    <AlertTriangle className="w-4 h-4" />
                                    Avertir
                                  </button>
                                  <button
                                    onClick={() => dismissReport(report.id, 'Sans suite')}
                                    className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                                  >
                                    <XCircle className="w-4 h-4" />
                                    Rejeter
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Users Tab */}
                {activeTab === 'users' && (
                  <div className="space-y-4">
                    {/* Search */}
                    <div className="flex gap-3">
                      <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#6e6e73]" />
                        <input
                          type="text"
                          value={userSearch}
                          onChange={(e) => setUserSearch(e.target.value)}
                          placeholder="Rechercher un utilisateur..."
                          className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#e5e5ea] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#d97757]/20"
                        />
                      </div>
                      <select
                        value={userSort}
                        onChange={(e) => setUserSort(e.target.value)}
                        className="px-4 py-2.5 bg-white border border-[#e5e5ea] rounded-xl focus:outline-none"
                      >
                        <option value="points">Points</option>
                        <option value="questions">Questions</option>
                        <option value="answers">Réponses</option>
                      </select>
                    </div>

                    {/* Users Table */}
                    <div className="bg-white border border-[#e5e5ea] rounded-xl overflow-hidden">
                      <table className="w-full">
                        <thead className="bg-[#f5f5f7]">
                          <tr>
                            <th className="px-4 py-3 text-left text-sm font-medium text-[#6e6e73]">Utilisateur</th>
                            <th className="px-4 py-3 text-left text-sm font-medium text-[#6e6e73]">Niveau</th>
                            <th className="px-4 py-3 text-center text-sm font-medium text-[#6e6e73]">Points</th>
                            <th className="px-4 py-3 text-center text-sm font-medium text-[#6e6e73]">Q/R</th>
                            <th className="px-4 py-3 text-center text-sm font-medium text-[#6e6e73]">Badges</th>
                            <th className="px-4 py-3 text-right text-sm font-medium text-[#6e6e73]">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#e5e5ea]">
                          {users.map((user) => (
                            <tr key={user.user_id} className="hover:bg-[#f5f5f7]/50">
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#d97757] to-[#e2854f] flex items-center justify-center text-white font-semibold">
                                    {user.display_name?.charAt(0)?.toUpperCase() || '?'}
                                  </div>
                                  <div>
                                    <p className="font-medium text-[#0a0a0f]">{user.display_name || 'Anonyme'}</p>
                                    <p className="text-xs text-[#6e6e73]">{user.user_id.slice(0, 8)}...</p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <span className={cn(
                                  'px-2 py-1 rounded text-xs font-medium capitalize',
                                  user.level === 'veteran' ? 'bg-[#d97757] text-[#d97757]' :
                                  user.level === 'expert' ? 'bg-[#d97757] text-[#d97757]' :
                                  user.level === 'contributor' ? 'bg-green-100 text-green-700' :
                                  'bg-gray-100 text-gray-600'
                                )}>
                                  {REPUTATION_LEVELS[user.level]?.label || user.level}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className="font-semibold text-[#0a0a0f]">{user.points}</span>
                              </td>
                              <td className="px-4 py-3 text-center text-sm text-[#6e6e73]">
                                {user.questions_count} / {user.answers_count}
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex gap-1 justify-center">
                                  {(user.badges || []).slice(0, 3).map((badge) => (
                                    <span
                                      key={badge}
                                      title={REPUTATION_BADGES[badge]?.label}
                                      className="w-6 h-6 rounded-full flex items-center justify-center text-xs"
                                      style={{ backgroundColor: REPUTATION_BADGES[badge]?.color + '20' }}
                                    >
                                      {REPUTATION_BADGES[badge]?.icon}
                                    </span>
                                  ))}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    onClick={() => warnUser(user.user_id, 'Avertissement général')}
                                    className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                                    title="Avertir"
                                  >
                                    <AlertTriangle className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => banUser(user.user_id, 'Comportement inapproprié')}
                                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                    title="Bannir"
                                  >
                                    <Ban className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Stats Tab */}
                {activeTab === 'stats' && (
                  <div className="space-y-6">
                    {/* Overview Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-gradient-to-br from-[#d97757] to-[#e2854f] rounded-xl p-6 text-white">
                        <p className="text-white/70 text-sm mb-1">Total Questions</p>
                        <p className="text-4xl font-bold">{stats.totalQuestions}</p>
                        <p className="text-white/60 text-sm mt-2">+{stats.todayQuestions} aujourd'hui</p>
                      </div>
                      <div className="bg-gradient-to-br from-[#2cc275] to-[#3dd686] rounded-xl p-6 text-white">
                        <p className="text-white/70 text-sm mb-1">Total Réponses</p>
                        <p className="text-4xl font-bold">{stats.totalAnswers}</p>
                        <p className="text-white/60 text-sm mt-2">+{stats.todayAnswers} aujourd'hui</p>
                      </div>
                      <div className="bg-gradient-to-br from-[#ff6b4a] to-[#ff8f70] rounded-xl p-6 text-white">
                        <p className="text-white/70 text-sm mb-1">Ratio Q/R</p>
                        <p className="text-4xl font-bold">
                          {stats.totalQuestions > 0
                            ? (stats.totalAnswers / stats.totalQuestions).toFixed(1)
                            : '0'}
                        </p>
                        <p className="text-white/60 text-sm mt-2">réponses/question</p>
                      </div>
                    </div>

                    {/* Activity Chart Placeholder */}
                    <div className="bg-white border border-[#e5e5ea] rounded-xl p-6">
                      <h3 className="font-semibold text-[#0a0a0f] mb-4">Activité des 7 derniers jours</h3>
                      <div className="h-48 bg-[#f5f5f7] rounded-lg flex items-center justify-center">
                        <p className="text-[#6e6e73]">Graphique d'activité (intégrer Chart.js ou Recharts)</p>
                      </div>
                    </div>

                    {/* Top Contributors */}
                    <div className="bg-white border border-[#e5e5ea] rounded-xl p-6">
                      <h3 className="font-semibold text-[#0a0a0f] mb-4">Top Contributeurs</h3>
                      <div className="space-y-3">
                        {users.slice(0, 5).map((user, idx) => (
                          <div key={user.user_id} className="flex items-center gap-4">
                            <span className="w-8 text-center font-bold text-[#6e6e73]">#{idx + 1}</span>
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#d97757] to-[#e2854f] flex items-center justify-center text-white font-semibold">
                              {user.display_name?.charAt(0)?.toUpperCase() || '?'}
                            </div>
                            <div className="flex-1">
                              <p className="font-medium text-[#0a0a0f]">{user.display_name || 'Anonyme'}</p>
                              <p className="text-xs text-[#6e6e73]">
                                {user.questions_count} questions · {user.answers_count} réponses
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-[#d97757]">{user.points} pts</p>
                              <p className="text-xs text-[#6e6e73]">{user.accepted_answers_count} ✓</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </CimolacePremiumShell>
  );
}
