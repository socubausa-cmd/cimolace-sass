import { useState, useEffect } from 'react';
const API = import.meta.env.VITE_API_URL || 'http://localhost:4002';

export function MyRecords() {
  const [record, setRecord] = useState<any>(null);
  useEffect(() => {
    const t = localStorage.getItem('supabase_token'); if (!t) return;
    fetch(API + '/med/patients', { headers: { Authorization: 'Bearer ' + t, 'X-Tenant-Slug': localStorage.getItem('tenant_slug') || '' } })
      .then(r => r.json()).then(d => setRecord((d.data||d||[])[0])).catch(()=>{});
  }, []);
  if (!record) return <div style={{ padding: 24, color: '#94a3b8' }}>Chargement de votre dossier...</div>;
  return (
    <div>
      <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 20 }}>Mon dossier medical</h2>
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: 24 }}>
        <h3 style={{ fontSize: 18, fontWeight: 600 }}>{record.first_name} {record.last_name}</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12, marginTop: 16 }}>
          <div><span style={{ color: '#64748b', fontSize: 12 }}>Date de naissance</span><br/>{record.date_of_birth ? new Date(record.date_of_birth).toLocaleDateString('fr') : '-'}</div>
          <div><span style={{ color: '#64748b', fontSize: 12 }}>Genre</span><br/>{record.gender || '-'}</div>
          <div><span style={{ color: '#64748b', fontSize: 12 }}>Groupe sanguin</span><br/>{record.blood_type || '-'}</div>
          <div><span style={{ color: '#64748b', fontSize: 12 }}>Allergies</span><br/>{Array.isArray(record.allergies) ? record.allergies.join(', ') || 'Aucune' : 'Aucune'}</div>
        </div>
      </div>
    </div>
  );
}
