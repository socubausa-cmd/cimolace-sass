import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  ShoppingCart, 
  Users, 
  Package, 
  Settings, 
  BarChart3, 
  LogOut, 
  Menu, 
  X,
  Search,
  Bell,
  ArrowUpRight,
  Loader2,
  RefreshCw,
  MoreVertical,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/components/ui/use-toast';
import { motion, AnimatePresence } from 'framer-motion';

const SimpleBarChart = ({ data }) => {
  if (!data || data.length === 0) return <div className="h-64 flex items-center justify-center text-gray-500">Pas de données disponibles</div>;

  const maxVal = Math.max(...data.map(d => d.value));
  
  return (
    <div className="h-64 flex items-end justify-between gap-2 pt-8 pb-2">
      {data.map((item, index) => (
        <div key={index} className="flex flex-col items-center gap-2 flex-1 group">
          <div className="relative w-full flex justify-center items-end h-full">
            <div 
              className="w-full max-w-[30px] bg-[#d97757] rounded-t-sm opacity-70 group-hover:opacity-100 transition-all duration-300 relative group-hover:bg-[#d97757]"
              style={{ height: `${(item.value / maxVal) * 100}%` }}
            >
               <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                 {item.value}€
               </div>
            </div>
          </div>
          <span className="text-[10px] text-gray-400 rotate-0 truncate w-full text-center">{item.label}</span>
        </div>
      ))}
    </div>
  );
};

