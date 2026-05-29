import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Megaphone, Sparkles, TrendingUp, Video, Calendar, Users,
  BarChart3, Bot, Zap, ArrowRight, Check, Crown, Rocket,
  Target, Flame, Globe, Award, ChevronDown, ChevronUp,
  Share2, ShoppingBag, MessageSquare, Gift, Star
} from 'lucide-react';

/* ═══════════════════════════════════════════════════════════════
   DATA — Plan Elite
═══════════════════════════════════════════════════════════════ */

const ELITE_MODULES = [
  {
    icon: Megaphone,
    title: 'Moteur Marketing LIRI',
    desc: 'Créez automatiquement des campagnes publicitaires avec l\'IA LIRI.',
    features: ['Publicités auto-générées', 'Textes de vente IA', 'Hooks optimisés', 'Visuels multi-formats', 'A/B testing intégré']
  },
  {
    icon: Sparkles,
    title: 'Créateur de Publicité IA',
    desc: 'Transformez un produit en annonces prêtes à publier sur tous les réseaux.',
    features: ['Analyse produit IA', 'Ciblage automatique', 'Variations de messages', 'CTAs optimisés', 'Multi-plateformes']
  },
  {
    icon: TrendingUp,
    title: 'Funnel de Vente Complet',
    desc: 'Créez des parcours de conversion optimisés avec upsells et cross-sells.',
    features: ['Pages d\'offre', 'Upsells intelligents', 'Cross-sells', 'Suivi conversion', 'Optimisation IA']
  },
  {
    icon: Video,
    title: 'Live Selling LIRI',
    desc: 'Vendez en direct comme sur TikTok Shop avec streaming intégré.',
    features: ['Streaming HD', 'Interaction temps réel', 'Lien commande live', 'Démonstration produit', 'Replay auto']
  },
  {
    icon: Calendar,
    title: 'Event & Calendar Engine',
    desc: 'Organisez des événements commerciaux, ateliers et sessions de vente.',
    features: ['Événements commerciaux', 'Ateliers produits', 'Réservations', 'Rappels auto', 'Suivi participants']
  },
  {
    icon: Users,
    title: 'Communauté Client',
    desc: 'Créez un espace privé pour fidéliser vos clients et créer du lien.',
    features: ['Espace membres privé', 'Discussions', 'Contenus exclusifs', 'Feedback client', 'Fidélisation']
  },
  {
    icon: BarChart3,
    title: 'Analytics Avancé',
    desc: 'Comprenez votre business avec des données détaillées et des recommandations IA.',
    features: ['Sources de trafic', 'Conversion tracking', 'Panier moyen', 'Recommandations IA', 'Rapports auto']
  },
  {
    icon: Bot,
    title: 'IA Stratégique Business',
    desc: 'Un assistant IA qui vous conseille pour optimiser vos offres et campagnes.',
    features: ['Suggestions campagnes', 'Optimisation offres', 'Conseils relances', 'Idées promotions', 'Analyse performances']
  },
];

