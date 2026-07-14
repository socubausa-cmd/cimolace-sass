import { LiriPortalShell } from '@/components/liri/LiriPortalShell';
import ForfaitsPage from '@/pages/ForfaitsPage';
import TierAccessPanel from '@/components/liri/TierAccessPanel';

/**
 * LiriForfaitsPage — les FORFAITS/cycles du tenant DANS le portail LIRI (`/liri/forfaits`).
 *
 * Remplace l'ancienne vitrine standalone « Prorascience PORTAIL » (/forfaits + header séparé)
 * pour les MEMBRES connectés : mêmes offres + même moteur de paiement (ForfaitsPage embarqué,
 * `embedded` → sans coque plein écran), mais dans le shell du portail LIRI (rail + thème chaud).
 * Les VISITEURS voient les forfaits dans l'agent immersif (prorascience.org) ; /forfaits redirige.
 */
export default function LiriForfaitsPage() {
  return (
    <LiriPortalShell active="forfaits" rail>
      <div className="lp-scroll relative min-h-0 overflow-y-auto" style={{ background: 'var(--base)', color: 'var(--ink)' }}>
        <TierAccessPanel />
        <ForfaitsPage embedded />
      </div>
    </LiriPortalShell>
  );
}
