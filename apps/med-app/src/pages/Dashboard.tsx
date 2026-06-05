import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Users, Pill, CalendarDays, Clock, Video, ShoppingBag, GraduationCap,
  ArrowRight, Mic, ClipboardList, ChevronRight,
} from 'lucide-react';
import { useBranding } from '../lib/branding';

const API = import.meta.env.VITE_API_URL || 'http://localhost:4002';

type Patient = { id: string; first_name?: string; last_name?: string; created_at?: string };
type Appt = {
  id: string; patient_id: string; scheduled_at: string; duration_minutes: number;
  appointment_type: string; status: string; reason?: string | null;
};
type Consumption = {
  window?: { from: string; to: string };
  total_minutes?: number;
  breakdown?: Array<{ purpose: string; session_count: number; total_minutes: number }>;
};

const PURPOSE_META: Record<string, { label: string; icon: React.ComponentType<{ size?: number; color?: string }>; color: string }> = {
  medical_teleconsult: { label: 'Téléconsultations', icon: Video, color: '#7c3aed' },
  live_shopping:       { label: 'Live shopping',      icon: ShoppingBag, color: '#f97316' },
  school_class:        { label: 'Classes en ligne',   icon: GraduationCap, color: '#0ea5e9' },
};
const APP_TYPE_LABEL: Record<string, string> = {
  in_person: 'En cabinet', teleconsult: 'Téléconsultation', phone: 'Téléphone', home_visit: 'À domicile',
};

