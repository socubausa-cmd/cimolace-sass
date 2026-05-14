import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { 
  CreditCard, 
  Lock, 
  ShieldCheck, 
  Smartphone, 
  Globe, 
  Check, 
  Clock,
  HelpCircle,
  AlertTriangle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import PremiumSegmentedSelector from '@/components/ui/premium-segmented-selector';
import { useVitrineContactEmail } from '@/contexts/VitrineContactEmailContext';

const PaymentPage = () => {
  const vitrineEmail = useVitrineContactEmail();
  const { toast } = useToast();
  const [selectedModule, setSelectedModule] = useState('academique');
  const [billingCycle, setBillingCycle] = useState('monthly');
  const [paymentMethod, setPaymentMethod] = useState('chariow');

  const pricing = {
    academique: { monthly: 45, quarterly: 120, yearly: 400 },
    coaching: { monthly: 65, quarterly: 180, yearly: 600 },
    privilegie: { monthly: 150, quarterly: 420, yearly: 1500 },
    autonome: { monthly: 29, quarterly: 80, yearly: 290 }
  };

  const currentPrice = pricing[selectedModule][billingCycle];
  const moduleOptions = [
    { value: 'academique', label: 'Académique', badge: 'Accès immédiat', icon: CreditCard },
    { value: 'coaching', label: 'Coaching', badge: 'Suivi guidé', icon: Smartphone },
    { value: 'privilegie', label: 'Privilégié', badge: 'Premium', icon: ShieldCheck },
    { value: 'autonome', label: 'Autonome', badge: 'Flexible', icon: Globe },
  ];
  const cycleOptions = [
    { value: 'monthly', label: 'Mensuel', badge: 'Paiement récurrent', icon: Clock },
    { value: 'quarterly', label: 'Trimestriel', badge: '3 mois', icon: Clock },
    { value: 'yearly', label: 'Annuel', badge: '-20%', icon: Check },
  ];
  const methodOptions = [
    { value: 'chariow', label: 'Chariow', badge: 'Carte bancaire via Chariow', icon: CreditCard },
  ];

  const handlePayment = () => {
    toast({
      title: "Redirection vers Chariow...",
      description: "Vous allez être redirigé vers la page de paiement sécurisée Chariow.",
      className: "bg-[#192734] text-white border-[#D4AF37]"
    });
  // Intégration Chariow réelle à brancher ici
  };

  return (
    <div className="min-h-screen bg-[#0F1419] font-sans pb-20">
      <Helmet>
        <title>Paiement Sécurisé - PRORASCIENCE ACADEMY</title>
      </Helmet>

      {/* Security Header */}
      <div className="bg-green-900/20 border-b border-green-900/50 py-2 text-center text-green-400 text-sm flex justify-center items-center gap-2">
         <Lock className="w-3 h-3" /> Paiement chiffré SSL 256-bit - Transaction 100% Sécurisée
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 grid lg:grid-cols-3 gap-12">
        
        {/* Left: Summary & Checkout */}
        <div className="lg:col-span-2 space-y-8">
          
          <div className="bg-[#192734] rounded-xl border border-white/5 p-8 shadow-xl">
             <h2 className="text-2xl font-serif font-bold text-white mb-6">Configuration de l'Abonnement</h2>
             
             {/* Module Selector */}
             <div className="mb-8">
                <label className="block text-gray-400 text-sm mb-3">Choisir le Module</label>
                <PremiumSegmentedSelector
                  value={selectedModule}
                  onChange={setSelectedModule}
                  options={moduleOptions}
                  layoutId="payment-page-module-segment-pill"
                />
             </div>

             {/* Billing Cycle */}
             <div className="mb-8">
                <label className="block text-gray-400 text-sm mb-3">Fréquence de facturation</label>
                <PremiumSegmentedSelector
                  value={billingCycle}
                  onChange={setBillingCycle}
                  options={cycleOptions}
                  layoutId="payment-page-cycle-segment-pill"
                />
             </div>

             {/* Total */}
             <div className="flex justify-between items-end border-t border-white/10 pt-6 mb-8">
                <div>
                   <p className="text-gray-400 text-sm">Total à payer aujourd'hui</p>
                   <p className="text-xs text-green-400 mt-1 flex items-center gap-1"><Check className="w-3 h-3"/> TVA incluse</p>
                </div>
                <div className="text-right">
                   <span className="text-4xl font-bold text-white">{currentPrice}€</span>
                   <span className="text-gray-400 text-sm"> / {billingCycle === 'monthly' ? 'mois' : billingCycle === 'quarterly' ? 'trimestre' : 'an'}</span>
                </div>
             </div>

             {/* Payment Methods */}
             <div className="mb-8">
                <label className="block text-gray-400 text-sm mb-3">Moyen de paiement</label>
                <PremiumSegmentedSelector
                  value={paymentMethod}
                  onChange={setPaymentMethod}
                  options={methodOptions}
                  layoutId="payment-page-method-segment-pill"
                />
             </div>

             <Button onClick={handlePayment} className="w-full bg-[#D4AF37] hover:bg-[#b5952f] text-black font-bold py-6 text-lg shadow-[0_0_20px_rgba(212,175,55,0.2)]">
                Procéder au Paiement Sécurisé
             </Button>
             <p className="text-center text-sm text-gray-500 mt-4">En validant, vous acceptez les Conditions Générales de Vente.</p>
          </div>

          {/* Payment Steps */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
             {[
                "Choix de l'offre", "Création de compte", "Paiement Sécurisé", "Accès Immédiat"
             ].map((step, i) => (
                <div key={i} className="text-center">
                   <div className={`w-8 h-8 rounded-full flex items-center justify-center mx-auto mb-2 text-sm font-bold ${i <= 2 ? 'bg-[#D4AF37] text-black' : 'bg-white/10 text-gray-500'}`}>{i+1}</div>
                   <span className="text-sm text-gray-400">{step}</span>
                </div>
             ))}
          </div>

        </div>

        {/* Right: Trust & Info */}
        <div className="space-y-6">
           
           <div className="bg-white/5 p-6 rounded-xl border border-white/5">
              <h3 className="text-white font-bold mb-4 flex items-center gap-2"><ShieldCheck className="text-green-500"/> Garantie Sécurité</h3>
              <ul className="space-y-3 text-sm text-gray-400">
                 <li className="flex gap-2"><Check className="w-4 h-4 text-green-500"/> Chiffrement SSL 256-bit</li>
                 <li className="flex gap-2"><Check className="w-4 h-4 text-green-500"/> Conforme PCI DSS</li>
                 <li className="flex gap-2"><Check className="w-4 h-4 text-green-500"/> 3D Secure Verification</li>
                 <li className="flex gap-2"><Check className="w-4 h-4 text-green-500"/> Données confidentielles</li>
              </ul>
           </div>

           <div className="bg-white/5 p-6 rounded-xl border border-white/5">
              <h3 className="text-white font-bold mb-4 flex items-center gap-2"><HelpCircle className="text-[#D4AF37]"/> FAQ Paiement</h3>
              <div className="space-y-4">
                 <div>
                    <p className="text-xs font-bold text-gray-300">Puis-je annuler à tout moment ?</p>
                    <p className="text-sm text-gray-500 mt-1">Oui, l'annulation arrête le renouvellement automatique à la fin de la période en cours.</p>
                 </div>
                 <div>
                    <p className="text-xs font-bold text-gray-300">Comment obtenir une facture ?</p>
                    <p className="text-sm text-gray-500 mt-1">Elle est envoyée automatiquement par email après chaque transaction.</p>
                 </div>
              </div>
           </div>

           <div className="bg-[#D4AF37]/10 p-4 rounded-xl border border-[#D4AF37]/20 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-[#D4AF37] shrink-0" />
              <p className="text-xs text-[#D4AF37]">
                 {`En cas de problème de paiement, contactez immédiatement ${vitrineEmail}`}
              </p>
           </div>

        </div>

      </div>
    </div>
  );
};

export default PaymentPage;