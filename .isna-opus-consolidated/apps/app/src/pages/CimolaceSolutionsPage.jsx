import React, { useState, useRef } from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { motion, useScroll, useSpring, useInView, AnimatePresence } from 'framer-motion';
import {
  Zap, Video, Palette, GraduationCap, Calendar, ShoppingCart, Megaphone,
  ChevronDown, ArrowRight, Monitor, Brain, Users, CreditCard,
  Package, Sparkles, Globe, Radio, BookOpen, Clock, Mic,
  MessageSquare, Eye, Settings, BarChart3, Headphones,
  Languages, Lightbulb, Truck, Receipt, Tag, Mail,
  Wand2, PenTool, Layers, Shield, Target, Cpu, FileText,
  Play, Share2, Clapperboard, CheckCircle2, Boxes, Heart,
} from 'lucide-react';
import { cimolacePlatformConfig } from '@/tenants/cimolace/cimolacePlatform.config';
import TeamShowcase from '@/components/ui/team-showcase';

/* ═══════════════════════════════════════════════════════════════
   DATA — 6 solutions CIMOLACE OS + technologies embarquées
═══════════════════════════════════════════════════════════════ */

const SOLUTIONS = [
  {
    id: 'live-room',
    name: 'LIRI Live Room Immersive™',
    shortName: 'Live Room',
    tagline: 'La salle live intelligente, immersive et pédagogique',
    promise: 'Ne faites plus des réunions. Créez des expériences live intelligentes.',
    icon: Video,
    color: '#ec4899',
    bg: 'from-pink-500/10 to-rose-500/5',
    border: 'border-pink-500/20',
    problem: "Les outils de visioconférence classiques ne sont pas conçus pour enseigner, scénariser ou piloter une classe immersive. L'hôte jongle entre 10 outils différents.",
    audience: 'Écoles en ligne, formateurs, coachs, conférenciers, communautés privées, institutions spirituelles, universités alternatives',
    differentiator: 'LIRI orchestre une salle — pas seulement des fonctionnalités. Zoom connecte, OBS diffuse. LIRI réunit les deux dans une arène pédagogique.',
    techCount: 33,
    techs: [
      { name: 'LiveKit Mesh Core™', desc: 'Moteur vidéo/audio temps réel WebRTC, faible latence', icon: Radio },
      { name: 'SmartBoard Live Layer™', desc: 'Tableau interactif synchronisé pendant le live', icon: Monitor },
      { name: 'DebateCore™ + AI Judge™', desc: 'Débat structuré avec IA arbitre, rounds et scoring', icon: MessageSquare },
      { name: 'NeuroRecall™', desc: 'Mémorisation post-live : flashcards, résumés, progression', icon: Brain },
      { name: 'Secret Classroom Mode™', desc: 'Audio/vidéo privé sans quitter la salle principale', icon: Eye },
      { name: 'Sonic Flow™', desc: 'Ambiances audio scéniques avec ducking micro automatique', icon: Headphones },
      { name: 'LIRI Multilang Live™', desc: 'Sous-titres et traduction multilingue en temps réel', icon: Languages },
      { name: 'Phase Engine™', desc: 'Cycle de vie organisé : loading, setup, waiting, live, ended', icon: Settings },
    ],
  },
  {
    id: 'creator-studio',
    name: 'LIRI Creator Studio™',
    shortName: 'Creator Studio',
    tagline: 'Le studio de création complet pour cours, documents, SmartBoards, vidéos et contenus',
    promise: 'Un seul studio pour créer tout votre contenu éducatif, visuel et commercial.',
    icon: Palette,
    color: '#8b5cf6',
    bg: 'from-violet-500/10 to-purple-500/5',
    border: 'border-violet-500/20',
    problem: "Les créateurs jonglent entre Canva, PowerPoint, Premiere, Notion, Mailchimp… Aucun outil ne relie la pédagogie, la création visuelle, le live et l'export.",
    audience: 'Créateurs de contenu, formateurs, agences, écoles, auteurs, producteurs vidéo, équipes pédagogiques',
    differentiator: 'LIRI Creator Studio rassemble création visuelle, document, vidéo, pédagogie, IA, live et export dans un seul environnement.',
    techCount: 30,
    techs: [
      { name: 'SmartBoard Designer™', desc: 'Éditeur visuel de tableaux et slides interactifs', icon: PenTool },
      { name: 'Course Copilot™', desc: 'Assistant IA qui propose scènes et structures pédagogiques', icon: Sparkles },
      { name: 'Formation Builder™', desc: 'Construction de formations avec modules, leçons et exercices', icon: Layers },
      { name: 'VideoPostProduction™', desc: 'Montage vidéo intégré : timeline, découpe, export', icon: Clapperboard },
      { name: 'DocumentCoachPanel™', desc: 'Coach IA qui restructure et enrichit vos documents', icon: FileText },
      { name: 'Live Production Studio™', desc: 'Blueprint de live avec scènes, contenus et permissions', icon: Play },
      { name: 'Debate Builder™', desc: 'Préparation de débats : sujet, camps, rounds, règles', icon: MessageSquare },
      { name: 'StudioExportCenter™', desc: 'Export centralisé : vidéo, PDF, SRT, TXT, PNG, ZIP', icon: Share2 },
    ],
  },
  {
    id: 'school-engine',
    name: 'LIRI School Engine™',
    shortName: 'School Engine',
    tagline: 'Le moteur de gestion de parcours pédagogiques et de certification',
    promise: 'Construisez des écoles complètes avec parcours, certifications et intelligence artificielle.',
    icon: GraduationCap,
    color: '#10b981',
    bg: 'from-emerald-500/10 to-green-500/5',
    border: 'border-emerald-500/20',
    problem: "Les plateformes comme Kajabi ou Teachable hébergent des formations, mais ne construisent pas automatiquement une pédagogie, ne pilotent pas d'agents IA et ne vérifient pas la qualité chapitre par chapitre.",
    audience: 'Écoles en ligne, académies privées, organismes de formation, universités alternatives, plateformes éducatives',
    differentiator: 'LIRI School Engine ne se contente pas d\'héberger une formation. Il aide à créer une école intelligente avec pipeline IA et certification.',
    techCount: 20,
    techs: [
      { name: 'Formation LLM Builder™', desc: 'IA qui transforme un brief en structure de formation', icon: Wand2 },
      { name: 'LIRI Masterclass Coach™', desc: 'Création de masterclass avec pipeline pédagogique 13 étapes', icon: Lightbulb },
      { name: 'LIRI Brain Trinity™', desc: 'IA multi-agents : Coach, Architecte et Live Assistant', icon: Brain },
      { name: 'Certification Engine™', desc: 'Délivrance de certificats après parcours validé', icon: CheckCircle2 },
      { name: cimolacePlatformConfig.schoolPipelineProductName, desc: 'Orchestration de la production pédagogique IA', icon: Cpu },
      { name: 'Quality Check Pédagogique™', desc: 'Vérification automatique de chaque chapitre', icon: Shield },
      { name: 'Automatic Test Generator™', desc: 'Génération de QCM, quiz et exercices depuis le contenu', icon: FileText },
      { name: 'MasterScript™', desc: 'Script maître structurant le cours ou le live', icon: BookOpen },
    ],
  },
  {
    id: 'admin-booking',
    name: 'LIRI Admin Booking Engine™',
    shortName: 'Admin Booking',
    tagline: 'Le moteur de réservation, calendrier et secrétariat intelligent',
    promise: 'Ne créez pas juste un calendrier. Créez un secrétariat intelligent.',
    icon: Calendar,
    color: '#06b6d4',
    bg: 'from-cyan-500/10 to-sky-500/5',
    border: 'border-cyan-500/20',
    problem: "Calendly gère la réservation. Eventbrite les inscriptions. Google Calendar les créneaux. Mais aucun ne fonctionne comme secrétariat intelligent connecté à une école, une salle live et un moteur commercial.",
    audience: 'Coachs, consultants, thérapeutes, écoles, académies, organismes de formation, secrétariats',
    differentiator: 'LIRI Admin Booking Engine devient le système nerveux administratif de l\'organisation — pas un simple calendrier.',
    techCount: 13,
    techs: [
      { name: 'Smart Calendar™', desc: 'Gestion des créneaux, disponibilités et contraintes', icon: Calendar },
      { name: 'Booking System™', desc: 'Réservation en ligne avec confirmation automatique', icon: Clock },
      { name: 'Smart Secretariat™', desc: 'Assistant administratif IA : rappels, relances, orientation', icon: Users },
      { name: 'Auto Reminder System™', desc: 'Rappels automatiques multi-canal avant chaque session', icon: Mail },
      { name: 'Admin Dashboard™', desc: 'Vue globale : RDV, paiements, absences, inscriptions', icon: BarChart3 },
      { name: 'Teacher / Coach Management™', desc: 'Gestion multi-intervenants avec disponibilités et rôles', icon: Users },
    ],
  },
  {
    id: 'commerce-engine',
    name: 'Virtuel-Mbolo™',
    shortName: 'Commerce Engine',
    tagline: 'Le moteur boutique, paiement, logistique, comptabilité et tunnel de vente',
    promise: 'Ne créez pas seulement une boutique. Construisez une machine commerciale complète.',
    icon: ShoppingCart,
    color: '#f59e0b',
    bg: 'from-amber-500/10 to-yellow-500/5',
    border: 'border-amber-500/20',
    problem: "Shopify nécessite des dizaines d'apps pour les devis, paiements échelonnés, relances, logistique avancée, emballage intelligent et suivi de dettes.",
    audience: 'Boutiques en ligne, agences e-commerce, marques, revendeurs, entrepreneurs, vendeurs de formations',
    differentiator: 'Zahir combine boutique, paiement, devis, échéances, logistique, cartons, livraison, comptabilité et suivi client.',
    techCount: 24,
    techs: [
      { name: 'Store Engine™', desc: 'Boutique complète : produits, catégories, variantes, stocks', icon: ShoppingCart },
      { name: 'Payment Link Engine™', desc: 'Liens de paiement personnalisés avec acompte et échéances', icon: CreditCard },
      { name: 'Installment Payment Engine™', desc: 'Paiements échelonnés avec suivi de dettes et relances', icon: Receipt },
      { name: 'Smart Logistics™', desc: 'Moteur logistique intelligent : produits, cartons, transporteurs', icon: Truck },
      { name: 'Smart Packaging Engine™', desc: 'Choix automatique du meilleur emballage par commande', icon: Package },
      { name: 'Funnel Engine™', desc: 'Tunnel de vente : offre, checkout, upsell, confirmation', icon: Target },
      { name: 'Invoice & Accounting™', desc: 'Factures, revenus, dettes, taxes et marges automatisés', icon: FileText },
      { name: 'Subscription Engine™', desc: 'Abonnements mensuels/annuels pour revenus récurrents', icon: Tag },
    ],
  },
  {
    id: 'marketing-creator',
    name: 'LIRI Marketing Creator™',
    shortName: 'Marketing Creator',
    tagline: 'Le moteur IA de création publicitaire et campagnes multi-plateformes',
    promise: 'Transformez vos contenus et produits en campagnes qui attirent, convainquent et vendent.',
    icon: Megaphone,
    color: '#f97316',
    bg: 'from-orange-500/10 to-amber-500/5',
    border: 'border-orange-500/20',
    problem: "Canva crée un visuel mais pas une stratégie. Meta Ads diffuse mais ne crée pas. ChatGPT écrit mais ne relie pas produit, funnel, format et tracking.",
    audience: 'Agences, boutiques, formateurs, coachs, créateurs de contenu, community managers, marques',
    differentiator: 'LIRI Marketing Creator relie produit, contenu, offre, publicité, funnel, formats sociaux et suivi en un seul moteur.',
    techCount: 18,
    techs: [
      { name: 'Ad Creator AI™', desc: 'Génération de publicités multi-plateformes depuis un produit', icon: Wand2 },
      { name: 'Product-to-Ad Engine™', desc: 'Transforme une fiche produit en campagne publicitaire', icon: ShoppingCart },
      { name: 'Course-to-Ad Engine™', desc: 'Recycle un cours ou extrait en publicité engageante', icon: BookOpen },
      { name: 'Visual Campaign Engine™', desc: 'Génération de visuels : affiches, bannières, miniatures', icon: Palette },
      { name: 'Motion Ad Builder™', desc: 'Vidéos courtes TikTok, Reels, Shorts avec structure hook/CTA', icon: Play },
      { name: 'Copywriting AI™', desc: 'Textes de vente : titres, emails, landing pages, slogans', icon: PenTool },
      { name: 'Hook Generator™', desc: 'Accroches captivantes pour les premières secondes', icon: Sparkles },
      { name: 'Multi-Platform Pack™', desc: 'Pack complet pour toutes les plateformes en une fois', icon: Globe },
    ],
  },
];

