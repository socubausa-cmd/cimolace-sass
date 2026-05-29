import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  BookOpen,
  Users,
  Workflow,
  GraduationCap,
  School,
  Inbox,
  User,
  LogOut,
  Menu,
  X,
} from 'lucide-react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';

const SecretariatSidebar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const menuItems = [
    { icon: LayoutDashboard, label: 'Tableau de bord', path: '/secretariat-space/dashboard' },
    { icon: BookOpen, label: 'Catalogue des cours', path: '/secretariat-space/courses' },
    { icon: Users, label: 'Équipe pédagogique', path: '/secretariat-space/teachers' },
    { icon: School, label: 'Vie Scolaire', path: '/secretariat-space/vie-scolaire' },
    { icon: Inbox, label: 'Messagerie', path: '/secretariat-space/messagerie' },
    { icon: Workflow, label: 'Fonctionnement', path: '/secretariat-space/how-it-works' },
    { icon: GraduationCap, label: 'Cycle Disciple', path: '/secretariat-space/cycles/disciple' },
    { icon: GraduationCap, label: 'Cycle Initié', path: '/secretariat-space/cycles/initie' },
    { icon: GraduationCap, label: 'Cycle Maître', path: '/secretariat-space/cycles/maitre' },
    { icon: User, label: 'Profil', path: '/profil/mon-profil' },
  ];

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-[#0F1419] border-r border-white/10">
      <div className="p-6 border-b border-white/10">
        <div className="flex items-center gap-4 mb-2">
          <div className="w-12 h-12 rounded-full bg-[#D4AF37] flex items-center justify-center text-black font-bold text-xl shadow-lg shadow-[#D4AF37]/20">
            {user?.name?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || 'S'}
          </div>
          <div>
            <h3 className="font-serif font-bold text-white truncate max-w-[150px]">
              {user?.name || user?.email?.split('@')[0] || 'Secrétariat'}
            </h3>
            <span className="text-xs text-[#D4AF37] uppercase tracking-wider">Espace Secrétariat</span>
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
                isActive
                  ? 'bg-gradient-to-r from-[#D4AF37]/20 to-transparent text-[#D4AF37] border-l-2 border-[#D4AF37]'
                  : 'text-gray-400 hover:text-white hover:bg-white/5',
              )
            }
          >
            <item.icon className="w-5 h-5 transition-colors group-hover:text-white" />
            <span className="font-medium">{item.label}</span>
          </NavLink>
        ))}
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

export default SecretariatSidebar;
