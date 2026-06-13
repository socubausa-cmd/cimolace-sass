import { useState, useEffect, useCallback } from 'react';
import { Plus, X, Trash2, AlertTriangle, Pill, Activity, Syringe, FlaskConical } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:4002';

function authHeaders(): HeadersInit {
  const t = localStorage.getItem('supabase_token');
  return {
    Authorization: 'Bearer ' + (t || ''),
    'X-Tenant-Slug': localStorage.getItem('tenant_slug') || '',
  };
}

type Tab = 'allergies' | 'medications' | 'problems' | 'immunizations' | 'lab-results';

const TABS: { key: Tab; label: string; icon: React.ComponentType<{ size?: number; color?: string }>; color: string; route: string }[] = [
  { key: 'allergies',     label: 'Allergies',   icon: AlertTriangle,  color: '#dc2626', route: 'allergies' },
  { key: 'medications',   label: 'Medicaments', icon: Pill,           color: '#f59e0b', route: 'medications' },
  { key: 'problems',      label: 'Problemes',   icon: Activity,       color: '#0ea5e9', route: 'problems' },
  { key: 'immunizations', label: 'Vaccins',     icon: Syringe,        color: '#10b981', route: 'immunizations' },
  { key: 'lab-results',   label: 'Resultats labo', icon: FlaskConical, color: '#8b5cf6', route: 'lab-results' },
];

type RowFn = (it: any) => { title: string; subtitle: string; meta?: string };

const ROW_RENDERER: Record<Tab, RowFn> = {
  allergies: (it) => ({
    title: it.substance,
    subtitle: `${it.category || 'autre'} · severite ${it.severity || 'unknown'}`,
    meta: it.reaction ? `Reaction : ${it.reaction}` : it.notes,
  }),
  medications: (it) => ({
    title: it.drug_name,
    subtitle: `${it.dosage} · ${it.frequency}`,
    meta: it.end_date ? `Du ${it.start_date} au ${it.end_date}` : `Depuis ${it.start_date} (en cours)`,
  }),
  problems: (it) => ({
    title: it.label,
    subtitle: `${it.category}${it.icd10_code ? ` · ${it.icd10_code}` : ''}${it.severity ? ` · ${it.severity}` : ''}`,
    meta: it.onset_date ? `Depuis ${it.onset_date}` : undefined,
  }),
  immunizations: (it) => ({
    title: it.vaccine_name,
    subtitle: `${it.administered_on}${it.dose_number ? ` · dose ${it.dose_number}` : ''}`,
    meta: it.lot_number ? `Lot ${it.lot_number}` : undefined,
  }),
  'lab-results': (it) => ({
    title: it.test_name,
    subtitle: `${new Date(it.taken_at).toLocaleDateString('fr')}${it.panel ? ` · ${it.panel}` : ''}`,
    meta: it.lab_name,
  }),
};

type FieldSpec = { key: string; label: string; type: 'text' | 'textarea' | 'date' | 'select' | 'number'; options?: string[]; required?: boolean };

