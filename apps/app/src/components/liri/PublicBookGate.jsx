/**
 * PublicBookGate — ferme la FUITE des pages livre publiques standalone (/fond-de-tout,
 * /dialogue-physique, /ontodynamique, /manuel-initiatique-bris-de-sort). Ces URLs canoniques
 * SEO laissaient un prospect DÉCONNECTÉ lire l'intégralité du corpus premium.
 *
 * Compromis SEO ↔ paywall : pendant le chargement du billing (1er paint / crawler) ET pour un
 * abonné/staff → contenu PLEIN (indexable, aucun flash de mur). Sinon → aperçu court (mask fade)
 * + UpsellLock qui vend le forfait. Gate SOFT côté client (l'enforcement dur = servir le texte
 * via fetch authentifié, suivi backend) — mais coupe la lecture casual des non-abonnés.
 */
import UpsellLock from '@/components/liri/UpsellLock';
import { useMemberEntitlements } from '@/hooks/useMemberEntitlements';

export default function PublicBookGate({ feature = 'library', children }) {
  const { can, isStaff, loading } = useMemberEntitlements();

  // Crawler / 1er paint / abonné / staff → texte plein.
  if (loading || isStaff || can(feature)) return children;

  return (
    <div className="relative">
      <div className="max-h-[68vh] overflow-hidden [mask-image:linear-gradient(to_bottom,black_50%,transparent)]">
        {children}
      </div>
      <div className="relative z-10 mx-auto -mt-28 max-w-lg px-4 pb-16">
        <UpsellLock
          feature={feature}
          title="Lecture intégrale réservée aux forfaits"
          benefit="Vous lisez l'aperçu. Activez un forfait pour accéder au texte complet du corpus Prorascience."
        />
      </div>
    </div>
  );
}
