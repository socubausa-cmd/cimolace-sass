import { useEffect, useState, type CSSProperties } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import {
  Stethoscope,
  Users,
  Pill,
  ClipboardList,
  Heart,
  BookOpen,
  LayoutDashboard,
  Mic,
  MessageCircle,
  Calendar,
  Shield,
  Menu,
  X,
} from 'lucide-react';
import { useBranding } from '../lib/branding';
import { NotificationBell } from './NotificationBell';

const nav = [
  { to: '/dashboard',     icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/patients',      icon: Users,           label: 'Patients' },
  { to: '/appointments',  icon: Calendar,        label: 'Rendez-vous' },
  { to: '/charting',      icon: Mic,             label: 'Consultation IA' },
  { to: '/prescriptions', icon: Pill,            label: 'Ordonnances' },
  { to: '/forms',         icon: ClipboardList,   label: 'Formulaires' },
  { to: '/health',        icon: Heart,           label: 'Suivi santé' },
  { to: '/programs',      icon: BookOpen,        label: 'Programmes' },
  { to: '/messages',      icon: MessageCircle,   label: 'Messages' },
  { to: '/audit',         icon: Shield,          label: 'Audit & RGPD' },
];

/** Vrai quand le viewport est en format téléphone/tablette étroite (≤ 820px). */
function useIsMobile(): boolean {
  const q = '(max-width: 820px)';
  const [m, setM] = useState(
    typeof window !== 'undefined' ? window.matchMedia(q).matches : false,
  );
  useEffect(() => {
    const mq = window.matchMedia(q);
    const on = () => setM(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return m;
}

// Co-branding — tenant-first when a tenant brand is resolved, MEDOS-default
// otherwise. Once a tenant brand loads (name ≠ engine default), the tenant
// (logo + name) becomes the primary sidebar identity and the MEDOS engine name
// is demoted to a discreet footer attribution — so an embedded practitioner
// surface (e.g. inside zahirwellness.com) reads as a native section, not a
// third-party tool. With no tenant context, the MEDOS engine identity stays.
// Accent color always flows from --brand-primary (tenant brand_colors).
//
// RESPONSIVE — sur mobile (≤820px) la sidebar 240px fixe écrasait le contenu ;
// elle devient un DRAWER (caché par défaut, ouvert via le bouton hamburger de
// la barre du haut, refermé au clic sur l'overlay ou à chaque navigation), et
// le contenu prend toute la largeur.
export function Layout() {
  const loc = useLocation();
  const branding = useBranding();
  const hasTenantBrand = !branding.loading && branding.name !== 'Nganga';
  const isMobile = useIsMobile();
  const [menuOpen, setMenuOpen] = useState(false);

  // Ferme le drawer à chaque changement de page + quand on repasse desktop.
  useEffect(() => {
    setMenuOpen(false);
  }, [loc.pathname]);
  useEffect(() => {
    if (!isMobile) setMenuOpen(false);
  }, [isMobile]);

  const asideBase: CSSProperties = {
    background: 'var(--zw-side-bg)',
    color: 'var(--zw-side-text)',
    padding: '20px 0',
    display: 'flex',
    flexDirection: 'column',
  };
  const asideStyle: CSSProperties = isMobile
    ? {
        ...asideBase,
        position: 'fixed',
        top: 0,
        left: 0,
        bottom: 0,
        width: 264,
        maxWidth: '82vw',
        zIndex: 1000,
        transform: menuOpen ? 'translateX(0)' : 'translateX(-100%)',
        transition: 'transform .25s ease',
        boxShadow: menuOpen ? '6px 0 30px rgba(0,0,0,0.45)' : 'none',
        overflowY: 'auto',
      }
    : { ...asideBase, width: 240, flexShrink: 0 };

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {isMobile && menuOpen && (
        <div
          onClick={() => setMenuOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 999 }}
          aria-hidden="true"
        />
      )}
      <aside style={asideStyle}>
        <div style={{ padding: '0 20px 16px', borderBottom: '1px solid var(--zw-side-border)', marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          {branding.loading ? (
            /* Reserve space while branding resolves — avoids a MEDOS→tenant flash. */
            <div style={{ height: 30, flex: 1 }} />
          ) : hasTenantBrand ? (
            /* Tenant-first — mirrors the Zahir admin brand block: logo in a white
               rounded tile + serif name + small subtitle. */
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
              <span style={{ width: 44, height: 44, borderRadius: 12, background: '#fff', display: 'grid', placeItems: 'center', flexShrink: 0, padding: 5, boxSizing: 'border-box' }}>
                {branding.logoUrl ? (
                  <img src={branding.logoUrl} alt={branding.name} style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
                ) : (
                  <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--zw-side-accent)' }}>{branding.name.slice(0, 1).toUpperCase()}</span>
                )}
              </span>
              <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1, minWidth: 0 }}>
                <b style={{ fontFamily: 'var(--zw-font-display)', fontWeight: 600, fontSize: 16, letterSpacing: '0.02em', color: 'var(--zw-side-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{branding.name}</b>
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.04em', marginTop: 2, color: 'var(--zw-side-accent)' }}>Espace praticien</span>
              </span>
            </div>
          ) : (
            /* Engine default — no tenant brand resolved. */
            <h1 style={{ fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
              <Stethoscope size={22} /> Nganga
            </h1>
          )}
          {isMobile && (
            <button
              onClick={() => setMenuOpen(false)}
              aria-label="Fermer le menu"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, borderRadius: 8, border: 'none', background: 'transparent', color: 'var(--zw-side-text-dim)', cursor: 'pointer', flexShrink: 0 }}
            >
              <X size={20} />
            </button>
          )}
        </div>
        <nav style={{ flex: 1 }}>
          {nav.map((item) => {
            const isActive = loc.pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setMenuOpen(false)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 20px',
                  background: isActive ? 'var(--zw-side-active-bg)' : 'transparent',
                  color: isActive ? '#fff' : 'var(--zw-side-text-dim)',
                  fontSize: 14, fontWeight: 500,
                  borderLeft: isActive ? '3px solid var(--zw-side-accent)' : '3px solid transparent',
                }}
              >
                <item.icon size={18} /> {item.label}
              </Link>
            );
          })}
        </nav>
        {hasTenantBrand && (
          /* Discreet engine attribution — honest co-brand without the loud wordmark. */
          <div style={{ padding: '14px 20px 0', margin: '12px 0 0', borderTop: '1px solid var(--zw-side-border)', fontSize: 11, color: 'var(--zw-side-text-dim)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Stethoscope size={13} /> Propulsé par Nganga
          </div>
        )}
      </aside>
      <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
        {/* Topbar praticien — hamburger (mobile) à gauche, cloche à droite. */}
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            padding: isMobile ? '10px 14px' : '14px 32px',
            borderBottom: '1px solid var(--zw-border)',
            background: 'var(--zw-bg, #fff)',
            flexShrink: 0,
          }}
        >
          {isMobile ? (
            <button
              onClick={() => setMenuOpen(true)}
              aria-label="Ouvrir le menu"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 42, height: 42, borderRadius: 10, border: '1px solid var(--zw-border)', background: '#fff', color: 'var(--zw-text, #1e1e1e)', cursor: 'pointer', flexShrink: 0 }}
            >
              <Menu size={22} />
            </button>
          ) : (
            <span />
          )}
          <NotificationBell />
        </header>
        <div style={{ flex: 1, padding: isMobile ? 16 : 32, minWidth: 0 }}>
          <Outlet />
        </div>
      </main>
    </div>
  );
}