const FORM_FIELDS: Record<Tab, FieldSpec[]> = {
  allergies: [
    { key: 'substance', label: 'Substance', type: 'text', required: true },
    { key: 'category', label: 'Categorie', type: 'select', options: ['drug', 'food', 'environmental', 'animal', 'other'], required: true },
    { key: 'severity', label: 'Severite', type: 'select', options: ['mild', 'moderate', 'severe', 'anaphylaxis', 'unknown'] },
    { key: 'reaction', label: 'Reaction observee', type: 'text' },
    { key: 'onset_date', label: 'Date d\'apparition', type: 'date' },
    { key: 'notes', label: 'Notes', type: 'textarea' },
  ],
  medications: [
    { key: 'drug_name', label: 'Medicament', type: 'text', required: true },
    { key: 'dosage', label: 'Dosage', type: 'text', required: true },
    { key: 'frequency', label: 'Frequence', type: 'text', required: true },
    { key: 'route', label: 'Voie', type: 'text' },
    { key: 'start_date', label: 'Debut', type: 'date', required: true },
    { key: 'end_date', label: 'Fin (vide = en cours)', type: 'date' },
  ],
  problems: [
    { key: 'label', label: 'Diagnostic / probleme', type: 'text', required: true },
    { key: 'icd10_code', label: 'Code CIM-10', type: 'text' },
    { key: 'category', label: 'Categorie', type: 'select', options: ['chronic', 'acute', 'resolved', 'symptom', 'risk_factor'], required: true },
    { key: 'severity', label: 'Severite', type: 'select', options: ['mild', 'moderate', 'severe', 'critical'] },
    { key: 'onset_date', label: 'Date d\'apparition', type: 'date' },
    { key: 'resolved_date', label: 'Date de resolution', type: 'date' },
  ],
  immunizations: [
    { key: 'vaccine_name', label: 'Vaccin', type: 'text', required: true },
    { key: 'administered_on', label: 'Date administre', type: 'date', required: true },
    { key: 'dose_number', label: 'Numéro de dose', type: 'number' },
    { key: 'lot_number', label: 'Numéro de lot', type: 'text' },
    { key: 'site', label: 'Site d\'injection', type: 'text' },
    { key: 'notes', label: 'Notes', type: 'textarea' },
  ],
  'lab-results': [
    { key: 'test_name', label: 'Examen', type: 'text', required: true },
    { key: 'panel', label: 'Bilan', type: 'text' },
    { key: 'taken_at', label: 'Date prelevement', type: 'date', required: true },
    { key: 'reported_at', label: 'Date resultat', type: 'date', required: true },
    { key: 'lab_name', label: 'Laboratoire', type: 'text' },
    { key: 'notes', label: 'Notes', type: 'textarea' },
  ],
};

