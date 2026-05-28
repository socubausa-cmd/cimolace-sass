import { useState, useEffect } from 'react';
import { Plus, FileDown } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:4002';

export function PrescriptionsList() {
  const [prescriptions, setPrescriptions] = useState<any[]>([]);

  useEffect(() => {
    const token = localStorage.getItem('supabase_token');
    if (!token) return;
    fetch(API + '/med/prescriptions', { headers: { Authorization: 'Bearer ' + token, 'X-Tenant-Slug': localStorage.getItem('tenant_slug') || '' } })
      .then(r => r.json()).then(d => setPrescriptions(d.data || d || [])).catch(() => {});
  }, []);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ fontSize: 24, fontWeight: 700 }}>Ordonnances</h2>
        <button style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px', background: '#f59e0b', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>
          <Plus size={16} /> Nouvelle ordonnance
        </button>
      </div>
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        {prescriptions.length === 0 && <p style={{ padding: 24, color: '#94a3b8' }}>Aucune ordonnance</p>}
        {prescriptions.map((p: any) => (
          <div key={p.id} style={{ padding: 16, borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 600 }}>{p.medication || 'Ordonnance'}</div>
              <div style={{ fontSize: 13, color: '#64748b' }}>{new Date(p.created_at).toLocaleDateString('fr')} — {p.status || 'brouillon'}</div>
            </div>
            <button style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', background: '#f1f5f9', border: 'none', borderRadius: 6, fontSize: 13, cursor: 'pointer' }}>
              <FileDown size={14} /> PDF
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
