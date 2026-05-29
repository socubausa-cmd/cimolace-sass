import { useParams, Link } from 'react-router-dom';
import { useTenantBranding } from '@/hooks/useTenantBranding';

const C = { bg: '#0d1117', panel: '#161b22', border: '#21262d', text: '#f0f6fc', muted: '#8b949e', violet: '#7c3aed', green: '#10b981' };

export default function TenantAdminNeuroRecallPage() {
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
          <span style={{ fontSize: '28px' }}>💡</span>
          <h1 style={{ color: C.text, fontSize: '22px', fontWeight: 800, margin: 0 }}>LIRI Neuro Recall</h1>
        </div>
        <p style={{ color: C.muted, fontSize: '14px', marginBottom: '32px' }}>
          Mémorisation par répétition espacée — cartes mémoire générées par IA depuis vos cours.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '16px', marginBottom: '32px' }}>
          {[
            { icon: '🃏', title: 'Cartes mémoire', desc: 'Générées automatiquement depuis les leçons.' },
            { icon: '🔁', title: 'Répétition espacée', desc: 'Algorithme SM-2 adaptatif par étudiant.' },
            { icon: '📊', title: 'Progression', desc: "Suivi de mémorisation par module et étudiant." },
          ].map((item) => (
            <div key={item.title} style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: '10px', padding: '20px' }}>
              <div style={{ fontSize: '24px', marginBottom: '10px' }}>{item.icon}</div>
              <h3 style={{ color: C.text, fontSize: '14px', fontWeight: 700, margin: '0 0 4px' }}>{item.title}</h3>
              <p style={{ color: C.muted, fontSize: '12px', margin: 0 }}>{item.desc}</p>
              <div style={{
                marginTop: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px',
                padding: '4px 10px', background: `${C.green}20`, borderRadius: '20px',
              }}>
                <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: C.green }} />
                <span style={{ color: C.green, fontSize: '11px', fontWeight: 600 }}>Actif</span>
              </div>
            </div>
          ))}
        </div>

        <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: '12px', padding: '32px', textAlign: 'center' }}>
          <p style={{ color: C.muted, fontSize: '13px', marginBottom: '20px' }}>
            Les étudiants accèdent à Neuro Recall depuis leur espace personnel après avoir démarré un cours.
            L'admin peut configurer la génération de cartes depuis les paramètres de chaque leçon.
          </p>
          <Link
            to={`/t/${tenantSlug}/admin/courses`}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              padding: '10px 20px', background: accent, color: '#fff',
              borderRadius: '8px', textDecoration: 'none', fontWeight: 700, fontSize: '14px',
            }}
          >
            Gérer les cours →
          </Link>
        </div>
      </div>
    </div>
  );
}
