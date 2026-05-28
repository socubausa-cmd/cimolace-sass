import { Outlet, Link, useLocation } from 'react-router-dom';
import { Stethoscope, Users, FileText, Pill, ClipboardList, Heart, BookOpen, LayoutDashboard, Mic, MessageCircle } from 'lucide-react';

const nav = [
  { to: '/dashboard',  icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/patients',   icon: Users,           label: 'Patients' },
  { to: '/charting',   icon: Mic,             label: 'Consultation IA' },
  { to: '/prescriptions', icon: Pill,         label: 'Ordonnances' },
  { to: '/forms',      icon: ClipboardList,   label: 'Formulaires' },
  { to: '/health',     icon: Heart,           label: 'Suivi santé' },
  { to: '/programs',   icon: BookOpen,        label: 'Programmes' },
  { to: '/messages',   icon: MessageCircle,   label: 'Messages' },
];

export function Layout() {
  const loc = useLocation();
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <aside style={{ width: 240, background: '#1e293b', color: '#e2e8f0', padding: '20px 0' }}>
        <div style={{ padding: '0 20px 20px', borderBottom: '1px solid #334155', marginBottom: 12 }}>
          <h1 style={{ fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Stethoscope size={22} /> MedOS
          </h1>
          <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>Cabinet medical</p>
        </div>
        <nav>
          {nav.map(item => (
            <Link key={item.to} to={item.to} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '10px 20px',
              background: loc.pathname.startsWith(item.to) ? '#334155' : 'transparent',
              color: loc.pathname.startsWith(item.to) ? '#fff' : '#94a3b8',
              fontSize: 14, fontWeight: 500,
            }}>
              <item.icon size={18} /> {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <main style={{ flex: 1, padding: 32, overflow: 'auto' }}>
        <Outlet />
      </main>
    </div>
  );
}
