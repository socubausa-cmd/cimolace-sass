import { useState, useEffect } from 'react';
import { ClipboardList, CheckCircle } from 'lucide-react';
const API = import.meta.env.VITE_API_URL || 'http://localhost:4002';

export function MyForms() {
  const [forms, setForms] = useState<any[]>([]);
  useEffect(() => {
    const t = localStorage.getItem('supabase_token'); if (!t) return;
    fetch(API + '/med/forms', { headers: { Authorization: 'Bearer ' + t, 'X-Tenant-Slug': localStorage.getItem('tenant_slug') || '' } })
      .then(r => r.json()).then(d => setForms(d.data||d||[])).catch(()=>{});
  }, []);
  return (
    <div>
      <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}><ClipboardList size={22} /> Formulaires a remplir</h2>
      {forms.length === 0 && <p style={{ color: '#94a3b8' }}>Aucun formulaire en attente.</p>}
      {forms.map((f: any) => (
        <div key={f.id} style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: 20, marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div><h3 style={{ fontWeight: 600 }}>{f.title}</h3><p style={{ fontSize: 13, color: '#64748b' }}>{f.description || 'Formulaire medical'}</p></div>
          <button style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 20px', background: '#0f766e', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer' }}><CheckCircle size={16} /> Remplir</button>
        </div>
      ))}
    </div>
  );
}
