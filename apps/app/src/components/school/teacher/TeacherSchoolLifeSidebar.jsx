/**
 * TeacherSchoolLifeSidebar — Charte LIRI Prorascience
 * Chrome aligné byte-for-byte sur StudentSchoolLifeSidebar :
 * Width: 220px · panneau flottant arrondi/blur · Gold active state · branding LIRI / PRORASCIENCE ACADEMY.
 * Spécifique formateur : items de nav supplémentaires (icônes lucide) + section "Administration école" (recolorée OR).
 */
import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  LayoutDashboard,
  BookOpen,
  GraduationCap,
  School,
  User,
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
import { FOUNDER_TENANT_CONFIG as isnaTenantConfig } from '@/lib/tenant/activeTenantConfig';
import { getActiveTenantBranding } from '@/lib/tenant/activeBranding';

/* ─── Tokens (copiés depuis StudentSchoolLifeSidebar — ne pas importer) ─── */
const T = {
  bg:        '#0b0b0f',
  surface:   '#12111a',
  surface2:  '#192734',
  border:    'rgba(255,255,255,0.07)',
  borderMid: 'rgba(255,255,255,0.12)',
  gold:      '#D4AF37',
  goldDim:   'rgba(212,175,55,0.12)',
  goldMid:   'rgba(212,175,55,0.28)',
  violet:    '#7C3AED',
  violetDim: 'rgba(124,58,237,0.12)',
  violetMid: 'rgba(124,58,237,0.28)',
  cyan:      '#00E5FF',
  danger:    '#EF4444',
  t1: '#F5F5F7',
  t2: 'rgba(245,245,247,0.65)',
  t3: 'rgba(245,245,247,0.38)',
  mono: "'JetBrains Mono','Fira Code',monospace",
};

const slug = isnaTenantConfig.slug;

/* ─── Nav items formateur (préfixe /teacher-space, icônes lucide conservées) ─── */
const NAV = [
  { key: 'dashboard',               label: 'Tableau de bord',    icon: LayoutDashboard, path: '/teacher-space/dashboard' },
  { key: 'formations',              label: 'Mes Formations',     icon: BookOpen,        path: '/teacher-space/formations' },
  { key: 'classroom',               label: 'Gestion de Classe',  icon: Book,            path: '/teacher-space/classroom' },
  { key: 'classes',                 label: 'Gestion des Classes',icon: School,          path: '/teacher-space/classes' },
  { key: 'corrections',             label: 'Corrections',        icon: ClipboardCheck,  path: '/teacher-space/corrections' },
  { key: 'live',                    label: 'Sessions Live',      icon: Video,           path: '/teacher-space/live' },
  { key: 'vie-scolaire',            label: 'Vie Scolaire',       icon: School,          path: '/teacher-space/vie-scolaire' },
  { key: 'forum',                   label: 'Forum communauté',   icon: MessageCircle,   path: '/teacher-space/forum' },
  { key: 'bibliotheque',            label: 'Bibliothèque',       icon: Library,         path: '/teacher-space/bibliotheque' },
  { key: 'bibliotheque-ressources', label: 'Ressources',         icon: Archive,         path: '/teacher-space/bibliotheque-ressources' },
  { key: 'agenda',                  label: 'Agenda',             icon: Calendar,        path: '/teacher-space/agenda' },
  { key: 'programme-annuel',        label: 'Programme Annuel',   icon: CalendarRange,   path: '/teacher-space/programme-annuel' },
  { key: 'studio',                  label: 'Studio Créateur',    icon: Sparkles,        path: '/studio' },
  { key: 'evaluations',             label: 'Évaluations',        icon: GraduationCap,   path: '/teacher-space/evaluations' },
  { key: 'notes',                   label: 'Notes & Résultats',  icon: FileText,        path: '/teacher-space/notes' },
  { key: 'absences',                label: 'Absences',           icon: AlertTriangle,   path: '/teacher-space/absences' },
  { key: 'documents',               label: 'Documents',          icon: Download,        path: '/teacher-space/documents' },
  { key: 'profile',                 label: 'Mon Profil',         icon: User,            path: '/teacher-space/profile' },
];

/* ─── Section Administration école (accents recolorés OR) ─── */
const ADMIN_NAV = [
  { key: 'admin-courses',  label: 'Gérer les Cours',     icon: GraduationCap, path: `/t/${slug}/admin/courses` },
  { key: 'admin-students', label: 'Gérer les Étudiants', icon: Users,         path: `/t/${slug}/admin/students` },
  { key: 'admin-settings', label: 'Paramètres École',    icon: Settings,      path: `/t/${slug}/admin/settings` },
];

