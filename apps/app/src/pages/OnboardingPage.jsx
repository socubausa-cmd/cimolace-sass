import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { GraduationCap, Stethoscope, ShoppingBag, Users2, ArrowRight } from 'lucide-react';

const INFRA = [
  { key: 'school',    icon: GraduationCap, label: 'École en ligne',  desc: '11 moteurs · Live, cours, IA', to: '/cimolace/create-school', color: '#10b981', available: true },
  { key: 'medos',     icon: Stethoscope,   label: 'MedOS',            desc: 'EHR · praticiens · patients',  to: '/cimolace/login',         color: '#3b82f6', available: true },
  { key: 'mbolo',     icon: ShoppingBag,   label: 'Virtuel Mbolo',    desc: 'Commerce · catalogue',         to: null,                      color: '#f59e0b', available: false },
  { key: 'community', icon: Users2,        label: 'Community Hub',    desc: 'Forum · messagerie',            to: null,                      color: '#8b5cf6', available: false },
];

export default function OnboardingPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const infra = params.get('infra');

  // Redirection directe si un type d'infra est passé en query
  useEffect(() => {
    if (infra) {
      const target = INFRA.find(i => i.key === infra);
      if (target?.to) { navigate(target.to, { replace: true }); return; }
    }
    // Sans param, afficher le sélecteur
  }, [infra, navigate]);

  return (
    <div style={{ minHeight: '100vh', background: '#0d1117', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' }}>
      <div style={{ textAlign: 'center', marginBottom: '48px' }}>
        <div style={{ color: '#7c3aed', fontSize: '13px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '12px' }}>
          Cimolace — Démarrer
        </div>
        <h1 style={{ color: '#f0f6fc', fontSize: 'clamp(24px, 4vw, 40px)', fontWeight: 900, lineHeight: 1.2, marginBottom: '12px' }}>
          Quelle infrastructure voulez-vous lancer ?
        </h1>
        <p style={{ color: '#8b949e', fontSize: '15px', maxWidth: '480px', lineHeight: 1.6 }}>
          Chaque infrastructure est un tenant complet avec tous ses moteurs activés. Lancez-vous en 3 minutes.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '16px', width: '100%', maxWidth: '900px' }}>
        {INFRA.map(({ key, icon: Icon, label, desc, to, color, available }) => (
          <div
            key={key}
            onClick={() => available && to && navigate(to)}
            style={{
              padding: '24px',
              background: '#161b22',
              border: `1px solid ${available ? color + '33' : '#21262d'}`,
              borderTop: `3px solid ${available ? color : '#21262d'}`,
              borderRadius: '12px',
              cursor: available ? 'pointer' : 'not-allowed',
              opacity: available ? 1 : 0.5,
              transition: 'all 0.18s ease',
              display: 'flex', flexDirection: 'column', gap: '16px',
            }}
            onMouseEnter={e => { if (available) e.currentTarget.style.background = '#1c2128'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#161b22'; }}
          >
            <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon size={22} color={color} strokeWidth={1.7} />
            </div>
            <div>
              <div style={{ color: '#f0f6fc', fontSize: '16px', fontWeight: 700, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                {label}
                {!available && <span style={{ fontSize: '10px', padding: '2px 7px', borderRadius: '999px', background: '#21262d', color: '#6e7681', fontWeight: 600 }}>Bientôt</span>}
              </div>
              <div style={{ color: '#8b949e', fontSize: '12px' }}>{desc}</div>
            </div>
            {available && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: color, fontSize: '13px', fontWeight: 600, marginTop: 'auto' }}>
                Lancer <ArrowRight size={14} />
              </div>
            )}
          </div>
        ))}
      </div>

      <div style={{ marginTop: '32px', color: '#6e7681', fontSize: '12px' }}>
        Déjà un compte ?{' '}
        <span
          onClick={() => navigate('/cimolace/login')}
          style={{ color: '#8b5cf6', cursor: 'pointer', textDecoration: 'underline' }}
        >
          Se connecter
        </span>
      </div>
    </div>
  );
}
