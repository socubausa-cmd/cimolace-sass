import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Users, MessageCircle, Bot, Star, Receipt, BarChart3,
  Percent, FileText, RefreshCw, ArrowRight, Check, Sparkles,
  Zap, TrendingUp, Clock, Calculator, Shield, Award,
  ChevronDown, ChevronUp, CreditCard, Bell
} from 'lucide-react';

/* ═══════════════════════════════════════════════════════════════
   DATA — Plan Pro
═══════════════════════════════════════════════════════════════ */

const PRO_MODULES = [
  {
    icon: Users,
    title: 'CRM Client Intégré',
    desc: 'Centralisez tous vos clients, commandes, paiements et conversations en un seul endroit.',
    features: ['Fiche client complète', 'Historique commandes', 'Historique paiements', 'Notes internes', 'Segmentation client']
  },
  {
    icon: MessageCircle,
    title: 'Chat Client en Direct',
    desc: 'Discutez avec vos visiteurs et clients depuis votre boutique ou back-office.',
    features: ['Messages temps réel', 'Historique conversations', 'Liens commande/profil', 'Réponses rapides']
  },
  {
    icon: Bot,
    title: 'Assistant IA Business',
    desc: 'L\'IA LIRI vous aide à rédiger, communiquer et vendre plus efficacement.',
    features: ['Rédaction messages clients', 'Descriptions produits IA', 'Arguments de vente', 'Relances assistées']
  },
  {
    icon: Star,
    title: 'Système d\'Avis Client',
    desc: 'Collectez et affichez les avis pour créer la confiance et augmenter les conversions.',
    features: ['Liens avis automatiques', 'Collecte témoignages', 'Preuve sociale', 'Affichage boutique']
  },
  {
    icon: Receipt,
    title: 'Facturation Automatique',
    desc: 'Générez des factures professionnelles automatiquement pour chaque vente.',
    features: ['Factures auto', 'Reçus de paiement', 'Historique factures', 'Export comptable']
  },
  {
    icon: BarChart3,
    title: 'Comptabilité Simple',
    desc: 'Suivez votre chiffre d\'affaires, vos dettes et vos paiements en temps réel.',
    features: ['CA encaissé', 'Paiements à venir', 'Factures impayées', 'Historique financier']
  },
  {
    icon: Percent,
    title: 'Paiement Échelonné',
    desc: 'Proposez le paiement en plusieurs fois avec suivi automatique des échéances.',
    features: ['Acompte initial', 'Calendrier échéances', 'Montant payé/restant', 'Relances auto', 'Suivi dettes']
  },
  {
    icon: FileText,
    title: 'Devis en Temps Réel',
    desc: 'Calculez et envoyez des devis professionnels instantanément.',
    features: ['Calcul instantané', 'Produits + services', 'Livraison + remises', 'Conversion paiement']
  },
  {
    icon: RefreshCw,
    title: 'Relances Automatiques',
    desc: 'Récupérez les ventes perdues avec des relances intelligentes.',
    features: ['Paniers abandonnés', 'Factures impayées', 'Échéances en retard', 'Demande avis']
  },
];

const PRO_INCLUDES = [
  'Tout Starter inclus',
  'CRM client intégré',
  'Chat client en direct',
  'Assistant IA Business LIRI',
  'Système d\'avis client',
  'Facturation automatique',
  'Comptabilité simple',
  'Plan de paiement échelonné',
  'Calcul de devis temps réel',
  'Relances automatiques',
];

/* ═══════════════════════════════════════════════════════════════
   ANIMATIONS
═══════════════════════════════════════════════════════════════ */

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
};

const stagger = (delay = 0.1) => ({
  hidden: {},
  visible: { transition: { staggerChildren: delay } },
});

/* ═══════════════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════════════ */