const CATALOGUE_STORY = {
  eyebrow: 'Catalogue produit · Écosystème LIRI',
  title: '17 produits SaaS indépendants.',
  shimmer: '5 catégories stratégiques.',
  intro: "LIRI n'est pas né pour ajouter un outil de plus. LIRI est né pour réunir ce que les créateurs de savoir, les écoles, les studios, les coachs et les entrepreneurs faisaient jusque-là dans dix logiciels séparés.",
  narrative: [
    "Au départ, il y avait une fracture : Zoom pour parler, OBS pour produire, Canva pour designer, ChatGPT pour écrire, Notion pour organiser, Calendly pour réserver, Stripe pour encaisser, CapCut pour monter.",
    "Chaque outil faisait une partie du travail. Aucun ne portait l'ensemble de l'expérience : le live, l'intelligence, le studio, l'audio/vidéo, le business.",
    "L'écosystème LIRI transforme cette dispersion en infrastructure : des produits indépendants commercialement, mais reliés par le même cœur technique, la même mémoire IA et la même logique de production.",
  ],
};

const CATALOGUE_STATS = [
  { value: '17', label: 'produits SaaS' },
  { value: '5', label: 'catégories' },
  { value: '800k+', label: 'lignes de code' },
  { value: '80+', label: 'composants live' },
  { value: '11', label: 'studios' },
  { value: '3', label: 'agents IA' },
];

