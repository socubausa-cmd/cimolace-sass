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
    { icon: User, label: 'Mon dossier', to: '/records' },
    { icon: FileText, label: 'Notes', count: stats.notes, to: '/notes' },
    { icon: Pill, label: 'Ordonnances', to: '/prescriptions' },
    { icon: Heart, label: 'Suivi sante', to: '/health' },
    { icon: BookOpen, label: 'Programmes', to: '/programs' },
    { icon: Calendar, label: 'Prochain RDV', to: '/records' },
  ];

  return (
    <div>
      <h2 style={{ fontSize: 30, fontWeight: 600, marginBottom: 24 }}>Bienvenue sur votre espace sante</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
        {cards.map(c => (
          <Link key={c.label} to={c.to} style={{ background: '#fff', borderRadius: 12, padding: 20, border: '1px solid #ece7e1', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: 10, background: 'var(--brand-primary-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <c.icon size={20} color="var(--brand-primary)" />
            </div>
            <div><div style={{ fontSize: 22, fontWeight: 700 }}>{c.count ?? '-'}</div><div style={{ fontSize: 13, color: '#8a8580' }}>{c.label}</div></div>
          </Link>
        ))}
      </div>
    </div>
  );
}