/* ─── SVG Logout / Menu / Close icons ─── */
const IconLogout = () => (
  <svg viewBox="0 0 20 20" width={14} height={14} fill="none">
    <path d="M14 8l3 3-3 3M7 11h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M11 5H5a1 1 0 00-1 1v10a1 1 0 001 1h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);
const IconMenu = () => (
  <svg viewBox="0 0 20 20" width={18} height={18} fill="none">
    <line x1="3" y1="6"  x2="17" y2="6"  stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <line x1="3" y1="10" x2="17" y2="10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <line x1="3" y1="14" x2="17" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);
const IconClose = () => (
  <svg viewBox="0 0 20 20" width={18} height={18} fill="none">
    <line x1="5" y1="5"  x2="15" y2="15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <line x1="15" y1="5" x2="5"  y2="15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

/* ─── Single nav item ─── */
const NavItem = ({ item, isActive, onClick, index }) => {
  const [hov, setHov] = useState(false);
  const Icon = item.icon;
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width: '100%',
        display: 'flex', alignItems: 'center', gap: 9,
        padding: '7px 10px', borderRadius: 8,
        background: isActive ? T.goldDim : hov ? T.surface2 : 'none',
        border: `1px solid ${isActive ? T.goldMid : 'transparent'}`,
        color: isActive ? T.gold : hov ? T.t1 : T.t2,
        fontWeight: isActive ? 600 : 400, fontSize: 12.5,
        textAlign: 'left', cursor: 'pointer',
        transition: 'all 150ms cubic-bezier(0.4,0,0.2,1)',
        position: 'relative',
        animation: `sidebarSlideIn 0.28s ease ${index * 25}ms both`,
      }}
    >
      {/* Active left border */}
      {isActive && (
        <div style={{
          position: 'absolute', left: 0, top: '25%', bottom: '25%',
          width: 2, borderRadius: '0 2px 2px 0', background: T.gold,
        }}/>
      )}
      <Icon size={14} style={{ flexShrink: 0, color: isActive ? T.gold : T.t3 }} />
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {item.label}
      </span>
    </button>
  );
};

/* ─── Sidebar content (shared desktop/mobile) ─── */
const SidebarContent = ({ onNavClick }) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const isItemActive = (item) => {
    if (item.path === '/teacher-space/forum') {
      return location.pathname.startsWith('/teacher-space/forum');
    }
    return location.pathname === item.path || location.pathname.startsWith(item.path + '/');
  };

  const fullName = user?.name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Professeur';
  const initials = fullName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  const handleNav = (item) => {
    navigate(item.path);
    onNavClick?.();
  };

  const handleLogout = async () => {
    await logout?.();
    navigate('/');
  };

  return (
    <>
      {/* ── User card ── */}
      <div style={{
        padding: '16px 14px 12px',
        borderBottom: `1px solid ${T.border}`,
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
            background: 'linear-gradient(135deg,#7C3AED,#00E5FF)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 700, fontSize: 14, color: 'white',
          }}>{initials}</div>
          <div style={{ overflow: 'hidden' }}>
            <div style={{ fontWeight: 600, fontSize: 13, color: T.t1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {fullName}
            </div>
            <div style={{ fontFamily: T.mono, fontSize: 8, color: T.cyan, letterSpacing: '0.1em', fontWeight: 600 }}>
              ESPACE PROFESSEUR
            </div>
          </div>
        </div>
        <div style={{
          marginTop: 8, fontFamily: T.mono, fontSize: 8,
          color: T.t3, letterSpacing: '0.10em',
          background: T.surface2, border: `1px solid ${T.border}`,
          borderRadius: 4, padding: '2px 6px', display: 'inline-block',
        }}>PROFIL FORMATEUR</div>
      </div>

      {/* ── Nav ── */}
      <nav style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
        {NAV.map((item, i) => (
          <NavItem
            key={item.key}
            item={item}
            isActive={isItemActive(item)}
            onClick={() => handleNav(item)}
            index={i}
          />
        ))}

        {/* ── Administration école (accents OR) ── */}
        <div style={{ height: 1, background: T.border, margin: '10px 4px 8px' }}/>
        <div style={{
          padding: '0 10px 6px', fontFamily: T.mono, fontSize: 9,
          fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase',
          color: T.t3,
        }}>
          Administration école
        </div>
        {ADMIN_NAV.map((item, i) => (
          <NavItem
            key={item.key}
            item={item}
            isActive={isItemActive(item)}
            onClick={() => handleNav(item)}
            index={NAV.length + i}
          />
        ))}

        <div style={{ height: 1, background: T.border, margin: '8px 4px' }}/>

        {/* Logout */}
        <button
          onClick={handleLogout}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 9,
            padding: '7px 10px', borderRadius: 8,
            background: 'none', border: '1px solid transparent',
            color: T.danger, fontSize: 12.5, fontWeight: 500,
            textAlign: 'left', cursor: 'pointer', transition: 'all 150ms ease',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.08)'}
          onMouseLeave={e => e.currentTarget.style.background = 'none'}
        >
          <IconLogout/>
          Déconnexion
        </button>
      </nav>

      <style>{`
        @keyframes sidebarSlideIn {
          from { opacity: 0; transform: translateX(-14px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        nav::-webkit-scrollbar { width: 3px; }
        nav::-webkit-scrollbar-track { background: transparent; }
        nav::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.10); border-radius: 2px; }
      `}</style>
    </>
  );
};

