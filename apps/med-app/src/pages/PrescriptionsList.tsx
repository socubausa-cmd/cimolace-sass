import { useState, useEffect, useCallback } from 'react';
import { Plus, FileDown, X, Trash2, FileSignature, Check } from 'lucide-react';
import { useIsMobile } from '../lib/useIsMobile';

const API = import.meta.env.VITE_API_URL || 'http://localhost:4002';

type Patient = { id: string; first_name?: string; last_name?: string };

type PrescriptionItem = {
  id: string;
  drug_name: string;
  drug_code?: string;
  dosage: string;
  frequency: string;
  duration: string;
  route?: string;
  quantity?: string;
  notes?: string;
  is_substitutable?: boolean;
};

type Prescription = {
  id: string;
  patient_id: string;
  status: string;
  prescription_number?: string | null;
  validity_days?: number;
  patient_instructions?: string;
  practitioner_notes?: string;
  signed_at?: string | null;
  created_at: string;
  items?: PrescriptionItem[];
};

const emptyItem = {
  drug_name: '',
  dosage: '',
  frequency: '',
  duration: '',
  quantity: '',
  notes: '',
  is_substitutable: true,
};

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

export function PrescriptionsList() {
  const isMobile = useIsMobile();
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [patients, setPatients] = useState<Record<string, Patient>>({});
  const [selected, setSelected] = useState<Prescription | null>(null);
  const [error, setError] = useState<string | null>(null);

  // New prescription modal
  const [newOpen, setNewOpen] = useState(false);
  const [newPatientId, setNewPatientId] = useState('');
  const [newValidity, setNewValidity] = useState('90');
  const [newInstructions, setNewInstructions] = useState('');
  const [newItems, setNewItems] = useState<typeof emptyItem[]>([{ ...emptyItem }]);
  const [saving, setSaving] = useState(false);

  const fetchPrescriptions = useCallback(async (retries = 8) => {
    if (!localStorage.getItem('supabase_token')) {
      if (retries > 0) setTimeout(() => fetchPrescriptions(retries - 1), 350);
      return;
    }
    try {
      const res = await fetch(API + '/med/prescriptions', { headers: authHeaders() });
      if (res.status === 401 && retries > 0) { setTimeout(() => fetchPrescriptions(retries - 1), 350); return; }
      if (res.ok) { const d = await res.json(); setPrescriptions(Array.isArray(d?.data) ? d.data : Array.isArray(d) ? d : []); }
    } catch { /* ignore */ }
    setLoaded(true);
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

  const fetchOne = useCallback(async (id: string) => {
    try {
      const res = await fetch(API + '/med/prescriptions/' + id, { headers: authHeaders() });
      if (!res.ok) return;
      const d = await res.json();
      setSelected(d.data || d);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    fetchPrescriptions();
    fetchPatients();
  }, [fetchPrescriptions, fetchPatients]);

  // -- Actions ----------------------------------------------------------
  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newPatientId) {
      setError('Sélectionnez un patient');
      return;
    }
    const validItems = newItems.filter(
      (it) => it.drug_name.trim() && it.dosage.trim() && it.frequency.trim() && it.duration.trim(),
    );
    if (validItems.length === 0) {
      setError('Au moins une ligne avec médicament/dosage/fréquence/durée');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        patient_id: newPatientId,
        validity_days: Number(newValidity || 90),
        items: validItems.map((it) => ({
          drug_name: it.drug_name.trim(),
          dosage: it.dosage.trim(),
          frequency: it.frequency.trim(),
          duration: it.duration.trim(),
          quantity: it.quantity.trim() || undefined,
          notes: it.notes.trim() || undefined,
          is_substitutable: it.is_substitutable !== false,
        })),
      };
      if (newInstructions.trim()) payload.patient_instructions = newInstructions.trim();

      const res = await fetch(API + '/med/prescriptions', {
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
      setNewOpen(false);
      setNewPatientId('');
      setNewValidity('90');
      setNewInstructions('');
      setNewItems([{ ...emptyItem }]);
      await fetchPrescriptions();
      if (id) fetchOne(id);
    } catch (err: any) {
      setError(err?.message || 'Échec');
    } finally {
      setSaving(false);
    }
  }

  async function handleSign(p: Prescription) {
    if (!confirm(`Signer cette ordonnance ?\n\nUne fois signée, elle ne pourra plus être modifiée.`)) return;
    try {
      const res = await fetch(API + '/med/prescriptions/' + p.id + '/sign', {
        method: 'POST',
        headers: authHeaders(),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        setError(b?.message || `Erreur ${res.status}`);
        return;
      }
      await fetchPrescriptions();
      fetchOne(p.id);
    } catch (err: any) {
      setError(err?.message || 'Échec');
    }
  }

  function openPdf(p: Prescription) {
    // Le PDF est généré par l'API. Ouvert dans un nouvel onglet avec le JWT
    // en query string (?token=…) car les <a target=_blank> ne peuvent pas
    // porter d'Authorization header. À implémenter coté API dans #57.
    const token = localStorage.getItem('supabase_token') || '';
    const tenant = localStorage.getItem('tenant_slug') || '';
    const url = `${API}/med/prescriptions/${p.id}/pdf?token=${encodeURIComponent(token)}&tenant=${encodeURIComponent(tenant)}`;
    window.open(url, '_blank');
  }

  function addItemRow() {
    setNewItems((prev) => [...prev, { ...emptyItem }]);
  }
  function removeItemRow(i: number) {
    setNewItems((prev) => prev.filter((_, idx) => idx !== i));
  }
  function updateItem(i: number, key: keyof typeof emptyItem, value: unknown) {
    setNewItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, [key]: value } : it)));
  }

  return (
    <div>
      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'stretch' : 'center', gap: isMobile ? 12 : 0, marginBottom: 20 }}>
        <h2 style={{ fontSize: 24, fontWeight: 700 }}>Ordonnances</h2>
        <button
          onClick={() => { setError(null); setNewOpen(true); }}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px', background: '#f59e0b', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer' }}
        >
          <Plus size={16} /> Nouvelle ordonnance
        </button>
      </div>

      {error && (
        <div style={{ marginBottom: 16, padding: 10, background: '#fef2f2', color: '#991b1b', borderRadius: 8, fontSize: 13 }}>
          {error}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '380px 1fr', gap: 16 }}>
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid var(--zw-border)', overflow: 'hidden' }}>
          {loaded && prescriptions.length === 0 && (
            <p style={{ padding: 24, color: 'var(--zw-text-faint)', textAlign: 'center' }}>Aucune ordonnance</p>
          )}
          {prescriptions.map((p) => {
            const pt = patients[p.patient_id];
            const isActive = selected?.id === p.id;
            return (
              <button
                key={p.id}
                onClick={() => fetchOne(p.id)}
                style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  padding: 14, background: isActive ? '#fef3c7' : 'transparent',
                  border: 'none', borderTop: '1px solid var(--zw-bg-subtle)', cursor: 'pointer',
                  borderLeft: isActive ? '3px solid #f59e0b' : '3px solid transparent',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--zw-text)' }}>{patientName(pt)}</div>
                    <div style={{ fontSize: 11, color: 'var(--zw-text-muted)', marginTop: 2 }}>
                      {new Date(p.created_at).toLocaleDateString('fr', { day: '2-digit', month: 'short', year: 'numeric' })}
                      {p.prescription_number && ` · #${p.prescription_number}`}
                    </div>
                  </div>
                  <StatusBadge status={p.status} />
                </div>
              </button>
            );
          })}
        </div>

        {/* Detail */}
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid var(--zw-border)', padding: 20, minHeight: 500 }}>
          {!selected ? (
            <p style={{ color: 'var(--zw-text-faint)', textAlign: 'center', marginTop: 200 }}>
              Sélectionnez une ordonnance pour voir son contenu
            </p>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <div>
                  <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>
                    {patientName(patients[selected.patient_id])}
                  </h3>
                  <div style={{ fontSize: 12, color: 'var(--zw-text-muted)', marginTop: 4 }}>
                    {selected.prescription_number ? `Ordonnance #${selected.prescription_number}` : 'Brouillon'} ·{' '}
                    {new Date(selected.created_at).toLocaleDateString('fr')}
                    {selected.signed_at && ` · Signée le ${new Date(selected.signed_at).toLocaleDateString('fr')}`}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {selected.status === 'draft' && (
                    <button
                      onClick={() => handleSign(selected)}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: '#10b981', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}
                    >
                      <FileSignature size={14} /> Signer
                    </button>
                  )}
                  {selected.status === 'signed' && (
                    <button
                      onClick={() => openPdf(selected)}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'var(--brand-primary)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}
                    >
                      <FileDown size={14} /> PDF
                    </button>
                  )}
                </div>
              </div>

              {selected.patient_instructions && (
                <div style={{ padding: 12, background: '#fffbeb', borderRadius: 8, marginBottom: 16, fontSize: 13, color: '#78350f' }}>
                  <strong>Instructions au patient :</strong> {selected.patient_instructions}
                </div>
              )}

              <h4 style={{ fontSize: 14, fontWeight: 600, marginTop: 0, marginBottom: 8, color: 'var(--zw-text-soft)' }}>
                Lignes prescrites ({selected.items?.length || 0})
              </h4>

              {(!selected.items || selected.items.length === 0) ? (
                <p style={{ color: 'var(--zw-text-faint)', fontSize: 13, padding: 20, textAlign: 'center', background: 'var(--zw-bg)', borderRadius: 8 }}>
                  Aucune ligne. Cette ordonnance est vide.
                </p>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: 'var(--zw-bg)', textAlign: 'left' }}>
                      <th style={th}>Médicament</th>
                      <th style={th}>Dosage</th>
                      <th style={th}>Fréquence</th>
                      <th style={th}>Durée</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selected.items.map((it) => (
                      <tr key={it.id} style={{ borderTop: '1px solid var(--zw-bg-subtle)' }}>
                        <td style={td}>
                          <strong>{it.drug_name}</strong>
                          {it.notes && <div style={{ fontSize: 11, color: 'var(--zw-text-faint)', marginTop: 2 }}>{it.notes}</div>}
                          {it.is_substitutable === false && (
                            <span style={{ display: 'inline-block', marginTop: 4, fontSize: 10, padding: '1px 6px', background: '#fef2f2', color: '#991b1b', borderRadius: 4, fontWeight: 600 }}>
                              NON SUBSTITUABLE
                            </span>
                          )}
                        </td>
                        <td style={td}>{it.dosage}</td>
                        <td style={td}>{it.frequency}</td>
                        <td style={td}>{it.duration}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {selected.validity_days && (
                <div style={{ marginTop: 16, fontSize: 12, color: 'var(--zw-text-muted)' }}>
                  Validité : {selected.validity_days} jours
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* New prescription modal */}
      {newOpen && (
        <div
          onClick={() => !saving && setNewOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleCreate}
            style={{
              background: '#fff', borderRadius: 12, padding: 24,
              width: 'min(800px, 100%)', maxHeight: '90vh', overflowY: 'auto',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Nouvelle ordonnance</h3>
              <button type="button" onClick={() => !saving && setNewOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12, marginBottom: 16 }}>
              <label>
                <span style={fieldLabel}>Patient *</span>
                <select required value={newPatientId} onChange={(e) => setNewPatientId(e.target.value)} style={inputStyle}>
                  <option value="">— Sélectionnez —</option>
                  {Object.values(patients).map((p) => <option key={p.id} value={p.id}>{patientName(p)}</option>)}
                </select>
              </label>
              <label>
                <span style={fieldLabel}>Validité (jours)</span>
                <input type="number" min="1" max="365" value={newValidity} onChange={(e) => setNewValidity(e.target.value)} style={inputStyle} />
              </label>
            </div>

            <label style={{ display: 'block', marginBottom: 16 }}>
              <span style={fieldLabel}>Instructions au patient (optionnel)</span>
              <textarea
                rows={2}
                value={newInstructions}
                onChange={(e) => setNewInstructions(e.target.value)}
                placeholder="Conseils generaux, mode de vie, suivi recommande..."
                style={{ ...inputStyle, fontFamily: 'inherit', resize: 'vertical' }}
              />
            </label>

            <h4 style={{ fontSize: 14, fontWeight: 600, margin: '16px 0 8px', color: 'var(--zw-text-soft)' }}>
              Médicaments ({newItems.length})
            </h4>

            {newItems.map((it, i) => (
              <div key={i} style={{ background: 'var(--zw-bg)', padding: 12, borderRadius: 8, marginBottom: 8 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 24px', gap: 8, marginBottom: 8 }}>
                  <input
                    placeholder="Médicament (ex: Paracétamol 1000mg) *"
                    value={it.drug_name}
                    onChange={(e) => updateItem(i, 'drug_name', e.target.value)}
                    style={inputStyle}
                  />
                  <input
                    placeholder="Dosage (1 comprimé) *"
                    value={it.dosage}
                    onChange={(e) => updateItem(i, 'dosage', e.target.value)}
                    style={inputStyle}
                  />
                  {newItems.length > 1 && (
                    <button type="button" onClick={() => removeItemRow(i)} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', padding: 4 }}>
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
                  <input
                    placeholder="Fréquence (3x/jour) *"
                    value={it.frequency}
                    onChange={(e) => updateItem(i, 'frequency', e.target.value)}
                    style={inputStyle}
                  />
                  <input
                    placeholder="Durée (5 jours) *"
                    value={it.duration}
                    onChange={(e) => updateItem(i, 'duration', e.target.value)}
                    style={inputStyle}
                  />
                  <input
                    placeholder="Quantité (1 boîte)"
                    value={it.quantity}
                    onChange={(e) => updateItem(i, 'quantity', e.target.value)}
                    style={inputStyle}
                  />
                </div>
                <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                  <input
                    placeholder="Notes (pendant les repas...)"
                    value={it.notes}
                    onChange={(e) => updateItem(i, 'notes', e.target.value)}
                    style={{ ...inputStyle, flex: 1 }}
                  />
                  <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--zw-text-soft)', whiteSpace: 'nowrap', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={it.is_substitutable === false}
                      onChange={(e) => updateItem(i, 'is_substitutable', !e.target.checked)}
                    />
                    Non substituable
                  </label>
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={addItemRow}
              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', background: '#fff', color: '#f59e0b', border: '1px dashed #f59e0b', borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: 'pointer', marginBottom: 16 }}
            >
              <Plus size={12} /> Ajouter une ligne
            </button>

            {error && (
              <div style={{ marginTop: 12, padding: 10, background: '#fef2f2', color: '#991b1b', borderRadius: 8, fontSize: 13 }}>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
              <button
                type="button"
                onClick={() => !saving && setNewOpen(false)}
                disabled={saving}
                style={{ padding: '10px 16px', background: '#fff', color: 'var(--zw-text-soft)', border: '1px solid var(--zw-border)', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: saving ? 'not-allowed' : 'pointer' }}
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={saving}
                style={{ padding: '10px 18px', background: '#f59e0b', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}
              >
                {saving ? 'Création…' : 'Créer l\'ordonnance (brouillon)'}
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
  border: '1px solid var(--zw-border)',
  borderRadius: 6,
  fontSize: 13,
  background: '#fff',
  boxSizing: 'border-box',
};

const fieldLabel: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  color: 'var(--zw-text-soft)',
  marginBottom: 4,
  fontWeight: 500,
};

const th: React.CSSProperties = {
  padding: '8px 12px',
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--zw-text-muted)',
  textTransform: 'uppercase',
  letterSpacing: 0.3,
};

const td: React.CSSProperties = { padding: '10px 12px', verticalAlign: 'top' };

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; fg: string; label: string; icon?: React.ReactNode }> = {
    draft: { bg: '#fef3c7', fg: '#92400e', label: 'Brouillon' },
    signed: { bg: '#dcfce7', fg: '#166534', label: 'Signée', icon: <Check size={10} /> },
    cancelled: { bg: '#fecaca', fg: '#991b1b', label: 'Annulée' },
  };
  const c = config[status] || { bg: 'var(--zw-bg-subtle)', fg: 'var(--zw-text-soft)', label: status };
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 12, fontSize: 10, fontWeight: 600, background: c.bg, color: c.fg, textTransform: 'uppercase' }}>
      {c.icon}{c.label}
    </span>
  );
}
