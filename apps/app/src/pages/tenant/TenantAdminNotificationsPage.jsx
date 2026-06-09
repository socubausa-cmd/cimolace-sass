import { useParams, Link } from 'react-router-dom';
import { Bell, Mic, BookOpen, Award, Mail, ArrowRight } from 'lucide-react';
import TenantAdminShell from '@/components/admin/TenantAdminShell';
import { ADMIN_T as T } from '@/lib/tenantAdminTheme';

const NOTIF_TYPES = [
  { icon: Mic, title: 'Live programmé', desc: 'Rappel envoyé 24h et 1h avant chaque live.', status: 'actif' },
  { icon: BookOpen, title: 'Nouveau cours', desc: 'Notification à tous les inscrits à la formation.', status: 'actif' },
  { icon: Award, title: 'Certification', desc: 'Email automatique à la complétion du programme.', status: 'actif' },
  { icon: Mail, title: 'Invitation école', desc: "Email d'accueil lors de l'inscription.", status: 'actif' },
];

export default function TenantAdminNotificationsPage() {
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
          <Bell size={20} style={{ color: T.gold }} />
        </div>
        <h1 style={{ color: T.t1, fontSize: 22, fontWeight: 800, margin: 0 }}>Notification Engine</h1>
      </div>
      <p style={{ color: T.t2, fontSize: 14, marginBottom: 32 }}>
        Notifications produit, rappels live, alertes pédagogiques et emails automatiques.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {NOTIF_TYPES.map((n) => {
          const Icon = n.icon;
          return (
            <div
              key={n.title}
              style={{
                display: 'flex', alignItems: 'center', gap: 16,
                background: T.surfaceCard, border: `1px solid ${T.border}`,
                borderRadius: 14, padding: '16px 20px',
              }}
            >
              <div style={{
                width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                background: T.goldDim, border: `1px solid ${T.goldMid}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon size={18} style={{ color: T.gold }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ color: T.t1, fontSize: 14, fontWeight: 700 }}>{n.title}</div>
                <div style={{ color: T.t2, fontSize: 12 }}>{n.desc}</div>
              </div>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '4px 12px', background: 'rgba(34,197,94,0.12)', borderRadius: 20,
              }}>
                <div style={{ width: 5, height: 5, borderRadius: '50%', background: T.success }} />
                <span style={{ color: T.success, fontSize: 11, fontWeight: 600 }}>{n.status}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{
        marginTop: 24, background: T.surfaceCard, border: `1px solid ${T.border}`,
        borderRadius: 14, padding: '20px 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ color: T.t1, fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Personnaliser les templates email</div>
          <div style={{ color: T.t2, fontSize: 12 }}>Logo, couleurs et textes dans les paramètres de branding.</div>
        </div>
        <Link
          to={`/t/${tenantSlug}/admin/settings`}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '8px 16px', background: T.gold, color: '#000',
            borderRadius: 8, textDecoration: 'none', fontWeight: 700, fontSize: 13,
          }}
        >
          Paramètres <ArrowRight size={15} />
        </Link>
      </div>
    </TenantAdminShell>
  );
}
