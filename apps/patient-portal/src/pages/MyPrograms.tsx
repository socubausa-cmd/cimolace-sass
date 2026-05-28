import { useState, useEffect } from 'react';
import { BookOpen, CheckCircle, Circle } from 'lucide-react';
const API = import.meta.env.VITE_API_URL || 'http://localhost:4002';

export function MyPrograms() {
  const [programs, setPrograms] = useState<any[]>([]);
  useEffect(() => {
    const t = localStorage.getItem('supabase_token'); if (!t) return;
    fetch(API + '/med/programs', { headers: { Authorization: 'Bearer ' + t, 'X-Tenant-Slug': localStorage.getItem('tenant_slug') || '' } })
      .then(r => r.json()).then(d => setPrograms(d.data||d||[])).catch(()=>{});
  }, []);
  return (
    <div>
      <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}><BookOpen size={22} /> Mes programmes de soins</h2>
      {programs.length === 0 && <p style={{ color: '#94a3b8' }}>Aucun programme assigne.</p>}
      {programs.map((p: any) => (
        <div key={p.id} style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: 20, marginBottom: 12 }}>
          <h3 style={{ fontWeight: 600 }}>{p.name || p.title || 'Programme'}</h3>
          <p style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>{p.description || 'Programme de soins personnalise'}</p>
          <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
            {(p.steps||[]).slice(0, 5).map((s: any, i: number) => (
              <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>{s.completed ? <CheckCircle size={14} color="#10b981" /> : <Circle size={14} color="#94a3b8" />}{s.title || 'Etape '+(i+1)}</span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
