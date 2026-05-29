import { useParams, Link } from 'react-router-dom';
import { useTenantBranding } from '@/hooks/useTenantBranding';

const C = { bg: '#0d1117', panel: '#161b22', border: '#21262d', text: '#f0f6fc', muted: '#8b949e', violet: '#7c3aed' };

export default function TenantAdminSmartboardPage() {
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
          <span style={{ fontSize: '28px' }}>🧠</span>
          <h1 style={{ color: C.text, fontSize: '22px', fontWeight: 800, margin: 0 }}>SmartBoard Designer</h1>
        </div>
        <p style={{ color: C.muted, fontSize: '14px', marginBottom: '32px' }}>
          Tableau pédagogique interactif — créez des slides, scènes et supports visuels IA.
        </p>
        <div style={{
          background: C.panel, border: `1px solid ${C.border}`, borderRadius: '12px',
          padding: '48px', textAlign: 'center',
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎨</div>
          <h2 style={{ color: C.text, fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>SmartBoard est actif</h2>
          <p style={{ color: C.muted, fontSize: '14px', marginBottom: '24px', maxWidth: '480px', margin: '0 auto 24px' }}>
            L'éditeur SmartBoard est disponible depuis l\'interface de cours et la session live.
            Accédez-y via un cours ou une session live active.
          </p>
          <Link
            to={`/t/${tenantSlug}/admin/courses`}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              padding: '10px 20px', background: accent, color: '#fff',
              borderRadius: '8px', textDecoration: 'none', fontWeight: 700, fontSize: '14px',
            }}
          >
            Ouvrir depuis un cours →
          </Link>
        </div>
      </div>
    </div>
  );
}
