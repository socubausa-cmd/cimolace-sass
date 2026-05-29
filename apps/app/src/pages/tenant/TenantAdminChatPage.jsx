import { useParams, Link } from 'react-router-dom';
import { useTenantBranding } from '@/hooks/useTenantBranding';

const C = { bg: '#0d1117', panel: '#161b22', border: '#21262d', text: '#f0f6fc', muted: '#8b949e', violet: '#7c3aed', green: '#10b981' };

export default function TenantAdminChatPage() {
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
          <span style={{ fontSize: '28px' }}>💬</span>
          <h1 style={{ color: C.text, fontSize: '22px', fontWeight: 800, margin: 0 }}>Chat Engine</h1>
        </div>
        <p style={{ color: C.muted, fontSize: '14px', marginBottom: '32px' }}>
          Messagerie en temps réel — classes, groupes et conversations directes.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '16px', minHeight: '400px' }}>
          {/* Sidebar canaux */}
          <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: '10px', overflow: 'hidden' }}>
            <div style={{ padding: '16px', borderBottom: `1px solid ${C.border}` }}>
              <span style={{ color: C.muted, fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Canaux</span>
            </div>
            {['# général', '# annonces', '# questions', '# ressources'].map((ch) => (
              <div key={ch} style={{ padding: '12px 16px', color: C.muted, fontSize: '13px', borderBottom: `1px solid ${C.border}20`, cursor: 'pointer' }}>
                {ch}
              </div>
            ))}
          </div>

          {/* Zone message */}
          <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '12px', padding: '40px' }}>
            <div style={{ fontSize: '40px' }}>💬</div>
            <h2 style={{ color: C.text, fontSize: '16px', fontWeight: 700, margin: 0 }}>Chat Engine actif</h2>
            <p style={{ color: C.muted, fontSize: '13px', textAlign: 'center', maxWidth: '360px', margin: 0 }}>
              Les étudiants et enseignants utilisent le chat en temps réel depuis leur espace.
              L'interface de modération complète arrive dans la prochaine mise à jour.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
