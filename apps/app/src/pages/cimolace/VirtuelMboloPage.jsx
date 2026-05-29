import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ShoppingBag, CreditCard, FileText, Calendar, Video, Megaphone,
  Users, Bot, BarChart3, MessageCircle, Package, Receipt,
  ArrowRight, Check, X, Sparkles, Zap, Globe, Smartphone,
  TrendingUp, Shield, Clock, Headphones, Star, Target,
  ChevronDown, ChevronUp, Store, Wallet, Truck, Bell,
  Share2, Layers, Award, PieChart, Lightbulb, Mail,
  MessageSquare, Eye, Grid, Gift, Percent, RefreshCw,
  Calculator, BookOpen
} from 'lucide-react';
import { CinematicFooter } from '@/components/ui/motion-footer';
import ThreeDMarquee from '@/components/ui/3d-marquee';
import CimolaceHeader from '@/components/cimolace/CimolaceHeader';

/* ═══════════════════════════════════════════════════════════════
   DATA — Plans Virtuel-Mbolo™
═══════════════════════════════════════════════════════════════ */

const PLANS = [
  {
    id: 'starter',
    name: 'Virtuel-Mbolo Starter',
    shortName: 'Starter',
    price: 150,
    label: 'Lancer',
    description: 'Vous pouvez commencer à vendre sans gérer la technique.',
    color: '#06b6d4',
    bg: 'from-cyan-500/10 to-cyan-500/5',
    border: 'border-cyan-500/20',
    features: [
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
      'Suivi des commandes simple',
    ],
    cta: 'Choisir Starter',
    popular: false,
  },
  {
    id: 'pro',
    name: 'Virtuel-Mbolo Pro',
    shortName: 'Pro',
    price: 200,
    label: 'Structurer',
    description: 'À 200€, vous ne vendez plus dans le désordre. Vous pilotez votre business.',
    color: '#8b5cf6',
    bg: 'from-violet-500/10 to-purple-500/5',
    border: 'border-violet-500/20',
    features: [
      'Tout Starter inclus',
      'CRM client intégré',
      'Chat client en direct',
      'Assistant IA Business LIRI',
      'Rédaction de descriptions produits IA',
      'Système d\'avis client',
      'Facturation automatique',
      'Comptabilité simple',
      'Suivi chiffre d\'affaires',
      'Paiements à venir et en retard',
      'Plan de paiement échelonné',
      'Acompte initial configurable',
      'Calendrier des échéances',
      'Montant payé / restant dû',
      'Relance automatique échéances',
      'Calcul de devis en temps réel',
      'Conversion devis → paiement',
      'Relances automatiques (panier, facture, avis)',
    ],
    cta: 'Choisir Pro',
    popular: true,
  },
  {
    id: 'elite',
    name: 'Virtuel-Mbolo Elite',
    shortName: 'Elite',
    price: 300,
    label: 'Scaler',
    description: 'À 300€, votre boutique devient un système de croissance complète.',
    color: '#f59e0b',
    bg: 'from-amber-500/10 to-orange-500/5',
    border: 'border-amber-500/20',
    features: [
      'Tout Pro inclus',
      'Moteur Marketing LIRI',
      'Créateur de publicité IA',
      'Génération de textes publicitaires',
      'Hooks marketing optimisés',
      'Visuels publicitaires multi-formats',
      'Formats TikTok / Reels / Shorts',
      'Funnel de vente complet',
      'Upsell et cross-sell',
      'Analytics avancé',
      'Recommandations IA business',
      'Event & Calendar Engine CIMOLACE',
      'Création d\'événements commerciaux',
      'Ateliers produits en ligne',
      'Réservation de rendez-vous',
      'Live Selling via LIRI Live Room',
      'Streaming vidéo/audio temps réel',
      'Vente en direct interactive',
      'Communauté client intégrée',
      'Espace privé membres',
      'Discussions et feedback',
      'Contenus exclusifs',
    ],
    cta: 'Choisir Elite',
    popular: false,
  },
];

const COMPARISON_FEATURES = [
  { name: 'Boutique en ligne professionnelle', starter: true, pro: true, elite: true },
  { name: 'Catalogue produits', starter: true, pro: true, elite: true },
  { name: 'Paiement en ligne (Stripe + Chariow)', starter: true, pro: true, elite: true },
  { name: 'Hébergement sécurisé', starter: true, pro: true, elite: true },
  { name: 'Maintenance technique', starter: true, pro: true, elite: true },
  { name: 'CRM client intégré', starter: false, pro: true, elite: true },
  { name: 'Chat client en direct', starter: false, pro: true, elite: true },
  { name: 'Assistant IA Business', starter: false, pro: true, elite: true },
  { name: 'Système d\'avis client', starter: false, pro: true, elite: true },
  { name: 'Facturation automatique', starter: false, pro: true, elite: true },
  { name: 'Comptabilité simple', starter: false, pro: true, elite: true },
  { name: 'Paiement échelonné', starter: false, pro: true, elite: true },
  { name: 'Devis temps réel', starter: false, pro: true, elite: true },
  { name: 'Relances automatiques', starter: false, pro: true, elite: true },
  { name: 'Moteur Marketing LIRI', starter: false, pro: false, elite: true },
  { name: 'Créateur de publicité IA', starter: false, pro: false, elite: true },
  { name: 'Funnel de vente', starter: false, pro: false, elite: true },
  { name: 'Live Selling', starter: false, pro: false, elite: true },
  { name: 'Événements & Calendrier', starter: false, pro: false, elite: true },
  { name: 'Communauté client', starter: false, pro: false, elite: true },
  { name: 'Analytics avancé', starter: false, pro: false, elite: true },
];