const STRATEGIC_CATEGORIES = [
  {
    name: 'Live',
    icon: Radio,
    color: '#ec4899',
    promise: 'Transformer une session en arène pédagogique, interactive et mémorisable.',
    products: ['LIRI Arena Live', 'DebateCore™', 'Mobile Live Mesh™', 'Secret Classroom Mode™'],
  },
  {
    name: 'IA',
    icon: Brain,
    color: '#a855f7',
    promise: 'Donner un cerveau aux contenus, aux parcours, aux lives et aux opérations.',
    products: ['LIRI Brain Trinity™', 'Course Copilot™', 'Formation LLM Builder™', 'Pipeline IA'],
  },
  {
    name: 'Studios',
    icon: Palette,
    color: '#8b5cf6',
    promise: 'Créer cours, documents, SmartBoards, lives et campagnes dans un même espace.',
    products: ['Creator Studio™', 'SmartBoard Designer™', 'Live Production Studio™', 'Document Coach Panel™'],
  },
  {
    name: 'Audio/Vidéo',
    icon: Clapperboard,
    color: '#06b6d4',
    promise: 'Transformer les replays, sons, exports et médias en actifs professionnels.',
    products: ['VideoPostProduction™', 'Sonic Flow™', 'StudioExportCenter™', 'Replay Intelligence™'],
  },
  {
    name: 'Business',
    icon: ShoppingCart,
    color: '#f59e0b',
    promise: 'Relier réservation, commerce, paiement, logistique, marketing et suivi client.',
    products: ['Admin Booking Engine™', 'Virtuel-Mbolo™', 'Marketing Creator™', 'Payment Link Engine™'],
  },
];

