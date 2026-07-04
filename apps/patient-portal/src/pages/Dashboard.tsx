import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { User, FileText, Pill, Heart, BookOpen, Calendar } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:4002';

export function PatientDashboard() {
  const [stats, setStats] = useState({ notes: 0, prescriptions: 0, programs: 0 });

  useEffect(() => {
    const t = localStorage.getItem('supabase_token'); if (!t) return;
    const h = { Authorization: 'Bearer ' + t, 'X-Tenant-Slug': localStorage.getItem('tenant_slug') || '' };
    fetch(API + '/med/me/notes', { headers: h }).then(r => r.json()).then(d => setStats(s => ({ ...s, notes: (d.data||d||[]).length }))).catch(()=>{});
  }, []);

  const cards = [
    { icon: User, label: 'Mon dossier', to: '/records', color: '#3b82f6' },
    { icon: FileText, label: 'Notes', count: stats.notes, to: '/notes', color: 'var(--brand-accent)' },
    { icon: Pill, label: 'Ordonnances', to: '/prescriptions', color: '#f59e0b' },
    { icon: Heart, label: 'Suivi sante', to: '/health', color: '#ef4444' },
    { icon: BookOpen, label: 'Programmes', to: '/programs', color: '#8b5cf6' },
    { icon: Calendar, label: 'Prochain RDV', to: '/records', color: '#0ea5e9' },
  ];

  return (
    <div>
      <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24 }}>Bienvenue sur votre espace sante</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
        {cards.map(c => (
          <Link key={c.label} to={c.to} style={{ background: '#fff', borderRadius: 12, padding: 20, border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: 10, background: c.color + '15', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <c.icon size={20} color={c.color} />
            </div>
            <div><div style={{ fontSize: 22, fontWeight: 700 }}>{c.count ?? '-'}</div><div style={{ fontSize: 13, color: '#64748b' }}>{c.label}</div></div>
          </Link>
        ))}
      </div>
    </div>
  );
}
