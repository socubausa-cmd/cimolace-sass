import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useCart } from '@/hooks/useCart';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle, ShoppingBag } from 'lucide-react';
import confetti from 'canvas-confetti';
import { ELEVE_MOBILE } from '@/lib/eleveMobileRoutes';

/**
 * Confirmation d'achat (panier / boutique) — partagé page web + shell `/m/eleve`.
 * @param {{ variant?: 'web' | 'eleve' }} props
 */
export function CheckoutSuccessContent({ variant = 'web' }) {
  const { clearCart } = useCart();
  const navigate = useNavigate();
  const isEleve = variant === 'eleve';

  useEffect(() => {
    try {
      clearCart();
    } catch {
      // Panier / stockage: ne bloque pas l'écran de confirmation
    }
    try {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#D4AF37', '#ffffff', '#0F1419'],
      });
    } catch {
      // canvas-confetti peut échouer si canvas indisponible
    }
  }, [clearCart]);

  useEffect(() => {
    if (typeof document === 'undefined' || !isEleve) return;
    const prev = document.title;
    document.title = 'Commande confirmée · LIRI';
    return () => {
      document.title = prev;
    };
  }, [isEleve]);

  const homePath = isEleve ? ELEVE_MOBILE.home : '/';
  const homeLabel = isEleve ? "Accueil LIRI" : "Retour à l'accueil";
  const cardClass = isEleve
    ? 'w-full max-w-md border border-green-500/30 bg-[#192734]/95 shadow-2xl backdrop-blur-sm'
    : 'premium-panel max-w-md w-full bg-[#192734] border-green-500/30 shadow-2xl';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative z-10 w-full max-w-md"
    >
      <Card className={cardClass}>
        <CardContent className="space-y-6 px-6 pb-8 pt-8 text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-green-500/10">
            <CheckCircle className="h-10 w-10 text-green-500" />
          </div>

          <div className="space-y-2">
            <h1 className="font-serif text-2xl font-bold text-white sm:text-3xl">Commande confirmée !</h1>
            <p className="text-sm text-gray-300 sm:text-base">
              Merci pour ton achat. Ta commande a été traitée avec succès.
            </p>
          </div>

          <div className="rounded-lg border border-white/5 bg-[#0F1419] p-4 text-sm text-gray-400">
            <p>Un e-mail de confirmation avec le détail de la commande t'a été envoyé.</p>
          </div>

          <div className="flex flex-col gap-3 pt-2 sm:flex-row">
            <Button
              onClick={() => navigate(homePath)}
              variant="outline"
              className="flex-1 border-white/10 text-white hover:bg-white/5"
            >
              {homeLabel}
            </Button>
            <Button
              onClick={() => navigate('/products')}
              className="flex-1 bg-[var(--school-accent)] font-bold text-black shadow-lg shadow-[color-mix(in_srgb,var(--school-accent)_20%,transparent)] hover:bg-[#b5952f]"
            >
              <ShoppingBag className="mr-2 h-4 w-4" />
              Continuer
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
