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
} from 'lucide-react';
import { useBranding } from '../lib/branding';

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

// Co-branding — tenant-first when a tenant brand is resolved, MEDOS-default
// otherwise. Once a tenant brand loads (name ≠ engine default), the tenant
// (logo + name) becomes the primary sidebar identity and the MEDOS engine name
// is demoted to a discreet footer attribution — so an embedded practitioner
// surface (e.g. inside zahirwellness.com) reads as a native section, not a
// third-party tool. With no tenant context, the MEDOS engine identity stays.
// Accent color always flows from --brand-primary (tenant brand_colors).
export function Layout() {
  const loc = useLocation();
  const branding = useBranding();
  const hasTenantBrand = !branding.loading && branding.name !== 'MEDOS';

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <aside style={{ width: 240, background: 'var(--zw-side-bg)', color: 'var(--zw-side-text)', padding: '20px 0', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '0 20px 16px', borderBottom: '1px solid var(--zw-side-border)', marginBottom: 12 }}>
          {branding.loading ? (
            /* Reserve space while branding resolves — avoids a MEDOS→tenant flash. */
            <div style={{ height: 30 }} />
          ) : hasTenantBrand ? (
            /* Tenant-first identity — the cabinet's own brand leads (serif via theme). */
            <h1 style={{ fontSize: 19, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10, margin: 0, lineHeight: 1.2 }}>
              {branding.logoUrl ? (
                <img
                  src={branding.logoUrl}
                  alt={branding.name}
                  style={{ width: 30, height: 30, borderRadius: 7, objectFit: 'contain', background: '#fff', padding: 2, flexShrink: 0 }}
                />
              ) : (
                <span
                  style={{
                    width: 30, height: 30, borderRadius: 7, background: 'var(--zw-side-accent)',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontSize: 13, fontWeight: 700, flexShrink: 0,
                  }}
                >
                  {branding.name.slice(0, 1).toUpperCase()}
                </span>
              )}
              <span>{branding.name}</span>
            </h1>
          ) : (
            /* Engine default — no tenant brand resolved. */
            <h1 style={{ fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
              <Stethoscope size={22} /> MedOS
            </h1>
          )}
        </div>
        <nav style={{ flex: 1 }}>
          {nav.map((item) => {
            const isActive = loc.pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
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
            <Stethoscope size={13} /> Propulsé par MedOS
          </div>
        )}
      </aside>
      <main style={{ flex: 1, padding: 32, overflow: 'auto' }}>
        <Outlet />
      </main>
    </div>
  );
}
