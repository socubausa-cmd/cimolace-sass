import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { User, FileText, Pill, Heart, BookOpen, Calendar, ClipboardList } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:4002';

interface AssignmentRow {
  status: string;
  form_id: string;
}

export function PatientDashboard() {
  const [stats, setStats] = useState({ notes: 0, prescriptions: 0, programs: 0 });
  const [pendingForms, setPendingForms] = useState<number>(0);

  useEffect(() => {
    const t = localStorage.getItem('supabase_token'); if (!t) return;
    const h = { Authorization: 'Bearer ' + t, 'X-Tenant-Slug': localStorage.getItem('tenant_slug') || '' };
    fetch(API + '/med/me/notes', { headers: h }).then(r => r.json()).then(d => setStats(s => ({ ...s, notes: (d.data||d||[]).length }))).catch(()=>{});
    // G5 — Tâches en attente : lit /med/me/assignments et compte les status=pending
    fetch(API + '/med/me/assignments', { headers: h })
      .then(r => (r.ok ? r.json() : { data: [] }))
      .then(d => {
        const rows = (d.data || d || []) as AssignmentRow[];
        setPendingForms(rows.filter(a => a.status === 'pending').length);
      })
      .catch(() => {});
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

      {/* G5 — Bannière tâches en attente (formulaires à remplir). Placée en tête pour
          visibilité maximale ; masquée si 0. */}
      {pendingForms > 0 && (
        <Link
          to="/forms"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            background: 'var(--brand-primary-soft, #fff4f5)',
            border: '1px solid var(--brand-primary, #6d2e46)',
            borderRadius: 12,
            padding: '16px 20px',
            marginBottom: 20,
            textDecoration: 'none',
            color: 'inherit',
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              background: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <ClipboardList size={22} color="var(--brand-primary, #6d2e46)" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--brand-primary, #6d2e46)' }}>
              {pendingForms === 1
                ? '1 formulaire à remplir'
                : `${pendingForms} formulaires à remplir`}
            </div>
            <div style={{ fontSize: 13, color: '#6f5c64', marginTop: 2 }}>
              Votre praticien attend vos réponses pour préparer votre suivi.
            </div>
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--brand-primary, #6d2e46)' }}>
            Ouvrir →
          </div>
        </Link>
      )}

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
