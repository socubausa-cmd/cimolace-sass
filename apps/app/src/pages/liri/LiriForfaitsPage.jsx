import { LiriPortalShell } from '@/components/liri/LiriPortalShell';
import TierAccessPanel from '@/components/liri/TierAccessPanel';

/**
 * LiriForfaitsPage — « Votre forfait & vos accès » pour un MEMBRE connecté (`/liri/forfaits`).
 *
 * Vue COMPACTE orientée membre : le forfait actuel + la matrice d'accès + les cycles pour faire
 * évoluer (TierAccessPanel). PLUS la page marketing publique ForfaitsPage embarquée (hero géant +
 * onglets + comparateur) — c'était fait pour des PROSPECTS, redondant/mal rangé pour un abonné.
 * Les VISITEURS voient les forfaits dans l'agent immersif (prorascience.org).
 */
export default function LiriForfaitsPage() {
  return (
    <LiriPortalShell active="forfaits" rail>
      <div className="lp-scroll relative min-h-0 overflow-y-auto" style={{ background: 'var(--base)', color: 'var(--ink)' }}>
        <TierAccessPanel />
      </div>
    </LiriPortalShell>
  );
}
