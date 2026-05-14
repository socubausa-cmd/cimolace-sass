import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  CheckCircle, ArrowRight, Store, Clock, ChevronLeft,
  Zap, Loader2
} from 'lucide-react';

export default function VirtuelMboloPaymentSuccessPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [paymentStatus, setPaymentStatus] = useState('loading');
  const [paymentData, setPaymentData] = useState(null);

  const paymentId = searchParams.get('payment_id');
  const plan = searchParams.get('plan') || 'starter';

  useEffect(() => {
    if (!paymentId) {
      navigate('/cimolace/paiement/setup');
      return;
    }

    // Vérifier le statut du paiement
    checkPaymentStatus();
  }, [paymentId]);

  const checkPaymentStatus = async () => {
    try {
      const response = await fetch('/.netlify/functions/billing/payment-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ paymentId }),
      });

      const result = await response.json();

      if (result.payment) {
        setPaymentData(result.payment);
        setPaymentStatus(result.payment.payment_status === 'confirmed' ? 'success' : 'pending');
      } else {
        setPaymentStatus('error');
      }
    } catch (error) {
      console.error('Erreur vérification paiement:', error);
      setPaymentStatus('error');
    }
  };

  const handleGoToDashboard = () => {
    navigate('/cimolace/admin', {
      state: {
        plan,
        setupPaid: paymentStatus === 'success',
        paymentId,
      },
    });
  };

  return (
    <>
      <Helmet>
        <title>Paiement Réussi | Virtuel-Mbolo™ | CIMOLACE</title>
        <meta name="description" content="Votre paiement Virtuel-Mbolo a été traité avec succès." />
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
            {paymentStatus === 'loading' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-20"
              >
                <Loader2 className="w-20 h-20 mx-auto mb-6 animate-spin text-violet-400" />
                <h2 className="text-2xl font-bold text-white mb-2">Vérification du paiement...</h2>
                <p className="text-white/60">Veuillez patienter</p>
              </motion.div>
            )}

            {paymentStatus === 'success' && (
              <motion.div
                initial="hidden"
                animate="visible"
                className="text-center py-12"
                variants={{
                  hidden: { opacity: 0 },
                  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
                }}
              >
                <motion.div variants={{ hidden: { opacity: 0, scale: 0.5 }, visible: { opacity: 1, scale: 1 }}} className="w-20 h-20 mx-auto mb-6 bg-green-500/20 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-10 h-10 text-green-400" />
                </motion.div>

                <motion.h2 variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 }}} className="text-3xl md:text-4xl font-black text-white mb-4">
                  Paiement confirmé !
                </motion.h2>

                <motion.p variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 }}} className="text-lg text-white/60 mb-8 max-w-md mx-auto">
                  Vos 500€ de configuration ont été reçus. Votre boutique Virtuel-Mbolo™ va être créée.
                </motion.p>

                <motion.div variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 }}} className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6 max-w-md mx-auto mb-8 text-left">
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
                  variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 }}}
                  onClick={handleGoToDashboard}
                  className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-violet-500 to-cyan-500 text-white font-bold rounded-xl hover:shadow-lg hover:shadow-violet-500/25 transition-all"
                >
                  Voir mon dashboard <ArrowRight className="w-5 h-5" />
                </motion.button>
              </motion.div>
            )}

            {paymentStatus === 'pending' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-12"
              >
                <Clock className="w-20 h-20 mx-auto mb-6 text-amber-400" />
                <h2 className="text-3xl font-black text-white mb-4">
                  Paiement en attente
                </h2>
                <p className="text-lg text-white/60 mb-8 max-w-md mx-auto">
                  Votre paiement est en cours de traitement. Veuillez vérifier votre téléphone pour confirmer la transaction Mobile Money.
                </p>
                <button
                  onClick={checkPaymentStatus}
                  className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-violet-500 to-cyan-500 text-white font-bold rounded-xl hover:shadow-lg hover:shadow-violet-500/25 transition-all"
                >
                  Rafraîchir le statut
                </button>
              </motion.div>
            )}

            {paymentStatus === 'error' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-12"
              >
                <div className="w-20 h-20 mx-auto mb-6 bg-red-500/20 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-10 h-10 text-red-400" />
                </div>
                <h2 className="text-3xl font-black text-white mb-4">
                  Erreur de paiement
                </h2>
                <p className="text-lg text-white/60 mb-8 max-w-md mx-auto">
                  Une erreur s'est produite lors du traitement de votre paiement. Veuillez réessayer.
                </p>
                <Link
                  to="/cimolace/paiement/setup"
                  state={{ selectedPlan: plan }}
                  className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-violet-500 to-cyan-500 text-white font-bold rounded-xl hover:shadow-lg hover:shadow-violet-500/25 transition-all"
                >
                  Réessayer le paiement
                </Link>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
