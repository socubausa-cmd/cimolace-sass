/* eslint-disable */
// ─── SOLUTION STORY PAGE — Using same shell as CimolaceAboutPage ─────────────
import React, { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import {
  motion,
  useScroll,
  useInView,
  useSpring,
  useMotionValue,
  animate,
} from 'framer-motion';
import { ArrowRight, ArrowUpRight, Zap, Sparkles, Video, Palette, GraduationCap, Calendar, ShoppingCart, Megaphone } from 'lucide-react';
import { cimolacePlatformConfig } from '@/tenants/cimolace/cimolacePlatform.config';

/* ════════════════════════════════════════════
   SOLUTION DATA — Stories for each solution
════════════════════════════════════════════ */

const SOLUTION_STORIES = {
  live: {
    name: 'LIRI Live Room Immersive™',
    shortName: 'Live Room',
    icon: Video,
    color: '#ec4899',
    heroGradient: 'from-pink-500/10 to-rose-500/5',
    marqueeItems: ['LIVE', 'IMMERSIF', 'PÉDAGOGIQUE', 'TEMPS RÉEL', 'SCÉNOGRAPHIE', 'MÉMOIRE'],
    heroTitle: 'Tout a commencé',
    heroSubtitle: 'par une salle vide.',
    heroText: 'Pas celle d\'un ingénieur vidéo. Celle d\'un formateur africain qui voulait enseigner à distance — et se heurtait à un mur à chaque tentative.',
    problem: {
      title: 'Le constat',
      heading: 'Zoom connecte.',
      subheading: 'Mais n\'enseigne pas.',
      text: 'Les outils de visioconférence sont parfaits pour parler. Mais pour enseigner ? Pour scénariser ? Pour créer une expérience ? Ils ne sont pas conçus pour ça.',
      cards: [
        { emoji: '🎬', title: 'Production', text: 'Pour une classe, il faut OBS, un logiciel de présentation, un chat, un sondage...' },
        { emoji: '📚', title: 'Pédagogie', text: 'Aucun outil ne relie live, replay, mémoire et progression.' },
        { emoji: '🌍', title: 'Langues', text: 'Les sous-titres et la traduction sont absents ou payants.' },
        { emoji: '💾', title: 'Replay', text: 'Enregistrer existe, mais réviser intelligemment ? Non.' },
      ],
    },
    vision: {
      title: 'La vision',
      heading: 'Une salle live',
      subheading: 'pensée pour l\'enseignement.',
      quote: '"J\'ai réalisé que le problème n\'était pas la technologie vidéo — c\'était l\'absence d\'une salle pensée pour pédagogie, pas pour réunion."',
      author: '— NGOWAZULU · Fondateur CIMOLACE',
    },
    timeline: [
      { year: '2020', title: "L'étincelle", text: "NGOWAZULU identifie le gouffre entre l'enseignement à distance et les outils disponibles.", accent: '#ec4899', side: 'left' },
      { year: '2021', title: 'Le prototype', text: "Première salle live avec SmartBoard intégré. L'enseignement devient visuel.", accent: '#ec4899', side: 'right' },
      { year: '2022', title: "L'intelligence entre", text: "NeuroRecall™ intégré. La salle devient une salle de mémoire, pas juste de diffusion.", accent: '#ec4899', side: 'left' },
      { year: '2023', title: 'Débats et scénographie', text: "DebateCore™ et Phase Engine™. La salle devient une arène pédagogique.", accent: '#ec4899', side: 'right' },
      { year: '2024', title: 'L\'écosystème live', text: "LIRI Live Room Immersive™ connecte live, replay, mémoire et certification.", accent: '#ec4899', side: 'left' },
    ],
    values: [
      { title: 'Pédagogie avant tout', text: 'Chaque fonctionnalité est pensée pour l\'enseignement, pas pour la réunion.' },
      { title: 'Scénographie intégrée', text: 'La salle ne connecte pas — elle orchestre.' },
      { title: 'Mémoire active', text: 'Ce qui se passe dans la salle doit être retenu et réutilisé.' },
    ],
    techs: [
      { name: 'LiveKit Mesh Core™', desc: 'Moteur vidéo/audio temps réel WebRTC, faible latence' },
      { name: 'SmartBoard Live Layer™', desc: 'Tableau interactif synchronisé pendant le live' },
      { name: 'DebateCore™ + AI Judge™', desc: 'Débat structuré avec IA arbitre, rounds et scoring' },
      { name: 'NeuroRecall™', desc: 'Mémorisation post-live : flashcards, résumés, progression' },
      { name: 'Secret Classroom Mode™', desc: 'Audio/vidéo privé sans quitter la salle principale' },
      { name: 'LIRI Multilang Live™', desc: 'Sous-titres et traduction multilingue en temps réel' },
      { name: 'Phase Engine™', desc: 'Cycle de vie organisé : loading, setup, waiting, live, ended' },
      { name: 'Sonic Flow™', desc: 'Ambiances audio scéniques avec ducking micro automatique' },
    ],
  },
  studio: {
    name: 'LIRI Creator Studio™',
    shortName: 'Creator Studio',
    icon: Palette,
    color: '#8b5cf6',
    heroGradient: 'from-violet-500/10 to-purple-500/5',
    marqueeItems: ['CRÉATION', 'STUDIO', 'SMARTBOARD', 'VIDÉO', 'IA', 'EXPORT'],
    heroTitle: 'Tout a commencé',
    heroSubtitle: 'par trop d\'outils.',
    heroText: 'Pas celle d\'un designer. Celle d\'un créateur africain qui jonglait entre Canva, PowerPoint, Premiere, Notion et Mailchimp — et perdait 80% de son temps à passer d\'un outil à l\'autre.',
    problem: {
      title: 'Le constat',
      heading: 'Canva crée.',
      subheading: 'Mais ne relie rien.',
      text: 'Les créateurs disposent d\'excellents outils isolés. Mais aucun ne relie création visuelle, pédagogie, live et export.',
      cards: [
        { emoji: '🎨', title: 'Design', text: 'Canva, Figma — visuels magnifiques, mais pas de pédagogie.' },
        { emoji: '📹', title: 'Vidéo', text: 'CapCut, Premiere — montage puissant, mais pas de structure de cours.' },
        { emoji: '📝', title: 'Contenu', text: 'Notion, Google Docs — organisation, mais pas de live ni de SmartBoard.' },
        { emoji: '🤖', title: 'IA', text: 'ChatGPT, Claude — textes brillants, mais pas de production visuelle.' },
      ],
    },
    vision: {
      title: 'La vision',
      heading: 'Un studio',
      subheading: 'qui relie tout.',
      quote: '"J\'ai réalisé que le problème n\'était pas le manque d\'outils — c\'était l\'absence d\'un environnement qui relie création, pédagogie et production."',
      author: '— NGOWAZULU · Fondateur CIMOLACE',
    },
    timeline: [
      { year: '2020', title: "L'étincelle", text: "NGOWAZULU identifie le chaos créatif des créateurs africains.", accent: '#8b5cf6', side: 'left' },
      { year: '2021', title: 'Le SmartBoard', text: "Konva Canvas Engine™. Le tableau blanc devient interactif et synchronisable.", accent: '#8b5cf6', side: 'right' },
      { year: '2022', title: "L'IA entre", text: "Course Copilot™ et DocumentCoachPanel™. L\'IA assiste la création.", accent: '#8b5cf6', side: 'left' },
      { year: '2023', title: 'Le studio complet', text: "Formation Builder™ et VideoPostProduction™. Tout dans un seul environnement.", accent: '#8b5cf6', side: 'right' },
      { year: '2024', title: 'L\'écosystème créatif', text: "LIRI Creator Studio™ relie création, pédagogie, live et export.", accent: '#8b5cf6', side: 'left' },
    ],
    values: [
      { title: 'Création connectée', text: 'Ce que vous créez dans le studio devient un live, un cours, une vidéo.' },
      { title: 'IA comme assistant', text: 'L\'IA propose, structure, enrichit — vous validez.' },
      { title: 'Export universel', text: 'Un contenu, mille formats : vidéo, PDF, SRT, TXT, PNG, ZIP.' },
    ],
    techs: [
      { name: 'SmartBoard Designer™', desc: 'Éditeur visuel de tableaux et slides interactifs' },
      { name: 'Course Copilot™', desc: 'Assistant IA qui propose scènes et structures pédagogiques' },
      { name: 'Formation Builder™', desc: 'Construction de formations avec modules, leçons et exercices' },
      { name: 'VideoPostProduction™', desc: 'Montage vidéo intégré : timeline, découpe, export' },
      { name: 'DocumentCoachPanel™', desc: 'Coach IA qui restructure et enrichit vos documents' },
      { name: 'Live Production Studio™', desc: 'Blueprint de live avec scènes, contenus et permissions' },
      { name: 'Debate Builder™', desc: 'Préparation de débats : sujet, camps, rounds, règles' },
      { name: 'StudioExportCenter™', desc: 'Export centralisé : vidéo, PDF, SRT, TXT, PNG, ZIP' },
    ],
  },
  school: {
    name: 'LIRI School Engine™',
    shortName: 'School Engine',
    icon: GraduationCap,
    color: '#10b981',
    heroGradient: 'from-emerald-500/10 to-green-500/5',
    marqueeItems: ['ÉCOLE', 'INTELLIGENTE', 'CERTIFICATION', 'IA', 'PIPELINE', 'QUALITÉ'],
    heroTitle: 'Tout a commencé',
    heroSubtitle: 'par une formation vide.',
    heroText: 'Pas celle d\'un pédagogue. Celle d\'un enseignant africain qui vendait des vidéos sur Kajabi — mais ses élèves n\'apprenaient pas vraiment, car il n\'y avait ni pédagogie structurée ni qualité vérifiée.',
    problem: {
      title: 'Le constat',
      heading: 'Kajabi héberge.',
      subheading: 'Mais ne construit pas.',
      text: 'Les plateformes permettent de vendre des formations. Mais elles ne construisent pas une pédagogie, ne pilotent pas d\'agents IA et ne vérifient pas la qualité.',
      cards: [
        { emoji: '💰', title: 'Vente', text: 'Kajabi, Teachable — ventes facilitées, mais pédagogie absente.' },
        { emoji: '🧠', title: 'Pédagogie', text: 'Aucun pipeline IA pour transformer un contenu en cours complet.' },
        { emoji: '✅', title: 'Qualité', text: 'Pas de vérification automatique de la qualité chapitre par chapitre.' },
        { emoji: '🎓', title: 'Certification', text: 'Les certificats sont délivrés, mais pas basés sur une progression réelle.' },
      ],
    },
    vision: {
      title: 'La vision',
      heading: 'Une école',
      subheading: 'qui construit.',
      quote: '"J\'ai réalisé que le problème n\'était pas le manque de contenu — c\'était l\'absence d\'un système qui construit une pédagogie intelligente et certifiante."',
      author: '— NGOWAZULU · Fondateur CIMOLACE',
    },
    timeline: [
      { year: '2020', title: "L'étincelle", text: "NGOWAZULU identifie le vide pédagogique des formations en ligne.", accent: '#10b981', side: 'left' },
      { year: '2021', title: 'Le pipeline', text: `${cimolacePlatformConfig.schoolPipelineProductName}. Première orchestration de production pédagogique.`, accent: '#10b981', side: 'right' },
      { year: '2022', title: "L'IA pédagogique", text: "Formation LLM Builder™. L\'IA transforme un brief en structure.", accent: '#10b981', side: 'left' },
      { year: '2023', title: 'La qualité', text: "Quality Check Pédagogique™. Vérification automatique de chaque chapitre.", accent: '#10b981', side: 'right' },
      { year: '2024', title: 'L\'écosystème éducatif', text: "LIRI School Engine™ relie pédagogie, IA, certification et progression.", accent: '#10b981', side: 'left' },
    ],
    values: [
      { title: 'Pédagogie structurée', text: 'Chaque cours suit un pipeline pédagogique éprouvé.' },
      { title: 'IA comme architecte', text: 'L\'IA construit, vous validez et personnalisez.' },
      { title: 'Qualité vérifiée', text: 'Chaque chapitre est vérifié avant publication.' },
    ],
    techs: [
      { name: 'Formation LLM Builder™', desc: 'IA qui transforme un brief en structure de formation' },
      { name: 'LIRI Masterclass Coach™', desc: 'Création de masterclass avec pipeline pédagogique 13 étapes' },
      { name: 'LIRI Brain Trinity™', desc: 'IA multi-agents : Coach, Architecte et Live Assistant' },
      { name: 'Certification Engine™', desc: 'Délivrance de certificats après parcours validé' },
      { name: cimolacePlatformConfig.schoolPipelineProductName, desc: 'Orchestration de la production pédagogique IA' },
      { name: 'Quality Check Pédagogique™', desc: 'Vérification automatique de chaque chapitre' },
      { name: 'Automatic Test Generator™', desc: 'Génération de QCM, quiz et exercices depuis le contenu' },
      { name: 'MasterScript™', desc: 'Script maître structurant le cours ou le live' },
    ],
  },
  admin: {
    name: 'LIRI Admin Booking Engine™',
    shortName: 'Admin Booking',
    icon: Calendar,
    color: '#06b6d4',
    heroGradient: 'from-cyan-500/10 to-sky-500/5',
    marqueeItems: ['ADMIN', 'BOOKING', 'CALENDRIER', 'SECRÉTARIAT', 'RÉMINDERS', 'ORGANISATION'],
    heroTitle: 'Tout a commencé',
    heroSubtitle: 'par un secrétariat en retard.',
    heroText: 'Pas celle d\'un consultant. Celle d\'un coach africain qui passait ses soirées à gérer ses rendez-vous manuellement — et qui oubliait toujours des rappels, ce qui lui coûtait des clients.',
    problem: {
      title: 'Le constat',
      heading: 'Calendly planifie.',
      subheading: 'Mais n\'organise pas.',
      text: 'Les outils de calendrier permettent de prendre rendez-vous. Mais aucun ne fonctionne comme secrétariat intelligent connecté à une école, une salle live et un moteur commercial.',
      cards: [
        { emoji: '📅', title: 'Calendrier', text: 'Calendly, Google Calendar — réservation facile, mais pas d\'organisation.' },
        { emoji: '📧', title: 'Rappels', text: 'Pas de système intelligent de rappels multi-canal.' },
        { emoji: '👥', title: 'Profils', text: 'Aucune centralisation des historiques et progressions clients.' },
        { emoji: '🔗', title: 'Intégration', text: 'Pas de lien avec les salles live ni les paiements.' },
      ],
    },
    vision: {
      title: 'La vision',
      heading: 'Un secrétariat',
      subheading: 'qui organise.',
      quote: '"J\'ai réalisé que le problème n\'était pas le manque de temps — c\'était l\'absence d\'un système qui organise vraiment l\'activité."',
      author: '— NGOWAZULU · Fondateur CIMOLACE',
    },
    timeline: [
      { year: '2020', title: "L'étincelle", text: "NGOWAZULU identifie le chaos administratif des coachs africains.", accent: '#06b6d4', side: 'left' },
      { year: '2021', title: 'Le calendrier', text: "Smart Calendar™. Gestion des créneaux et disponibilités.", accent: '#06b6d4', side: 'right' },
      { year: '2022', title: 'Le secrétariat IA', text: "Smart Secretariat™. L\'IA gère rappels et relances.", accent: '#06b6d4', side: 'left' },
      { year: '2023', title: 'L\'intégration', text: "Live Admission Link™. Administration connectée aux salles live.", accent: '#06b6d4', side: 'right' },
      { year: '2024', title: 'L\'écosystème administratif', text: "LIRI Admin Booking Engine™ relie organisation, live et commercial.", accent: '#06b6d4', side: 'left' },
    ],
    values: [
      { title: 'Organisation intelligente', text: 'Le secrétariat IA gère ce qui est répétitif.' },
      { title: 'Rappels automatiques', text: 'Plus jamais de rendez-vous manqués.' },
      { title: 'Intégration complète', text: 'Administration connectée aux salles live et paiements.' },
    ],
    techs: [
      { name: 'Smart Calendar™', desc: 'Gestion des créneaux, disponibilités et contraintes' },
      { name: 'Booking System™', desc: 'Réservation en ligne avec confirmation automatique' },
      { name: 'Smart Secretariat™', desc: 'Assistant administratif IA : rappels, relances, orientation' },
      { name: 'Auto Reminder System™', desc: 'Rappels automatiques multi-canal avant chaque session' },
      { name: 'Admin Dashboard™', desc: 'Vue globale : RDV, paiements, absences, inscriptions' },
      { name: 'Teacher / Coach Management™', desc: 'Gestion multi-intervenants avec disponibilités et rôles' },
      { name: 'Room & Slot Management™', desc: 'Gère salles, créneaux, capacités et liens' },
      { name: 'Live Admission Link™', desc: 'Relie administration à salle live' },
    ],
  },
  commerce: {
    name: 'Virtuel-Mbolo™',
    shortName: 'Commerce Engine',
    icon: ShoppingCart,
    color: '#f59e0b',
    heroGradient: 'from-amber-500/10 to-yellow-500/5',
    marqueeItems: ['COMMERCE', 'PAIEMENT', 'LOGISTIQUE', 'ÉCHÉANCES', 'FACTURATION', 'ABONNEMENTS'],
    heroTitle: 'Tout a commencé',
    heroSubtitle: 'par une commande perdue.',
    heroText: 'Pas celle d\'un e-commerçant. Celle d\'un vendeur africain qui perdait des clients parce que Shopify nécessitait 20 apps pour faire ce que son business africain avait besoin : échéances, logistique avancée, suivi de dettes.',
    problem: {
      title: 'Le constat',
      heading: 'Shopify vend.',
      subheading: 'Mais ne logistique pas.',
      text: 'Les plateformes e-commerce nécessitent des dizaines d\'apps pour les devis, échéances, logistique avancée et suivi de dettes.',
      cards: [
        { emoji: '💳', title: 'Paiement', text: 'Shopify, Stripe — ventes facilitées, mais pas d\'échéances.' },
        { emoji: '📦', title: 'Logistique', text: 'Pas de système intelligent d\'emballage et de transporteurs.' },
        { emoji: '🧾', title: 'Facturation', text: 'Aucun système de devis automatiques ni de suivi de dettes.' },
        { emoji: '🔄', title: 'Abonnements', text: 'Pas de gestion d\'abonnements pour revenus récurrents.' },
      ],
    },
    vision: {
      title: 'La vision',
      heading: 'Un moteur',
      subheading: 'qui complète.',
      quote: '"J\'ai réalisé que le problème n\'était pas le manque de ventes — c\'était l\'absence d\'un système qui gère tout : vente, paiement, logistique et comptabilité."',
      author: '— NGOWAZULU · Fondateur CIMOLACE',
    },
    timeline: [
      { year: '2020', title: "L'étincelle", text: "NGOWAZULU identifie le chaos commercial des vendeurs africains.", accent: '#f59e0b', side: 'left' },
      { year: '2021', title: 'Le paiement', text: "Payment Link Engine™. Liens de paiement personnalisés.", accent: '#f59e0b', side: 'right' },
      { year: '2022', title: 'Les échéances', text: "Installment Payment Engine™. Paiements échelonnés avec suivi.", accent: '#f59e0b', side: 'left' },
      { year: '2023', title: 'La logistique', text: "Smart Logistics™. Moteur d\'emballage et transporteurs.", accent: '#f59e0b', side: 'right' },
      { year: '2024', title: 'L\'écosystème commercial', text: "Virtuel-Mbolo™ relie vente, paiement, logistique et comptabilité.", accent: '#f59e0b', side: 'left' },
    ],
    values: [
      { title: 'Tout en un', text: 'Boutique, paiement, logistique, comptabilité — un seul système.' },
      { title: 'Échéances intelligentes', text: 'Gestion automatique des paiements échelonnés et dettes.' },
      { title: 'Logistique africaine', text: 'Adapté aux réalités logistiques du continent.' },
    ],
    techs: [
      { name: 'Store Engine™', desc: 'Boutique complète : produits, catégories, variantes, stocks' },
      { name: 'Payment Link Engine™', desc: 'Liens de paiement personnalisés avec acompte et échéances' },
      { name: 'Installment Payment Engine™', desc: 'Paiements échelonnés avec suivi de dettes et relances' },
      { name: 'Smart Logistics™', desc: 'Moteur logistique intelligent : produits, cartons, transporteurs' },
      { name: 'Smart Packaging Engine™', desc: 'Choix automatique du meilleur emballage par commande' },
      { name: 'Invoice Engine™', desc: 'Factures, revenus, dettes, taxes et marges automatisés' },
      { name: 'Subscription Engine™', desc: 'Abonnements mensuels/annuels pour revenus récurrents' },
      { name: 'Funnel Engine™', desc: 'Tunnel de vente : offre, checkout, upsell, confirmation' },
    ],
  },
  marketing: {
    name: 'LIRI Marketing Creator™',
    shortName: 'Marketing Creator',
    icon: Megaphone,
    color: '#f97316',
    heroGradient: 'from-orange-500/10 to-amber-500/5',
    marqueeItems: ['MARKETING', 'PUBLICITÉ', 'IA', 'VISUELS', 'COPYWRITING', 'MULTI-PLATFORM'],
    heroTitle: 'Tout a commencé',
    heroSubtitle: 'par une campagne invisible.',
    heroText: 'Pas celle d\'un marketer. Celle d\'un entrepreneur africain qui créait du contenu mais ne savait pas comment en faire des campagnes publicitaires qui vendent — Canva ne faisait pas de stratégie, ChatGPT ne connaissait pas son produit.',
    problem: {
      title: 'Le constat',
      heading: 'Canva crée.',
      subheading: 'Mais ne stratégise pas.',
      text: 'Les outils de marketing créent des visuels ou du texte, mais aucun ne relie produit, contenu, offre, publicité, funnel et tracking.',
      cards: [
        { emoji: '🎨', title: 'Design', text: 'Canva, Figma — visuels magnifiques, mais pas de stratégie.' },
        { emoji: '📝', title: 'Copy', text: 'ChatGPT, Claude — textes brillants, mais pas de funnel.' },
        { emoji: '📱', title: 'Formats', text: 'Aucun système pour adapter le contenu à chaque plateforme.' },
        { emoji: '🎯', title: 'Tracking', text: 'Pas de liens traçables pour mesurer source ventes.' },
      ],
    },
    vision: {
      title: 'La vision',
      heading: 'Un moteur',
      subheading: 'qui connecte.',
      quote: '"J\'ai réalisé que le problème n\'était pas le manque de créativité — c\'était l\'absence d\'un système qui relie produit, contenu et publicité."',
      author: '— NGOWAZULU · Fondateur CIMOLACE',
    },
    timeline: [
      { year: '2020', title: "L'étincelle", text: "NGOWAZULU identifie le chaos marketing des créateurs africains.", accent: '#f97316', side: 'left' },
      { year: '2021', title: 'Le visuel', text: "Visual Campaign Engine™. Génération de visuels publicitaires.", accent: '#f97316', side: 'right' },
      { year: '2022', title: 'Le copywriting', text: "Copywriting AI™. Génération de textes de vente.", accent: '#f97316', side: 'left' },
      { year: '2023', title: 'Le funnel', text: "Funnel Content Generator™. Production de contenus de tunnel.", accent: '#f97316', side: 'right' },
      { year: '2024', title: 'L\'écosystème marketing', text: "LIRI Marketing Creator™ relie produit, contenu, offre et publicité.", accent: '#f97316', side: 'left' },
    ],
    values: [
      { title: 'Produit comme source', text: 'Transformez une fiche produit en campagne complète.' },
      { title: 'Multi-plateforme', text: 'Un contenu, mille formats et plateformes.' },
      { title: 'Tracking intégré', text: 'Liens traçables pour mesurer source ventes.' },
    ],
    techs: [
      { name: 'Ad Creator AI™', desc: 'Génération de publicités multi-plateformes depuis un produit' },
      { name: 'Product-to-Ad Engine™', desc: 'Transforme une fiche produit en campagne publicitaire' },
      { name: 'Course-to-Ad Engine™', desc: 'Recycle un cours ou extrait en publicité engageante' },
      { name: 'Visual Campaign Engine™', desc: 'Génération de visuels : affiches, bannières, miniatures' },
      { name: 'Motion Ad Builder™', desc: 'Vidéos courtes TikTok, Reels, Shorts avec structure hook/CTA' },
      { name: 'Copywriting AI™', desc: 'Textes de vente : titres, emails, landing pages, slogans' },
      { name: 'Hook Generator™', desc: 'Accroches captivantes pour les premières secondes' },
      { name: 'Multi-Platform Pack™', desc: 'Pack complet pour toutes les plateformes en une fois' },
    ],
  },
};

/* ════════════════════════════════════════════
   ANIMATION PRIMITIVES (from CimolaceAboutPage)
════════════════════════════════════════════ */

const Line = ({ children, delay = 0, className = '' }) => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-6%' });
  return (
    <div ref={ref} className={`overflow-hidden ${className}`}>
      <motion.div
        initial={{ y: '110%', opacity: 0 }}
        animate={inView ? { y: '0%', opacity: 1 } : {}}
        transition={{ duration: 0.72, delay, ease: [0.16, 1, 0.3, 1] }}
      >
        {children}
      </motion.div>
    </div>
  );
};

