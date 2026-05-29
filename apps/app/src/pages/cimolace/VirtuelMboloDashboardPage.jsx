import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  CheckCircle, Clock, Circle, ArrowRight, Store, 
  Zap, CreditCard, Calendar, MessageSquare, Bell,
  Settings, Package, Globe, ChevronLeft, ExternalLink,
  AlertCircle, FileText
} from 'lucide-react';

/* ═══════════════════════════════════════════════════════════════
   DASHBOARD SUIVI CRÉATION - Virtuel-Mbolo™
═══════════════════════════════════════════════════════════════ */

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 }
};

const stagger = (delay = 0.1) => ({
  visible: { transition: { staggerChildren: delay } }
});

const STEPS = [
  { id: 1, name: 'Configuration payée', desc: 'Frais de 500€ reçus', icon: CreditCard },
  { id: 2, name: 'Installation technique', desc: 'Serveur et domaine', icon: Settings },
  { id: 3, name: 'Configuration boutique', desc: 'Design et paramètres', icon: Store },
  { id: 4, name: 'Import produits', desc: 'Catalogue initial', icon: Package },
  { id: 5, name: 'Tests & validation', desc: 'Vérification complète', icon: CheckCircle },
  { id: 6, name: 'Mise en ligne', desc: 'Boutique live !', icon: Globe },
];

export default function VirtuelMboloDashboardPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { plan, setupPaid, customer } = location.state || {};
  
  const [currentStep, setCurrentStep] = useState(2);
  const [subscriptionActive, setSubscriptionActive] = useState(false);
  const [notifications, setNotifications] = useState([
    { id: 1, type: 'success', message: 'Paiement 500€ confirmé', time: 'À l\'instant', read: false },
    { id: 2, type: 'info', message: 'Installation démarrée', time: 'À l\'instant', read: false },
  ]);

  const planDetails = {
    starter: { name: 'Starter', monthly: 150, color: '#06b6d4' },
    pro: { name: 'Pro', monthly: 200, color: '#8b5cf6' },
    elite: { name: 'Elite', monthly: 300, color: '#f59e0b' }
  };

  const currentPlan = plan ? planDetails[plan] : null;

  useEffect(() => {
    // Simuler la progression des étapes
    const interval = setInterval(() => {
      setCurrentStep(prev => {
        if (prev < 4) return prev + 1;
        return prev;
      });
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const handleSubscribe = () => {
    navigate('/cimolace/abonnement', { state: { plan, customer } });
  };

  return (
    <>
      <Helmet>
        <title>Dashboard | Suivi Création | Virtuel-Mbolo™ | CIMOLACE</title>
        <meta name="description" content="Suivez la progression de la création de votre boutique Virtuel-Mbolo™. Dashboard client avec étapes, notifications et gestion d'abonnement." />
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
          
          <div className="flex items-center gap-4">
            <button className="relative p-2 text-white/60 hover:text-white transition-colors">
              <Bell className="w-5 h-5" />
              {notifications.some(n => !n.read) && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
              )}
            </button>
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center text-sm font-bold">
              {customer?.name?.charAt(0) || 'C'}
            </div>
          </div>
        </nav>

        <div className="pt-24 pb-12 px-6">
          <div className="max-w-6xl mx-auto">
            <motion.div
              initial="hidden"
              animate="visible"
              variants={stagger(0.1)}
            >
              {/* Header Dashboard */}
              <motion.div variants={fadeUp} className="mb-8">
                <Link 
                  to="/cimolace/solutions/virtuel-mbolo" 
                  className="text-xs text-white/40 hover:text-white/80 transition-colors flex items-center gap-1 mb-4"
                >
                  <ChevronLeft className="w-3 h-3" /> Retour à Virtuel-Mbolo™
                </Link>
                <h1 className="text-3xl md:text-4xl font-black text-white mb-2">
                  Dashboard de création
                </h1>
                <p className="text-white/60">
                  Suivez l'avancement de votre boutique {customer?.businessName || 'Virtuel-Mbolo™'}
                </p>
              </motion.div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Colonne principale - Progression */}
                <motion.div variants={fadeUp} className="lg:col-span-2 space-y-6">
                  {/* Carte Progression */}
                  <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6">
                    <div className="flex items-center justify-between mb-6">
                      <h2 className="text-xl font-bold text-white">Progression</h2>
                      <span className="text-sm text-violet-400">
                        Étape {currentStep} sur {STEPS.length}
                      </span>
                    </div>

                    {/* Barre de progression */}
                    <div className="w-full h-2 bg-white/[0.05] rounded-full mb-8 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${(currentStep / STEPS.length) * 100}%` }}
                        className="h-full bg-gradient-to-r from-violet-500 to-cyan-500"
                      />
                    </div>

                    {/* Étapes */}
                    <div className="space-y-4">
                      {STEPS.map((step, index) => {
                        const isCompleted = index + 1 < currentStep;
                        const isCurrent = index + 1 === currentStep;
                        const isPending = index + 1 > currentStep;
                        
                        return (
                          <div 
                            key={step.id}
                            className={`flex items-center gap-4 p-4 rounded-xl transition-all ${
                              isCurrent ? 'bg-violet-500/10 border border-violet-500/20' : 
                              isCompleted ? 'bg-white/[0.02]' : 'bg-transparent opacity-50'
                            }`}
                          >
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                              isCompleted ? 'bg-green-500/20' :
                              isCurrent ? 'bg-violet-500/20' : 'bg-white/[0.05]'
                            }`}>
                              {isCompleted ? (
                                <CheckCircle className="w-5 h-5 text-green-400" />
                              ) : isCurrent ? (
                                <step.icon className="w-5 h-5 text-violet-400" />
                              ) : (
                                <Circle className="w-5 h-5 text-white/30" />
                              )}
                            </div>
                            <div className="flex-1">
                              <h3 className={`font-medium ${isCurrent ? 'text-white' : 'text-white/70'}`}>
                                {step.name}
                              </h3>
                              <p className="text-sm text-white/50">{step.desc}</p>
                            </div>
                            {isCurrent && (
                              <div className="flex items-center gap-2 text-sm text-violet-400">
                                <Clock className="w-4 h-4" />
                                En cours
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Prochaines étapes */}
                  <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6">
                    <h2 className="text-xl font-bold text-white mb-4">Prochaines étapes</h2>
                    <div className="space-y-3">
                      <div className="flex items-start gap-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                        <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="font-medium text-white">Abonnement à activer</p>
                          <p className="text-sm text-white/60">
                            Activez votre abonnement {currentPlan?.name} pour débloquer toutes les fonctionnalités dès la mise en ligne.
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-start gap-3 p-3 bg-white/[0.03] rounded-xl">
                        <FileText className="w-5 h-5 text-white/40 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="font-medium text-white/80">Préparer votre catalogue</p>
                          <p className="text-sm text-white/50">
                            Rassemblez vos photos de produits, descriptions et prix pour accélérer la configuration.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>

                {/* Colonne latérale */}
                <motion.div variants={fadeUp} className="space-y-6">
                  {/* Carte Abonnement */}
                  <div className="bg-gradient-to-br from-violet-500/10 to-cyan-500/10 border border-violet-500/20 rounded-2xl p-6">
                    <h2 className="text-lg font-bold text-white mb-4">Votre forfait</h2>
                    
                    {currentPlan ? (
                      <>
                        <div className="flex items-center justify-between mb-4">
                          <span className="text-white font-medium">{currentPlan.name}</span>
                          <span className="text-violet-400 font-bold">{currentPlan.monthly}€/mois</span>
                        </div>
                        
                        {!subscriptionActive ? (
                          <>
                            <p className="text-sm text-white/60 mb-4">
                              Configuration payée (500€) ✓<br />
                              Abonnement en attente d'activation
                            </p>
                            <button
                              onClick={handleSubscribe}
                              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-violet-500 to-cyan-500 text-white font-bold rounded-xl hover:shadow-lg hover:shadow-violet-500/25 transition-all"
                            >
                              <CreditCard className="w-4 h-4" />
                              Activer l'abonnement
                            </button>
                          </>
                        ) : (
                          <div className="flex items-center gap-2 text-green-400">
                            <CheckCircle className="w-5 h-5" />
                            <span>Abonnement actif</span>
                          </div>
                        )}
                      </>
                    ) : (
                      <p className="text-white/60">Aucun forfait sélectionné</p>
                    )}
                  </div>

                  {/* Notifications */}
                  <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6">
                    <h2 className="text-lg font-bold text-white mb-4">Notifications</h2>
                    <div className="space-y-3">
                      {notifications.map(notif => (
                        <div 
                          key={notif.id}
                          className={`flex items-start gap-3 p-3 rounded-xl ${
                            notif.type === 'success' ? 'bg-green-500/10' : 'bg-white/[0.03]'
                          }`}
                        >
                          {notif.type === 'success' ? (
                            <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                          ) : (
                            <Bell className="w-4 h-4 text-violet-400 flex-shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-white/80">{notif.message}</p>
                            <p className="text-xs text-white/40">{notif.time}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Actions rapides */}
                  <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6">
                    <h2 className="text-lg font-bold text-white mb-4">Actions rapides</h2>
                    <div className="space-y-2">
                      <Link
                        to="/cimolace/booking"
                        className="flex items-center gap-3 p-3 bg-white/[0.03] rounded-xl hover:bg-white/[0.06] transition-colors"
                      >
                        <Calendar className="w-5 h-5 text-violet-400" />
                        <span className="text-sm text-white/80">Prendre RDV conseiller</span>
                      </Link>
                      
                      <button className="w-full flex items-center gap-3 p-3 bg-white/[0.03] rounded-xl hover:bg-white/[0.06] transition-colors">
                        <MessageSquare className="w-5 h-5 text-cyan-400" />
                        <span className="text-sm text-white/80">Contacter le support</span>
                      </button>
                    </div>
                  </div>

                  {/* Lien documentation */}
                  <a 
                    href="#" 
                    className="flex items-center justify-center gap-2 p-4 text-sm text-white/40 hover:text-white/80 transition-colors"
                  >
                    Voir la documentation <ExternalLink className="w-4 h-4" />
                  </a>
                </motion.div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </>
  );
}
