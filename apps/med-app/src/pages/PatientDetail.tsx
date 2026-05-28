import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, FileText, Activity, ClipboardList } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:4002';

export function PatientDetail() {
  const { id } = useParams();
  const [patient, setPatient] = useState<any>(null);
  const [notes, setNotes] = useState<any[]>([]);

  useEffect(() => {
    const token = localStorage.getItem('supabase_token');
    if (!token || !id) return;
    const headers = { Authorization: 'Bearer ' + token, 'X-Tenant-Slug': localStorage.getItem('tenant_slug') || '' };
    fetch(API + '/med/patients/' + id, { headers }).then(r => r.json()).then(d => setPatient(d.data || d)).catch(() => {});
    fetch(API + '/med/patients/' + id + '/notes', { headers }).then(r => r.json()).then(d => setNotes(d.data || d || [])).catch(() => {});
  }, [id]);

  if (!patient) return <div style={{ padding: 24 }}>Chargement...</div>;

  return (
    <div>
      <Link to="/patients" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#64748b', marginBottom: 16, fontSize: 14 }}>
        <ArrowLeft size={14} /> Retour
      </Link>
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: 24, marginBottom: 20 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700 }}>{patient.first_name} {patient.last_name}</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12, marginTop: 16 }}>
          <div><span style={{ color: '#64748b', fontSize: 12 }}>Date de naissance</span><br />{patient.date_of_birth ? new Date(patient.date_of_birth).toLocaleDateString('fr') : '-'}</div>
          <div><span style={{ color: '#64748b', fontSize: 12 }}>Genre</span><br />{patient.gender || '-'}</div>
          <div><span style={{ color: '#64748b', fontSize: 12 }}>Groupe sanguin</span><br />{patient.blood_type || '-'}</div>
          <div><span style={{ color: '#64748b', fontSize: 12 }}>Statut</span><br />{patient.status || 'actif'}</div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: 20 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}><FileText size={18} /> Notes de consultation</h3>
          {notes.length === 0 && <p style={{ color: '#94a3b8', fontSize: 14 }}>Aucune note</p>}
          {notes.map((n: any) => (
            <div key={n.id} style={{ padding: '10px 0', borderTop: '1px solid #f1f5f9' }}>
              <Link to={'/notes/' + n.id} style={{ fontWeight: 500, color: '#3b82f6' }}>Note du {new Date(n.created_at).toLocaleDateString('fr')}</Link>
              <span style={{ marginLeft: 8, fontSize: 11, padding: '1px 6px', borderRadius: 8, background: n.is_signed ? '#dcfce7' : '#fef3c7', color: n.is_signed ? '#166534' : '#92400e' }}>{n.is_signed ? 'Signée' : 'Brouillon'}</span>
            </div>
          ))}
          <Link to={'/patients/' + id + '/notes/new'} style={{ display: 'inline-block', marginTop: 12, padding: '8px 16px', background: '#10b981', color: '#fff', borderRadius: 6, fontSize: 13, fontWeight: 500 }}>+ Nouvelle note</Link>
        </div>
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: 20 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}><Activity size={18} /> Suivi sante</h3>
          <Link to={'/health'} style={{ display: 'inline-block', padding: '8px 16px', background: '#8b5cf6', color: '#fff', borderRadius: 6, fontSize: 13, fontWeight: 500 }}>Voir le suivi</Link>
        </div>
      </div>
    </div>
  );
}
