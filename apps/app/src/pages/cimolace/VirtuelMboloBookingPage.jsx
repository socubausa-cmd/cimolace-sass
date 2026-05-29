import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Calendar, Clock, ChevronLeft, Zap, Video, MessageSquare,
  User, CheckCircle, ArrowRight, ExternalLink
} from 'lucide-react';

/* ═══════════════════════════════════════════════════════════════
   PAGE BOOKING - Rendez-vous Conseiller Virtuel-Mbolo™
   Option 3 Hybride : Lien vers ISNA Booking ou iframe
═══════════════════════════════════════════════════════════════ */

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 }
};

const stagger = (delay = 0.1) => ({
  visible: { transition: { staggerChildren: delay } }
});

const APPOINTMENT_TYPES = [
  {
    id: 'discovery',
    title: 'Appel Découverte',
    duration: '15 min',
    price: 'Gratuit',
    description: 'Présentation rapide de Virtuel-Mbolo et réponse à vos premières questions.',
    icon: MessageSquare,
    color: '#10b981'
  },
  {
    id: 'demo',
    title: 'Démonstration Personnalisée',
    duration: '45 min',
    price: 'Gratuit',
    description: 'Visio complète avec démo des fonctionnalités selon votre secteur d\'activité.',
    icon: Video,
    color: '#8b5cf6'
  },
  {
    id: 'audit',
    title: 'Audit de Projet',
    duration: '30 min',
    price: 'Gratuit',
    description: 'Analyse de vos besoins et recommandation du forfait optimal.',
    icon: User,
    color: '#f59e0b'
  }
];

