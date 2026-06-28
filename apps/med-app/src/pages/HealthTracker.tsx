import { useState, useEffect } from 'react';
import { Heart, Activity, Moon, Dumbbell, Droplets } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:4002';

export function HealthTracker() {
  const [entries, setEntries] = useState<any[]>([]);

  useEffect(() => {
    const token = localStorage.getItem('supabase_token');
    if (!token) return;
    // DÉFENSIF : entries DOIT rester un tableau. Sur une réponse non-array
    // (404/erreur → objet), entries.slice() plantait TOUTE l'app (white-screen
    // « a.slice is not a function »). On normalise toute réponse en tableau.
    fetch(API + '/med/health', { headers: { Authorization: 'Bearer ' + token, 'X-Tenant-Slug': localStorage.getItem('tenant_slug') || '' } })
      .then(r => (r.ok ? r.json() : null))
      .then(d => setEntries(Array.isArray(d) ? d : Array.isArray(d?.data) ? d.data : []))
      .catch(() => setEntries([]));
  }, []);

  const metrics = [
    { icon: Heart, label: 'Humeur', key: 'mood_score', unit: '/10', color: '#ef4444' },
    { icon: Activity, label: 'Energie', key: 'energy_level', unit: '/10', color: '#f59e0b' },
    { icon: Moon, label: 'Sommeil', key: 'sleep_hours', unit: 'h', color: 'var(--zw-violet-soft)' },
    { icon: Dumbbell, label: 'Exercice', key: 'exercise_minutes', unit: 'min', color: '#10b981' },
    { icon: Droplets, label: 'Eau', key: 'water_liters', unit: 'L', color: '#3b82f6' },
  ];

  return (
    <div>
      <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 20 }}>Suivi sante</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, marginBottom: 24 }}>
        {metrics.map(m => (
          <div key={m.key} style={{ background: '#fff', borderRadius: 12, border: '1px solid var(--zw-border)', padding: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
            <m.icon size={20} color={m.color} />
            <div><div style={{ fontSize: 12, color: 'var(--zw-text-muted)' }}>{m.label}</div>
              {/* Le roll-up est trié du plus récent au plus ancien → entries[0]. */}
              <div style={{ fontSize: 18, fontWeight: 700 }}>{entries[0]?.[m.key] || '-'} <span style={{ fontSize: 12, color: 'var(--zw-text-faint)' }}>{m.unit}</span></div>
            </div>
          </div>
        ))}
      </div>
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid var(--zw-border)', padding: 20 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Dernieres entrees patients</h3>
        {entries.length === 0 && <p style={{ color: 'var(--zw-text-faint)' }}>Aucune entree de suivi</p>}
        {entries.slice(0, 20).map((e: any) => (
          <div key={e.id} style={{ padding: '8px 0', borderTop: '1px solid var(--zw-bg-subtle)', fontSize: 13, color: 'var(--zw-text-muted)' }}>
            {e.patient_name ? <strong style={{ color: 'var(--zw-text)' }}>{e.patient_name}</strong> : 'Patient'}
            {' — '}
            {new Date(e.entry_date || e.created_at).toLocaleDateString('fr')} — Humeur: {e.mood_score || '-'}/10, Sommeil: {e.sleep_hours || '-'}h
            {e.exercise_minutes ? `, Exercice: ${e.exercise_minutes}min` : ''}
            {e.water_liters ? `, Eau: ${e.water_liters}L` : ''}
          </div>
        ))}
      </div>
    </div>
  );
}
