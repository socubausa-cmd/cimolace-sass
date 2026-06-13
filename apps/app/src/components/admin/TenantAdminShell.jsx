/**
 * TenantAdminShell — shell du back-office admin tenant, aligné byte-for-byte sur le shell
 * de l'espace élève (fond #0b0b0f, sidebar 220px flottante arrondie/blur, accents OR,
 * branding LIRI / PRORASCIENCE ACADEMY). Chaque page /t/:slug/admin/* se wrappe dedans :
 *   return <TenantAdminShell><...contenu navy+or...></TenantAdminShell>
 * Aucune modification du routeur requise.
 */
import React, { useState } from 'react';
import { DEFAULT_TENANT_SLUG } from '@/config/platform';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  LayoutDashboard, GraduationCap, Users, UserCog, Video, MonitorPlay,
  Sparkles, Brain, Megaphone, Calendar, MessageCircle, Bell, CreditCard, Cpu, Settings,
} from 'lucide-react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { ADMIN_T as T } from '@/lib/tenantAdminTheme';

const buildNav = (slug) => [
  { key: 'dashboard',     label: 'Tableau de bord',  icon: LayoutDashboard, path: `/t/${slug}/admin` },
  { key: 'courses',       label: 'Cours',            icon: GraduationCap,   path: `/t/${slug}/admin/courses` },
  { key: 'students',      label: 'Étudiants',        icon: Users,           path: `/t/${slug}/admin/students` },
  { key: 'members',       label: 'Membres',          icon: UserCog,         path: `/t/${slug}/admin/members` },
  { key: 'lives',         label: 'Sessions Live',    icon: Video,           path: `/t/${slug}/admin/lives` },
  { key: 'smartboard',    label: 'SmartBoard',       icon: MonitorPlay,     path: `/t/${slug}/admin/smartboard` },
  { key: 'studio',        label: 'Studio',           icon: Sparkles,        path: `/t/${slug}/admin/studio` },
  { key: 'neuro-recall',  label: 'NeuroRecall',      icon: Brain,           path: `/t/${slug}/admin/neuro-recall` },
  { key: 'marketing',     label: 'Marketing',        icon: Megaphone,       path: `/t/${slug}/admin/marketing` },
  { key: 'calendar',      label: 'Calendrier',       icon: Calendar,        path: `/t/${slug}/admin/calendar` },
  { key: 'chat',          label: 'Chat',             icon: MessageCircle,   path: `/t/${slug}/admin/chat` },
  { key: 'notifications', label: 'Notifications',    icon: Bell,            path: `/t/${slug}/admin/notifications` },
  { key: 'billing',       label: 'Facturation',      icon: CreditCard,      path: `/t/${slug}/admin/billing` },
  { key: 'ai-billing',    label: 'IA · Facturation', icon: Cpu,             path: `/t/${slug}/admin/ai-billing` },
  { key: 'settings',      label: 'Paramètres',       icon: Settings,        path: `/t/${slug}/admin/settings` },
];

const IconLogout = () => (
  <svg viewBox="0 0 20 20" width={14} height={14} fill="none">
    <path d="M14 8l3 3-3 3M7 11h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M11 5H5a1 1 0 00-1 1v10a1 1 0 001 1h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);
const IconMenu = () => (
  <svg viewBox="0 0 20 20" width={18} height={18} fill="none">
    <line x1="3" y1="6" x2="17" y2="6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <line x1="3" y1="10" x2="17" y2="10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <line x1="3" y1="14" x2="17" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);
const IconClose = () => (
  <svg viewBox="0 0 20 20" width={18} height={18} fill="none">
    <line x1="5" y1="5" x2="15" y2="15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <line x1="15" y1="5" x2="5" y2="15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

const NavItem = ({ item, isActive, onClick, index }) => {
  const [hov, setHov] = useState(false);
  const Icon = item.icon;
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 9,
        padding: '7px 10px', borderRadius: 8,
        background: isActive ? T.goldDim : hov ? T.surface2 : 'none',
        border: `1px solid ${isActive ? T.goldMid : 'transparent'}`,
        color: isActive ? T.gold : hov ? T.t1 : T.t2,
        fontWeight: isActive ? 600 : 400, fontSize: 12.5,
        textAlign: 'left', cursor: 'pointer',
        transition: 'all 150ms cubic-bezier(0.4,0,0.2,1)', position: 'relative',
        animation: `adminSlideIn 0.28s ease ${index * 22}ms both`,
      }}
    >
      {isActive && (
        <div style={{ position: 'absolute', left: 0, top: '25%', bottom: '25%', width: 2, borderRadius: '0 2px 2px 0', background: T.gold }}/>
      )}
      <Icon size={14} style={{ flexShrink: 0, color: isActive ? T.gold : T.t3 }} />
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</span>
    </button>
  );
};

