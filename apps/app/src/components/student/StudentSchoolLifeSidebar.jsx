/**
 * StudentSchoolLifeSidebar — Charte LIRI Prorascience
 * Source design : /Downloads/interface studio/Prorascience Dashboard & Forum.html
 * Width: 220px · Gold active state · Violet/Cyan gradient avatar
 */
import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuth } from '@/contexts/SupabaseAuthContext';

/* ─── Tokens ─── */
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

/* ─── Nav items (flat, no sections) ─── */
const NAV = [
  { key: 'dashboard',           label: 'Tableau de bord',  icon: '◈', path: 'dashboard'  },
  { key: 'formations',          label: 'Mes Formations',   icon: '✦', path: 'formations' },
  { key: 'vie-scolaire',        label: 'Vie Scolaire',     icon: '◎', path: 'vie-scolaire' },
  { key: 'forum',               label: 'Forum',            icon: '◷', path: 'forum', badge: null },
  { key: 'bibliotheque',        label: 'Bibliothèque',     icon: '⊷', path: 'bibliotheque' },
  { key: 'bibliotheque-ressources', label: 'Ressources',   icon: '⊡', path: 'bibliotheque-ressources' },
  { key: 'agenda',              label: 'Agenda',           icon: '◉', path: 'agenda'     },
  { key: 'evaluations',         label: 'Évaluations',      icon: '⊛', path: 'evaluations' },
  { key: 'notes',               label: 'Notes & Résultats',icon: '◈', path: 'notes'      },
  { key: 'absences',            label: 'Absences',         icon: '!',  path: 'absences'   },
  { key: 'documents',           label: 'Documents',        icon: '⊡', path: 'documents'  },
  { key: 'profile',             label: 'Mon Profil',       icon: '⊙', path: 'profile'    },
];

/* ─── SVG Logout icon ─── */
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
      <span style={{ fontSize: 12, flexShrink: 0, opacity: isActive ? 1 : 0.6 }}>{item.icon}</span>
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {item.label}
      </span>
      {item.badge != null && (
        <div style={{
          fontFamily: T.mono, fontSize: 9, fontWeight: 700,
          background: T.violet, color: 'white',
          borderRadius: 20, padding: '1px 6px', flexShrink: 0,
        }}>{item.badge}</div>
      )}
    </button>
  );
};

/* ─── Sidebar content (shared desktop/mobile) ─── */
const SidebarContent = ({ onNavClick }) => {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const segments = location.pathname.split('/');
  const activeKey = segments[segments.length - 1] || 'dashboard';

  const fullName = user?.user_metadata?.full_name || user?.email || 'Élève';
  const initials = fullName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  const handleNav = (item) => {
    // Chemins ABSOLUS : `navigate('dashboard')` relatif s'empilait sur l'URL courante
    // (→ /student-school-life/dashboard/formations/dashboard → aucune route → page vide).
    navigate(`/student-school-life/${item.path}`);
    onNavClick?.();
  };

  const handleLogout = async () => {
    await signOut?.();
    navigate('/login');
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
              ESPACE DÉCOUVERTE
            </div>
          </div>
        </div>
        <div style={{
          marginTop: 8, fontFamily: T.mono, fontSize: 8,
          color: T.t3, letterSpacing: '0.10em',
          background: T.surface2, border: `1px solid ${T.border}`,
          borderRadius: 4, padding: '2px 6px', display: 'inline-block',
        }}>PROFIL ÉLÈVE</div>
      </div>

      {/* ── Nav ── */}
      <nav style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
        {NAV.map((item, i) => (
          <NavItem
            key={item.key}
            item={item}
            isActive={activeKey === item.key || (item.key === 'dashboard' && activeKey === 'student-school-life')}
            onClick={() => handleNav(item)}
            index={i}
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
const StudentSchoolLifeSidebar = () => {
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
          <div style={{ fontWeight: 700, fontSize: 12, color: T.t1, letterSpacing: '0.01em' }}>PRORASCIENCE</div>
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
                <span style={{ fontFamily: T.mono, fontSize: 9, color: T.t3, marginLeft: 4 }}>PRORASCIENCE</span>
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

export default StudentSchoolLifeSidebar;
