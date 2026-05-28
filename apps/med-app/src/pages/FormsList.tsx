import { useState, useEffect, useCallback } from 'react';
import { ClipboardList, Plus, X, Trash2, GripVertical, FileText } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:4002';

type FieldType = 'text' | 'textarea' | 'checkbox' | 'select' | 'signature' | 'number' | 'date';

type Field = {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: string[];
};

type Form = {
  id: string;
  title: string;
  description?: string | null;
  category?: string;
  fields?: Field[];
  is_template?: boolean;
  created_at?: string;
};

const CATEGORIES = [
  { value: 'intake', label: 'Anamnèse' },
  { value: 'consent', label: 'Consentement' },
  { value: 'followup', label: 'Suivi' },
  { value: 'symptom', label: 'Symptômes' },
  { value: 'satisfaction', label: 'Satisfaction' },
  { value: 'custom', label: 'Personnalisé' },
];

const FIELD_TYPES: { value: FieldType; label: string }[] = [
  { value: 'text', label: 'Texte court' },
  { value: 'textarea', label: 'Texte long' },
  { value: 'number', label: 'Nombre' },
  { value: 'date', label: 'Date' },
  { value: 'select', label: 'Liste déroulante' },
  { value: 'checkbox', label: 'Case à cocher' },
  { value: 'signature', label: 'Signature' },
];

function authHeaders(): HeadersInit {
  const t = localStorage.getItem('supabase_token');
  return {
    Authorization: 'Bearer ' + (t || ''),
    'X-Tenant-Slug': localStorage.getItem('tenant_slug') || '',
  };
}

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40) || 'field';
}

const emptyField: Field = { key: '', label: '', type: 'text', required: false };

