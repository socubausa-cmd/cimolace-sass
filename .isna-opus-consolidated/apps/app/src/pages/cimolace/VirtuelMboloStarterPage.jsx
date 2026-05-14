import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Store, CreditCard, Package, Shield, Clock, Headphones,
  ArrowRight, Check, Sparkles, Globe, Zap, ShoppingCart,
  TrendingUp, Lock, Server, RefreshCw
} from 'lucide-react';

/* ═══════════════════════════════════════════════════════════════
   DATA — Plan Starter
═══════════════════════════════════════════════════════════════ */

const STARTER_FEATURES = [
  { icon: Store, title: 'Boutique en ligne professionnelle', desc: 'Design premium, responsive, optimisé pour la conversion' },
  { icon: Package, title: 'Catalogue produits illimité', desc: 'Ajoutez autant de produits que vous voulez' },
  { icon: ShoppingCart, title: 'Panier et checkout optimisés', desc: 'Parcours d\'achat fluide, abandon réduit' },
  { icon: CreditCard, title: 'Paiement en ligne intégré', desc: 'Stripe + Chariow (Mobile Money MTN/Orange)' },
  { icon: Shield, title: 'Sécurité SSL et conformité', desc: 'Vos données et celles de vos clients sont protégées' },
  { icon: Server, title: 'Hébergement premium inclus', desc: 'Serveurs rapides, uptime 99.9%, CDN global' },
  { icon: Clock, title: 'Mises à jour automatiques', desc: 'Votre boutique reste à jour sans effort' },
  { icon: Headphones, title: 'Support technique email', desc: 'Réponse sous 24h ouvrées' },
  { icon: Globe, title: 'Nom de domaine personnalisé', desc: 'votreboutique.com ou sous-domaine CIMOLACE' },
  { icon: Lock, title: 'Back-office sécurisé', desc: 'Gestion de vos produits et commandes' },
];

