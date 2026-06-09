import { useParams, Link } from 'react-router-dom';
import { Brain, Layers, RefreshCw, BarChart3, ArrowRight } from 'lucide-react';
import TenantAdminShell from '@/components/admin/TenantAdminShell';
import { ADMIN_T as T } from '@/lib/tenantAdminTheme';

const FEATURES = [
  { icon: Layers, title: 'Cartes mémoire', desc: 'Générées automatiquement depuis les leçons.' },
  { icon: RefreshCw, title: 'Répétition espacée', desc: 'Algorithme SM-2 adaptatif par étudiant.' },
  { icon: BarChart3, title: 'Progression', desc: 'Suivi de mémorisation par module et étudiant.' },
];

export default function TenantAdminNeuroRecallPage() {
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
          <Brain size={20} style={{ color: T.gold }} />
        </div>
        <h1 style={{ color: T.t1, fontSize: 22, fontWeight: 800, margin: 0 }}>LIRI Neuro Recall</h1>
      </div>
      <p style={{ color: T.t2, fontSize: 14, marginBottom: 32 }}>
        Mémorisation par répétition espacée — cartes mémoire générées par IA depuis vos cours.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16, marginBottom: 32 }}>
        {FEATURES.map((item) => {
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
              <div style={{
                marginTop: 12, display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '4px 10px', background: 'rgba(34,197,94,0.12)', borderRadius: 20,
              }}>
                <div style={{ width: 5, height: 5, borderRadius: '50%', background: T.success }} />
                <span style={{ color: T.success, fontSize: 11, fontWeight: 600 }}>Actif</span>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ background: T.surfaceCard, border: `1px solid ${T.border}`, borderRadius: 14, padding: 32, textAlign: 'center' }}>
        <p style={{ color: T.t2, fontSize: 13, marginBottom: 20 }}>
          Les étudiants accèdent à Neuro Recall depuis leur espace personnel après avoir démarré un cours.
          L'admin peut configurer la génération de cartes depuis les paramètres de chaque leçon.
        </p>
        <Link
          to={`/t/${tenantSlug}/admin/courses`}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '10px 20px', background: T.gold, color: '#000',
            borderRadius: 8, textDecoration: 'none', fontWeight: 700, fontSize: 14,
          }}
        >
          Gérer les cours <ArrowRight size={16} />
        </Link>
      </div>
    </TenantAdminShell>
  );
}