const stagger = (staggerTime = 0.07, delayChildren = 0) => ({
  hidden: {},
  show: { transition: { staggerChildren: staggerTime, delayChildren } },
});

const fadeUp = {
  hidden: { opacity: 0, y: 32, filter: 'blur(6px)' },
  show: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.65, ease: [0.16, 1, 0.3, 1] } },
};

const SplitText = ({ text, className = '', delay = 0, as: Tag = 'span' }) => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-4%' });
  return (
    <Tag ref={ref} className={className} style={{ perspective: 1000 }}>
      {text.split('').map((ch, i) =>
        ch === ' ' ? (
          <span key={i}>&nbsp;</span>
        ) : (
          <span key={i} className="inline-block overflow-hidden align-bottom">
            <motion.span
              className="inline-block"
              initial={{ y: '110%', rotateX: -40, opacity: 0 }}
              animate={inView ? { y: '0%', rotateX: 0, opacity: 1 } : {}}
              transition={{ duration: 0.5, delay: delay + i * 0.022, ease: [0.16, 1, 0.3, 1] }}
            >
              {ch}
            </motion.span>
          </span>
        )
      )}
    </Tag>
  );
};

const Marquee = ({ items, speed = 40 }) => {
  const doubled = [...items, ...items];
  return (
    <div className="overflow-hidden py-5 border-y border-white/[0.06]">
      <motion.div
        className="flex gap-12 whitespace-nowrap"
        animate={{ x: [0, -50 * items.length * 4] }}
        transition={{ duration: speed, repeat: Infinity, ease: 'linear' }}
      >
        {doubled.map((item, i) => (
          <span key={i} className="text-sm uppercase tracking-[0.2em] text-white/20 flex-shrink-0 flex items-center gap-4">
            <span className="w-1 h-1 rounded-full bg-violet-500/60 inline-block" />
            {item}
          </span>
        ))}
      </motion.div>
    </div>
  );
};

