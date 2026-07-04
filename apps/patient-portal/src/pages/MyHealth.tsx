import { useState, useEffect, useCallback } from 'react';
import { Heart, Activity, Moon, Dumbbell, Droplets, Plus, X, AlertTriangle, Gauge, Thermometer, HeartPulse, Scale, Stethoscope } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const API = import.meta.env.VITE_API_URL || 'http://localhost:4002';

type HealthForm = {
  mood_score: number;
  energy_level: number;
  sleep_hours: string;
  exercise_minutes: string;
  water_liters: string;
  notes: string;
};

const emptyForm: HealthForm = {
  mood_score: 7,
  energy_level: 7,
  sleep_hours: '',
  exercise_minutes: '',
  water_liters: '',
  notes: '',
};

// « Mes constantes » — saisie des relevés d'appareils maison (RPM). Tous les
// champs sont optionnels : on n'envoie que ce qui est renseigné.
type VitalsForm = {
  blood_pressure_systolic: string;
  blood_pressure_diastolic: string;
  blood_glucose: string;
  heart_rate: string;
  weight_kg: string;
  temperature: string;
};

const emptyVitals: VitalsForm = {
  blood_pressure_systolic: '',
  blood_pressure_diastolic: '',
  blood_glucose: '',
  heart_rate: '',
  weight_kg: '',
  temperature: '',
};

