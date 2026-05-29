import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Users, FileText, Pill, ClipboardList, Video, ShoppingBag, GraduationCap } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:4002';

type Consumption = {
  tenant_id: string;
  window: { from: string; to: string };
  total_minutes: number;
  total_seconds: number;
  breakdown: Array<{
    purpose: string;
    session_count: number;
    total_seconds: number;
    total_minutes: number;
  }>;
};

const PURPOSE_META: Record<string, { label: string; icon: React.ComponentType<{ size?: number; color?: string }>; color: string }> = {
  medical_teleconsult: { label: 'Téléconsultations', icon: Video, color: '#7c3aed' },
  live_shopping:       { label: 'Live shopping',     icon: ShoppingBag, color: '#f97316' },
  school_class:        { label: 'Classes en ligne',   icon: GraduationCap, color: '#0ea5e9' },
};

function authHeaders(): HeadersInit {
  const t = localStorage.getItem('supabase_token');
  return {
    Authorization: 'Bearer ' + (t || ''),
    'X-Tenant-Slug': localStorage.getItem('tenant_slug') || '',
  };
}

export function MedOSDashboard() {
  const [stats, setStats] = useState({ patients: 0, notes: 0, prescriptions: 0, forms: 0 });
  const [consumption, setConsumption] = useState<Consumption | null>(null);

  useEffect(() => {
    fetch(API + '/med/patients', { headers: authHeaders() })
      .then((r) => r.json())
      .then((d) => setStats((s) => ({ ...s, patients: (d.data || d || []).length })))
      .catch(() => {});

    // Liri consumption — only renders the card if it returns something
    fetch(API + '/liri/admin/consumption', { headers: authHeaders() })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => setConsumption(d?.data ?? null))
      .catch(() => {});
  }, []);

  const cards = [
    { icon: Users, label: 'Patients', count: stats.patients, to: '/patients', color: '#3b82f6' },
    { icon: FileText, label: 'Notes SOAP', count: stats.notes, to: '/patients', color: '#10b981' },
    { icon: Pill, label: 'Ordonnances', count: stats.prescriptions, to: '/prescriptions', color: '#f59e0b' },
    { icon: ClipboardList, label: 'Formulaires', count: stats.forms, to: '/forms', color: '#8b5cf6' },
  ];

  return (
    <div>
      <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24 }}>Dashboard MedOS</h2>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
        {cards.map((c) => (
          <Link
            key={c.label}
            to={c.to}
            style={{ background: '#fff', borderRadius: 12, padding: 20, border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 14 }}
          >
            <div style={{ width: 44, height: 44, borderRadius: 10, background: c.color + '15', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <c.icon size={20} color={c.color} />
            </div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>{c.count}</div>
              <div style={{ fontSize: 13, color: '#64748b' }}>{c.label}</div>
            </div>
          </Link>
        ))}
      </div>

      {/* Liri video consumption (cross-engine billing) */}
      {consumption && (
        <div style={{ marginTop: 24, background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Video size={18} color="#7c3aed" /> Consommation vidéo
              </h3>
              <p style={{ fontSize: 12, color: '#64748b', margin: '4px 0 0' }}>
                Du {new Date(consumption.window.from).toLocaleDateString('fr')} à aujourd'hui — via Liri (toutes sources confondues)
              </p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#7c3aed' }}>{consumption.total_minutes}</div>
              <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase' }}>minutes</div>
            </div>
          </div>

          {consumption.breakdown.length === 0 ? (
            <p style={{ fontSize: 13, color: '#94a3b8', textAlign: 'center', padding: 12, background: '#f8fafc', borderRadius: 8 }}>
              Aucune session vidéo ce mois-ci.
            </p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
              {consumption.breakdown.map((b) => {
                const meta = PURPOSE_META[b.purpose] || { label: b.purpose, icon: Video, color: '#64748b' };
                const IconCmp = meta.icon;
                return (
                  <div key={b.purpose} style={{ background: '#f8fafc', borderRadius: 8, padding: 12, display: 'flex', gap: 10, alignItems: 'center' }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: meta.color + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <IconCmp size={16} color={meta.color} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, color: '#475569', fontWeight: 500 }}>{meta.label}</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>
                        {b.total_minutes} min <span style={{ color: '#94a3b8', fontWeight: 400 }}>· {b.session_count} session{b.session_count > 1 ? 's' : ''}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div style={{ marginTop: 24, background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: 24 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Actions rapides</h3>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Link to="/patients" style={{ padding: '10px 20px', background: '#3b82f6', color: '#fff', borderRadius: 8, fontSize: 14, fontWeight: 500 }}>
            + Nouveau patient
          </Link>
          <Link to="/charting" style={{ padding: '10px 20px', background: '#10b981', color: '#fff', borderRadius: 8, fontSize: 14, fontWeight: 500 }}>
            🎙 Consultation IA
          </Link>
          <Link to="/prescriptions" style={{ padding: '10px 20px', background: '#f59e0b', color: '#fff', borderRadius: 8, fontSize: 14, fontWeight: 500 }}>
            + Ordonnance
          </Link>
          <Link to="/appointments" style={{ padding: '10px 20px', background: '#6366f1', color: '#fff', borderRadius: 8, fontSize: 14, fontWeight: 500 }}>
            + Rendez-vous
          </Link>
        </div>
      </div>
    </div>
  );
}
