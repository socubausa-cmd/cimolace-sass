import { LiriPortalShell } from '@/components/liri/LiriPortalShell';
import MboloStorefrontPage from '@/pages/MboloStorefrontPage';

/**
 * LiriMboloMarketPage — la VRAIE vitrine mbolo (catalogue + panier + Stripe) DANS le portail LIRI
 * (`/liri/marche`). Embarque `MboloStorefrontPage` (prop `embedded` → sans coque plein écran ni
 * fond navy) sur le fond CHAUD du portail ; l'accent `--school-accent` fourni par la coque devient
 * coral. C'est ici que vivent les cours-modules à l'unité + les produits mbolo — distinct de
 * `/liri/boutique` (Boutique Sacrée = pack rituel hardcodé). Corrige l'orphelin d'audit Q4
 * (la vraie vitrine mbolo n'était référencée dans AUCUN item de nav).
 */
export default function LiriMboloMarketPage() {
  return (
    <LiriPortalShell active="marche" rail>
      <div className="lp-scroll relative min-h-0 overflow-y-auto py-6" style={{ background: 'var(--base)', color: 'var(--ink)' }}>
        <MboloStorefrontPage embedded />
      </div>
    </LiriPortalShell>
  );
}
