import { useState, useEffect, useCallback } from 'react';
import { Heart, Activity, Moon, Dumbbell, Droplets, Plus, X } from 'lucide-react';
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

export function MyHealth() {
  const [entries, setEntries] = useState<any[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<HealthForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchEntries = useCallback(() => {
    const t = localStorage.getItem('supabase_token');
    if (!t) return;
    fetch(API + '/med/me/health', {
      headers: {
        Authorization: 'Bearer ' + t,
        'X-Tenant-Slug': localStorage.getItem('tenant_slug') || '',
      },
    })
      .then((r) => r.json())
      .then((d) => setEntries(d.data || d || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const latest = entries[0] || {};
  const metrics = [
    { icon: Heart, label: 'Humeur', value: latest.mood_score, unit: '/10', color: '#ef4444' },
    { icon: Activity, label: 'Energie', value: latest.energy_level, unit: '/10', color: '#f59e0b' },
    { icon: Moon, label: 'Sommeil', value: latest.sleep_hours, unit: 'h', color: '#8b5cf6' },
    { icon: Dumbbell, label: 'Exercice', value: latest.exercise_minutes, unit: 'min', color: '#10b981' },
    { icon: Droplets, label: 'Eau', value: latest.water_liters, unit: 'L', color: '#3b82f6' },
  ];

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

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ fontSize: 24, fontWeight: 700 }}>Mon journal de sante</h2>
        <button
          onClick={openModal}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 18px', background: '#0d9488', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer' }}
        >
          <Plus size={16} /> Enregistrer aujourd'hui
        </button>
      </div>

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
              <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Comment vous sentez-vous ?</h3>
              <button
                type="button"
                onClick={() => !saving && setModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
              >
                <X size={18} />
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
              <div style={{ marginTop: 12, padding: 10, background: '#fef2f2', color: '#991b1b', borderRadius: 8, fontSize: 13 }}>
                {error}
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
                  background: '#0d9488',
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
        style={{ width: '100%', accentColor: '#0d9488' }}
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
