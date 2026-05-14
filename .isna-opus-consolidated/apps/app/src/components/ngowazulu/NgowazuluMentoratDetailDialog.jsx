import React from 'react';
import { Link } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export default function NgowazuluMentoratDetailDialog({
  offer,
  open,
  onOpenChange,
  payerBasePath = '/paiements/payer',
  onExplainConfigFees,
}) {
  if (!offer) return null;
  const href = `${payerBasePath}?plan=${encodeURIComponent(offer.slug)}&interval=monthly`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-[#D4AF37]/20">
        <DialogHeader>
          <DialogTitle className="text-xl font-serif text-white pr-6">
            Mentorat <span className="text-[#D4AF37]">{offer.commercialName}</span>
          </DialogTitle>
          <DialogDescription className="text-left text-gray-400 text-sm space-y-3 pt-2">
            <p>
              <span className="text-white font-semibold">Contrat d’un mois.</span> Chaque offre couvre une période d’un mois ;
              ce qui change, c’est le <span className="text-[#D4AF37]">nombre de rencontres</span> avec le maître : vous choisissez la
              fréquence (Essentiel à Souverain) selon votre situation.
            </p>
            <p className="text-gray-300">{offer.detailIntro}</p>
            <ul className="list-disc list-inside space-y-1 text-gray-300">
              {offer.bullets.map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
            <p className="text-xs text-amber-200/90">
              <span className="font-semibold text-amber-100">Premier achat :</span> des{' '}
              <span className="text-[#D4AF37]">frais de configuration</span> (100 EUR, uniques) sont ajoutés automatiquement — ce n&apos;est pas un produit séparé.
            </p>
            {onExplainConfigFees ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-amber-500/40 text-amber-100 hover:bg-amber-500/10 w-full sm:w-auto"
                onClick={() => onExplainConfigFees()}
              >
                Voir le détail des frais de configuration
              </Button>
            ) : null}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col sm:flex-row gap-2 pt-2">
          <Button asChild className="bg-[#D4AF37] text-black hover:bg-amber-500 font-bold">
            <Link to={href} onClick={() => onOpenChange?.(false)}>
              Souscrire — {offer.priceLabel}
            </Link>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
