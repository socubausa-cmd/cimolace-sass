import { useParams, Link } from 'react-router-dom';
import { MessageCircle } from 'lucide-react';
import TenantAdminShell from '@/components/admin/TenantAdminShell';
import { ADMIN_T as T } from '@/lib/tenantAdminTheme';

const CHANNELS = ['# général', '# annonces', '# questions', '# ressources'];

export default function TenantAdminChatPage() {
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
          <MessageCircle size={20} style={{ color: T.gold }} />
        </div>
        <h1 style={{ color: T.t1, fontSize: 22, fontWeight: 800, margin: 0 }}>Chat Engine</h1>
      </div>
      <p style={{ color: T.t2, fontSize: 14, marginBottom: 32 }}>
        Messagerie en temps réel — classes, groupes et conversations directes.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 16, minHeight: 400 }}>
        {/* Sidebar canaux */}
        <div style={{ background: T.surfaceCard, border: `1px solid ${T.border}`, borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ padding: 16, borderBottom: `1px solid ${T.border}` }}>
            <span style={{ color: T.t3, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Canaux</span>
          </div>
          {CHANNELS.map((ch) => (
            <div key={ch} style={{ padding: '12px 16px', color: T.t2, fontSize: 13, borderBottom: `1px solid ${T.border}`, cursor: 'pointer' }}>
              {ch}
            </div>
          ))}
        </div>

        {/* Zone message */}
        <div style={{ background: T.surfaceCard, border: `1px solid ${T.border}`, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 14, padding: 40 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 14,
            background: T.goldDim, border: `1px solid ${T.goldMid}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <MessageCircle size={26} style={{ color: T.gold }} />
          </div>
          <h2 style={{ color: T.t1, fontSize: 16, fontWeight: 700, margin: 0 }}>Chat Engine actif</h2>
          <p style={{ color: T.t2, fontSize: 13, textAlign: 'center', maxWidth: 360, margin: 0 }}>
            Les étudiants et enseignants utilisent le chat en temps réel depuis leur espace.
            L'interface de modération complète arrive dans la prochaine mise à jour.
          </p>
        </div>
      </div>
    </TenantAdminShell>
  );
}
