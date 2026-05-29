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

// Strategy C — MEDOS-first, tenant-co-branded (Figma-workspace model).
// The sidebar keeps the engine identity (MEDOS name + stethoscope icon) so
// a multi-tenant practitioner doesn't lose orientation when switching tenants.
// The tenant logo + name live in the header band, and the accent color
// flows from --brand-primary (tenant or MEDOS default).
export function Layout() {
  const loc = useLocation();
  const branding = useBranding();

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <aside style={{ width: 240, background: '#1e293b', color: '#e2e8f0', padding: '20px 0' }}>
        <div style={{ padding: '0 20px 16px', borderBottom: '1px solid #334155', marginBottom: 12 }}>
          {/* Engine identity — stays "MEDOS" regardless of tenant */}
          <h1 style={{ fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Stethoscope size={22} /> MedOS
          </h1>
          {/* Tenant co-branding — visible directly under the engine name so
              the practitioner sees which cabinet they're working in. */}
          <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #334155', display: 'flex', alignItems: 'center', gap: 8 }}>
            {branding.logoUrl ? (
              <img
                src={branding.logoUrl}
                alt={branding.name}
                style={{ width: 24, height: 24, borderRadius: 4, objectFit: 'contain', background: '#fff', padding: 2 }}
              />
            ) : (
              <span
                style={{
                  width: 24, height: 24, borderRadius: 4, background: 'var(--brand-primary)',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontSize: 11, fontWeight: 700,
                }}
              >
                {branding.name.slice(0, 1).toUpperCase()}
              </span>
            )}
            <span style={{ fontSize: 12, color: '#cbd5e1', fontWeight: 500 }}>{branding.name}</span>
          </div>
        </div>
        <nav>
          {nav.map((item) => {
            const isActive = loc.pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 20px',
                  background: isActive ? '#334155' : 'transparent',
                  color: isActive ? '#fff' : '#94a3b8',
                  fontSize: 14, fontWeight: 500,
                  borderLeft: isActive ? '3px solid var(--brand-primary)' : '3px solid transparent',
                }}
              >
                <item.icon size={18} /> {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <main style={{ flex: 1, padding: 32, overflow: 'auto' }}>
        <Outlet />
      </main>
    </div>
  );
}
