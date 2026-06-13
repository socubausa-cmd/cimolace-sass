import { useState, useEffect, useCallback } from 'react';
import { BookOpen, Plus, X, CheckCircle, Trash2, UserPlus } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:4002';

type Program = {
  id: string;
  title: string;
  description?: string | null;
  category?: string;
  duration_days?: number | null;
  is_active?: boolean;
  steps_count?: number;
  patients_count?: number;
};

type Step = {
  id: string;
  program_id: string;
  position: number;
  title: string;
  description?: string | null;
  step_type?: string;
  due_after_days?: number;
  is_required?: boolean;
};

type Patient = {
  id: string;
  first_name?: string;
  last_name?: string;
};

const CATEGORIES = [
  { value: 'weight_loss', label: 'Perte de poids' },
  { value: 'detox', label: 'Detoxification' },
  { value: 'stress', label: 'Gestion du stress' },
  { value: 'post_op', label: 'Post-operatoire' },
  { value: 'chronic_disease', label: 'Maladie chronique' },
  { value: 'fertility', label: 'Fertilité' },
  { value: 'pregnancy', label: 'Grossesse' },
  { value: 'nutrition', label: 'Nutrition' },
  { value: 'rehab', label: 'Rééducation' },
  { value: 'custom', label: 'Personnalisé' },
];

const STEP_TYPES = [
  { value: 'task', label: 'Tâche' },
  { value: 'form', label: 'Formulaire' },
  { value: 'measurement', label: 'Mesure' },
  { value: 'content', label: 'Contenu' },
  { value: 'appointment', label: 'Rendez-vous' },
  { value: 'reminder', label: 'Rappel' },
];

function authHeaders(): HeadersInit {
  const t = localStorage.getItem('supabase_token');
  return {
    Authorization: 'Bearer ' + (t || ''),
    'X-Tenant-Slug': localStorage.getItem('tenant_slug') || '',
  };
}

function patientName(p: Patient | undefined): string {
  if (!p) return '(patient inconnu)';
  const n = `${p.first_name || ''} ${p.last_name || ''}`.trim();
  return n || '(sans nom)';
}

