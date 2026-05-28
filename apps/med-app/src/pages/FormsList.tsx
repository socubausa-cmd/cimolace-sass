import { useState, useEffect } from 'react';
import { ClipboardList, Plus } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:4002';

export function FormsList() {
  const [forms, setForms] = useState<any[]>([]);

  useEffect(() => {
    const token = localStorage.getItem('supabase_token');
    if (!token) return;
    fetch(API + '/med/forms', { headers: { Authorization: 'Bearer ' + token, 'X-Tenant-Slug': localStorage.getItem('tenant_slug') || '' } })
      .then(r => r.json()).then(d => setForms(d.data || d || [])).catch(() => {});
  }, []);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ fontSize: 24, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}><ClipboardList size={22} /> Formulaires medicaux</h2>
        <button style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px', background: '#8b5cf6', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>
          <Plus size={16} /> Nouveau formulaire
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
        {forms.map((f: any) => (
          <div key={f.id} style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: 20 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600 }}>{f.title}</h3>
            <p style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>{f.description || 'Formulaire medical'}</p>
            <span style={{ display: 'inline-block', marginTop: 8, fontSize: 11, padding: '2px 8px', borderRadius: 8, background: '#ede9fe', color: '#7c3aed' }}>{f.category || 'General'}</span>
          </div>
        ))}
        {forms.length === 0 && <p style={{ color: '#94a3b8', gridColumn: '1/-1' }}>Aucun formulaire</p>}
      </div>
    </div>
  );
}
