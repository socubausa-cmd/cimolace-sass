/**
 * LiriDashboardShell — shell d'administration au langage du back-office élève.
 *
 * Référence (qui fait autorité) : StudentSchoolLifeSidebar + StudentSchoolLifePage
 * (« Prorascience Dashboard & Forum.html »). Sidebar flottante en verre, repliable
 * en mode icônes (220 ↔ 64px) avec bouton tiroir, logo LIRI violet→cyan, item actif
 * accentué + filet latéral, contenu décalé/centré.
 *
 * Réutilisable : Owner / Secrétariat / Admin passent leur nav groupée + leur accent.
 *
 * Props :
 *  - navGroups : [{ section, items:[{ id, label, icon, href? }] }]
 *  - activeTab, onTabChange(id), onNavigate(href)
 *  - accent : { color, dim, mid }   (violet owner / or secrétariat)
 *  - brandTitle, brandSubtitle
 *  - user, onLogout
 *  - title (titre courant), topbarRight (ex. cloche notifications)
 *  - autoCollapse (ex. forum) — réduit la sidebar, l'utilisateur peut surcharger
 *  - lightContent (défaut false) — passe SEULEMENT la zone de contenu (main + topbar)
 *    en mode clair (palette partagée Wix-like). La sidebar LORI reste sombre/or.
 */
import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useShellTint } from '../../lib/useShellTint';

/* ─── Tokens (référence student-school-life) ─── */
const T = {
  bg: '#0B0B0F',
  panel: 'rgba(18,17,26,0.97)',
  surface2: '#192734',
  border: 'rgba(255,255,255,0.07)',
  borderMid: 'rgba(255,255,255,0.12)',
  t1: '#F5F5F7',
  t2: 'rgba(245,245,247,0.65)',
  t3: 'rgba(245,245,247,0.38)',
  violet: '#7C3AED',
  cyan: '#00E5FF',
  danger: '#EF4444',
  mono: "'JetBrains Mono','Fira Code',monospace",
};

/* ─── Palette CLAIRE partagée (inspirée Wix Studio) — affecte SEULEMENT le contenu central. ─── */
const L = {
  canvas: '#F4EFE3',                 // fond crème (réf utilisateur) — cf. .liri-light-content dans liri-brand-theme.css
  card: '#FFFFFF',                   // surfaces/cartes
  cardBorder: 'rgba(0,0,0,0.08)',    // bord 1px des cartes
  cardShadow: '0 1px 3px rgba(0,0,0,0.06)',
  t1: '#18181B',                     // texte primaire
  t2: '#52525B',                     // texte secondaire
  t3: '#71717A',                     // texte atténué
  topbar: '#FFFFFF',
  topbarBorder: 'rgba(0,0,0,0.08)',
};

const DEFAULT_ACCENT = { color: '#7C3AED', dim: 'rgba(124,58,237,0.12)', mid: 'rgba(124,58,237,0.28)' };

/* ─── Icônes ─── */
const IconChevron = ({ collapsed }) => (
  <svg viewBox="0 0 20 20" width={16} height={16} fill="none" style={{ transform: collapsed ? 'rotate(180deg)' : 'none', transition: 'transform 150ms ease' }}>
    <path d="M12 5l-5 5 5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IconMenu = () => (
  <svg viewBox="0 0 20 20" width={18} height={18} fill="none">
    <line x1="3" y1="6" x2="17" y2="6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <line x1="3" y1="10" x2="17" y2="10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <line x1="3" y1="14" x2="17" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);
const IconClose = () => (
  <svg viewBox="0 0 20 20" width={18} height={18} fill="none">
    <line x1="5" y1="5" x2="15" y2="15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <line x1="15" y1="5" x2="5" y2="15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);