/* Entry points by persona */
const ENTRY_POINTS = [
  { persona: 'Coach', solution: 'LIRI Live Room Immersive™', icon: Mic },
  { persona: 'Créateur', solution: 'LIRI Creator Studio™', icon: Palette },
  { persona: 'École', solution: 'LIRI School Engine™', icon: GraduationCap },
  { persona: 'Consultant', solution: 'LIRI Admin Booking Engine™', icon: Calendar },
  { persona: 'Commerçant', solution: 'Virtuel-Mbolo™', icon: ShoppingCart },
  { persona: 'Agence', solution: 'LIRI Marketing Creator™', icon: Megaphone },
];

/* ═══ Animation variants ═══ */
const fadeUp = { hidden: { opacity: 0, y: 28 }, show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } } };
const stagger = (stag = 0.08) => ({ hidden: {}, show: { transition: { staggerChildren: stag } } });

/* ═══ Shimmer text ═══ */
const Shimmer = ({ children, from = '#c4b5fd', to = '#67e8f9' }) => (
  <span className="bg-clip-text text-transparent" style={{ backgroundImage: `linear-gradient(135deg, ${from}, ${to})` }}>
    {children}
  </span>
);

/* ═══ Animated line reveal ═══ */
const Line = ({ children, delay = 0 }) => (
  <motion.div initial={{ opacity: 0, y: 20, filter: 'blur(6px)' }} whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }} viewport={{ once: true, margin: '-5%' }} transition={{ duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] }}>
    {children}
  </motion.div>
);

