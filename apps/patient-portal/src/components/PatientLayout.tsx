import { Outlet, Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  FileText,
  ClipboardList,
  Heart,
  BookOpen,
  Pill,
  MessageCircle,
  User,
  Brain,
  Calendar,
  Shield,
} from 'lucide-react';
import { useBranding } from '../lib/branding';

const nav = [
  { to: '/dashboard',     icon: LayoutDashboard, label: 'Accueil' },
  { to: '/records',       icon: User,            label: 'Mon dossier' },
  { to: '/appointments',  icon: Calendar,        label: 'Rendez-vous' },
  { to: '/notes',         icon: FileText,        label: 'Notes' },
  { to: '/charting-notes',icon: Brain,           label: 'Notes IA' },
  { to: '/prescriptions', icon: Pill,            label: 'Ordonnances' },
  { to: '/forms',         icon: ClipboardList,   label: 'Formulaires' },
  { to: '/health',        icon: Heart,           label: 'Suivi santé' },
  { to: '/programs',      icon: BookOpen,        label: 'Programmes' },
  { to: '/messages',      icon: MessageCircle,   label: 'Messages' },
  { to: '/privacy',       icon: Shield,          label: 'Confidentialité' },
];

// Strategy B — 95% tenant, 5% Cimolace. Sidebar background takes the tenant
// primary color directly. "MedOS" is no longer mentioned in the visible
// header — patient sees "Mon Espace · Cabinet Zahir" and a discrete footer
// "Sécurisé par Cimolace" at the very bottom (no logo, no link, just a
// trust badge).
export function PatientLayout() {
  const loc = useLocation();
  const branding = useBranding();

  // Derive a darker shade for active item background so it works regardless
  // of the brand color picked by the tenant. Quick hack: drop alpha to 0.6
  // over a 30% mix — using a pseudo overlay via background-blend.
  const sidebarBg = `var(--brand-primary)`;
  const sidebarActiveBg = `rgba(0,0,0,0.18)`;

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <aside
        style={{
          width: 240,
          background: sidebarBg,
          color: '#f0fdfa',
          padding: '20px 0',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            padding: '0 20px 16px',
            borderBottom: '1px solid rgba(255,255,255,0.15)',
            marginBottom: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          {branding.logoUrl && (
            <img
              src={branding.logoUrl}
              alt={branding.name}
              style={{
                width: 36, height: 36, borderRadius: 8, objectFit: 'contain',
                background: '#fff', padding: 2,
              }}
            />
          )}
          <div>
            <h1 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>
              Mon espace
            </h1>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)', marginTop: 2 }}>
              {branding.name}
            </p>
          </div>
        </div>

        <nav style={{ flex: 1 }}>
          {nav.map((item) => {
            const isActive = loc.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 20px',
                  background: isActive ? sidebarActiveBg : 'transparent',
                  color: isActive ? '#fff' : 'rgba(255,255,255,0.78)',
                  fontSize: 14,
                  fontWeight: 500,
                }}
              >
                <item.icon size={18} /> {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Discrete trust footer — Cimolace name only, no logo, no link */}
        <div
          style={{
            padding: '12px 20px',
            fontSize: 10,
            color: 'rgba(255,255,255,0.5)',
            borderTop: '1px solid rgba(255,255,255,0.1)',
            textAlign: 'center',
          }}
        >
          Sécurisé · Conforme RGPD
        </div>
      </aside>
      <main style={{ flex: 1, padding: 32, overflow: 'auto' }}>
        <Outlet />
      </main>
    </div>
  );
}
