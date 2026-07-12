import { LiriPortalShell } from '@/components/liri/LiriPortalShell';
import NgowazuluTemplePage from '@/pages/ngowazulu/NgowazuluTemplePage';

/**
 * LiriTemplePage — le « Pôle Temple » Ngowazulu (Espace Ngowazulu) DANS le portail LIRI
 * (`/liri/temple`, `/liri/temple/:section`). Embarque `NgowazuluTemplePage` (prop `embedded`
 * = sans coque plein écran) dans le shell du portail. Remplace la page standalone `/ngowazulu`.
 * 7 sections : Culte en ligne, Consultations, Interventions mystiques, Hôpital traditionnel,
 * Voyages initiatiques, Communauté, Règlement intérieur (tables ngowazulu_* portées en base).
 */
export default function LiriTemplePage() {
  return (
    <LiriPortalShell active="temple" rail>
      <div className="lp-scroll relative min-h-0 overflow-y-auto py-6" style={{ background: 'var(--base)', color: 'var(--ink)' }}>
        <NgowazuluTemplePage embedded basePath="/liri/temple" />
      </div>
    </LiriPortalShell>
  );
}