const SidebarContent = ({ slug, onNavClick }) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const NAV = buildNav(slug);

  const isItemActive = (item) => {
    if (item.key === 'dashboard') return location.pathname === item.path || location.pathname === item.path + '/';
    return location.pathname === item.path || location.pathname.startsWith(item.path + '/');
  };
  const fullName = user?.name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Admin';
  const initials = fullName.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();

  const handleNav = (item) => { navigate(item.path); onNavClick?.(); };
  const handleLogout = async () => { await logout?.(); navigate('/'); };

  return (
    <>
      <div style={{ padding: '16px 14px 12px', borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
            background: 'linear-gradient(135deg,#7C3AED,#00E5FF)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 700, fontSize: 14, color: 'white',
          }}>{initials}</div>
          <div style={{ overflow: 'hidden' }}>
            <div style={{ fontWeight: 600, fontSize: 13, color: T.t1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fullName}</div>
            <div style={{ fontFamily: T.mono, fontSize: 8, color: '#00E5FF', letterSpacing: '0.1em', fontWeight: 600 }}>ADMINISTRATION ÉCOLE</div>
          </div>
        </div>
        <div style={{
          marginTop: 8, fontFamily: T.mono, fontSize: 8, color: T.t3, letterSpacing: '0.10em',
          background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 4, padding: '2px 6px', display: 'inline-block',
        }}>PROFIL ADMIN · {String(slug || '').toUpperCase()}</div>
      </div>

      <nav style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
        {NAV.map((item, i) => (
          <NavItem key={item.key} item={item} isActive={isItemActive(item)} onClick={() => handleNav(item)} index={i} />
        ))}
        <div style={{ height: 1, background: T.border, margin: '8px 4px' }}/>
        <button
          onClick={handleLogout}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 9, padding: '7px 10px', borderRadius: 8,
            background: 'none', border: '1px solid transparent', color: T.danger, fontSize: 12.5, fontWeight: 500,
            textAlign: 'left', cursor: 'pointer', transition: 'all 150ms ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(239,68,68,0.08)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
        >
          <IconLogout/> Déconnexion
        </button>
      </nav>

      <style>{`
        @keyframes adminSlideIn { from { opacity: 0; transform: translateX(-14px); } to { opacity: 1; transform: translateX(0); } }
        nav::-webkit-scrollbar { width: 3px; }
        nav::-webkit-scrollbar-track { background: transparent; }
        nav::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.10); border-radius: 2px; }
      `}</style>
    </>
  );
};

const LogoStrip = () => (
  <div style={{ padding: '14px 14px 12px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontWeight: 800, fontSize: 15, letterSpacing: '-0.02em' }}>
      <span style={{ color: T.t1 }}>L</span>
      <div style={{ width: 12, height: 12, borderRadius: '50%', background: 'linear-gradient(135deg,#7C3AED,#00E5FF)', flexShrink: 0, position: 'relative', top: -1, boxShadow: '0 0 8px rgba(124,58,237,0.5)' }}/>
      <span style={{ color: T.t1 }}>RI</span>
    </div>
    <div style={{ width: 1, height: 16, background: T.border }}/>
    <div>
      <div style={{ fontWeight: 700, fontSize: 12, color: T.t1, letterSpacing: '0.01em' }}>PRORASCIENCE</div>
      <div style={{ fontFamily: T.mono, fontSize: 7, color: T.t3, letterSpacing: '0.12em' }}>ACADEMY</div>
    </div>
  </div>
);

const TenantAdminShell = ({ children }) => {
  const { tenantSlug } = useParams();
  const slug = tenantSlug || DEFAULT_TENANT_SLUG;
  const [mobileOpen, setMobileOpen] = useState(false);

  const desktopSidebar = (
    <aside
      className="hidden lg:flex"
      style={{
        position: 'fixed', top: 14, left: 14, bottom: 14, width: 220, zIndex: 50,
        flexDirection: 'column', background: 'rgba(18,17,26,0.97)',
        border: `1px solid ${T.border}`, borderRadius: 18,
        backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        overflow: 'hidden', boxShadow: '0 16px 48px -16px rgba(0,0,0,0.55)',
      }}
    >
      <LogoStrip/>
      <SidebarContent slug={slug}/>
    </aside>
  );

  const mobileFab = (
    <div className="lg:hidden" style={{ position: 'fixed', bottom: 24, right: 20, zIndex: 200 }}>
      <button
        onClick={() => setMobileOpen((o) => !o)}
        style={{
          width: 48, height: 48, borderRadius: '50%', background: T.gold, border: 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#000', cursor: 'pointer',
          boxShadow: '0 4px 20px rgba(212,175,55,0.40)', transition: 'transform 150ms ease',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.06)')}
        onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
      >
        {mobileOpen ? <IconClose/> : <IconMenu/>}
      </button>
    </div>
  );

  const mobileDrawer = (
    <AnimatePresence>
      {mobileOpen && (
        <>
          <motion.div
            className="lg:hidden"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
            onClick={() => setMobileOpen(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 150, backdropFilter: 'blur(4px)' }}
          />
          <motion.aside
            className="lg:hidden"
            initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            style={{
              position: 'fixed', top: 0, left: 0, bottom: 0, width: 260, zIndex: 160,
              display: 'flex', flexDirection: 'column', background: 'rgba(18,17,26,0.99)', borderRight: `1px solid ${T.border}`,
            }}
          >
            <div style={{ padding: '16px 14px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 800, fontSize: 15 }}>
                <span style={{ color: T.t1 }}>L</span>
                <div style={{ width: 12, height: 12, borderRadius: '50%', background: 'linear-gradient(135deg,#7C3AED,#00E5FF)', flexShrink: 0 }}/>
                <span style={{ color: T.t1 }}>RI</span>
                <span style={{ fontFamily: T.mono, fontSize: 9, color: T.t3, marginLeft: 4 }}>PRORASCIENCE</span>
              </div>
              <button onClick={() => setMobileOpen(false)} style={{ background: 'none', border: 'none', color: T.t3, cursor: 'pointer', padding: 4 }}>
                <IconClose/>
              </button>
            </div>
            <SidebarContent slug={slug} onNavClick={() => setMobileOpen(false)}/>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );

  return (
    <div style={{ minHeight: '100dvh', background: T.bg, display: 'flex' }}>
      {desktopSidebar}
      {mobileFab}
      {mobileDrawer}
      <main className="lg:pl-[250px]" style={{ flex: 1, minHeight: '100dvh', overflowX: 'hidden' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '28px 24px 48px' }}>
          {children}
        </div>
      </main>
    </div>
  );
};

export default TenantAdminShell;
