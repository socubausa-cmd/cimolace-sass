import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Users, FileText, Pill, ClipboardList, Activity } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:4002';

export function MedOSDashboard() {
  const [stats, setStats] = useState({ patients: 0, notes: 0, prescriptions: 0, forms: 0 });

  useEffect(() => {
    const token = localStorage.getItem('supabase_token');
    if (!token) return;
    // Fetch dashboard stats
    fetch(API + '/med/patients', { headers: { Authorization: 'Bearer ' + token, 'X-Tenant-Slug': localStorage.getItem('tenant_slug') || '' } })
      .then(r => r.json()).then(d => setStats(s => ({ ...s, patients: (d.data || d || []).length }))).catch(() => {});
  }, []);

  const cards = [
    { icon: Users, label: 'Patients', count: stats.patients, to: '/patients', color: '#3b82f6' },
    { icon: FileText, label: 'Notes SOAP', count: stats.notes, to: '/patients', color: '#10b981' },
    { icon: Pill, label: 'Ordonnances', count: stats.prescriptions, to: '/prescriptions', color: '#f59e0b' },
    { icon: ClipboardList, label: 'Formulaires', count: stats.forms, to: '/forms', color: '#8b5cf6' },
  ];

  return (
    <div>
      <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24 }}>Dashboard MedOS</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
        {cards.map(c => (
          <Link key={c.label} to={c.to} style={{ background: '#fff', borderRadius: 12, padding: 20, border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: 10, background: c.color + '15', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <c.icon size={20} color={c.color} />
            </div>
            <div><div style={{ fontSize: 22, fontWeight: 700 }}>{c.count}</div><div style={{ fontSize: 13, color: '#64748b' }}>{c.label}</div></div>
          </Link>
        ))}
      </div>
      <div style={{ marginTop: 32, background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: 24 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Actions rapides</h3>
        <div style={{ display: 'flex', gap: 12 }}>
          <Link to="/patients" style={{ padding: '10px 20px', background: '#3b82f6', color: '#fff', borderRadius: 8, fontSize: 14, fontWeight: 500 }}>+ Nouveau patient</Link>
          <Link to="/patients" style={{ padding: '10px 20px', background: '#10b981', color: '#fff', borderRadius: 8, fontSize: 14, fontWeight: 500 }}>+ Note SOAP</Link>
          <Link to="/prescriptions" style={{ padding: '10px 20px', background: '#f59e0b', color: '#fff', borderRadius: 8, fontSize: 14, fontWeight: 500 }}>+ Ordonnance</Link>
        </div>
      </div>
    </div>
  );
}
