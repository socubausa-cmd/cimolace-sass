import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Crown, Sparkles, Clock, ArrowRight } from 'lucide-react';
import { useBilling } from '@/contexts/BillingContext';
import useMemberEntitlements from '@/hooks/useMemberEntitlements';
import { isLaunchTrialActive, launchTrialDaysLeft } from '@/lib/liri/memberTier';

/**
 * COMPTEUR / RAPPEL DE FORFAIT — dans le back-office (portail) de chaque MEMBRE. Montre son forfait
 * (Autonome = Temple ; Académique = Academy ; Privé/Privilégié) OU, pendant l'essai de lancement,
 * l'accès complet gratuit jusqu'au 5 août 2026 + les jours restants. Clic → /liri/forfaits.
 * Masqué pour le staff/propriétaire (rank 99, ils ne paient pas de cycle élève).
 */
export default function ForfaitReminder() {
  const nav = useNavigate();
  const billing = useBilling() || {};
  const { cycle, label, rank } = useMemberEntitlements();

  if (rank >= 99) return null; // staff / propriétaire : pas de rappel forfait

  const paid = !!cycle; // forfait réellement payé (Autonome/Académique/…)
  const trial = isLaunchTrialActive();
  const daysLeft = launchTrialDaysLeft();
  const renewAt = billing.subscription?.current_period_end;
  const fmtDate = (iso) => {
    try { return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }); } catch { return ''; }
  };

  let Icon = Sparkles;
  let title;
  let sub;
  let cta;
  let accent; // couleur d'accent (chaude)
  if (paid) {
    Icon = Crown;
    title = `Forfait ${label}`;
    sub = renewAt ? `Renouvellement le ${fmtDate(renewAt)}` : 'Actif';
    cta = 'Gérer mon forfait';
    accent = '#e6cc92'; // or
  } else if (trial) {
    Icon = Clock;
    title = 'Essai gratuit — accès complet à tout';
    sub = `Jusqu'au 5 août · plus que ${daysLeft} jour${daysLeft > 1 ? 's' : ''} pour choisir ton forfait`;
    cta = 'Choisir mon forfait';
    accent = '#d97757'; // coral
  } else {
    Icon = Sparkles;
    title = 'Aucun forfait actif';
    sub = 'Choisis ton cours (Autonome ou Académique) pour garder l\'accès';
    cta = 'Voir les forfaits';
    accent = '#d97757';
  }

  return (
    <button
      type="button"
      onClick={() => nav('/liri/forfaits')}
      aria-label={`${title} — ${cta}`}
      style={{
        display: 'flex', alignItems: 'center', gap: 14, width: '100%', textAlign: 'left',
        padding: '14px 16px', borderRadius: 16, cursor: 'pointer',
        border: `1px solid ${accent}55`,
        background: `linear-gradient(180deg, ${accent}18, ${accent}0a)`,
        color: 'var(--lp-ink, #f5f1e9)', transition: 'border-color .18s ease, transform .18s ease',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = `${accent}aa`; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = `${accent}55`; }}
    >
      <span style={{
        flexShrink: 0, display: 'grid', placeItems: 'center', height: 40, width: 40, borderRadius: 12,
        background: `${accent}22`, color: accent,
      }}>
        <Icon size={20} />
      </span>
      <span style={{ minWidth: 0, flex: 1 }}>
        <span style={{ display: 'block', fontWeight: 700, fontSize: 14, lineHeight: 1.25 }}>{title}</span>
        <span style={{ display: 'block', fontSize: 12.5, opacity: 0.72, marginTop: 2 }}>{sub}</span>
      </span>
      <span style={{
        flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12.5,
        fontWeight: 600, color: accent, whiteSpace: 'nowrap',
      }}>
        {cta} <ArrowRight size={14} />
      </span>
    </button>
  );
}
