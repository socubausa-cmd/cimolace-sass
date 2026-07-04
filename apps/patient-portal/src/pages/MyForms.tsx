import { useState, useEffect, useCallback } from 'react';
import { ClipboardList, CheckCircle, X, Bell } from 'lucide-react';
import { patientApi, type FormAssignment } from '../lib/api';
import { useBranding } from '../lib/branding';

const API = import.meta.env.VITE_API_URL || 'http://localhost:4002';

type FieldDef = {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'checkbox' | 'select' | 'multi' | 'signature' | 'number' | 'date';
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
  const branding = useBranding();
  const [forms, setForms] = useState<FormDef[]>([]);
  // Assignations « À remplir » : restent `null` tant que rien n'a été
  // chargé OU si l'endpoint est indisponible (table non migrée) → la
  // section n'est alors simplement pas rendue, sans erreur visible.
  const [assignments, setAssignments] = useState<FormAssignment[] | null>(null);
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

  const fetchAssignments = useCallback(() => {
    const t = localStorage.getItem('supabase_token');
    if (!t) return;
    // Dégradation gracieuse : si l'endpoint échoue (table absente / 503),
    // on garde `null` → la section « À remplir » disparaît sans crash.
    patientApi
      .getMyAssignments()
      .then((list) => setAssignments(Array.isArray(list) ? list : []))
      .catch(() => setAssignments(null));
  }, []);

  useEffect(() => {
    fetchForms();
    fetchAssignments();
  }, [fetchForms, fetchAssignments]);

  function openForm(f: FormDef) {
    setActive(f);
    setAnswers({});
    setError(null);
  }

  // Ouvre un formulaire par son id en réutilisant le flux de remplissage
  // existant. La définition complète (avec ses `fields`) vient de la liste
  // `/med/me/forms` déjà chargée ; à défaut on ouvre une coquille basée sur
  // le titre/description de l'assignation (la soumission reste possible).
  function openFormById(formId: string, fallback?: { title: string; description?: string | null }) {
    const full = forms.find((f) => f.id === formId);
    if (full) {
      openForm(full);
      return;
    }
    openForm({
      id: formId,
      title: fallback?.title || 'Formulaire',
      description: fallback?.description || undefined,
      fields: [],
    });
  }

  function setAnswer(key: string, value: unknown) {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  }

  function validate(form: FormDef): string | null {
    for (const field of form.fields || []) {
      if (!field.required) continue;
      const v = answers[field.key];
      if (v == null || v === '' || v === false || (Array.isArray(v) && v.length === 0)) {
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
      // Le backend bascule l'assignation `pending` correspondante en
      // `completed` (hook best-effort) → on rafraîchit pour la retirer de
      // l'encart « À remplir ».
      fetchAssignments();
      setTimeout(() => setSuccess(null), 4000);
    } catch (err: any) {
      setError(err?.message || "Echec de l'envoi");
    } finally {
      setSaving(false);
    }
  }

  // Assignations actives à mettre en avant. Le serveur exclut déjà les
  // `cancelled` ; on cible le statut `pending` (non encore soumis) pour
  // l'encart « À remplir ».
  const pending = (assignments || []).filter((a) => a.status === 'pending');

  return (
    <div>
      <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
        <ClipboardList size={22} color="var(--brand-primary)" /> Formulaires a remplir
      </h2>

      {success && (
        <div style={{ marginBottom: 16, padding: 12, background: '#d1fae5', color: '#065f46', borderRadius: 8, fontSize: 14 }}>
          ✓ {success}
        </div>
      )}

      {pending.length > 0 && (
        <section
          style={{
            marginBottom: 24,
            background: 'var(--brand-primary-soft)',
            border: '1px solid var(--brand-primary)',
            borderRadius: 12,
            padding: 18,
          }}
        >
          <h3
            style={{
              fontSize: 15,
              fontWeight: 700,
              margin: '0 0 12px',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              color: 'var(--brand-primary)',
            }}
          >
            <Bell size={18} color="var(--brand-primary)" />
            A remplir ({pending.length})
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {pending.map((a) => (
              <div
                key={a.id}
                style={{
                  background: '#fff',
                  borderRadius: 10,
                  padding: '14px 16px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h4 style={{ fontWeight: 600, margin: 0, fontSize: 15 }}>{a.form_title || 'Formulaire'}</h4>
                  {a.form_description && (
                    <p style={{ fontSize: 13, color: '#8a8580', margin: '2px 0 0' }}>{a.form_description}</p>
                  )}
                  <p style={{ fontSize: 12, color: '#b0aaa2', margin: '4px 0 0' }}>
                    Demandé le {new Date(a.assigned_at).toLocaleDateString('fr')}
                  </p>
                </div>
                <button
                  onClick={() => openFormById(a.form_id, { title: a.form_title, description: a.form_description })}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '8px 20px',
                    background: 'var(--brand-primary)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 8,
                    fontSize: 14,
                    fontWeight: 500,
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                >
                  <CheckCircle size={16} /> Remplir
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {pending.length > 0 && (
        <h3 style={{ fontSize: 14, fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>
          Tous les formulaires
        </h3>
      )}

      {forms.length === 0 && pending.length === 0 && (
        <p style={{ color: '#b0aaa2' }}>
          Aucun formulaire en attente{branding.name ? ` chez ${branding.name}` : ''}.
        </p>
      )}

      {forms.map((f) => (
        <div
          key={f.id}
          style={{
            background: '#fff',
            borderRadius: 12,
            border: '1px solid #ece7e1',
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
            <p style={{ fontSize: 13, color: '#8a8580' }}>{f.description || 'Formulaire medical'}</p>
            {Array.isArray(f.fields) && (
              <p style={{ fontSize: 12, color: '#b0aaa2', marginTop: 4 }}>
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
              background: 'var(--brand-primary)',
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
                  <p style={{ fontSize: 13, color: '#8a8580', margin: '4px 0 0' }}>{active.description}</p>
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
                  border: '1px solid #ece7e1',
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
                  background: 'var(--brand-primary)',
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
    border: '1px solid #ece7e1',
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
            style={{ marginTop: 3, accentColor: 'var(--brand-primary)' }}
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
    case 'multi': {
      const arr = Array.isArray(value) ? (value as string[]) : [];
      const toggle = (o: string) => onChange(arr.includes(o) ? arr.filter((x) => x !== o) : [...arr, o]);
      return (
        <div>
          {labelEl}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {(field.options || []).map((opt) => (
              <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer', fontSize: 13, color: '#1e293b' }}>
                <input type="checkbox" checked={arr.includes(opt)} onChange={() => toggle(opt)} style={{ accentColor: 'var(--brand-primary)', marginTop: 1 }} />
                {opt}
              </label>
            ))}
          </div>
        </div>
      );
    }
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
          <span style={{ fontSize: 11, color: '#b0aaa2', marginTop: 4, display: 'block' }}>
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
