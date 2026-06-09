import React from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useBilling } from '@/contexts/BillingContext';

export default function GraceBanner() {
  const { status, inGrace, subscription, activeRenewalLink } = useBilling();
  if (!(status === 'past_due' && inGrace)) return null;

  const expiresAt = subscription?.current_period_end ? new Date(subscription.current_period_end) : null;
  const label = expiresAt ? expiresAt.toLocaleString() : null;
  const renewalPath =
    subscription?.id && subscription?.plan_id
      ? `/paiements/payer?plan=${encodeURIComponent(subscription.plan_id)}&interval=monthly&renew=${encodeURIComponent(
          subscription.id
        )}`
      : '/subscribe';
  const directCheckoutUrl = activeRenewalLink?.checkout_url || null;

  return (
    <div className="sticky top-0 z-[120] bg-amber-500/10 border-b border-amber-500/20 backdrop-blur-md">
      <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 py-2 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
        <div className="flex items-start gap-2 text-amber-200">
          <AlertTriangle className="w-4 h-4 mt-0.5" />
          <div className="text-xs">
            <div className="font-semibold">Abonnement à régulariser</div>
            <div className="text-amber-200/70">
              {label ? `Expiré le ${label}.` : 'Votre abonnement est expiré.'} Accès temporaire pendant la période de grâce.
            </div>
          </div>
        </div>
        {directCheckoutUrl ? (
          <Button asChild size="sm" className="bg-[#D4AF37] text-black hover:bg-[#bfa345] font-bold">
            <a href={directCheckoutUrl} target="_blank" rel="noreferrer">Régulariser maintenant</a>
          </Button>
        ) : (
          <Button asChild size="sm" className="bg-[#D4AF37] text-black hover:bg-[#bfa345] font-bold">
            <Link to={renewalPath}>Régulariser maintenant</Link>
          </Button>
        )}
      </div>
    </div>
  );
}

