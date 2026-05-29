import { useParams, Link } from 'react-router-dom';
import { useTenantBranding } from '@/hooks/useTenantBranding';

const C = { bg: '#0d1117', panel: '#161b22', border: '#21262d', text: '#f0f6fc', muted: '#8b949e', violet: '#7c3aed', green: '#10b981' };

export default function TenantAdminStudioPage() {
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
          <span style={{ fontSize: '28px' }}>🎬</span>
          <h1 style={{ color: C.text, fontSize: '22px', fontWeight: 800, margin: 0 }}>Studio Creator LIRI</h1>
        </div>
        <p style={{ color: C.muted, fontSize: '14px', marginBottom: '32px' }}>
          Préparez, produisez et assemblez vos sessions live — scènes, assets, overlays.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px', marginBottom: '32px' }}>
          {[
            { icon: '🎭', title: 'Scènes', desc: 'Créez et gérez les scènes de vos lives.' },
            { icon: '🖼️', title: 'Assets', desc: 'Images, overlays, fonds et médias studio.' },
            { icon: '📡', title: 'Pre-live', desc: 'Configurer et tester avant le démarrage.' },
          ].map((item) => (
            <div key={item.title} style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: '10px', padding: '20px' }}>
              <div style={{ fontSize: '24px', marginBottom: '10px' }}>{item.icon}</div>
              <h3 style={{ color: C.text, fontSize: '14px', fontWeight: 700, margin: '0 0 4px' }}>{item.title}</h3>
              <p style={{ color: C.muted, fontSize: '12px', margin: 0 }}>{item.desc}</p>
            </div>
          ))}
        </div>

        <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: '12px', padding: '32px', textAlign: 'center' }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>🚀</div>
          <h2 style={{ color: C.text, fontSize: '16px', fontWeight: 700, marginBottom: '8px' }}>Studio Creator actif</h2>
          <p style={{ color: C.muted, fontSize: '13px', marginBottom: '24px' }}>
            Accédez au studio depuis une session live pour commencer la production.
          </p>
          <Link
            to={`/t/${tenantSlug}/admin/lives`}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              padding: '10px 20px', background: accent, color: '#fff',
              borderRadius: '8px', textDecoration: 'none', fontWeight: 700, fontSize: '14px',
            }}
          >
            Aller aux lives →
          </Link>
        </div>
      </div>
    </div>
  );
}
