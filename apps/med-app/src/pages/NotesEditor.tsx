import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, PenLine } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:4002';

export function NotesEditor() {
  const { id, patientId } = useParams();
  const navigate = useNavigate();
  const [subjective, setSubjective] = useState('');
  const [objective, setObjective] = useState('');
  const [assessment, setAssessment] = useState('');
  const [plan, setPlan] = useState('');

  useEffect(() => {
    if (!id) return;
    const token = localStorage.getItem('supabase_token');
    if (!token) return;
    fetch(API + '/med/patients/' + patientId + '/notes', { headers: { Authorization: 'Bearer ' + token, 'X-Tenant-Slug': localStorage.getItem('tenant_slug') || '' } })
      .then(r => r.json()).then(d => {
        const note = (d.data || d || []).find((n: any) => n.id === id);
        if (note) { setSubjective(note.subjective || ''); setObjective(note.objective || ''); setAssessment(note.assessment || ''); setPlan(note.plan || ''); }
      }).catch(() => {});
  }, [id]);

  const save = async () => {
    const token = localStorage.getItem('supabase_token');
    const tenant = localStorage.getItem('tenant_slug') || '';
    if (!token) return;
    const body = { subjective, objective, assessment, plan };
    const url = id ? API + '/med/notes/' + id : API + '/med/patients/' + patientId + '/notes';
    const method = id ? 'PATCH' : 'POST';
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token, 'X-Tenant-Slug': tenant }, body: JSON.stringify(body) });
    if (res.ok) {
      const data = await res.json();
      navigate('/patients/' + (patientId || (data.data || data).patient_id));
    }
  };

  const fields = [
    { label: 'Subjectif (S)', value: subjective, set: setSubjective, placeholder: 'Ce que le patient rapporte...' },
    { label: 'Objectif (O)', value: objective, set: setObjective, placeholder: 'Observations cliniques, constantes...' },
    { label: 'Evaluation (A)', value: assessment, set: setAssessment, placeholder: 'Diagnostic, analyse...' },
    { label: 'Plan (P)', value: plan, set: setPlan, placeholder: 'Traitement, suivi, prochain RDV...' },
  ];

  return (
    <div>
      <button onClick={() => navigate(-1)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#64748b', marginBottom: 16, fontSize: 14, background: 'none', border: 'none', cursor: 'pointer' }}>
        <ArrowLeft size={14} /> Retour
      </button>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}><PenLine size={20} /> Note SOAP</h2>
        <button onClick={save} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 24px', background: '#10b981', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>
          <Save size={16} /> Enregistrer
        </button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {fields.map(f => (
          <div key={f.label} style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: 16 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 8 }}>{f.label}</label>
            <textarea value={f.value} onChange={e => f.set(e.target.value)} placeholder={f.placeholder} rows={3}
              style={{ width: '100%', padding: 10, border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 14, resize: 'vertical', fontFamily: 'inherit' }} />
          </div>
        ))}
      </div>
    </div>
  );
}
