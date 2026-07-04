import { useState, useEffect, useCallback } from 'react';
import { useAuth, useSupabase } from '../lib/auth';
import { Calendar, Plus, X, Clock, Trash2, CheckCircle, XCircle, AlertCircle, Video, Clapperboard } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:4002';

type Patient = { id: string; first_name?: string; last_name?: string };

type Availability = {
  id: string;
  practitioner_id: string;
  weekday: number | null;
  specific_date: string | null;
  start_time: string;
  end_time: string;
  slot_duration_minutes: number;
  buffer_minutes: number;
  is_active: boolean;
};

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

const WEEKDAYS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

const APP_TYPES = [
  { value: 'in_person', label: 'En cabinet' },
  { value: 'teleconsult', label: 'Téléconsultation' },
  { value: 'phone', label: 'Téléphone' },
  { value: 'home_visit', label: 'À domicile' },
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

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('fr', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function Appointments() {
  const { user } = useAuth();
  const { supabase } = useSupabase();
  const practitionerId = (user as any)?.id || '';
  const [tab, setTab] = useState<'upcoming' | 'past' | 'all'>('upcoming');

  const [availabilities, setAvailabilities] = useState<Availability[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [patients, setPatients] = useState<Record<string, Patient>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [availOpen, setAvailOpen] = useState(false);
  const [availForm, setAvailForm] = useState({
    weekday: '1', // Monday
    start_time: '09:00',
    end_time: '17:00',
    slot_duration_minutes: '30',
  });

  const [apptOpen, setApptOpen] = useState(false);
  const [apptForm, setApptForm] = useState({
    patient_id: '',
    scheduled_at: '',
    duration_minutes: '30',
    appointment_type: 'in_person',
    reason: '',
  });

  // -- Data fetch -------------------------------------------------------
  const fetchAvailabilities = useCallback(async () => {
    try {
      const res = await fetch(API + '/med/availability', { headers: authHeaders() });
      if (!res.ok) return;
      const d = await res.json();
      setAvailabilities(d.data || d || []);
    } catch {
      /* ignore */
    }
  }, []);

  const fetchAppointments = useCallback(async () => {
    try {
      // Look 60 days back + 90 forward
      const from = new Date(Date.now() - 60 * 24 * 3600 * 1000).toISOString();
      const to = new Date(Date.now() + 90 * 24 * 3600 * 1000).toISOString();
      const res = await fetch(
        `${API}/med/appointments?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
        { headers: authHeaders() },
      );
      if (!res.ok) return;
      const d = await res.json();
      setAppointments(d.data || d || []);
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

  useEffect(() => {
    fetchAvailabilities();
    fetchAppointments();
    fetchPatients();
  }, [fetchAvailabilities, fetchAppointments, fetchPatients]);

  // -- Availability actions ---------------------------------------------
  async function handleCreateAvailability(e: React.FormEvent) {
    e.preventDefault();
    if (!practitionerId) {
      setError('Pas de praticien connecte');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(API + '/med/availability', {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          practitioner_id: practitionerId,
          weekday: Number(availForm.weekday),
          start_time: availForm.start_time,
          end_time: availForm.end_time,
          slot_duration_minutes: Number(availForm.slot_duration_minutes),
        }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b?.error?.message || b?.message || `Erreur ${res.status}`);
      }
      setAvailOpen(false);
      await fetchAvailabilities();
    } catch (err: any) {
      setError(err?.message || 'Echec');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteAvailability(id: string) {
    if (!confirm('Supprimer cette disponibilite recurrente ?')) return;
    try {
      const res = await fetch(API + '/med/availability/' + id, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      if (!res.ok) return;
      await fetchAvailabilities();
    } catch {
      /* ignore */
    }
  }

  // -- Appointment actions ----------------------------------------------
  async function handleCreateAppointment(e: React.FormEvent) {
    e.preventDefault();
    if (!practitionerId) {
      setError('Pas de praticien connecte');
      return;
    }
    if (!apptForm.patient_id || !apptForm.scheduled_at) {
      setError('Patient + horaire requis');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(API + '/med/appointments', {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient_id: apptForm.patient_id,
          practitioner_id: practitionerId,
          scheduled_at: new Date(apptForm.scheduled_at).toISOString(),
          duration_minutes: Number(apptForm.duration_minutes),
          appointment_type: apptForm.appointment_type,
          reason: apptForm.reason.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b?.error?.message || b?.message || `Erreur ${res.status}`);
      }
      setApptOpen(false);
      setApptForm({ patient_id: '', scheduled_at: '', duration_minutes: '30', appointment_type: 'in_person', reason: '' });
      await fetchAppointments();
    } catch (err: any) {
      setError(err?.message || 'Echec');
    } finally {
      setSaving(false);
    }
  }

  // Rejoint (ou crée) la session téléconsult liée au RDV → renvoie son id.
  // La salle live_sessions porte le MÊME id → praticien (host) et patient (peer)
  // partagent la room, en consultation directe COMME en studio de préparation.
  async function joinTeleconsult(appointmentId: string): Promise<string | null> {
    const res = await fetch(API + '/med/teleconsult/appointment/' + appointmentId + '/join', {
      method: 'POST',
      headers: authHeaders(),
    });
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setError(b?.error?.message || b?.message || `Erreur ${res.status}`);
      return null;
    }
    const d = await res.json();
    const sessionId = (d?.data || d)?.session_id; // API peut emballer en { data }
    if (!sessionId) {
      setError('Réponse téléconsultation invalide');
      return null;
    }
    return sessionId;
  }

  // Ouvre une page du studio (autre origine : app.cimolace.space) via SSO handoff
  // — code à usage unique (TTL 2 min, jamais de token dans l'URL). En cas d'échec,
  // ouverture directe (le studio demandera la connexion).
  async function openStudio(nextPath: string) {
    const studio = (import.meta.env.VITE_STUDIO_URL as string) || 'https://app.cimolace.space';
    let url = `${studio}${nextPath}`;
    try {
      if (supabase) {
        const { data: sess } = await supabase.auth.getSession();
        const refresh = sess?.session?.refresh_token;
        if (refresh) {
          const hr = await fetch(API + '/auth/handoff', {
            method: 'POST',
            headers: { ...authHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh_token: refresh }),
          });
          if (hr.ok) {
            const hd = await hr.json();
            const code = (hd?.data || hd)?.code;
            if (code) url = `${studio}/handoff?code=${encodeURIComponent(code)}&next=${encodeURIComponent(nextPath)}`;
          }
        }
      }
    } catch {
      /* fallback: ouvrir directement */
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  // DÉMARRER (direct) : ouvre la salle de CONSULTATION dédiée (face-à-face +
  // cockpit clinique MEDOS), role-aware (praticien = host). PAS le studio Formation.
  async function startTeleconsult(appointmentId: string) {
    try {
      const sessionId = await joinTeleconsult(appointmentId);
      if (!sessionId) return;
      const slug = localStorage.getItem('tenant_slug') || '';
      await openStudio(`/teleconsult/${sessionId}?tenant=${encodeURIComponent(slug)}`);
    } catch (err: any) {
      setError(err?.message || 'Echec');
    }
  }

  // PRÉPARER : ouvre le Studio Live Créateur (wizard de création de live —
  // Informations, Couverture, Date, Sécurité, Inviter, Salle virtuelle,
  // Interactions & IA, Validation) pour MONTER un live avant de le diffuser.
  // Le RDV est passé en contexte (référence / pré-remplissage éventuel).
  async function prepareLive(appt: { id: string; scheduled_at?: string | null }, patientLabel: string) {
    try {
      const slug = localStorage.getItem('tenant_slug') || '';
      // context=medos → active « Live santé (MEDOS) » ; title/date/time pré-remplissent
      // le wizard depuis le RDV (seulement si le brouillon est vierge, géré côté studio).
      const params = new URLSearchParams({ tenant: slug, context: 'medos' });
      if (appt?.id) params.set('appointment', appt.id);
      if (patientLabel) params.set('title', `Téléconsultation — ${patientLabel}`);
      if (appt?.scheduled_at) {
        const dt = new Date(appt.scheduled_at);
        if (!Number.isNaN(dt.getTime())) {
          const pad = (n: number) => String(n).padStart(2, '0');
          params.set('date', `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`);
          params.set('time', `${pad(dt.getHours())}:${pad(dt.getMinutes())}`);
        }
      }
      await openStudio(`/studio/live?${params.toString()}`);
    } catch (err: any) {
      setError(err?.message || 'Echec');
    }
  }

  async function appointmentAction(id: string, action: 'confirm' | 'cancel' | 'complete' | 'no-show') {
    try {
      const body = action === 'cancel' ? JSON.stringify({ reason: 'Annulé par le praticien' }) : undefined;
      const res = await fetch(API + '/med/appointments/' + id + '/' + action, {
        method: 'POST',
        headers: { ...authHeaders(), ...(body ? { 'Content-Type': 'application/json' } : {}) },
        body,
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        setError(b?.error?.message || b?.message || `Erreur ${res.status}`);
        return;
      }
      await fetchAppointments();
    } catch (err: any) {
      setError(err?.message || 'Echec');
    }
  }

  // -- Tabs : on ne mélange JAMAIS les RDV passés et à venir -------------
  const now = Date.now();
  const isPastAppt = (a: Appointment) =>
    new Date(a.scheduled_at).getTime() < now ||
    a.status === 'completed' ||
    a.status === 'cancelled' ||
    a.status === 'no_show';
  const upcoming = appointments.filter((a) => !isPastAppt(a));
  const past = appointments.filter((a) => isPastAppt(a));
  const tabAppts = tab === 'upcoming' ? upcoming : tab === 'past' ? past : appointments;

  // Grouper les RDV de l'onglet courant par jour.
  const grouped = tabAppts.reduce<Record<string, Appointment[]>>((acc, a) => {
    const dayKey = new Date(a.scheduled_at).toISOString().slice(0, 10);
    (acc[dayKey] = acc[dayKey] || []).push(a);
    return acc;
  }, {});
  // À venir : le plus proche d'abord. Passés / Tous : le plus récent d'abord.
  const sortedDays = Object.keys(grouped).sort((a, b) =>
    tab === 'upcoming' ? a.localeCompare(b) : b.localeCompare(a),
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ fontSize: 24, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Calendar size={22} /> Rendez-vous
        </h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => { setError(null); setAvailOpen(true); }}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 14px', background: '#fff', color: 'var(--zw-indigo)', border: '1px solid var(--zw-indigo)', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}
          >
            <Clock size={14} /> + Disponibilite
          </button>
          <button
            onClick={() => { setError(null); setApptOpen(true); }}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px', background: 'var(--zw-indigo)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer' }}
          >
            <Plus size={16} /> Nouveau RDV
          </button>
        </div>
      </div>

      {error && (
        <div style={{ marginBottom: 16, padding: 10, background: '#fef2f2', color: '#991b1b', borderRadius: 8, fontSize: 13 }}>{error}</div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16 }}>
        {/* Appointments timeline */}
        <div>
          {/* KPI strip */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
            <KpiCard label="A venir" value={upcoming.length} color="var(--zw-indigo)" />
            <KpiCard label="Cette semaine" value={appointments.filter((a) => {
              const d = new Date(a.scheduled_at).getTime();
              return d >= now && d < now + 7 * 24 * 3600 * 1000 && a.status !== 'cancelled';
            }).length} color="#10b981" />
            <KpiCard label="A confirmer" value={appointments.filter((a) => a.status === 'pending').length} color="#f59e0b" />
          </div>

          {/* Nav interne — sépare clairement à venir / passés */}
          <div style={{ display: 'inline-flex', gap: 4, marginBottom: 16, background: 'var(--zw-bg-subtle)', padding: 4, borderRadius: 10 }}>
            {([['upcoming', 'À venir', upcoming.length], ['past', 'Passés', past.length], ['all', 'Tous', appointments.length]] as const).map(([key, label, count]) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px', borderRadius: 8, border: 'none',
                  cursor: 'pointer', fontSize: 13, fontWeight: 600, transition: 'all 0.15s',
                  background: tab === key ? '#fff' : 'transparent',
                  color: tab === key ? 'var(--zw-indigo)' : 'var(--zw-text-muted)',
                  boxShadow: tab === key ? '0 1px 3px rgba(15,23,42,0.12)' : 'none',
                }}
              >
                {label}
                <span style={{ fontSize: 11, fontWeight: 700, minWidth: 16, textAlign: 'center', padding: '1px 6px', borderRadius: 10, background: tab === key ? '#eef2ff' : 'var(--zw-border)', color: tab === key ? 'var(--zw-indigo)' : 'var(--zw-text-muted)' }}>{count}</span>
              </button>
            ))}
          </div>

          {tabAppts.length === 0 && (
            <p style={{ background: '#fff', padding: 24, borderRadius: 12, border: '1px solid var(--zw-border)', color: 'var(--zw-text-faint)', textAlign: 'center' }}>
              {tab === 'upcoming'
                ? 'Aucun rendez-vous à venir.'
                : tab === 'past'
                  ? 'Aucun rendez-vous passé.'
                  : 'Aucun rendez-vous. Cliquez sur « Nouveau RDV » pour en planifier un.'}
            </p>
          )}

          {sortedDays.map((day) => {
            const dayDate = new Date(day + 'T12:00:00');
            return (
              <div key={day} style={{ marginBottom: 16 }}>
                <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--zw-text-soft)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
                  {dayDate.toLocaleDateString('fr', { weekday: 'long', day: '2-digit', month: 'long' })}
                </h3>
                {grouped[day].sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at)).map((appt) => {
                  const p = patients[appt.patient_id];
                  return (
                    <div
                      key={appt.id}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        background: '#fff', borderRadius: 8, border: '1px solid var(--zw-border)',
                        padding: 14, marginBottom: 6,
                      }}
                    >
                      <div style={{ minWidth: 60, fontSize: 14, fontWeight: 600, color: 'var(--zw-text)' }}>
                        {new Date(appt.scheduled_at).toLocaleTimeString('fr', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--zw-text)' }}>{patientName(p)}</div>
                        <div style={{ fontSize: 12, color: 'var(--zw-text-muted)', marginTop: 2 }}>
                          {appt.duration_minutes}min · {APP_TYPES.find((t) => t.value === appt.appointment_type)?.label || appt.appointment_type}
                          {appt.reason && ` · ${appt.reason}`}
                        </div>
                      </div>
                      <ApptStatusBadge status={appt.status} />
                      {appt.appointment_type === 'teleconsult' && appt.status !== 'cancelled' && appt.status !== 'completed' && (
                        <>
                          <button
                            onClick={() => prepareLive(appt, patientName(p))}
                            title="Préparer le live dans le studio (scènes, contenus, boutique, ambiance…) avant de le diffuser"
                            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px', background: '#fff', color: 'var(--zw-violet)', border: '1px solid var(--zw-violet)', borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: 'pointer' }}
                          >
                            <Clapperboard size={14} /> Préparer
                          </button>
                          <button
                            onClick={() => startTeleconsult(appt.id)}
                            title="Démarrer la téléconsultation maintenant"
                            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px', background: 'var(--zw-violet)', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: 'pointer' }}
                          >
                            <Video size={14} /> Démarrer
                          </button>
                        </>
                      )}
                      <ApptActions status={appt.status} onAction={(a) => appointmentAction(appt.id, a)} />
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* Availability sidebar */}
        <aside style={{ background: '#fff', borderRadius: 12, border: '1px solid var(--zw-border)', padding: 16, alignSelf: 'flex-start' }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, margin: 0, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Clock size={14} /> Disponibilites recurrentes
          </h3>
          {availabilities.length === 0 && (
            <p style={{ fontSize: 12, color: 'var(--zw-text-faint)', textAlign: 'center', padding: 12 }}>
              Aucune disponibilite definie.<br/>
              Cliquez sur "+ Disponibilite" pour configurer vos creneaux hebdomadaires.
            </p>
          )}
          {availabilities.map((a) => (
            <div
              key={a.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: 10, background: 'var(--zw-bg)', borderRadius: 8, marginBottom: 6, fontSize: 12,
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, color: 'var(--zw-text)' }}>
                  {a.weekday !== null ? WEEKDAYS[a.weekday] : a.specific_date || 'Ponctuel'}
                </div>
                <div style={{ color: 'var(--zw-text-muted)', marginTop: 2 }}>
                  {a.start_time} – {a.end_time} · slots {a.slot_duration_minutes}min
                </div>
              </div>
              <button
                onClick={() => handleDeleteAvailability(a.id)}
                style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', padding: 4 }}
                title="Supprimer"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </aside>
      </div>

      {/* Availability modal */}
      {availOpen && (
        <Modal title="Nouvelle disponibilite" onClose={() => !saving && setAvailOpen(false)} onSubmit={handleCreateAvailability}>
          <Field label="Jour de la semaine">
            <select value={availForm.weekday} onChange={(e) => setAvailForm({ ...availForm, weekday: e.target.value })} style={inputStyle}>
              {WEEKDAYS.map((w, i) => <option key={i} value={i}>{w}</option>)}
            </select>
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <Field label="Début">
              <input type="time" required value={availForm.start_time} onChange={(e) => setAvailForm({ ...availForm, start_time: e.target.value })} style={inputStyle} />
            </Field>
            <Field label="Fin">
              <input type="time" required value={availForm.end_time} onChange={(e) => setAvailForm({ ...availForm, end_time: e.target.value })} style={inputStyle} />
            </Field>
            <Field label="Durée slot (min)">
              <input type="number" min="5" max="240" step="5" value={availForm.slot_duration_minutes} onChange={(e) => setAvailForm({ ...availForm, slot_duration_minutes: e.target.value })} style={inputStyle} />
            </Field>
          </div>
          {error && <div style={errStyle}>{error}</div>}
          <Actions onCancel={() => setAvailOpen(false)} saving={saving} submitLabel="Creer la disponibilite" submitColor="var(--zw-indigo)" />
        </Modal>
      )}

      {/* Appointment modal */}
      {apptOpen && (
        <Modal title="Nouveau rendez-vous" onClose={() => !saving && setApptOpen(false)} onSubmit={handleCreateAppointment}>
          <Field label="Patient *">
            <select required value={apptForm.patient_id} onChange={(e) => setApptForm({ ...apptForm, patient_id: e.target.value })} style={inputStyle}>
              <option value="">— Selectionnez —</option>
              {Object.values(patients).map((p) => <option key={p.id} value={p.id}>{patientName(p)}</option>)}
            </select>
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
            <Field label="Date et heure *">
              <input type="datetime-local" required value={apptForm.scheduled_at} onChange={(e) => setApptForm({ ...apptForm, scheduled_at: e.target.value })} style={inputStyle} />
            </Field>
            <Field label="Durée (min)">
              <input type="number" min="5" max="240" step="5" value={apptForm.duration_minutes} onChange={(e) => setApptForm({ ...apptForm, duration_minutes: e.target.value })} style={inputStyle} />
            </Field>
          </div>
          <Field label="Type de consultation">
            <select value={apptForm.appointment_type} onChange={(e) => setApptForm({ ...apptForm, appointment_type: e.target.value })} style={inputStyle}>
              {APP_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </Field>
          <Field label="Motif (optionnel)">
            <textarea rows={2} value={apptForm.reason} onChange={(e) => setApptForm({ ...apptForm, reason: e.target.value })} style={{ ...inputStyle, fontFamily: 'inherit', resize: 'vertical' }} placeholder="Première consultation, suivi, douleur cervicale…" />
          </Field>
          {error && <div style={errStyle}>{error}</div>}
          <Actions onCancel={() => setApptOpen(false)} saving={saving} submitLabel="Planifier le RDV" submitColor="var(--zw-indigo)" />
        </Modal>
      )}
    </div>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────

function KpiCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ flex: 1, background: '#fff', borderRadius: 12, border: '1px solid var(--zw-border)', padding: 14 }}>
      <div style={{ fontSize: 11, color: 'var(--zw-text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color, marginTop: 4 }}>{value}</div>
    </div>
  );
}

function ApptStatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; fg: string; label: string }> = {
    pending: { bg: '#fef3c7', fg: '#92400e', label: 'A confirmer' },
    confirmed: { bg: '#dbeafe', fg: '#1e40af', label: 'Confirme' },
    completed: { bg: '#dcfce7', fg: '#166534', label: 'Termine' },
    cancelled: { bg: '#fecaca', fg: '#991b1b', label: 'Annule' },
    no_show: { bg: 'var(--zw-bg-subtle)', fg: 'var(--zw-text-soft)', label: 'No-show' },
  };
  const c = config[status] || { bg: 'var(--zw-bg-subtle)', fg: 'var(--zw-text-soft)', label: status };
  return (
    <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 10, fontWeight: 600, background: c.bg, color: c.fg, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
      {c.label}
    </span>
  );
}

function ApptActions({ status, onAction }: { status: string; onAction: (a: 'confirm' | 'cancel' | 'complete' | 'no-show') => void }) {
  if (status === 'pending') {
    return (
      <div style={{ display: 'flex', gap: 4 }}>
        <ActionBtn icon={<CheckCircle size={14} />} title="Confirmer" color="#10b981" onClick={() => onAction('confirm')} />
        <ActionBtn icon={<XCircle size={14} />} title="Annuler" color="#dc2626" onClick={() => onAction('cancel')} />
      </div>
    );
  }
  if (status === 'confirmed') {
    return (
      <div style={{ display: 'flex', gap: 4 }}>
        <ActionBtn icon={<CheckCircle size={14} />} title="Termine" color="#10b981" onClick={() => onAction('complete')} />
        <ActionBtn icon={<AlertCircle size={14} />} title="No-show" color="#f59e0b" onClick={() => onAction('no-show')} />
        <ActionBtn icon={<XCircle size={14} />} title="Annuler" color="#dc2626" onClick={() => onAction('cancel')} />
      </div>
    );
  }
  return null;
}

function ActionBtn({ icon, title, color, onClick }: { icon: React.ReactNode; title: string; color: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{ background: 'none', border: '1px solid var(--zw-border)', borderRadius: 6, padding: 4, color, cursor: 'pointer' }}
    >
      {icon}
    </button>
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

const errStyle: React.CSSProperties = {
  marginTop: 12, padding: 10, background: '#fef2f2',
  color: '#991b1b', borderRadius: 8, fontSize: 13,
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'block', marginBottom: 12 }}>
      <span style={{ display: 'block', fontSize: 12, color: 'var(--zw-text-soft)', marginBottom: 4, fontWeight: 500 }}>{label}</span>
      {children}
    </label>
  );
}

function Modal({
  title, onClose, onSubmit, children,
}: {
  title: string; onClose: () => void; onSubmit: (e: React.FormEvent) => void; children: React.ReactNode;
}) {
  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={onSubmit}
        style={{ background: '#fff', borderRadius: 12, padding: 24, width: 'min(540px, 92vw)', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}
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

function Actions({ onCancel, saving, submitLabel, submitColor }: { onCancel: () => void; saving: boolean; submitLabel: string; submitColor: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
      <button
        type="button"
        onClick={onCancel}
        disabled={saving}
        style={{ padding: '10px 16px', background: '#fff', color: 'var(--zw-text-soft)', border: '1px solid var(--zw-border)', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: saving ? 'not-allowed' : 'pointer' }}
      >
        Annuler
      </button>
      <button
        type="submit"
        disabled={saving}
        style={{ padding: '10px 18px', background: submitColor, color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}
      >
        {saving ? 'Sauvegarde…' : submitLabel}
      </button>
    </div>
  );
}

// Unused variable kept just to acknowledge import; ESLint won't complain.
void formatDateTime;
