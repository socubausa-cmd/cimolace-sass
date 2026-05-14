import React from 'react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Users, 
  BookOpen, 
  CreditCard, 
  MessageSquare, 
  TrendingUp, 
  ShieldAlert, 
  Activity 
} from 'lucide-react';
import { Link } from 'react-router-dom';

const StatCard = ({ title, value, icon: Icon, description, trend, trendUp }) => (
  <Card className="bg-[#192734] border-white/10 shadow-lg hover:border-[#7B61FF]/30 transition-all duration-300">
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium text-gray-400">{title}</CardTitle>
      <Icon className="h-4 w-4 text-[#7B61FF]" />
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold text-white">{value}</div>
      <p className="text-sm text-gray-500 mt-1">{description}</p>
      {trend && (
        <div className={`text-xs mt-2 flex items-center ${trendUp ? 'text-green-500' : 'text-red-500'}`}>
          <TrendingUp className={`w-3 h-3 mr-1 ${!trendUp && 'rotate-180'}`} />
          {trend}
        </div>
      )}
    </CardContent>
  </Card>
);

const ActivityItem = ({ icon: Icon, title, time, type }) => (
  <div className="flex items-start space-x-4 p-4 rounded-lg bg-[#0F1419] border border-white/5 hover:border-white/10 transition-colors">
    <div className={`p-2 rounded-full ${
      type === 'alert' ? 'bg-red-500/10 text-red-500' : 
      type === 'success' ? 'bg-green-500/10 text-green-500' : 
      'bg-[#7B61FF]/10 text-[#7B61FF]'
    }`}>
      <Icon className="w-4 h-4" />
    </div>
    <div className="flex-1">
      <p className="text-sm font-medium text-white">{title}</p>
      <p className="text-sm text-gray-500 mt-1">{time}</p>
    </div>
  </div>
);

const OwnerDashboard = () => {
  const { profile } = useAuth();

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-serif font-bold text-white">
            Bonjour, {profile?.full_name?.split(' ')[0] || 'Admin'}
          </h1>
          <p className="text-gray-400 mt-1">
            Vue d'ensemble de l'académie et des opérations en cours.
          </p>
        </div>
        <div className="flex gap-2">
           <Button variant="accent">
             <Activity className="w-4 h-4 mr-2" /> Rapports
           </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard 
          title="Étudiants Actifs" 
          value="142" 
          icon={Users} 
          description="Total inscrits sur la plateforme"
          trend="+12% ce mois"
          trendUp={true}
        />
        <StatCard 
          title="Modules en Cours" 
          value="28" 
          icon={BookOpen} 
          description="Formations actives"
          trend="+3 nouveaux"
          trendUp={true}
        />
        <StatCard 
          title="Revenus Mensuels" 
          value="12,450 €" 
          icon={CreditCard} 
          description="Mise à jour il y a 1h"
          trend="+8.5% vs N-1"
          trendUp={true}
        />
        <StatCard 
          title="Demandes Contact" 
          value="15" 
          icon={MessageSquare} 
          description="En attente de réponse"
          trend="3 urgentes"
          trendUp={false}
        />
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Main Chart Area (Placeholder) */}
        <Card className="lg:col-span-2 bg-[#192734] border-white/10">
          <CardHeader>
            <CardTitle className="text-white">Activité Récente</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
               <ActivityItem 
                 icon={Users} 
                 title="Nouvel étudiant inscrit : Sarah Connor" 
                 time="Il y a 2 minutes" 
                 type="success"
               />
               <ActivityItem 
                 icon={CreditCard} 
                 title="Paiement reçu : Module 1ère Année" 
                 time="Il y a 15 minutes" 
                 type="success"
               />
               <ActivityItem 
                 icon={ShieldAlert} 
                 title="Tentative de connexion échouée (IP: 192.168.1.1)" 
                 time="Il y a 45 minutes" 
                 type="alert"
               />
               <ActivityItem 
                 icon={MessageSquare} 
                 title="Nouveau message de contact : Renseignement Cycle Sacerdotal" 
                 time="Il y a 1 heure" 
                 type="info"
               />
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions / Side Panel */}
        <Card className="bg-[#192734] border-white/10">
           <CardHeader>
            <CardTitle className="text-white">Actions Rapides</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Link to="/admin/users">
              <Button variant="outline" className="w-full justify-start border-white/10 hover:bg-white/5 text-gray-300">
                <Users className="w-4 h-4 mr-2" /> Gérer les Utilisateurs
              </Button>
            </Link>
            <Link to="/admin/content">
              <Button variant="outline" className="w-full justify-start border-white/10 hover:bg-white/5 text-gray-300">
                <BookOpen className="w-4 h-4 mr-2" /> Éditeur de Contenu
              </Button>
            </Link>
             <Link to="/admin/logs">
              <Button variant="outline" className="w-full justify-start border-white/10 hover:bg-white/5 text-gray-300">
                <ShieldAlert className="w-4 h-4 mr-2" /> Logs d'Audit
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default OwnerDashboard;