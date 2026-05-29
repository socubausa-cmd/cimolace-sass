import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle2, ArrowRight, Zap, Lock } from 'lucide-react';
import { schoolOnboardingApi } from '@/lib/api-v2';

const PLANS = [
  {
    key: 'starter',
    name: 'Starter',
    price: '79€',
    period: '/mois',
    desc: 'Formateur solo',
    features: ['SmartBoard IA', 'Marketing Creator', '50 étudiants', '1 live/mois', 'Replay 7 jours'],
    highlight: false,
  },
  {
    key: 'pro',
    name: 'Pro',
    price: '199€',
    period: '/mois',
    desc: 'École établie',
    features: ['Tout Starter +', 'Lives illimités', 'Replay permanent', '500 étudiants', 'Support prioritaire'],
    highlight: true,
  },
  {
    key: 'business',
    name: 'Business',
    price: '349€',
    period: '/mois',
    desc: 'Institut',
    features: ['Tout Pro +', 'White Label', 'Neuro Recall IA', '2 000 étudiants', 'API access'],
    highlight: false,
  },
];

const C = {
  bg: '#0d1117', panel: '#161b22', border: '#21262d',
  violet: '#7c3aed', green: '#10b981', text: '#f0f6fc', muted: '#8b949e',
};

export default function SchoolBillingPage() {
  const { tenantSlug } = useParams();
  const [loading, setLoading] = useState(null);
  const [error, setError] = useState('');

  const handleUpgrade = async (plan) => {
    setLoading(plan);
    setError('');
    try {
      const result = await schoolOnboardingApi.initiateCheckout({
        slug: tenantSlug,
        plan,
        success_url: `${window.location.origin}/t/${tenantSlug}/admin?upgraded=1`,
        cancel_url: `${window.location.origin}/t/${tenantSlug}/admin/billing`,
      });
      if (result?.checkoutUrl) {
        window.location.href = result.checkoutUrl;
      } else {
        setError('URL de paiement non reçue');
      }
    } catch (err) {
      setError(err?.message || 'Impossible d\'initier le paiement');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: C.bg, padding: '40px 24px' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        <div style={{ marginBottom: '40px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <Zap size={18} color={C.violet} />
            <span style={{ color: C.violet, fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Plans & facturation
            </span>
          </div>
          <h1 style={{ color: C.text, fontSize: '26px', fontWeight: 800, margin: 0 }}>
            Choisissez votre plan
          </h1>
          <p style={{ color: C.muted, fontSize: '14px', marginTop: '8px' }}>
            Tenant : <span style={{ fontFamily: 'monospace', color: C.text }}>{tenantSlug}</span>
          </p>
        </div>

        {error && (
          <div style={{ marginBottom: '24px', padding: '12px 16px', borderRadius: '8px', background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.30)', color: '#f87171', fontSize: '13px' }}>
            {error}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '16px' }}>
          {PLANS.map(plan => (
            <div key={plan.key} style={{
              background: plan.highlight ? 'rgba(124,58,237,0.08)' : C.panel,
              border: `1px solid ${plan.highlight ? C.violet : C.border}`,
              borderTop: `3px solid ${plan.highlight ? C.violet : C.border}`,
              borderRadius: '12px',
              padding: '24px',
              display: 'flex', flexDirection: 'column', gap: '20px',
              position: 'relative',
            }}>
              {plan.highlight && (
                <div style={{
                  position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)',
                  padding: '3px 14px', borderRadius: '999px',
                  background: C.violet, color: '#fff', fontSize: '11px', fontWeight: 700,
                }}>Recommandé</div>
              )}

              <div>
                <div style={{ color: C.text, fontSize: '18px', fontWeight: 800 }}>{plan.name}</div>
                <div style={{ color: C.muted, fontSize: '12px', marginTop: '2px' }}>{plan.desc}</div>
                <div style={{ marginTop: '12px', display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                  <span style={{ color: C.text, fontSize: '32px', fontWeight: 900 }}>{plan.price}</span>
                  <span style={{ color: C.muted, fontSize: '13px' }}>{plan.period}</span>
                </div>
              </div>

              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {plan.features.map(f => (
                  <li key={f} style={{ display: 'flex', alignItems: 'center', gap: '8px', color: C.muted, fontSize: '13px' }}>
                    <CheckCircle2 size={13} color={C.green} strokeWidth={2.5} />
                    {f}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleUpgrade(plan.key)}
                disabled={!!loading}
                style={{
                  marginTop: 'auto',
                  padding: '11px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  background: loading === plan.key ? C.violet + '99' : plan.highlight ? C.violet : 'rgba(255,255,255,0.06)',
                  color: plan.highlight ? '#fff' : C.text,
                  fontSize: '14px', fontWeight: 700,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  transition: 'all 0.18s',
                }}
              >
                {loading === plan.key ? (
                  <>
                    <div style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                    Redirection…
                  </>
                ) : (
                  <>Choisir {plan.name} <ArrowRight size={15} /></>
                )}
              </button>
            </div>
          ))}
        </div>

        <div style={{ marginTop: '32px', padding: '16px 20px', background: C.panel, border: `1px solid ${C.border}`, borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Lock size={14} color={C.muted} />
          <span style={{ color: C.muted, fontSize: '12px' }}>
            Paiement sécurisé via Stripe · Annulation à tout moment · Données hébergées en Afrique
          </span>
        </div>
      </div>
    </div>
  );
}