export function ProgramsList() {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [patients, setPatients] = useState<Record<string, Patient>>({});
  const [error, setError] = useState<string | null>(null);

  // Modals
  const [newProgramOpen, setNewProgramOpen] = useState(false);
  const [newStepOpen, setNewStepOpen] = useState(false);
  const [enrollOpen, setEnrollOpen] = useState(false);

  // Forms
  const [newProg, setNewProg] = useState({ title: '', description: '', category: 'custom', duration_days: '' });
  const [newStep, setNewStep] = useState({ title: '', description: '', step_type: 'task', due_after_days: '0' });
  const [enrollPatientId, setEnrollPatientId] = useState('');
  const [enrollNotes, setEnrollNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // -- Load data --------------------------------------------------------
  const fetchPrograms = useCallback(async () => {
    try {
      const res = await fetch(API + '/med/programs', { headers: authHeaders() });
      if (!res.ok) return;
      const d = await res.json();
      setPrograms(d.data || d || []);
    } catch {
      /* ignore */
    }
  }, []);

  const fetchPatients = useCallback(async () => {
    try {
      const res = await fetch(API + '/med/patients', { headers: authHeaders() });
      if (!res.ok) return;
      const d = await res.json();
      const list: Patient[] = d.data || d || [];
      const map: Record<string, Patient> = {};
      for (const p of list) map[p.id] = p;
      setPatients(map);
    } catch {
      /* ignore */
    }
  }, []);

  const fetchSteps = useCallback(async (programId: string) => {
    try {
      const res = await fetch(API + '/med/programs/' + programId + '/steps', { headers: authHeaders() });
      if (!res.ok) return;
      const d = await res.json();
      setSteps(d.data || d || []);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    fetchPrograms();
    fetchPatients();
  }, [fetchPrograms, fetchPatients]);

  useEffect(() => {
    if (selectedId) fetchSteps(selectedId);
    else setSteps([]);
  }, [selectedId, fetchSteps]);

  // -- Actions ----------------------------------------------------------
  async function handleCreateProgram(e: React.FormEvent) {
    e.preventDefault();
    if (!newProg.title.trim()) {
      setError('Titre requis');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        title: newProg.title.trim(),
        category: newProg.category,
      };
      if (newProg.description.trim()) payload.description = newProg.description.trim();
      if (newProg.duration_days) payload.duration_days = Number(newProg.duration_days);
      const res = await fetch(API + '/med/programs', {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b?.message || `Erreur ${res.status}`);
      }
      const created = await res.json();
      const id = created?.data?.id || created?.id;
      setNewProgramOpen(false);
      setNewProg({ title: '', description: '', category: 'custom', duration_days: '' });
      await fetchPrograms();
      if (id) setSelectedId(id);
    } catch (err: any) {
      setError(err?.message || 'Échec');
    } finally {
      setSaving(false);
    }
  }

  async function handleAddStep(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedId || !newStep.title.trim()) {
      setError('Titre requis');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        title: newStep.title.trim(),
        step_type: newStep.step_type,
        due_after_days: Number(newStep.due_after_days || 0),
        position: steps.length,
      };
      if (newStep.description.trim()) payload.description = newStep.description.trim();

      const res = await fetch(API + '/med/programs/' + selectedId + '/steps', {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b?.message || `Erreur ${res.status}`);
      }
      setNewStepOpen(false);
      setNewStep({ title: '', description: '', step_type: 'task', due_after_days: '0' });
      await fetchSteps(selectedId);
    } catch (err: any) {
      setError(err?.message || 'Échec');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteStep(stepId: string) {
    if (!selectedId) return;
    if (!confirm('Supprimer cette étape ?')) return;
    try {
      const res = await fetch(API + '/med/programs/' + selectedId + '/steps/' + stepId, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      if (!res.ok) return;
      await fetchSteps(selectedId);
    } catch {
      /* ignore */
    }
  }

  async function handleEnroll(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedId || !enrollPatientId) {
      setError('Sélectionnez un patient');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(API + '/med/programs/' + selectedId + '/enroll', {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient_id: enrollPatientId,
          notes: enrollNotes.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b?.message || `Erreur ${res.status}`);
      }
      setEnrollOpen(false);
      setEnrollPatientId('');
      setEnrollNotes('');
      await fetchPrograms();
    } catch (err: any) {
      setError(err?.message || 'Échec');
    } finally {
      setSaving(false);
    }
  }

  const selected = programs.find((p) => p.id === selectedId);
  const categoryLabel = (v?: string) => CATEGORIES.find((c) => c.value === v)?.label || v || 'Personnalisé';
  const stepTypeLabel = (v?: string) => STEP_TYPES.find((t) => t.value === v)?.label || v || '—';

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ fontSize: 24, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
          <BookOpen size={22} /> Programmes de soins
        </h2>
        <button
          onClick={() => { setError(null); setNewProgramOpen(true); }}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px', background: '#10b981', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer' }}
        >
          <Plus size={16} /> Nouveau programme
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 16 }}>
        {/* Programs list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {programs.length === 0 && (
            <p style={{ color: '#94a3b8', padding: 20, background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', textAlign: 'center' }}>
              Aucun programme. Cliquez sur "+ Nouveau programme".
            </p>
          )}
          {programs.map((p) => {
            const isActive = selectedId === p.id;
            return (
              <button
                key={p.id}
                onClick={() => setSelectedId(p.id)}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  background: '#fff',
                  borderRadius: 12,
                  border: isActive ? '2px solid #10b981' : '1px solid #e2e8f0',
                  padding: 16,
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                  <h3 style={{ fontWeight: 600, fontSize: 14, color: '#0f172a' }}>{p.title}</h3>
                  <CheckCircle size={18} color={p.is_active !== false ? '#10b981' : '#94a3b8'} />
                </div>
                {p.description && <p style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>{p.description}</p>}
                <div style={{ display: 'flex', gap: 10, fontSize: 11, color: '#64748b' }}>
                  <span style={{ padding: '2px 8px', background: '#f1f5f9', borderRadius: 6 }}>{categoryLabel(p.category)}</span>
                  {p.duration_days && <span>{p.duration_days}j</span>}
                </div>
              </button>
            );
          })}
        </div>

        {/* Detail */}
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: 20, minHeight: 500 }}>
          {!selected ? (
            <p style={{ color: '#94a3b8', textAlign: 'center', marginTop: 200 }}>
              Sélectionnez un programme pour voir ses étapes
            </p>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <div>
                  <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{selected.title}</h3>
                  {selected.description && <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0' }}>{selected.description}</p>}
                  <div style={{ marginTop: 6, fontSize: 12, color: '#64748b' }}>
                    Catégorie : <strong>{categoryLabel(selected.category)}</strong>
                    {selected.duration_days && ` · ${selected.duration_days}j`}
                  </div>
                </div>
                <button
                  onClick={() => { setError(null); setEnrollOpen(true); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'var(--brand-primary)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}
                >
                  <UserPlus size={14} /> Inscrire un patient
                </button>
              </div>

              <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 16, marginTop: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <h4 style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>Étapes ({steps.length})</h4>
                  <button
                    onClick={() => { setError(null); setNewStepOpen(true); }}
                    style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', background: '#fff', color: '#10b981', border: '1px solid #10b981', borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: 'pointer' }}
                  >
                    <Plus size={12} /> Ajouter étape
                  </button>
                </div>

                {steps.length === 0 ? (
                  <p style={{ color: '#94a3b8', fontSize: 13, padding: 20, textAlign: 'center', background: '#f8fafc', borderRadius: 8 }}>
                    Aucune étape. Ajoutez la première pour construire le programme.
                  </p>
                ) : (
                  <ol style={{ paddingLeft: 0, listStyle: 'none', margin: 0 }}>
                    {steps.map((s, idx) => (
                      <li
                        key={s.id}
                        style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, background: '#f8fafc', borderRadius: 8, marginBottom: 6 }}
                      >
                        <span style={{ width: 24, height: 24, borderRadius: '50%', background: '#10b981', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, flexShrink: 0 }}>
                          {idx + 1}
                        </span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 500, color: '#0f172a' }}>{s.title}</div>
                          {s.description && <div style={{ fontSize: 12, color: '#64748b' }}>{s.description}</div>}
                          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                            {stepTypeLabel(s.step_type)} · J+{s.due_after_days ?? 0}
                            {s.is_required === false && ' · optionnel'}
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeleteStep(s.id)}
                          style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', padding: 4 }}
                          title="Supprimer"
                        >
                          <Trash2 size={14} />
                        </button>
                      </li>
                    ))}
                  </ol>
                )}
              </div>

              {error && (
                <div style={{ marginTop: 12, padding: 10, background: '#fef2f2', color: '#991b1b', borderRadius: 8, fontSize: 13 }}>
                  {error}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* New Program Modal */}
      {newProgramOpen && (
        <Modal title="Nouveau programme" onClose={() => !saving && setNewProgramOpen(false)} onSubmit={handleCreateProgram}>
          <Field label="Titre *">
            <input required value={newProg.title} onChange={(e) => setNewProg({ ...newProg, title: e.target.value })} style={inputStyle} />
          </Field>
          <Field label="Description">
            <textarea rows={3} value={newProg.description} onChange={(e) => setNewProg({ ...newProg, description: e.target.value })} style={{ ...inputStyle, fontFamily: 'inherit', resize: 'vertical' }} />
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
            <Field label="Catégorie">
              <select value={newProg.category} onChange={(e) => setNewProg({ ...newProg, category: e.target.value })} style={inputStyle}>
                {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </Field>
            <Field label="Duree (jours)">
              <input type="number" min="1" placeholder="30" value={newProg.duration_days} onChange={(e) => setNewProg({ ...newProg, duration_days: e.target.value })} style={inputStyle} />
            </Field>
          </div>
          {error && <div style={errStyle}>{error}</div>}
          <Actions onCancel={() => setNewProgramOpen(false)} saving={saving} submitLabel="Créer le programme" submitColor="#10b981" />
        </Modal>
      )}

      {/* New Step Modal */}
      {newStepOpen && (
        <Modal title="Ajouter une étape" onClose={() => !saving && setNewStepOpen(false)} onSubmit={handleAddStep}>
          <Field label="Titre *">
            <input required value={newStep.title} onChange={(e) => setNewStep({ ...newStep, title: e.target.value })} style={inputStyle} placeholder="Ex: Boire 1,5L d'eau" />
          </Field>
          <Field label="Description">
            <textarea rows={2} value={newStep.description} onChange={(e) => setNewStep({ ...newStep, description: e.target.value })} style={{ ...inputStyle, fontFamily: 'inherit', resize: 'vertical' }} />
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
            <Field label="Type">
              <select value={newStep.step_type} onChange={(e) => setNewStep({ ...newStep, step_type: e.target.value })} style={inputStyle}>
                {STEP_TYPES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </Field>
            <Field label="A faire J+">
              <input type="number" min="0" value={newStep.due_after_days} onChange={(e) => setNewStep({ ...newStep, due_after_days: e.target.value })} style={inputStyle} />
            </Field>
          </div>
          {error && <div style={errStyle}>{error}</div>}
          <Actions onCancel={() => setNewStepOpen(false)} saving={saving} submitLabel="Ajouter l'étape" submitColor="#10b981" />
        </Modal>
      )}

      {/* Enroll Modal */}
      {enrollOpen && (
        <Modal title={`Inscrire un patient — ${selected?.title || ''}`} onClose={() => !saving && setEnrollOpen(false)} onSubmit={handleEnroll}>
          <Field label="Patient *">
            <select required value={enrollPatientId} onChange={(e) => setEnrollPatientId(e.target.value)} style={inputStyle}>
              <option value="">— Sélectionnez —</option>
              {Object.values(patients).map((p) => <option key={p.id} value={p.id}>{patientName(p)}</option>)}
            </select>
          </Field>
          <Field label="Notes (optionnel)">
            <textarea rows={3} value={enrollNotes} onChange={(e) => setEnrollNotes(e.target.value)} style={{ ...inputStyle, fontFamily: 'inherit', resize: 'vertical' }} placeholder="Particularites pour ce patient..." />
          </Field>
          {error && <div style={errStyle}>{error}</div>}
          <Actions onCancel={() => setEnrollOpen(false)} saving={saving} submitLabel="Inscrire le patient" submitColor="var(--brand-primary)" />
        </Modal>
      )}
    </div>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  border: '1px solid #e2e8f0',
  borderRadius: 6,
  fontSize: 14,
  background: '#fff',
  boxSizing: 'border-box',
};

const errStyle: React.CSSProperties = {
  marginTop: 12,
  padding: 10,
  background: '#fef2f2',
  color: '#991b1b',
  borderRadius: 8,
  fontSize: 13,
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'block', marginBottom: 12 }}>
      <span style={{ display: 'block', fontSize: 12, color: '#475569', marginBottom: 4, fontWeight: 500 }}>{label}</span>
      {children}
    </label>
  );
}

function Modal({
  title,
  onClose,
  onSubmit,
  children,
}: {
  title: string;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  children: React.ReactNode;
}) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
      }}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={onSubmit}
        style={{
          background: '#fff', borderRadius: 12, padding: 24, width: 'min(540px, 92vw)',
          maxHeight: '90vh', overflowY: 'auto',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{title}</h3>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
            <X size={18} />
          </button>
        </div>
        {children}
      </form>
    </div>
  );
}

function Actions({
  onCancel,
  saving,
  submitLabel,
  submitColor,
}: {
  onCancel: () => void;
  saving: boolean;
  submitLabel: string;
  submitColor: string;
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
      <button
        type="button"
        onClick={onCancel}
        disabled={saving}
        style={{
          padding: '10px 16px', background: '#fff', color: '#475569',
          border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, fontWeight: 500,
          cursor: saving ? 'not-allowed' : 'pointer',
        }}
      >
        Annuler
      </button>
      <button
        type="submit"
        disabled={saving}
        style={{
          padding: '10px 18px', background: submitColor, color: '#fff',
          border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 500,
          cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1,
        }}
      >
        {saving ? 'Sauvegarde…' : submitLabel}
      </button>
    </div>
  );
}
