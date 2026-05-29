import React, { useEffect, useRef, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { LayoutDashboard, BookOpen, HeartHandshake as Handshake, Calendar, Library, CreditCard, Building2, Users, Settings, LogOut, Menu, User, Bell, HelpCircle, Users as UsersIcon, Award, PieChart, Database, Users2, Sparkles, Link2, Megaphone, Flame, Star, X, ExternalLink, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import NotificationDropdown from '@/components/notifications/NotificationDropdown';
import { useResolvedTenantSlug } from '@/hooks/useResolvedTenantSlug';

function getInitialSidebarOpen() {
  if (typeof window === 'undefined') return true;
  return window.matchMedia('(min-width: 1024px)').matches;
}

const OwnerDashboardLayout = ({ children, activeTab, onTabChange }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(getInitialSidebarOpen);
  const [isContentSwitching, setIsContentSwitching] = useState(false);
  const previousTabRef = useRef(activeTab);
  const { user, logout, loading: isLoading } = useAuth();
  const navigate = useNavigate();
  const { slug: payoutTenantSlug } = useResolvedTenantSlug();

  const menuItems = useMemo(
    () => [
      { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
      { id: 'notifications', icon: Bell, label: 'Notifications' },
      { id: 'reports', icon: PieChart, label: 'Rapports' }, // NEW
      { id: 'formations', icon: BookOpen, label: 'Formations' },
      { id: 'coaching-mentoring', icon: Handshake, label: 'Coaching & Mentorat' },
      { id: 'workshops', icon: UsersIcon, label: 'Ateliers' },
      { id: 'ngowazulu-mentorat', icon: Flame, label: 'Ngowazulu Ateliers' },
      { id: 'ngowazulu-operations', icon: Flame, label: 'Ngowazulu Opérations' },
      { id: 'reviews', icon: Star, label: 'Avis & Témoignages' },
      { id: 'certificates', icon: Award, label: 'Certificats' }, // NEW
      { id: 'support', icon: HelpCircle, label: 'Support' },
      { id: 'school-life', icon: Calendar, label: 'Vie Scolaire' },
      { id: 'forum', icon: MessageCircle, label: 'Forum communauté' },
      { id: 'resources', icon: Library, label: 'Ressources' },
      { id: 'payments', icon: CreditCard, label: 'Paiements' },
      { id: 'school-info', icon: Building2, label: 'École' },
      { id: 'team', icon: Users2, label: 'Équipe' },
      { id: 'users', icon: Users, label: 'Utilisateurs' },
      { id: 'settings', icon: Settings, label: 'Paramètres' },
      {
        id: 'tenant-encaissement',
        icon: ExternalLink,
        label: 'Encaissement (URL tenant)',
        href: `/t/${payoutTenantSlug}/admin/settings`,
      },
      { id: 'studio-creator', icon: Sparkles, label: 'Studio Créateur', href: '/studio' },
      { id: 'chariow-externes', icon: Link2, label: 'Chariow Externes', href: '/admin/billing?tab=external' },
      { id: 'marketing-automation', icon: Megaphone, label: 'Marketing Automation', href: '/admin/marketing?tab=automation' },
      { id: 'knowledge-base', icon: Database, label: 'Base de connaissances', href: '/owner-dashboard/knowledge-base' },
    ],
    [payoutTenantSlug],
  );

  useEffect(() => {
    if (previousTabRef.current === activeTab) return;
    previousTabRef.current = activeTab;
    setIsContentSwitching(true);
    const timer = window.setTimeout(() => setIsContentSwitching(false), 170);
    return () => window.clearTimeout(timer);
  }, [activeTab]);

  useEffect(() => {
    const hardStopTimer = window.setTimeout(() => {
      setIsContentSwitching(false);
    }, 1200);
    return () => window.clearTimeout(hardStopTimer);
  }, [activeTab]);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const onChange = () => {
      if (!mq.matches) setIsSidebarOpen(false);
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const closeMobileSidebarIfNeeded = () => {
    if (typeof window !== 'undefined' && window.matchMedia('(max-width: 1023px)').matches) {
      setIsSidebarOpen(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const sidebarDisplayName =
    (user?.name && String(user.name).trim()) || user?.email?.split('@')[0] || 'Compte';

  if (isLoading) {
    return (
      <div className="h-screen premium-dashboard-shell p-8 flex items-center justify-center">
        <div className="premium-panel w-full max-w-3xl p-8 space-y-4">
          <div className="h-6 w-52 rounded bg-white/10 animate-pulse" />
          <div className="h-4 w-72 rounded bg-white/10 animate-pulse" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <div className="h-24 rounded-xl bg-white/10 animate-pulse" />
            <div className="h-24 rounded-xl bg-white/10 animate-pulse" />
            <div className="h-24 rounded-xl bg-white/10 animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen premium-dashboard-shell flex">
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.button
            type="button"
            aria-label="Fermer le menu"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar: mobile = drawer (closed by default); desktop = wide / collapsed rail */}
      <aside
        className={cn(
          'fixed lg:sticky top-0 left-0 z-50 h-screen premium-sidebar flex flex-col overflow-hidden transition-[transform,width] duration-300 ease-out',
          isSidebarOpen
            ? 'translate-x-0 w-[min(280px,85vw)] lg:w-[280px]'
            : '-translate-x-full w-[min(280px,85vw)] lg:translate-x-0 lg:w-20'
        )}
      >
        <div className="flex h-14 shrink-0 items-center justify-end border-b border-white/10 px-4 sm:px-6 lg:hidden">
          <button
            type="button"
            className="rounded-lg p-2 text-gray-400 hover:bg-white/10 hover:text-white shrink-0"
            aria-label="Fermer le menu"
            onClick={() => setIsSidebarOpen(false)}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-2 no-scrollbar">
          {menuItems.map((item) => (
            <motion.button
              key={item.id}
              onClick={() => {
                if (item.href) navigate(item.href);
                else onTabChange(item.id);
                closeMobileSidebarIfNeeded();
              }}
              whileHover={{ x: 2 }}
              whileTap={{ scale: 0.98 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className={`w-full flex items-center px-4 py-3 rounded-xl transition-all duration-200 ${
                activeTab === item.id 
                  ? 'bg-[#7B61FF] text-white font-semibold shadow-lg shadow-[#7B61FF]/30' 
                  : 'text-gray-400 hover:bg-white/5 hover:text-white border border-transparent hover:border-white/10'
              }`}
            >
              <item.icon className="w-6 h-6 flex-shrink-0" />
              {isSidebarOpen && <span className="ml-4 truncate">{item.label}</span>}
            </motion.button>
          ))}
        </nav>

        <div className="p-4 border-t border-white/10 bg-[#121A25]/80">
           <div className={`flex items-center ${isSidebarOpen ? 'justify-between' : 'justify-center'}`}>
             {isSidebarOpen && (
               <div className="flex items-center gap-3 overflow-hidden">
                 <Avatar className="h-9 w-9 border border-[#7B61FF]">
                   <AvatarImage src="" />
                   <AvatarFallback><User className="w-4 h-4 text-[#c4b5fd]"/></AvatarFallback>
                 </Avatar>
                 <div className="truncate">
                  <p className="text-sm font-bold text-white truncate">{sidebarDisplayName}</p>
                  <p className="text-sm text-gray-500 truncate">{user?.email}</p>
                 </div>
               </div>
             )}
             <Button
               size="icon"
               variant="ghost"
               onClick={handleLogout}
               className="text-red-400 hover:bg-red-900/10 hover:text-red-300 transition-all duration-200"
             >
               <LogOut className="w-5 h-5" />
             </Button>
           </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <header className="h-16 premium-topbar flex items-center justify-between px-4 sm:px-8 z-30 sticky top-0">
           <div className="flex items-center gap-4">
             <button
               onClick={() => setIsSidebarOpen(!isSidebarOpen)}
               className="text-gray-400 hover:text-white transition-colors duration-200"
             >
               <Menu className="w-6 h-6"/>
             </button>
             <h2 className="text-xl font-bold text-white capitalize">{menuItems.find(i => i.id === activeTab)?.label}</h2>
           </div>
           
           <div className="flex items-center gap-4">
              <NotificationDropdown />
           </div>
        </header>

        <main className="flex-1 overflow-y-auto p-8">
           <div className="max-w-7xl mx-auto premium-panel p-5 md:p-6 min-h-[420px]">
              <AnimatePresence mode="wait">
                {isContentSwitching ? (
                  <motion.div
                    key={`switching-${activeTab}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="space-y-4"
                  >
                    <div className="h-8 w-64 rounded bg-white/10 animate-pulse" />
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="h-24 rounded-xl bg-white/10 animate-pulse" />
                      <div className="h-24 rounded-xl bg-white/10 animate-pulse" />
                      <div className="h-24 rounded-xl bg-white/10 animate-pulse" />
                    </div>
                    <div className="h-64 rounded-xl bg-white/10 animate-pulse" />
                  </motion.div>
                ) : (
                  <motion.div
                    key={`tab-content-${activeTab}`}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2 }}
                  >
                    {children}
                  </motion.div>
                )}
              </AnimatePresence>
           </div>
        </main>
      </div>
    </div>
  );
};

export default OwnerDashboardLayout;