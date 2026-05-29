/**
 * Dashboard admin de l'école — /t/:tenantSlug/admin
 * Accès réservé aux membres du tenant (via TenantProtectedRoute).
 */
import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { tenantsApi } from '@/lib/api-v2';
import { useTenantBranding } from '@/hooks/useTenantBranding';

const C = {
  bg: '#0d1117', panel: '#161b22', border: '#21262d',
  violet: '#7c3aed', green: '#10b981', orange: '#f59e0b',
  text: '#f0f6fc', muted: '#8b949e',
};

function StatCard({ label, value, color, icon }) {
  return (
    <div style={{
      background: C.panel, border: `1px solid ${C.border}`,
      borderLeft: `3px solid ${color ?? C.violet}`,
      borderRadius: '10px', padding: '16px 20px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
        <span style={{ fontSize: '16px' }}>{icon}</span>
        <span style={{ color: C.muted, fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
      </div>
      <div style={{ color: C.text, fontSize: '28px', fontWeight: 900 }}>
        {value ?? <span style={{ fontSize: '20px', color: C.muted }}>—</span>}
      </div>
    </div>
  );
}

const QUICK_ACTIONS = [
  { label: 'Cours', icon: '📚', path: '/admin/courses', desc: 'Créer et gérer les formations' },
  { label: 'Étudiants', icon: '👩‍🎓', path: '/admin/students', desc: 'Gérer les inscriptions' },
  { label: 'Lives', icon: '🎙️', path: '/admin/lives', desc: 'Planifier et lancer des lives' },
  { label: 'Membres', icon: '👥', path: '/admin/members', desc: "Équipe de l'école" },
  { label: 'Facturation', icon: '💳', path: '/admin/billing', desc: 'Plans et paiements' },
  { label: 'Paramètres', icon: '⚙️', path: '/admin/settings', desc: 'Branding et configuration' },
];

const ENGINES = [
  { key: 'course_builder',      label: 'Course Builder',    icon: '📖', path: '/admin/courses' },
  { key: 'liri_live',           label: 'Liri Live',         icon: '🎙️', path: '/admin/lives' },
  { key: 'liri_replay',         label: 'Liri Replay',       icon: '▶️',  path: '/admin/lives' },
  { key: 'liri_smartboard',     label: 'SmartBoard',        icon: '🧠', path: '/admin/smartboard' },
  { key: 'marketing_creator',   label: 'Marketing Creator', icon: '📣', path: '/admin/marketing' },
  { key: 'studio_creator',      label: 'Studio Creator',    icon: '🎬', path: '/admin/studio' },
  { key: 'liri_neuro_recall',   label: 'Neuro Recall',      icon: '💡', path: '/admin/neuro-recall' },
  { key: 'calendar',            label: 'Calendar',          icon: '📅', path: '/admin/calendar' },
  { key: 'pay_engine',          label: 'Pay Engine',        icon: '💳', path: '/admin/billing' },
  { key: 'chat_engine',         label: 'Chat',              icon: '💬', path: '/admin/chat' },
  { key: 'notif_engine',        label: 'Notifications',     icon: '🔔', path: '/admin/notifications' },
];

export default function SchoolAdminDashboard() {
  const { tenantSlug } = useParams();
  const navigate = useNavigate();
  const { branding } = useTenantBranding();
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);

  const accent = branding?.accentColor ?? C.violet;
  const schoolName = branding?.name ?? tenantSlug;

  useEffect(() => {
    tenantsApi.dashboard()
      .then(setDashboard)
      .catch(() => setDashboard(null))
      .finally(() => setLoading(false));
  }, [tenantSlug]);

  const stats = dashboard?.stats ?? {};

  return (
    <div style={{ minHeight: '100vh', background: C.bg, padding: '32px 24px', fontFamily: "'Inter', system-ui, sans-serif" }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
              {branding?.logo && (
                <img src={branding.logo} alt="" style={{ height: '32px', objectFit: 'contain' }} />
              )}
              <h1 style={{ color: C.text, fontSize: '22px', fontWeight: 800, margin: 0 }}>
                {schoolName}
              </h1>
            </div>
            <p style={{ color: C.muted, fontSize: '13px', margin: 0 }}>
              Tableau de bord administrateur · <span style={{ fontFamily: 'monospace' }}>{tenantSlug}</span>
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <Link
              to={`/t/${tenantSlug}`}
              style={{
                padding: '8px 14px', borderRadius: '8px',
                border: `1px solid ${C.border}`, background: 'transparent',
                color: C.muted, fontSize: '13px', fontWeight: 600,
                textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px',
              }}
            >
              Voir le site public
            </Link>
            <Link
              to={`/t/${tenantSlug}/admin/courses`}
              style={{
                padding: '8px 16px', borderRadius: '8px', border: 'none',
                background: accent, color: '#fff', fontSize: '13px', fontWeight: 700,
                textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px',
              }}
            >
              + Nouveau cours
            </Link>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px', marginBottom: '32px' }}>
          <StatCard label="Étudiants" value={loading ? null : (stats.studentCount ?? 0)} color={accent} icon="👩‍🎓" />
          <StatCard label="Cours" value={loading ? null : (stats.courseCount ?? 0)} color={C.green} icon="📚" />
          <StatCard label="Lives planifiés" value={loading ? null : (stats.upcomingLiveCount ?? stats.liveCount ?? 0)} color={C.orange} icon="🎙️" />
          <StatCard label="Membres" value={loading ? null : (stats.memberCount ?? 0)} color="#3b82f6" icon="👥" />
        </div>

        {/* Quick actions */}
        <div style={{ marginBottom: '32px' }}>
          <h2 style={{ color: C.text, fontSize: '14px', fontWeight: 700, marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Actions rapides
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '10px' }}>
            {QUICK_ACTIONS.map((action) => (
              <Link
                key={action.key}
                to={`/t/${tenantSlug}${action.path}`}
                style={{
                  background: C.panel, border: `1px solid ${C.border}`,
                  borderRadius: '10px', padding: '16px',
                  textDecoration: 'none', display: 'flex', flexDirection: 'column', gap: '6px',
                  cursor: 'pointer', transition: 'border-color 0.15s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = accent; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.border; }}
              >
                <span style={{ fontSize: '22px' }}>{action.icon}</span>
                <span style={{ color: C.text, fontSize: '13px', fontWeight: 700 }}>{action.label}</span>
                <span style={{ color: C.muted, fontSize: '11px' }}>{action.desc}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Engines status */}
        <div>
          <h2 style={{ color: C.text, fontSize: '14px', fontWeight: 700, marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Moteurs actifs (11/11)
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '8px' }}>
            {ENGINES.map((engine) => (
              <Link
                key={engine.key}
                to={`/t/${tenantSlug}${engine.path}`}
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '12px 14px', borderRadius: '8px',
                  background: C.panel, border: `1px solid ${C.border}`,
                  textDecoration: 'none', transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#1c2128'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = C.panel; }}
              >
                <span style={{ fontSize: '16px' }}>{engine.icon}</span>
                <div>
                  <div style={{ color: C.text, fontSize: '12px', fontWeight: 600 }}>{engine.label}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                    <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: C.green }} />
                    <span style={{ color: C.green, fontSize: '10px', fontWeight: 600 }}>Actif</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
