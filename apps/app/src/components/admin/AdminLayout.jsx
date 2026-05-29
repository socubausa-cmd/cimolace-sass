import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { 
  LayoutDashboard, 
  Users, 
  GraduationCap, 
  CreditCard, 
  LogOut, 
  Menu, 
  X,
  Bell,
  FileText,
  Settings
} from 'lucide-react';
import { Button } from '@/components/ui/button';

const AdminLayout = ({ children }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const menuItems = [
    { label: 'Tableau de Bord', path: '/admin', icon: LayoutDashboard },
    { label: 'Utilisateurs', path: '/admin/users', icon: Users },
    { label: 'Étudiants', path: '/admin/students', icon: GraduationCap },
    { label: 'Paiements', path: '/admin/payments', icon: CreditCard },
    { label: 'Audit Logs', path: '/admin/logs', icon: FileText },
    { label: 'Paramètres', path: '/admin/settings', icon: Settings },
  ];

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  return (
    <div className="min-h-screen premium-dashboard-shell flex">
      {/* Sidebar */}
      <aside 
        className={`fixed inset-y-0 left-0 z-50 w-64 premium-sidebar text-white transform transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:relative lg:translate-x-0`}
      >
        <div className="p-6 flex items-center justify-between border-b border-white/5">
          <div className="flex items-center gap-2">
             <div className="w-8 h-8 bg-[#7B61FF] rounded-xl flex items-center justify-center font-bold text-white font-serif">P</div>
             <span className="text-lg font-serif font-bold text-[#7B61FF]">PRORASCIENCE</span>
          </div>
          <button onClick={toggleSidebar} className="lg:hidden text-white hover:text-[#7B61FF]">
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <nav className="p-4 space-y-1">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setIsSidebarOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${isActive ? 'bg-[#7B61FF] text-white font-bold shadow-lg shadow-[#7B61FF]/20' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}
              >
                <item.icon className="w-5 h-5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-white/5">
           <button 
              onClick={handleSignOut}
              className="flex w-full items-center gap-3 px-4 py-3 rounded-lg text-red-400 hover:bg-red-900/20 hover:text-red-300 transition-colors"
            >
              <LogOut className="w-5 h-5" />
              <span>Déconnexion</span>
            </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-screen w-full lg:max-w-[calc(100vw-256px)]">
        {/* Header */}
        <header className="premium-topbar h-16 flex items-center justify-between px-6 sticky top-0 z-40">
          <div className="flex items-center gap-4">
            <button onClick={toggleSidebar} className="lg:hidden text-gray-300">
              <Menu className="w-6 h-6" />
            </button>
            <h1 className="text-xl font-bold text-white hidden sm:block">
              {menuItems.find(i => i.path === location.pathname)?.label || 'Administration'}
            </h1>
          </div>

          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" className="relative text-gray-300 hover:text-white hover:bg-white/5">
              <Bell className="w-5 h-5" />
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
            </Button>
            
            <div className="flex items-center gap-3 border-l border-white/10 pl-4">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold text-white">{profile?.full_name || user?.email}</p>
                <p className="text-xs text-[#7B61FF] capitalize">{profile?.role || 'Admin'}</p>
              </div>
              <div className="w-10 h-10 bg-gradient-to-br from-[#7B61FF] to-[#5b21b6] rounded-full flex items-center justify-center text-white font-bold shadow-lg border border-[#7B61FF]/50">
                {(profile?.full_name || user?.email || 'A').charAt(0).toUpperCase()}
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="premium-panel p-5 md:p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;