function authHeaders(): HeadersInit {
  const t = localStorage.getItem('supabase_token');
  return { Authorization: 'Bearer ' + (t || ''), 'X-Tenant-Slug': localStorage.getItem('tenant_slug') || '' };
}
// Tolerate single- or double-wrapped API envelopes ({data:[...]} or {data:{data:[...]}}).
function asArray<T = unknown>(d: any): T[] {
  if (Array.isArray(d)) return d;
  if (Array.isArray(d?.data)) return d.data;
  if (Array.isArray(d?.data?.data)) return d.data.data;
  return [];
}
function unwrap(d: any): any {
  if (d?.data?.data && typeof d.data.data === 'object') return d.data.data;
  if (d?.data && typeof d.data === 'object') return d.data;
  return d ?? null;
}
function fullName(p?: Patient): string {
  if (!p) return 'Patient';
  return `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Sans nom';
}
function initials(p?: Patient): string {
  return fullName(p).split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase() || '?';
}

const panel: React.CSSProperties = { background: '#fff', borderRadius: 14, border: '1px solid #e8eaf0', padding: 20 };
const panelHead: React.CSSProperties = { fontSize: 15, fontWeight: 700, margin: 0, marginBottom: 14, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 7 };
const seeAll: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12.5, fontWeight: 600, color: 'var(--brand-primary)', marginTop: 12, textDecoration: 'none' };
const emptyTxt: React.CSSProperties = { fontSize: 13, color: '#94a3b8', textAlign: 'center', padding: '20px 0' };

export function MedOSDashboard() {
  const branding = useBranding();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [appts, setAppts] = useState<Appt[]>([]);
  const [prescriptions, setPrescriptions] = useState(0);
  const [consumption, setConsumption] = useState<Consumption | null>(null);

  useEffect(() => {
    fetch(API + '/med/patients', { headers: authHeaders() })
      .then((r) => (r.ok ? r.json() : null)).then((d) => setPatients(asArray<Patient>(d))).catch(() => {});
    const from = new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString();
    const to = new Date(Date.now() + 45 * 24 * 3600 * 1000).toISOString();
    fetch(`${API}/med/appointments?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, { headers: authHeaders() })
      .then((r) => (r.ok ? r.json() : null)).then((d) => setAppts(asArray<Appt>(d))).catch(() => {});
    fetch(API + '/med/prescriptions', { headers: authHeaders() })
      .then((r) => (r.ok ? r.json() : null)).then((d) => setPrescriptions(asArray(d).length)).catch(() => {});
    fetch(API + '/liri/admin/consumption', { headers: authHeaders() })
      .then((r) => (r.ok ? r.json() : null)).then((d) => {
        const c = unwrap(d);
        setConsumption(c && typeof c.total_minutes === 'number' ? c : null);
      }).catch(() => {});
  }, []);

  const now = Date.now();
  const byId: Record<string, Patient> = Object.fromEntries(patients.map((p) => [p.id, p]));
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayAppts = appts
    .filter((a) => a.scheduled_at.slice(0, 10) === todayStr && a.status !== 'cancelled')
    .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));
  const upcomingCount = appts.filter((a) => new Date(a.scheduled_at).getTime() >= now && a.status !== 'cancelled').length;
  const recentPatients = [...patients]
    .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
    .slice(0, 5);

  const kpis = [
    { icon: Users, label: 'Patients', value: patients.length, to: '/patients', color: 'var(--brand-primary)', tint: 'var(--brand-primary-soft)' },
    { icon: CalendarDays, label: 'RDV à venir', value: upcomingCount, to: '/appointments', color: '#0ea5e9', tint: '#0ea5e918' },
    { icon: Clock, label: "RDV aujourd'hui", value: todayAppts.length, to: '/appointments', color: '#10b981', tint: '#10b98118' },
    { icon: Pill, label: 'Ordonnances', value: prescriptions, to: '/prescriptions', color: '#f59e0b', tint: '#f59e0b18' },
  ];

  const quick = [
    { to: '/patients', label: 'Nouveau patient', icon: Users, brand: true, color: 'var(--brand-primary)' },
    { to: '/charting', label: 'Consultation IA', icon: Mic, brand: false, color: '#10b981' },
    { to: '/prescriptions', label: 'Ordonnance', icon: Pill, brand: false, color: '#f59e0b' },
    { to: '/appointments', label: 'Rendez-vous', icon: CalendarDays, brand: false, color: '#0ea5e9' },
    { to: '/forms', label: 'Formulaire', icon: ClipboardList, brand: false, color: '#8b5cf6' },
  ];

  return (
    <div>
      <div style={{ marginBottom: 22 }}>
        <h2 style={{ fontSize: 24, fontWeight: 800, margin: 0, color: '#0f172a' }}>Bonjour 👋</h2>
        <p style={{ color: '#64748b', fontSize: 14, marginTop: 4 }}>
          Votre espace praticien{branding?.name ? ` · ${branding.name}` : ''} — voici votre journée.
        </p>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 14, marginBottom: 22 }}>
        {kpis.map((k) => (
          <Link key={k.label} to={k.to} style={{ ...panel, padding: 18, display: 'flex', alignItems: 'center', gap: 14, textDecoration: 'none' }}>
            <div style={{ width: 46, height: 46, borderRadius: 12, background: k.tint, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <k.icon size={21} color={k.color} />
            </div>
            <div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>{k.value}</div>
              <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 4 }}>{k.label}</div>
            </div>
          </Link>
        ))}
      </div>

      {/* Agenda du jour + Patients récents */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16, marginBottom: 22 }}>
        <div style={panel}>
          <h3 style={panelHead}>📅 Agenda du jour</h3>
          {todayAppts.length === 0 ? (
            <p style={emptyTxt}>Aucun rendez-vous aujourd'hui.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {todayAppts.map((a) => (
                <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: '#f8fafc', borderRadius: 10 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--brand-primary)', minWidth: 46 }}>
                    {new Date(a.scheduled_at).toLocaleTimeString('fr', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fullName(byId[a.patient_id])}</div>
                    <div style={{ fontSize: 11.5, color: '#94a3b8' }}>{a.duration_minutes}min · {APP_TYPE_LABEL[a.appointment_type] || a.appointment_type}</div>
                  </div>
                  {a.appointment_type === 'teleconsult' && (
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#7c3aed', background: '#7c3aed15', padding: '3px 8px', borderRadius: 8 }}>VISIO</span>
                  )}
                </div>
              ))}
            </div>
          )}
          <Link to="/appointments" style={seeAll}>Voir tout l'agenda <ArrowRight size={13} /></Link>
        </div>

        <div style={panel}>
          <h3 style={panelHead}>🧑‍⚕️ Patients récents</h3>
          {recentPatients.length === 0 ? (
            <p style={emptyTxt}>Aucun patient pour le moment.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {recentPatients.map((p) => (
                <Link key={p.id} to={`/patients/${p.id}`} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px', borderRadius: 10, textDecoration: 'none' }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--brand-primary-soft)', color: 'var(--brand-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12.5, fontWeight: 700, flexShrink: 0 }}>
                    {initials(p)}
                  </div>
                  <div style={{ flex: 1, fontSize: 13.5, fontWeight: 600, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fullName(p)}</div>
                  <ChevronRight size={15} color="#cbd5e1" />
                </Link>
              ))}
            </div>
          )}
          <Link to="/patients" style={seeAll}>Tous les patients <ArrowRight size={13} /></Link>
        </div>
      </div>

      {/* Quick actions */}
      <div style={{ ...panel, marginBottom: 22 }}>
        <h3 style={panelHead}>⚡ Actions rapides</h3>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {quick.map((q) => (
            <Link key={q.label} to={q.to} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 16px', background: q.color, color: '#fff', borderRadius: 10, fontSize: 13.5, fontWeight: 600, textDecoration: 'none' }}>
              <q.icon size={15} /> {q.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Liri video consumption (cross-engine billing) */}
      {consumption && (
        <div style={panel}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
            <div>
              <h3 style={{ ...panelHead, marginBottom: 2 }}><Video size={16} color="#7c3aed" /> Consommation vidéo</h3>
              <p style={{ fontSize: 11.5, color: '#94a3b8', margin: 0 }}>Via Liri — toutes sources confondues</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 26, fontWeight: 800, color: '#7c3aed', lineHeight: 1 }}>{consumption.total_minutes ?? 0}</div>
              <div style={{ fontSize: 10.5, color: '#94a3b8', textTransform: 'uppercase' }}>minutes</div>
            </div>
          </div>
          {consumption.breakdown && consumption.breakdown.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
              {consumption.breakdown.map((b) => {
                const meta = PURPOSE_META[b.purpose] || { label: b.purpose, icon: Video, color: '#64748b' };
                const Icon = meta.icon;
                return (
                  <div key={b.purpose} style={{ background: '#f8fafc', borderRadius: 10, padding: 12, display: 'flex', gap: 10, alignItems: 'center' }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: meta.color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Icon size={16} color={meta.color} />
                    </div>
                    <div>
                      <div style={{ fontSize: 11.5, color: '#475569', fontWeight: 500 }}>{meta.label}</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{b.total_minutes} min</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
