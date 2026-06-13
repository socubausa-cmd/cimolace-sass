import { useParams, Link } from 'react-router-dom';
import { MonitorPlay, Palette, ArrowRight } from 'lucide-react';
import TenantAdminShell from '@/components/admin/TenantAdminShell';
import { ADMIN_T as T } from '@/lib/tenantAdminTheme';

export default function TenantAdminSmartboardPage() {
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
          <MonitorPlay size={20} style={{ color: T.gold }} />
        </div>
        <h1 style={{ color: T.t1, fontSize: 22, fontWeight: 800, margin: 0 }}>SmartBoard Designer</h1>
      </div>
      <p style={{ color: T.t2, fontSize: 14, marginBottom: 32 }}>
        Tableau pédagogique interactif — créez des slides, scènes et supports visuels IA.
      </p>

      <div style={{
        background: T.surfaceCard, border: `1px solid ${T.border}`, borderRadius: 14,
        padding: 48, textAlign: 'center',
      }}>
        <div style={{
          width: 64, height: 64, borderRadius: 16, margin: '0 auto 18px',
          background: T.goldDim, border: `1px solid ${T.goldMid}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Palette size={30} style={{ color: T.gold }} />
        </div>
        <h2 style={{ color: T.t1, fontSize: 18, fontWeight: 700, marginBottom: 8 }}>SmartBoard est actif</h2>
        <p style={{ color: T.t2, fontSize: 14, maxWidth: 480, margin: '0 auto 24px' }}>
          L'éditeur SmartBoard est disponible depuis l'interface de cours et la session live.
          Accédez-y via un cours ou une session live active.
        </p>
        <Link
          to={`/t/${tenantSlug}/admin/courses`}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '10px 20px', background: T.gold, color: '#000',
            borderRadius: 8, textDecoration: 'none', fontWeight: 700, fontSize: 14,
          }}
        >
          Ouvrir depuis un cours <ArrowRight size={16} />
        </Link>
      </div>
    </TenantAdminShell>
  );
}
