import { useParams, Link } from 'react-router-dom';
import { useTenantBranding } from '@/hooks/useTenantBranding';
import TenantAdminShell from '@/components/admin/TenantAdminShell';
import { ADMIN_T } from '@/lib/tenantAdminTheme';

const C = { bg: ADMIN_T.bg, panel: ADMIN_T.surface, border: ADMIN_T.border, text: ADMIN_T.t1, muted: ADMIN_T.t2, violet: ADMIN_T.gold, green: ADMIN_T.success };

const TOOLS = [
  { icon: '🎯', title: 'Bannières', desc: 'Bannières promotionnelles pour votre vitrine et emails.' },
  { icon: '📢', title: 'Popups', desc: "Popups d'annonce, inscription et offres spéciales." },
  { icon: '🏷️', title: 'Codes promo', desc: 'Créez des codes promo pour vos formations et modules.' },
  { icon: '📧', title: 'Email marketing', desc: 'Campagnes email vers vos étudiants et prospects.' },
];

export default function TenantAdminMarketingPage() {
  const { tenantSlug } = useParams();
  const { branding } = useTenantBranding();
  const accent = branding?.accentColor ?? C.violet;

  return (
    <TenantAdminShell>
      <div style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <span style={{ fontSize: '28px' }}>📣</span>
          <h1 style={{ color: C.text, fontSize: '22px', fontWeight: 800, margin: 0 }}>Marketing Creator</h1>
        </div>
        <p style={{ color: C.muted, fontSize: '14px', marginBottom: '32px' }}>
          Bannières, popups, codes promo et activation commerciale pour votre école.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '16px' }}>
          {TOOLS.map((tool) => (
            <div
              key={tool.title}
              style={{
                background: ADMIN_T.surfaceCard, border: `1px solid ${C.border}`,
                borderRadius: '14px', padding: '24px',
              }}
            >
              <div style={{ fontSize: '28px', marginBottom: '12px' }}>{tool.icon}</div>
              <h3 style={{ color: C.text, fontSize: '15px', fontWeight: 700, margin: '0 0 6px' }}>{tool.title}</h3>
              <p style={{ color: C.muted, fontSize: '13px', margin: 0 }}>{tool.desc}</p>
              <div style={{
                marginTop: '16px', display: 'inline-flex', alignItems: 'center', gap: '4px',
                padding: '4px 10px', background: `${C.green}20`, borderRadius: '20px',
              }}>
                <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: C.green }} />
                <span style={{ color: C.green, fontSize: '11px', fontWeight: 600 }}>Moteur actif</span>
              </div>
            </div>
          ))}
        </div>
        <div style={{
          marginTop: '32px', background: ADMIN_T.surfaceCard, border: `1px solid ${accent}40`,
          borderRadius: '14px', padding: '24px', textAlign: 'center',
        }}>
          <p style={{ color: C.muted, fontSize: '13px', margin: '0 0 16px' }}>
            L'interface Marketing Creator complète est disponible dans la prochaine mise à jour.
            Le moteur est actif et prêt pour les campagnes.
          </p>
          <Link
            to={`/t/${tenantSlug}/admin`}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              padding: '10px 20px', background: accent, color: '#000',
              borderRadius: '8px', textDecoration: 'none', fontWeight: 700, fontSize: '14px',
            }}
          >
            Retour au tableau de bord
          </Link>
        </div>
      </div>
    </TenantAdminShell>
  );
}