/* ═══ Solution Overview Card ═══ */
const SolutionCard = ({ sol, index }) => {
  const Icon = sol.icon;
  // Virtuel-Mbolo redirige vers la page de vente dédiée
  const linkPath = sol.id === 'commerce-engine' 
    ? '/cimolace/solutions/virtuel-mbolo' 
    : `/cimolace/products/${sol.id}`;
  return (
    <Link
      to={linkPath}
      className="relative group text-left p-6 lg:p-7 rounded-2xl bg-gradient-to-br bg-white/[0.02] border border-white/[0.07] hover:border-opacity-50 transition-all duration-300 overflow-hidden block"
    >
      <motion.div
        variants={fadeUp}
        whileHover={{ y: -6 }}
        className="relative z-10"
      >
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" style={{ background: `radial-gradient(ellipse at top left, ${sol.color}12, transparent 65%)` }} />
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${sol.color}25, ${sol.color}45)` }}>
            <Icon className="w-5 h-5" style={{ color: sol.color }} />
          </div>
          <span className="text-[10px] tracking-[0.15em] uppercase font-bold px-2 py-0.5 rounded-full" style={{ color: sol.color, backgroundColor: `${sol.color}15` }}>
            {sol.techCount} technologies
          </span>
        </div>
        <h3 className="text-base lg:text-lg font-bold text-white mb-2">{sol.name}</h3>
        <p className="text-sm text-white/40 leading-relaxed mb-4">{sol.tagline}</p>
        <div className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: sol.color }}>
          Découvrir <ArrowRight className="w-3.5 h-3.5" />
        </div>
      </motion.div>
    </Link>
  );
};

/* ═══ Tech Card ═══ */
const TechCard = ({ tech, color, delay = 0 }) => {
  const Icon = tech.icon;
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -3, borderColor: `${color}30` }}
      className="p-4 rounded-xl bg-white/[0.025] border border-white/[0.07] hover:bg-white/[0.04] transition-all duration-300"
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center mt-0.5" style={{ background: `${color}15` }}>
          <Icon className="w-4 h-4" style={{ color }} />
        </div>
        <div className="min-w-0">
          <h4 className="text-sm font-bold text-white/90 mb-1">{tech.name}</h4>
          <p className="text-xs text-white/35 leading-relaxed">{tech.desc}</p>
        </div>
      </div>
    </motion.div>
  );
};

/* ═══ Solution Detail Section ═══ */
const SolutionSection = ({ sol, index }) => {
  const [expanded, setExpanded] = useState(false);
  const Icon = sol.icon;
  const isEven = index % 2 === 0;

  return (
    <section id={`sol-${sol.id}`} className="relative py-24 lg:py-32 px-6 lg:px-12">
      {/* Ambient glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute w-[600px] h-[600px] rounded-full blur-[160px] opacity-[0.04]" style={{ backgroundColor: sol.color, top: '20%', [isEven ? 'left' : 'right']: '-10%' }} />
      </div>

      <div className="relative max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-16">
          <Line>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${sol.color}20, ${sol.color}40)` }}>
                  <Icon className="w-6 h-6" style={{ color: sol.color }} />
                </div>
                <div>
                  <span className="text-[10px] tracking-[0.3em] uppercase block mb-0.5" style={{ color: `${sol.color}90` }}>Solution {index + 1}/6</span>
                  <h2 className="text-2xl lg:text-4xl font-black tracking-tight text-white">{sol.name}</h2>
                </div>
              </div>
              <Link
                to={`/cimolace/products/${sol.id}/story`}
                className="text-xs text-white/40 hover:text-white/80 transition-colors flex items-center gap-1.5"
              >
                Notre histoire <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </Line>
          <Line delay={0.1}>
            <p className="text-xl lg:text-2xl font-bold text-white/60 max-w-2xl leading-snug">
              « <span className="text-white/80">{sol.promise}</span> »
            </p>
          </Line>
        </div>

        {/* Content grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16">
          {/* Left — Description */}
          <div className="lg:col-span-4 space-y-8">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }}>
              <h3 className="text-xs tracking-[0.25em] uppercase text-red-400/60 mb-3">Problème marché</h3>
              <p className="text-sm text-white/45 leading-relaxed">{sol.problem}</p>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6, delay: 0.1 }}>
              <h3 className="text-xs tracking-[0.25em] uppercase mb-3" style={{ color: `${sol.color}80` }}>Différenciation</h3>
              <p className="text-sm text-white/50 leading-relaxed italic">"{sol.differentiator}"</p>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6, delay: 0.2 }}>
              <h3 className="text-xs tracking-[0.25em] uppercase text-white/20 mb-3">Public cible</h3>
              <p className="text-xs text-white/35 leading-relaxed">{sol.audience}</p>
            </motion.div>

            {sol.techCount > sol.techs.length && (
              <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.08] text-xs text-white/30">
                <Boxes className="w-3.5 h-3.5" />
                {sol.techCount} technologies au total
              </motion.div>
            )}
          </div>

          {/* Right — Technologies */}
          <div className="lg:col-span-8">
            <motion.h3
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-xs tracking-[0.25em] uppercase mb-6"
              style={{ color: `${sol.color}70` }}
            >
              Technologies embarquées
            </motion.h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {sol.techs.map((tech, i) => (
                <TechCard key={tech.name} tech={tech} color={sol.color} delay={i * 0.05} />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Separator */}
      <div className="max-w-7xl mx-auto mt-24">
        <div className="h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
      </div>
    </section>
  );
};


/* ═══════════════════════════════════════════════════════════════
   MAIN PAGE COMPONENT
═══════════════════════════════════════════════════════════════ */

