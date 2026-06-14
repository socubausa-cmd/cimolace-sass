import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { X, ChevronDown, LogOut, User, LayoutDashboard, LogIn, MessageSquare, MessageCircle, Info, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { getLiriMemberLoginPath } from '@/lib/liriVitrineModel';

const MobileMenuSection = ({ label, icon: Icon, submenu, onClose }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border-b border-white/5 last:border-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex w-full items-center justify-between px-1 py-3.5 font-display text-[15px] font-medium tracking-tight text-gray-100 transition-colors active:bg-white/5 ${isOpen ? 'bg-white/[0.03]' : ''}`}
      >
        <div className="flex items-center gap-3">
          {Icon && <Icon className={`w-5 h-5 ${isOpen ? 'text-[var(--school-accent)]' : 'text-gray-500'}`} />}
          <span className={`text-[13px] font-semibold uppercase tracking-[0.12em] ${isOpen ? 'text-[var(--school-accent)]' : 'text-white/90'}`}>{label}</span>
        </div>
        <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform duration-300 ${isOpen ? 'rotate-180 text-[var(--school-accent)]' : ''}`} />
      </button>
      
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden bg-[#0a0e12]"
          >
            <div className="py-2 pl-4 pr-2 space-y-1">
              {submenu.map((item, idx) => (
                <Link
                  key={`${item.path}-${idx}`}
                  to={item.path}
                  onClick={onClose}
                  className="flex items-center gap-3 py-3 px-3 text-sm text-gray-400 hover:text-white hover:bg-white/5 rounded-md transition-all border-l-2 border-transparent hover:border-[var(--school-accent)]"
                >
                  {item.icon && <item.icon className="w-4 h-4 opacity-70" />}
                  <span>{item.label}</span>
                </Link>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const MobileMenu = ({
  isOpen,
  onClose,
  menuSections = [],
  quickLinks = [],
  dashboardPath = '/dashboard',
  showDashboardButton = false,
  canUseImmersiveChat = false,
  onOpenQuickChat,
  onOpenImmersiveNav,
}) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await logout();
    onClose();
    navigate(getLiriMemberLoginPath());
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-gradient-to-b from-[#0c0a08] via-[#0a0908] to-black lg:hidden"
            style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
          >
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4">
              {/* Header */}
              <div className="mb-5 flex items-center justify-between border-b border-white/10 pb-5">
                <div className="flex flex-col gap-0.5">
                  <span className="font-display text-2xl font-semibold tracking-tight text-white">
                    Prorascience
                  </span>
                  <span className="text-[0.65rem] font-medium uppercase tracking-[0.28em] text-[color-mix(in_srgb,var(--school-accent)_90%,transparent)]">
                    Portail en ligne
                  </span>
                  <span className="text-[10px] font-medium text-white/45">Espace membre : application LIRI</span>
                </div>
                <button 
                  onClick={onClose}
                  className="p-2 text-gray-400 hover:text-white bg-white/5 rounded-full hover:bg-white/10 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Navigation Items */}
              <div className="flex-1 space-y-0">
                {/* Dashboard Button in Mobile Menu */}
                {showDashboardButton ? (
                  <div className="mb-4">
                    <Link to={dashboardPath} onClick={onClose}>
                      <Button className="w-full bg-gradient-to-r from-[var(--school-accent)] to-amber-600 text-black font-bold border-none gap-2 h-12">
                         <LayoutDashboard className="w-4 h-4" />
                         Tableau de bord
                      </Button>
                    </Link>
                  </div>
                ) : null}

                <div className="mb-4">
                  <Link to="/appointment/request" onClick={onClose}>
                    <Button className="w-full gap-2 h-12 font-bold border-2 border-[color-mix(in_srgb,var(--school-accent)_60%,transparent)] bg-[color-mix(in_srgb,var(--school-accent)_15%,transparent)] text-[#f5e6b8] hover:bg-[color-mix(in_srgb,var(--school-accent)_25%,transparent)] hover:text-white shadow-[0_0_20px_rgba(212,175,55,0.15)]">
                      <Calendar className="w-5 h-5 text-[var(--school-accent)]" />
                      Prendre rendez-vous (calendrier)
                    </Button>
                  </Link>
                </div>

                {/* Quick Links */}
                <div className="mb-4 space-y-2">
                  {quickLinks.map((link) => (
                    <Link
                      key={link.id}
                      to={link.to}
                      onClick={onClose}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-white transition-colors ${
                        link.id === 'ngowazulu'
                          ? 'bg-[color-mix(in_srgb,var(--school-accent)_10%,transparent)] border-[color-mix(in_srgb,var(--school-accent)_40%,transparent)] hover:bg-[color-mix(in_srgb,var(--school-accent)_20%,transparent)]'
                          : 'bg-white/5 border-white/10 hover:bg-white/10'
                      }`}
                    >
                      <link.icon className={`w-5 h-5 ${link.id === 'ngowazulu' ? 'text-[#f5d97a]' : 'text-[var(--school-accent)]'}`} />
                      <span className="font-semibold text-sm">{link.label}</span>
                    </Link>
                  ))}
                </div>

                {menuSections.map((category) => (
                  <MobileMenuSection
                    key={category.id}
                    {...category} 
                    onClose={onClose} 
                  />
                ))}
              </div>

              {/* Action Buttons */}
              <div className="mt-8 pt-6 border-t border-white/10 space-y-4">
                <Button
                  variant="outline"
                  className="w-full justify-center gap-2 border-[color-mix(in_srgb,var(--school-accent)_35%,transparent)] text-[var(--school-accent)] hover:bg-[color-mix(in_srgb,var(--school-accent)_10%,transparent)] h-12"
                  onClick={() => {
                    onClose();
                    if (typeof onOpenImmersiveNav === 'function') onOpenImmersiveNav();
                  }}
                >
                  <Info className="w-4 h-4" />
                  Ouvrir le parcours IA
                </Button>
                {canUseImmersiveChat ? (
                  <Link to="/messages" onClick={onClose}>
                    <Button
                      variant="outline"
                      className="w-full justify-center gap-2 border-white/10 text-gray-300 hover:text-white hover:bg-white/5 h-12"
                    >
                      <MessageSquare className="w-4 h-4" />
                      Ouvrir le chat immersif
                    </Button>
                  </Link>
                ) : (
                  <Button
                    variant="outline"
                    className="w-full justify-center gap-2 border-white/10 text-gray-300 hover:text-white hover:bg-white/5 h-12"
                    onClick={() => {
                      onClose();
                      if (typeof onOpenQuickChat === 'function') onOpenQuickChat();
                    }}
                  >
                    <MessageCircle className="w-4 h-4" />
                    Aide rapide (chatbot)
                  </Button>
                )}

                {user ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <Link to="/profil/mon-profil" onClick={onClose}>
                        <Button variant="ghost" className="w-full justify-center gap-2 text-gray-400 hover:text-white bg-white/5">
                          <User className="w-4 h-4" />
                          Profil
                        </Button>
                      </Link>
                      <Button 
                        variant="ghost" 
                        onClick={handleSignOut}
                        className="w-full justify-center gap-2 text-red-400 hover:text-red-300 bg-red-900/10 hover:bg-red-900/20"
                      >
                        <LogOut className="w-4 h-4" />
                        Déconnexion
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <Link to={getLiriMemberLoginPath()} onClick={onClose}>
                      <Button
                        variant="ghost"
                        className="w-full border border-white/10 text-white hover:bg-white/5 h-12"
                        title="Connexion à LIRI (espace membre)"
                      >
                        <LogIn className="w-4 h-4 mr-2" /> Connexion LIRI
                      </Button>
                    </Link>
                    <Link to="/signup" onClick={onClose}>
                      <Button className="w-full bg-[var(--school-accent)] text-black hover:bg-yellow-500 font-bold h-12">
                        S'inscrire
                      </Button>
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default MobileMenu;