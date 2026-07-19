import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Menu,
  User,
  ShoppingBag,
  LogOut,
  MessageSquare,
  HelpCircle,
  GraduationCap,
  BookOpen,
  Users,
  Calendar,
  School,
  Info,
  MessageCircle,
  Flame,
  LayoutDashboard,
} from 'lucide-react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useCart } from '@/hooks/useCart';
import { Button } from '@/components/ui/button';
import Logo from '@/components/Logo';
import MobileMenu from '@/components/MobileMenu';
import { Badge } from '@/components/ui/badge';
import NotificationDropdown from '@/components/notifications/NotificationDropdown';
import { resolveDashboardPath } from '@/lib/dashboardRoute';
import { getEffectiveRole, hasMultiRoleAccess, setSelectedAccountRole } from '@/lib/accountRoleMode';
import { useMessaging } from '@/contexts/MessagingContext';
import { supabase } from '@/lib/customSupabaseClient';
import { useBilling } from '@/contexts/BillingContext';
import ChatModal from '@/components/ChatModal';
import ImmersiveNavigationEngine from '@/components/navigation/ImmersiveNavigationEngine';
import { getFreshAccessToken } from '@/lib/authToken';
import { canServeSecretariatHeartbeat } from '@/lib/staffRole';
import { getLiriMemberLoginPath } from '@/lib/liriVitrineModel';
import { useResolvedTenantSlug } from '@/hooks/useResolvedTenantSlug';
import { activeTenantConfig, FOUNDER_TENANT_CONFIG as isnaTenantConfig } from '@/lib/tenant/activeTenantConfig';

const ISNA_SLUG = String(isnaTenantConfig?.slug || 'isna').trim().toLowerCase();
// Slug du tenant ACTIF résolu par l'hôte (synchrone) : 'isna' sur le domaine
// fondateur (prorascience.org), '' sur la plateforme neutre (app.cimolace.space).
const ACTIVE_TENANT_SLUG = String(activeTenantConfig?.slug || '').trim().toLowerCase();

