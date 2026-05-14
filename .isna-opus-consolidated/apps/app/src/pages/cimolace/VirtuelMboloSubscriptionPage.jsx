import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  CreditCard, CheckCircle, ArrowRight, ChevronLeft,
  Zap, Calendar, Shield, AlertCircle
} from 'lucide-react';

/* ═══════════════════════════════════════════════════════════════
   PAGE ABONNEMENT PAYPAL - Virtuel-Mbolo™
═══════════════════════════════════════════════════════════════ */

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 }
};

const stagger = (delay = 0.1) => ({
  visible: { transition: { staggerChildren: delay } }
});

const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    price: 150,
    description: 'Lancez votre boutique avec l\'essentiel',
    color: '#06b6d4',
    features: [
      'Boutique en ligne professionnelle',
      'Paiement Stripe + Chariow',
      'Gestion des commandes',
      'Support technique',
      'Hébergement inclus'
    ]
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 200,
    description: 'Structurez votre business',
    color: '#8b5cf6',
    popular: true,
    features: [
      'Tout Starter inclus',
      'CRM client intégré',
      'Assistant IA LIRI',
      'Facturation automatique',
      'Paiements échelonnés',
      'Relances automatiques'
    ]
  },
  {
    id: 'elite',
    name: 'Elite',
    price: 300,
    description: 'Scalez avec le marketing IA',
    color: '#f59e0b',
    features: [
      'Tout Pro inclus',
      'Moteur Marketing LIRI',
      'Live Selling',
      'Funnel de vente',
      'Communauté client',
      'Analytics avancé'
    ]
  }
];

export default function VirtuelMboloSubscriptionPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { plan: preselectedPlan, customer } = location.state || {};
  
  const [selectedPlan, setSelectedPlan] = useState(preselectedPlan || 'pro');
  const [billingCycle, setBillingCycle] = useState('monthly'); // monthly, yearly
  const [step, setStep] = useState('select'); // select, payment, success

  const currentPlan = PLANS.find(p => p.id === selectedPlan);
  const yearlyDiscount = 0.15; // 15% de réduction en annuel

  const calculatePrice = () => {
    const basePrice = currentPlan.price;
    if (billingCycle === 'yearly') {
      return Math.round(basePrice * 12 * (1 - yearlyDiscount));
    }
    return basePrice;
  };

  const handleSubscribe = () => {
    setStep('payment');
    // Simulation du paiement PayPal
    setTimeout(() => {
      setStep('success');
    }, 3000);
  };

  const handleGoToDashboard = () => {
    navigate('/cimolace/admin', { 
      state: { 
        plan: selectedPlan, 
        setupPaid: true,
        subscriptionActive: true,
        customer 
      } 
    });
  };

  return (
    <>
      <Helmet>
        <title>Abonnement | Virtuel-Mbolo™ | CIMOLACE</title>
        <meta name="description" content="Activez votre abonnement Virtuel-Mbolo™. Paiement sécurisé via PayPal. Forfaits Starter (150€), Pro (200€), Elite (300€) par mois." />
      </Helmet>

      <div className="min-h-screen bg-[#050507] text-white">
        {/* Header */}
        <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 backdrop-blur-xl bg-[#050507]/80 border-b border-white/[0.04]">
          <Link to="/cimolace" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center">
              <Zap className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-sm font-black tracking-tight">CIMOLACE</span>
          </Link>
          <Link 
            to="/cimolace/dashboard" 
            className="text-xs text-white/40 hover:text-white/80 transition-colors flex items-center gap-1"
          >
            <ChevronLeft className="w-3 h-3" /> Dashboard
          </Link>
        </nav>

        <div className="pt-24 pb-12 px-6">
          <div className="max-w-5xl mx-auto">
            {step === 'select' && (
              <motion.div
                initial="hidden"
                animate="visible"
                variants={stagger(0.1)}
              >
                {/* Titre */}
                <motion.div variants={fadeUp} className="text-center mb-12">
                  <span className="text-xs tracking-[0.3em] uppercase text-violet-400 mb-4 block">
                    Activer votre abonnement
                  </span>
                  <h1 className="text-3xl md:text-5xl font-black text-white mb-4">
                    Choisissez votre forfait
                  </h1>
                  <p className="text-lg text-white/60 max-w-xl mx-auto">
                    Configuration déjà payée (500€). Activez maintenant votre abonnement mensuel.
                  </p>
                </motion.div>

                {/* Toggle mensuel/annuel */}
                <motion.div variants={fadeUp} className="flex justify-center mb-12">
                  <div className="inline-flex items-center gap-2 p-1 bg-white/[0.05] rounded-xl">
                    <button
                      onClick={() => setBillingCycle('monthly')}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        billingCycle === 'monthly' 
                          ? 'bg-violet-500 text-white' 
                          : 'text-white/60 hover:text-white'
                      }`}
                    >
                      Mensuel
                    </button>
                    <button
                      onClick={() => setBillingCycle('yearly')}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                        billingCycle === 'yearly' 
                          ? 'bg-violet-500 text-white' 
                          : 'text-white/60 hover:text-white'
                      }`}
                    >
                      Annuel
                      <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full">
                        -15%
                      </span>
                    </button>
                  </div>
                </motion.div>

                {/* Cartes des forfaits */}
                <motion.div variants={fadeUp} className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {PLANS.map((plan) => (
                    <div
                      key={plan.id}
                      onClick={() => setSelectedPlan(plan.id)}
                      className={`relative p-6 rounded-2xl cursor-pointer transition-all ${
                        selectedPlan === plan.id
                          ? 'bg-white/[0.05] border-2'
                          : 'bg-white/[0.02] border border-white/[0.08] hover:border-white/[0.15]'
                      }`}
                      style={{ 
                        borderColor: selectedPlan === plan.id ? plan.color : undefined 
                      }}
                    >
                      {plan.popular && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-gradient-to-r from-violet-500 to-purple-500 text-white text-xs font-bold rounded-full">
                          Populaire
                        </div>
                      )}

                      <div className="text-center mb-6">
                        <h3 className="text-xl font-bold text-white mb-2">{plan.name}</h3>
                        <div className="flex items-baseline justify-center gap-1">
                          <span className="text-4xl font-black" style={{ color: plan.color }}>
                            {billingCycle === 'yearly' 
                              ? Math.round(plan.price * 12 * (1 - yearlyDiscount))
                              : plan.price
                            }€
                          </span>
                          <span className="text-white/40">
                            {billingCycle === 'yearly' ? '/an' : '/mois'}
                          </span>
                        </div>
                        <p className="text-sm text-white/50 mt-2">{plan.description}</p>
                      </div>

                      <ul className="space-y-3 mb-6">
                        {plan.features.map((feature, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-white/70">
                            <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: plan.color }} />
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>

                      <div className={`w-6 h-6 rounded-full border-2 mx-auto flex items-center justify-center ${
                        selectedPlan === plan.id 
                          ? 'border-violet-500 bg-violet-500' 
                          : 'border-white/20'
                      }`}>
                        {selectedPlan === plan.id && (
                          <CheckCircle className="w-4 h-4 text-white" />
                        )}
                      </div>
                    </div>
                  ))}
                </motion.div>

                {/* Récapitulatif */}
                <motion.div variants={fadeUp} className="mt-12 text-center">
                  <div className="inline-block bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6">
                    <p className="text-white/60 mb-2">Total à payer maintenant</p>
                    <p className="text-4xl font-black text-white mb-4">{calculatePrice()}€</p>
                    <p className="text-sm text-white/40 mb-6">
                      {billingCycle === 'yearly' 
                        ? `Paiement annuel (économie de ${Math.round(currentPlan.price * 12 * yearlyDiscount)}€)`
                        : 'Paiement mensuel récurrent'
                      }
                    </p>
                    
                    <button
                      onClick={handleSubscribe}
                      className="flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-r from-violet-500 to-cyan-500 text-white font-bold rounded-xl hover:shadow-lg hover:shadow-violet-500/25 transition-all"
                    >
                      <CreditCard className="w-5 h-5" />
                      Payer avec PayPal
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}

            {step === 'payment' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-20"
              >
                <div className="w-20 h-20 mx-auto mb-6 relative">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                    className="w-full h-full border-4 border-violet-500/20 border-t-violet-500 rounded-full"
                  />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">Connexion à PayPal...</h2>
                <p className="text-white/60">Vous allez être redirigé vers PayPal pour finaliser le paiement</p>
              </motion.div>
            )}

            {step === 'success' && (
              <motion.div
                initial="hidden"
                animate="visible"
                variants={stagger(0.1)}
                className="text-center py-12"
              >
                <motion.div variants={fadeUp} className="w-20 h-20 mx-auto mb-6 bg-green-500/20 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-10 h-10 text-green-400" />
                </motion.div>
                
                <motion.h2 variants={fadeUp} className="text-3xl font-black text-white mb-4">
                  Abonnement activé !
                </motion.h2>
                
                <motion.p variants={fadeUp} className="text-lg text-white/60 mb-8 max-w-md mx-auto">
                  Votre forfait {currentPlan.name} est maintenant actif. Vous recevrez une confirmation par email.
                </motion.p>

                <motion.div variants={fadeUp} className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6 max-w-md mx-auto mb-8 text-left">
                  <div className="flex items-center gap-3 mb-4">
                    <Calendar className="w-8 h-8 text-violet-400" />
                    <div>
                      <p className="font-bold text-white">Prochaine facture</p>
                      <p className="text-sm text-white/50">
                        {billingCycle === 'yearly' ? 'Dans 1 an' : 'Dans 30 jours'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Shield className="w-8 h-8 text-cyan-400" />
                    <div>
                      <p className="font-bold text-white">Annulation</p>
                      <p className="text-sm text-white/50">Sans engagement, résiliable à tout moment</p>
                    </div>
                  </div>
                </motion.div>

                <motion.button
                  variants={fadeUp}
                  onClick={handleGoToDashboard}
                  className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-violet-500 to-cyan-500 text-white font-bold rounded-xl hover:shadow-lg hover:shadow-violet-500/25 transition-all"
                >
                  Retour au dashboard <ArrowRight className="w-5 h-5" />
                </motion.button>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