export default function VirtuelMboloProPage() {
  const [isAnnual, setIsAnnual] = useState(false);
  const [expandedModule, setExpandedModule] = useState(0);
  const monthlyPrice = 200;
  const annualPrice = 200 * 10; // 2 mois offerts

  return (
    <>
      <Helmet>
        <title>Virtuel-Mbolo Pro | 200€/mois | CRM + IA + Facturation | CIMOLACE</title>
        <meta name="description" content="Virtuel-Mbolo Pro à 200€/mois. Structurez votre business avec CRM, IA, facturation, paiements échelonnés et relances automatiques." />
      </Helmet>

      <div className="min-h-screen bg-[#050507] text-white overflow-x-hidden">
        {/* ══ BANNER RECOMMANDÉ ══ */}
        <div className="bg-gradient-to-r from-violet-500/20 to-purple-500/20 border-b border-violet-500/20">
          <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-center gap-2 text-sm">
            <Award className="w-4 h-4 text-violet-400" />
            <span className="font-bold text-violet-400">Forfait Recommandé</span>
            <span className="text-white/40">|</span>
            <span className="text-white/60">Configuration & Propriété :</span>
            <span className="font-bold text-white">500€</span>
          </div>
        </div>

        {/* ══ HERO ══ */}
        <section className="relative py-20 px-6">
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute top-0 left-1/3 w-96 h-96 bg-violet-500/10 rounded-full blur-[128px]" />
            <div className="absolute bottom-0 right-1/3 w-96 h-96 bg-purple-500/10 rounded-full blur-[128px]" />
          </div>

          <motion.div
            initial="hidden"
            animate="visible"
            variants={stagger(0.1)}
            className="relative z-10 max-w-5xl mx-auto"
          >
            {/* Badge */}
            <motion.div variants={fadeUp} className="mb-6">
              <span className="inline-flex items-center gap-2 px-4 py-2 bg-violet-500/20 border border-violet-500/30 rounded-full text-sm font-medium text-violet-400">
                <Award className="w-4 h-4" />
                Forfait Pro — Recommandé
              </span>
            </motion.div>

            {/* Titre */}
            <motion.h1
              variants={fadeUp}
              className="text-4xl md:text-6xl font-black text-white mb-6 leading-tight"
            >
              Structurez votre
              <span className="block bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent">
                business comme un pro
              </span>
            </motion.h1>

            {/* Sous-titre */}
            <motion.p
              variants={fadeUp}
              className="text-xl text-white/60 max-w-2xl mb-8"
            >
              « À 200€, vous ne vendez plus dans le désordre. Vous pilotez votre business. »
            </motion.p>

            {/* Prix */}
            <motion.div variants={fadeUp} className="flex flex-col sm:flex-row items-start sm:items-center gap-6 mb-10">
              <div className="flex items-baseline gap-2">
                <span className="text-6xl font-black text-white">{isAnnual ? Math.round(annualPrice / 12) : monthlyPrice}€</span>
                <span className="text-white/50">/mois</span>
              </div>
              
              <div className="flex items-center gap-3 bg-white/5 rounded-full p-1">
                <button
                  onClick={() => setIsAnnual(false)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                    !isAnnual ? 'bg-violet-500 text-white' : 'text-white/60 hover:text-white'
                  }`}
                >
                  Mensuel
                </button>
                <button
                  onClick={() => setIsAnnual(true)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2 ${
                    isAnnual ? 'bg-violet-500 text-white' : 'text-white/60 hover:text-white'
                  }`}
                >
                  Annuel
                  <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full">-17%</span>
                </button>
              </div>
            </motion.div>

            {/* CTAs */}
            <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-4">
              <Link
                to="/cimolace/configurateur?plan=virtuel-mbolo-pro"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-r from-violet-500 to-purple-500 text-white font-bold rounded-xl hover:shadow-lg hover:shadow-violet-500/25 transition-all"
              >
                Configurer Pro <ArrowRight className="w-5 h-5" />
              </Link>
              <Link
                to="/cimolace/solutions/virtuel-mbolo"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white/[0.06] border border-white/[0.1] text-white font-bold rounded-xl hover:bg-white/[0.1] transition-all"
              >
                Comparer les forfaits
              </Link>
            </motion.div>

            {isAnnual && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-4 text-sm text-green-400"
              >
                Économisez 400€ par an avec l'abonnement annuel (2 mois offerts)
              </motion.p>
            )}
          </motion.div>
        </section>

        {/* ══ MODULES PRO ══ */}
        <section className="py-20 px-6 bg-white/[0.02]">
          <div className="max-w-6xl mx-auto">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={stagger(0.1)}
              className="text-center mb-12"
            >
              <motion.h2 variants={fadeUp} className="text-3xl md:text-4xl font-black text-white mb-4">
                9 modules pour piloter votre business
              </motion.h2>
              <motion.p variants={fadeUp} className="text-white/60">
                Tout ce qui manquait à votre boutique pour devenir un vrai système commercial
              </motion.p>
            </motion.div>

            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={stagger(0.08)}
              className="grid grid-cols-1 lg:grid-cols-2 gap-4"
            >
              {PRO_MODULES.map((module, i) => (
                <motion.div
                  key={i}
                  variants={fadeUp}
                  className={`p-6 bg-white/[0.03] border rounded-2xl transition-all duration-300 cursor-pointer ${
                    expandedModule === i ? 'border-violet-500/40 bg-violet-500/5' : 'border-white/[0.08] hover:border-violet-500/20'
                  }`}
                  onClick={() => setExpandedModule(expandedModule === i ? -1 : i)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl bg-violet-500/20 flex items-center justify-center flex-shrink-0">
                        <module.icon className="w-6 h-6 text-violet-400" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-white mb-1">{module.title}</h3>
                        <p className="text-sm text-white/50">{module.desc}</p>
                      </div>
                    </div>
                    {expandedModule === i ? (
                      <ChevronUp className="w-5 h-5 text-violet-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-white/40" />
                    )}
                  </div>
                  
                  {expandedModule === i && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="mt-4 pt-4 border-t border-white/[0.08]"
                    >
                      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {module.features.map((feature, j) => (
                          <li key={j} className="flex items-center gap-2 text-sm text-white/60">
                            <Check className="w-3 h-3 text-violet-400" />
                            {feature}
                          </li>
                        ))}
                      </ul>
                    </motion.div>
                  )}
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* ══ SPOTLIGHT FEATURES ══ */}
        <section className="py-20 px-6">
          <div className="max-w-6xl mx-auto">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={stagger(0.1)}
              className="grid grid-cols-1 lg:grid-cols-2 gap-8"
            >
              {/* Paiement échelonné */}
              <motion.div
                variants={fadeUp}
                className="p-8 bg-gradient-to-br from-violet-500/10 to-purple-500/5 border border-violet-500/20 rounded-3xl"
              >
                <div className="w-14 h-14 rounded-2xl bg-violet-500/20 flex items-center justify-center mb-6">
                  <Percent className="w-7 h-7 text-violet-400" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-4">Paiement échelonné intelligent</h3>
                <p className="text-white/60 mb-6">
                  Vendez des offres plus chères en proposant le paiement en plusieurs fois. 
                  Le système suit chaque échéance, relance automatiquement et vous montre 
                  exactement qui vous doit de l'argent.
                </p>
                <ul className="space-y-2">
                  {['Acompte initial configurable', 'Calendrier des échéances', 'Relances automatiques', 'Suivi des dettes client'].map((item, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-white/70">
                      <Check className="w-4 h-4 text-violet-400" /> {item}
                    </li>
                  ))}
                </ul>
              </motion.div>

              {/* Relances auto */}
              <motion.div
                variants={fadeUp}
                className="p-8 bg-gradient-to-br from-cyan-500/10 to-blue-500/5 border border-cyan-500/20 rounded-3xl"
              >
                <div className="w-14 h-14 rounded-2xl bg-cyan-500/20 flex items-center justify-center mb-6">
                  <RefreshCw className="w-7 h-7 text-cyan-400" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-4">Relances automatiques</h3>
                <p className="text-white/60 mb-6">
                  Récupérez jusqu'à 25% de ventes perdues avec des relances intelligentes 
                  aux bons moments. Panier abandonné, facture impayée, échéance en retard — 
                  tout est automatisé.
                </p>
                <ul className="space-y-2">
                  {['Paniers abandonnés', 'Factures impayées', 'Échéances en retard', 'Demande d\'avis post-achat'].map((item, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-white/70">
                      <Check className="w-4 h-4 text-cyan-400" /> {item}
                    </li>
                  ))}
                </ul>
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* ══ CE QUI EST INCLUS ══ */}
        <section className="py-20 px-6 bg-white/[0.02]">
          <div className="max-w-4xl mx-auto">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={stagger(0.1)}
            >
              <motion.h2 variants={fadeUp} className="text-3xl md:text-4xl font-black text-white text-center mb-12">
                Tout ce qui est inclus dans Pro
              </motion.h2>

              <motion.div variants={fadeUp} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {PRO_INCLUDES.map((item, i) => (
                  <div key={i} className="flex items-center gap-3 p-4 bg-white/[0.03] border border-white/[0.08] rounded-xl">
                    <div className="w-8 h-8 rounded-lg bg-violet-500/20 flex items-center justify-center flex-shrink-0">
                      <Check className="w-4 h-4 text-violet-400" />
                    </div>
                    <span className="text-white/80">{item}</span>
                  </div>
                ))}
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* ══ COMPARAISON STARTER/ELITE ══ */}
        <section className="py-20 px-6">
          <div className="max-w-5xl mx-auto">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={stagger(0.1)}
              className="grid grid-cols-1 md:grid-cols-2 gap-6"
            >
              <motion.div
                variants={fadeUp}
                className="p-6 bg-white/[0.03] border border-white/[0.08] rounded-2xl"
              >
                <p className="text-sm text-cyan-400 font-medium mb-2">Forfait Starter</p>
                <p className="text-white/60 text-sm mb-4">
                  Parfait pour démarrer. 150€/mois pour une boutique professionnelle avec paiement intégré.
                </p>
                <Link
                  to="/cimolace/solutions/virtuel-mbolo/starter"
                  className="text-sm text-white/60 hover:text-white transition-colors"
                >
                  Voir Starter →
                </Link>
              </motion.div>

              <motion.div
                variants={fadeUp}
                className="p-6 bg-gradient-to-br from-amber-500/10 to-orange-500/5 border border-amber-500/20 rounded-2xl"
              >
                <p className="text-sm text-amber-400 font-medium mb-2">Forfait Elite</p>
                <p className="text-white/60 text-sm mb-4">
                  Pour scaler. 300€/mois avec marketing IA, live selling, événements et communauté.
                </p>
                <Link
                  to="/cimolace/solutions/virtuel-mbolo/elite"
                  className="text-sm text-amber-400 hover:text-amber-300 transition-colors"
                >
                  Découvrir Elite →
                </Link>
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* ══ CTA FINAL ══ */}
        <section className="py-20 px-6 bg-gradient-to-t from-violet-500/10 to-transparent">
          <div className="max-w-4xl mx-auto text-center">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={stagger(0.1)}
            >
              <motion.h2 variants={fadeUp} className="text-3xl md:text-4xl font-black text-white mb-6">
                Prêt à structurer votre business ?
              </motion.h2>
              <motion.p variants={fadeUp} className="text-xl text-white/60 mb-8">
                Configuration : 500€ + {isAnnual ? `${Math.round(annualPrice / 12)}€` : `${monthlyPrice}€`}/mois
              </motion.p>
              <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link
                  to="/cimolace/configurateur?plan=virtuel-mbolo-pro"
                  className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-r from-violet-500 to-purple-500 text-white font-bold rounded-xl hover:shadow-lg hover:shadow-violet-500/25 transition-all"
                >
                  Configurer Pro <ArrowRight className="w-5 h-5" />
                </Link>
                <Link
                  to="/cimolace/contact"
                  className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white/[0.06] border border-white/[0.1] text-white font-bold rounded-xl hover:bg-white/[0.1] transition-all"
                >
                  Demander une démo
                </Link>
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* ══ FOOTER ══ */}
        <footer className="py-8 px-6 border-t border-white/[0.05]">
          <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-white/40">
              © {new Date().getFullYear()} Virtuel-Mbolo™ Pro par CIMOLACE
            </p>
            <div className="flex items-center gap-6">
              <Link to="/cimolace/solutions/virtuel-mbolo" className="text-sm text-white/60 hover:text-white transition-colors">
                Tous les forfaits
              </Link>
              <Link to="/cimolace" className="text-sm text-violet-400 hover:text-violet-300 transition-colors">
                CIMOLACE ↗
              </Link>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
