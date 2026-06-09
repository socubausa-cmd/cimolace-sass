import { useParams, Link } from 'react-router-dom';
import { Sparkles, Drama, Image, Radio, Rocket, ArrowRight } from 'lucide-react';
import TenantAdminShell from '@/components/admin/TenantAdminShell';
import { ADMIN_T as T } from '@/lib/tenantAdminTheme';

const ITEMS = [
  { icon: Drama, title: 'Scènes', desc: 'Créez et gérez les scènes de vos lives.' },
  { icon: Image, title: 'Assets', desc: 'Images, overlays, fonds et médias studio.' },
  { icon: Radio, title: 'Pre-live', desc: 'Configurer et tester avant le démarrage.' },
];

export default function TenantAdminStudioPage() {
  const { tenantSlug } = useParams();

  return (
    <TenantAdminShell>
      <Link to={`/t/${tenantSlug}/admin`} style={{ color: T.t3, textDecoration: 'none', fontSize: 13 }}>← Tableau de bord</Link>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0 8px' }}>
        <div style={{
          width: 40, height: 40, borderRadius: 11, flexShrink: 0,
          background: T.goldDim, border: `1px solid ${T.goldMid}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Sparkles size={20} style={{ color: T.gold }} />
        </div>
        <h1 style={{ color: T.t1, fontSize: 22, fontWeight: 800, margin: 0 }}>Studio Creator LIRI</h1>
      </div>
      <p style={{ color: T.t2, fontSize: 14, marginBottom: 32 }}>
        Préparez, produisez et assemblez vos sessions live — scènes, assets, overlays.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16, marginBottom: 32 }}>
        {ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.title} style={{ background: T.surfaceCard, border: `1px solid ${T.border}`, borderRadius: 14, padding: 20 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 10, marginBottom: 12,
                background: T.goldDim, border: `1px solid ${T.goldMid}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon size={20} style={{ color: T.gold }} />
              </div>
              <h3 style={{ color: T.t1, fontSize: 14, fontWeight: 700, margin: '0 0 4px' }}>{item.title}</h3>
              <p style={{ color: T.t2, fontSize: 12, margin: 0 }}>{item.desc}</p>
            </div>
          );
        })}
      </div>

      <div style={{ background: T.surfaceCard, border: `1px solid ${T.border}`, borderRadius: 14, padding: 32, textAlign: 'center' }}>
        <div style={{
          width: 56, height: 56, borderRadius: 14, margin: '0 auto 14px',
          background: T.goldDim, border: `1px solid ${T.goldMid}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Rocket size={26} style={{ color: T.gold }} />
        </div>
        <h2 style={{ color: T.t1, fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Studio Creator actif</h2>
        <p style={{ color: T.t2, fontSize: 13, marginBottom: 24 }}>
          Accédez au studio depuis une session live pour commencer la production.
        </p>
        <Link
          to={`/t/${tenantSlug}/admin/lives`}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '10px 20px', background: T.gold, color: '#000',
            borderRadius: 8, textDecoration: 'none', fontWeight: 700, fontSize: 14,
          }}
        >
          Aller aux lives <ArrowRight size={16} />
        </Link>
      </div>
    </TenantAdminShell>
  );
}
