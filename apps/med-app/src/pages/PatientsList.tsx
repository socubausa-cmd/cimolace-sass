import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, X } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:4002';

type PatientForm = {
  first_name: string;
  last_name: string;
  date_of_birth: string;
  gender: '' | 'male' | 'female' | 'other';
  blood_type: string;
  email: string;
  phone: string;
};

const emptyForm: PatientForm = {
  first_name: '',
  last_name: '',
  date_of_birth: '',
  gender: '',
  blood_type: '',
  email: '',
  phone: '',
};

export function PatientsList() {
  const [patients, setPatients] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<PatientForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPatients = useCallback(() => {
    const token = localStorage.getItem('supabase_token');
    if (!token) return;
    fetch(API + '/med/patients', {
      headers: {
        Authorization: 'Bearer ' + token,
        'X-Tenant-Slug': localStorage.getItem('tenant_slug') || '',
      },
    })
      .then((r) => r.json())
      .then((d) => setPatients(d.data || d || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchPatients();
  }, [fetchPatients]);

  const filtered = patients.filter(
    (p: any) =>
      !search ||
      ((p.first_name || '') + ' ' + (p.last_name || ''))
        .toLowerCase()
        .includes(search.toLowerCase()),
  );

  function openModal() {
    setForm(emptyForm);
    setError(null);
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.first_name.trim() || !form.last_name.trim()) {
      setError('Prénom et nom requis');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const token = localStorage.getItem('supabase_token');
      const res = await fetch(API + '/med/patients', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + token,
          'X-Tenant-Slug': localStorage.getItem('tenant_slug') || '',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          first_name: form.first_name.trim(),
          last_name: form.last_name.trim(),
          email: form.email.trim() || null,
          phone: form.phone.trim() || null,
          date_of_birth: form.date_of_birth || null,
          gender: form.gender || null,
          blood_type: form.blood_type || null,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || `Erreur ${res.status}`);
      }
      setModalOpen(false);
      fetchPatients();
    } catch (err: any) {
      setError(err?.message || 'Échec de la création');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ fontSize: 24, fontWeight: 700 }}>Patients</h2>
        <button
          onClick={openModal}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer' }}
        >
          <Plus size={16} /> Nouveau patient
        </button>
      </div>
      <div style={{ position: 'relative', marginBottom: 16 }}>
        <Search size={16} style={{ position: 'absolute', left: 12, top: 12, color: '#94a3b8' }} />
        <input
          placeholder="Rechercher un patient..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: '100%', padding: '10px 12px 10px 36px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14 }}
        />
      </div>
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f8fafc', textAlign: 'left' }}>
              <th style={{ padding: 12, fontSize: 12, fontWeight: 600, color: '#64748b' }}>Nom</th>
              <th style={{ padding: 12, fontSize: 12, fontWeight: 600, color: '#64748b' }}>Date de naissance</th>
              <th style={{ padding: 12, fontSize: 12, fontWeight: 600, color: '#64748b' }}>Genre</th>
              <th style={{ padding: 12, fontSize: 12, fontWeight: 600, color: '#64748b' }}>Statut</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={4} style={{ padding: 24, textAlign: 'center', color: '#94a3b8', fontSize: 14 }}>
                  Aucun patient. Cliquez sur "+ Nouveau patient" pour créer le premier dossier.
                </td>
              </tr>
            )}
            {filtered.map((p: any) => (
              <tr key={p.id} style={{ borderTop: '1px solid #e2e8f0' }}>
                <td style={{ padding: 12 }}>
                  <Link to={'/patients/' + p.id} style={{ color: '#3b82f6', fontWeight: 500 }}>
                    {(p.first_name || '') + ' ' + (p.last_name || '')}
                    {!p.first_name && !p.last_name && <span style={{ color: '#94a3b8' }}>(sans nom)</span>}
                  </Link>
                </td>
                <td style={{ padding: 12, color: '#64748b' }}>
                  {p.date_of_birth ? new Date(p.date_of_birth).toLocaleDateString('fr') : '-'}
                </td>
                <td style={{ padding: 12 }}>{p.gender || '-'}</td>
                <td style={{ padding: 12 }}>
                  <span
                    style={{
                      padding: '2px 8px',
                      borderRadius: 12,
                      fontSize: 12,
                      background: p.status === 'active' ? '#dcfce7' : '#fef3c7',
                      color: p.status === 'active' ? '#166534' : '#92400e',
                    }}
                  >
                    {p.status || 'actif'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <div
          onClick={() => !saving && setModalOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleSubmit}
            style={{
              background: '#fff',
              borderRadius: 12,
              padding: 24,
              width: 'min(560px, 92vw)',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Nouveau patient</h3>
              <button
                type="button"
                onClick={() => !saving && setModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Prénom *" required>
                <input
                  required
                  value={form.first_name}
                  onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                  style={inputStyle}
                />
              </Field>
              <Field label="Nom *" required>
                <input
                  required
                  value={form.last_name}
                  onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                  style={inputStyle}
                />
              </Field>
              <Field label="Date de naissance">
                <input
                  type="date"
                  value={form.date_of_birth}
                  onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })}
                  style={inputStyle}
                />
              </Field>
              <Field label="Genre">
                <select
                  value={form.gender}
                  onChange={(e) => setForm({ ...form, gender: e.target.value as any })}
                  style={inputStyle}
                >
                  <option value="">—</option>
                  <option value="female">Femme</option>
                  <option value="male">Homme</option>
                  <option value="other">Autre</option>
                </select>
              </Field>
              <Field label="Groupe sanguin">
                <select
                  value={form.blood_type}
                  onChange={(e) => setForm({ ...form, blood_type: e.target.value })}
                  style={inputStyle}
                >
                  <option value="">—</option>
                  {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((bt) => (
                    <option key={bt} value={bt}>
                      {bt}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Téléphone">
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  style={inputStyle}
                  placeholder="+33 ..."
                />
              </Field>
              <div style={{ gridColumn: '1 / -1' }}>
                <Field label="Email">
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    style={inputStyle}
                    placeholder="patient@exemple.com"
                  />
                </Field>
              </div>
            </div>

            {error && (
              <div style={{ marginTop: 12, padding: 10, background: '#fef2f2', color: '#991b1b', borderRadius: 8, fontSize: 13 }}>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
              <button
                type="button"
                onClick={() => !saving && setModalOpen(false)}
                disabled={saving}
                style={{
                  padding: '10px 16px',
                  background: '#fff',
                  color: '#475569',
                  border: '1px solid #e2e8f0',
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: saving ? 'not-allowed' : 'pointer',
                }}
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={saving}
                style={{
                  padding: '10px 16px',
                  background: '#3b82f6',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: saving ? 'not-allowed' : 'pointer',
                  opacity: saving ? 0.7 : 1,
                }}
              >
                {saving ? 'Création…' : 'Créer le dossier'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  border: '1px solid #e2e8f0',
  borderRadius: 6,
  fontSize: 14,
  background: '#fff',
  boxSizing: 'border-box',
};

function Field({
  label,
  children,
  required,
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <label style={{ display: 'block' }}>
      <span style={{ display: 'block', fontSize: 12, color: '#475569', marginBottom: 4, fontWeight: 500 }}>
        {label}
      </span>
      {children}
    </label>
  );
}
