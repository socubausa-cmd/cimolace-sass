import { useState, useEffect } from 'react';
import { Pill, FileDown } from 'lucide-react';
const API = import.meta.env.VITE_API_URL || 'http://localhost:4002';

export function MyPrescriptions() {
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  useEffect(() => {
    const t = localStorage.getItem('supabase_token'); if (!t) return;
    fetch(API + '/med/prescriptions', { headers: { Authorization: 'Bearer ' + t, 'X-Tenant-Slug': localStorage.getItem('tenant_slug') || '' } })
      .then(r => r.json()).then(d => setPrescriptions(d.data||d||[])).catch(()=>{});
  }, []);
  return (
    <div>
      <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}><Pill size={22} /> Mes ordonnances</h2>
      {prescriptions.length === 0 && <p style={{ color: '#94a3b8' }}>Aucune ordonnance.</p>}
      {prescriptions.map((p: any) => (
        <div key={p.id} style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: 20, marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div><div style={{ fontWeight: 600 }}>{p.medication || 'Ordonnance'}</div><div style={{ fontSize: 13, color: '#64748b' }}>{new Date(p.created_at).toLocaleDateString('fr')}</div></div>
          <button style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', background: '#f1f5f9', border: 'none', borderRadius: 6, fontSize: 13, cursor: 'pointer' }}><FileDown size={14} /> PDF</button>
        </div>
      ))}
    </div>
  );
}
