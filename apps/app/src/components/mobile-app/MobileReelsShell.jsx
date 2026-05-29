import React, { useMemo, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  Home,
  Clapperboard,
  MessageCircle,
  Menu,
  ExternalLink,
  BookOpen,
  ShoppingBag,
  HelpCircle,
  LogOut,
  Calendar,
  Wallet,
  Settings,
} from 'lucide-react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useMessaging } from '@/contexts/MessagingContext';
import { getEffectiveRole, hasMultiRoleAccess, setSelectedAccountRole } from '@/lib/accountRoleMode';
import { resolveDashboardPath } from '@/lib/dashboardRoute';
import { LIRI_MOBILE } from '@/lib/liriMobileRoutes';
import { cn } from '@/lib/utils';
import { LiriWordmark } from '@/components/brand/LiriWordmark';
import NotificationDropdown from '@/components/notifications/NotificationDropdown';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import {
  getMobileReelsShellTitle,
  isMobileReelsTabRoot,
} from '@/lib/mobileReelsShellConfig';
import { getLiriMemberLoginPath } from '@/lib/liriVitrineModel';

function TabItem({ to, end, icon: Icon, label }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          'flex flex-1 flex-col items-center justify-center gap-0.5 py-1 min-w-0 transition-colors duration-200',
          isActive ? 'text-[#f5e6c8]' : 'text-white/38 hover:text-white/60',
        )
      }
    >
      {({ isActive }) => (
        <>
          <span
            className={cn(
              'rounded-xl p-1 transition-all duration-200',
              isActive &&
                'scale-105 border border-[#D4AF37]/45 bg-gradient-to-b from-[#D4AF37]/22 to-[#8a7018]/15 text-[#fff4dc] shadow-[0_0_20px_-6px_rgba(212,175,55,0.45)]',
              !isActive && 'text-white/55',
            )}
          >
            <Icon className="h-6 w-6" strokeWidth={isActive ? 2.2 : 1.75} />
          </span>
          <span className="text-[10px] font-semibold truncate max-w-full">{label}</span>
        </>
      )}
    </NavLink>
  );
}

