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
  CalendarRange,
  FileText,
  AlertTriangle,
  Download,
  Library,
  Archive,
  ClipboardCheck,
  Video,
  Sparkles,
  MessageCircle,
  Settings,
  Users,
} from 'lucide-react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { isnaTenantConfig } from '@/tenants/isna/tenant.config';

const TeacherSchoolLifeSidebar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const slug = isnaTenantConfig.slug;

  const adminItems = [
    { icon: GraduationCap, label: 'Gérer les Cours', path: `/t/${slug}/admin/courses` },
    { icon: Users, label: 'Gérer les Étudiants', path: `/t/${slug}/admin/students` },
    { icon: Settings, label: 'Paramètres École', path: `/t/${slug}/admin/settings` },
  ];

  const menuItems = [
    { icon: LayoutDashboard, label: 'Tableau de bord', path: '/teacher-space/dashboard' },
    { icon: BookOpen, label: 'Mes Formations', path: '/teacher-space/formations' },
    { icon: Book, label: 'Gestion de Classe', path: '/teacher-space/classroom' },
    { icon: School, label: 'Gestion des Classes', path: '/teacher-space/classes' },
    { icon: ClipboardCheck, label: 'Corrections', path: '/teacher-space/corrections' },
    { icon: Video, label: 'Sessions Live', path: '/teacher-space/live' },
    { icon: School, label: 'Vie Scolaire', path: '/teacher-space/vie-scolaire' },
    { icon: MessageCircle, label: 'Forum communauté', path: '/teacher-space/forum' },
    { icon: Library, label: 'Bibliothèque', path: '/teacher-space/bibliotheque' },
    { icon: Archive, label: 'Ressources', path: '/teacher-space/bibliotheque-ressources' },
    { icon: Calendar, label: 'Agenda', path: '/teacher-space/agenda' },
    { icon: CalendarRange, label: 'Programme Annuel', path: '/teacher-space/programme-annuel' },
    { icon: Sparkles, label: 'Studio Créateur', path: '/studio' },
    { icon: GraduationCap, label: 'Évaluations', path: '/teacher-space/evaluations' },
    { icon: FileText, label: 'Notes & Résultats', path: '/teacher-space/notes' },
    { icon: AlertTriangle, label: 'Absences', path: '/teacher-space/absences' },
    { icon: Download, label: 'Documents', path: '/teacher-space/documents' },
    { icon: User, label: 'Mon Profil', path: '/teacher-space/profile' },
  ];

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-[#0F1419] border-r border-white/10">
      <div className="p-6 border-b border-white/10">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-12 h-12 rounded-full bg-[#D4AF37] flex items-center justify-center text-black font-bold text-xl shadow-lg shadow-[#D4AF37]/20">
            {user?.name?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || 'P'}
          </div>
          <div>
            <h3 className="font-serif font-bold text-white truncate max-w-[150px]">
              {user?.name || user?.email?.split('@')[0] || 'Professeur'}
            </h3>
            <span className="text-xs text-[#D4AF37] uppercase tracking-wider">
              Espace Professeur
            </span>
            <div className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-300">
              Matrice Teacher PRO
            </div>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        {menuItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            onClick={() => setIsOpen(false)}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 group',
                isActive ||
                  (item.path === '/teacher-space/forum' && location.pathname.startsWith('/teacher-space/forum'))
                  ? 'bg-gradient-to-r from-[#D4AF37]/20 to-transparent text-[#D4AF37] border-l-2 border-[#D4AF37]'
                  : 'text-gray-400 hover:text-white hover:bg-white/5',
              )
            }
          >
            <item.icon
              className={cn(
                'w-5 h-5 transition-colors',
                location.pathname.startsWith(item.path) ||
                  (item.path === '/teacher-space/forum' && location.pathname.startsWith('/teacher-space/forum'))
                  ? 'text-[#D4AF37]'
                  : 'group-hover:text-white',
              )}
            />
            <span className="font-medium">{item.label}</span>
          </NavLink>
        ))}

        {/* Admin school section */}
        <div className="pt-3 mt-3 border-t border-white/10">
          <p className="mb-2 px-4 text-[10px] font-semibold uppercase tracking-wider text-emerald-400">
            Administration école
          </p>
          {adminItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={() => setIsOpen(false)}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-300 group',
                  isActive
                    ? 'bg-gradient-to-r from-emerald-500/20 to-transparent text-emerald-400 border-l-2 border-emerald-400'
                    : 'text-gray-400 hover:text-white hover:bg-white/5',
                )
              }
            >
              <item.icon className="w-4 h-4 transition-colors group-hover:text-white" />
              <span className="text-sm font-medium">{item.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>

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
      <div className="hidden lg:block w-72 fixed inset-y-0 left-0 z-30 pt-20">
        <SidebarContent />
      </div>

      <div className="lg:hidden fixed bottom-6 right-6 z-50">
        <Button
          onClick={() => setIsOpen(!isOpen)}
          className="w-12 h-12 rounded-full bg-[#D4AF37] text-black shadow-xl hover:bg-[#b5952f]"
        >
          {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </Button>
      </div>

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
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="fixed inset-y-0 left-0 z-50 w-80 bg-[#0F1419] lg:hidden"
            >
              <SidebarContent />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export default TeacherSchoolLifeSidebar;
