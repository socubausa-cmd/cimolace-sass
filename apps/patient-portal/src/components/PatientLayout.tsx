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
  Activity,
  Sparkles,
  GraduationCap,
} from 'lucide-react';
import { useBranding } from '../lib/branding';
import { NotificationBell } from './NotificationBell';

const nav = [
  { to: '/dashboard',     icon: LayoutDashboard, label: 'Accueil' },
  { to: '/records',       icon: User,            label: 'Mon dossier' },
  { to: '/appointments',  icon: Calendar,        label: 'Rendez-vous' },
  { to: '/notes',         icon: FileText,        label: 'Notes' },
  { to: '/charting-notes',icon: Brain,           label: 'Notes IA' },
  { to: '/prescriptions', icon: Pill,            label: 'Ordonnances' },
  { to: '/forms',         icon: ClipboardList,   label: 'Formulaires' },
  { to: '/health',        icon: Heart,           label: 'Suivi santé' },
  { to: '/sante/mon-corps', icon: Activity,      label: 'Mon corps' },
  { to: '/sante/precepteur', icon: GraduationCap, label: 'Précepteur santé' },
  { to: '/sante/assistant', icon: Sparkles,      label: 'Assistant santé' },
  { to: '/programs',      icon: BookOpen,        label: 'Programmes' },
  { to: '/messages',      icon: MessageCircle,   label: 'Messages' },
  { to: '/privacy',       icon: Shield,          label: 'Confidentialité' },
];

// Strategy B — 100% tenant, ZERO Cimolace/MEDOS visible to the patient.
// Sidebar background = tenant.brand_colors.primary. Header = "Mon espace"
// + tenant name. Footer is a generic trust badge ("Sécurisé · Conforme
// RGPD") with no attribution. The patient must believe they are on the
// tenant's own portal — no leak of the underlying infrastructure.
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

        {/* Generic trust footer — no Cimolace, no MEDOS, just a safety cue */}
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
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
        {/* Barre supérieure : cloche de notifications, présente sur chaque
            page authentifiée. Reste générique (aucune attribution). */}
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            padding: '16px 32px',
            borderBottom: '1px solid #e2e8f0',
            background: '#fff',
          }}
        >
          <NotificationBell />
        </header>
        <div style={{ flex: 1, padding: 32 }}>
          <Outlet />
        </div>
      </main>
    </div>
  );
}
