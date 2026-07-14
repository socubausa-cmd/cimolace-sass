import { LiriPortalShell } from '@/components/liri/LiriPortalShell';
import UpsellLock from '@/components/liri/UpsellLock';
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
        {/* Temple & cultes = inclus DÈS Autonome (feature 'temple', rang 1). Un membre sans forfait
            actif (rank 0) voit la carte de vente ; tout abonné (ou staff) accède au Temple entier. */}
        <UpsellLock
          feature="temple"
          title="Temple & cultes — Espace Ngowazulu"
          benefit="Cultes en ligne, consultations spirituelles, interventions mystiques, voyages initiatiques et communauté. Inclus dès le forfait Autonome."
        >
          <NgowazuluTemplePage embedded basePath="/liri/temple" />
        </UpsellLock>
      </div>
    </LiriPortalShell>
  );
}