const FAQ_ITEMS = [
  {
    question: 'Est-ce que les 500€ de configuration sont obligatoires ?',
    answer: 'Oui, les 500€ sont les frais de configuration et propriété uniques. Ils couvrent l\'installation complète de votre système, l\'adaptation à votre activité, la configuration des paiements, la mise en ligne et les tests avant livraison.',
  },
  {
    question: 'Est-ce que je peux changer de forfait plus tard ?',
    answer: 'Oui, vous pouvez monter de gamme à tout moment. Passer de Starter à Pro ou d\'Elite débloque instantanément les nouvelles fonctionnalités.',
  },
  {
    question: 'Quelle est la différence entre Virtuel-Mbolo et Zahir ?',
    answer: 'Zahir est un client existant qui a servi de modèle pour créer Virtuel-Mbolo™. Virtuel-Mbolo est la solution standardisée que CIMOLACE commercialise pour tous les entrepreneurs.',
  },
  {
    question: 'La maintenance est-elle incluse ?',
    answer: 'Oui, la maintenance technique, les mises à jour de sécurité et le support sont inclus selon votre forfait. L\'hébergement sécurisé est inclus dans tous les forfaits.',
  },
  {
    question: 'Puis-je vendre en live avec Virtuel-Mbolo ?',
    answer: 'Oui, le Live Selling est inclus dans le forfait Elite. Vous pouvez organiser des sessions de vente en direct avec présentation produit, interaction client et lien de commande pendant le live.',
  },
  {
    question: 'Les paiements échelonnés sont-ils inclus ?',
    answer: 'Oui, le plan de paiement échelonné avec suivi des échéances et relances automatiques est inclus à partir du forfait Pro.',
  },
  {
    question: 'Quels moyens de paiement sont acceptés ?',
    answer: 'Virtuel-Mbolo intègre Stripe (cartes bancaires, SEPA, wallets) et Chariow (Mobile Money MTN/Orange, USSD) pour couvrir tous les clients, en Afrique et internationalement.',
  },
];

/** Screenshots live des apps via thum.io (service public, sans clé). */
const MARQUEE_IMAGES = [
  'https://image.thum.io/get/width/800/crop/600/https://zoom.us',
  'https://image.thum.io/get/width/800/crop/600/https://shopify.com',
  'https://image.thum.io/get/width/800/crop/600/https://kajabi.com',
  'https://image.thum.io/get/width/800/crop/600/https://notion.so',
  'https://image.thum.io/get/width/800/crop/600/https://stripe.com',
  'https://image.thum.io/get/width/800/crop/600/https://calendly.com',
  'https://image.thum.io/get/width/800/crop/600/https://mailchimp.com',
  'https://image.thum.io/get/width/800/crop/600/https://slack.com',
  'https://image.thum.io/get/width/800/crop/600/https://hubspot.com',
  'https://image.thum.io/get/width/800/crop/600/https://airtable.com',
  'https://image.thum.io/get/width/800/crop/600/https://zapier.com',
  'https://image.thum.io/get/width/800/crop/600/https://asana.com',
];

/** Texte + grille « trop d'outils » — même contenu que la maquette vitrine (section avant Zahir). */
const VIRTUEL_MBOLO_TOOLS_OVERLOAD_COPY = {
  eyebrow: 'Le constat',
  title: "Aujourd'hui, créer une plateforme demande trop d'outils.",
  lead:
    'Zoom, Shopify, Kajabi, Notion, Stripe, Calendly, Mailchimp... Tout est séparé. Vous payez 8 abonnements, vous administrez 8 interfaces, et vos données ne se parlent pas.',
};

const VIRTUEL_MBOLO_TOOLS_OVERLOAD_GRID = [
  { name: 'Zoom', role: 'Live & visio', Icon: Video, tint: 'rgba(45, 140, 255, 0.18)', iconColor: '#2D8CFF' },
  { name: 'Shopify', role: 'E-commerce', Icon: ShoppingBag, tint: 'rgba(149, 191, 71, 0.18)', iconColor: '#95BF47' },
  { name: 'Kajabi', role: 'Cours en ligne', Icon: BookOpen, tint: 'rgba(0, 128, 96, 0.18)', iconColor: '#00C97E' },
  { name: 'Notion', role: 'Documents', Icon: FileText, tint: 'rgba(200, 200, 255, 0.12)', iconColor: '#C8C8FF' },
  { name: 'Stripe', role: 'Paiements', Icon: CreditCard, tint: 'rgba(99, 91, 255, 0.22)', iconColor: '#635BFF' },
  { name: 'Calendly', role: 'Rendez-vous', Icon: Calendar, tint: 'rgba(0, 107, 255, 0.18)', iconColor: '#006BFF' },
  { name: 'Mailchimp', role: 'Email', Icon: Mail, tint: 'rgba(255, 224, 27, 0.14)', iconColor: '#FFE01B' },
  { name: '+ ?', role: '…et plus encore', Icon: Layers, tint: 'rgba(139, 92, 246, 0.22)', iconColor: '#8B5CF6' },
];