const STARTER_INCLUDES = [
  'Boutique en ligne professionnelle',
  'Catalogue produits',
  'Pages produits optimisées',
  'Panier et checkout',
  'Paiement en ligne (Stripe + Chariow)',
  'Gestion simple des commandes',
  'Back-office de base',
  'Hébergement sécurisé',
  'Maintenance technique',
  'Support technique',
  'Mises à jour de sécurité',
  'Suivi des commandes simple',
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

export default function VirtuelMboloStarterPage() {
  const [isAnnual, setIsAnnual] = useState(false);
  const monthlyPrice = 150;
  const annualPrice = 150 * 10; // 2 mois offerts

  return (
    <>
      <Helmet>
        <title>Virtuel-Mbolo Starter | 150€/mois | Solution E-commerce | CIMOLACE</title>
        <meta name="description" content="Virtuel-Mbolo Starter à 150€/mois. Lancez votre boutique en ligne professionnelle avec paiement intégré, hébergement et maintenance inclus." />
      </Helmet>

      <div className="min-h-screen bg-[#050507] text-white overflow-x-hidden">
        {/* ══ BANNER HAUT ══ */}
        <div className="bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border-b border-cyan-500/20">
          <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-center gap-2 text-sm">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            <span className="text-white/80">Configuration & Propriété :</span>
            <span className="font-bold text-white">500€</span>
            <span className="text-white/60">paiement unique requis</span>
          </div>
        </div>

        {/* ══ HERO ══ */}
        <section className="relative py-20 px-6">
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-[128px]" />
            <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-[128px]" />
          </div>

          <motion.div
            initial="hidden"
            animate="visible"
            variants={stagger(0.1)}
            className="relative z-10 max-w-5xl mx-auto"
          >
            {/* Badge */}
            <motion.div variants={fadeUp} className="mb-6">
              <span className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-500/20 border border-cyan-500/30 rounded-full text-sm font-medium text-cyan-400">
                <Zap className="w-4 h-4" />
                Forfait Starter
              </span>
            </motion.div>

            {/* Titre */}
            <motion.h1
              variants={fadeUp}
              className="text-4xl md:text-6xl font-black text-white mb-6 leading-tight"
            >
              Lancez votre business
              <span className="block bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                sans coder, sans stress
              </span>
            </motion.h1>

            {/* Sous-titre */}
            <motion.p
              variants={fadeUp}
              className="text-xl text-white/60 max-w-2xl mb-8"
            >
              « Vous pouvez commencer à vendre sans gérer la technique. »
            </motion.p>

            {/* Prix */}
            <motion.div variants={fadeUp} className="flex flex-col sm:flex-row items-start sm:items-center gap-6 mb-10">
              <div className="flex items-baseline gap-2">
                <span className="text-6xl font-black text-white">{isAnnual ? Math.round(annualPrice / 12) : monthlyPrice}€</span>
                <span className="text-white/50">/mois</span>
              </div>
              
              {/* Toggle mensuel/annuel */}
              <div className="flex items-center gap-3 bg-white/5 rounded-full p-1">
                <button
                  onClick={() => setIsAnnual(false)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                    !isAnnual ? 'bg-cyan-500 text-white' : 'text-white/60 hover:text-white'
                  }`}
                >
                  Mensuel
                </button>
                <button
                  onClick={() => setIsAnnual(true)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2 ${
                    isAnnual ? 'bg-cyan-500 text-white' : 'text-white/60 hover:text-white'
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
                to="/cimolace/configurateur?plan=virtuel-mbolo-starter"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-bold rounded-xl hover:shadow-lg hover:shadow-cyan-500/25 transition-all"
              >
                Configurer Starter <ArrowRight className="w-5 h-5" />
              </Link>
              <Link
                to="/cimolace/solutions/virtuel-mbolo"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white/[0.06] border border-white/[0.1] text-white font-bold rounded-xl hover:bg-white/[0.1] transition-all"
              >
                Voir tous les forfaits
              </Link>
            </motion.div>

            {isAnnual && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-4 text-sm text-green-400"
              >
                Économisez 300€ par an avec l'abonnement annuel (2 mois offerts)
              </motion.p>
            )}
          </motion.div>
        </section>

        {/* ══ CE QUI EST INCLUS ══ */}
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
                Tout ce qui est inclus
              </motion.h2>
              <motion.p variants={fadeUp} className="text-white/60">
                Une solution complète pour démarrer votre e-commerce
              </motion.p>
            </motion.div>

            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={stagger(0.08)}
              className="grid grid-cols-1 md:grid-cols-2 gap-4"
            >
              {STARTER_INCLUDES.map((feature, i) => (
                <motion.div
                  key={i}
                  variants={fadeUp}
                  className="flex items-center gap-3 p-4 bg-white/[0.03] border border-white/[0.08] rounded-xl"
                >
                  <div className="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center flex-shrink-0">
                    <Check className="w-4 h-4 text-cyan-400" />
                  </div>
                  <span className="text-white/80">{feature}</span>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* ══ FEATURES GRID ══ */}
        <section className="py-20 px-6">
          <div className="max-w-6xl mx-auto">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={stagger(0.1)}
              className="text-center mb-12"
            >
              <motion.h2 variants={fadeUp} className="text-3xl md:text-4xl font-black text-white mb-4">
                Fonctionnalités détaillées
              </motion.h2>
            </motion.div>

            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={stagger(0.06)}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            >
              {STARTER_FEATURES.map((feature, i) => (
                <motion.div
                  key={i}
                  variants={fadeUp}
                  whileHover={{ y: -4, borderColor: 'rgba(6,182,212,0.3)' }}
                  className="p-6 bg-white/[0.03] border border-white/[0.08] rounded-2xl transition-all duration-300"
                >
                  <feature.icon className="w-10 h-10 text-cyan-400 mb-4" />
                  <h3 className="text-lg font-bold text-white mb-2">{feature.title}</h3>
                  <p className="text-sm text-white/50">{feature.desc}</p>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* ══ POUR QUI ══ */}
        <section className="py-20 px-6 bg-white/[0.02]">
          <div className="max-w-4xl mx-auto">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={stagger(0.1)}
            >
              <motion.h2 variants={fadeUp} className="text-3xl md:text-4xl font-black text-white text-center mb-12">
                Ce forfait est fait pour vous si...
              </motion.h2>

              <motion.div variants={fadeUp} className="space-y-4">
                {[
                  'Vous démarrez votre première boutique en ligne',
                  'Vous voulez vendre sans vous soucier de la technique',
                  'Vous cherchez une solution professionnelle mais accessible',
                  'Vous avez besoin d\'un paiement sécurisé immédiatement',
                  'Vous ne voulez pas gérer un serveur ou un développeur',
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-4 p-4 bg-white/[0.03] rounded-xl">
                    <div className="w-6 h-6 rounded-full bg-cyan-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Check className="w-3 h-3 text-cyan-400" />
                    </div>
                    <p className="text-white/80">{item}</p>
                  </div>
                ))}
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* ══ COMPARAISON AVEC PRO ══ */}
        <section className="py-20 px-6">
          <div className="max-w-4xl mx-auto">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={stagger(0.1)}
              className="bg-gradient-to-br from-violet-500/10 to-purple-500/5 border border-violet-500/20 rounded-3xl p-8"
            >
              <motion.div variants={fadeUp} className="flex items-center gap-3 mb-4">
                <TrendingUp className="w-8 h-8 text-violet-400" />
                <h3 className="text-xl font-bold text-white">Envie de plus de fonctionnalités ?</h3>
              </motion.div>
              <motion.p variants={fadeUp} className="text-white/60 mb-6">
                Le forfait Pro à 200€/mois ajoute le CRM client, le chat, l'IA business, les avis clients, 
                la facturation automatique, la comptabilité, les paiements échelonnés et les relances automatiques.
              </motion.p>
              <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-4">
                <Link
                  to="/cimolace/solutions/virtuel-mbolo/pro"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-violet-500/20 border border-violet-500/30 text-violet-400 font-bold rounded-xl hover:bg-violet-500/30 transition-all"
                >
                  Découvrir Pro <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  to="/cimolace/solutions/virtuel-mbolo"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 text-white/60 hover:text-white transition-all"
                >
                  Comparer tous les forfaits
                </Link>
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* ══ CTA FINAL ══ */}
        <section className="py-20 px-6 bg-gradient-to-t from-cyan-500/10 to-transparent">
          <div className="max-w-4xl mx-auto text-center">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={stagger(0.1)}
            >
              <motion.h2 variants={fadeUp} className="text-3xl md:text-4xl font-black text-white mb-6">
                Prêt à lancer votre boutique ?
              </motion.h2>
              <motion.p variants={fadeUp} className="text-xl text-white/60 mb-8">
                Configuration & Propriété : 500€ + {isAnnual ? `${Math.round(annualPrice / 12)}€` : `${monthlyPrice}€`}/mois
              </motion.p>
              <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link
                  to="/cimolace/configurateur?plan=virtuel-mbolo-starter"
                  className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-bold rounded-xl hover:shadow-lg hover:shadow-cyan-500/25 transition-all"
                >
                  Configurer Starter <ArrowRight className="w-5 h-5" />
                </Link>
                <Link
                  to="/cimolace/contact"
                  className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white/[0.06] border border-white/[0.1] text-white font-bold rounded-xl hover:bg-white/[0.1] transition-all"
                >
                  Poser une question
                </Link>
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* ══ FOOTER ══ */}
        <footer className="py-8 px-6 border-t border-white/[0.05]">
          <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-white/40">
              © {new Date().getFullYear()} Virtuel-Mbolo™ Starter par CIMOLACE
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