export function MyHealth() {
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<HealthForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // « Mes constantes » (RPM) — modal + état dédiés.
  const [vitalsOpen, setVitalsOpen] = useState(false);
  const [vitals, setVitals] = useState<VitalsForm>(emptyVitals);
  const [vitalsSaving, setVitalsSaving] = useState(false);
  const [vitalsError, setVitalsError] = useState<string | null>(null);

  const fetchEntries = useCallback(() => {
    const t = localStorage.getItem('supabase_token');
    if (!t) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    fetch(API + '/med/me/health', {
      headers: {
        Authorization: 'Bearer ' + t,
        'X-Tenant-Slug': localStorage.getItem('tenant_slug') || '',
      },
    })
      .then((r) => {
        if (!r.ok) throw new Error('Erreur ' + r.status);
        return r.json();
      })
      .then((d) => setEntries(d.data || d || []))
      .catch(() => setLoadError('Impossible de charger votre journal pour le moment.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const latest = entries[0] || {};
  const metrics = [
    { icon: Heart, label: 'Humeur', value: latest.mood_score, unit: '/10', color: '#ef4444' },
    { icon: Activity, label: 'Energie', value: latest.energy_level, unit: '/10', color: '#f59e0b' },
    { icon: Moon, label: 'Sommeil', value: latest.sleep_hours, unit: 'h', color: '#8b5cf6' },
    { icon: Dumbbell, label: 'Exercice', value: latest.exercise_minutes, unit: 'min', color: 'var(--brand-accent)' },
    { icon: Droplets, label: 'Eau', value: latest.water_liters, unit: 'L', color: '#3b82f6' },
  ];

  // Dernière valeur connue par constante (chaque vital peut venir d'une entrée
  // différente : on parcourt du plus récent au plus ancien et on garde la 1re
  // valeur non nulle de chaque champ).
  const lastVital = (field: string): number | string | null => {
    for (const e of entries) {
      const v = (e as any)?.[field];
      if (v != null && v !== '') return v;
    }
    return null;
  };
  const sysV = lastVital('blood_pressure_systolic');
  const diaV = lastVital('blood_pressure_diastolic');
  const vitalCards = [
    {
      icon: Gauge,
      label: 'Tension',
      value: sysV != null || diaV != null ? `${sysV ?? '-'}/${diaV ?? '-'}` : null,
      unit: 'mmHg',
      color: '#ef4444',
    },
    { icon: Droplets, label: 'Glycémie', value: lastVital('blood_glucose'), unit: 'mg/dL', color: '#0ea5e9' },
    { icon: HeartPulse, label: 'Fréq. card.', value: lastVital('heart_rate'), unit: 'bpm', color: '#ec4899' },
    { icon: Scale, label: 'Poids', value: lastVital('weight_kg'), unit: 'kg', color: 'var(--brand-accent)' },
    { icon: Thermometer, label: 'Température', value: lastVital('temperature'), unit: '°C', color: '#f59e0b' },
  ];
  const hasAnyVital = vitalCards.some((c) => c.value != null);

  function openModal() {
    setForm(emptyForm);
    setError(null);
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const t = localStorage.getItem('supabase_token');
      const payload: Record<string, unknown> = {
        // 'custom' = seule valeur générique acceptée par la contrainte CHECK
        // de med_health_entries (mood|sleep|vitals|food|activity|symptom|custom).
        // 'daily' violait la contrainte → l'enregistrement échouait côté serveur.
        entry_type: 'custom',
        mood_score: form.mood_score,
        energy_level: form.energy_level,
      };
      if (form.sleep_hours) payload.sleep_hours = Number(form.sleep_hours);
      if (form.exercise_minutes) payload.exercise_minutes = Number(form.exercise_minutes);
      if (form.water_liters) payload.water_liters = Number(form.water_liters);
      if (form.notes.trim()) payload.notes = form.notes.trim();

      const res = await fetch(API + '/med/me/health', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + t,
          'X-Tenant-Slug': localStorage.getItem('tenant_slug') || '',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || `Erreur ${res.status}`);
      }
      setModalOpen(false);
      fetchEntries();
    } catch (err: any) {
      setError(err?.message || 'Echec de l\'enregistrement');
    } finally {
      setSaving(false);
    }
  }

  function openVitals() {
    setVitals(emptyVitals);
    setVitalsError(null);
    setVitalsOpen(true);
  }

  // Saisie « Mes constantes » → POST /med/me/health avec source='home_device'.
  // Réutilise le pipeline existant : l'API projette ces vitals en biomarqueurs
  // cliniques (glycémie/tension/FC/poids/température) et le jumeau recalcule
  // ses scores d'organes + alertes. On n'envoie que les champs renseignés.
  async function handleVitalsSubmit(e: React.FormEvent) {
    e.preventDefault();
    setVitalsSaving(true);
    setVitalsError(null);
    try {
      const t = localStorage.getItem('supabase_token');
      const payload: Record<string, unknown> = {
        entry_type: 'vitals',
        source: 'home_device',
      };
      const sys = Number(vitals.blood_pressure_systolic);
      const dia = Number(vitals.blood_pressure_diastolic);
      if (vitals.blood_pressure_systolic && sys > 0) payload.blood_pressure_systolic = sys;
      if (vitals.blood_pressure_diastolic && dia > 0) payload.blood_pressure_diastolic = dia;
      if (vitals.blood_glucose) payload.blood_glucose = Number(vitals.blood_glucose);
      if (vitals.heart_rate) payload.heart_rate = Number(vitals.heart_rate);
      if (vitals.weight_kg) payload.weight_kg = Number(vitals.weight_kg);
      if (vitals.temperature) payload.temperature = Number(vitals.temperature);

      // Garde-fou bienveillant : au moins une constante doit être renseignée.
      const hasAny = Object.keys(payload).some(
        (k) => k !== 'entry_type' && k !== 'source',
      );
      if (!hasAny) {
        throw new Error('Renseignez au moins une constante avant d\'enregistrer.');
      }

      const res = await fetch(API + '/med/me/health', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + t,
          'X-Tenant-Slug': localStorage.getItem('tenant_slug') || '',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || `Erreur ${res.status}`);
      }
      setVitalsOpen(false);
      fetchEntries();
    } catch (err: any) {
      setVitalsError(err?.message || 'Echec de l\'enregistrement');
    } finally {
      setVitalsSaving(false);
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        <h2 style={{ fontSize: 24, fontWeight: 700 }}>Mon journal de santé</h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            onClick={openVitals}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 18px', background: '#fff', color: 'var(--brand-primary)', border: '1px solid var(--brand-primary)', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
          >
            <Stethoscope size={16} aria-hidden="true" /> Mes constantes
          </button>
          <button
            onClick={openModal}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 18px', background: 'var(--brand-primary)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer' }}
          >
            <Plus size={16} /> Enregistrer aujourd'hui
          </button>
        </div>
      </div>

      {loadError && (
        <div
          role="alert"
          style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: 12, marginBottom: 16, background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', borderRadius: 10, fontSize: 13.5, lineHeight: 1.5 }}
        >
          <AlertTriangle size={16} aria-hidden="true" style={{ flexShrink: 0, marginTop: 1 }} />
          <span>{loadError}</span>
        </div>
      )}

      {loading && entries.length === 0 && !loadError && (
        <div role="status" aria-live="polite" style={{ padding: '8px 0 20px', color: '#64748b', fontSize: 14 }}>
          Chargement de votre journal…
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12, marginBottom: 24 }}>
        {metrics.map((m) => (
          <div
            key={m.label}
            style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: 16, display: 'flex', alignItems: 'center', gap: 10 }}
          >
            <m.icon size={20} color={m.color} />
            <div>
              <div style={{ fontSize: 12, color: '#64748b' }}>{m.label}</div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>
                {m.value != null && m.value !== '' ? m.value : '-'} <span style={{ fontSize: 12, color: '#94a3b8' }}>{m.unit}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Mes constantes (RPM) ─────────────────────────────────────── */}
      <section style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: 20, marginBottom: 24 }} aria-labelledby="vitals-title">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
          <Stethoscope size={18} color="var(--brand-primary)" aria-hidden="true" />
          <h3 id="vitals-title" style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>Mes constantes</h3>
          <button
            onClick={openVitals}
            style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'var(--brand-primary)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}
          >
            <Plus size={15} aria-hidden="true" /> Ajouter un relevé
          </button>
        </div>
        <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 10px', lineHeight: 1.5 }}>
          Relevez vos mesures d'appareils maison (tensiomètre, glucomètre, balance, oxymètre…). Elles enrichissent votre suivi et celui de votre praticien.
        </p>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '10px 12px', background: 'var(--brand-primary-soft)', border: '1px solid var(--brand-primary)', borderRadius: 8, color: 'var(--brand-primary)', fontSize: 12, lineHeight: 1.5, marginBottom: 14 }}>
          <AlertTriangle size={15} aria-hidden="true" style={{ flexShrink: 0, marginTop: 1 }} />
          <span>
            Information de prévention, <strong>pas un diagnostic</strong>. En cas de malaise ou de valeur très inhabituelle, contactez votre praticien ou les urgences (15/112).
          </span>
        </div>
        {!hasAnyVital ? (
          <p style={{ color: '#94a3b8', fontSize: 14, margin: 0 }}>
            Aucune constante enregistrée pour l'instant. Cliquez sur « Ajouter un relevé » pour commencer.
          </p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
            {vitalCards.map((c) => (
              <div
                key={c.label}
                style={{ background: '#f8fafc', borderRadius: 12, border: '1px solid #eef2f7', padding: 14, display: 'flex', alignItems: 'center', gap: 10 }}
              >
                <c.icon size={20} color={c.color} aria-hidden="true" />
                <div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>{c.label}</div>
                  <div style={{ fontSize: 19, fontWeight: 700 }}>
                    {c.value != null && c.value !== '' ? c.value : '-'} <span style={{ fontSize: 12, color: '#94a3b8' }}>{c.unit}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {entries.length >= 2 && (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: 20, marginBottom: 16 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Evolution sur les 30 derniers jours</h3>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart
              data={[...entries]
                .slice(0, 30)
                .reverse()
                .map((e: any) => ({
                  date: new Date(e.entry_date || e.created_at).toLocaleDateString('fr', { day: '2-digit', month: 'short' }),
                  Humeur: e.mood_score,
                  Energie: e.energy_level,
                  Sommeil: e.sleep_hours,
                }))}
              margin={{ top: 8, right: 20, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" fontSize={11} stroke="#64748b" />
              <YAxis domain={[0, 10]} fontSize={11} stroke="#64748b" />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="Humeur" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="Energie" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="Sommeil" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: 20 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Historique</h3>
        {entries.length === 0 && (
          <p style={{ color: '#94a3b8' }}>Aucune entree. Cliquez sur "Enregistrer aujourd'hui" pour demarrer le suivi.</p>
        )}
        {entries.slice(0, 10).map((e: any) => (
          <div
            key={e.id}
            style={{ padding: '8px 0', borderTop: '1px solid #f1f5f9', fontSize: 13, color: '#64748b' }}
          >
            {new Date(e.entry_date || e.created_at).toLocaleDateString('fr')} — Humeur:{' '}
            {e.mood_score ?? '-'}/10, Energie: {e.energy_level ?? '-'}/10, Sommeil: {e.sleep_hours ?? '-'}h
            {e.exercise_minutes ? `, Exercice: ${e.exercise_minutes}min` : ''}
            {e.water_liters ? `, Eau: ${e.water_liters}L` : ''}
          </div>
        ))}
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
            role="dialog"
            aria-modal="true"
            aria-labelledby="health-modal-title"
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleSubmit}
            style={{
              background: '#fff',
              borderRadius: 12,
              padding: 24,
              width: 'min(520px, 92vw)',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 id="health-modal-title" style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Comment vous sentez-vous ?</h3>
              <button
                type="button"
                onClick={() => !saving && setModalOpen(false)}
                aria-label="Fermer"
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#475569' }}
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>

            <Slider
              label="Humeur"
              icon={<Heart size={16} color="#ef4444" />}
              value={form.mood_score}
              onChange={(v) => setForm({ ...form, mood_score: v })}
            />
            <Slider
              label="Energie"
              icon={<Activity size={16} color="#f59e0b" />}
              value={form.energy_level}
              onChange={(v) => setForm({ ...form, energy_level: v })}
            />

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginTop: 12 }}>
              <NumField
                label="Sommeil (h)"
                step="0.5"
                placeholder="7.5"
                value={form.sleep_hours}
                onChange={(v) => setForm({ ...form, sleep_hours: v })}
              />
              <NumField
                label="Exercice (min)"
                step="5"
                placeholder="30"
                value={form.exercise_minutes}
                onChange={(v) => setForm({ ...form, exercise_minutes: v })}
              />
              <NumField
                label="Eau (L)"
                step="0.25"
                placeholder="1.5"
                value={form.water_liters}
                onChange={(v) => setForm({ ...form, water_liters: v })}
              />
            </div>

            <label style={{ display: 'block', marginTop: 14 }}>
              <span style={{ display: 'block', fontSize: 12, color: '#475569', marginBottom: 4, fontWeight: 500 }}>
                Notes (optionnel)
              </span>
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={3}
                placeholder="Symptome, ressenti, evenement marquant…"
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  border: '1px solid #e2e8f0',
                  borderRadius: 6,
                  fontSize: 14,
                  fontFamily: 'inherit',
                  resize: 'vertical',
                  boxSizing: 'border-box',
                }}
              />
            </label>

            {error && (
              <div role="alert" style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: 12, padding: 10, background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', borderRadius: 8, fontSize: 13, lineHeight: 1.45 }}>
                <AlertTriangle size={15} aria-hidden="true" style={{ flexShrink: 0, marginTop: 1 }} />
                <span>{error}</span>
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
                {saving ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Modal « Mes constantes » (RPM) ───────────────────────────── */}
      {vitalsOpen && (
        <div
          onClick={() => !vitalsSaving && setVitalsOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}
        >
          <form
            role="dialog"
            aria-modal="true"
            aria-labelledby="vitals-modal-title"
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleVitalsSubmit}
            style={{ background: '#fff', borderRadius: 12, padding: 24, width: 'min(520px, 96vw)', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <h3 id="vitals-modal-title" style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Mes constantes du jour</h3>
              <button
                type="button"
                onClick={() => !vitalsSaving && setVitalsOpen(false)}
                aria-label="Fermer"
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#475569' }}
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>
            <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 16px', lineHeight: 1.5 }}>
              Saisissez les valeurs lues sur vos appareils. Laissez vide ce que vous n'avez pas mesuré.
            </p>

            <fieldset style={{ border: 'none', padding: 0, margin: '0 0 4px' }}>
              <legend style={{ fontSize: 12, color: '#475569', fontWeight: 600, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Gauge size={15} color="#ef4444" aria-hidden="true" /> Tension artérielle
              </legend>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <NumField
                  label="Systolique (haut)"
                  step="1"
                  placeholder="120"
                  value={vitals.blood_pressure_systolic}
                  onChange={(v) => setVitals({ ...vitals, blood_pressure_systolic: v })}
                />
                <NumField
                  label="Diastolique (bas)"
                  step="1"
                  placeholder="80"
                  value={vitals.blood_pressure_diastolic}
                  onChange={(v) => setVitals({ ...vitals, blood_pressure_diastolic: v })}
                />
              </div>
            </fieldset>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginTop: 14 }}>
              <NumField
                label="Glycémie (mg/dL)"
                step="1"
                placeholder="90"
                value={vitals.blood_glucose}
                onChange={(v) => setVitals({ ...vitals, blood_glucose: v })}
              />
              <NumField
                label="Fréq. cardiaque (bpm)"
                step="1"
                placeholder="65"
                value={vitals.heart_rate}
                onChange={(v) => setVitals({ ...vitals, heart_rate: v })}
              />
              <NumField
                label="Poids (kg)"
                step="0.1"
                placeholder="70"
                value={vitals.weight_kg}
                onChange={(v) => setVitals({ ...vitals, weight_kg: v })}
              />
              <NumField
                label="Température (°C)"
                step="0.1"
                placeholder="36.8"
                value={vitals.temperature}
                onChange={(v) => setVitals({ ...vitals, temperature: v })}
              />
            </div>

            <p style={{ fontSize: 12, color: '#94a3b8', margin: '14px 0 0', lineHeight: 1.5 }}>
              Ces relevés sont une information de prévention, pas un diagnostic, et ne remplacent pas un avis médical. En cas de malaise ou de valeur très inhabituelle, contactez votre praticien ou les urgences (15/112).
            </p>

            {vitalsError && (
              <div role="alert" style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: 12, padding: 10, background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', borderRadius: 8, fontSize: 13, lineHeight: 1.45 }}>
                <AlertTriangle size={15} aria-hidden="true" style={{ flexShrink: 0, marginTop: 1 }} />
                <span>{vitalsError}</span>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
              <button
                type="button"
                onClick={() => !vitalsSaving && setVitalsOpen(false)}
                disabled={vitalsSaving}
                style={{ padding: '10px 16px', background: '#fff', color: '#475569', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: vitalsSaving ? 'not-allowed' : 'pointer' }}
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={vitalsSaving}
                style={{ padding: '10px 16px', background: 'var(--brand-primary)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: vitalsSaving ? 'not-allowed' : 'pointer', opacity: vitalsSaving ? 0.7 : 1 }}
              >
                {vitalsSaving ? 'Enregistrement…' : 'Enregistrer mes constantes'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function Slider({
  label,
  icon,
  value,
  onChange,
}: {
  label: string;
  icon: React.ReactNode;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        {icon}
        <span style={{ fontSize: 13, color: '#475569', fontWeight: 500 }}>{label}</span>
        <span style={{ marginLeft: 'auto', fontSize: 16, fontWeight: 700, color: '#0f172a' }}>{value}/10</span>
      </div>
      <input
        type="range"
        min={1}
        max={10}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
        style={{ width: '100%', accentColor: 'var(--brand-primary)' }}
      />
    </div>
  );
}

function NumField({
  label,
  value,
  onChange,
  placeholder,
  step,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  step?: string;
}) {
  return (
    <label style={{ display: 'block' }}>
      <span style={{ display: 'block', fontSize: 12, color: '#475569', marginBottom: 4, fontWeight: 500 }}>
        {label}
      </span>
      <input
        type="number"
        step={step || '1'}
        min="0"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: '100%',
          padding: '8px 10px',
          border: '1px solid #e2e8f0',
          borderRadius: 6,
          fontSize: 14,
          background: '#fff',
          boxSizing: 'border-box',
        }}
      />
    </label>
  );
}