const OwnerAdminDashboard = () => {
  const { user, profile, logout } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // Data States
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalSales: 0,
    totalOrders: 0,
    totalCustomers: 0,
    totalRevenue: 0
  });
  const [recentOrders, setRecentOrders] = useState([]);
  const [topCustomers, setTopCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [salesData, setSalesData] = useState([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Payments (Sales/Revenue/Orders)
      const { data: payments, error: paymentsError } = await supabase
        .from('payments')
        .select(`
          id,amount,student_id,created_at,
          student:student_id (
            id,
            user:user_id (
              email,
              full_name
            )
          )
        `)
        .order('created_at', { ascending: false })
        .limit(300);

      if (paymentsError) throw paymentsError;

      // 2. Fetch Modules (Products)
      const { data: modules, error: modulesError } = await supabase
        .from('modules_year2')
        .select('id,title,code,type,price,status')
        .limit(200);
        
      if (modulesError) throw modulesError;

      // --- Process Data ---

      // Calculate Totals
      const totalRevenue = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
      const uniqueCustomers = new Set(payments.map(p => p.student_id)).size;
      
      setStats({
        totalSales: totalRevenue,
        totalOrders: payments.length,
        totalCustomers: uniqueCustomers,
        totalRevenue: totalRevenue
      });

      // Recent Orders (First 10)
      setRecentOrders(payments.slice(0, 10));

      // Top Customers (Aggregation)
      const customerMap = {};
      payments.forEach(p => {
        const studentId = p.student_id;
        if (!studentId) return;
        
        if (!customerMap[studentId]) {
          customerMap[studentId] = {
            id: studentId,
            name: p.student?.user?.full_name || 'Utilisateur Inconnu',
            email: p.student?.user?.email || 'N/A',
            totalSpent: 0,
            ordersCount: 0
          };
        }
        customerMap[studentId].totalSpent += (Number(p.amount) || 0);
        customerMap[studentId].ordersCount += 1;
      });
      
      const sortedCustomers = Object.values(customerMap)
        .sort((a, b) => b.totalSpent - a.totalSpent)
        .slice(0, 5);
        
      setTopCustomers(sortedCustomers);

      // Products
      setProducts(modules || []);

      // Sales Chart Data (Last 30 Days)
      const last30Days = [...Array(30)].map((_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (29 - i));
        return { 
          date: d.toISOString().split('T')[0],
          label: d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }),
          value: 0 
        };
      });

      payments.forEach(p => {
        if (!p.created_at) return;
        const pDate = p.created_at.split('T')[0];
        const dayStat = last30Days.find(d => d.date === pDate);
        if (dayStat) {
          dayStat.value += (Number(p.amount) || 0);
        }
      });

      setSalesData(last30Days);

    } catch (error) {
      console.error("Dashboard Fetch Error:", error);
      toast({
        title: "Erreur de chargement",
        description: "Impossible de récupérer les données du tableau de bord.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const SidebarItem = ({ id, icon: Icon, label }) => (
    <button
      onClick={() => { setActiveTab(id); setSidebarOpen(false); }}
      className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 ${
        activeTab === id 
          ? 'bg-[#d97757] text-white shadow-md' 
          : 'text-gray-400 hover:bg-white/5 hover:text-white'
      }`}
    >
      <Icon className="w-5 h-5" />
      <span className="font-medium">{label}</span>
    </button>
  );

  const StatCard = ({ title, value, icon: Icon, subtext, trend }) => (
    <Card className="bg-[#192734] border-white/10 shadow-lg">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="p-2 bg-[#d97757]/20 rounded-lg text-[#d97757]">
            <Icon className="w-6 h-6" />
          </div>
          {trend && (
            <div className="flex items-center text-green-500 text-xs font-medium bg-green-900/20 px-2 py-1 rounded-full">
              <ArrowUpRight className="w-3 h-3 mr-1" />
              {trend}
            </div>
          )}
        </div>
        <h3 className="text-gray-400 text-sm font-medium">{title}</h3>
        <p className="text-2xl font-bold text-white mt-1">{value}</p>
        <p className="text-sm text-gray-500 mt-2">{subtext}</p>
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-[#262624] flex">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar Navigation */}
      <aside 
        className={`
          fixed md:static inset-y-0 left-0 z-50 w-64 bg-[#192734] border-r border-white/10 transform transition-transform duration-300 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
      >
        <div className="p-6 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-[#d97757] to-[#ebca5e] rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">A</span>
            </div>
            <span className="text-white font-bold text-lg tracking-tight">Admin<span className="text-[#d97757]">Panel</span></span>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="md:hidden text-gray-400">
            <X className="w-6 h-6" />
          </button>
        </div>

        <nav className="p-4 space-y-2">
          <SidebarItem id="dashboard" icon={LayoutDashboard} label="Tableau de Bord" />
          <SidebarItem id="orders" icon={ShoppingCart} label="Commandes" />
          <SidebarItem id="customers" icon={Users} label="Clients" />
          <SidebarItem id="products" icon={Package} label="Produits" />
          <SidebarItem id="analytics" icon={BarChart3} label="Analytique" />
          <SidebarItem id="settings" icon={Settings} label="Paramètres" />
        </nav>

        <div className="absolute bottom-0 w-full p-4 border-t border-white/10">
          <button 
            onClick={handleLogout}
            className="w-full flex items-center space-x-3 px-4 py-3 text-red-400 hover:bg-red-900/10 hover:text-red-300 rounded-lg transition-colors"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium">Déconnexion</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        
        {/* Header */}
        <header className="h-16 bg-[#192734] border-b border-white/10 flex items-center justify-between px-4 md:px-8">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setSidebarOpen(true)}
              className="md:hidden text-gray-400 hover:text-white"
            >
              <Menu className="w-6 h-6" />
            </button>
            <h1 className="text-xl font-bold text-white capitalize hidden md:block">
              {activeTab.replace('-', ' ')}
            </h1>
          </div>

          <div className="flex items-center space-x-4">
            <div className="relative hidden md:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <Input 
                placeholder="Rechercher..." 
                className="pl-9 w-64 bg-[#262624] border-white/10 text-white focus:ring-[#d97757]"
              />
            </div>
            
            <button className="relative text-gray-400 hover:text-white transition-colors">
              <Bell className="w-5 h-5" />
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-[#192734]"></span>
            </button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 hover:bg-white/5 p-1 rounded-full transition-colors">
                  <Avatar className="w-8 h-8 border border-white/10">
                    <AvatarImage src={profile?.avatar_url} />
                    <AvatarFallback className="bg-[#d97757] text-white">
                      {profile?.full_name?.charAt(0) || 'A'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="hidden md:block text-left mr-2">
                    <p className="text-sm font-medium text-white">{profile?.full_name || 'Admin'}</p>
                    <p className="text-sm text-gray-500">Propriétaire</p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 bg-[#192734] border-white/10 text-white">
                <DropdownMenuLabel>Mon Compte</DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-white/10" />
                <DropdownMenuItem className="hover:bg-white/5 cursor-pointer">Profil</DropdownMenuItem>
                <DropdownMenuItem className="hover:bg-white/5 cursor-pointer">Paramètres</DropdownMenuItem>
                <DropdownMenuSeparator className="bg-white/10" />
                <DropdownMenuItem onClick={handleLogout} className="text-red-400 hover:bg-red-900/10 cursor-pointer">
                  Déconnexion
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Dashboard Content Area */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
          {loading ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400">
              <Loader2 className="w-12 h-12 animate-spin mb-4 text-[#d97757]" />
              <p>Chargement des données...</p>
            </div>
          ) : (
            <AnimatePresence mode="wait">
              {activeTab === 'dashboard' && (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="space-y-8"
                >
                  {/* Stats Row */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <StatCard 
                      title="Chiffre d'Affaires" 
                      value={`${stats.totalRevenue.toLocaleString('fr-FR')} €`}
                      icon={BarChart3}
                      subtext="Total des paiements validés"
                      trend="+12.5%"
                    />
                    <StatCard 
                      title="Commandes" 
                      value={stats.totalOrders} 
                      icon={ShoppingCart}
                      subtext="Total des transactions"
                      trend="+5.2%"
                    />
                    <StatCard 
                      title="Clients" 
                      value={stats.totalCustomers} 
                      icon={Users}
                      subtext="Utilisateurs uniques"
                      trend="+8.1%"
                    />
                    <StatCard 
                      title="Produits Actifs" 
                      value={products.length} 
                      icon={Package}
                      subtext="Modules disponibles"
                    />
                  </div>

                  {/* Chart & Recent Orders Row */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Chart */}
                    <Card className="lg:col-span-2 bg-[#192734] border-white/10">
                      <CardHeader>
                        <CardTitle className="text-white">Aperçu des Ventes</CardTitle>
                        <CardDescription className="text-gray-400">Revenus des 30 derniers jours</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <SimpleBarChart data={salesData} />
                      </CardContent>
                    </Card>

                    {/* Top Customers */}
                    <Card className="bg-[#192734] border-white/10">
                      <CardHeader>
                        <CardTitle className="text-white">Meilleurs Clients</CardTitle>
                        <CardDescription className="text-gray-400">Par montant total dépensé</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {topCustomers.map((customer, i) => (
                          <div key={i} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                            <div className="flex items-center gap-3">
                              <Avatar className="h-9 w-9 border border-white/10">
                                <AvatarFallback className="bg-[#d97757] text-xs">
                                  {customer.name.charAt(0)}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="text-sm font-medium text-white truncate w-32">{customer.name}</p>
                                <p className="text-sm text-gray-500">{customer.ordersCount} commandes</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-bold text-white">{customer.totalSpent} €</p>
                            </div>
                          </div>
                        ))}
                        {topCustomers.length === 0 && <p className="text-sm text-gray-500 text-center py-4">Aucun client trouvé.</p>}
                      </CardContent>
                    </Card>
                  </div>

                  {/* Recent Orders Table */}
                  <Card className="bg-[#192734] border-white/10">
                    <CardHeader className="flex flex-row items-center justify-between">
                      <CardTitle className="text-white">Commandes Récentes</CardTitle>
                      <Button variant="outline" size="sm" onClick={fetchDashboardData}>
                        <RefreshCw className="w-4 h-4 mr-2" /> Actualiser
                      </Button>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                          <thead className="text-sm text-gray-400 uppercase bg-white/5">
                            <tr>
                              <th className="px-6 py-3">ID Commande</th>
                              <th className="px-6 py-3">Client</th>
                              <th className="px-6 py-3">Date</th>
                              <th className="px-6 py-3">Montant</th>
                              <th className="px-6 py-3">Statut</th>
                              <th className="px-6 py-3 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5">
                            {recentOrders.map((order) => (
                              <tr key={order.id} className="hover:bg-white/5 transition-colors">
                                <td className="px-6 py-4 font-mono text-sm text-gray-400">
                                  {order.id.slice(0, 8)}...
                                </td>
                                <td className="px-6 py-4">
                                  <div className="flex items-center gap-2">
                                    <div className="font-medium text-white">{order.student?.user?.full_name || 'Inconnu'}</div>
                                  </div>
                                </td>
                                <td className="px-6 py-4 text-gray-400">
                                  {new Date(order.created_at).toLocaleDateString('fr-FR')}
                                </td>
                                <td className="px-6 py-4 font-medium text-white">
                                  {order.amount} {order.currency || 'EUR'}
                                </td>
                                <td className="px-6 py-4">
                                  <Badge className={`${
                                    order.status === 'succeeded' || order.status === 'paid' ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30' : 
                                    order.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30' : 
                                    'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                                  }`}>
                                    {order.status || 'Inconnu'}
                                  </Badge>
                                </td>
                                <td className="px-6 py-4 text-right">
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-white">
                                    <MoreVertical className="w-4 h-4" />
                                  </Button>
                                </td>
                              </tr>
                            ))}
                            {recentOrders.length === 0 && (
                              <tr>
                                <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                                  Aucune commande récente.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {activeTab === 'products' && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="space-y-6"
                >
                  <Card className="bg-[#192734] border-white/10">
                    <CardHeader>
                      <CardTitle className="text-white">Gestion des Produits</CardTitle>
                      <CardDescription>Liste des modules de formation disponibles</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {products.map(product => (
                           <Card key={product.id} className="bg-[#262624] border-white/5 hover:border-[#d97757]/50 transition-colors">
                              <CardHeader className="pb-2">
                                <div className="flex justify-between items-start">
                                  <Badge variant="outline" className="border-white/10 text-gray-400">{product.code}</Badge>
                                  <Badge className="bg-[#d97757]">{product.price} €</Badge>
                                </div>
                                <CardTitle className="text-base text-white mt-2 line-clamp-1">{product.title}</CardTitle>
                              </CardHeader>
                              <CardContent>
                                <p className="text-sm text-gray-500 line-clamp-2 h-10">{product.description}</p>
                                <div className="mt-4 flex gap-2">
                                  <Button size="sm" variant="outline" className="w-full border-white/10 text-gray-300">Modifier</Button>
                                  <Button size="sm" variant="ghost" className="text-gray-400 hover:text-white"><MoreVertical className="w-4 h-4" /></Button>
                                </div>
                              </CardContent>
                           </Card>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {(activeTab === 'customers' || activeTab === 'orders' || activeTab === 'settings' || activeTab === 'analytics') && (
                <div className="flex flex-col items-center justify-center h-96 text-center">
                  <div className="bg-white/5 p-6 rounded-full mb-4">
                    <Settings className="w-12 h-12 text-gray-400" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">Section en développement</h3>
                  <p className="text-gray-500 max-w-md">
                    Cette fonctionnalité sera bientôt disponible. En attendant, utilisez le tableau de bord principal pour voir les données agrégées.
                  </p>
                  <Button className="mt-6 bg-[#d97757] hover:bg-[#d97757]" onClick={() => setActiveTab('dashboard')}>
                    Retour au Tableau de Bord
                  </Button>
                </div>
              )}
            </AnimatePresence>
          )}
        </main>
      </div>
    </div>
  );
};

export default OwnerAdminDashboard;