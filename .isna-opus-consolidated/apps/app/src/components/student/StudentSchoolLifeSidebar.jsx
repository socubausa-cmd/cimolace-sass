import React, { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  BookOpen, 
  GraduationCap, 
  School, 
  User, 
  LogOut, 
  Menu, 
  X,
  Book,
  Calendar,
  FileText,
  AlertTriangle,
  Download,
  Library,
  Archive,
  CreditCard,
  Video,
  MessageCircle,
  Flame
} from 'lucide-react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useBilling } from '@/contexts/BillingContext';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';

const StudentSchoolLifeSidebar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { status: billingStatus, inGrace, graceDays, subscription } = useBilling();
  const isPremiumActive = billingStatus === 'active' || (billingStatus === 'past_due' && inGrace);
  const billingUrgent = billingStatus === 'past_due' || billingStatus === 'expired';
  const graceCountdown = (() => {
    if (!(billingStatus === 'past_due' && inGrace)) return null;
    if (!subscription?.expires_at) return `Période de grâce (${graceDays}j)`;
    const expiresAt = new Date(subscription.expires_at);
    if (Number.isNaN(expiresAt.getTime())) return `Période de grâce (${graceDays}j)`;
    const graceEnd = new Date(expiresAt.getTime() + Number(graceDays || 0) * 24 * 60 * 60 * 1000);
    const remainingDays = Math.max(0, Math.ceil((graceEnd.getTime() - Date.now()) / (24 * 60 * 60 * 1000)));
    if (remainingDays <= 0) return 'Coupure imminente';
    return `J-${remainingDays} avant coupure`;
  })();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const menuItems = [
    { icon: LayoutDashboard, label: 'Tableau de bord', path: '/student-school-life/dashboard', alert: billingUrgent },
    { icon: BookOpen, label: 'Mes Formations', path: '/student-school-life/formations' },
    { icon: Book, label: 'Ma Classe', path: '/classroom' },
    { icon: School, label: 'Vie Scolaire', path: '/student-school-life/vie-scolaire' },
    { icon: Library, label: 'Bibliothèque', path: '/student-school-life/bibliotheque' },
    { icon: Archive, label: 'Ressources', path: '/student-school-life/bibliotheque-ressources' },
    { icon: Calendar, label: 'Agenda', path: '/student-school-life/agenda' },
    { icon: Video, label: 'Demander rendez-vous', path: '/appointment/request' },
    { icon: GraduationCap, label: 'Évaluations', path: '/student-school-life/evaluations' },
    { icon: FileText, label: 'Notes & Résultats', path: '/student-school-life/notes' },
    { icon: AlertTriangle, label: 'Absences', path: '/student-school-life/absences' },
    { icon: Download, label: 'Documents', path: '/student-school-life/documents' },
    { icon: MessageCircle, label: 'Forum communauté', path: '/student-school-life/forum' },
    { icon: CreditCard, label: 'Forfaits', path: '/forfaits', alert: billingUrgent },
    { icon: FileText, label: 'Mes factures', path: '/mes-factures' },
    { icon: User, label: 'Mon Profil', path: '/student-school-life/profile' },
  ];

  const SidebarContent = () => (
    <div className="flex flex-col h-full premium-sidebar">
      {/* Profile Header */}
      <div className="p-6 border-b border-white/10">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-12 h-12 rounded-full bg-[#D4AF37] flex items-center justify-center text-black font-bold text-xl shadow-lg shadow-[#D4AF37]/20">
            {user?.name?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || 'E'}
          </div>
          <div>
            <h3 className="font-serif font-bold text-white truncate max-w-[150px]">
              {user?.name || user?.email?.split('@')[0] || 'Étudiant'}
            </h3>
            <span className="text-xs text-[#D4AF37] uppercase tracking-wider">
              {isPremiumActive ? 'Espace Étudiant Premium' : 'Espace Découverte'}
            </span>
            <div className="mt-1">
              <span
                className={`inline-flex rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider border ${
                  isPremiumActive
                    ? 'bg-green-500/10 text-green-300 border-green-500/20'
                    : 'bg-gray-500/10 text-gray-300 border-white/10'
                }`}
              >
                {isPremiumActive ? 'Premium actif' : 'Profil visiteur'}
              </span>
            </div>
            {billingUrgent ? (
              <div className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-red-400">
                Action abonnement requise
              </div>
            ) : null}
            {graceCountdown ? (
              <div className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-amber-300">
                {graceCountdown}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        {menuItems.map((item) => (
          (() => {
            const itemPath = String(item.path || '').split('?')[0];
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setIsOpen(false)}
                className={({ isActive }) => cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 group",
                  (isActive || (itemPath === '/student-school-life/forum' && location.pathname.startsWith('/student-school-life/forum')))
                    ? "bg-gradient-to-r from-[#D4AF37]/20 to-transparent text-[#D4AF37] border-l-2 border-[#D4AF37]"
                    : "text-gray-400 hover:text-white hover:bg-white/5"
                )}
              >
                <item.icon className={cn(
                  'w-5 h-5 transition-colors',
                  (() => {
                    const active = location.pathname === itemPath
                      || (itemPath === '/student-school-life/forum' && location.pathname.startsWith('/student-school-life/forum'));
                    return active ? 'text-[#D4AF37]' : 'group-hover:text-white';
                  })(),
                )} />
                <span className="font-medium">{item.label}</span>
                {item.alert ? <span className="ml-auto h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse" /> : null}
              </NavLink>
            );
          })()
        ))}
      </nav>

      {/* Logout */}
      <div className="p-4 border-t border-white/10">
        <Button 
          variant="ghost" 
          onClick={handleLogout}
          className="w-full flex items-center justify-start gap-3 text-red-400 hover:text-red-300 hover:bg-red-500/10"
        >
          <LogOut className="w-5 h-5" />
          <span>Déconnexion</span>
        </Button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <div className="hidden lg:block w-72 fixed inset-y-0 left-0 z-30 pt-20">
        <SidebarContent />
      </div>

      {/* Mobile Toggle */}
      <div className="lg:hidden fixed bottom-6 right-6 z-50">
        <Button
          onClick={() => setIsOpen(!isOpen)}
          className="w-12 h-12 rounded-full bg-[#D4AF37] text-black shadow-xl hover:bg-[#b5952f]"
        >
          {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </Button>
      </div>

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-black/80 z-40 lg:hidden backdrop-blur-sm"
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="fixed inset-y-0 left-0 z-50 w-80 premium-sidebar lg:hidden"
            >
              <SidebarContent />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export default StudentSchoolLifeSidebar;