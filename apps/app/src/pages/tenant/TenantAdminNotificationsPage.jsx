import { useParams, Link } from 'react-router-dom';
import { useTenantBranding } from '@/hooks/useTenantBranding';

const C = { bg: '#0d1117', panel: '#161b22', border: '#21262d', text: '#f0f6fc', muted: '#8b949e', violet: '#7c3aed', green: '#10b981' };

const NOTIF_TYPES = [
  { icon: '🎙️', title: 'Live programmé', desc: 'Rappel envoyé 24h et 1h avant chaque live.', status: 'actif' },
  { icon: '📚', title: 'Nouveau cours', desc: 'Notification à tous les inscrits à la formation.', status: 'actif' },
  { icon: '🏆', title: 'Certification', desc: 'Email automatique à la complétion du programme.', status: 'actif' },
  { icon: '📩', title: 'Invitation école', desc: "Email d'accueil lors de l'inscription.", status: 'actif' },
];

export default function TenantAdminNotificationsPage() {
  const { tenantSlug } = useParams();
  const { branding } = useTenantBranding();
  const accent = branding?.accentColor ?? C.violet;

  return (
    <div style={{ minHeight: '100vh', background: C.bg, padding: '32px 24px', fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px' }}>
          <Link to={`/t/${tenantSlug}/admin`} style={{ color: C.muted, textDecoration: 'none', fontSize: '13px' }}>← Tableau de bord</Link>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <span style={{ fontSize: '28px' }}>🔔</span>
          <h1 style={{ color: C.text, fontSize: '22px', fontWeight: 800, margin: 0 }}>Notification Engine</h1>
        </div>
        <p style={{ color: C.muted, fontSize: '14px', marginBottom: '32px' }}>
          Notifications produit, rappels live, alertes pédagogiques et emails automatiques.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {NOTIF_TYPES.map((n) => (
            <div
              key={n.title}
              style={{
                display: 'flex', alignItems: 'center', gap: '16px',
                background: C.panel, border: `1px solid ${C.border}`,
                borderRadius: '10px', padding: '16px 20px',
              }}
            >
              <span style={{ fontSize: '22px' }}>{n.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ color: C.text, fontSize: '14px', fontWeight: 700 }}>{n.title}</div>
                <div style={{ color: C.muted, fontSize: '12px' }}>{n.desc}</div>
              </div>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: '4px',
                padding: '4px 12px', background: `${C.green}20`, borderRadius: '20px',
              }}>
                <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: C.green }} />
                <span style={{ color: C.green, fontSize: '11px', fontWeight: 600 }}>{n.status}</span>
              </div>
            </div>
          ))}
        </div>

        <div style={{
          marginTop: '24px', background: C.panel, border: `1px solid ${C.border}`,
          borderRadius: '12px', padding: '20px 24px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ color: C.text, fontSize: '14px', fontWeight: 700, marginBottom: '4px' }}>Personnaliser les templates email</div>
            <div style={{ color: C.muted, fontSize: '12px' }}>Logo, couleurs et textes dans les paramètres de branding.</div>
          </div>
          <Link
            to={`/t/${tenantSlug}/admin/settings`}
            style={{
              padding: '8px 16px', background: accent, color: '#fff',
              borderRadius: '8px', textDecoration: 'none', fontWeight: 700, fontSize: '13px',
            }}
          >
            Paramètres →
          </Link>
        </div>
      </div>
    </div>
  );
}
