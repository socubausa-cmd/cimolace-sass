import React from 'react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useAdminDashboard } from '@/hooks/useAdmin';
import { Link } from 'react-router-dom';
import { 
  Users, 
  FileText, 
  Settings, 
  ShieldAlert, 
  Activity, 
  LogOut,
  ChevronRight,
  RefreshCw,
  AlertTriangle,
  MessageCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';

const AdminDashboard = () => {
  const { user, profile, logout } = useAuth();
  const { stats: dashboardStats, activities, loading, error, refresh } = useAdminDashboard();

  const statCards = [
    {
      title: 'Utilisateurs',
      value: loading ? '…' : String(dashboardStats.usersCount),
      icon: Users,
      color: 'text-blue-400',
      bg: 'bg-blue-400/10',
      link: '/admin/users',
    },
    {
      title: 'Contenu publié',
      value: loading ? '…' : String(dashboardStats.publishedFormations),
      icon: FileText,
      color: 'text-green-400',
      bg: 'bg-green-400/10',
      link: '/admin/content',
    },
    {
      title: 'Activités (24h)',
      value: loading ? '…' : String(dashboardStats.activityCount24h),
      icon: ShieldAlert,
      color: 'text-purple-400',
      bg: 'bg-purple-400/10',
      link: '/admin/logs',
    },
    {
      title: 'Système',
      value: loading ? '…' : dashboardStats.systemStatus,
      icon: Activity,
      color: dashboardStats.systemStatus === 'Alerte' ? 'text-red-400' : 'text-[#7B61FF]',
      bg: dashboardStats.systemStatus === 'Alerte' ? 'bg-red-400/10' : 'bg-[#7B61FF]/10',
      link: '/admin/settings',
    },
    {
      title: 'Communautés',
      value: '—',
      icon: MessageCircle,
      color: 'text-cyan-400',
      bg: 'bg-cyan-400/10',
      link: '/admin/communities',
    },
  ];

  return (
    <div className="min-h-screen premium-dashboard-shell text-white p-6 pb-20">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 premium-panel p-6">
          <div>
            <h1 className="text-3xl font-serif font-bold text-white mb-2">Tableau de Bord</h1>
            <p className="text-gray-400">Bienvenue, <span className="text-[#7B61FF] font-medium">{profile?.full_name}</span></p>
          </div>
          <div className="flex items-center gap-3">
             <Button
               variant="outline"
               onClick={refresh}
               className="border-white/10 text-white hover:bg-white/5"
               disabled={loading}
             >
               <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Actualiser
             </Button>
             <div className="text-right hidden md:block">
                <div className="text-sm font-medium text-white">{user?.email}</div>
                <div className="text-sm text-gray-500 uppercase">{profile?.role}</div>
             </div>
             <Button variant="outline" onClick={logout} className="border-red-500/20 text-red-400 hover:bg-red-500/10 hover:text-red-300">
                <LogOut className="w-4 h-4 mr-2" /> Déconnexion
             </Button>
          </div>
        </div>

        {error ? (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-300 mt-0.5" />
            <div>
              <p className="text-red-200 font-semibold">Erreur de synchronisation Supabase</p>
              <p className="text-red-200/80 text-sm mt-1">{String(error?.message || error)}</p>
            </div>
          </div>
        ) : null}

        <div className="grid md:grid-cols-3 gap-4">
          <div className="premium-panel p-4">
            <p className="text-xs uppercase tracking-wider text-gray-500">Paiements confirmés</p>
            <p className="text-2xl font-bold mt-1">{loading ? '…' : dashboardStats.confirmedPayments}</p>
          </div>
          <div className="premium-panel p-4">
            <p className="text-xs uppercase tracking-wider text-gray-500">Revenu confirmé</p>
            <p className="text-2xl font-bold mt-1">{loading ? '…' : `${Number(dashboardStats.revenueConfirmed || 0).toFixed(2)} EUR`}</p>
          </div>
          <div className="premium-panel p-4">
            <p className="text-xs uppercase tracking-wider text-gray-500">Webhooks en attente</p>
            <p className={`text-2xl font-bold mt-1 ${dashboardStats.pendingWebhooks > 0 ? 'text-violet-300' : 'text-green-400'}`}>
              {loading ? '…' : dashboardStats.pendingWebhooks}
            </p>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {statCards.map((stat, idx) => (
            <Link key={idx} to={stat.link} className="block group">
              <div className="premium-panel p-6 hover:border-[#7B61FF]/30 transition-all hover:-translate-y-1">
                <div className="flex justify-between items-start mb-4">
                  <div className={`p-3 rounded-lg ${stat.bg} ${stat.color}`}>
                    <stat.icon className="w-6 h-6" />
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-600 group-hover:text-[#7B61FF] transition-colors" />
                </div>
                <h3 className="text-gray-400 text-sm font-medium uppercase tracking-wider mb-1">{stat.title}</h3>
                <p className="text-2xl font-bold text-white">{stat.value}</p>
              </div>
            </Link>
          ))}
        </div>

        {/* Content & Logs Section */}
        <div className="grid lg:grid-cols-3 gap-8">
          
          {/* Quick Actions / Recent Activity */}
          <div className="lg:col-span-2 premium-panel overflow-hidden">
            <div className="p-6 border-b border-white/5 flex justify-between items-center">
              <h2 className="text-lg font-bold">Activité Récente (Audit Logs)</h2>
              <Link to="/admin/logs" className="text-sm text-[#7B61FF] hover:underline">Voir tout</Link>
            </div>
            <div className="divide-y divide-white/5">
              {loading ? (
                <div className="p-6 text-center text-gray-500">Chargement...</div>
              ) : activities.slice(0, 8).map((log) => (
                <div key={log.id} className="p-4 flex items-center gap-4 hover:bg-white/5 transition-colors">
                  <div className="w-2 h-2 rounded-full bg-[#7B61FF]" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white">
                      <span className="text-[#7B61FF]">{log.action.toUpperCase()}</span> sur {log.resource_type}
                    </p>
                    <p className="text-sm text-gray-500">
                      Par {log.profiles?.full_name || log.user_id} • {new Date(log.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
              {activities.length === 0 && !loading && (
                <div className="p-6 text-center text-gray-500">Aucune activité récente.</div>
              )}
            </div>
          </div>

          {/* User Profile Card */}
          <div className="premium-panel p-6">
            <div className="flex flex-col items-center text-center">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#7B61FF] to-[#5b21b6] p-1 mb-4">
                <div className="w-full h-full rounded-full bg-[#0F1419] flex items-center justify-center">
                   <Users className="w-10 h-10 text-gray-400" />
                </div>
              </div>
              <h3 className="text-xl font-bold text-white">{profile?.full_name}</h3>
              <p className="text-sm text-gray-400 mb-6">{profile?.email}</p>
              
              <div className="w-full space-y-3">
                 <div className="flex justify-between text-sm py-2 border-b border-white/5">
                    <span className="text-gray-500">Rôle</span>
                    <span className="text-white capitalize">{profile?.role}</span>
                 </div>
                 <div className="flex justify-between text-sm py-2 border-b border-white/5">
                    <span className="text-gray-500">Statut</span>
                    <span className="text-green-400">Actif</span>
                 </div>
                 <div className="flex justify-between text-sm py-2 border-b border-white/5">
                    <span className="text-gray-500">Dernière connexion</span>
                    <span className="text-white">{new Date().toLocaleDateString()}</span>
                 </div>
              </div>
              
              <Button variant="accent" className="w-full mt-6">
                Modifier Profil
              </Button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;