const VIRTUEL_MBOLO_TOOLS_OVERLOAD_STATS = [
  { value: '8h', label: 'de votre semaine perdues à jongler entre les outils.' },
  { value: '450€', label: 'd\'abonnements mensuels cumulés en moyenne.' },
  { value: '0%', label: 'de vos données réellement consolidées.' },
  { value: '∞', label: 'de complexité technique à gérer pour vous.' },
];

const TARGET_AUDIENCES = [
  {
    icon: Store,
    title: 'Entrepreneurs',
    description: 'Vous lancez votre activité et avez besoin d\'une infrastructure professionnelle clé en main.',
  },
  {
    icon: Award,
    title: 'Marques',
    description: 'Vous voulez professionnaliser votre présence en ligne avec une boutique complète et scalable.',
  },
  {
    icon: RefreshCw,
    title: 'Boutiques existantes',
    description: 'Vous avez déjà une activité mais manquez d\'outils pour gérer efficacement les commandes et clients.',
  },
  {
    icon: Package,
    title: 'Vendeurs produits physiques',
    description: 'Vous vendez des produits et avez besoin de logistique, stock et suivi de commandes.',
  },
  {
    icon: Headphones,
    title: 'Vendeurs de services',
    description: 'Vous vendez des services, consultations ou formations avec réservation et paiement échelonné.',
  },
  {
    icon: Users,
    title: 'Agences',
    description: 'Vous voulez offrir à vos clients un e-commerce clé en main, hébergé et maintenu.',
  },
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
   COMPONENTS
═══════════════════════════════════════════════════════════════ */

function PricingCard({ plan, isPopular }) {
  return (
    <motion.div
      variants={fadeUp}
      className={`relative p-8 rounded-3xl backdrop-blur-xl border transition-all duration-300 hover:scale-[1.02] ${
        isPopular
          ? 'bg-gradient-to-b from-violet-500/20 to-purple-500/10 border-violet-500/40 shadow-2xl shadow-violet-500/20'
          : 'bg-white/[0.03] border-white/[0.08] hover:border-white/[0.15]'
      }`}
    >
      {isPopular && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2">
          <span className="px-4 py-1.5 bg-gradient-to-r from-violet-500 to-purple-500 rounded-full text-xs font-bold text-white">
            Recommandé
          </span>
        </div>
      )}

      <div className="mb-6">
        <span
          className="inline-block px-3 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase mb-4"
          style={{ backgroundColor: `${plan.color}20`, color: plan.color }}
        >
          {plan.label}
        </span>
        <h3 className="text-xl font-bold text-white mb-2">{plan.name}</h3>
        <div className="flex items-baseline gap-1">
          <span className="text-4xl font-black text-white">{plan.price}€</span>
          <span className="text-white/40 text-sm">/mois</span>
        </div>
        <p className="text-sm text-white/50 mt-3 leading-relaxed">{plan.description}</p>
      </div>

      <ul className="space-y-3 mb-8">
        {plan.features.map((feature, i) => (
          <li key={i} className="flex items-start gap-3 text-sm text-white/70">
            <Check className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: plan.color }} />
            <span>{feature}</span>
          </li>
        ))}
      </ul>

      <Link
        to="/cimolace/paiement/setup"
        state={{ selectedPlan: plan.id }}
        className={`block w-full text-center py-4 rounded-xl font-bold transition-all ${
          isPopular
            ? 'bg-gradient-to-r from-violet-500 to-purple-500 text-white hover:shadow-lg hover:shadow-violet-500/25'
            : 'bg-white/[0.06] text-white hover:bg-white/[0.1] border border-white/[0.1]'
        }`}
      >
        Choisir et payer 500€
      </Link>
    </motion.div>
  );
}

