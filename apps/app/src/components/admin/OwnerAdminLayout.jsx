import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Button } from '@/components/ui/button';
import { 
  LayoutDashboard, ShoppingBag, Users, Package, Settings, 
  CreditCard, Truck, Mail, BarChart3, Activity, User, 
  LogOut, Menu, X, ChevronRight, Bell, Search
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const OwnerAdminLayout = ({ children, activeTab, onTabChange }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const { logout, profile } = useAuth();

  const menuItems = [
    { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { id: 'products', icon: Package, label: 'Products' },
    { id: 'orders', icon: ShoppingBag, label: 'Orders' },
    { id: 'customers', icon: Users, label: 'Customers' },
    { id: 'categories', icon: Package, label: 'Categories' }, // Reusing Package icon
    { id: 'users', icon: Users, label: 'Users' },
    { id: 'settings', icon: Settings, label: 'Store Settings' },
    { id: 'payment', icon: CreditCard, label: 'Payments' },
    { id: 'shipping', icon: Truck, label: 'Shipping' },
    { id: 'email', icon: Mail, label: 'Email & Notif.' },
    { id: 'reports', icon: BarChart3, label: 'Reports' },
    { id: 'logs', icon: Activity, label: 'Logs' },
    { id: 'profile', icon: User, label: 'Owner Profile' },
  ];

  return (
    <div className="min-h-screen premium-dashboard-shell flex">
      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {!isSidebarOpen && (
           <div 
             className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm"
             onClick={() => setIsSidebarOpen(false)}
           />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside 
        className={`fixed lg:sticky top-0 left-0 z-50 h-screen premium-sidebar flex flex-col transition-all duration-300 ${
          isSidebarOpen ? 'w-64 translate-x-0' : 'w-0 -translate-x-full lg:w-20 lg:translate-x-0'
        }`}
      >
        <div className="h-16 flex items-center justify-center border-b border-white/10">
          {isSidebarOpen ? (
            <span className="text-xl font-bold text-white tracking-tight">Admin<span className="text-[#7B61FF]">Panel</span></span>
          ) : (
            <span className="text-xl font-bold text-[#7B61FF]">A</span>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1 scrollbar-thin scrollbar-thumb-white/10">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`w-full flex items-center px-3 py-2.5 rounded-lg transition-all duration-200 group ${
                activeTab === item.id 
                  ? 'bg-[#7B61FF] text-white font-medium shadow-lg shadow-[#7B61FF]/20' 
                  : 'text-gray-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              <item.icon className={`w-5 h-5 flex-shrink-0 ${activeTab === item.id ? 'text-white' : 'text-gray-400 group-hover:text-white'}`} />
              {isSidebarOpen && (
                <span className="ml-3 truncate">{item.label}</span>
              )}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-white/10 bg-[#15202B]">
           <button 
             onClick={logout}
             className={`flex items-center w-full text-red-400 hover:text-red-300 hover:bg-red-900/20 p-2 rounded-lg transition-colors ${!isSidebarOpen && 'justify-center'}`}
           >
             <LogOut className="w-5 h-5" />
             {isSidebarOpen && <span className="ml-3 font-medium">Logout</span>}
           </button>
        </div>
      </motion.aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Header */}
        <header className="h-16 premium-topbar flex items-center justify-between px-4 lg:px-8 z-30 flex-shrink-0">
           <div className="flex items-center gap-4">
             <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="text-gray-400 hover:text-white transition-colors">
               <Menu className="w-6 h-6" />
             </button>
             <h2 className="text-lg font-semibold text-white hidden md:block capitalize">{activeTab.replace('-', ' ')}</h2>
           </div>

           <div className="flex items-center gap-4">
              <div className="relative hidden md:block">
                 <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                 <input type="text" placeholder="Search..." className="bg-[#0F1419] border border-white/10 rounded-full py-1.5 pl-9 pr-4 text-sm text-white focus:outline-none focus:border-[#7B61FF] w-64" />
              </div>
              <button className="relative text-gray-400 hover:text-white">
                 <Bell className="w-5 h-5" />
                 <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full"></span>
              </button>
              <div className="flex items-center gap-3 pl-4 border-l border-white/10">
                 <div className="hidden md:block text-right">
                    <p className="text-sm font-medium text-white">{profile?.full_name || 'Owner'}</p>
                    <p className="text-sm text-gray-500">Administrator</p>
                 </div>
                 <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#7B61FF] to-[#5b21b6] p-[2px]">
                    <img src={profile?.profile_picture_url || "https://github.com/shadcn.png"} alt="Profile" className="rounded-full w-full h-full object-cover border-2 border-[#192734]" />
                 </div>
              </div>
           </div>
        </header>

        {/* Content Scroll Area */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-8 scrollbar-thin scrollbar-thumb-gray-700">
           <div className="max-w-7xl mx-auto premium-panel p-5 md:p-6">
              {children}
           </div>
        </main>
      </div>
    </div>
  );
};

export default OwnerAdminLayout;