export function ClinicalListsPanel({ patientId }: { patientId: string }) {
  const [tab, setTab] = useState<Tab>('allergies');
  const [items, setItems] = useState<Record<Tab, any[]>>({
    allergies: [],
    medications: [],
    problems: [],
    immunizations: [],
    'lab-results': [],
  });
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);

  const fetchTab = useCallback(async (t: Tab) => {
    try {
      const route = TABS.find((x) => x.key === t)?.route || t;
      const res = await fetch(`${API}/med/${route}/patient/${patientId}`, { headers: authHeaders() });
      if (!res.ok) return;
      const d = await res.json();
      setItems((prev) => ({ ...prev, [t]: d.data || d || [] }));
    } catch {
      /* ignore */
    }
  }, [patientId]);

  useEffect(() => {
    fetchTab(tab);
  }, [tab, fetchTab]);

  function openAdd() {
    const init: Record<string, unknown> = {};
    if (tab === 'medications') {
      init.start_date = new Date().toISOString().slice(0, 10);
    }
    if (tab === 'immunizations') {
      init.administered_on = new Date().toISOString().slice(0, 10);
    }
    if (tab === 'lab-results') {
      const today = new Date().toISOString().slice(0, 10);
      init.taken_at = today;
      init.reported_at = today;
    }
    setFormData(init);
    setError(null);
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const route = TABS.find((x) => x.key === tab)?.route || tab;
      const payload: Record<string, unknown> = { patient_id: patientId };
      for (const f of FORM_FIELDS[tab]) {
        const v = formData[f.key];
        if (v === undefined || v === '') continue;
        payload[f.key] = f.type === 'number' ? Number(v) : v;
      }
      const res = await fetch(`${API}/med/${route}`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b?.message || `Erreur ${res.status}`);
      }
      setModalOpen(false);
      await fetchTab(tab);
    } catch (err: any) {
      setError(err?.message || 'Échec');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Supprimer cet element ?')) return;
    try {
      const route = TABS.find((x) => x.key === tab)?.route || tab;
      const res = await fetch(`${API}/med/${route}/${id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      if (!res.ok) return;
      await fetchTab(tab);
    } catch {
      /* ignore */
    }
  }

  const currentTab = TABS.find((t) => t.key === tab)!;
  const IconCmp = currentTab.icon;
  const list = items[tab] || [];

  return (
    <div>
      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid #e2e8f0', flexWrap: 'wrap' }}>
        {TABS.map((t) => {
          const TIcon = t.icon;
          const isActive = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 14px', background: 'none',
                border: 'none', borderBottom: isActive ? `2px solid ${t.color}` : '2px solid transparent',
                color: isActive ? t.color : '#64748b', fontSize: 13, fontWeight: 600,
                cursor: 'pointer', marginBottom: -1,
              }}
            >
              <TIcon size={14} color={isActive ? t.color : '#64748b'} /> {t.label}
              <span style={{ fontSize: 11, padding: '1px 6px', background: isActive ? t.color : '#e2e8f0', color: isActive ? '#fff' : '#64748b', borderRadius: 8 }}>
                {items[t.key].length}
              </span>
            </button>
          );
        })}
      </div>

      {/* Header + add */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
          <IconCmp size={18} color={currentTab.color} /> {currentTab.label}
        </h3>
        <button
          onClick={openAdd}
          style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', background: currentTab.color, color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: 'pointer' }}
        >
          <Plus size={12} /> Ajouter
        </button>
      </div>

      {/* List */}
      {list.length === 0 ? (
        <p style={{ color: '#94a3b8', fontSize: 13, textAlign: 'center', padding: 20, background: '#f8fafc', borderRadius: 8 }}>
          Aucun element dans cette liste.
        </p>
      ) : (
        <ul style={{ paddingLeft: 0, listStyle: 'none', margin: 0 }}>
          {list.map((it: any) => {
            const r = ROW_RENDERER[tab](it);
            return (
              <li key={it.id} style={{ display: 'flex', gap: 10, padding: '10px 12px', background: '#f8fafc', borderRadius: 8, marginBottom: 4 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{r.title}</div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{r.subtitle}</div>
                  {r.meta && <div style={{ fontSize: 11, color: '#475569', marginTop: 2, fontStyle: 'italic' }}>{r.meta}</div>}
                </div>
                <button
                  onClick={() => handleDelete(it.id)}
                  title="Supprimer"
                  style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', padding: 4 }}
                >
                  <Trash2 size={14} />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {/* Modal */}
      {modalOpen && (
        <div
          onClick={() => !saving && setModalOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleSubmit}
            style={{ background: '#fff', borderRadius: 12, padding: 24, width: 'min(540px, 100%)', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Ajouter — {currentTab.label}</h3>
              <button type="button" onClick={() => !saving && setModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                <X size={18} />
              </button>
            </div>

            {FORM_FIELDS[tab].map((f) => (
              <label key={f.key} style={{ display: 'block', marginBottom: 10 }}>
                <span style={{ display: 'block', fontSize: 12, color: '#475569', marginBottom: 4, fontWeight: 500 }}>
                  {f.label}{f.required && <span style={{ color: '#dc2626', marginLeft: 4 }}>*</span>}
                </span>
                {f.type === 'textarea' ? (
                  <textarea
                    rows={2}
                    required={f.required}
                    value={(formData[f.key] as string) || ''}
                    onChange={(e) => setFormData({ ...formData, [f.key]: e.target.value })}
                    style={{ ...inputStyle, fontFamily: 'inherit', resize: 'vertical' }}
                  />
                ) : f.type === 'select' ? (
                  <select
                    required={f.required}
                    value={(formData[f.key] as string) || ''}
                    onChange={(e) => setFormData({ ...formData, [f.key]: e.target.value })}
                    style={inputStyle}
                  >
                    <option value="">—</option>
                    {(f.options || []).map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                ) : (
                  <input
                    type={f.type}
                    required={f.required}
                    value={(formData[f.key] as string) || ''}
                    onChange={(e) => setFormData({ ...formData, [f.key]: e.target.value })}
                    style={inputStyle}
                  />
                )}
              </label>
            ))}

            {error && (
              <div style={{ marginTop: 8, padding: 10, background: '#fef2f2', color: '#991b1b', borderRadius: 8, fontSize: 13 }}>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
              <button
                type="button"
                onClick={() => !saving && setModalOpen(false)}
                disabled={saving}
                style={{ padding: '10px 16px', background: '#fff', color: '#475569', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: saving ? 'not-allowed' : 'pointer' }}
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={saving}
                style={{ padding: '10px 18px', background: currentTab.color, color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}
              >
                {saving ? 'Ajout…' : 'Ajouter'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 10px', border: '1px solid #e2e8f0',
  borderRadius: 6, fontSize: 13, background: '#fff', boxSizing: 'border-box',
};
