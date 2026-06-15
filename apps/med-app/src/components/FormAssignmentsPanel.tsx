import { useState, useEffect, useCallback } from 'react';
import { ClipboardList, Plus, X, Ban, CheckCircle2, Clock } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:4002';

function authHeaders(): HeadersInit {
  const t = localStorage.getItem('supabase_token');
  return {
    Authorization: 'Bearer ' + (t || ''),
    'X-Tenant-Slug': localStorage.getItem('tenant_slug') || '',
  };
}

type Assignment = {
  id: string;
  form_id: string;
  form_title: string;
  status: string;
  assigned_at: string;
  completed_at: string | null;
};

type FormOption = { id: string; title?: string; description?: string };

const STATUS_META: Record<string, { label: string; bg: string; fg: string; icon: React.ComponentType<{ size?: number }> }> = {
  pending:   { label: 'À remplir', bg: '#fef3c7', fg: '#92400e', icon: Clock },
  completed: { label: 'Rempli',    bg: '#dcfce7', fg: '#166534', icon: CheckCircle2 },
  cancelled: { label: 'Annulé',    bg: '#f1f5f9', fg: '#64748b', icon: Ban },
};

function fmtDate(s: string | null): string {
  if (!s) return '—';
  const d = new Date(s);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('fr');
}