function ComparisonTable() {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-white/[0.1]">
            <th className="text-left py-4 px-4 text-sm font-medium text-white/40">Fonctionnalité</th>
            <th className="text-center py-4 px-4 text-sm font-bold text-cyan-400">Starter</th>
            <th className="text-center py-4 px-4 text-sm font-bold text-violet-400">Pro</th>
            <th className="text-center py-4 px-4 text-sm font-bold text-amber-400">Elite</th>
          </tr>
        </thead>
        <tbody>
          {COMPARISON_FEATURES.map((feature, i) => (
            <tr key={i} className="border-b border-white/[0.05] hover:bg-white/[0.02]">
              <td className="py-3 px-4 text-sm text-white/70">{feature.name}</td>
              <td className="text-center py-3 px-4">
                {feature.starter ? (
                  <Check className="w-5 h-5 text-cyan-400 mx-auto" />
                ) : (
                  <X className="w-5 h-5 text-white/20 mx-auto" />
                )}
              </td>
              <td className="text-center py-3 px-4">
                {feature.pro ? (
                  <Check className="w-5 h-5 text-violet-400 mx-auto" />
                ) : (
                  <X className="w-5 h-5 text-white/20 mx-auto" />
                )}
              </td>
              <td className="text-center py-3 px-4">
                {feature.elite ? (
                  <Check className="w-5 h-5 text-amber-400 mx-auto" />
                ) : (
                  <X className="w-5 h-5 text-white/20 mx-auto" />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FAQItem({ item, isOpen, onToggle }) {
  return (
    <div className="border-b border-white/[0.1]">
      <button
        onClick={onToggle}
        className="w-full py-5 flex items-center justify-between text-left"
      >
        <span className="text-base font-medium text-white">{item.question}</span>
        {isOpen ? (
          <ChevronUp className="w-5 h-5 text-white/40" />
        ) : (
          <ChevronDown className="w-5 h-5 text-white/40" />
        )}
      </button>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="pb-5"
        >
          <p className="text-sm text-white/60 leading-relaxed">{item.answer}</p>
        </motion.div>
      )}
    </div>
  );
}

/** Hero narratif « trop d'outils » — isolé, même shell que la page (dark glass). */
function VirtuelMboloToolsOverloadHero() {
  const copy = VIRTUEL_MBOLO_TOOLS_OVERLOAD_COPY;
  return (
    <section
      className="relative py-20 md:py-28 px-6 border-t border-white/[0.06] bg-[#050507]"
      aria-labelledby="vm-tools-overload-title"
      id="constat-outils"
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-40">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(90vw,720px)] h-[min(90vw,720px)] bg-violet-600/10 rounded-full blur-[100px]" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">

          {/* ── Colonne gauche : texte + stats ── */}
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-60px' }}
            variants={stagger(0.08)}
          >
            <motion.span
              variants={fadeUp}
              className="inline-block text-xs tracking-[0.28em] uppercase text-violet-400 font-semibold mb-4"
            >
              {copy.eyebrow}
            </motion.span>
            <motion.h2
              id="vm-tools-overload-title"
              variants={fadeUp}
              className="text-3xl md:text-4xl lg:text-[2.75rem] font-black text-white tracking-tight leading-[1.15] mb-6"
            >
              {copy.title}
            </motion.h2>
            <motion.p
              variants={fadeUp}
              className="text-base md:text-lg text-white/55 leading-relaxed mb-10"
            >
              {copy.lead}
            </motion.p>

            <motion.div
              variants={stagger(0.08)}
              className="grid grid-cols-1 sm:grid-cols-2 gap-4"
            >
              {VIRTUEL_MBOLO_TOOLS_OVERLOAD_STATS.map(({ value, label }) => (
                <motion.div
                  key={value}
                  variants={fadeUp}
                  className="rounded-2xl border border-white/[0.1] bg-white/[0.04] p-5 md:p-6 backdrop-blur-sm"
                >
                  <div className="text-3xl md:text-4xl font-black text-violet-400 mb-2 tracking-tight tabular-nums">
                    {value}
                  </div>
                  <div className="text-sm md:text-[15px] text-white/55 leading-snug">{label}</div>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>

          {/* ── Colonne droite : marquee 3D ── */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="relative"
          >
            <div className="absolute inset-0 pointer-events-none rounded-3xl bg-gradient-to-b from-violet-600/10 via-transparent to-violet-600/5" />
            <ThreeDMarquee images={MARQUEE_IMAGES} />
          </motion.div>

        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════════════ */

export default function VirtuelMboloPage() {
  const [openFaq, setOpenFaq] = useState(0);

  return (
    <>
      <Helmet>
        <title>Virtuel-Mbolo™ | Solution E-commerce Clé en Main | CIMOLACE</title>
        <meta name="description" content="Virtuel-Mbolo™ - On ne vous crée pas une boutique. On vous installe un business. Solution e-commerce complète hébergée et maintenue par CIMOLACE." />
      </Helmet>

      <div className="min-h-screen bg-[#050507] text-white overflow-x-hidden">
        <CimolaceHeader />
        {/* ══ HERO ══ */}
        <section className="relative min-h-screen flex items-center justify-center px-6 py-20">
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute top-1/4 -left-1/4 w-96 h-96 bg-violet-500/20 rounded-full blur-[128px]" />
            <div className="absolute bottom-1/4 -right-1/4 w-96 h-96 bg-cyan-500/20 rounded-full blur-[128px]" />
          </div>

          <motion.div
            initial="hidden"
            animate="visible"
            variants={stagger(0.1)}
            className="relative z-10 max-w-5xl mx-auto text-center"
          >
            <motion.div variants={fadeUp} className="mb-6">
              <span className="inline-flex items-center gap-2 px-4 py-2 bg-white/[0.05] border border-white/[0.1] rounded-full text-sm text-white/60">
                <Sparkles className="w-4 h-4 text-amber-400" />
                Solution e-commerce par CIMOLACE
              </span>
            </motion.div>

            <motion.h1
              variants={fadeUp}
              className="text-[clamp(3rem,10vw,7rem)] font-black leading-[0.9] tracking-[-0.03em] mb-6"
            >
              <span className="bg-gradient-to-r from-white via-white to-white/60 bg-clip-text text-transparent">
                Virtuel-Mbolo™
              </span>
            </motion.h1>

            <motion.p
              variants={fadeUp}
              className="text-xl md:text-2xl text-white/60 max-w-3xl mx-auto mb-4"
            >
              La solution e-commerce clé en main, hébergée et gérée pour vous.
            </motion.p>

            <motion.p
              variants={fadeUp}
              className="text-lg md:text-xl text-violet-400 font-medium max-w-2xl mx-auto mb-10"
            >
              « On ne vous crée pas une boutique. On vous installe un business. »
            </motion.p>

            <motion.div
              variants={fadeUp}
              className="flex flex-col sm:flex-row gap-4 justify-center mb-12"
            >
              <Link
                to="/cimolace/paiement/setup"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-r from-violet-500 to-cyan-500 text-white font-bold rounded-xl hover:shadow-lg hover:shadow-violet-500/25 transition-all"
              >
                Payer les 500€ <ArrowRight className="w-5 h-5" />
              </Link>
              <Link
                to="/cimolace/booking"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white/[0.06] border border-white/[0.1] text-white font-bold rounded-xl hover:bg-white/[0.1] transition-all"
              >
                Prendre rendez-vous
              </Link>
            </motion.div>

            <motion.div
              variants={fadeUp}
              className="inline-flex items-center gap-3 px-6 py-3 bg-white/[0.05] border border-white/[0.1] rounded-2xl"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center">
                <Zap className="w-5 h-5 text-amber-400" />
              </div>
              <div className="text-left">
                <p className="text-xs text-white/40 uppercase tracking-wider">Configuration & Propriété</p>
                <p className="text-lg font-bold text-white">500€ <span className="text-sm font-normal text-white/50">paiement unique</span></p>
              </div>
            </motion.div>
          </motion.div>
        </section>

        <VirtuelMboloToolsOverloadHero />

        {/* ══ HISTOIRE ZAHIR ══ */}
        <section className="py-24 px-6">
          <div className="max-w-4xl mx-auto">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={stagger(0.1)}
            >
              <motion.span
                variants={fadeUp}
                className="text-xs tracking-[0.3em] uppercase text-violet-400 mb-4 block"
              >
                Le modèle qui a tout déclenché
              </motion.span>

              <motion.h2
                variants={fadeUp}
                className="text-3xl md:text-5xl font-black text-white mb-8"
              >
                L'histoire de Zahir, le client qui a inspiré Virtuel-Mbolo™
              </motion.h2>

              <motion.div
                variants={fadeUp}
                className="bg-white/[0.03] border border-white/[0.08] rounded-3xl p-8 md:p-12"
              >
                <p className="text-lg text-white/70 leading-relaxed mb-6">
                  Zahir avait déjà une boutique en ligne, mais le vrai enjeu n'était pas seulement d\'avoir une page de vente. 
                  Le besoin réel était de <strong className="text-white">mieux gérer les commandes</strong>, les paiements, 
                  les devis, les factures, la logistique, les avis clients et la croissance.
                </p>
                <p className="text-lg text-white/70 leading-relaxed mb-6">
                  Comme beaucoup d'entrepreneurs, il jonglait entre WhatsApp pour les conversations, des fichiers Excel pour 
                  le suivi, des notes manuscrites pour les devis, et des outils disparates qui ne communiquaient pas entre eux.
                </p>
                <p className="text-lg text-white/70 leading-relaxed">
                  À partir de ce modèle concret, nous avons standardisé une solution complète : <strong className="text-violet-400">Virtuel-Mbolo™</strong>. 
                  Aujourd'hui, ce système peut être installé pour d\'autres entrepreneurs qui veulent lancer ou professionnaliser 
                  leur activité e-commerce — avec une infrastructure qui marche vraiment.
                </p>
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* ══ PROBLÈME ══ */}
        <section className="py-24 px-6 bg-white/[0.02]">
          <div className="max-w-6xl mx-auto">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={stagger(0.1)}
              className="text-center mb-16"
            >
              <motion.span variants={fadeUp} className="text-xs tracking-[0.3em] uppercase text-red-400 mb-4 block">
                Le problème du marché
              </motion.span>
              <motion.h2 variants={fadeUp} className="text-3xl md:text-5xl font-black text-white">
                Pourquoi la plupart des boutiques échouent
              </motion.h2>
            </motion.div>

            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={stagger(0.08)}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            >
              {[
                { icon: Grid, title: 'Outils dispersés', desc: 'Shopify ici, Excel là, WhatsApp ailleurs. Rien ne communique.' },
                { icon: CreditCard, title: 'Paiements mal suivis', desc: 'Qui a payé ? Quand ? Combien reste-t-il dû ? Impossible à dire.' },
                { icon: Clock, title: 'Paiements échelonnés chaotiques', desc: 'Acomptes, échéances, relances manuelles. Des dettes oubliées.' },
                { icon: FileText, title: 'Factures manuelles', desc: 'Chaque facture est une corvée. Les oublis coûtent cher.' },
                { icon: Calculator, title: 'Devis lents et approximatifs', desc: 'Calculs à la main, erreurs, pertes de temps et de crédibilité.' },
                { icon: MessageCircle, title: 'Clients perdus dans WhatsApp', desc: 'Conversations éparpillées, historique introuvable, opportunités manquées.' },
                { icon: Users, title: 'Pas de CRM', desc: 'On ne sait pas qui achète, qui relancer, qui est le plus rentable.' },
                { icon: Bot, title: 'Pas d\'automatisation', desc: 'Chaque tâche répétitive est faite manuellement. Du temps perdu.' },
                { icon: Megaphone, title: 'Pas de marketing intégré', desc: 'Créer une publicité = embaucher 3 experts. Trop cher, trop lent.' },
              ].map((item, i) => (
                <motion.div
                  key={i}
                  variants={fadeUp}
                  className="p-6 bg-white/[0.03] border border-white/[0.08] rounded-2xl"
                >
                  <item.icon className="w-8 h-8 text-red-400 mb-4" />
                  <h3 className="text-lg font-bold text-white mb-2">{item.title}</h3>
                  <p className="text-sm text-white/50">{item.desc}</p>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* ══ SOLUTION ══ */}
        <section className="py-24 px-6">
          <div className="max-w-6xl mx-auto">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={stagger(0.1)}
              className="text-center mb-16"
            >
              <motion.span variants={fadeUp} className="text-xs tracking-[0.3em] uppercase text-cyan-400 mb-4 block">
                La solution complète
              </motion.span>
              <motion.h2 variants={fadeUp} className="text-3xl md:text-5xl font-black text-white mb-6">
                Virtuel-Mbolo installe tout votre business
              </motion.h2>
              <motion.p variants={fadeUp} className="text-xl text-white/60 max-w-3xl mx-auto">
                Une infrastructure e-commerce clé en main avec tous les outils de vente, gestion et croissance intégrés.
              </motion.p>
            </motion.div>

            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={stagger(0.06)}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
            >
              {[
                { icon: Store, title: 'Boutique professionnelle', color: '#06b6d4' },
                { icon: CreditCard, title: 'Paiement intégré', color: '#10b981' },
                { icon: Package, title: 'Gestion des commandes', color: '#f59e0b' },
                { icon: Users, title: 'CRM client', color: '#8b5cf6' },
                { icon: MessageCircle, title: 'Chat client', color: '#ec4899' },
                { icon: Receipt, title: 'Facturation auto', color: '#06b6d4' },
                { icon: BarChart3, title: 'Comptabilité simple', color: '#10b981' },
                { icon: Percent, title: 'Paiement échelonné', color: '#f59e0b' },
                { icon: FileText, title: 'Devis temps réel', color: '#8b5cf6' },
                { icon: Star, title: 'Avis clients', color: '#ec4899' },
                { icon: Megaphone, title: 'Marketing LIRI', color: '#06b6d4' },
                { icon: Video, title: 'Live Selling', color: '#10b981' },
                { icon: Calendar, title: 'Événements & RDV', color: '#f59e0b' },
                { icon: Globe, title: 'Communauté client', color: '#8b5cf6' },
              ].map((item, i) => (
                <motion.div
                  key={i}
                  variants={fadeUp}
                  whileHover={{ y: -4, borderColor: `${item.color}40` }}
                  className="p-5 bg-white/[0.03] border border-white/[0.08] rounded-xl transition-all duration-300"
                >
                  <item.icon className="w-6 h-6 mb-3" style={{ color: item.color }} />
                  <h3 className="text-sm font-bold text-white">{item.title}</h3>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* ══ FRAIS DE CONFIGURATION ══ */}
        <section className="py-24 px-6 bg-gradient-to-b from-violet-500/10 to-transparent">
          <div className="max-w-4xl mx-auto">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={stagger(0.1)}
              className="bg-white/[0.05] border border-violet-500/30 rounded-3xl p-8 md:p-12"
            >
              <motion.div variants={fadeUp} className="flex items-center gap-4 mb-6">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500/20 to-purple-500/20 flex items-center justify-center">
                  <Zap className="w-7 h-7 text-violet-400" />
                </div>
                <div>
                  <span className="text-xs tracking-[0.3em] uppercase text-violet-400">Frais de configuration</span>
                  <h2 className="text-2xl md:text-3xl font-black text-white">Configuration & Propriété</h2>
                </div>
              </motion.div>

              <motion.div variants={fadeUp} className="flex items-baseline gap-2 mb-6">
                <span className="text-5xl font-black text-white">500€</span>
                <span className="text-white/50">paiement unique</span>
              </motion.div>

              <motion.p variants={fadeUp} className="text-lg text-white/70 mb-8 leading-relaxed">
                « Les 500€ ne sont pas un simple frais technique. C'est l\'installation de votre système commercial personnalisé. »
              </motion.p>

              <motion.div variants={fadeUp} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  'Installation de l\'instance client',
                  'Configuration de la boutique',
                  'Adaptation du modèle à votre activité',
                  'Configuration des produits et catégories',
                  'Configuration des paiements (Stripe + Chariow)',
                  'Configuration du back-office',
                  'Mise en ligne sur votre espace',
                  'Activation de l\'abonnement choisi',
                  'Maintenance initiale et tests',
                  'Récupération/adaptation si vous avez déjà une base',
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3 text-sm text-white/60">
                    <Check className="w-4 h-4 text-violet-400 flex-shrink-0" />
                    {item}
                  </div>
                ))}
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* ══ PRICING ══ */}
        <section className="py-24 px-6" id="forfaits">
          <div className="max-w-7xl mx-auto">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={stagger(0.1)}
              className="text-center mb-16"
            >
              <motion.span variants={fadeUp} className="text-xs tracking-[0.3em] uppercase text-amber-400 mb-4 block">
                Les trois niveaux
              </motion.span>
              <motion.h2 variants={fadeUp} className="text-3xl md:text-5xl font-black text-white mb-6">
                150€ pour lancer. 200€ pour structurer. 300€ pour grandir.
              </motion.h2>
            </motion.div>

            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={stagger(0.15)}
              className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8"
            >
              {PLANS.map((plan) => (
                <PricingCard key={plan.id} plan={plan} isPopular={plan.popular} />
              ))}
            </motion.div>
          </div>
        </section>

        {/* ══ TABLEAU COMPARATIF ══ */}
        <section className="py-24 px-6 bg-white/[0.02]">
          <div className="max-w-5xl mx-auto">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={stagger(0.1)}
            >
              <motion.h2
                variants={fadeUp}
                className="text-2xl md:text-4xl font-black text-white text-center mb-12"
              >
                Tableau comparatif complet
              </motion.h2>

              <motion.div
                variants={fadeUp}
                className="bg-white/[0.03] border border-white/[0.08] rounded-3xl p-6 md:p-8"
              >
                <ComparisonTable />
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* ══ COMPARAISON MARCHÉ ══ */}
        <section className="py-24 px-6">
          <div className="max-w-4xl mx-auto">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={stagger(0.1)}
            >
              <motion.h2
                variants={fadeUp}
                className="text-2xl md:text-4xl font-black text-white text-center mb-12"
              >
                Pourquoi Virtuel-Mbolo vs les outils séparés ?
              </motion.h2>

              <motion.div
                variants={fadeUp}
                className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6 mb-6"
              >
                <h3 className="text-lg font-bold text-red-400 mb-4">Avec des outils séparés, vous payez :</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-white/60">
                  <div className="flex items-center gap-2"><X className="w-4 h-4 text-red-400" /> Shopify ou équivalent (~30€/mois)</div>
                  <div className="flex items-center gap-2"><X className="w-4 h-4 text-red-400" /> Applications de paiement (~20€/mois)</div>
                  <div className="flex items-center gap-2"><X className="w-4 h-4 text-red-400" /> CRM séparé (~50€/mois)</div>
                  <div className="flex items-center gap-2"><X className="w-4 h-4 text-red-400" /> Outil de facturation (~15€/mois)</div>
                  <div className="flex items-center gap-2"><X className="w-4 h-4 text-red-400" /> Outil de calendrier (~10€/mois)</div>
                  <div className="flex items-center gap-2"><X className="w-4 h-4 text-red-400" /> Outil marketing (~50€/mois)</div>
                  <div className="flex items-center gap-2"><X className="w-4 h-4 text-red-400" /> Live streaming (~20€/mois)</div>
                  <div className="flex items-center gap-2"><X className="w-4 h-4 text-red-400" /> Outil communauté (~30€/mois)</div>
                  <div className="flex items-center gap-2"><X className="w-4 h-4 text-red-400" /> Tunnel de vente (~40€/mois)</div>
                  <div className="flex items-center gap-2"><X className="w-4 h-4 text-red-400" /> Développeur / maintenance (variable)</div>
                </div>
                <p className="text-lg font-bold text-white mt-4">Total potentiel : 200€ à 400€/mois + complexité</p>
              </motion.div>

              <motion.div
                variants={fadeUp}
                className="bg-green-500/10 border border-green-500/20 rounded-2xl p-6"
              >
                <h3 className="text-lg font-bold text-green-400 mb-4">Avec Virtuel-Mbolo™ :</h3>
                <div className="flex items-center gap-3 mb-4">
                  <Check className="w-6 h-6 text-green-400" />
                  <span className="text-xl text-white">Tout inclus dans une offre claire à partir de <strong className="text-green-400">150€/mois</strong></span>
                </div>
                <p className="text-sm text-white/60">Sans compter le temps gagné, la simplicité d'utilisation et la cohérence entre tous les outils.</p>
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* ══ POUR QUI ══ */}
        <section className="py-24 px-6 bg-white/[0.02]">
          <div className="max-w-6xl mx-auto">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={stagger(0.1)}
              className="text-center mb-16"
            >
              <motion.h2 variants={fadeUp} className="text-3xl md:text-4xl font-black text-white">
                Pour qui est Virtuel-Mbolo™ ?
              </motion.h2>
            </motion.div>

            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={stagger(0.08)}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            >
              {TARGET_AUDIENCES.map((audience, i) => (
                <motion.div
                  key={i}
                  variants={fadeUp}
                  className="p-6 bg-white/[0.03] border border-white/[0.08] rounded-2xl hover:border-white/[0.15] transition-colors"
                >
                  <audience.icon className="w-10 h-10 text-cyan-400 mb-4" />
                  <h3 className="text-lg font-bold text-white mb-2">{audience.title}</h3>
                  <p className="text-sm text-white/50">{audience.description}</p>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* ══ FAQ ══ */}
        <section className="py-24 px-6">
          <div className="max-w-3xl mx-auto">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={stagger(0.1)}
            >
              <motion.h2
                variants={fadeUp}
                className="text-3xl md:text-4xl font-black text-white text-center mb-12"
              >
                Questions fréquentes
              </motion.h2>

              <motion.div
                variants={fadeUp}
                className="bg-white/[0.03] border border-white/[0.08] rounded-3xl p-6 md:p-8"
              >
                {FAQ_ITEMS.map((item, i) => (
                  <FAQItem
                    key={i}
                    item={item}
                    isOpen={openFaq === i}
                    onToggle={() => setOpenFaq(openFaq === i ? -1 : i)}
                  />
                ))}
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* ══ RENDEZ-VOUS CONSEILLER ══ */}
        <section className="py-24 px-6 bg-white/[0.02]" id="rendezvous">
          <div className="max-w-4xl mx-auto">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={stagger(0.1)}
              className="text-center mb-12"
            >
              <motion.span
                variants={fadeUp}
                className="text-xs tracking-[0.3em] uppercase text-cyan-400 mb-4 block"
              >
                Besoin d'aide pour choisir ?
              </motion.span>
              <motion.h2
                variants={fadeUp}
                className="text-3xl md:text-5xl font-black text-white mb-6"
              >
                Prenez rendez-vous avec un conseiller
              </motion.h2>
              <motion.p
                variants={fadeUp}
                className="text-lg text-white/60 max-w-2xl mx-auto"
              >
                Notre équipe vous aide à choisir le forfait adapté à votre activité et répond à toutes vos questions.
              </motion.p>
            </motion.div>

            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={stagger(0.08)}
              className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12"
            >
              {[
                { icon: MessageCircle, title: 'Appel découverte 15min', desc: 'Présentation rapide de Virtuel-Mbolo et réponse à vos premières questions.', duration: '15 min', free: true },
                { icon: Video, title: 'Démonstration personnalisée', desc: 'Visio complète avec démo des fonctionnalités selon votre secteur d\'activité.', duration: '45 min', free: true },
                { icon: Store, title: 'Audit de votre projet', desc: 'Analyse de vos besoins et recommandation du forfait optimal.', duration: '30 min', free: true },
                { icon: Headphones, title: 'Support prioritaire', desc: 'Accès direct à notre équipe pour accompagnement sur-mesure.', duration: 'Illimité', elite: true },
              ].map((item, i) => (
                <motion.div
                  key={i}
                  variants={fadeUp}
                  className="p-6 bg-white/[0.03] border border-white/[0.08] rounded-2xl hover:border-cyan-500/30 transition-all"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-cyan-500/20 flex items-center justify-center flex-shrink-0">
                      <item.icon className="w-6 h-6 text-cyan-400" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold text-white">{item.title}</h3>
                        {item.free && (
                          <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full">Gratuit</span>
                        )}
                        {item.elite && (
                          <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 text-xs rounded-full">Elite</span>
                        )}
                      </div>
                      <p className="text-sm text-white/50 mb-2">{item.desc}</p>
                      <p className="text-xs text-white/40">⏱️ {item.duration}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>

            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
              className="text-center"
            >
              <Link
                to="/cimolace/contact?type=rdv-virtuelmbolo"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-bold rounded-xl hover:shadow-lg hover:shadow-cyan-500/25 transition-all"
              >
                <Calendar className="w-5 h-5" />
                Réserver mon créneau
              </Link>
              <p className="mt-4 text-sm text-white/40">
                Disponible du lundi au vendredi, 9h-18h (heure du Gabon)
              </p>
            </motion.div>
          </div>
        </section>

        {/* ══ CTA FINAL ══ */}
        <section className="py-24 px-6 bg-gradient-to-t from-violet-500/20 to-transparent">
          <div className="max-w-4xl mx-auto text-center">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={stagger(0.1)}
            >
              <motion.h2
                variants={fadeUp}
                className="text-3xl md:text-5xl font-black text-white mb-6"
              >
                Prêt à installer votre business en ligne ?
              </motion.h2>

              <motion.p
                variants={fadeUp}
                className="text-xl text-white/60 mb-10"
              >
                Configurez votre système Virtuel-Mbolo™ et commencez à vendre avec une infrastructure professionnelle.
              </motion.p>

              <motion.div
                variants={fadeUp}
                className="flex flex-col sm:flex-row gap-4 justify-center"
              >
                <Link
                  to="/cimolace/paiement/setup"
                  className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-r from-violet-500 to-cyan-500 text-white font-bold rounded-xl hover:shadow-lg hover:shadow-violet-500/25 transition-all"
                >
                  Payer les 500€ de configuration <ArrowRight className="w-5 h-5" />
                </Link>
                <Link
                  to="/cimolace/booking"
                  className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white/[0.06] border border-white/[0.1] text-white font-bold rounded-xl hover:bg-white/[0.1] transition-all"
                >
                  Parler à un conseiller
                </Link>
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* ══ CINEMATIC FOOTER ══ */}
        <CinematicFooter />
      </div>
    </>
  );
}