export default function CimolaceSolutionsPage() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 100, damping: 30 });

  const scrollToSolution = (id) => {
    const el = document.getElementById(`sol-${id}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <>
      <Helmet>
        <title>Nos Solutions | CIMOLACE OS</title>
        <meta name="description" content="Découvrez les 6 solutions SaaS de CIMOLACE OS : Live, Studio, School, Admin, Commerce et Marketing. Une infrastructure intelligente pour créer, enseigner, vendre et scaler." />
        <meta name="theme-color" content="#0a0a0f" />
      </Helmet>

      <div className="bg-[#050507] text-white min-h-screen overflow-x-hidden">

        {/* Scroll progress bar */}
        <motion.div
          className="fixed top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-violet-500 to-cyan-400 z-[60] origin-left"
          style={{ scaleX }}
        />

        {/* ── Nav ── */}
        <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 lg:px-8 py-4 backdrop-blur-xl bg-[#050507]/80 border-b border-white/[0.04]">
          <Link to="/cimolace" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center">
              <Zap className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-sm font-black tracking-tight">CIMOLACE</span>
          </Link>
          <div className="hidden lg:flex items-center gap-1">
            {SOLUTIONS.map((sol) => (
              <button
                key={sol.id}
                onClick={() => scrollToSolution(sol.id)}
                className="px-3 py-1.5 text-[11px] text-white/40 hover:text-white/80 hover:bg-white/[0.05] rounded-lg transition-all"
              >
                {sol.shortName}
              </button>
            ))}
          </div>
          <Link to="/cimolace" className="text-xs text-white/40 hover:text-white/80 transition-colors">
            ← Retour
          </Link>
        </nav>

        {/* ══ HERO — CATALOGUE LIRI ══ */}
        <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
          <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")` }} />
          <motion.div animate={{ scale: [1, 1.15, 1], x: [0, 30, 0] }} transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }} className="absolute top-[15%] left-[10%] w-[500px] h-[500px] rounded-full bg-violet-600/10 blur-[120px] pointer-events-none" />
          <motion.div animate={{ scale: [1, 1.2, 1], x: [0, -25, 0] }} transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut', delay: 2 }} className="absolute bottom-[10%] right-[5%] w-[600px] h-[600px] rounded-full bg-cyan-600/8 blur-[140px] pointer-events-none" />

          <div className="relative z-10 max-w-[1100px] mx-auto px-8 pt-28 pb-20 text-center">
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/20 mb-10 text-xs text-violet-300 tracking-widest uppercase">
              <Sparkles className="w-3 h-3" />
              {CATALOGUE_STORY.eyebrow}
            </motion.div>

            <div className="mb-8">
              <Line delay={0.1}>
                <h1 className="text-[clamp(2.7rem,8vw,7rem)] font-black leading-[0.92] tracking-[-0.04em] text-white">
                  {CATALOGUE_STORY.title}
                </h1>
              </Line>
              <Line delay={0.22}>
                <h1 className="text-[clamp(2.7rem,8vw,7rem)] font-black leading-[0.92] tracking-[-0.04em]">
                  <Shimmer from="#7c3aed" to="#67e8f9">{CATALOGUE_STORY.shimmer}</Shimmer>
                </h1>
              </Line>
            </div>

            <motion.p initial={{ opacity: 0, y: 24, filter: 'blur(8px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} transition={{ duration: 0.9, delay: 0.6, ease: [0.16, 1, 0.3, 1] }} className="text-lg lg:text-xl text-white/50 max-w-[760px] mx-auto leading-relaxed mb-10">
              {CATALOGUE_STORY.intro}
            </motion.p>

            <motion.div
              variants={stagger(0.06)}
              initial="hidden"
              animate="show"
              className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-16"
            >
              {CATALOGUE_STATS.map((stat) => (
                <motion.div key={stat.label} variants={fadeUp} className="p-4 rounded-2xl bg-white/[0.035] border border-white/[0.08]">
                  <div className="text-2xl lg:text-3xl font-black text-white mb-1">{stat.value}</div>
                  <div className="text-[10px] uppercase tracking-[0.18em] text-white/30">{stat.label}</div>
                </motion.div>
              ))}
            </motion.div>

            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.4 }} className="flex flex-col items-center gap-3 text-white/25">
              <span className="text-[10px] tracking-[0.3em] uppercase">Défiler pour lire l'histoire</span>
              <motion.div animate={{ scaleY: [1, 1.5, 1], opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.5, repeat: Infinity }} className="w-px h-10 bg-gradient-to-b from-violet-400/60 to-transparent" />
            </motion.div>
          </div>
        </section>

        {/* ══ NOTRE HISTOIRE PRODUIT ══ */}
        <section className="py-32 px-6 lg:px-12 relative overflow-hidden">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full bg-violet-600/5 blur-[130px]" />
          </div>
          <div className="relative max-w-5xl mx-auto">
            <Line><span className="text-[10px] tracking-[0.35em] uppercase text-violet-400/70 mb-10 block">Notre histoire produit</span></Line>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
              <div className="lg:col-span-5">
                <Line delay={0.1}>
                  <h2 className="text-[clamp(2.4rem,6vw,5.2rem)] font-black leading-[0.95] tracking-[-0.04em] text-white">
                    Pas un outil de plus.
                    <br />
                    <Shimmer from="#a78bfa" to="#67e8f9">Une infrastructure.</Shimmer>
                  </h2>
                </Line>
              </div>
              <motion.div variants={stagger(0.1)} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-5%' }} className="lg:col-span-7 space-y-6">
                {CATALOGUE_STORY.narrative.map((paragraph) => (
                  <motion.p key={paragraph} variants={fadeUp} className="text-xl text-white/55 leading-relaxed font-light">
                    {paragraph}
                  </motion.p>
                ))}
              </motion.div>
            </div>
          </div>
        </section>

        {/* ══ CATÉGORIES STRATÉGIQUES ══ */}
        <section className="py-20 px-6 lg:px-12">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <Line><span className="text-[10px] tracking-[0.35em] uppercase text-violet-400/60 mb-4 block">Les 5 catégories stratégiques</span></Line>
              <Line delay={0.1}>
                <h2 className="text-3xl lg:text-5xl font-black tracking-tight text-white">
                  Live · IA · Studios · Audio/Vidéo ·{' '}
                  <Shimmer from="#a78bfa" to="#34d399">Business</Shimmer>
                </h2>
              </Line>
              <Line delay={0.2}>
                <p className="text-base text-white/35 mt-4 max-w-2xl mx-auto">
                  Le catalogue LIRI organise les 17 produits SaaS autour de cinq familles. Chaque famille peut vivre seule. Ensemble, elles forment l'OS complet.
                </p>
              </Line>
            </div>

            <motion.div
              variants={stagger(0.08)}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: '-5%' }}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4"
            >
              {STRATEGIC_CATEGORIES.map((category) => {
                const Icon = category.icon;
                return (
                  <motion.div key={category.name} variants={fadeUp} whileHover={{ y: -6, borderColor: `${category.color}45` }} className="p-6 rounded-3xl bg-white/[0.025] border border-white/[0.07] transition-all duration-300">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-6" style={{ background: `linear-gradient(135deg, ${category.color}20, ${category.color}40)` }}>
                      <Icon className="w-6 h-6" style={{ color: category.color }} />
                    </div>
                    <h3 className="text-xl font-black text-white mb-3">{category.name}</h3>
                    <p className="text-sm text-white/45 leading-relaxed mb-6">{category.promise}</p>
                    <div className="space-y-2">
                      {category.products.map((product) => (
                        <div key={product} className="flex items-center gap-2 text-[11px] text-white/35">
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: category.color }} />
                          {product}
                        </div>
                      ))}
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          </div>
        </section>

        {/* ══ SOLUTIONS OVERVIEW GRID ══ */}
        <section className="py-20 px-6 lg:px-12">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <Line><span className="text-[10px] tracking-[0.35em] uppercase text-cyan-400/60 mb-4 block">Les 6 portes d'entrée commerciales</span></Line>
              <Line delay={0.1}>
                <h2 className="text-3xl lg:text-5xl font-black tracking-tight text-white">
                  Six offres pour entrer dans{' '}
                  <Shimmer from="#67e8f9" to="#a78bfa">l'écosystème LIRI.</Shimmer>
                </h2>
              </Line>
              <Line delay={0.2}>
                <p className="text-base text-white/35 mt-4 max-w-2xl mx-auto">
                  Ces solutions sont les portes d'entrée lisibles pour le marché. Derrière chacune, plusieurs produits du catalogue LIRI travaillent ensemble.
                </p>
              </Line>
            </div>

            <motion.div
              variants={stagger(0.08)}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: '-5%' }}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
            >
              {SOLUTIONS.map((sol, i) => (
                <SolutionCard key={sol.id} sol={sol} index={i} />
              ))}
            </motion.div>
          </div>
        </section>

        {/* Divider */}
        <div className="max-w-5xl mx-auto px-8">
          <div className="h-px bg-gradient-to-r from-transparent via-violet-500/20 to-transparent" />
        </div>

        {/* ══ DETAILED SECTIONS ══ */}
        {SOLUTIONS.map((sol, i) => (
          <SolutionSection key={sol.id} sol={sol} index={i} />
        ))}

        {/* ══ ARCHITECTURE — How they connect ══ */}
        <section className="py-32 px-6 lg:px-12 relative overflow-hidden">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-gradient-radial from-violet-600/6 to-transparent blur-3xl" />
          </div>
          <div className="relative max-w-5xl mx-auto text-center">
            <Line><span className="text-[10px] tracking-[0.35em] uppercase text-cyan-400/60 mb-6 block">Architecture</span></Line>
            <Line delay={0.1}>
              <h2 className="text-3xl lg:text-5xl font-black tracking-tight text-white mb-4">
                Une architecture,{' '}
                <Shimmer from="#c4b5fd" to="#34d399">plusieurs produits.</Shimmer>
              </h2>
            </Line>
            <Line delay={0.2}>
              <p className="text-base text-white/35 max-w-2xl mx-auto mb-16">
                Chaque produit LIRI peut être vendu séparément, mais tous partagent la même base : live core, mémoire IA, studios de création, paiement, réservation, export et identité utilisateur.
              </p>
            </Line>

            {/* Entry points */}
            <motion.div
              variants={stagger(0.08)}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true }}
              className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-20"
            >
              {ENTRY_POINTS.map((ep) => {
                const Icon = ep.icon;
                return (
                  <motion.div
                    key={ep.persona}
                    variants={fadeUp}
                    whileHover={{ y: -4 }}
                    className="p-4 rounded-2xl bg-white/[0.025] border border-white/[0.07] text-center cursor-default"
                  >
                    <Icon className="w-6 h-6 mx-auto mb-3 text-violet-400/70" />
                    <p className="text-sm font-bold text-white mb-1">{ep.persona}</p>
                    <p className="text-[10px] text-white/30 leading-snug">{ep.solution}</p>
                  </motion.div>
                );
              })}
            </motion.div>

            {/* Flow visualization */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="relative p-8 lg:p-12 rounded-3xl bg-white/[0.02] border border-white/[0.06]"
            >
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 lg:gap-6">
                {SOLUTIONS.map((sol, i) => {
                  const Icon = sol.icon;
                  return (
                    <motion.div
                      key={sol.id}
                      initial={{ opacity: 0, scale: 0.9 }}
                      whileInView={{ opacity: 1, scale: 1 }}
                      viewport={{ once: true }}
                      transition={{ delay: i * 0.08 }}
                      whileHover={{ scale: 1.04 }}
                      className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]"
                    >
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${sol.color}20` }}>
                        <Icon className="w-4 h-4" style={{ color: sol.color }} />
                      </div>
                      <div className="text-left min-w-0">
                        <p className="text-xs font-bold text-white truncate">{sol.shortName}</p>
                        <p className="text-[10px] text-white/30 truncate">{sol.techCount} technologies</p>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
              <div className="mt-8 pt-6 border-t border-white/[0.06] text-center">
                <p className="text-sm text-white/20 font-mono">
                  <span className="text-violet-400">$</span> liri.catalogue<span className="text-cyan-400">.connect</span>(<span className="text-amber-400">17_products</span>) →{' '}
                  <span className="text-emerald-400">écosystème unifié</span>
                </p>
              </div>
            </motion.div>
          </div>
        </section>

        {/* ══ TEAM SHOWCASE ══ */}
        <section className="relative py-20 overflow-hidden border-t border-white/[0.05]">
          <div className="max-w-[1100px] mx-auto px-6">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="text-center mb-12"
            >
              <span className="text-[10px] tracking-[0.35em] uppercase text-violet-400/60 mb-4 block">Atelier produit</span>
              <h2 className="text-3xl md:text-4xl font-black text-white mb-4">
                Ceux qui assemblent <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-cyan-400">l'écosystème LIRI</span>
              </h2>
              <p className="text-white/40 max-w-lg mx-auto">
                Le catalogue n'est pas une liste figée : c'est un atelier vivant où les modules live, IA, studio, audio/vidéo et business deviennent des offres commercialisables.
              </p>
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: 0.2 }}
            >
              <TeamShowcase />
            </motion.div>
          </div>
        </section>

        {/* ══ CTA ══ */}
        <section className="relative py-40 overflow-hidden">
          <motion.div animate={{ rotate: [0, 360] }} transition={{ duration: 30, repeat: Infinity, ease: 'linear' }} className="absolute inset-0 pointer-events-none" style={{ background: 'conic-gradient(from 0deg at 50% 50%, #7c3aed08, #06b6d408, #7c3aed08)' }} />
          <motion.div animate={{ scale: [1, 1.3, 1] }} transition={{ duration: 8, repeat: Infinity }} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-gradient-radial from-violet-600/12 to-transparent blur-3xl pointer-events-none" />

          <div className="relative z-10 max-w-[900px] mx-auto px-8 text-center">
            <Line><span className="text-[10px] tracking-[0.35em] uppercase text-violet-400/60 mb-10 block">Choisir votre porte d'entrée</span></Line>
            <div className="mb-8">
              <Line delay={0.1}>
                <h2 className="text-[clamp(2rem,7vw,5rem)] font-black leading-[0.92] tracking-[-0.03em] text-white">
                  Un catalogue complet.
                </h2>
              </Line>
              <Line delay={0.22}>
                <h2 className="text-[clamp(2rem,7vw,5rem)] font-black leading-[0.92] tracking-[-0.03em]">
                  <Shimmer from="#a78bfa" to="#34d399">Une offre à composer.</Shimmer>
                </h2>
              </Line>
            </div>
            <motion.p initial={{ opacity: 0, y: 20, filter: 'blur(6px)' }} whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }} viewport={{ once: true }} transition={{ delay: 0.4, duration: 0.8 }} className="text-lg text-white/40 max-w-md mx-auto mb-14 leading-relaxed">
              Partez d'une porte d'entrée commerciale, puis composez votre stack avec les produits du catalogue LIRI.
            </motion.p>
            <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.6 }} className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/cimolace/configurateur"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-r from-violet-500 to-cyan-500 text-white font-bold text-sm rounded-xl hover:shadow-lg hover:shadow-violet-500/25 transition-all"
              >
                Composer mon offre <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/cimolace/about"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white/[0.06] border border-white/[0.1] text-white font-bold text-sm rounded-xl hover:bg-white/[0.1] transition-colors"
              >
                Lire l'histoire LIRI
              </Link>
            </motion.div>
          </div>
        </section>

        {/* ── Footer ── */}
        <div className="border-t border-white/[0.05] py-6 px-8 flex items-center justify-between max-w-[1100px] mx-auto">
          <span className="text-[11px] text-white/20">{cimolacePlatformConfig.copyrightMicro}</span>
          <Link to={cimolacePlatformConfig.routes.home} className="text-[11px] text-violet-400/60 hover:text-violet-400 transition-colors">{cimolacePlatformConfig.marketingSiteDisplay} ↗</Link>
        </div>

      </div>
    </>
  );
}