export function FormAssignmentsPanel({ patientId }: { patientId: string }) {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [forms, setForms] = useState<FormOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedForm, setSelectedForm] = useState('');
  const [note, setNote] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [cancelingId, setCancelingId] = useState<string | null>(null);

  const fetchAssignments = useCallback(async () => {
    try {
      const res = await fetch(`${API}/med/patients/${patientId}/assignments`, { headers: authHeaders() });
      if (!res.ok) {
        setAssignments([]);
        return;
      }
      const d = await res.json();
      setAssignments((d.data || d || []) as Assignment[]);
    } catch {
      setAssignments([]);
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  const fetchForms = useCallback(async () => {
    try {
      const res = await fetch(`${API}/med/forms`, { headers: authHeaders() });
      if (!res.ok) return;
      const d = await res.json();
      setForms((d.data || d || []) as FormOption[]);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    fetchAssignments();
  }, [fetchAssignments]);

  function openAssign() {
    setSelectedForm('');
    setNote('');
    setAssignError(null);
    setModalOpen(true);
    if (forms.length === 0) fetchForms();
  }

  async function handleAssign(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedForm) {
      setAssignError('Sélectionnez un formulaire');
      return;
    }
    setAssigning(true);
    setAssignError(null);
    try {
      const res = await fetch(`${API}/med/forms/${selectedForm}/assign`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ patient_id: patientId, note: note.trim() || undefined }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        if (res.status === 503) throw new Error(b?.message || 'Assignations non disponibles (migration en attente)');
        throw new Error(b?.message || `Erreur ${res.status}`);
      }
      setModalOpen(false);
      await fetchAssignments();
    } catch (err: any) {
      setAssignError(err?.message || 'Échec');
    } finally {
      setAssigning(false);
    }
  }

  async function handleCancel(id: string) {
    if (!confirm("Annuler cette assignation ? Le patient ne pourra plus remplir ce formulaire.")) return;
    setCancelingId(id);
    setError(null);
    try {
      const res = await fetch(`${API}/med/form-assignments/${id}/cancel`, {
        method: 'POST',
        headers: authHeaders(),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b?.message || `Erreur ${res.status}`);
      }
      await fetchAssignments();
    } catch (err: any) {
      setError(err?.message || 'Échec de l\'annulation');
    } finally {
      setCancelingId(null);
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
          <ClipboardList size={18} color="var(--brand-primary)" /> Formulaires
        </h3>
        <button
          onClick={openAssign}
          style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', background: 'var(--brand-primary)', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: 'pointer' }}
        >
          <Plus size={12} /> Assigner un formulaire
        </button>
      </div>

      {error && (
        <div style={{ marginBottom: 10, padding: 10, background: '#fef2f2', color: '#991b1b', borderRadius: 8, fontSize: 12.5 }}>
          {error}
        </div>
      )}

      {loading ? (
        <p style={{ color: 'var(--zw-text-faint)', fontSize: 13, textAlign: 'center', padding: 16 }}>Chargement…</p>
      ) : assignments.length === 0 ? (
        <p style={{ color: 'var(--zw-text-faint)', fontSize: 13, textAlign: 'center', padding: 20, background: 'var(--zw-bg)', borderRadius: 8 }}>
          Aucun formulaire assigné à ce patient.
        </p>
      ) : (
        <ul style={{ paddingLeft: 0, listStyle: 'none', margin: 0 }}>
          {assignments.map((a) => {
            const meta = STATUS_META[a.status] || { label: a.status, bg: 'var(--zw-border)', fg: 'var(--zw-text-muted)', icon: Clock };
            const StatusIcon = meta.icon;
            const canCancel = a.status === 'pending';
            return (
              <li key={a.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px 12px', background: 'var(--zw-bg)', borderRadius: 8, marginBottom: 4 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--zw-text)' }}>{a.form_title || '—'}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--zw-text-muted)', marginTop: 2 }}>
                    Assigné le {fmtDate(a.assigned_at)}
                    {a.status === 'completed' && a.completed_at ? ` · Rempli le ${fmtDate(a.completed_at)}` : ''}
                  </div>
                </div>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 999, background: meta.bg, color: meta.fg, whiteSpace: 'nowrap' }}>
                  <StatusIcon size={12} /> {meta.label}
                </span>
                {canCancel && (
                  <button
                    onClick={() => handleCancel(a.id)}
                    disabled={cancelingId === a.id}
                    title="Annuler l'assignation"
                    style={{ background: 'none', border: 'none', color: '#dc2626', cursor: cancelingId === a.id ? 'not-allowed' : 'pointer', padding: 4, opacity: cancelingId === a.id ? 0.5 : 1 }}
                  >
                    <Ban size={14} />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {modalOpen && (
        <div
          onClick={() => !assigning && setModalOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleAssign}
            style={{ background: '#fff', borderRadius: 12, padding: 24, width: 'min(520px, 100%)', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Assigner un formulaire</h3>
              <button type="button" onClick={() => !assigning && setModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                <X size={18} />
              </button>
            </div>

            <label style={{ display: 'block', marginBottom: 12 }}>
              <span style={{ display: 'block', fontSize: 12, color: 'var(--zw-text-soft)', marginBottom: 4, fontWeight: 500 }}>
                Formulaire <span style={{ color: '#dc2626' }}>*</span>
              </span>
              <select
                required
                value={selectedForm}
                onChange={(e) => setSelectedForm(e.target.value)}
                style={inputStyle}
              >
                <option value="">— Choisir un formulaire —</option>
                {forms.map((f) => (
                  <option key={f.id} value={f.id}>{f.title || 'Formulaire sans titre'}</option>
                ))}
              </select>
              {forms.length === 0 && (
                <span style={{ display: 'block', fontSize: 11.5, color: 'var(--zw-text-faint)', marginTop: 6 }}>
                  Aucun formulaire disponible. Créez-en un dans la section « Formulaires ».
                </span>
              )}
            </label>

            <label style={{ display: 'block', marginBottom: 12 }}>
              <span style={{ display: 'block', fontSize: 12, color: 'var(--zw-text-soft)', marginBottom: 4, fontWeight: 500 }}>Note (optionnel)</span>
              <textarea
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={2000}
                placeholder="À remplir avant votre prochain rendez-vous…"
                style={{ ...inputStyle, fontFamily: 'inherit', resize: 'vertical' }}
              />
            </label>

            {assignError && (
              <div style={{ marginTop: 8, padding: 10, background: '#fef2f2', color: '#991b1b', borderRadius: 8, fontSize: 13 }}>
                {assignError}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
              <button
                type="button"
                onClick={() => !assigning && setModalOpen(false)}
                disabled={assigning}
                style={{ padding: '10px 16px', background: '#fff', color: 'var(--zw-text-soft)', border: '1px solid var(--zw-border)', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: assigning ? 'not-allowed' : 'pointer' }}
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={assigning || !selectedForm}
                style={{ padding: '10px 18px', background: 'var(--brand-primary)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: assigning || !selectedForm ? 'not-allowed' : 'pointer', opacity: assigning || !selectedForm ? 0.7 : 1 }}
              >
                {assigning ? 'Assignation…' : 'Assigner'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 10px', border: '1px solid var(--zw-border)',
  borderRadius: 6, fontSize: 13, background: '#fff', boxSizing: 'border-box',
};
