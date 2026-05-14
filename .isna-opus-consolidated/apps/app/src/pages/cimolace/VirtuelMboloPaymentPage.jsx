import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  CreditCard, Smartphone, CheckCircle, ArrowRight, 
  Shield, Clock, Store, Zap, ChevronLeft
} from 'lucide-react';
import { fetchTenantContext } from '@/lib/tenant/fetchTenantContext';

/* ═══════════════════════════════════════════════════════════════
   PAGE PAIEMENT 500€ - Configuration Virtuel-Mbolo™
═══════════════════════════════════════════════════════════════ */

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 }
};

const stagger = (delay = 0.1) => ({
  visible: { transition: { staggerChildren: delay } }
});

export default function VirtuelMboloPaymentPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const selectedPlan = location.state?.selectedPlan || 'starter';
  
  const [step, setStep] = useState('form'); // form, processing, success
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    businessName: '',
  });

  const planDetails = {
    starter: { name: 'Starter', price: 150, monthly: 150 },
    pro: { name: 'Pro', price: 200, monthly: 200 },
    elite: { name: 'Elite', price: 300, monthly: 300 }
  };

  const currentPlan = planDetails[selectedPlan];

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleChariowPayment = async () => {
    setStep('processing');

    try {
      const tenantCtx = await fetchTenantContext().catch(() => null);
      const tenantSlug = tenantCtx?.slug ? String(tenantCtx.slug).trim().toLowerCase() : '';
      const response = await fetch('/.netlify/functions/billing/create-virtuelmbolo-setup-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(tenantSlug ? { 'X-Cimolace-Tenant-Slug': tenantSlug } : {}),
        },
        body: JSON.stringify({
          email: formData.email,
          name: formData.name,
          phone: formData.phone,
          phoneCountryCode: 'GA', // Gabon par défaut pour Virtuel-Mbolo
          plan: selectedPlan,
          paymentMethod: 'chariow',
          ...(tenantSlug ? { tenant: tenantSlug } : {}),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Erreur lors de la création du paiement');
      }

      if (result.checkoutUrl) {
        // Rediriger vers Chariow
        window.location.href = result.checkoutUrl;
      } else {
        throw new Error('URL de paiement non disponible');
      }
    } catch (error) {
      console.error('Erreur de paiement:', error);
      alert(`Erreur: ${error.message}`);
      setStep('form');
    }
  };

  const handleGoToDashboard = () => {
    navigate('/cimolace/admin', { 
      state: { 
        plan: selectedPlan, 
        setupPaid: true,
        customer: formData 
      } 
    });
  };

  return (
    <>
      <Helmet>
        <title>Paiement Configuration 500€ | Virtuel-Mbolo™ | CIMOLACE</title>
        <meta name="description" content="Payez les frais de configuration de 500€ pour installer votre boutique Virtuel-Mbolo™. Paiement sécurisé via Chariow (Mobile Money)." />
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
            to="/cimolace/solutions/virtuel-mbolo" 
            className="text-xs text-white/40 hover:text-white/80 transition-colors flex items-center gap-1"
          >
            <ChevronLeft className="w-3 h-3" /> Retour
          </Link>
        </nav>

        <div className="pt-24 pb-12 px-6">
          <div className="max-w-4xl mx-auto">
            {step === 'form' && (
              <motion.div
                initial="hidden"
                animate="visible"
                variants={stagger(0.1)}
              >
                {/* Titre */}
                <motion.div variants={fadeUp} className="text-center mb-12">
                  <span className="text-xs tracking-[0.3em] uppercase text-violet-400 mb-4 block">
                    Configuration Virtuel-Mbolo™
                  </span>
                  <h1 className="text-3xl md:text-5xl font-black text-white mb-4">
                    Payer les frais de configuration
                  </h1>
                  <p className="text-lg text-white/60 max-w-xl mx-auto">
                    500€ pour l'installation, la configuration et la mise en ligne de votre boutique
                  </p>
                </motion.div>

                <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
                  {/* Formulaire */}
                  <motion.div variants={fadeUp} className="lg:col-span-3">
                    <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6 md:p-8">
                      <h2 className="text-xl font-bold text-white mb-6">Vos informations</h2>
                      
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm text-white/60 mb-2">Nom complet *</label>
                          <input
                            type="text"
                            name="name"
                            value={formData.name}
                            onChange={handleInputChange}
                            className="w-full px-4 py-3 bg-white/[0.05] border border-white/[0.1] rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-violet-500/50"
                            placeholder="Jean Dupont"
                            required
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm text-white/60 mb-2">Email *</label>
                          <input
                            type="email"
                            name="email"
                            value={formData.email}
                            onChange={handleInputChange}
                            className="w-full px-4 py-3 bg-white/[0.05] border border-white/[0.1] rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-violet-500/50"
                            placeholder="jean@example.com"
                            required
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm text-white/60 mb-2">Téléphone (Mobile Money) *</label>
                          <input
                            type="tel"
                            name="phone"
                            value={formData.phone}
                            onChange={handleInputChange}
                            className="w-full px-4 py-3 bg-white/[0.05] border border-white/[0.1] rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-violet-500/50"
                            placeholder="+241 77 12 34 56"
                            required
                          />
                          <p className="text-xs text-white/40 mt-1">Utilisé pour le paiement Chariow (MTN/Orange)</p>
                        </div>
                        
                        <div>
                          <label className="block text-sm text-white/60 mb-2">Nom de votre business</label>
                          <input
                            type="text"
                            name="businessName"
                            value={formData.businessName}
                            onChange={handleInputChange}
                            className="w-full px-4 py-3 bg-white/[0.05] border border-white/[0.1] rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-violet-500/50"
                            placeholder="Ma Boutique"
                          />
                        </div>
                      </div>

                      {/* Paiement Chariow */}
                      <div className="mt-8 pt-6 border-t border-white/[0.08]">
                        <h3 className="text-lg font-bold text-white mb-4">Paiement par Mobile Money</h3>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                          <button
                            onClick={handleChariowPayment}
                            className="flex items-center gap-3 p-4 bg-[#FF6B00]/10 border border-[#FF6B00]/30 rounded-xl hover:bg-[#FF6B00]/20 transition-all"
                          >
                            <div className="w-10 h-10 bg-[#FF6B00] rounded-lg flex items-center justify-center">
                              <Smartphone className="w-5 h-5 text-white" />
                            </div>
                            <div className="text-left">
                              <p className="font-bold text-white">Orange Money</p>
                              <p className="text-xs text-white/50">via Chariow</p>
                            </div>
                          </button>
                          
                          <button
                            onClick={handleChariowPayment}
                            className="flex items-center gap-3 p-4 bg-[#FFC107]/10 border border-[#FFC107]/30 rounded-xl hover:bg-[#FFC107]/20 transition-all"
                          >
                            <div className="w-10 h-10 bg-[#FFC107] rounded-lg flex items-center justify-center">
                              <Smartphone className="w-5 h-5 text-black" />
                            </div>
                            <div className="text-left">
                              <p className="font-bold text-white">MTN Mobile Money</p>
                              <p className="text-xs text-white/50">via Chariow</p>
                            </div>
                          </button>
                        </div>

                        <button
                          onClick={handleChariowPayment}
                          disabled={!formData.name || !formData.email || !formData.phone}
                          className="w-full flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-r from-violet-500 to-cyan-500 text-white font-bold rounded-xl hover:shadow-lg hover:shadow-violet-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <CreditCard className="w-5 h-5" />
                          Payer 500€ via Chariow
                        </button>
                      </div>
                    </div>
                  </motion.div>

                  {/* Récapitulatif */}
                  <motion.div variants={fadeUp} className="lg:col-span-2">
                    <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6 sticky top-28">
                      <h3 className="text-lg font-bold text-white mb-4">Récapitulatif</h3>
                      
                      <div className="space-y-3 mb-6">
                        <div className="flex justify-between text-sm">
                          <span className="text-white/60">Forfait sélectionné</span>
                          <span className="text-white font-medium">{currentPlan.name}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-white/60">Abonnement mensuel</span>
                          <span className="text-white font-medium">{currentPlan.monthly}€/mois</span>
                        </div>
                        <div className="border-t border-white/[0.08] pt-3">
                          <div className="flex justify-between">
                            <span className="text-white font-medium">Configuration (one-time)</span>
                            <span className="text-violet-400 font-bold">500€</span>
                          </div>
                        </div>
                      </div>

                      <div className="p-4 bg-violet-500/10 border border-violet-500/20 rounded-xl mb-4">
                        <p className="text-sm text-white/80">
                          Après paiement, vous accéderez à votre dashboard de suivi pour voir l'avancement de la création de votre boutique.
                        </p>
                      </div>

                      <div className="flex items-center gap-2 text-xs text-white/40">
                        <Shield className="w-4 h-4" />
                        Paiement sécurisé SSL
                      </div>
                    </div>
                  </motion.div>
                </div>
              </motion.div>
            )}

            {step === 'processing' && (
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
                <h2 className="text-2xl font-bold text-white mb-2">Traitement du paiement...</h2>
                <p className="text-white/60">Veuillez valider la transaction sur votre téléphone</p>
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
                  Paiement confirmé !
                </motion.h2>
                
                <motion.p variants={fadeUp} className="text-lg text-white/60 mb-8 max-w-md mx-auto">
                  Vos 500€ de configuration ont été reçus. Votre boutique Virtuel-Mbolo™ va être créée.
                </motion.p>

                <motion.div variants={fadeUp} className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6 max-w-md mx-auto mb-8">
                  <div className="flex items-center gap-3 mb-4">
                    <Store className="w-8 h-8 text-violet-400" />
                    <div className="text-left">
                      <p className="font-bold text-white">Prochaine étape</p>
                      <p className="text-sm text-white/50">Suivi de création</p>
                    </div>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-400" />
                      <span className="text-white/80">Configuration payée (500€)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-amber-400" />
                      <span className="text-white/80">Installation en cours...</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded-full border-2 border-white/20" />
                      <span className="text-white/40">Boutique en ligne</span>
                    </div>
                  </div>
                </motion.div>

                <motion.button
                  variants={fadeUp}
                  onClick={handleGoToDashboard}
                  className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-violet-500 to-cyan-500 text-white font-bold rounded-xl hover:shadow-lg hover:shadow-violet-500/25 transition-all"
                >
                  Voir mon dashboard <ArrowRight className="w-5 h-5" />
                </motion.button>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