const ELITE_INCLUDES = [
  'Tout Pro inclus',
  'Moteur Marketing LIRI',
  'Créateur de publicité IA',
  'Funnel de vente complet',
  'Live Selling LIRI',
  'Event & Calendar Engine',
  'Communauté client',
  'Analytics avancé',
  'IA stratégique business',
  'Formations TikTok/Reels/Shorts',
  'Déclinaison multi-plateformes',
  'Support prioritaire',
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

export default function VirtuelMboloElitePage() {
  const [isAnnual, setIsAnnual] = useState(false);
  const [expandedModule, setExpandedModule] = useState(0);
  const monthlyPrice = 300;
  const annualPrice = 300 * 10; // 2 mois offerts

  return (
    <>
      <Helmet>
        <title>Virtuel-Mbolo Elite | 300€/mois | Marketing IA + Live | CIMOLACE</title>
        <meta name="description" content="Virtuel-Mbolo Elite à 300€/mois. Scalez avec marketing IA, live selling, funnel de vente, événements et communauté client." />
      </Helmet>

      <div className="min-h-screen bg-[#050507] text-white overflow-x-hidden">
        {/* ══ BANNER ELITE ══ */}
        <div className="bg-gradient-to-r from-amber-500/20 via-orange-500/20 to-yellow-500/20 border-b border-amber-500/20">
          <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-center gap-2 text-sm">
            <Crown className="w-4 h-4 text-amber-400" />
            <span className="font-bold text-amber-400">Forfait Elite</span>
            <span className="text-white/40">|</span>
            <span className="text-white/60">Configuration & Propriété :</span>
            <span className="font-bold text-white">500€</span>
          </div>
        </div>

        {/* ══ HERO ══ */}
        <section className="relative py-20 px-6">
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-[128px]" />
            <div className="absolute top-1/2 right-1/4 w-96 h-96 bg-orange-500/10 rounded-full blur-[128px]" />
            <div className="absolute bottom-0 left-1/2 w-96 h-96 bg-yellow-500/10 rounded-full blur-[128px]" />
          </div>

          <motion.div
            initial="hidden"
            animate="visible"
            variants={stagger(0.1)}
            className="relative z-10 max-w-5xl mx-auto"
          >
            {/* Badge */}
            <motion.div variants={fadeUp} className="mb-6">
              <span className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30 rounded-full text-sm font-medium text-amber-400">
                <Crown className="w-4 h-4" />
                Forfait Elite — Moteur de Croissance
              </span>
            </motion.div>

            {/* Titre */}
            <motion.h1
              variants={fadeUp}
              className="text-4xl md:text-6xl font-black text-white mb-6 leading-tight"
            >
              Attirez, engagez,
              <span className="block bg-gradient-to-r from-amber-400 via-orange-400 to-yellow-400 bg-clip-text text-transparent">
                vendez et scalez
              </span>
            </motion.h1>

            {/* Sous-titre */}
            <motion.p
              variants={fadeUp}
              className="text-xl text-white/60 max-w-2xl mb-8"
            >
              « À 300€, votre boutique devient un système de croissance : marketing, live, événements, communauté et intelligence business. »
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
                    !isAnnual ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white' : 'text-white/60 hover:text-white'
                  }`}
                >
                  Mensuel
                </button>
                <button
                  onClick={() => setIsAnnual(true)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2 ${
                    isAnnual ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white' : 'text-white/60 hover:text-white'
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
                to="/cimolace/configurateur?plan=virtuel-mbolo-elite"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-r from-amber-500 via-orange-500 to-yellow-500 text-white font-bold rounded-xl hover:shadow-lg hover:shadow-amber-500/25 transition-all"
              >
                Activer Elite <Zap className="w-5 h-5" />
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
                Économisez 600€ par an avec l'abonnement annuel (2 mois offerts)
              </motion.p>
            )}
          </motion.div>
        </section>

        {/* ══ SPOTLIGHT: LIVE SELLING ══ */}
        <section className="py-20 px-6 bg-white/[0.02]">
          <div className="max-w-6xl mx-auto">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={stagger(0.1)}
              className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center"
            >
              <motion.div variants={fadeUp}>
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-red-500/20 rounded-full text-xs font-medium text-red-400 mb-4">
                  <Video className="w-3 h-3" />
                  Live Selling
                </div>
                <h2 className="text-3xl md:text-4xl font-black text-white mb-4">
                  Vendez en direct comme sur TikTok Shop
                </h2>
                <p className="text-white/60 mb-6 leading-relaxed">
                  Organisez des sessions de live shopping où vos clients voient vos produits en direct, 
                  posent des questions, et achètent en un clic. Créez l'urgence, la confiance et 
                  des moments de conversion uniques.
                </p>
                <ul className="space-y-3">
                  {[
                    'Streaming vidéo/audio HD en temps réel',
                    'Présentation produit interactive',
                    'Questions/réponses en direct',
                    'Lien de commande intégré au live',
                    'Replay automatique disponible'
                  ].map((item, i) => (
                    <li key={i} className="flex items-center gap-3 text-white/70">
                      <Check className="w-5 h-5 text-red-400" />
                      {item}
                    </li>
                  ))}
                </ul>
              </motion.div>

              <motion.div
                variants={fadeUp}
                className="relative"
              >
                <div className="aspect-video bg-gradient-to-br from-red-500/20 to-orange-500/20 rounded-3xl border border-red-500/20 p-8 flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-red-500/20 flex items-center justify-center">
                      <Video className="w-10 h-10 text-red-400" />
                    </div>
                    <p className="text-white/60 text-sm">LIRI Live Room™ intégré</p>
                    <p className="text-white font-bold">Live Selling Engine</p>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* ══ SPOTLIGHT: MARKETING IA ══ */}
        <section className="py-20 px-6">
          <div className="max-w-6xl mx-auto">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={stagger(0.1)}
              className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center"
            >
              <motion.div
                variants={fadeUp}
                className="order-2 lg:order-1 relative"
              >
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { icon: Share2, label: 'TikTok', color: 'from-pink-500/20 to-rose-500/20' },
                    { icon: MessageSquare, label: 'WhatsApp', color: 'from-green-500/20 to-emerald-500/20' },
                    { icon: Globe, label: 'Facebook', color: 'from-blue-500/20 to-cyan-500/20' },
                    { icon: Target, label: 'Instagram', color: 'from-purple-500/20 to-pink-500/20' },
                  ].map((platform, i) => (
                    <div key={i} className={`p-6 bg-gradient-to-br ${platform.color} rounded-2xl border border-white/10 text-center`}>
                      <platform.icon className="w-8 h-8 mx-auto mb-2 text-white/60" />
                      <p className="text-sm font-medium text-white">{platform.label}</p>
                    </div>
                  ))}
                </div>
              </motion.div>

              <motion.div variants={fadeUp} className="order-1 lg:order-2">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-violet-500/20 rounded-full text-xs font-medium text-violet-400 mb-4">
                  <Sparkles className="w-3 h-3" />
                  Marketing IA
                </div>
                <h2 className="text-3xl md:text-4xl font-black text-white mb-4">
                  Créez des campagnes en quelques clics
                </h2>
                <p className="text-white/60 mb-6 leading-relaxed">
                  L'IA LIRI analyse vos produits et génère automatiquement des publicités 
                  complètes pour tous les réseaux. Textes, visuels, hooks, CTAs — tout est 
                  optimisé pour convertir.
                </p>
                <ul className="space-y-3">
                  {[
                    'Publicités auto-générées par IA',
                    'Adaptation multi-plateformes (TikTok, FB, IG, WA)',
                    'Hooks et CTAs optimisés',
                    'A/B testing intégré',
                    'Suggestions de campagnes stratégiques'
                  ].map((item, i) => (
                    <li key={i} className="flex items-center gap-3 text-white/70">
                      <Check className="w-5 h-5 text-violet-400" />
                      {item}
                    </li>
                  ))}
                </ul>
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* ══ MODULES ELITE ══ */}
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
                8 moteurs de croissance
              </motion.h2>
              <motion.p variants={fadeUp} className="text-white/60">
                Les outils avancés de CIMOLACE pour transformer votre boutique en machine à vendre
              </motion.p>
            </motion.div>

            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={stagger(0.08)}
              className="grid grid-cols-1 lg:grid-cols-2 gap-4"
            >
              {ELITE_MODULES.map((module, i) => (
                <motion.div
                  key={i}
                  variants={fadeUp}
                  className={`p-6 bg-white/[0.03] border rounded-2xl transition-all duration-300 cursor-pointer ${
                    expandedModule === i ? 'border-amber-500/40 bg-amber-500/5' : 'border-white/[0.08] hover:border-amber-500/20'
                  }`}
                  onClick={() => setExpandedModule(expandedModule === i ? -1 : i)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center flex-shrink-0">
                        <module.icon className="w-6 h-6 text-amber-400" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-white mb-1">{module.title}</h3>
                        <p className="text-sm text-white/50">{module.desc}</p>
                      </div>
                    </div>
                    {expandedModule === i ? (
                      <ChevronUp className="w-5 h-5 text-amber-400" />
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
                            <Check className="w-3 h-3 text-amber-400" />
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

        {/* ══ CE QUI EST INCLUS ══ */}
        <section className="py-20 px-6">
          <div className="max-w-4xl mx-auto">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={stagger(0.1)}
            >
              <motion.h2 variants={fadeUp} className="text-3xl md:text-4xl font-black text-white text-center mb-12">
                Tout ce qui est inclus dans Elite
              </motion.h2>

              <motion.div variants={fadeUp} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {ELITE_INCLUDES.map((item, i) => (
                  <div key={i} className="flex items-center gap-3 p-4 bg-white/[0.03] border border-white/[0.08] rounded-xl">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center flex-shrink-0">
                      <Check className="w-4 h-4 text-amber-400" />
                    </div>
                    <span className="text-white/80">{item}</span>
                  </div>
                ))}
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* ══ COMPARAISON ══ */}
        <section className="py-20 px-6 bg-white/[0.02]">
          <div className="max-w-5xl mx-auto">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={stagger(0.1)}
              className="text-center mb-12"
            >
              <motion.h2 variants={fadeUp} className="text-3xl md:text-4xl font-black text-white mb-4">
                La progression Elite
              </motion.h2>
            </motion.div>

            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={stagger(0.1)}
              className="grid grid-cols-1 md:grid-cols-3 gap-6"
            >
              <motion.div
                variants={fadeUp}
                className="p-6 bg-white/[0.03] border border-white/[0.08] rounded-2xl"
              >
                <p className="text-sm text-cyan-400 font-medium mb-2">Starter — 150€</p>
                <p className="text-white font-bold mb-2">Vous pouvez vendre</p>
                <p className="text-white/50 text-sm">Boutique + paiement + hébergement</p>
              </motion.div>

              <motion.div
                variants={fadeUp}
                className="p-6 bg-white/[0.03] border border-white/[0.08] rounded-2xl"
              >
                <p className="text-sm text-violet-400 font-medium mb-2">Pro — 200€</p>
                <p className="text-white font-bold mb-2">Vous contrôlez</p>
                <p className="text-white/50 text-sm">+ CRM + facturation + échelonnement</p>
              </motion.div>

              <motion.div
                variants={fadeUp}
                className="p-6 bg-gradient-to-br from-amber-500/10 to-orange-500/5 border border-amber-500/30 rounded-2xl"
              >
                <p className="text-sm text-amber-400 font-medium mb-2">Elite — 300€</p>
                <p className="text-white font-bold mb-2">Vous scalez</p>
                <p className="text-white/50 text-sm">+ Marketing IA + Live + Communauté</p>
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* ══ CTA FINAL ══ */}
        <section className="py-20 px-6 bg-gradient-to-t from-amber-500/10 via-orange-500/5 to-transparent">
          <div className="max-w-4xl mx-auto text-center">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={stagger(0.1)}
            >
              <motion.div variants={fadeUp} className="mb-6">
                <Crown className="w-16 h-16 mx-auto text-amber-400" />
              </motion.div>
              <motion.h2 variants={fadeUp} className="text-3xl md:text-5xl font-black text-white mb-6">
                Prêt à scaler votre business ?
              </motion.h2>
              <motion.p variants={fadeUp} className="text-xl text-white/60 mb-8">
                Configuration : 500€ + {isAnnual ? `${Math.round(annualPrice / 12)}€` : `${monthlyPrice}€`}/mois
              </motion.p>
              <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link
                  to="/cimolace/configurateur?plan=virtuel-mbolo-elite"
                  className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-r from-amber-500 via-orange-500 to-yellow-500 text-white font-bold rounded-xl hover:shadow-lg hover:shadow-amber-500/25 transition-all text-lg"
                >
                  Activer Elite <Zap className="w-5 h-5" />
                </Link>
                <Link
                  to="/cimolace/contact"
                  className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white/[0.06] border border-white/[0.1] text-white font-bold rounded-xl hover:bg-white/[0.1] transition-all"
                >
                  Parler à un conseiller
                </Link>
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* ══ FOOTER ══ */}
        <footer className="py-8 px-6 border-t border-white/[0.05]">
          <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-white/40">
              © {new Date().getFullYear()} Virtuel-Mbolo™ Elite par CIMOLACE
            </p>
            <div className="flex items-center gap-6">
              <Link to="/cimolace/solutions/virtuel-mbolo" className="text-sm text-white/60 hover:text-white transition-colors">
                Tous les forfaits
              </Link>
              <Link to="/cimolace" className="text-sm text-amber-400 hover:text-amber-300 transition-colors">
                CIMOLACE ↗
              </Link>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
