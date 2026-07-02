import React, { useState } from 'react';
import { Sparkles, ArrowRight } from 'lucide-react';
import LiriUpgradeWall from '@/components/liri/LiriUpgradeWall';
import { useLiriEntitlements } from '@/hooks/useLiriEntitlements';
import { useAuth } from '@/hooks/useAuth';
import { isCreatorRole } from '@/lib/liri/creatorRole';

/**
 * Bandeau de palier LIRI (Couche A : Cimolace facture le tenant). Affiché si le
 * tenant est en GRATUIT ou en ESSAI : rappelle les limites (live 3 min / 5 pers,
 * sans replay/IA) + CTA « passer au complet » → mur d'upgrade IN-LIRI (modal). Rien si payant.
 *
 * Additif et sans risque : aucune logique de moteur, juste l'affichage du palier.
 */
export default function LiriFreeTierBanner({ className = '' }) {
  const { tenantRole } = useAuth();
  const { tier, limits } = useLiriEntitlements();
  const [showUpgrade, setShowUpgrade] = useState(false);
  // Palier + facturation = affaire du CRÉATEUR (CTA → mur d'upgrade IN-LIRI, jamais
  // /cimolace/*). L'élève ne voit jamais l'upsell. Fail-closed (rôle non résolu → masqué).
  if (!isCreatorRole(tenantRole)) return null;
  if (tier === 'paid') return null;
  const isTrial = tier === 'trial';
  return (
    <>
    <div
      className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 ${className}`}
      style={{
        borderColor: 'color-mix(in srgb, var(--school-accent, #d97757) 35%, transparent)',
        background: 'color-mix(in srgb, var(--school-accent, #d97757) 10%, transparent)',
      }}
    >
      <div className="flex items-center gap-2 text-sm text-white/85">
        <Sparkles className="h-4 w-4 shrink-0" style={{ color: 'var(--school-accent, #d97757)' }} aria-hidden />
        {isTrial ? (
          <span><strong>Essai LIRI</strong> — tout est débloqué. Activez votre abonnement avant la fin pour ne rien perdre.</span>
        ) : (
          <span>
            <strong>Version gratuite</strong> — vos lives sont limités à <strong>{limits.maxLiveMinutes} min</strong> et{' '}
            <strong>{limits.maxParticipants} participants</strong> (sans replay ni smartboard&nbsp;IA).
          </span>
        )}
      </div>
      <button
        type="button"
        onClick={() => setShowUpgrade(true)}
        className="inline-flex shrink-0 items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-semibold text-white transition hover:opacity-90"
        style={{ background: 'var(--school-accent, #d97757)' }}
      >
        Passer au complet <ArrowRight className="h-3.5 w-3.5" aria-hidden />
      </button>
    </div>
      {showUpgrade && <LiriUpgradeWall asModal onClose={() => setShowUpgrade(false)} />}
    </>
  );
}