const IconLogout = () => (
  <svg viewBox="0 0 20 20" width={14} height={14} fill="none">
    <path d="M14 8l3 3-3 3M7 11h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M11 5H5a1 1 0 00-1 1v10a1 1 0 001 1h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);
const IconSun = () => (
  <svg viewBox="0 0 20 20" width={17} height={17} fill="none">
    <circle cx="10" cy="10" r="3.4" stroke="currentColor" strokeWidth="1.5" />
    <path d="M10 2.4v2.2M10 15.4v2.2M2.4 10h2.2M15.4 10h2.2M4.9 4.9l1.5 1.5M13.6 13.6l1.5 1.5M15.1 4.9l-1.5 1.5M6.4 13.6l-1.5 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);
const IconMoon = () => (
  <svg viewBox="0 0 20 20" width={17} height={17} fill="none">
    <path d="M10 2.5a5 5 0 0 0 7.5 7.5 7.5 7.5 0 1 1-7.5-7.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
  </svg>
);

/* ─── LIRI logo ─── */
const LiriBrand = ({ title, subtitle }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontWeight: 800, fontSize: 15, letterSpacing: '-0.02em' }}>
      <span style={{ color: T.t1 }}>L</span>
      <div style={{ width: 12, height: 12, borderRadius: '50%', background: `linear-gradient(135deg,${T.violet},${T.cyan})`, flexShrink: 0, position: 'relative', top: -1, boxShadow: '0 0 8px rgba(124,58,237,0.5)' }} />
      <span style={{ color: T.t1 }}>RI</span>
    </div>
    <div style={{ width: 1, height: 16, background: T.border }} />
    <div>
      <div style={{ fontWeight: 700, fontSize: 12, color: T.t1, letterSpacing: '0.01em' }}>{title}</div>
      <div style={{ fontFamily: T.mono, fontSize: 7, color: T.t3, letterSpacing: '0.12em' }}>{subtitle}</div>
    </div>
  </div>
);

/* ─── Item de navigation ─── */
const NavItem = ({ item, isActive, accent, onClick, index, collapsed }) => {
  const [hov, setHov] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      title={collapsed ? item.label : undefined}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 9,
        justifyContent: collapsed ? 'center' : 'flex-start',
        padding: collapsed ? '9px 0' : '7px 10px', borderRadius: 8,
        background: isActive ? accent.dim : hov ? T.surface2 : 'none',
        border: `1px solid ${isActive ? accent.mid : 'transparent'}`,
        color: isActive ? accent.color : hov ? T.t1 : T.t2,
        fontWeight: isActive ? 600 : 400, fontSize: 12.5,
        textAlign: 'left', cursor: 'pointer',
        transition: 'all 150ms cubic-bezier(0.4,0,0.2,1)', position: 'relative',
        animation: `liriShellSlideIn 0.28s ease ${index * 22}ms both`,
      }}
    >
      {isActive && (
        <div style={{ position: 'absolute', left: 0, top: '25%', bottom: '25%', width: 2, borderRadius: '0 2px 2px 0', background: accent.color }} />
      )}
      <span style={{ fontSize: collapsed ? 18 : 15, flexShrink: 0, opacity: isActive ? 1 : 0.62, display: 'inline-flex' }}>
        {typeof item.icon === 'string'
          ? item.icon
          : item.icon
            ? React.createElement(item.icon, { size: collapsed ? 18 : 16 })
            : null}
      </span>
      {!collapsed && (
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</span>
      )}
      {!collapsed && item.badge != null && (
        <div style={{ fontFamily: T.mono, fontSize: 9, fontWeight: 700, background: T.violet, color: '#fff', borderRadius: 20, padding: '1px 6px', flexShrink: 0 }}>{item.badge}</div>
      )}
    </button>
  );
};

