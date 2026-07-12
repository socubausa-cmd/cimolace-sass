import { LiriPortalShell } from '@/components/liri/LiriPortalShell';
import BoutiquePage from '@/pages/BoutiquePage';

/**
 * LiriBoutiquePage — la Boutique Sacrée Ngowazulu DANS le portail LIRI (`/liri/boutique`).
 * Embarque `BoutiquePage` (prop `embedded`) dans le shell du portail. Remplace la page
 * standalone `/boutique-sacree`. Pack indivisible (9 objets rituels, 700 €, service
 * `ngowazulu-boutique-sacree` en base).
 */
export default function LiriBoutiquePage() {
  return (
    <LiriPortalShell active="boutique" rail>
      <div className="lp-scroll relative min-h-0 overflow-y-auto py-6" style={{ background: 'var(--base)', color: 'var(--ink)' }}>
        <BoutiquePage embedded />
      </div>
    </LiriPortalShell>
  );
}
