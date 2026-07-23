import { LiriPortalShell } from '@/components/liri/LiriPortalShell';
import MboloStorefrontPage from '@/pages/MboloStorefrontPage';
import { useMemberEntitlements } from '@/hooks/useMemberEntitlements';
import { Store, Settings2 } from 'lucide-react';

/**
 * LiriMboloMarketPage — la VRAIE vitrine mbolo (catalogue + panier + Stripe) DANS le portail LIRI
 * (`/liri/marche`). Embarque `MboloStorefrontPage` (prop `embedded` → sans coque plein écran ni
 * fond navy) sur le fond CHAUD du portail ; l'accent `--school-accent` devient coral.
 *
 * ⚠️ RÔLE-AWARE (anti-contradiction demandée par le fondateur) : un MEMBRE achète (panier +
 * checkout) ; un PROPRIÉTAIRE/STAFF **vend** → il ne doit PAS voir « acheter mes propres produits ».
 * Pour le staff : bannière « vue propriétaire » + `staffPreview` (masque panier/Ajouter/Commander)
 * + raccourci « Gérer les produits ». Distinct de `/liri/boutique` (Boutique Sacrée = pack rituel).
 */
export default function LiriMboloMarketPage() {
  const { isStaff } = useMemberEntitlements();
  return (
    <LiriPortalShell active="marche" rail>
      <div className="lp-scroll relative min-h-0 overflow-y-auto py-6" style={{ background: 'var(--base)', color: 'var(--ink)' }}>
        {isStaff && (
          <div className="mx-auto max-w-6xl px-4">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#d97757]/30 bg-[#d97757]/[0.07] px-4 py-3">
              <p className="flex items-start gap-2 text-[13px] leading-snug text-white/85">
                <Store className="mt-0.5 h-4 w-4 shrink-0 text-[#d97757]" />
                <span>
                  <span className="font-semibold text-white">Vue propriétaire</span> — aperçu de votre boutique, tel que
                  le voient vos clients. Vous ne commandez pas vos propres produits.
                </span>
              </p>
              <a
                href="/liri/mbolo/produits"
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-white/20 px-3 py-1.5 text-[13px] font-semibold text-white/85 transition-colors hover:bg-white/[0.06]"
              >
                <Settings2 className="h-3.5 w-3.5 text-[#d97757]" /> Gérer les produits
              </a>
            </div>
          </div>
        )}
        <MboloStorefrontPage embedded staffPreview={isStaff} />
      </div>
    </LiriPortalShell>
  );
}