export default function MobileReelsShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { conversations = [] } = useMessaging();
  const [menuOpen, setMenuOpen] = useState(false);

  const effectiveRole = getEffectiveRole(user);
  const isMultiRoleUser = hasMultiRoleAccess(user);
  const dashboardPath = resolveDashboardPath(user);
  const homeHref = LIRI_MOBILE.home;
  const title = getMobileReelsShellTitle(location.pathname);
  const tabRoot = isMobileReelsTabRoot(location.pathname, homeHref);
  const messagesHref = user ? '/messages' : getLiriMemberLoginPath();
  const unreadMessages = useMemo(
    () => conversations.reduce((acc, c) => acc + (c.unreadCount || 0), 0),
    [conversations],
  );

  const handleBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate(homeHref);
  };

  const handleLogout = () => {
    setMenuOpen(false);
    logout();
    navigate('/');
  };

  const handleRoleSwitch = (event) => {
    const nextRole = String(event.target.value || '').toLowerCase();
    if (!nextRole) return;
    setSelectedAccountRole(nextRole);
    navigate(resolveDashboardPath({ ...user, role: nextRole }), { replace: true });
    setMenuOpen(false);
  };

  return (
    <>
      {/* Barre du haut — type Instagram (logo zone + titre + actions) */}
      <header
        className="fixed top-0 left-0 right-0 z-[140] border-b border-[#D4AF37]/12 bg-gradient-to-b from-[#0c0a08]/95 to-black/88 backdrop-blur-xl supports-[backdrop-filter]:from-[#0c0a08]/88"
        style={{ paddingTop: 'max(0.35rem, env(safe-area-inset-top))' }}
      >
        <div className="flex h-12 items-center gap-2 px-2 sm:px-3">
          <div className="w-10 flex justify-start shrink-0">
            {!tabRoot ? (
              <button
                type="button"
                onClick={handleBack}
                className="flex h-10 w-10 items-center justify-center rounded-full text-white hover:bg-white/10"
                aria-label="Retour"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
            ) : (
              <Link
                to={homeHref}
                className="flex h-10 min-w-[2.75rem] items-center justify-center gap-0.5 rounded-xl border border-[#D4AF37]/40 bg-black/50 px-1.5 shadow-[0_0_20px_-6px_rgba(212,175,55,0.5)]"
                aria-label="LIRI accueil"
              >
                <LiriWordmark size="compact" className="text-[#D4AF37]" />
              </Link>
            )}
          </div>

          <h1 className="flex-1 text-center text-[15px] font-semibold tracking-tight truncate px-1 text-[#f0e8dc]">
            {title}
          </h1>

          <div className="w-10 flex justify-end gap-0.5 shrink-0 sm:w-auto sm:gap-1">
            {user ? (
              <>
                <NotificationDropdown externalUnreadCount={0} externalItems={[]} />
                <Button
                  variant="ghost"
                  size="icon"
                  className="relative h-10 w-10 rounded-full text-white hover:bg-white/10"
                  asChild
                >
                  <Link to={messagesHref} aria-label="Messages">
                    <MessageCircle className="h-5 w-5" />
                    {unreadMessages > 0 ? (
                      <Badge className="absolute top-1 right-1 h-4 min-w-4 px-0.5 flex items-center justify-center bg-[#ff3040] text-white text-[9px] border-0">
                        {unreadMessages > 9 ? '9+' : unreadMessages}
                      </Badge>
                    ) : null}
                  </Link>
                </Button>
              </>
            ) : null}

            <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
              <SheetTrigger asChild>
                <button
                  type="button"
                  className="flex h-10 w-10 items-center justify-center rounded-full text-white hover:bg-white/10"
                  aria-label="Menu"
                >
                  <Menu className="h-6 w-6" />
                </button>
              </SheetTrigger>
              <SheetContent
                side="right"
                className="w-[min(100%,320px)] overflow-y-auto border-[#D4AF37]/15 bg-gradient-to-b from-[#0f0c0a] to-[#080706]"
              >
                <SheetHeader>
                  <SheetTitle className="text-left font-serif text-[#f5e6c8]">Menu</SheetTitle>
                </SheetHeader>
                <nav className="mt-6 flex flex-col gap-1 text-sm">
                  <Link
                    to="/landing"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-3 rounded-xl px-3 py-3 text-white/90 hover:bg-white/5"
                  >
                    <ExternalLink className="h-5 w-5 text-[#D4AF37]" />
                    Site web classique
                  </Link>
                  <Link
                    to="/formations/catalogue"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-3 rounded-xl px-3 py-3 text-white/90 hover:bg-white/5"
                  >
                    <BookOpen className="h-5 w-5 text-[#D4AF37]" />
                    Catalogue formations
                  </Link>
                  <Link
                    to={LIRI_MOBILE.client}
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-3 rounded-xl px-3 py-3 text-white/90 hover:bg-white/5"
                  >
                    <Wallet className="h-5 w-5 text-[#D4AF37]" />
                    Espace client
                  </Link>
                  <Link
                    to="/boutique"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-3 rounded-xl px-3 py-3 text-white/90 hover:bg-white/5"
                  >
                    <ShoppingBag className="h-5 w-5 text-[#D4AF37]" />
                    Boutique
                  </Link>
                  <Link
                    to="/appointment/request"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-3 rounded-xl px-3 py-3 text-white/90 hover:bg-white/5"
                  >
                    <Calendar className="h-5 w-5 text-[#D4AF37]" />
                    Prendre RDV
                  </Link>
                  {user ? (
                    <>
                      <Link
                        to="/support"
                        onClick={() => setMenuOpen(false)}
                        className="flex items-center gap-3 rounded-xl px-3 py-3 text-white/90 hover:bg-white/5"
                      >
                        <HelpCircle className="h-5 w-5 text-[#D4AF37]" />
                        Support
                      </Link>
                      <Link
                        to="/settings"
                        onClick={() => setMenuOpen(false)}
                        className="flex items-center gap-3 rounded-xl px-3 py-3 text-white/90 hover:bg-white/5"
                      >
                        <Settings className="h-5 w-5 text-[#D4AF37]" />
                        Réglages
                      </Link>
                    </>
                  ) : (
                    <Link
                      to={getLiriMemberLoginPath()}
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-3 rounded-xl px-3 py-3 text-[#D4AF37] font-medium hover:bg-white/5"
                      title="Connexion LIRI — espace membre"
                    >
                      Connexion
                    </Link>
                  )}
                </nav>

                {user && isMultiRoleUser ? (
                  <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3">
                    <p className="text-[10px] uppercase tracking-wider text-white/40 mb-2">Compte</p>
                    <select
                      value={effectiveRole || 'owner'}
                      onChange={handleRoleSwitch}
                      className="w-full rounded-lg bg-black/40 border border-white/10 px-2 py-2 text-sm text-white"
                    >
                      <option value="student" className="bg-[#192734]">Élève</option>
                      <option value="owner" className="bg-[#192734]">Propriétaire</option>
                      <option value="secretariat" className="bg-[#192734]">Secrétariat</option>
                      <option value="teacher" className="bg-[#192734]">Professeur</option>
                      <option value="admin" className="bg-[#192734]">Admin</option>
                    </select>
                  </div>
                ) : null}

                {user ? (
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="mt-6 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-red-400 hover:bg-red-500/10"
                  >
                    <LogOut className="h-5 w-5" />
                    Déconnexion
                  </button>
                ) : null}
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      {/* Barre du bas — 5 onglets type Instagram */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-[140] border-t border-[#D4AF37]/10 bg-gradient-to-t from-black via-[#0a0908]/98 to-[#0d0b09]/95 backdrop-blur-2xl supports-[backdrop-filter]:to-[#0a0908]/92"
        style={{ paddingBottom: 'max(0.25rem, env(safe-area-inset-bottom))' }}
        aria-label="Navigation principale"
      >
        <div className="flex h-[3.65rem] items-stretch px-1">
          <TabItem to={homeHref} end icon={Home} label="Accueil" />
          <TabItem to={LIRI_MOBILE.courses} icon={BookOpen} label="Cours" />
          <TabItem to={LIRI_MOBILE.live} icon={Clapperboard} label="Live" />
          <TabItem to={messagesHref} icon={MessageCircle} label="Messages" />
          <TabItem to={LIRI_MOBILE.client} icon={Wallet} label="Client" />
        </div>
      </nav>
    </>
  );
}
