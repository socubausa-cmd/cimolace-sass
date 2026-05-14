import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  ShoppingCart, 
  Users, 
  Package, 
  Settings, 
  User, 
  LogOut, 
  Menu, 
  X, 
  Bell, 
  Search,
  DollarSign
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Link, useNavigate } from 'react-router-dom';

// Import sub-components
import StatCard from '@/components/admin-test/StatCard';
import SalesChart from '@/components/admin-test/SalesChart';
import RecentOrdersTable from '@/components/admin-test/RecentOrdersTable';
import CustomersTable from '@/components/admin-test/CustomersTable';
import ProductsManagement from '@/components/admin-test/ProductsManagement';
import StoreSettings from '@/components/admin-test/StoreSettings';
import UserProfile from '@/components/admin-test/UserProfile';

const TestAdminDashboard = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const navigate = useNavigate();

  const handleLogout = () => {
    navigate('/');
  };

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'products', label: 'Products', icon: Package },
    { id: 'orders', label: 'Orders', icon: ShoppingCart },
    { id: 'customers', label: 'Customers', icon: Users },
    { id: 'settings', label: 'Settings', icon: Settings },
    { id: 'profile', label: 'Profile', icon: User },
  ];

  return (
    <div className="min-h-screen bg-[#0F1419] flex">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-sm"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-[#192734] border-r border-white/10 flex flex-col transition-transform duration-300 ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="h-16 flex items-center px-6 border-b border-white/10">
          <span className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
            AdminTest
          </span>
          <button onClick={() => setIsSidebarOpen(false)} className="ml-auto lg:hidden text-gray-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => { setActiveTab(item.id); setIsSidebarOpen(false); }}
              className={`w-full flex items-center px-4 py-3 rounded-xl transition-all duration-200 group ${
                activeTab === item.id 
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' 
                  : 'text-gray-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              <item.icon className={`w-5 h-5 mr-3 ${activeTab === item.id ? 'text-white' : 'text-gray-500 group-hover:text-white'}`} />
              <span className="font-medium">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-white/10">
          <button 
            onClick={handleLogout}
            className="w-full flex items-center px-4 py-3 text-red-400 hover:bg-red-500/10 rounded-xl transition-colors"
          >
            <LogOut className="w-5 h-5 mr-3" />
            <span className="font-medium">Exit Demo</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-[#192734]/80 backdrop-blur-md border-b border-white/10 flex items-center justify-between px-4 lg:px-8 z-30 sticky top-0">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden text-gray-400">
              <Menu className="w-6 h-6" />
            </button>
            <h2 className="text-xl font-semibold text-white capitalize">{activeTab}</h2>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative hidden md:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input 
                type="text" 
                placeholder="Search..." 
                className="bg-[#0F1419] border border-white/10 rounded-full py-2 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-blue-500 w-64"
              />
            </div>
            
            <button className="relative text-gray-400 hover:text-white transition-colors">
              <Bell className="w-5 h-5" />
              <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full border-2 border-[#192734]"></span>
            </button>
            
            <div className="flex items-center gap-3 pl-4 border-l border-white/10">
              <div className="text-right hidden md:block">
                <p className="text-sm font-medium text-white">Admin User</p>
                <p className="text-sm text-gray-500">Super Admin</p>
              </div>
              <Avatar className="cursor-pointer border border-white/10">
                <AvatarImage src="https://github.com/shadcn.png" />
                <AvatarFallback>AD</AvatarFallback>
              </Avatar>
            </div>
          </div>
        </header>

        {/* Scrollable Content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-8 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
          <div className="max-w-7xl mx-auto space-y-8">
            
            {activeTab === 'dashboard' && (
              <>
                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <StatCard 
                    icon={DollarSign} 
                    label="Total Revenue" 
                    value="$45,231.89" 
                    trend="20.1%" 
                    trendUp={true} 
                    color="green" 
                  />
                  <StatCard 
                    icon={ShoppingCart} 
                    label="Total Orders" 
                    value="+2,350" 
                    trend="15.2%" 
                    trendUp={true} 
                    color="blue" 
                  />
                  <StatCard 
                    icon={Users} 
                    label="Active Customers" 
                    value="+12,234" 
                    trend="5.1%" 
                    trendUp={false} 
                    color="purple" 
                  />
                  <StatCard 
                    icon={Package} 
                    label="Products Sold" 
                    value="+573" 
                    trend="12.5%" 
                    trendUp={true} 
                    color="orange" 
                  />
                </div>

                {/* Charts Section */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <div className="lg:col-span-2">
                    <SalesChart />
                  </div>
                  <div className="lg:col-span-1">
                    <Card className="h-full bg-[#192734] border-none shadow-lg">
                      <div className="p-6">
                        <h3 className="text-white font-bold mb-4">Traffic Sources</h3>
                        <div className="space-y-4">
                          {[
                            { label: 'Direct', value: 45, color: 'bg-blue-500' },
                            { label: 'Social Media', value: 32, color: 'bg-purple-500' },
                            { label: 'Organic Search', value: 15, color: 'bg-green-500' },
                            { label: 'Referral', value: 8, color: 'bg-orange-500' }
                          ].map((item) => (
                            <div key={item.label}>
                              <div className="flex justify-between text-sm mb-1">
                                <span className="text-gray-400">{item.label}</span>
                                <span className="text-white">{item.value}%</span>
                              </div>
                              <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                                <div className={`h-full ${item.color}`} style={{ width: `${item.value}%` }}></div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </Card>
                  </div>
                </div>

                {/* Recent Orders */}
                <RecentOrdersTable />
              </>
            )}

            {activeTab === 'products' && <ProductsManagement />}
            {activeTab === 'orders' && <RecentOrdersTable />}
            {activeTab === 'customers' && <CustomersTable />}
            {activeTab === 'settings' && <StoreSettings />}
            {activeTab === 'profile' && <UserProfile />}

          </div>
        </main>
      </div>
    </div>
  );
};

export default TestAdminDashboard;