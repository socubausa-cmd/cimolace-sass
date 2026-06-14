import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import {
  LayoutDashboard,
  BookOpen,
  HeartHandshake as Handshake,
  Calendar,
  CalendarClock,
  Bell,
  HelpCircle,
  Users as UsersIcon,
  Award,
  PieChart,
  Inbox,
  LogOut,
  Menu,
  User,
  FileCheck,
  FileText,
  GraduationCap,
  Library,
  Video,
  Megaphone,
  CreditCard,
  Flame,
  Star,
  X,
  MessageCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import NotificationDropdown from '@/components/notifications/NotificationDropdown';

const menuItems = [
  { id: 'dashboard', icon: LayoutDashboard, label: 'Gestion élèves' },
  { id: '_sessions-live', icon: Video, label: 'Sessions Live', path: '/teacher-space/agenda' },
  { id: 'apercu', icon: PieChart, label: 'Aperçu général' },
  { id: 'paiements', icon: CreditCard, label: 'Paiements' },
  { id: 'notifications', icon: Bell, label: 'Notifications' },
  { id: 'reports', icon: FileCheck, label: 'Rapports' },
  { id: 'formations', icon: BookOpen, label: 'Formations' },
  { id: 'coaching-mentoring', icon: Handshake, label: 'Coaching & Mentorat' },
  { id: 'workshops', icon: UsersIcon, label: 'Ateliers' },
  { id: 'ngowazulu-mentorat', icon: Flame, label: 'Ngowazulu Ateliers' },
  { id: 'ngowazulu-operations', icon: Flame, label: 'Ngowazulu Opérations' },
  { id: 'reviews', icon: Star, label: 'Avis & Témoignages' },
  { id: 'certificates', icon: Award, label: 'Certificats' },
  { id: 'support', icon: HelpCircle, label: 'Support' },
  { id: 'school-life', icon: Calendar, label: 'Vie Scolaire' },
  { id: 'forum', icon: MessageCircle, label: 'Forum communauté' },
  { id: 'rendez-vous', icon: CalendarClock, label: 'Rendez-vous actifs' },
  { id: 'calendrier', icon: Calendar, label: 'Calendrier rendez-vous' },
  { id: 'marketing', icon: Megaphone, label: 'Marketing' },
  { id: 'messagerie', icon: Inbox, label: 'Messagerie' },
  { id: 'teachers', icon: GraduationCap, label: 'Équipe pédagogique' },
  { id: 'how-it-works', icon: FileCheck, label: 'Fonctionnement' },
  { id: 'courses', icon: Library, label: 'Catalogue des cours' },
  { id: 'document-admin', icon: FileText, label: 'Documents admin (A4)' },
  { id: 'cycles-disciple', icon: GraduationCap, label: 'Cycle Disciple' },
  { id: 'cycles-initie', icon: GraduationCap, label: 'Cycle Initié' },
  { id: 'cycles-maitre', icon: GraduationCap, label: 'Cycle Maître' },
];

function getInitialSidebarOpen() {
  if (typeof window === 'undefined') return true;
  return window.matchMedia('(min-width: 1024px)').matches;
}

const SecretariatDashboardLayout = ({ children, activeTab, onTabChange }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(getInitialSidebarOpen);
  const { user, logout, loading: isLoading } = useAuth();
  const navigate = useNavigate();

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

  if (isLoading) {
    return (
      <div className="h-screen premium-dashboard-shell p-6 sm:p-8 flex items-center justify-center text-white">
        Chargement…
      </div>
    );
  }

  return (
    <div className="min-h-screen min-h-[100dvh] premium-dashboard-shell flex">
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

      <aside
        className={cn(
          'fixed lg:sticky top-0 left-0 z-50 h-screen min-h-[100dvh] premium-sidebar flex flex-col overflow-hidden transition-[transform,width] duration-300 ease-out',
          isSidebarOpen
            ? 'translate-x-0 w-[min(280px,88vw)] lg:w-[280px]'
            : '-translate-x-full w-[min(280px,88vw)] lg:translate-x-0 lg:w-20',
        )}
      >
        <div className="h-20 flex items-center justify-between gap-2 px-4 sm:px-6 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--school-accent)] to-yellow-600 flex items-center justify-center shadow-lg shadow-yellow-500/20 text-white font-bold shrink-0">
              P
            </div>
            {isSidebarOpen && (
              <h1 className="text-white font-bold text-lg leading-tight truncate">
                Secrétariat
                <br />
                <span className="text-[var(--school-accent)]">Prorascience</span>
              </h1>
            )}
          </div>
          <button
            type="button"
            className="lg:hidden rounded-lg p-2 text-gray-400 hover:bg-white/10 hover:text-white shrink-0"
            aria-label="Fermer le menu"
            onClick={() => setIsSidebarOpen(false)}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-2 no-scrollbar overscroll-contain pb-[max(1rem,env(safe-area-inset-bottom))]">
          {menuItems.map((item) => (
            <motion.button
              key={item.id}
              type="button"
              onClick={() => {
                if (item.path) navigate(item.path);
                else onTabChange(item.id);
                closeMobileSidebarIfNeeded();
              }}
              whileHover={{ x: 2 }}
              whileTap={{ scale: 0.98 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className={cn(
                'w-full flex items-center px-4 py-3 rounded-xl transition-all duration-200',
                activeTab === item.id
                  ? 'bg-gradient-to-r from-[var(--school-accent)] to-[#f1cf63] text-black font-semibold shadow-lg shadow-[color-mix(in_srgb,var(--school-accent)_25%,transparent)]'
                  : 'text-gray-400 hover:bg-white/5 hover:text-white border border-transparent hover:border-white/10',
              )}
            >
              <item.icon className="w-6 h-6 flex-shrink-0" />
              {isSidebarOpen && <span className="ml-4 truncate text-left">{item.label}</span>}
            </motion.button>
          ))}
        </nav>

        <div className="p-4 border-t border-white/10 bg-[#121A25]/80 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className={cn('flex items-center', isSidebarOpen ? 'justify-between' : 'justify-center')}>
            {isSidebarOpen && (
              <div className="flex items-center gap-3 overflow-hidden min-w-0">
                <Avatar className="h-9 w-9 border border-[var(--school-accent)] shrink-0">
                  <AvatarImage src="" />
                  <AvatarFallback>
                    <User className="w-4 h-4 text-black" />
                  </AvatarFallback>
                </Avatar>
                <div className="truncate">
                  <p className="text-sm font-bold text-white truncate">{user?.name || 'Secrétariat'}</p>
                  <p className="text-sm text-gray-500 truncate">{user?.email}</p>
                </div>
              </div>
            )}
            <Button
              size="icon"
              variant="ghost"
              onClick={handleLogout}
              className="text-red-400 hover:bg-red-900/10 hover:text-red-300 shrink-0"
            >
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 h-screen min-h-[100dvh] max-h-[100dvh] overflow-hidden">
        <header className="h-14 sm:h-16 premium-topbar flex items-center justify-between gap-2 px-4 sm:px-8 z-30 sticky top-0 pt-[max(0px,env(safe-area-inset-top))] shrink-0">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            <button
              type="button"
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="text-gray-400 hover:text-white transition-colors duration-200 shrink-0 p-1 -ml-1"
              aria-label={isSidebarOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
            >
              <Menu className="w-6 h-6" />
            </button>
            <h2 className="text-base sm:text-xl font-bold text-white truncate">
              {menuItems.find((i) => i.id === activeTab)?.label}
            </h2>
          </div>
          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            <NotificationDropdown />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 md:p-8 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="max-w-7xl mx-auto premium-panel p-4 sm:p-5 md:p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default SecretariatDashboardLayout;