/* ─── Contenu de la sidebar (nav groupée + footer user) ─── */
const SidebarBody = ({ navGroups, activeTab, accent, collapsed, onItem, user, onLogout }) => {
  const displayName = (user?.name && String(user.name).trim()) || user?.email?.split('@')[0] || 'Compte';
  return (
    <>
      <nav className="no-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: collapsed ? '10px 8px' : '10px 12px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {navGroups.map((group, gi) => (
          <div key={group.section || gi} style={{ marginTop: gi === 0 ? 0 : collapsed ? 8 : 12 }}>
            {!collapsed && group.section && (
              <div style={{ padding: '4px 10px 5px', fontSize: 10.5, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: T.t3 }}>{group.section}</div>
            )}
            {collapsed && gi > 0 && (
              <div style={{ height: 1, background: T.border, margin: '8px auto 8px', width: 22 }} />
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {group.items.map((item, idx) => (
                <NavItem key={item.id} item={item} isActive={activeTab === item.id} accent={accent} collapsed={collapsed} index={idx} onClick={() => onItem(item)} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer user + logout */}
      <div style={{ borderTop: `1px solid ${T.border}`, padding: collapsed ? '10px 0' : '10px 12px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'space-between', gap: 8 }}>
        {!collapsed && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, overflow: 'hidden' }}>
            <div style={{ width: 30, height: 30, borderRadius: '50%', background: `linear-gradient(135deg,${T.violet},${T.cyan})`, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12, fontWeight: 700 }}>
              {displayName.charAt(0).toUpperCase()}
            </div>
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: T.t1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName}</div>
              <div style={{ fontSize: 10, color: T.t3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.email}</div>
            </div>
          </div>
        )}
        <button type="button" onClick={onLogout} aria-label="Se déconnecter" title="Se déconnecter"
          style={{ background: 'none', border: `1px solid ${T.border}`, borderRadius: 8, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.danger, cursor: 'pointer', flexShrink: 0 }}>
          <IconLogout />
        </button>
      </div>
    </>
  );
};

export default function LiriDashboardShell({
  navGroups = [], activeTab, onTabChange, onNavigate,
  accent = DEFAULT_ACCENT, brandTitle = 'PRORASCIENCE', brandSubtitle = 'ADMIN',
  user, onLogout, title, topbarRight = null, autoCollapse = false, lightContent = false, children,
}) {
  const [collapsed, setCollapsed] = useState(autoCollapse);
  const [mobileOpen, setMobileOpen] = useState(false);
  const userOverride = useRef(false);

  // Auto-repli (ex. forum) tant que l'utilisateur n'a pas forcé via le bouton tiroir.
  useEffect(() => {
    if (!userOverride.current) setCollapsed(autoCollapse);
  }, [autoCollapse]);

  const toggle = () => { userOverride.current = true; setCollapsed((c) => !c); };

  // Teinte de la zone de contenu : crème (« light ») ou sombre historique (« dark »), basculable.
  // Le bouton n'apparaît que sur les surfaces light-capable (prop lightContent). La sidebar reste sombre.
  const [tint, toggleTint] = useShellTint();
  const isLight = lightContent && tint === 'light';

  const onItem = (item) => {
    if (item.href) onNavigate?.(item.href);
    else onTabChange?.(item.id);
    setMobileOpen(false);
  };

  const ToggleBtn = (
    <button type="button" onClick={toggle} title={collapsed ? 'Étendre le menu' : 'Réduire le menu'} aria-label={collapsed ? 'Étendre le menu' : 'Réduire le menu'}
      style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 8, width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.t2, cursor: 'pointer', flexShrink: 0 }}>
      <IconChevron collapsed={collapsed} />
    </button>
  );

  return (
    <div style={{ minHeight: '100dvh', background: T.bg, display: 'flex' }}>
      <style>{`@keyframes liriShellSlideIn{from{opacity:0;transform:translateX(-6px)}to{opacity:1;transform:none}}
        .no-scrollbar::-webkit-scrollbar{display:none}.no-scrollbar{scrollbar-width:none}`}</style>

      {/* Sidebar flottante (desktop) */}
      <aside className="hidden lg:flex" style={{
        // top: 96 → passe SOUS le header global (« Mon École », 89px fixe) au lieu d'être caché dessous.
        position: 'fixed', top: 96, left: 14, bottom: 14, width: collapsed ? 64 : 220, zIndex: 50,
        flexDirection: 'column', background: T.panel, border: `1px solid ${T.border}`, borderRadius: 18,
        backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', overflow: 'hidden',
        boxShadow: '0 16px 48px -16px rgba(0,0,0,0.55)', transition: 'width 200ms cubic-bezier(0.4,0,0.2,1)',
      }}>
        <div style={{ padding: collapsed ? '14px 0 12px' : '14px 14px 12px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'space-between', gap: 8, flexShrink: 0 }}>
          {collapsed ? ToggleBtn : (<><LiriBrand title={brandTitle} subtitle={brandSubtitle} />{ToggleBtn}</>)}
        </div>
        <SidebarBody navGroups={navGroups} activeTab={activeTab} accent={accent} collapsed={collapsed} onItem={onItem} user={user} onLogout={onLogout} />
      </aside>

      {/* FAB mobile */}
      <div className="lg:hidden" style={{ position: 'fixed', bottom: 24, right: 20, zIndex: 200 }}>
        <button type="button" onClick={() => setMobileOpen((o) => !o)} aria-label="Menu"
          style={{ width: 48, height: 48, borderRadius: '50%', background: accent.color, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', cursor: 'pointer', boxShadow: `0 4px 20px ${accent.mid}` }}>
          {mobileOpen ? <IconClose /> : <IconMenu />}
        </button>
      </div>

      {/* Drawer mobile */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div className="lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
              onClick={() => setMobileOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 150, backdropFilter: 'blur(4px)' }} />
            <motion.aside className="lg:hidden" initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }} transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              style={{ position: 'fixed', top: 0, left: 0, bottom: 0, width: 264, zIndex: 160, display: 'flex', flexDirection: 'column', background: 'rgba(18,17,26,0.99)', borderRight: `1px solid ${T.border}` }}>
              <div style={{ padding: '16px 14px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                <LiriBrand title={brandTitle} subtitle={brandSubtitle} />
                <button type="button" onClick={() => setMobileOpen(false)} aria-label="Fermer" style={{ background: 'none', border: 'none', color: T.t2, cursor: 'pointer' }}><IconClose /></button>
              </div>
              <SidebarBody navGroups={navGroups} activeTab={activeTab} accent={accent} collapsed={false} onItem={onItem} user={user} onLogout={onLogout} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Contenu */}
      <main style={{ flex: 1, overflowX: 'hidden', minHeight: '100dvh', background: isLight ? L.canvas : 'transparent' }} className={`${lightContent ? (isLight ? 'liri-light-content ' : 'liri-dark-content ') : ''}${collapsed ? 'lg:pl-[92px]' : 'lg:pl-[250px]'}`}>
        <header style={isLight
          ? { position: 'sticky', top: 0, zIndex: 30, height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '0 24px', background: L.topbar, borderBottom: `1px solid ${L.topbarBorder}` }
          : { position: 'sticky', top: 0, zIndex: 30, height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '0 24px', background: 'rgba(11,11,15,0.72)', backdropFilter: 'blur(12px)', borderBottom: `1px solid ${T.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            <button type="button" className="lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Ouvrir le menu" style={{ background: 'none', border: 'none', color: isLight ? L.t2 : T.t2, cursor: 'pointer' }}><IconMenu /></button>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: isLight ? L.t1 : T.t1, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</h2>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            {lightContent && (
              <button
                type="button"
                onClick={toggleTint}
                aria-label={isLight ? 'Passer au thème sombre' : 'Passer au thème crème'}
                title={isLight ? 'Thème sombre' : 'Thème crème'}
                style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  width: 40, height: 40, borderRadius: 11, cursor: 'pointer', flexShrink: 0,
                  background: isLight ? '#FFFFFF' : 'rgba(255,255,255,0.06)',
                  border: `1px solid ${isLight ? L.cardBorder : T.border}`,
                  color: isLight ? L.t2 : T.t2,
                  transition: 'background 150ms ease, color 150ms ease, border-color 150ms ease',
                }}
              >
                {isLight ? <IconMoon /> : <IconSun />}
              </button>
            )}
            {topbarRight}
          </div>
        </header>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '20px 20px 40px' }}>
          {isLight ? (
            // Mode clair (crème) : pas de panneau sombre. Conteneur transparent — les enfants
            // fournissent leurs propres cartes blanches (palette L partagée).
            <div style={{ minHeight: 440 }}>
              {children}
            </div>
          ) : (
            // Cadre contenant (comme l'ancien premium-panel) : regroupe le contenu
            // au lieu de l'éparpiller sur le fond nu. Bordure subtile, fond léger.
            <div style={{ background: 'rgba(255,255,255,0.018)', border: `1px solid ${T.border}`, borderRadius: 20, padding: '20px 22px', minHeight: 440 }}>
              {children}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