const Header = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [liveInviteUnread, setLiveInviteUnread] = useState(0);
  const [liveInviteItems, setLiveInviteItems] = useState([]);
  const [appointmentUnread, setAppointmentUnread] = useState(0);
  const [appointmentItems, setAppointmentItems] = useState([]);
  const [isQuickChatOpen, setIsQuickChatOpen] = useState(false);
  const [isImmersiveNavOpen, setIsImmersiveNavOpen] = useState(false);
  const [recentPathways, setRecentPathways] = useState([]);
  const [immersiveRuntimeContext, setImmersiveRuntimeContext] = useState(null);

  const { user, session, logout } = useAuth();
  const { status, inGrace } = useBilling();
  const { toggleCart, getCartCount } = useCart();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isImmersiveEmbed = searchParams.get('immersive_embed') === '1';
  const isAuthenticated = Boolean(user);
  const isMultiRoleUser = hasMultiRoleAccess(user);
  const effectiveRole = getEffectiveRole(user);
  const dashboardPath = resolveDashboardPath(user);
  const { slug: resolvedTenantSlug } = useResolvedTenantSlug();
  const tenantSlugLc = String(resolvedTenantSlug || '').trim().toLowerCase();
  // Tenant ÉCOLE ? Les rubriques scolaires (Formations / Vie Étudiante / Prendre RDV
  // secrétariat / libellé « Academy ») ne s'affichent QUE pour le moteur école — jamais
  // pour un tenant MEDOS/wellness (ex. zahirwellness) ni la plateforme LIRI neutre, qui
  // héritaient sinon de la nav prorascience. Signal SYNCHRONE (hôte fondateur, anti-flash)
  // + slug résolu = isna. (À étendre à active_modules['ecole'] quand l'API l'exposera.)
  const isEcoleTenant = ACTIVE_TENANT_SLUG === ISNA_SLUG || tenantSlugLc === ISNA_SLUG;
  const pathnameLc = String(location.pathname || '').toLowerCase();
  /** ISNA : pas de pictogramme LIRI à côté de PRORASCIENCE. Sur /forfaits, masquer aussi si le Host résolu n'est pas clairement CIMOLACE (ex. localhost). */
  const hideLiriWordmarkImage =
    tenantSlugLc === ISNA_SLUG
    || (pathnameLc.startsWith('/forfaits') && tenantSlugLc !== 'cimolace');
  // LIRI = le PRODUIT : sans tenant résolu (hôte plateforme), la marque ramène au
  // PORTAIL /liri (pas la home école) et n'est pas une « Academy ».
  const isLiriProductContext = !tenantSlugLc;
  const brandHomeTo = isLiriProductContext ? '/liri' : '/';
  // Sous-titre marque = « Portail » pour tous (Academy déconnecté au profit du portail
  // LIRI). Plus de libellé « Academy » figé sur l'école — cohérent MEDOS/wellness/neutre.
  const brandSubtitle = 'Portail';
  const isImmersivePrimaryRoute = useMemo(() => {
    const path = String(location.pathname || '').toLowerCase();
    return (
      path === '/' ||
      path.startsWith('/forfaits') ||
      path.startsWith('/formations') ||
      path.startsWith('/dashboard') ||
      path.startsWith('/student-school-life') ||
      path.startsWith('/my-formations')
    );
  }, [location.pathname]);

  const { conversations = [] } = useMessaging();
  const unreadMessages = useMemo(
    () => conversations.reduce((acc, c) => acc + (c.unreadCount || 0), 0),
    [conversations]
  );
  const role = String(effectiveRole || '').toLowerCase();
  const isStaffRole = ['owner', 'admin', 'secretariat', 'teacher', 'creator', 'commercial', 'support'].includes(role);
  const isOwnerOrAdmin = role === 'owner' || role === 'admin';
  const isPremiumActive = status === 'active' || (status === 'past_due' && inGrace);
  const canUseImmersiveChat = isAuthenticated && (isStaffRole || isPremiumActive);

  // « Tableau de bord » : un membre élève (visiteur premium déjà inscrit) doit atterrir sur son
  // vrai espace, pas sur la page d'entretien vide (/prospect/entretien). Le resolver générique
  // renvoie /prospect/entretien pour tout « visitor » ; on corrige ce cas ici (header uniquement).
  const headerDashboardPath = useMemo(() => {
    if (role === 'visitor' && isPremiumActive && user?.student_profile_completed) {
      return '/student-school-life/dashboard';
    }
    return dashboardPath;
  }, [role, isPremiumActive, user?.student_profile_completed, dashboardPath]);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (!user?.id) {
      setLiveInviteUnread(0);
      setLiveInviteItems([]);
      return undefined;
    }
    const fetchLiveInvites = async () => {
      const { data, error } = await supabase
        .from('live_chat_invites')
        .select('*')
        .eq('receiver_id', user.id)
        .in('status', ['pending', 'missed'])
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) return;
      const items = (data || []).map((inv) => ({
        id: `live-invite-${inv.id}`,
        title: inv.status === 'missed' ? 'Live manqué' : 'Invitation live',
        message: inv.status === 'missed'
          ? 'Vous avez raté un chat live. Laissez un mot.'
          : 'Un membre vous invite en studio immersif.',
        timestamp: inv.created_at,
        isRead: false,
      }));
      setLiveInviteItems(items);
      setLiveInviteUnread(items.filter((x) => x.title === 'Invitation live').length);
    };
    void fetchLiveInvites();
    const channel = supabase
      .channel(`header-live-invites-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'live_chat_invites' }, () => {
        void fetchLiveInvites();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return undefined;

    let cancelled = false;
    let heartbeatStopped = false;
    let timer = null;

    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Africa/Libreville';
    const lang = String(navigator.language || '');
    const country = (lang.split('-')[1] || '').toUpperCase();

    const pingOnce = async (accessToken) => {
      if (!accessToken) return null;
      return fetch('/.netlify/functions/appointments-secretariat-heartbeat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ online: true, timezone, country }),
      });
    };

    const ping = async () => {
      if (heartbeatStopped) return;
      try {
        let token = await getFreshAccessToken();
        let res = await pingOnce(token);
        if (res?.status === 401) {
          token = await getFreshAccessToken({ forceRefresh: true });
          res = await pingOnce(token);
        }
        if (res?.status === 401) {
          heartbeatStopped = true;
          if (timer) window.clearInterval(timer);
          console.warn('[header] appointments-secretariat-heartbeat stopped after 401 Invalid token');
        }
        if (res?.status === 403) {
          heartbeatStopped = true;
          if (timer) window.clearInterval(timer);
        }
      } catch {
        // ignore heartbeat failures in UI
      }
    };

    void (async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();
      if (cancelled || error || !canServeSecretariatHeartbeat(data?.role)) return;

      await ping();
      timer = window.setInterval(ping, 45_000);
    })();

    return () => {
      cancelled = true;
      heartbeatStopped = true;
      if (timer) window.clearInterval(timer);
    };
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) {
      setAppointmentUnread(0);
      setAppointmentItems([]);
      return undefined;
    }
    const fetchAppointmentReminders = async () => {
      const nowIso = new Date().toISOString();
      const { data, error } = await supabase
        .from('appointment_requests')
        .select('id,status,reason,scheduled_at,created_at,booking_channel')
        .eq('student_id', user.id)
        .in('status', ['pending', 'confirmed'])
        .order('scheduled_at', { ascending: true })
        .limit(5);
      if (error) return;
      const items = (data || []).map((row) => {
        const isNgowazulu = String(row.booking_channel || '').toLowerCase() === 'ngowazulu';
        return {
          id: `appt-${row.id}`,
          title:
            row.status === 'confirmed'
              ? (isNgowazulu ? 'Consultation Ngowazulu confirmée' : 'Entretien confirmé')
              : (isNgowazulu ? 'Consultation Ngowazulu en attente' : 'Entretien en attente'),
          message: row.status === 'confirmed'
            ? `Rendez-vous prevu ${row.scheduled_at ? new Date(row.scheduled_at).toLocaleString('fr-FR') : ''}`
            : 'Votre demande est en attente de validation secretaire.',
          timestamp: row.scheduled_at || row.created_at || nowIso,
          isRead: false,
        };
      });
      setAppointmentItems(items);
      setAppointmentUnread(items.length);
    };
    void fetchAppointmentReminders();
    const channel = supabase
      .channel(`header-appointments-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointment_requests', filter: `student_id=eq.${user.id}` }, () => {
        void fetchAppointmentReminders();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const handleRoleSwitch = (event) => {
    const nextRole = String(event.target.value || '').toLowerCase();
    if (!nextRole) return;
    setSelectedAccountRole(nextRole);
    navigate(resolveDashboardPath({ ...user, role: nextRole }), { replace: true });
  };

  // Nav SCOLAIRE (Formations / Accompagnement / Vie Étudiante / Ressources / Boutique
  // école) : ce sont les rubriques du MOTEUR ÉCOLE. Elles ne doivent s'afficher QUE
  // pour un tenant école — JAMAIS pour un tenant MEDOS/wellness (ex. zahirwellness)
  // ni pour la plateforme LIRI neutre, qui sinon héritaient de la nav prorascience.
  // (cf. isEcoleTenant calculé en tête de composant)
  const desktopLinks = useMemo(
    () =>
      isEcoleTenant
        ? [
            { id: 'formations', label: 'Formations', icon: GraduationCap, to: '/forfaits' },
            { id: 'accompagnement', label: 'Accompagnement', icon: Users, to: '/accompagnement/coaching' },
            { id: 'vie-etudiante', label: 'Vie Étudiante', icon: School, to: '/student-school-life/dashboard' },
            { id: 'ressources', label: 'Ressources', icon: BookOpen, to: '/resources' },
            { id: 'boutique', label: 'Boutique', icon: ShoppingBag, to: '/boutique' },
          ]
        : [],
    [isEcoleTenant]
  );

  const quickLinks = desktopLinks.slice(0, 3);
  const mobileSections = useMemo(
    () => [
      {
        id: 'navigation',
        label: 'Navigation',
        icon: GraduationCap,
        submenu: desktopLinks.map((item) => ({ label: item.label, path: item.to, icon: item.icon })),
      },
    ],
    [desktopLinks]
  );
  const isPathActive = (path) => {
    const base = String(path || '').split('#')[0];
    if (!base) return false;
    return location.pathname === base || location.pathname.startsWith(`${base}/`);
  };
  const roleLabelMap = {
    student: 'Eleve',
    owner: 'Proprietaire',
    secretariat: 'Secretaire',
    teacher: 'Professeur',
    admin: 'Admin',
  };

  useEffect(() => {
    if (!isAuthenticated || !isMultiRoleUser) return;
    const path = String(location.pathname || '').toLowerCase();
    const currentRole = String(effectiveRole || '').toLowerCase();
    if (currentRole !== 'student') return;

    const restrictedPrefixes = ['/admin', '/owner-dashboard', '/teacher-dashboard', '/teacher-space', '/secretariat', '/secretariat-space'];
    const onRestrictedArea = restrictedPrefixes.some((prefix) => path.startsWith(prefix));
    if (onRestrictedArea) {
      navigate('/student-school-life/dashboard', { replace: true });
    }
  }, [effectiveRole, isAuthenticated, isMultiRoleUser, location.pathname, navigate]);

  useEffect(() => {
    const key = 'immersive-recent-paths-v1';
    const current = String(location.pathname || '/');
    setRecentPathways((prev) => {
      const base = prev.length ? prev : (() => {
        try {
          const raw = window.sessionStorage.getItem(key);
          const parsed = JSON.parse(raw || '[]');
          return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
        } catch {
          return [];
        }
      })();
      const deduped = [current, ...base.filter((x) => x !== current)].slice(0, 6);
      window.sessionStorage.setItem(key, JSON.stringify(deduped));
      return deduped;
    });
  }, [location.pathname]);

  useEffect(() => {
    if (!isImmersiveNavOpen) return;
    let active = true;
    const loadContext = async () => {
      try {
        const headers = {};
        if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
        const res = await fetch('/api/immersive/context', { headers });
        const payload = await res.json().catch(() => ({}));
        if (!active || !res.ok) return;
        setImmersiveRuntimeContext(payload || null);
      } catch {
        if (!active) return;
        setImmersiveRuntimeContext(null);
      }
    };
    loadContext();
    return () => {
      active = false;
    };
  }, [isImmersiveNavOpen, session?.access_token]);

  /** Iframe embarqué dans le moteur immersif : pas de header / bouton flottant */
  if (isImmersiveEmbed) {
    return null;
  }

  // (Anciennement : return null sur /owner-dashboard pour éviter le doublon d'entête.
  // Levé — parité avec le secrétariat : l'owner affiche désormais l'entête globale,
  // la sidebar repliée par défaut évitant le doublon de marque.)

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-[100] transition-all duration-500 ${
          isScrolled
            ? 'bg-[#0F1419]/70 backdrop-blur-2xl shadow-[0_8px_30px_rgba(0,0,0,0.35)] border-b border-white/15 py-1'
            : 'bg-[#0F1419]/85 backdrop-blur-xl border-b border-white/10 py-3'
        }`}
      >
        <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            
            {/* LEFT: Logo */}
            <div className="flex-shrink-0 flex items-center gap-4 mr-2 lg:mr-8 z-[101]">
              <Logo size={isScrolled ? "small" : "medium"} variant="dark" hideWordmarkImage={hideLiriWordmarkImage} to={brandHomeTo} subtitle={brandSubtitle} />
            </div>

            {/* CENTER: Navigation (Desktop) */}
            <nav className="hidden lg:flex flex-1 min-w-0 items-center">
              <div className="flex flex-1 items-center gap-1 xl:gap-2 overflow-x-auto whitespace-nowrap [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {desktopLinks.map((item) => (
                  <Link
                    key={item.id}
                    to={item.to}
                    className={`relative inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                      isPathActive(item.to)
                        ? 'text-[var(--school-accent)]'
                        : item.id === 'ngowazulu'
                          ? 'text-[var(--school-accent)] border border-[color-mix(in_srgb,var(--school-accent)_35%,transparent)] bg-[color-mix(in_srgb,var(--school-accent)_10%,transparent)] hover:bg-[color-mix(in_srgb,var(--school-accent)_20%,transparent)]'
                          : 'text-gray-300 hover:text-[var(--school-accent)] hover:bg-white/5'
                    }`}
                  >
                    <item.icon className="w-4 h-4" />
                    <span>{item.label}</span>
                    {isPathActive(item.to) ? (
                      <motion.span
                        layoutId="header-active-indicator"
                        className="absolute inset-0 -z-10 rounded-lg bg-gradient-to-r from-[color-mix(in_srgb,var(--school-accent)_25%,transparent)] to-[color-mix(in_srgb,var(--school-accent)_10%,transparent)] border border-[color-mix(in_srgb,var(--school-accent)_30%,transparent)]"
                        transition={{ type: 'spring', stiffness: 450, damping: 35 }}
                      />
                    ) : null}
                  </Link>
                ))}
              </div>
            </nav>

            {/* RIGHT: Actions (Desktop) */}
            <div className="hidden lg:flex items-center gap-3 xl:gap-5 flex-shrink-0 ml-4 z-[101]">
              {isOwnerOrAdmin && (
                <>
                  <Button
                    asChild
                    variant="outline"
                    size="sm"
                    className="border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/15"
                    title="Paiements Chariow externes"
                  >
                    <Link to="/admin/billing?tab=external">Chariow Externes</Link>
                  </Button>
                  <Button
                    asChild
                    variant="outline"
                    size="sm"
                    className="border-violet-500/40 text-violet-300 hover:bg-violet-500/15"
                    title="Automation marketing et funnels"
                  >
                    <Link to="/liri/crm?tab=automation">Marketing Automation</Link>
                  </Button>
                </>
              )}
              {/* Tableau de bord (visible si connecté) — cible corrigée pour les membres élèves. */}
              {isAuthenticated && (
                <Link to={headerDashboardPath}>
                  <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                    <Button className="bg-gradient-to-r from-[var(--school-accent)] to-amber-600 hover:from-amber-500 hover:to-yellow-500 text-black font-bold shadow-lg shadow-amber-900/20 border-0 gap-2 transition-all duration-300">
                      <LayoutDashboard className="w-4 h-4" />
                      <span className="hidden sm:inline">Tableau de bord</span>
                    </Button>
                  </motion.div>
                </Link>
              )}
              {/* « Prendre RDV » = prise de RDV secrétariat ÉCOLE → réservé au moteur école
                  (un tenant MEDOS prend ses RDV via MEDOS, pas par ce bouton). */}
              {isEcoleTenant && (
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="shrink-0 border-[color-mix(in_srgb,var(--school-accent)_55%,transparent)] bg-[color-mix(in_srgb,var(--school-accent)_12%,transparent)] text-[#f0d78c] hover:bg-[color-mix(in_srgb,var(--school-accent)_22%,transparent)] hover:text-white shadow-[inset_0_0_0_1px_rgba(212,175,55,0.35)]"
                  title="Calendrier — prendre rendez-vous avec le secrétariat"
                >
                  <Link to="/appointment/request" className="inline-flex items-center gap-2 font-semibold">
                    <Calendar className="w-4 h-4 text-[var(--school-accent)]" aria-hidden />
                    <span className="hidden xl:inline">Prendre RDV</span>
                    <span className="xl:hidden">RDV</span>
                  </Link>
                </Button>
              )}
              {isAuthenticated && isMultiRoleUser && (
                <div className="px-2 py-1 rounded-lg border border-white/10 bg-white/5">
                  <select
                    value={effectiveRole || 'owner'}
                    onChange={handleRoleSwitch}
                    className="bg-transparent text-xs text-white outline-none"
                    title="Changer le type de compte"
                  >
                    <option value="student" className="bg-[#192734] text-white">Eleve</option>
                    <option value="owner" className="bg-[#192734] text-white">Proprietaire</option>
                    <option value="secretariat" className="bg-[#192734] text-white">Secretaire</option>
                    <option value="teacher" className="bg-[#192734] text-white">Professeur</option>
                    <option value="admin" className="bg-[#192734] text-white">Admin</option>
                  </select>
                </div>
              )}

              {isAuthenticated && (
                <>
                  <Button
                    asChild
                    variant="ghost"
                    size="icon"
                    className="text-gray-400 hover:text-white hover:bg-white/5 rounded-full"
                    title="Support"
                  >
                    <Link to="/support">
                      <HelpCircle className="w-5 h-5" />
                    </Link>
                  </Button>
                  <NotificationDropdown
                    externalUnreadCount={liveInviteUnread + appointmentUnread}
                    externalItems={[...liveInviteItems, ...appointmentItems]}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="relative text-gray-400 hover:text-white hover:bg-white/5 rounded-full"
                    title={canUseImmersiveChat ? 'Chat immersif' : 'Aide rapide (chatbot)'}
                    onClick={() => {
                      if (canUseImmersiveChat) {
                        navigate('/messages');
                        return;
                      }
                      setIsQuickChatOpen(true);
                    }}
                  >
                    {canUseImmersiveChat ? <MessageSquare className="w-5 h-5" /> : <MessageCircle className="w-5 h-5" />}
                    {canUseImmersiveChat && unreadMessages > 0 && (
                      <Badge className="absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center bg-red-500 text-white text-[10px]">
                        {unreadMessages}
                      </Badge>
                    )}
                  </Button>
                </>
              )}

              <Button
                variant="ghost"
                size="icon"
                onClick={toggleCart}
                className="relative text-gray-400 hover:text-[var(--school-accent)] hover:bg-white/5 rounded-full"
              >
                <ShoppingBag className="w-5 h-5" />
                {getCartCount() > 0 && (
                  <Badge className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center bg-[var(--school-accent)] text-black text-xs">
                    {getCartCount()}
                  </Badge>
                )}
              </Button>

              {isAuthenticated ? (
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 text-white bg-white/5 px-3 py-1.5 rounded-full border border-white/10">
                    <User className="w-4 h-4 text-[var(--school-accent)]" />
                    <span className="text-sm hidden xl:inline">{user?.email}</span>
                    {isMultiRoleUser ? (
                      <span className="text-[10px] uppercase tracking-wide text-[var(--school-accent)]">
                        {roleLabelMap[effectiveRole] || 'Role'}
                      </span>
                    ) : null}
                  </div>

                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={handleLogout}
                    className="text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-full"
                    title="Se déconnecter"
                  >
                    <LogOut className="w-5 h-5" />
                  </Button>
                </div>
              ) : (
                <Button
                  asChild
                  size="sm"
                  className="bg-[#192734] hover:bg-[#22303c] text-white border border-white/10"
                >
                  <Link to={getLiriMemberLoginPath()} title="Espace membre — connexion LIRI">
                    Connexion
                  </Link>
                </Button>
              )}
            </div>

            {/* Mobile Menu Button */}
            <div className="lg:hidden flex items-center gap-2 sm:gap-4 z-[101]">
              <Button
                asChild
                variant="outline"
                size="icon"
                className="border-[color-mix(in_srgb,var(--school-accent)_50%,transparent)] bg-[color-mix(in_srgb,var(--school-accent)_12%,transparent)] text-[var(--school-accent)] hover:bg-[color-mix(in_srgb,var(--school-accent)_25%,transparent)] shrink-0 h-10 w-10"
                title="Prendre rendez-vous"
              >
                <Link to="/appointment/request" aria-label="Ouvrir le calendrier de réservation">
                  <Calendar className="w-5 h-5" />
                </Link>
              </Button>
              {isOwnerOrAdmin && (
                <>
                  <Button
                    asChild
                    variant="ghost"
                    size="sm"
                    className="text-emerald-300 border border-emerald-500/35 rounded-full px-3 hover:bg-emerald-500/15"
                  >
                    <Link to="/admin/billing?tab=external">CHW</Link>
                  </Button>
                  <Button
                    asChild
                    variant="ghost"
                    size="sm"
                    className="text-violet-300 border border-violet-500/35 rounded-full px-3 hover:bg-violet-500/15"
                  >
                    <Link to="/liri/crm?tab=automation">MKT</Link>
                  </Button>
                </>
              )}
              {isAuthenticated && isMultiRoleUser && (
                <div className="px-2 py-1 rounded-lg border border-white/10 bg-white/5">
                  <select
                    value={effectiveRole || 'owner'}
                    onChange={handleRoleSwitch}
                    className="bg-transparent text-[11px] text-white outline-none max-w-[96px]"
                    title="Changer le type de compte"
                  >
                    <option value="student" className="bg-[#192734] text-white">Eleve</option>
                    <option value="owner" className="bg-[#192734] text-white">Prop.</option>
                    <option value="secretariat" className="bg-[#192734] text-white">Secr.</option>
                    <option value="teacher" className="bg-[#192734] text-white">Prof.</option>
                    <option value="admin" className="bg-[#192734] text-white">Admin</option>
                  </select>
                </div>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleCart}
                className="relative text-gray-400 hover:text-[var(--school-accent)] hover:bg-white/5 rounded-full"
              >
                <ShoppingBag className="w-5 h-5" />
                 {getCartCount() > 0 && (
                  <Badge className="absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center bg-[var(--school-accent)] text-black text-[10px]">
                    {getCartCount()}
                  </Badge>
                )}
              </Button>
              <button
                onClick={() => setIsMobileMenuOpen(true)}
                className="p-2 rounded-md text-gray-300 hover:text-white hover:bg-white/10"
              >
                <Menu className="h-6 w-6" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <MobileMenu 
        isOpen={isMobileMenuOpen} 
        onClose={() => setIsMobileMenuOpen(false)}
        menuSections={mobileSections}
        quickLinks={quickLinks}
        dashboardPath={headerDashboardPath}
        showDashboardButton={isAuthenticated}
        canUseImmersiveChat={canUseImmersiveChat}
        onOpenQuickChat={() => setIsQuickChatOpen(true)}
        onOpenImmersiveNav={() => setIsImmersiveNavOpen(true)}
      />
      <ChatModal isOpen={isQuickChatOpen} onClose={() => setIsQuickChatOpen(false)} />
      {isImmersivePrimaryRoute && (
        <motion.button
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          onClick={() => setIsImmersiveNavOpen(true)}
          className="fixed bottom-5 right-5 z-[130] rounded-full border border-[color-mix(in_srgb,var(--school-accent)_45%,transparent)] bg-[color-mix(in_srgb,var(--school-accent)_20%,transparent)] backdrop-blur-md px-4 py-2 text-xs font-semibold tracking-wide text-[var(--school-accent)] shadow-[0_10px_30px_rgba(0,0,0,0.35)] hover:bg-[color-mix(in_srgb,var(--school-accent)_30%,transparent)]"
        >
          Parcours IA
        </motion.button>
      )}
      <ImmersiveNavigationEngine
        isOpen={isImmersiveNavOpen}
        onClose={() => setIsImmersiveNavOpen(false)}
        isAuthenticated={isAuthenticated}
        canUseImmersiveChat={canUseImmersiveChat}
        userRole={String(effectiveRole || 'visitor').toLowerCase()}
        isPremiumActive={isPremiumActive}
        recentPathways={recentPathways}
        runtimeContext={immersiveRuntimeContext}
        sessionToken={session?.access_token || ''}
        onOpenQuickChat={() => setIsQuickChatOpen(true)}
      />
    </>
  );
};

export default Header;