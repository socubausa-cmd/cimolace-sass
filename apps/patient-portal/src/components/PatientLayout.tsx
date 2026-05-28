import { Outlet, Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, FileText, ClipboardList, Heart, BookOpen, Pill, MessageCircle, User, Brain, Calendar, Shield } from 'lucide-react';

const nav = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Accueil' },
  { to: '/records', icon: User, label: 'Mon dossier' },
  { to: '/appointments', icon: Calendar, label: 'Rendez-vous' },
  { to: '/notes', icon: FileText, label: 'Notes' },
  { to: '/charting-notes', icon: Brain, label: 'Notes IA' },
  { to: '/prescriptions', icon: Pill, label: 'Ordonnances' },
  { to: '/forms', icon: ClipboardList, label: 'Formulaires' },
  { to: '/health', icon: Heart, label: 'Suivi sante' },
  { to: '/programs', icon: BookOpen, label: 'Programmes' },
  { to: '/messages', icon: MessageCircle, label: 'Messages' },
  { to: '/privacy', icon: Shield, label: 'Confidentialite' },
];

export function PatientLayout() {
  const loc = useLocation();
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <aside style={{ width: 240, background: '#0f766e', color: '#ccfbf1', padding: '20px 0' }}>
        <div style={{ padding: '0 20px 20px', borderBottom: '1px solid #115e59', marginBottom: 12 }}>
          <h1 style={{ fontSize: 18, fontWeight: 700 }}>Mon Espace</h1>
          <p style={{ fontSize: 11, color: '#5eead4', marginTop: 4 }}>Portail patient MedOS</p>
        </div>
        <nav>
          {nav.map(item => (
            <Link key={item.to} to={item.to} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '10px 20px',
              background: loc.pathname === item.to ? '#115e59' : 'transparent',
              color: loc.pathname === item.to ? '#fff' : '#99f6e4', fontSize: 14, fontWeight: 500,
            }}><item.icon size={18} /> {item.label}</Link>
          ))}
        </nav>
      </aside>
      <main style={{ flex: 1, padding: 32, overflow: 'auto' }}><Outlet /></main>
    </div>
  );
}