const Shimmer = ({ children, from = '#a78bfa', to = '#22d3ee', className = '' }) => (
  <motion.span
    className={`bg-clip-text text-transparent ${className}`}
    style={{ backgroundImage: `linear-gradient(90deg, ${from} 0%, ${to} 50%, ${from} 100%)`, backgroundSize: '200% 100%' }}
    animate={{ backgroundPosition: ['0% 50%', '200% 50%'] }}
    transition={{ duration: 5, repeat: Infinity, ease: 'linear' }}
  >
    {children}
  </motion.span>
);

const GlowCard = ({ children, className = '', accent = '#8b5cf6', delay = 0 }) => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-4%' });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 28, scale: 0.97 }}
      animate={inView ? { opacity: 1, y: 0, scale: 1 } : {}}
      transition={{ duration: 0.65, delay, ease: [0.16, 1, 0.3, 1] }}
      className={`relative rounded-2xl overflow-hidden ${className}`}
    >
      <motion.div
        className="absolute inset-0 rounded-2xl pointer-events-none z-0"
        animate={{ rotate: [0, 360] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
      >
        <div
          className="absolute inset-0 rounded-2xl opacity-40"
          style={{ background: `conic-gradient(from 0deg, transparent 0deg, ${accent}80 60deg, transparent 120deg)` }}
        />
      </motion.div>
      <div className="relative z-10 h-full">{children}</div>
    </motion.div>
  );
};

