import { useState, useEffect } from 'react';
import { FileText, Lock } from 'lucide-react';
const API = import.meta.env.VITE_API_URL || 'http://localhost:4002';

export function MyNotes() {
  const [notes, setNotes] = useState<any[]>([]);
  useEffect(() => {
    const t = localStorage.getItem('supabase_token'); if (!t) return;
    fetch(API + '/med/me/notes', { headers: { Authorization: 'Bearer ' + t, 'X-Tenant-Slug': localStorage.getItem('tenant_slug') || '' } })
      .then(r => r.json()).then(d => setNotes(d.data||d||[])).catch(()=>{});
  }, []);
  return (
    <div>
      <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}><FileText size={22} /> Notes de consultation</h2>
      {notes.length === 0 && <p style={{ color: '#94a3b8' }}>Aucune note partagee par votre praticien.</p>}
      {notes.map((n: any) => (
        <div key={n.id} style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: 20, marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 600 }}>Consultation du {new Date(n.created_at).toLocaleDateString('fr')}</span>
            {n.is_signed ? <Lock size={14} color="#10b981" /> : <span style={{ fontSize: 12, color: '#f59e0b' }}>Non signee</span>}
          </div>
          {n.is_shared_with_patient && <div style={{ marginTop: 12, padding: 12, background: '#f0fdf4', borderRadius: 8, fontSize: 14, color: '#166534' }}>
            <p><strong>Resume:</strong> {n.ai_summary || n.free_text || 'Resume non disponible'}</p>
          </div>}
        </div>
      ))}
    </div>
  );
}
