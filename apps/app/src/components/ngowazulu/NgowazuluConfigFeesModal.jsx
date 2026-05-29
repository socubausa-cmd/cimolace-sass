import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

/**
 * Frais de configuration (100 EUR) — ajoutés au 1er achat d'un contrat mentorat, pas un produit séparé.
 */
export default function NgowazuluConfigFeesModal({ open, onOpenChange }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg border-amber-500/25 bg-[#121A25]/98">
        <DialogHeader>
          <DialogTitle className="text-xl font-serif text-white pr-6">
            Frais de configuration — <span className="text-[#D4AF37]">premier achat</span>
          </DialogTitle>
          <DialogDescription asChild>
            <div className="text-left text-sm text-gray-300 space-y-4 pt-2">
              <p>
                Les frais d&apos;ouverture du service de protection spirituel <span className="text-white font-medium">ne sont pas un produit</span>{' '}
                à ajouter au panier à part. Il s&apos;agit de <span className="text-[#D4AF37]">frais de configuration</span> facturés{' '}
                <span className="text-white font-medium">une seule fois</span>, lors de votre première souscription à un contrat mentorat Ngowazulu.
              </p>
              <div className="rounded-xl border border-[#D4AF37]/30 bg-[#D4AF37]/10 p-4 text-amber-100 space-y-2">
                <p className="font-semibold text-white">Montant : 100 EUR (unique)</p>
                <p className="text-xs leading-relaxed text-amber-100/95">
                  Ils couvrent la cérémonie d&apos;inauguration, la présentation du dossier au temple et l&apos;activation du cadre de protection.
                  Le système <span className="font-medium">calcule et ajoute ce montant automatiquement</span> à votre premier paiement mentorat
                  (détail sur l&apos;écran de paiement et sur la facture lorsque plusieurs lignes sont affichées).
                </p>
              </div>
              <ul className="list-disc list-inside text-gray-400 text-xs space-y-1.5">
                <li>
                  <span className="text-gray-300">Mobile Money / Monero :</span> une seule transaction incluant configuration + premier mois.
                </li>
                <li>
                  <span className="text-gray-300">Chariow :</span> vous êtes d&apos;abord orienté vers le règlement de cette étape, puis vers le contrat mensuel au tarif affiché.
                </li>
                <li>
                  <span className="text-gray-300">Mois suivants :</span> seul le tarif du palier choisi (Essentiel, Confort, etc.).
                </li>
              </ul>
            </div>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="sm:justify-end gap-2">
          <Button type="button" className="bg-[#D4AF37] text-black hover:bg-amber-500 font-bold" onClick={() => onOpenChange?.(false)}>
            J&apos;ai compris
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