/* ════════════════════════════════════════════
   MAIN PAGE COMPONENT
════════════════════════════════════════════ */

export default function CimolaceSolutionStoryPage() {
  const { solutionId } = useParams();
  const story = SOLUTION_STORIES[solutionId];
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 100, damping: 30 });
  const Icon = story?.icon || Zap;

  if (!story) {
    return (
      <div className="min-h-screen bg-[#050507] text-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Solution non trouvée</h1>
          <Link to="/cimolace/products" className="text-violet-400 hover:text-violet-300">
            Retour aux solutions
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>{story.name} | CIMOLACE OS</title>
        <meta name="description" content={story.heroText} />
        <meta name="theme-color" content="#0a0a0f" />
      </Helmet>

      <div className="bg-[#050507] text-white overflow-x-hidden">

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
          <div className="flex items-center gap-2">
            <Link
              to="/cimolace/products"
              className="text-xs text-white/40 hover:text-white/80 transition-colors"
            >
              ← Retour aux solutions
            </Link>
          </div>
        </nav>

        {/* ══ SECTION 1 — HERO ══ */}
        <section id="hero" className="relative min-h-screen flex items-center justify-center overflow-hidden">
          <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3Cfilter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")` }} />
          <motion.div animate={{ scale: [1, 1.15, 1], x: [0, 30, 0] }} transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }} className="absolute top-[15%] left-[10%] w-[500px] h-[500px] rounded-full blur-[120px] pointer-events-none" style={{ backgroundColor: `${story.color}10` }} />
          <motion.div animate={{ scale: [1, 1.2, 1], x: [0, -25, 0] }} transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut', delay: 2 }} className="absolute bottom-[10%] right-[5%] w-[600px] h-[600px] rounded-full blur-[140px] pointer-events-none" style={{ backgroundColor: `${story.color}08` }} />

          <div className="relative z-10 max-w-[1100px] mx-auto px-8 pt-28 pb-20 text-center">
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.06] border border-white/[0.1] mb-12 text-xs text-white/60 tracking-widest uppercase">
              <Sparkles className="w-3 h-3" style={{ color: story.color }} />
              {story.shortName}
            </motion.div>
            <div className="mb-8">
              <Line delay={0.1}><h1 className="text-[clamp(3rem,10vw,8.5rem)] font-black leading-[0.9] tracking-[-0.03em] text-white">{story.heroTitle}</h1></Line>
              <Line delay={0.22}><h1 className="text-[clamp(3rem,10vw,8.5rem)] font-black leading-[0.9] tracking-[-0.03em]"><Shimmer from={story.color} to="#67e8f9" className="font-black">{story.heroSubtitle}</Shimmer></h1></Line>
            </div>
            <motion.p initial={{ opacity: 0, y: 24, filter: 'blur(8px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} transition={{ duration: 0.9, delay: 0.6, ease: [0.16, 1, 0.3, 1] }} className="text-lg lg:text-xl text-white/50 max-w-[560px] mx-auto leading-relaxed mb-16">
              {story.heroText}
            </motion.p>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.4 }} className="flex flex-col items-center gap-3 text-white/25">
              <span className="text-[10px] tracking-[0.3em] uppercase">Défiler</span>
              <motion.div animate={{ scaleY: [1, 1.5, 1], opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.5, repeat: Infinity }} className="w-px h-10 bg-gradient-to-b from-violet-400/60 to-transparent" />
            </motion.div>
          </div>
        </section>

        <Marquee items={story.marqueeItems} speed={50} />

        {/* ══ SECTION 2 — PROBLÈME ══ */}
        <section id="probleme" className="relative py-32 px-8 max-w-[1100px] mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="flex flex-col justify-center lg:pr-8">
              <Line delay={0}><span className="text-[10px] tracking-[0.35em] uppercase text-red-400/60 mb-5 block">{story.problem.title}</span></Line>
              <div className="mb-6">
                <Line delay={0.1}><p className="text-[clamp(2rem,5vw,3.5rem)] font-black leading-[1.05] tracking-[-0.02em] text-white">{story.problem.heading}</p></Line>
                <Line delay={0.22}><p className="text-[clamp(2rem,5vw,3.5rem)] font-black leading-[1.05] tracking-[-0.02em]" style={{ color: `${story.color}70` }}>{story.problem.subheading}</p></Line>
              </div>
              <motion.p initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.4, duration: 0.7, ease: [0.16, 1, 0.3, 1] }} className="text-base text-white/45 leading-relaxed">
                {story.problem.text}
              </motion.p>
            </div>
            <motion.div variants={stagger(0.08, 0.1)} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-5%' }} className="grid grid-cols-2 gap-3">
              {story.problem.cards.map((item, i) => (
                <motion.div key={i} variants={fadeUp} whileHover={{ y: -4, borderColor: `${story.color}30` }} className="p-5 rounded-2xl bg-white/[0.025] border border-white/[0.07] cursor-default transition-colors duration-300">
                  <span className="text-2xl block mb-3">{item.emoji}</span>
                  <h4 className="text-sm font-bold text-white mb-1.5">{item.title}</h4>
                  <p className="text-xs text-white/35 leading-relaxed">{item.text}</p>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        <Marquee items={story.marqueeItems} speed={35} />

        {/* ══ SECTION 3 — VISION ══ */}
        <section id="vision" className="relative py-40 overflow-hidden">
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            {[900, 650, 420].map((size, i) => (
              <motion.div key={i} animate={{ rotate: i % 2 === 0 ? 360 : -360 }} transition={{ duration: 30 + i * 15, repeat: Infinity, ease: 'linear' }} className="absolute rounded-full border border-white/[0.04]" style={{ width: size, height: size }} />
            ))}
            <div className="absolute w-96 h-96 rounded-full bg-gradient-radial from-violet-500/8 to-transparent blur-2xl" />
          </div>
          <div className="relative z-10 max-w-[900px] mx-auto px-8 text-center">
            <Line delay={0}><span className="text-[10px] tracking-[0.35em] uppercase text-violet-400/60 mb-10 block">{story.vision.title}</span></Line>
            <div className="mb-10">
              <Line delay={0.1}><h2 className="text-[clamp(2.5rem,7vw,6rem)] font-black leading-[0.92] tracking-[-0.03em] text-white">{story.vision.heading}</h2></Line>
              <Line delay={0.2}><h2 className="text-[clamp(2.5rem,7vw,6rem)] font-black leading-[0.92] tracking-[-0.03em] text-white">{story.vision.subheading}</h2></Line>
            </div>
            <motion.div initial={{ scaleX: 0 }} whileInView={{ scaleX: 1 }} viewport={{ once: true }} transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }} className="h-px w-20 bg-gradient-to-r from-violet-500 to-cyan-400 mx-auto mb-10 origin-left" />
            <GlowCard accent={story.color} delay={0.3} className="mt-16 text-left">
              <div className="p-6 rounded-2xl bg-[#0d0d14] border border-white/[0.07]">
                <div className="flex items-center gap-2 mb-5">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/70" />
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500/70" />
                  <span className="text-[10px] text-white/20 ml-2 font-mono">founder.log</span>
                </div>
                <p className="text-sm text-white/60 font-mono leading-relaxed">
                  <span className="text-violet-400">$</span>{' '}
                  <span className="text-white/80 italic">{story.vision.quote}</span>
                </p>
                <p className="mt-4 text-[11px] text-violet-400/70 font-mono">{story.vision.author}</p>
              </div>
            </GlowCard>
          </div>
        </section>

        {/* ══ SECTION 4 — TIMELINE ══ */}
        <section id="timeline" className="py-32 px-8 max-w-[1100px] mx-auto">
          <div className="text-center mb-20">
            <Line delay={0}><span className="text-[10px] tracking-[0.35em] uppercase text-cyan-400/60 mb-4 block">La construction</span></Line>
            <Line delay={0.1}>
              <SplitText text={`Histoire de ${story.shortName}.`} as="h2" delay={0.05} className="text-[clamp(2rem,5vw,4rem)] font-black tracking-[-0.03em] text-white block" />
            </Line>
          </div>
          <div className="relative">
            <div className="absolute left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-violet-500/20 via-cyan-500/10 to-transparent hidden lg:block" />
            <div className="space-y-8">
              {story.timeline.map((item, i) => (
                <motion.div key={i} initial={{ opacity: 0, x: item.side === 'left' ? -32 : 32 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true, margin: '-5%' }} transition={{ duration: 0.65, delay: 0.05, ease: [0.16, 1, 0.3, 1] }} className={`flex items-start gap-8 lg:w-[46%] ${item.side === 'right' ? 'lg:ml-auto lg:flex-row-reverse' : ''}`}>
                  <div className="flex-shrink-0 w-3 h-3 rounded-full mt-5 ring-4 ring-[#050507] hidden lg:block" style={{ backgroundColor: item.accent, boxShadow: `0 0 16px ${item.accent}80` }} />
                  <motion.div whileHover={{ scale: 1.02, y: -2 }} transition={{ duration: 0.25 }} className={`flex-1 p-6 rounded-2xl bg-white/[0.025] border border-white/[0.07] hover:border-white/[0.14] transition-colors ${item.side === 'right' ? 'lg:text-right' : ''}`}>
                    <span className="text-[10px] tracking-[0.3em] uppercase mb-2 block" style={{ color: item.accent }}>{item.year}</span>
                    <h3 className="text-base font-bold text-white mb-2">{item.title}</h3>
                    <p className="text-sm text-white/40 leading-relaxed">{item.text}</p>
                  </motion.div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ══ SECTION 5 — VALEURS ══ */}
        <section id="valeurs" className="py-32 px-8 max-w-[1100px] mx-auto">
          <div className="text-center mb-16">
            <Line delay={0}><span className="text-[10px] tracking-[0.35em] uppercase text-violet-400/60 mb-4 block">Ce qui guide {story.shortName}</span></Line>
            <Line delay={0.1}>
              <SplitText text="Nos valeurs." as="h2" delay={0.04} className="text-[clamp(2rem,5vw,4rem)] font-black tracking-[-0.03em] text-white block" />
            </Line>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {story.values.map((item, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 32 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.65, delay: i * 0.1, ease: [0.16, 1, 0.3, 1] }} whileHover={{ y: -4, borderColor: `${story.color}30` }} className="p-6 rounded-2xl bg-white/[0.025] border border-white/[0.07] transition-colors duration-300">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4" style={{ background: `${story.color}15` }}>
                  <Icon className="w-6 h-6" style={{ color: story.color }} />
                </div>
                <h3 className="text-base font-bold text-white mb-2">{item.title}</h3>
                <p className="text-sm text-white/40 leading-relaxed">{item.text}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* ══ SECTION 6 — TECHNOLOGIES ══ */}
        <section id="technologies" className="py-32 px-8 max-w-[1100px] mx-auto">
          <div className="text-center mb-16">
            <Line delay={0}><span className="text-[10px] tracking-[0.35em] uppercase mb-4 block" style={{ color: `${story.color}80` }}>Technologies embarquées</span></Line>
            <Line delay={0.1}>
              <SplitText text="Moteurs intelligents." as="h2" delay={0.04} className="text-[clamp(2rem,5vw,4rem)] font-black tracking-[-0.03em] text-white block" />
            </Line>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {story.techs.map((tech, i) => (
              <motion.div key={tech.name} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: i * 0.03, ease: [0.16, 1, 0.3, 1] }} whileHover={{ y: -3, borderColor: `${story.color}30` }} className="p-4 rounded-xl bg-white/[0.025] border border-white/[0.07] hover:bg-white/[0.04] transition-all duration-300">
                <h4 className="text-sm font-bold text-white/90 mb-1">{tech.name}</h4>
                <p className="text-xs text-white/35 leading-relaxed">{tech.desc}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* ══ CTA ══ */}
        <section className="py-32 px-8 relative overflow-hidden">
          <motion.div animate={{ rotate: [0, 360] }} transition={{ duration: 30, repeat: Infinity, ease: 'linear' }} className="absolute inset-0 pointer-events-none" style={{ background: 'conic-gradient(from 0deg at 50% 50%, #7c3aed08, #06b6d408, #7c3aed08)' }} />
          <motion.div animate={{ scale: [1, 1.3, 1] }} transition={{ duration: 8, repeat: Infinity }} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-gradient-radial from-violet-600/12 to-transparent blur-3xl pointer-events-none" />

          <div className="relative z-10 max-w-[900px] mx-auto text-center">
            <Line delay={0}><span className="text-[10px] tracking-[0.35em] uppercase text-violet-400/60 mb-10 block">Prêt à commencer ?</span></Line>
            <div className="mb-8">
              <Line delay={0.1}>
                <h2 className="text-[clamp(2rem,7vw,5rem)] font-black leading-[0.92] tracking-[-0.03em] text-white">
                  Configurez votre offre
                </h2>
              </Line>
            </div>
            <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.4 }} className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/cimolace/configurateur"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-r from-violet-500 to-cyan-500 text-white font-bold text-sm rounded-xl hover:shadow-lg hover:shadow-violet-500/25 transition-all"
              >
                Configurer <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/cimolace/products"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white/[0.06] border border-white/[0.1] text-white font-bold text-sm rounded-xl hover:bg-white/[0.1] transition-colors"
              >
                Voir toutes les solutions
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
