import { useState, useEffect } from 'react';
import { BookOpen, Plus, CheckCircle } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:4002';

export function ProgramsList() {
  const [programs, setPrograms] = useState<any[]>([]);

  useEffect(() => {
    const token = localStorage.getItem('supabase_token');
    if (!token) return;
    fetch(API + '/med/programs', { headers: { Authorization: 'Bearer ' + token, 'X-Tenant-Slug': localStorage.getItem('tenant_slug') || '' } })
      .then(r => r.json()).then(d => setPrograms(d.data || d || [])).catch(() => {});
  }, []);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ fontSize: 24, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}><BookOpen size={22} /> Programmes de soins</h2>
        <button style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px', background: '#10b981', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>
          <Plus size={16} /> Nouveau programme
        </button>
      </div>
      <div style={{ display: 'grid', gap: 12 }}>
        {programs.map((p: any) => (
          <div key={p.id} style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ fontWeight: 600 }}>{p.name || p.title || 'Programme'}</h3>
              <p style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>{p.description || 'Programme de soins personnalise'}</p>
              <div style={{ marginTop: 8, display: 'flex', gap: 12 }}>
                <span style={{ fontSize: 12, color: '#64748b' }}>{p.steps_count || 0} etapes</span>
                <span style={{ fontSize: 12, color: '#64748b' }}>{p.patients_count || 0} patients</span>
              </div>
            </div>
            <CheckCircle size={24} color={p.status === 'active' ? '#10b981' : '#94a3b8'} />
          </div>
        ))}
        {programs.length === 0 && <p style={{ color: '#94a3b8' }}>Aucun programme</p>}
      </div>
    </div>
  );
}