export default function VirtuelMboloBookingPage() {
  const [selectedType, setSelectedType] = useState('demo');
  const [step, setStep] = useState('select'); // select, isna-redirect, confirmed

  const handleContinueToISNA = () => {
    setStep('isna-redirect');
    // Iframe ou redirection vers ISNA
    setTimeout(() => {
      // Redirection vers le booking ISNA avec paramètres
      const isnaUrl = `https://isna.prorascience.org/rdv?type=virtuelmbolo&service=${selectedType}&source=cimolace`;
      window.open(isnaUrl, '_blank');
      setStep('confirmed');
    }, 2000);
  };

  const selectedAppointment = APPOINTMENT_TYPES.find(t => t.id === selectedType);

  return (
    <>
      <Helmet>
        <title>Prendre Rendez-vous | Virtuel-Mbolo™ | CIMOLACE</title>
        <meta name="description" content="Prenez rendez-vous avec un conseiller CIMOLACE pour Virtuel-Mbolo™. Appel découverte gratuit, démo personnalisée ou audit de projet." />
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
            {step === 'select' && (
              <motion.div
                initial="hidden"
                animate="visible"
                variants={stagger(0.1)}
              >
                {/* Titre */}
                <motion.div variants={fadeUp} className="text-center mb-12">
                  <span className="text-xs tracking-[0.3em] uppercase text-cyan-400 mb-4 block">
                    Besoin d'aide pour choisir ?
                  </span>
                  <h1 className="text-3xl md:text-5xl font-black text-white mb-4">
                    Prenez rendez-vous avec un conseiller
                  </h1>
                  <p className="text-lg text-white/60 max-w-xl mx-auto">
                    Notre équipe vous accompagne pour choisir la solution adaptée à votre activité.
                  </p>
                </motion.div>

                {/* Types de rendez-vous */}
                <motion.div variants={fadeUp} className="space-y-4 mb-8">
                  {APPOINTMENT_TYPES.map((type) => {
                    const Icon = type.icon;
                    return (
                      <div
                        key={type.id}
                        onClick={() => setSelectedType(type.id)}
                        className={`flex items-center gap-4 p-6 rounded-2xl cursor-pointer transition-all ${
                          selectedType === type.id
                            ? 'bg-white/[0.05] border-2'
                            : 'bg-white/[0.02] border border-white/[0.08] hover:border-white/[0.15]'
                        }`}
                        style={{ borderColor: selectedType === type.id ? type.color : undefined }}
                      >
                        <div 
                          className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: `${type.color}20` }}
                        >
                          <Icon className="w-7 h-7" style={{ color: type.color }} />
                        </div>
                        
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-1">
                            <h3 className="text-lg font-bold text-white">{type.title}</h3>
                            <span 
                              className="px-2 py-0.5 text-xs font-medium rounded-full"
                              style={{ backgroundColor: `${type.color}20`, color: type.color }}
                            >
                              {type.price}
                            </span>
                          </div>
                          <p className="text-sm text-white/50 mb-2">{type.description}</p>
                          <div className="flex items-center gap-2 text-xs text-white/40">
                            <Clock className="w-3.5 h-3.5" />
                            {type.duration}
                          </div>
                        </div>

                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                          selectedType === type.id 
                            ? 'border-violet-500 bg-violet-500' 
                            : 'border-white/20'
                        }`}>
                          {selectedType === type.id && (
                            <CheckCircle className="w-4 h-4 text-white" />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </motion.div>

                {/* Info ISNA */}
                <motion.div variants={fadeUp} className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6 mb-8">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-violet-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                      <Calendar className="w-6 h-6 text-violet-400" />
                    </div>
                    <div>
                      <h3 className="font-bold text-white mb-1">Système de rendez-vous ISNA</h3>
                      <p className="text-sm text-white/60 mb-3">
                        Vous allez être redirigé vers notre système de booking ISNA pour choisir votre créneau horaire. 
                        Disponible du lundi au vendredi, 9h-18h (heure du Gabon).
                      </p>
                      <div className="flex items-center gap-2 text-xs text-white/40">
                        <CheckCircle className="w-4 h-4 text-green-400" />
                        <span>Confirmation immédiate par email</span>
                      </div>
                    </div>
                  </div>
                </motion.div>

                {/* Bouton continuer */}
                <motion.div variants={fadeUp} className="text-center">
                  <button
                    onClick={handleContinueToISNA}
                    className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-bold rounded-xl hover:shadow-lg hover:shadow-cyan-500/25 transition-all"
                  >
                    Continuer vers ISNA
                    <ArrowRight className="w-5 h-5" />
                  </button>
                  <p className="mt-4 text-sm text-white/40">
                    Une nouvelle fenêtre s'ouvrira pour la réservation
                  </p>
                </motion.div>
              </motion.div>
            )}

            {step === 'isna-redirect' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-20"
              >
                <div className="w-20 h-20 mx-auto mb-6 relative">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                    className="w-full h-full border-4 border-cyan-500/20 border-t-cyan-500 rounded-full"
                  />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">Connexion à ISNA...</h2>
                <p className="text-white/60">Ouverture du système de rendez-vous</p>
              </motion.div>
            )}

            {step === 'confirmed' && (
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
                  Redirection effectuée !
                </motion.h2>
                
                <motion.p variants={fadeUp} className="text-lg text-white/60 mb-8 max-w-md mx-auto">
                  Le système de rendez-vous ISNA s'est ouvert dans une nouvelle fenêtre. 
                  Vous pouvez maintenant choisir votre créneau horaire.
                </motion.p>

                <motion.div variants={fadeUp} className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6 max-w-md mx-auto mb-8 text-left">
                  <div className="flex items-center gap-3 mb-4">
                    <div 
                      className="w-12 h-12 rounded-xl flex items-center justify-center"
                      style={{ backgroundColor: `${selectedAppointment.color}20` }}
                    >
                      <selectedAppointment.icon className="w-6 h-6" style={{ color: selectedAppointment.color }} />
                    </div>
                    <div>
                      <p className="font-bold text-white">{selectedAppointment.title}</p>
                      <p className="text-sm text-white/50">{selectedAppointment.duration}</p>
                    </div>
                  </div>
                  <p className="text-sm text-white/60">{selectedAppointment.description}</p>
                </motion.div>

                <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-4 justify-center">
                  <a
                    href={`https://isna.prorascience.org/rdv?type=virtuelmbolo&service=${selectedType}&source=cimolace`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-bold rounded-xl hover:shadow-lg hover:shadow-cyan-500/25 transition-all"
                  >
                    Ouvrir ISNA Booking
                    <ExternalLink className="w-5 h-5" />
                  </a>
                  <Link
                    to="/cimolace/solutions/virtuel-mbolo"
                    className="inline-flex items-center gap-2 px-8 py-4 bg-white/[0.06] border border-white/[0.1] text-white font-bold rounded-xl hover:bg-white/[0.1] transition-all"
                  >
                    Retour à Virtuel-Mbolo™
                  </Link>
                </motion.div>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
