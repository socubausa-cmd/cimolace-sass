import { useState, useEffect, useCallback } from 'react';
import { ClipboardList, CheckCircle, X } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:4002';

type FieldDef = {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'checkbox' | 'select' | 'signature' | 'number' | 'date';
  required?: boolean;
  options?: string[];
};

type FormDef = {
  id: string;
  title: string;
  description?: string;
  category?: string;
  fields?: FieldDef[];
};

export function MyForms() {
  const [forms, setForms] = useState<FormDef[]>([]);
  const [active, setActive] = useState<FormDef | null>(null);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fetchForms = useCallback(() => {
    const t = localStorage.getItem('supabase_token');
    if (!t) return;
    fetch(API + '/med/me/forms', {
      headers: {
        Authorization: 'Bearer ' + t,
        'X-Tenant-Slug': localStorage.getItem('tenant_slug') || '',
      },
    })
      .then((r) => r.json())
      .then((d) => setForms(d.data || d || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchForms();
  }, [fetchForms]);

  function openForm(f: FormDef) {
    setActive(f);
    setAnswers({});
    setError(null);
  }

  function setAnswer(key: string, value: unknown) {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  }

  function validate(form: FormDef): string | null {
    for (const field of form.fields || []) {
      if (!field.required) continue;
      const v = answers[field.key];
      if (v == null || v === '' || v === false) {
        return `Champ obligatoire : ${field.label}`;
      }
    }
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!active) return;
    const validationError = validate(active);
    if (validationError) {
      setError(validationError);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const t = localStorage.getItem('supabase_token');
      const res = await fetch(API + '/med/me/forms/' + active.id + '/responses', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + t,
          'X-Tenant-Slug': localStorage.getItem('tenant_slug') || '',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ responses: answers }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || `Erreur ${res.status}`);
      }
      setSuccess(`Reponse envoyee : « ${active.title} »`);
      setActive(null);
      fetchForms();
      setTimeout(() => setSuccess(null), 4000);
    } catch (err: any) {
      setError(err?.message || "Echec de l'envoi");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
        <ClipboardList size={22} /> Formulaires a remplir
      </h2>

      {success && (
        <div style={{ marginBottom: 16, padding: 12, background: '#d1fae5', color: '#065f46', borderRadius: 8, fontSize: 14 }}>
          ✓ {success}
        </div>
      )}

      {forms.length === 0 && <p style={{ color: '#94a3b8' }}>Aucun formulaire en attente.</p>}

      {forms.map((f) => (
        <div
          key={f.id}
          style={{
            background: '#fff',
            borderRadius: 12,
            border: '1px solid #e2e8f0',
            padding: 20,
            marginBottom: 12,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <div style={{ flex: 1 }}>
            <h3 style={{ fontWeight: 600 }}>{f.title}</h3>
            <p style={{ fontSize: 13, color: '#64748b' }}>{f.description || 'Formulaire medical'}</p>
            {Array.isArray(f.fields) && (
              <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
                {f.fields.length} question{f.fields.length > 1 ? 's' : ''} ·{' '}
                {f.fields.filter((x) => x.required).length} obligatoire
                {f.fields.filter((x) => x.required).length > 1 ? 's' : ''}
              </p>
            )}
          </div>
          <button
            onClick={() => openForm(f)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 20px',
              background: '#0f766e',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            <CheckCircle size={16} /> Remplir
          </button>
        </div>
      ))}

      {active && (
        <div
          onClick={() => !saving && setActive(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 20,
          }}
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleSubmit}
            style={{
              background: '#fff',
              borderRadius: 12,
              padding: 24,
              width: 'min(640px, 100%)',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, gap: 8 }}>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{active.title}</h3>
                {active.description && (
                  <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0' }}>{active.description}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => !saving && setActive(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, flexShrink: 0 }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {(active.fields || []).map((field) => (
                <FieldRenderer
                  key={field.key}
                  field={field}
                  value={answers[field.key]}
                  onChange={(v) => setAnswer(field.key, v)}
                />
              ))}
            </div>

            {error && (
              <div style={{ marginTop: 14, padding: 10, background: '#fef2f2', color: '#991b1b', borderRadius: 8, fontSize: 13 }}>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
              <button
                type="button"
                onClick={() => !saving && setActive(null)}
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
                  padding: '10px 18px',
                  background: '#0f766e',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: saving ? 'not-allowed' : 'pointer',
                  opacity: saving ? 0.7 : 1,
                }}
              >
                {saving ? 'Envoi…' : 'Envoyer le formulaire'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function FieldRenderer({
  field,
  value,
  onChange,
}: {
  field: FieldDef;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const labelEl = (
    <span style={{ display: 'block', fontSize: 13, color: '#1e293b', marginBottom: 6, fontWeight: 500 }}>
      {field.label}
      {field.required && <span style={{ color: '#dc2626', marginLeft: 4 }}>*</span>}
    </span>
  );

  const baseInput: React.CSSProperties = {
    width: '100%',
    padding: '9px 11px',
    border: '1px solid #e2e8f0',
    borderRadius: 6,
    fontSize: 14,
    background: '#fff',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
  };

  switch (field.type) {
    case 'textarea':
      return (
        <label>
          {labelEl}
          <textarea
            value={(value as string) || ''}
            onChange={(e) => onChange(e.target.value)}
            rows={4}
            style={{ ...baseInput, resize: 'vertical' }}
          />
        </label>
      );
    case 'checkbox':
      return (
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(e) => onChange(e.target.checked)}
            style={{ marginTop: 3, accentColor: '#0d9488' }}
          />
          <span style={{ fontSize: 13, color: '#1e293b' }}>
            {field.label}
            {field.required && <span style={{ color: '#dc2626', marginLeft: 4 }}>*</span>}
          </span>
        </label>
      );
    case 'select':
      return (
        <label>
          {labelEl}
          <select value={(value as string) || ''} onChange={(e) => onChange(e.target.value)} style={baseInput}>
            <option value="">— Selectionnez —</option>
            {(field.options || []).map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </label>
      );
    case 'signature':
      return (
        <label>
          {labelEl}
          <input
            type="text"
            placeholder="Saisissez votre nom complet pour signer"
            value={(value as string) || ''}
            onChange={(e) => onChange(e.target.value)}
            style={{ ...baseInput, fontFamily: 'cursive', fontSize: 16, fontStyle: 'italic' }}
          />
          <span style={{ fontSize: 11, color: '#94a3b8', marginTop: 4, display: 'block' }}>
            Votre signature electronique a valeur juridique.
          </span>
        </label>
      );
    case 'number':
      return (
        <label>
          {labelEl}
          <input
            type="number"
            value={(value as string) ?? ''}
            onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
            style={baseInput}
          />
        </label>
      );
    case 'date':
      return (
        <label>
          {labelEl}
          <input
            type="date"
            value={(value as string) || ''}
            onChange={(e) => onChange(e.target.value)}
            style={baseInput}
          />
        </label>
      );
    case 'text':
    default:
      return (
        <label>
          {labelEl}
          <input
            type="text"
            value={(value as string) || ''}
            onChange={(e) => onChange(e.target.value)}
            style={baseInput}
          />
        </label>
      );
  }
}