export function FormsList() {
  const [forms, setForms] = useState<Form[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [newOpen, setNewOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState<Form | null>(null);
  const [saving, setSaving] = useState(false);

  // Builder form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('custom');
  const [fields, setFields] = useState<Field[]>([{ ...emptyField, key: 'field_1' }]);

  const fetchForms = useCallback(async () => {
    try {
      const res = await fetch(API + '/med/forms', { headers: authHeaders() });
      if (!res.ok) return;
      const d = await res.json();
      setForms(d.data || d || []);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    fetchForms();
  }, [fetchForms]);

  function openBuilder() {
    setTitle('');
    setDescription('');
    setCategory('custom');
    setFields([{ ...emptyField, key: 'field_1' }]);
    setError(null);
    setNewOpen(true);
  }

  function addField() {
    setFields((prev) => [...prev, { ...emptyField, key: `field_${prev.length + 1}` }]);
  }

  function removeField(i: number) {
    setFields((prev) => prev.filter((_, idx) => idx !== i));
  }

  function updateField(i: number, patch: Partial<Field>) {
    setFields((prev) =>
      prev.map((f, idx) => {
        if (idx !== i) return f;
        const next = { ...f, ...patch };
        // auto-slug the key from label if user didn't override
        if (patch.label !== undefined && (!f.key || f.key === slugify(f.label))) {
          next.key = slugify(patch.label || `field_${idx + 1}`);
        }
        return next;
      }),
    );
  }

  function moveField(i: number, dir: -1 | 1) {
    setFields((prev) => {
      const next = [...prev];
      const target = i + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[i], next[target]] = [next[target], next[i]];
      return next;
    });
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError('Titre requis');
      return;
    }
    const validFields = fields
      .filter((f) => f.label.trim())
      .map((f, i) => ({
        ...f,
        key: f.key || slugify(f.label) || `field_${i + 1}`,
        options: f.type === 'select' ? (f.options || []).filter((o) => o.trim()) : undefined,
      }));
    if (validFields.length === 0) {
      setError('Au moins un champ avec un libellé requis');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(API + '/med/forms', {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          category,
          fields: validFields,
        }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b?.message || `Erreur ${res.status}`);
      }
      setNewOpen(false);
      await fetchForms();
    } catch (err: any) {
      setError(err?.message || 'Echec');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ fontSize: 24, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
          <ClipboardList size={22} /> Formulaires medicaux
        </h2>
        <button
          onClick={openBuilder}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px', background: '#8b5cf6', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer' }}
        >
          <Plus size={16} /> Nouveau formulaire
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
        {forms.map((f) => (
          <button
            key={f.id}
            onClick={() => setPreviewOpen(f)}
            style={{
              background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: 20,
              textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0, color: '#0f172a' }}>{f.title}</h3>
            <p style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>{f.description || 'Formulaire medical'}</p>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
              <span style={{ display: 'inline-block', fontSize: 11, padding: '2px 8px', borderRadius: 8, background: '#ede9fe', color: '#7c3aed' }}>
                {CATEGORIES.find((c) => c.value === f.category)?.label || f.category || 'Personnalise'}
              </span>
              <span style={{ fontSize: 11, color: '#94a3b8' }}>
                {(f.fields || []).length} champ{(f.fields || []).length > 1 ? 's' : ''}
              </span>
            </div>
            {f.is_template && (
              <span style={{ display: 'inline-block', marginTop: 8, fontSize: 10, padding: '1px 6px', background: '#fef3c7', color: '#92400e', borderRadius: 4, fontWeight: 600 }}>
                TEMPLATE
              </span>
            )}
          </button>
        ))}
        {forms.length === 0 && <p style={{ color: '#94a3b8', gridColumn: '1/-1' }}>Aucun formulaire</p>}
      </div>

      {/* Builder modal */}
      {newOpen && (
        <div
          onClick={() => !saving && setNewOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleCreate}
            style={{ background: '#fff', borderRadius: 12, padding: 24, width: 'min(720px, 100%)', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Nouveau formulaire</h3>
              <button type="button" onClick={() => !saving && setNewOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12, marginBottom: 12 }}>
              <Field label="Titre *">
                <input required value={title} onChange={(e) => setTitle(e.target.value)} style={inputStyle} placeholder="Ex: Anamnese ostepathie" />
              </Field>
              <Field label="Categorie">
                <select value={category} onChange={(e) => setCategory(e.target.value)} style={inputStyle}>
                  {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </Field>
            </div>

            <Field label="Description (optionnel)">
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Quand utiliser ce formulaire, instructions au patient..."
                style={{ ...inputStyle, fontFamily: 'inherit', resize: 'vertical' }}
              />
            </Field>

            <h4 style={{ fontSize: 14, fontWeight: 600, margin: '16px 0 8px', color: '#475569' }}>
              Champs ({fields.length})
            </h4>

            {fields.map((f, i) => (
              <div key={i} style={{ background: '#f8fafc', padding: 12, borderRadius: 8, marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <button type="button" onClick={() => moveField(i, -1)} disabled={i === 0} style={navBtn}>▲</button>
                    <button type="button" onClick={() => moveField(i, 1)} disabled={i === fields.length - 1} style={navBtn}>▼</button>
                  </div>
                  <GripVertical size={14} color="#94a3b8" />
                  <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>Champ {i + 1}</span>
                  <div style={{ flex: 1 }} />
                  <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#475569', cursor: 'pointer' }}>
                    <input type="checkbox" checked={f.required || false} onChange={(e) => updateField(i, { required: e.target.checked })} />
                    Obligatoire
                  </label>
                  {fields.length > 1 && (
                    <button type="button" onClick={() => removeField(i)} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', padding: 4 }}>
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 8, marginBottom: 6 }}>
                  <input
                    placeholder="Libellé du champ (ex: Motif de consultation)"
                    value={f.label}
                    onChange={(e) => updateField(i, { label: e.target.value })}
                    style={inputStyle}
                  />
                  <select value={f.type} onChange={(e) => updateField(i, { type: e.target.value as FieldType })} style={inputStyle}>
                    {FIELD_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>

                {f.type === 'select' && (
                  <input
                    placeholder="Options separees par virgule (ex: oui, non, parfois)"
                    value={(f.options || []).join(', ')}
                    onChange={(e) => updateField(i, { options: e.target.value.split(',').map((s) => s.trim()) })}
                    style={inputStyle}
                  />
                )}
              </div>
            ))}

            <button
              type="button"
              onClick={addField}
              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', background: '#fff', color: '#8b5cf6', border: '1px dashed #8b5cf6', borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: 'pointer', marginBottom: 16 }}
            >
              <Plus size={12} /> Ajouter un champ
            </button>

            {error && <div style={errStyle}>{error}</div>}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
              <button type="button" onClick={() => !saving && setNewOpen(false)} disabled={saving} style={cancelBtn(saving)}>
                Annuler
              </button>
              <button type="submit" disabled={saving} style={submitBtn('#8b5cf6', saving)}>
                {saving ? 'Creation…' : 'Creer le formulaire'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Preview modal */}
      {previewOpen && (
        <div
          onClick={() => setPreviewOpen(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: '#fff', borderRadius: 12, padding: 24, width: 'min(600px, 100%)', maxHeight: '85vh', overflowY: 'auto' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <FileText size={18} /> {previewOpen.title}
                </h3>
                {previewOpen.description && <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0' }}>{previewOpen.description}</p>}
              </div>
              <button type="button" onClick={() => setPreviewOpen(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                <X size={18} />
              </button>
            </div>

            <ol style={{ paddingLeft: 0, listStyle: 'none', margin: 0 }}>
              {(previewOpen.fields || []).map((field, i) => (
                <li key={i} style={{ padding: '10px 0', borderTop: i === 0 ? 'none' : '1px solid #f1f5f9' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 24, height: 24, borderRadius: '50%', background: '#ede9fe', color: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600 }}>
                      {i + 1}
                    </span>
                    <strong style={{ fontSize: 13 }}>{field.label}</strong>
                    {field.required && <span style={{ color: '#dc2626' }}>*</span>}
                    <span style={{ marginLeft: 'auto', fontSize: 10, padding: '1px 6px', background: '#f1f5f9', color: '#475569', borderRadius: 4, textTransform: 'uppercase' }}>
                      {FIELD_TYPES.find((t) => t.value === field.type)?.label || field.type}
                    </span>
                  </div>
                  {field.type === 'select' && field.options && field.options.length > 0 && (
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4, marginLeft: 32 }}>
                      Options : {field.options.join(', ')}
                    </div>
                  )}
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 10px', border: '1px solid #e2e8f0',
  borderRadius: 6, fontSize: 13, background: '#fff', boxSizing: 'border-box',
};
const errStyle: React.CSSProperties = {
  marginTop: 12, padding: 10, background: '#fef2f2',
  color: '#991b1b', borderRadius: 8, fontSize: 13,
};
const navBtn: React.CSSProperties = {
  fontSize: 9, padding: '1px 4px', background: '#fff', border: '1px solid #e2e8f0',
  borderRadius: 3, cursor: 'pointer', color: '#475569', lineHeight: 1,
};

function cancelBtn(saving: boolean): React.CSSProperties {
  return {
    padding: '10px 16px', background: '#fff', color: '#475569',
    border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, fontWeight: 500,
    cursor: saving ? 'not-allowed' : 'pointer',
  };
}
function submitBtn(color: string, saving: boolean): React.CSSProperties {
  return {
    padding: '10px 18px', background: color, color: '#fff',
    border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 500,
    cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1,
  };
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'block', marginBottom: 12 }}>
      <span style={{ display: 'block', fontSize: 12, color: '#475569', marginBottom: 4, fontWeight: 500 }}>{label}</span>
      {children}
    </label>
  );
}
