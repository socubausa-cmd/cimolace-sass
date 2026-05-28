import { useState, useEffect, useCallback } from 'react';
import { Calendar, Plus, X, Video, Phone, MapPin, Home } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:4002';

type Appointment = {
  id: string;
  patient_id: string;
  practitioner_id: string;
  scheduled_at: string;
  duration_minutes: number;
  appointment_type: string;
  status: string;
  reason?: string | null;
};

const APP_TYPES = [
  { value: 'in_person', label: 'En cabinet', icon: MapPin },
  { value: 'teleconsult', label: 'Téléconsultation', icon: Video },
  { value: 'phone', label: 'Téléphone', icon: Phone },
  { value: 'home_visit', label: 'À domicile', icon: Home },
];

function authHeaders(): HeadersInit {
  const t = localStorage.getItem('supabase_token');
  return {
    Authorization: 'Bearer ' + (t || ''),
    'X-Tenant-Slug': localStorage.getItem('tenant_slug') || '',
  };
}

function appTypeMeta(value: string) {
  return APP_TYPES.find((t) => t.value === value) || APP_TYPES[0];
}

export function MyAppointments() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Request modal
  const [reqOpen, setReqOpen] = useState(false);
  const [reqForm, setReqForm] = useState({
    scheduled_at: '',
    duration_minutes: '30',
    appointment_type: 'in_person',
    reason: '',
  });
  const [saving, setSaving] = useState(false);

  const fetchAppointments = useCallback(async () => {
    try {
      const res = await fetch(API + '/med/me/appointments', { headers: authHeaders() });
      if (!res.ok) return;
      const d = await res.json();
      setAppointments(d.data || d || []);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  async function handleRequest(e: React.FormEvent) {
    e.preventDefault();
    if (!reqForm.scheduled_at) {
      setError('Selectionnez une date et heure');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      // First fetch own patient_id by listing once (the API will resolve role-side)
      // We rely on /med/me/appointments listing to discover practitioner_id from
      // existing appointments, OR the patient must provide it. For now, we will
      // call the create endpoint without practitioner_id and let it 400 if needed —
      // typically the doctor pre-creates dossier and shares a "request RDV" link.
      // Better solution: backend would auto-pick the assigned practitioner.
      //
      // For demo MVP: require practitioner_id from the last appointment.
      let practitionerId: string | undefined =
        appointments[0]?.practitioner_id;
      if (!practitionerId) {
        // Try to find any patient record via /med/me/health (which 404s if no
        // dossier) — we instead just block here and ask the patient to wait.
        throw new Error(
          "Aucun praticien n'est encore associé à votre dossier. Demandez à votre praticien d'initier le premier rendez-vous.",
        );
      }
      // The patient also doesn't know their own med_patients.id. We need a small
      // server helper. For now, fall back to listing my health entries to grab
      // an existing patient_id is overkill — the createAppointment service
      // accepts patient_id but the patient self-service flow ideally needs
      // server-side resolution. Until then, request via the patient_id from
      // an existing appointment (if any).
      const patientId: string | undefined = appointments[0]?.patient_id;
      if (!patientId) {
        throw new Error(
          "Impossible de determiner votre dossier patient. Contactez votre praticien.",
        );
      }
      const res = await fetch(API + '/med/appointments', {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient_id: patientId,
          practitioner_id: practitionerId,
          scheduled_at: new Date(reqForm.scheduled_at).toISOString(),
          duration_minutes: Number(reqForm.duration_minutes),
          appointment_type: reqForm.appointment_type,
          reason: reqForm.reason.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b?.message || `Erreur ${res.status}`);
      }
      setReqOpen(false);
      setReqForm({ scheduled_at: '', duration_minutes: '30', appointment_type: 'in_person', reason: '' });
      await fetchAppointments();
    } catch (err: any) {
      setError(err?.message || 'Echec de la demande');
    } finally {
      setSaving(false);
    }
  }

  async function handleCancel(id: string) {
    if (!confirm('Annuler ce rendez-vous ?')) return;
    try {
      const res = await fetch(API + '/med/appointments/' + id + '/cancel', {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Annulé par le patient' }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        setError(b?.message || `Erreur ${res.status}`);
        return;
      }
      await fetchAppointments();
    } catch (err: any) {
      setError(err?.message || 'Echec');
    }
  }

  const now = Date.now();
  const upcoming = appointments.filter(
    (a) => new Date(a.scheduled_at).getTime() >= now && a.status !== 'cancelled',
  );
  const past = appointments.filter(
    (a) => new Date(a.scheduled_at).getTime() < now || a.status === 'cancelled',
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ fontSize: 24, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Calendar size={22} /> Mes rendez-vous
        </h2>
        <button
          onClick={() => { setError(null); setReqOpen(true); }}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px', background: '#0d9488', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer' }}
        >
          <Plus size={16} /> Demander un RDV
        </button>
      </div>

      {error && (
        <div style={{ marginBottom: 16, padding: 10, background: '#fef2f2', color: '#991b1b', borderRadius: 8, fontSize: 13 }}>
          {error}
        </div>
      )}

      <section style={{ marginBottom: 24 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>
          A venir ({upcoming.length})
        </h3>
        {upcoming.length === 0 && (
          <div style={{ background: '#fff', padding: 20, borderRadius: 12, border: '1px solid #e2e8f0', color: '#94a3b8', textAlign: 'center', fontSize: 14 }}>
            Aucun rendez-vous a venir.
          </div>
        )}
        {upcoming.map((a) => (
          <AppointmentCard key={a.id} a={a} onCancel={() => handleCancel(a.id)} canCancel />
        ))}
      </section>

      {past.length > 0 && (
        <section>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>
            Historique ({past.length})
          </h3>
          {past.slice(0, 10).map((a) => (
            <AppointmentCard key={a.id} a={a} onCancel={() => {}} canCancel={false} />
          ))}
        </section>
      )}

      {reqOpen && (
        <Modal title="Demander un rendez-vous" onClose={() => !saving && setReqOpen(false)} onSubmit={handleRequest}>
          <Field label="Date et heure souhaitees *">
            <input
              type="datetime-local"
              required
              value={reqForm.scheduled_at}
              onChange={(e) => setReqForm({ ...reqForm, scheduled_at: e.target.value })}
              style={inputStyle}
              min={new Date(Date.now() + 24 * 3600 * 1000).toISOString().slice(0, 16)}
            />
            <span style={{ fontSize: 11, color: '#94a3b8', marginTop: 4, display: 'block' }}>
              Votre praticien confirmera ou proposera une alternative.
            </span>
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Type de consultation">
              <select
                value={reqForm.appointment_type}
                onChange={(e) => setReqForm({ ...reqForm, appointment_type: e.target.value })}
                style={inputStyle}
              >
                {APP_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </Field>
            <Field label="Durée prévue (min)">
              <input
                type="number"
                min="15"
                max="120"
                step="15"
                value={reqForm.duration_minutes}
                onChange={(e) => setReqForm({ ...reqForm, duration_minutes: e.target.value })}
                style={inputStyle}
              />
            </Field>
          </div>
          <Field label="Motif (optionnel)">
            <textarea
              rows={3}
              value={reqForm.reason}
              onChange={(e) => setReqForm({ ...reqForm, reason: e.target.value })}
              placeholder="Decrivez brievement le motif (douleur, suivi, controle…)"
              style={{ ...inputStyle, fontFamily: 'inherit', resize: 'vertical' }}
            />
          </Field>
          {error && <div style={errStyle}>{error}</div>}
          <Actions onCancel={() => setReqOpen(false)} saving={saving} submitLabel="Envoyer la demande" submitColor="#0d9488" />
        </Modal>
      )}
    </div>
  );
}

function AppointmentCard({ a, onCancel, canCancel }: { a: Appointment; onCancel: () => void; canCancel: boolean }) {
  const dt = new Date(a.scheduled_at);
  const meta = appTypeMeta(a.appointment_type);
  const IconCmp = meta.icon;
  const isCancelled = a.status === 'cancelled';
  const isCompleted = a.status === 'completed';
  return (
    <div
      style={{
        background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: 16,
        marginBottom: 8, display: 'flex', alignItems: 'center', gap: 16,
        opacity: isCancelled ? 0.6 : 1,
      }}
    >
      <div style={{ textAlign: 'center', minWidth: 64 }}>
        <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase' }}>
          {dt.toLocaleDateString('fr', { weekday: 'short' })}
        </div>
        <div style={{ fontSize: 22, fontWeight: 700, color: '#0d9488' }}>
          {dt.getDate()}
        </div>
        <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase' }}>
          {dt.toLocaleDateString('fr', { month: 'short' })}
        </div>
      </div>

      <div style={{ flex: 1, borderLeft: '1px solid #f1f5f9', paddingLeft: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a' }}>
          {dt.toLocaleTimeString('fr', { hour: '2-digit', minute: '2-digit' })} · {a.duration_minutes} min
        </div>
        <div style={{ fontSize: 12, color: '#64748b', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
          <IconCmp size={12} /> {meta.label}
        </div>
        {a.reason && (
          <div style={{ fontSize: 12, color: '#475569', marginTop: 4, fontStyle: 'italic' }}>{a.reason}</div>
        )}
      </div>

      <StatusBadge status={a.status} />

      {canCancel && !isCancelled && !isCompleted && (
        <button
          onClick={onCancel}
          style={{ padding: '6px 12px', background: '#fff', color: '#dc2626', border: '1px solid #dc2626', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}
        >
          Annuler
        </button>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; fg: string; label: string }> = {
    pending: { bg: '#fef3c7', fg: '#92400e', label: 'En attente' },
    confirmed: { bg: '#dbeafe', fg: '#1e40af', label: 'Confirme' },
    completed: { bg: '#dcfce7', fg: '#166534', label: 'Termine' },
    cancelled: { bg: '#fecaca', fg: '#991b1b', label: 'Annule' },
    no_show: { bg: '#f1f5f9', fg: '#475569', label: 'Manqué' },
  };
  const c = config[status] || { bg: '#f1f5f9', fg: '#475569', label: status };
  return (
    <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 10, fontWeight: 600, background: c.bg, color: c.fg, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
      {c.label}
    </span>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 10px', border: '1px solid #e2e8f0',
  borderRadius: 6, fontSize: 14, background: '#fff', boxSizing: 'border-box',
};
const errStyle: React.CSSProperties = {
  marginTop: 12, padding: 10, background: '#fef2f2',
  color: '#991b1b', borderRadius: 8, fontSize: 13,
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
  title, onClose, onSubmit, children,
}: { title: string; onClose: () => void; onSubmit: (e: React.FormEvent) => void; children: React.ReactNode }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <form onClick={(e) => e.stopPropagation()} onSubmit={onSubmit} style={{ background: '#fff', borderRadius: 12, padding: 24, width: 'min(520px, 92vw)', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
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

function Actions({ onCancel, saving, submitLabel, submitColor }: { onCancel: () => void; saving: boolean; submitLabel: string; submitColor: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
      <button type="button" onClick={onCancel} disabled={saving} style={{ padding: '10px 16px', background: '#fff', color: '#475569', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: saving ? 'not-allowed' : 'pointer' }}>
        Annuler
      </button>
      <button type="submit" disabled={saving} style={{ padding: '10px 18px', background: submitColor, color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
        {saving ? 'Envoi…' : submitLabel}
      </button>
    </div>
  );
}