/* ═══════════════════════════ MAIN EXPORT ══════════════════════════════════ */
const TeacherSchoolLifeSidebar = () => {
  const [mobileOpen, setMobileOpen] = useState(false);

  /* ── Desktop sidebar (fixed, 220px) ── */
  const desktopSidebar = (
    <aside
      className="hidden lg:flex"
      style={{
        // Panneau flottant arrondi (façon Claude) : descend sous le header (89px), marges, arrondis.
        position: 'fixed', top: 100, left: 14, bottom: 14,
        width: 220, zIndex: 50,
        flexDirection: 'column',
        background: 'rgba(18,17,26,0.97)',
        border: `1px solid ${T.border}`,
        borderRadius: 18,
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        overflow: 'hidden',
        boxShadow: '0 16px 48px -16px rgba(0,0,0,0.55)',
      }}
    >
      {/* LIRI logo strip */}
      <div style={{
        padding: '14px 14px 12px',
        borderBottom: `1px solid ${T.border}`,
        display: 'flex', alignItems: 'center', gap: 8,
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontWeight: 800, fontSize: 15, letterSpacing: '-0.02em' }}>
          <span style={{ color: T.t1 }}>L</span>
          <div style={{
            width: 12, height: 12, borderRadius: '50%',
            background: 'linear-gradient(135deg,#7C3AED,#00E5FF)',
            flexShrink: 0, position: 'relative', top: -1,
            boxShadow: '0 0 8px rgba(124,58,237,0.5)',
          }}/>
          <span style={{ color: T.t1 }}>RI</span>
        </div>
        <div style={{ width: 1, height: 16, background: T.border }}/>
        <div>
          <div style={{ fontWeight: 700, fontSize: 12, color: T.t1, letterSpacing: '0.01em' }}>{getActiveTenantBranding().name.toUpperCase()}</div>
          <div style={{ fontFamily: T.mono, fontSize: 7, color: T.t3, letterSpacing: '0.12em' }}>ACADEMY</div>
        </div>
      </div>

      <SidebarContent/>
    </aside>
  );

  /* ── Mobile FAB + drawer ── */
  const mobileFab = (
    <div className="lg:hidden" style={{ position: 'fixed', bottom: 24, right: 20, zIndex: 200 }}>
      <button
        onClick={() => setMobileOpen(o => !o)}
        style={{
          width: 48, height: 48, borderRadius: '50%',
          background: T.gold, border: 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#000', cursor: 'pointer',
          boxShadow: '0 4px 20px rgba(212,175,55,0.40)',
          transition: 'transform 150ms ease',
        }}
        onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.06)'}
        onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
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
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setMobileOpen(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 150, backdropFilter: 'blur(4px)' }}
          />
          <motion.aside
            className="lg:hidden"
            initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            style={{
              position: 'fixed', top: 0, left: 0, bottom: 0,
              width: 260, zIndex: 160,
              display: 'flex', flexDirection: 'column',
              background: 'rgba(18,17,26,0.99)',
              borderRight: `1px solid ${T.border}`,
            }}
          >
            {/* LIRI header */}
            <div style={{
              padding: '16px 14px', borderBottom: `1px solid ${T.border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              flexShrink: 0,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 800, fontSize: 15 }}>
                <span style={{ color: T.t1 }}>L</span>
                <div style={{ width: 12, height: 12, borderRadius: '50%', background: 'linear-gradient(135deg,#7C3AED,#00E5FF)', flexShrink: 0 }}/>
                <span style={{ color: T.t1 }}>RI</span>
                <span style={{ fontFamily: T.mono, fontSize: 9, color: T.t3, marginLeft: 4 }}>{getActiveTenantBranding().name.toUpperCase()}</span>
              </div>
              <button onClick={() => setMobileOpen(false)}
                style={{ background: 'none', border: 'none', color: T.t3, cursor: 'pointer', padding: 4 }}>
                <IconClose/>
              </button>
            </div>

            <SidebarContent onNavClick={() => setMobileOpen(false)}/>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );

  return (
    <>
      {desktopSidebar}
      {mobileFab}
      {mobileDrawer}
    </>
  );
};

export default TeacherSchoolLifeSidebar;
