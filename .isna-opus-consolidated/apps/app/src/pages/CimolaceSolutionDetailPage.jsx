/* eslint-disable */
// ─── FULL REWRITE — Apple-style Product Narrative ───────────────────────────────────────
import React, { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { Helmet } from 'react-helmet';
import {
  motion,
  useScroll,
  useTransform,
  useInView,
  useSpring,
  useMotionValue,
  animate,
} from 'framer-motion';
import { Link } from 'react-router-dom';
import { cimolacePlatformConfig } from '@/tenants/cimolace/cimolacePlatform.config';
import { ArrowRight, ArrowUpRight, Zap, Globe, Cpu, Users, Heart, Rocket, Star, Sparkles, Video, Palette, GraduationCap, Calendar, ShoppingCart, Megaphone, Radio, Monitor, Settings, Clock, Shield, Lock, Hand, MessageSquare, Eye, Share2, PenTool, Layers, FileText, Layout, Menu, Circle, Download, Upload, Languages, Folder, Brain, CheckCircle2, RefreshCw, Award, Bot, Store, Package, CreditCard, Link as LinkIcon, Receipt, BarChart3, Percent, Truck, Box, Calculator, Map, Tag, Terminal, Grid2x2, Clapperboard, Calculator as CalculatorIcon, Mail, Bell, AlertCircle, User, ArrowRight as ArrowRightIcon, Percent as PercentIcon, Target, Headphones, Mic, Smartphone } from 'lucide-react';

/* ════════════════════════════════════════════
   ANIMATION PRIMITIVES
════════════════════════════════════════════ */

/* Line-reveal: overflow hidden + slide-up (Framer style) */
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

/* Stagger container variants */
const stagger = (staggerTime = 0.07, delayChildren = 0) => ({
  hidden: {},
  show: { transition: { staggerChildren: staggerTime, delayChildren } },
});
const fadeUp = {
  hidden: { opacity: 0, y: 32, filter: 'blur(6px)' },
  show: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.65, ease: [0.16, 1, 0.3, 1] } },
};

/* Char-by-char 3D reveal */
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

/* CountUp number animation */
const CountUp = ({ to, suffix = '', duration = 2 }) => {
  const ref = useRef(null);
  const mv = useMotionValue(0);
  const inView = useInView(ref, { once: true });
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!inView) return;
    const c = animate(mv, to, { duration, ease: 'easeOut', onUpdate: v => setVal(Math.round(v)) });
    return c.stop;
  }, [inView]);
  return <span ref={ref}>{val.toLocaleString('fr-FR')}{suffix}</span>;
};

/* Horizontal marquee ticker */
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

/* Shimmer gradient text */
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

/* Animated gradient-border card */
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

/* ═══════════════════════════════════════════════════════════════
   DATA — 6 solutions CIMOLACE OS
═══════════════════════════════════════════════════════════════ */

const SOLUTIONS = [
  {
    id: 'live-room',
    name: 'LIRI Live Room Immersive™',
    shortName: 'Live Room',
    tagline: 'Le moment où le live est devenu une expérience.',
    promise: 'Ne faites plus des réunions. Créez des expériences live intelligentes.',
    icon: Video,
    color: '#ec4899',
    story: "Pendant des années, le live a été une contradiction. On avait la technologie pour parler à des centaines de personnes… mais pas pour les captiver. On avait Zoom pour communiquer. OBS pour produire. Miro pour dessiner. WhatsApp pour relancer. Mais rien pour enseigner réellement. Alors on a posé une question simple : Et si une salle live pouvait penser comme un professeur, fonctionner comme un studio, et réagir comme un assistant ? C'est comme ça qu'est née LIRI Live Room Immersive™.",
    revolution: "Ce n'est pas une visioconférence. C'est une arène pédagogique intelligente. Une salle qui guide le déroulé, organise la parole, structure le débat, mémorise le contenu, traduit en temps réel et accompagne chaque participant.",
    whatChanges: "Tu ne fais plus un live. Tu diriges une expérience. Tu accueilles les participants dans une salle d'attente immersive. Tu contrôles qui parle, quand, et comment. Tu expliques avec un SmartBoard vivant. Tu fais débattre avec un système structuré. Tu peux isoler un élève en privé sans casser le flow. Tu termines avec un replay intelligent + mémoire automatique.",
    problemSolved: "❌ Zoom = réunion\n❌ OBS = compliqué\n❌ Slack = désorganisé\n\nAucun outil ne permet de diriger une salle pédagogique vivante.\n\n✅ LIRI = contrôle + interaction + pédagogie + mémoire",
    cta: "Arrête de faire des réunions. Crée des expériences qui marquent.",
    audience: 'Écoles en ligne, formateurs, coachs, conférenciers, communautés privées, organisations spirituelles, académies.',
    features: [
      { title: 'Salle d\'attente immersive', desc: 'Vos participants arrivent dans un espace d\'accueil personnalisé avec musique, visuels de marque et compte à rebours avant le début. Plus de participants qui arrivent en retard ou dans le désordre.', icon: 'Clock' },
      { title: 'Contrôle total des participants', desc: 'Définissez précisément qui peut parler, activer sa caméra, partager son écran ou utiliser le chat. Mutez, expulsez ou promouvez n\'importe qui en un clic.', icon: 'Shield' },
      { title: 'Mains levées intelligentes', desc: 'Les participants lèvent la main virtuellement, vous voyez une file d\'attente ordonnée. L\'IA peut même suggérer qui appeler en priorité selon l\'historique des interactions.', icon: 'Hand' },
      { title: 'SmartBoard en temps réel', desc: 'Dessinez, écrivez, ajoutez des formes et des images sur un tableau blanc collaboratif visible par tous. Les annotations restent synchronisées même avec 500 participants.', icon: 'PenTool' },
      { title: 'Mode classe privée', desc: 'Isolez instantanément un élève en audio/vidéo privé sans quitter la salle principale. Parfait pour les entretiens individuels ou le soutien ciblé.', icon: 'Eye' },
      { title: 'Débats structurés avec IA', desc: 'Organisez des débats par phases avec chronomètre, tours de parole automatiques et notation IA des arguments. Vos débats deviennent des compétitions engageantes.', icon: 'MessageSquare' },
      { title: 'File de questions intelligente', desc: 'Les participants posent des questions, l\'IA les regroupe par similarité, élimine les doublons et vous présente les plus pertinentes. Fini le chaos du chat.', icon: 'Brain' },
      { title: 'Traduction live multilingue', desc: 'Sous-titres automatiques en 20+ langues en temps réel. Vos formations deviennent accessibles internationalement sans surcoût de traduction.', icon: 'Languages' },
      { title: 'Mémorisation automatique', desc: 'Après chaque session, l\'IA génère automatiquement des flashcards, résumés et quiz basés sur le contenu enseigné. Vos élèves retiennent 3x plus.', icon: 'Sparkles' },
      { title: 'Enregistrement studio', desc: 'Capture multi-piste de l\'audio et de la vidéo de chaque participant. Exportez en HD pour replay, montage ou archives pédagogiques.', icon: 'Video' },
    ],
    technologies: [
      { name: 'LiveKit Mesh Core™', desc: 'Infrastructure WebRTC propriétaire avec latence <50ms et scaling automatique jusqu\'à 1000 participants simultanés', icon: 'Radio' },
      { name: 'Phase Engine™', desc: 'Orchestrateur de session gérant 7 phases distinctes avec transitions automatisées et rappels contextuels', icon: 'Settings' },
      { name: 'SmartBoard Live Layer™', desc: 'Canvas vectoriel temps réel avec synchronisation optimisée via patches de différences', icon: 'Monitor' },
      { name: 'DebateCore™ + AI Judge™', desc: 'Moteur de règles débats + modèle NLP d\'évaluation argumentative avec scoring multi-critères', icon: 'Brain' },
      { name: 'NeuroRecall™', desc: 'Pipeline IA de génération pédagogique post-session (flashcards, résumés, quiz) via GPT-4 fine-tuned', icon: 'Sparkles' },
      { name: 'LIRI Multilang Live™', desc: 'Transcription temps réel Whisper + traduction simultanée DeepL API avec latence <2s', icon: 'Languages' },
      { name: 'Sonic Flow™', desc: 'Chaîne audio professionnelle avec ducking intelligent, suppression de bruit et spatialisation', icon: 'Headphones' },
      { name: 'LIRI Mobile Live Mesh™', desc: 'Adaptation responsive optimisée tactile avec gestes personnalisés et faible consommation batterie', icon: 'Smartphone' },
    ],
  },
  {
    id: 'creator-studio',
    name: 'LIRI Creator Studio™',
    shortName: 'Creator Studio',
    tagline: 'Le jour où créer un cours est devenu aussi puissant que monter un film.',
    promise: 'Créez des cours, des masterclass, des débats, des événements et des documents avec un studio tout-en-un.',
    icon: Palette,
    color: '#8b5cf6',
    story: "Créer un contenu aujourd'hui, c'est un puzzle. Canva pour les visuels. Notion pour les idées. CapCut pour la vidéo. ChatGPT pour écrire. OBS pour le live. Trop d'outils. Trop de perte. Trop de friction. Alors on a décidé de tout réunir.",
    revolution: "Un seul espace. Pour penser, créer, structurer, produire et exporter. Comme un DaVinci Resolve… mais pour le savoir.",
    whatChanges: "Tu passes d'une idée → à une formation complète. Tu crées ton SmartBoard sans quitter l'outil. Tu génères ton script automatiquement. Tu montes ta vidéo dans le même environnement. Tu exportes tout en un clic.",
    problemSolved: "❌ 10 outils différents\n❌ perte de temps\n❌ incohérence\n\n✅ 1 studio unifié → productivité maximale",
    cta: "Arrête de bricoler. Travaille comme un studio professionnel.",
    audience: 'Créateurs de contenu, formateurs, agences, écoles, entrepreneurs.',
    features: [
      { title: 'Interface studio professionnel', desc: 'Un environnement de travail type DaVinci Resolve avec panneaux modulaires, raccourcis clavier avancés et workflows optimisés. Vous vous sentez immédiatement en contrôle.', icon: 'Layout' },
      { title: 'SmartBoard Designer visuel', desc: 'Créez des présentations interactives par glisser-déposer. Formes, textes, images, vidéos et animations sans code. Exportez en PDF, HTML ou intégrez directement dans un live.', icon: 'PenTool' },
      { title: 'Assistant IA Course Copilot', desc: 'Décrivez votre sujet, l\'IA génère la structure complète de votre cours, les titres des sections, les points clés et même les questions d\'évaluation.', icon: 'Sparkles' },
      { title: 'Formation Builder structuré', desc: 'Organisez votre contenu en modules, leçons et chapitres avec une vue d\'ensemble claire. Définissez les prérequis, les objectifs et la progression pédagogique.', icon: 'GraduationCap' },
      { title: 'Préparation Live complète', desc: 'Planifiez vos sessions live avec blueprints, scripts, supports visuels et checklists. Plus de stress avant de going live.', icon: 'Clapperboard' },
      { title: 'Téléprompteur intégré', desc: 'Vos scripts défilent automatiquement avec vitesse ajustable et surbrillance de la ligne actuelle. Vous gardez le contact visuel avec votre audience.', icon: 'FileText' },
      { title: 'Montage vidéo intégré', desc: 'Coupez, assemblez, ajoutez des transitions et de la musique sans quitter l\'outil. Exportez directement vers votre espace de stockage ou YouTube.', icon: 'Video' },
      { title: 'Multilingue automatique', desc: 'Traduisez tout votre contenu (slides, scripts, quiz) en 20+ langues en un clic. Votre formation devient internationale instantanément.', icon: 'Languages' },
      { title: 'Bibliothèque de templates', desc: 'Accédez à des centaines de templates professionnels pour slides, formations, emails, scripts. Gagnez des heures de création graphique.', icon: 'Folder' },
      { title: 'Export multi-format', desc: 'Exportez vos créations en PDF, PowerPoint, SCORM, vidéo MP4, ou publiez directement sur votre espace membre. Un clic, c\'est prêt.', icon: 'Download' },
    ],
    technologies: [
      { name: 'ProShell™ + ProPanel™', desc: 'Architecture IDE modulaire avec système de docking, drag-drop de panneaux et persistance des layouts utilisateur', icon: 'Layout' },
      { name: 'SmartBoard Designer™', desc: 'Moteur Canvas 2D vectoriel Konva.js avec rendu GPU-accéléré et synchronisation temps réel des modifications', icon: 'PenTool' },
      { name: 'Course Copilot™', desc: 'Agent IA GPT-4 spécialisé pédagogie avec fine-tuning sur structures de cours et méthodologies d\'apprentissage', icon: 'Sparkles' },
      { name: 'Formation LLM Builder™', desc: 'Pipeline NLP de structuration automatique brief → outline → contenu avec validation pédagogique', icon: 'Brain' },
      { name: 'Live Production Studio™', desc: 'Système de blueprinting live avec templates de scénarios, timers et orchestration multi-sources', icon: 'Clapperboard' },
      { name: 'VideoPostProduction™', desc: 'Moteur de montage timeline avec codecs H.264/H.265, transitions GPU et export multi-résolution', icon: 'Video' },
      { name: 'StudioLiriMultilang™', desc: 'Pipeline de localisation avec GPT-4 + vérification contextuelle et adaptation culturelle automatique', icon: 'Languages' },
      { name: 'StudioExportCenter™', desc: 'Moteur de conversion multi-format avec presets SCORM, Tin Can API, PDF vectoriel et MP4 H.265', icon: 'Download' },
    ],
  },
  {
    id: 'school-engine',
    name: 'LIRI School Engine™',
    shortName: 'School Engine',
    tagline: 'Transformer un savoir en école.',
    promise: 'Construisez des écoles complètes avec parcours, certifications et intelligence artificielle.',
    icon: GraduationCap,
    color: '#10b981',
    story: "Aujourd'hui, tout le monde vend des formations. Mais très peu créent des écoles. Une école, ce n'est pas des vidéos. C'est une progression, une pédagogie, une mémoire, une transformation.",
    revolution: "Une IA qui construit ton école avec toi.",
    whatChanges: "Tu pars d'une idée → tu obtiens un parcours complet. Tu crées des modules structurés automatiquement. Tu génères tests, scripts, supports. Tu suis la progression des élèves. Tu délivres des certifications.",
    problemSolved: "❌ formations désorganisées\n❌ contenus faibles\n❌ pas de progression\n\n✅ école structurée + intelligente",
    cta: "Ne vends pas une formation. Construis une école.",
    audience: 'Écoles, académies, coachs, experts, institutions.',
    features: [
      { title: 'Création IA de parcours complets', desc: 'Partez d\'une simple idée, l\'IA génère une école complète avec modules, chapitres, objectifs pédagogiques et évaluations. Votre expertise transformée en curriculum structuré.', icon: 'Brain' },
      { title: 'Pipeline pédagogique 13 étapes', desc: 'Chaque cours passe par 13 contrôles qualité automatiques : objectifs, storytelling, interactions, évaluations, certification. Vous livrez des formations irréprochables.', icon: 'CheckCircle2' },
      { title: 'Parcours scolaires personnalisés', desc: 'Créez des parcours adaptatifs où chaque élève progresse à son rythme. Prérequis automatiques, déblocages conditionnels et suivi granularisé.', icon: 'GraduationCap' },
      { title: 'Masterclass Coach intégré', desc: 'Un coach IA spécialisé dans la création de masterclasses vous guide étape par étape. De l\'accroche finale à l\'appel à l\'action.', icon: 'Sparkles' },
      { title: 'Génération automatique de tests', desc: 'L\'IA crée des quiz, QCM et évaluations pratiques basés sur votre contenu. Corrigés automatiques avec feedback personnalisé pour chaque élève.', icon: 'FileText' },
      { title: 'Certifications intelligentes', desc: 'Délivrez des certifications automatiques selon des règles personnalisées. Suivi des compétences acquises et badges de progression.', icon: 'Award' },
      { title: 'Trinité IA pédagogique', desc: 'Trois agents IA spécialisés : le Coach vous conseille, l\'Architecte structure, l\'Assistant répond aux questions. Un accompagnement 24/7.', icon: 'Bot' },
      { title: 'Tableau de bord temps réel', desc: 'Visualisez la progression de tous vos élèves en temps réel. Identifiez ceux en difficulté et intervenez au bon moment.', icon: 'BarChart3' },
      { title: 'Notes élèves auto-générées', desc: 'Chaque élève reçoit automatiquement des notes de cours personnalisées basées sur sa progression et ses points faibles.', icon: 'FileText' },
      { title: 'Planification Gantt live', desc: 'Planifiez votre production pédagogique avec un diagramme de Gantt interactif. Dépendances, jalons et alertes de retard.', icon: 'Clock' },
    ],
    technologies: [
      { name: 'Formation LLM Builder™', desc: 'Pipeline GPT-4 de génération curriculum avec validation Bloom et taxonomie ABET', icon: 'Brain' },
      { name: 'Pipeline 13 étapes™', desc: 'Workflow qualité pédagogique avec checkpoints automatiques et scoring multi-critères', icon: 'Layers' },
      { name: 'SchoolPath™ Engine', desc: 'Moteur de graphe de dépendances pédagogiques avec parcours adaptatifs et algorithmes de recommendation', icon: 'GraduationCap' },
      { name: 'LIRI Brain Trinity™', desc: 'Multi-agent system avec 3 LLMs spécialisés : Coach (fine-tuned mentoring), Architecte (pédagogie), Assistant (support)', icon: 'Bot' },
      { name: 'AutoTest Generator™', desc: 'Générateur d\'évaluations par GPT-4 avec analyse de cohérence pédagogique et calibration de difficulté', icon: 'FileText' },
      { name: 'Certification Engine™', desc: 'Système de règles conditionnelles avec blockchain de vérification et génération NFT badges', icon: 'Award' },
      { name: cimolacePlatformConfig.schoolPipelineProductName, desc: 'Orchestrateur de production avec DAG (Directed Acyclic Graph) et exécution parallélisée', icon: 'Settings' },
      { name: 'Analytics Temps Réel™', desc: 'Pipeline Kafka + ClickHouse pour tracking progression avec dashboards temps réel', icon: 'BarChart3' },
    ],
  },
  {
    id: 'admin-booking',
    name: 'LIRI Admin Booking Engine™',
    shortName: 'Admin Booking',
    tagline: 'Le secrétariat qui travaille pendant que tu enseignes.',
    promise: 'Ne créez pas juste un calendrier. Créez un secrétariat intelligent.',
    icon: Calendar,
    color: '#06b6d4',
    story: "Organiser une activité, c'est souvent : messages WhatsApp, oublis, rendez-vous ratés, confusion.",
    revolution: "Un système qui organise tout automatiquement.",
    whatChanges: "Tes créneaux sont intelligents. Tes clients réservent seuls. Les rappels sont automatiques. Les absences sont relancées. Tu as une vue globale.",
    problemSolved: "❌ désorganisation\n❌ perte de temps\n❌ rendez-vous ratés\n\n✅ système fluide + autonome",
    cta: "Arrête de gérer. Laisse le système organiser pour toi.",
    audience: 'Coachs, consultants, écoles, centres, indépendants.',
    features: [
      { title: 'Réservation en libre-service', desc: 'Vos clients réservent eux-mêmes selon vos disponibilités réelles. Pas d\'échange d\'emails interminables. Le calendrier se met à jour automatiquement.', icon: 'Calendar' },
      { title: 'Paiement Mobile Money', desc: 'Vos clients paient leurs réservations par MTN ou Orange Money. Paiement instantané, confirmation automatique, 0 friction pour vos clients africains.', icon: 'Smartphone' },
      { title: 'Créneaux intelligents', desc: 'Le système calcule vos vraies disponibilités en fonction de vos contraintes, buffers entre rendez-vous et fuseaux horaires des clients.', icon: 'Clock' },
      { name: 'Rappels automatiques', desc: 'Emails, SMS et notifications push automatiques avant chaque rendez-vous. Taux de présence augmenté de 40%.', icon: 'Bell' },
      { title: 'Relance des absences', desc: 'Un client manque son RDV ? Le système détecte et relance automatiquement pour reproposer un créneau. Vous ne perdez plus de revenus.', icon: 'RefreshCw' },
      { title: 'Profils clients enrichis', desc: 'Historique complet de chaque client : rendez-vous passés, notes, préférences, paiements. Vous personalisez chaque interaction.', icon: 'User' },
      { title: 'Multi-intervenants', desc: 'Gérez plusieurs coachs ou professeurs avec leurs plannings respectifs. Dispatch intelligent des nouvelles réservations.', icon: 'Users' },
      { title: 'Intégration salle live', desc: 'Chaque réservation génère automatiquement un lien d\'accès à la salle live LIRI. Vos clients cliquent et arrivent directement.', icon: 'Video' },
      { title: 'Tableau de bord global', desc: 'Vue d\'ensemble de tous vos rendez-vous, revenus attendus, taux de présence et alertes. Vous pilotez votre activité en un coup d\'œil.', icon: 'BarChart3' },
      { title: 'Programmation récurrente', desc: 'Créez des séries de sessions automatiques (hebdo, mensuel). Gestion des exceptions et des règles de récurrence.', icon: 'Calendar' },
      { title: 'Secrétariat IA', desc: 'Un assistant IA répond aux questions courantes de vos clients, confirme les RDV et gère les modifications 24/7.', icon: 'Bot' },
    ],
    technologies: [
      { name: 'Availability Engine™', desc: 'Algorithme de calcul de slots avec contraintes temporelles, buffers et optimisation de charge', icon: 'Clock' },
      { name: 'Smart Calendar™', desc: 'Système de calendrier avec sync iCal/Google Calendar et résolution de conflits intelligente', icon: 'Calendar' },
      { name: 'Stripe Client™', desc: 'Paiement en ligne intégré pour réservations : CB, SEPA, wallets, prélèvements récurrents', icon: 'CreditCard' },
      { name: 'Chariow Gateway™', desc: 'Paiement Mobile Money intégré pour réservations : MTN, Orange Money, paiement USSD, wallet', icon: 'Smartphone' },
      { name: 'Auto Reminder System™', desc: 'Pipeline multi-canal (email/SMS/push) avec personalization et tracking d\'ouverture', icon: 'Bell' },
      { name: 'No-Show Recovery™', desc: 'Détection d\'absence + workflow de relance automatique avec proposition de créneaux alternatifs', icon: 'RefreshCw' },
      { name: 'Client 360° Profile™', desc: 'Base de données unifiée avec historique complet, tagging et segmentation automatique', icon: 'User' },
      { name: 'Multi-Tenant Scheduling™', desc: 'Architecture multi-intervenants avec routing intelligent et gestion de conflits', icon: 'Users' },
      { name: 'Live Admission Link™', desc: 'Générateur de liens sécurisés LIRI avec tokens temporaires et redirection automatique', icon: 'LinkIcon' },
      { name: 'Smart Secretariat AI™', desc: 'Chatbot NLP fine-tuned pour Q&A clients et gestion de modifications de rendez-vous', icon: 'Bot' },
    ],
  },
  {
    id: 'commerce-engine',
    name: 'Virtuel-Mbolo™',
    shortName: 'Commerce Engine',
    tagline: 'La boutique qui pense comme un business.',
    promise: 'Ne créez pas seulement une boutique. Construisez une machine commerciale complète.',
    icon: ShoppingCart,
    color: '#f59e0b',
    story: "Une boutique aujourd'hui : vend, mais ne comprend pas, ne calcule pas bien, ne suit pas les paiements.",
    revolution: "Une boutique + cerveau commercial.",
    whatChanges: "Paiement en plusieurs fois intelligent. Logistique optimisée automatiquement. Cartons intelligents. Suivi complet des dettes. Tunnel de vente intégré.",
    problemSolved: "❌ pertes logistiques\n❌ paiements non suivis\n❌ complexité e-commerce\n\n✅ système commercial complet",
    cta: "Ne crée pas une boutique. Construis une machine à vendre.",
    audience: 'E-commerce, agences, marques, revendeurs.',
    features: [
      { title: 'Boutique professionnelle clé en main', desc: 'Créez une boutique e-commerce complète en minutes. Produits, panier, paiement sécurisé, confirmation automatique. Vous vendez immédiatement.', icon: 'Store' },
      { title: 'Paiement Mobile Money', desc: 'Acceptez les paiements MTN Mobile Money et Orange Money. Vos clients africains paient en 30 secondes depuis leur téléphone. Conversion +60%.', icon: 'Smartphone' },
      { title: 'Paiement en plusieurs fois', desc: 'Proposez le paiement fractionné à vos clients (3x, 5x, 10x). Le système gère les échéances et les relances. Votre panier moyen augmente de 35%.', icon: 'CreditCard' },
      { title: 'Liens de paiement intelligents', desc: 'Générez des liens de paiement personnalisés pour chaque client. Envoyez par email, WhatsApp ou SMS. Suivi des ouvertures et paiements.', icon: 'LinkIcon' },
      { title: 'Récupération paiements échoués', desc: 'Un paiement échoue ? Le système relance automatiquement le client avec des alternatives. Vous récupérez jusqu\'à 25% de ventes perdues.', icon: 'RefreshCw' },
      { title: 'Logistique optimisée IA', desc: 'Le système choisit automatiquement le meilleur emballage, calcule le poids volumétrique et sélectionne le transporteur le plus rentable.', icon: 'Box' },
      { title: 'Suivi des dettes clients', desc: 'Visualisez en temps réel qui vous doit de l\'argent, pour quelle commande, depuis combien de temps. Relances automatiques configurables.', icon: 'BarChart3' },
      { title: 'Tunnel de vente complet', desc: 'Pages de capture, offres, upsells, downsells, confirmation. Le parcours client est optimisé pour maximiser la conversion.', icon: 'ArrowRight' },
      { title: 'Abonnements automatiques', desc: 'Vendez des produits en abonnement (mensuel, annuel). Prélèvements automatiques, gestion des échecs et rétention optimisée.', icon: 'RefreshCw' },
      { title: 'Devis et factures automatisés', desc: 'Générez des devis professionnels en un clic. Conversion automatique en facture après paiement. Suivi comptable intégré.', icon: 'FileText' },
      { title: 'Import fournisseurs dropshipping', desc: 'Importez automatiquement les catalogues produits de vos fournisseurs. Synchronisation des stocks et prix en temps réel.', icon: 'Download' },
    ],
    technologies: [
      { name: 'Store Engine™', desc: 'Architecture headless e-commerce avec gestion catalogue, stocks temps réel et API GraphQL', icon: 'Store' },
      { name: 'Stripe Client™', desc: 'Intégration Stripe complète : paiement CB, SEPA, wallets (Apple Pay, Google Pay), prélèvements automatiques', icon: 'CreditCard' },
      { name: 'Chariow Gateway™', desc: 'Passerelle paiement Afrique : Mobile Money (MTN, Orange), cartes locales, USSD, wallet Chariow', icon: 'Smartphone' },
      { name: 'Installment Payment Engine™', desc: 'Système de paiement fractionné avec scoring de crédit interne et gestion d\'échéancier automatique', icon: 'CreditCard' },
      { name: 'Payment Link Engine™', desc: 'Générateur de liens de paiement dynamiques avec tracking UTM et analytics de conversion', icon: 'LinkIcon' },
      { name: 'Failed Payment Recovery™', desc: 'Workflow de rétention avec retry intelligent, propositions alternatives et relances multi-canal', icon: 'RefreshCw' },
      { name: 'Smart Logistics™', desc: 'Optimisation algorithmique 3D bin-packing + sélection transporteur multi-critères (prix/délai/fiabilité)', icon: 'Box' },
      { name: 'Accounting Engine™', desc: 'Double-entry bookkeeping avec suivi créances, reconciliation bancaire et reporting financier', icon: 'BarChart3' },
      { name: 'Funnel Engine™', desc: 'Constructor de tunnels de conversion avec A/B testing, upsells et behavioral triggers', icon: 'ArrowRight' },
      { name: 'Subscription Engine™', desc: 'Système de billing récurrent avec dunning management et churn prediction', icon: 'RefreshCw' },
    ],
  },
  {
    id: 'marketing-creator',
    name: 'LIRI Marketing Creator™',
    shortName: 'Marketing Creator',
    tagline: 'Ton contenu devient ton moteur de croissance.',
    promise: 'Transformez vos contenus et produits en campagnes qui attirent, convainquent et vendent.',
    icon: Megaphone,
    color: '#f97316',
    story: "Créer une publicité coûte du temps, de l'argent, et de l'énergie. Et souvent… elle ne marche pas.",
    revolution: "Une IA qui transforme ton contenu en marketing.",
    whatChanges: "Ton cours devient une publicité. Tes idées deviennent des campagnes. Tes produits deviennent des messages puissants. Tes vidéos deviennent du trafic.",
    problemSolved: "❌ difficulté à vendre\n❌ manque de contenu marketing\n❌ coût des agences\n\n✅ marketing automatisé + intelligent",
    cta: "Arrête de chercher des clients. Crée un système qui les attire.",
    audience: 'Créateurs, marques, écoles, agences, entrepreneurs.',
    features: [
      { title: 'Générateur de publicités IA', desc: 'Décrivez votre produit ou cours, l\'IA crée automatiquement le visuel, le texte et l\'appel à l\'action. Prêt à publier sur Facebook, Instagram, LinkedIn.', icon: 'Sparkles' },
      { title: 'Cours transformé en pub', desc: 'Importez votre contenu pédagogique, l\'IA en extrait les points clés et crée des publicités qui vendent votre expertise. Votre savoir devient votre marketing.', icon: 'GraduationCap' },
      { title: 'Créateur de formats courts', desc: 'Générez automatiquement des vidéos verticales pour TikTok, Reels et Shorts. Scripts accrocheurs, transitions, musique. Vous devenez viral.', icon: 'Video' },
      { title: 'Copywriting IA professionnel', desc: 'Titres qui cliquent, descriptions qui vendent, emails qui convertissent. Des textes de copywriter senior générés en secondes.', icon: 'FileText' },
      { title: 'Accroches irrésistibles', desc: 'L\'IA analyse ce qui fonctionne dans votre secteur et génère des hooks qui captent l\'attention en 3 secondes. Vos pubs deviennent incontournables.', icon: 'Zap' },
      { title: 'Adaptation multi-plateformes', desc: 'Une campagne, 10 formats différents. Carrousel Instagram, vidéo TikTok, post LinkedIn, story Facebook. Tout est optimisé pour chaque réseau.', icon: 'Share2' },
      { title: 'Campagnes WhatsApp', desc: 'Créez des séquences de messages WhatsApp pour vendre directement. Ouverture 98%. Vos clients répondent et achètent dans la conversation.', icon: 'MessageSquare' },
      { title: 'Tunnel de vente auto-généré', desc: 'L\'IA crée toute la séquence : publicité → page de capture → offre → email de relance. Vous avez juste à publier.', icon: 'ArrowRight' },
      { title: 'A/B testing automatique', desc: 'Testez 5 versions de votre publicité simultanément. Le système mesure et garde la meilleure. Vos résultats s\'améliorent sans effort.', icon: 'BarChart3' },
      { title: 'Calendrier éditorial IA', desc: 'Planifiez vos publications sur tous les réseaux. L\'IA suggère les meilleurs horaires selon votre audience. Votre contenu arrive au bon moment.', icon: 'Calendar' },
    ],
    technologies: [
      { name: 'Ad Creator AI™', desc: 'Pipeline GPT-4 Vision + DALL-E pour génération end-to-end publicités avec brand consistency checking', icon: 'Sparkles' },
      { name: 'Course-to-Ad Engine™', desc: 'NLP d\'extraction de value propositions + génération de angles marketing par analyse de contenu pédagogique', icon: 'GraduationCap' },
      { name: 'Motion Ad Builder™', desc: 'Moteur de génération vidéo vertical avec templates dynamiques, text-to-speech et auto-subtitling', icon: 'Video' },
      { name: 'Copywriting AI™', desc: 'GPT-4 fine-tuned sur copywriting direct-response avec frameworks AIDA, PAS, BAB et hooks viraux', icon: 'FileText' },
      { name: 'Hook Generator™', desc: 'Analyse de patterns viraux + génération d\'accroches pattern-matched par secteur d\'activité', icon: 'Zap' },
      { name: 'Social Format Adapter™', desc: 'Engine de resize intelligent avec recomposition automatique pour formats 1:1, 9:16, 4:5, 16:9', icon: 'Share2' },
      { name: 'WhatsApp Campaign Builder™', desc: 'Constructor de flows conversationnels avec buttons, quick replies et templates WhatsApp Business API', icon: 'MessageSquare' },
      { name: 'Funnel Content Generator™', desc: 'Orchestrateur de séquences marketing avec génération cohérente across touchpoints (ad → landing → email)', icon: 'ArrowRight' },
      { name: 'A/B Testing Engine™', desc: 'Système de split testing avec statistical significance calculator et auto-winner selection', icon: 'BarChart3' },
      { name: 'Publishing Calendar AI™', desc: 'Scheduler intelligent avec prédiction optimal posting times basée sur audience analytics', icon: 'Calendar' },
    ],
  },
];

/* ═══════════════════════════════════════════════════════════════
   ICON MAP
═══════════════════════════════════════════════════════════════ */

const ICON_MAP = {
  Radio, Monitor, Globe, Settings, Clock, Users, Shield, Lock, Hand, MessageSquare, Eye, Share2, PenTool, Layers, FileText, Layout, Menu, Circle, Download, Upload, Languages, Folder, Brain, CheckCircle2, RefreshCw, Award, Bot, Store, Package, CreditCard, LinkIcon, Receipt, BarChart3, Percent, Truck, Box, Calculator, Map, Tag, Terminal, Grid2x2, Clapperboard, CalculatorIcon, Mail, Bell, AlertCircle, User, ArrowRightIcon, PercentIcon, Sparkles, Video, Palette, GraduationCap, Calendar, ShoppingCart, Megaphone, Zap, Cpu, Heart, Rocket, Star, ArrowRight, ArrowUpRight, Target, Headphones, Mic, Smartphone,
};

const getIcon = (iconName) => ICON_MAP[iconName] || Star;

/* ═══════════════════════════════════════════════════════════════
   PAGE
═══════════════════════════════════════════════════════════════ */

export default function CimolaceSolutionDetailPage() {
  const solutionIdManual = window.location.pathname.split('/').pop();
  const solution = SOLUTIONS.find(s => s.id === solutionIdManual);

  if (!solution) {
    return (
      <div className="min-h-screen bg-[#050507] text-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Solution non trouvée</h1>
          <Link to="/cimolace/products" className="text-violet-400 hover:text-violet-300">
            Retour aux produits
          </Link>
        </div>
      </div>
    );
  }

  const Icon = solution.icon;
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 100, damping: 30 });

  const chapters = [
    { id: 'hero', label: 'Intro' },
    { id: 'story', label: 'Histoire' },
    { id: 'revolution', label: 'Révolution' },
    { id: 'whatChanges', label: 'Usage' },
    { id: 'features', label: 'Fonctions' },
    { id: 'technologies', label: 'Tech' },
    { id: 'problemSolved', label: 'Solution' },
    { id: 'audience', label: 'Cible' },
    { id: 'cta', label: 'Action' },
  ];

  const marqueeItems = [
    solution.shortName,
    'CIMOLACE OS',
    'LIRI AI Core',
    'Intelligence Artificielle',
    'Expérience Immersive',
    'Formation',
    'Commerce',
    'Marketing',
    'Administration',
  ];

  return (
    <>
      <Helmet>
        <title>{solution.name} | CIMOLACE</title>
        <meta name="description" content={solution.tagline} />
      </Helmet>

      <div className="bg-[#050507] text-white min-h-screen overflow-x-hidden">
        {/* Scroll progress bar */}
        <motion.div
          className="fixed top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-violet-500 to-cyan-400 z-[60] origin-left"
          style={{ scaleX }}
        />

        {/* Nav */}
        <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-8 py-4 backdrop-blur-xl bg-[#050507]/80 border-b border-white/[0.04]">
          <Link to="/cimolace" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center">
              <Zap className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-sm font-black tracking-tight">CIMOLACE</span>
          </Link>
          <div className="hidden lg:flex items-center gap-2">
            {chapters.map((c, i) => (
              <a key={c.id} href={`#${c.id}`} title={c.label}>
                <motion.div
                  animate={{ scale: i === 0 ? 1.4 : 1, backgroundColor: i === 0 ? solution.color : 'rgba(255,255,255,0.15)' }}
                  transition={{ duration: 0.3 }}
                  className="w-1.5 h-1.5 rounded-full"
                />
              </a>
            ))}
          </div>
          <Link to="/cimolace/products" className="text-xs text-white/40 hover:text-white/80 transition-colors">
            ← Retour
          </Link>
        </nav>

        {/* ══ SECTION 1 — HERO ══ */}
        <section id="hero" className="relative min-h-screen flex items-center justify-center overflow-hidden">
          <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")` }} />
          <motion.div animate={{ scale: [1, 1.15, 1], x: [0, 30, 0] }} transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }} className="absolute top-[15%] left-[10%] w-[500px] h-[500px] rounded-full opacity-10 blur-[120px] pointer-events-none" style={{ backgroundColor: solution.color }} />
          <motion.div animate={{ scale: [1, 1.2, 1], x: [0, -25, 0] }} transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut', delay: 2 }} className="absolute bottom-[10%] right-[5%] w-[600px] h-[600px] rounded-full opacity-8 blur-[140px] pointer-events-none" style={{ backgroundColor: solution.color }} />

          <div className="relative z-10 max-w-[1100px] mx-auto px-8 pt-28 pb-20 text-center">
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/[0.1] mb-12 text-xs text-white/40 tracking-widest uppercase">
              <Sparkles className="w-3 h-3" />
              CIMOLACE OS
            </motion.div>
            <div className="mb-8">
              <Line delay={0.1}><h1 className="text-[clamp(3rem,10vw,8.5rem)] font-black leading-[0.9] tracking-[-0.03em] text-white">{solution.name}</h1></Line>
              <Line delay={0.22}><h1 className="text-[clamp(1.8rem,5vw,4rem)] font-black leading-[1.1] tracking-[-0.03em]"><Shimmer from={solution.color} to="#67e8f9" className="font-black">{solution.tagline}</Shimmer></h1></Line>
            </div>
            <motion.p initial={{ opacity: 0, y: 24, filter: 'blur(8px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} transition={{ duration: 0.9, delay: 0.6, ease: [0.16, 1, 0.3, 1] }} className="text-lg lg:text-xl text-white/50 max-w-[640px] mx-auto leading-relaxed mb-16">
              {solution.promise}
            </motion.p>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.4 }} className="flex flex-col items-center gap-3 text-white/25">
              <span className="text-[10px] tracking-[0.3em] uppercase">Défiler</span>
              <motion.div animate={{ scaleY: [1, 1.5, 1], opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.5, repeat: Infinity }} className="w-px h-10 bg-gradient-to-b from-violet-400/60 to-transparent" />
            </motion.div>
          </div>
        </section>

        <Marquee items={marqueeItems} speed={50} />

        {/* ══ SECTION 2 — HISTOIRE ══ */}
        <section id="story" className="py-32 px-8 max-w-[900px] mx-auto">
          <Line delay={0}><span className="text-[10px] tracking-[0.35em] uppercase mb-10 block" style={{ color: solution.color }}>L'histoire</span></Line>
          <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.2, duration: 0.8 }}>
            <Line delay={0.1}>
              <h2 className="text-[clamp(2rem,5vw,4rem)] font-black tracking-[-0.03em] text-white leading-[1.05] mb-10">
                {solution.story.split('.')[0]}.
              </h2>
            </Line>
            <p className="text-xl text-white/50 leading-relaxed">{solution.story}</p>
          </motion.div>
        </section>

        <Marquee items={marqueeItems} speed={35} />

        {/* ══ SECTION 3 — RÉVOLUTION ══ */}
        <section id="revolution" className="py-32 px-8 max-w-[1100px] mx-auto">
          <Line delay={0}><span className="text-[10px] tracking-[0.35em] uppercase mb-10 block" style={{ color: solution.color }}>La révolution</span></Line>
          <Line delay={0.1}>
            <h2 className="text-[clamp(2.5rem,6vw,5.5rem)] font-black tracking-[-0.03em] text-white leading-[0.95] mb-10">
              {solution.revolution.split('.')[0]}.
            </h2>
          </Line>
          <motion.p initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.3, duration: 0.7 }} className="text-xl text-white/50 max-w-3xl leading-relaxed">
            {solution.revolution}
          </motion.p>
        </section>

        {/* ══ SECTION 4 — CE QUE ÇA CHANGE ══ */}
        <section id="whatChanges" className="py-32 px-8 max-w-[1100px] mx-auto">
          <Line delay={0}><span className="text-[10px] tracking-[0.35em] uppercase mb-10 block" style={{ color: solution.color }}>Ce que ça change</span></Line>
          <Line delay={0.1}>
            <h2 className="text-[clamp(2rem,5vw,4.5rem)] font-black tracking-[-0.03em] text-white leading-[0.95] mb-14">
              Concrètement.
            </h2>
          </Line>
          <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.2, duration: 0.8 }} className="space-y-6">
            {solution.whatChanges.split('. ').filter(Boolean).map((sentence, i) => (
              <motion.p key={i} initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.07, duration: 0.5 }} className="flex items-start gap-4 text-xl text-white/60 leading-relaxed">
                <span className="mt-2.5 w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: solution.color }} />
                <span>{sentence}.</span>
              </motion.p>
            ))}
          </motion.div>
        </section>

        {/* ══ SECTION 5 — TECHNOLOGIES EMBARQUÉES ══ */}
        <section id="technologies" className="py-32 px-8 max-w-[1100px] mx-auto">
          <div className="mb-20">
            <Line delay={0}><span className="text-[10px] tracking-[0.35em] uppercase mb-10 block" style={{ color: solution.color }}>Technologies embarquées</span></Line>
            <Line delay={0.1}>
              <h2 className="text-[clamp(2.5rem,6vw,5rem)] font-black tracking-[-0.03em] text-white leading-[0.95] mb-6">
                <CountUp to={solution.technologies?.length || 0} suffix="+" /> moteurs
              </h2>
            </Line>
            <motion.p initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: 0.3 }} className="text-xl text-white/40 max-w-2xl">
              Chaque solution CIMOLACE est propulsée par des technologies embarquées qui travaillent ensemble pour créer une expérience fluide et puissante.
            </motion.p>
          </div>
          <motion.div variants={stagger(0.04, 0.1)} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-3%' }} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {solution.technologies?.slice(0, 8).map((tech, i) => {
              const TechIcon = getIcon(tech.icon);
              return (
                <motion.div key={i} variants={fadeUp} whileHover={{ y: -4, borderColor: `${solution.color}40` }} className="p-5 rounded-2xl bg-white/[0.025] border border-white/[0.07] cursor-default transition-colors duration-300">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `linear-gradient(135deg, ${solution.color}20, ${solution.color}40)` }}>
                      <TechIcon className="w-4 h-4" style={{ color: solution.color }} />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-xs font-bold text-white mb-1">{tech.name}</h4>
                      <p className="text-[11px] text-white/40 leading-snug">{tech.desc}</p>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        </section>

        {/* ══ SECTION 6 — FONCTIONNALITÉS CLÉS ══ */}
        <section id="features" className="py-32 px-8 max-w-[1200px] mx-auto">
          <div className="mb-20">
            <Line delay={0}><span className="text-[10px] tracking-[0.35em] uppercase mb-10 block" style={{ color: solution.color }}>Fonctionnalités clés</span></Line>
            <Line delay={0.1}>
              <h2 className="text-[clamp(2.5rem,6vw,5rem)] font-black tracking-[-0.03em] text-white leading-[0.95] mb-6">
                <CountUp to={solution.features?.length || 10} suffix="+" /> super-pouvoirs
              </h2>
            </Line>
            <motion.p initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: 0.3 }} className="text-xl text-white/40 max-w-2xl">
              Chaque fonctionnalité est conçue pour résoudre un problème concret et augmenter vos résultats.
            </motion.p>
          </div>
          <motion.div variants={stagger(0.06, 0.1)} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-3%' }} className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {solution.features?.map((feature, i) => {
              const FeatureIcon = getIcon(feature.icon);
              return (
                <motion.div key={i} variants={fadeUp} whileHover={{ y: -4, borderColor: `${solution.color}40` }} className="p-6 rounded-2xl bg-white/[0.025] border border-white/[0.07] cursor-default transition-colors duration-300">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `linear-gradient(135deg, ${solution.color}20, ${solution.color}40)` }}>
                      <FeatureIcon className="w-6 h-6" style={{ color: solution.color }} />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-base font-bold text-white mb-2">{feature.title}</h4>
                      <p className="text-sm text-white/50 leading-relaxed">{feature.desc}</p>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        </section>

        {/* ══ SECTION 7 — PROBLÈME RÉSOLU ══ */}
        <section id="problemSolved" className="py-32 px-8 max-w-[1100px] mx-auto">
          <Line delay={0}><span className="text-[10px] tracking-[0.35em] uppercase mb-10 block" style={{ color: solution.color }}>Problème résolu</span></Line>
          <Line delay={0.1}>
            <h2 className="text-[clamp(2.5rem,6vw,5.5rem)] font-black tracking-[-0.03em] text-white leading-[0.95] mb-14">
              Avant vs Après.
            </h2>
          </Line>
          <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.2, duration: 0.8 }} className="text-2xl text-white/55 leading-relaxed whitespace-pre-line font-light">
            {solution.problemSolved}
          </motion.div>
        </section>

        {/* ══ SECTION 8 — DESTINATAIRES ══ */}
        <section id="audience" className="py-32 px-8 max-w-[900px] mx-auto">
          <Line delay={0}><span className="text-[10px] tracking-[0.35em] uppercase mb-10 block" style={{ color: solution.color }}>Pour qui ?</span></Line>
          <Line delay={0.1}>
            <h2 className="text-[clamp(2rem,5vw,4.5rem)] font-black tracking-[-0.03em] text-white leading-[0.95] mb-10">
              C'est fait pour vous.
            </h2>
          </Line>
          <motion.p initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.2, duration: 0.7 }} className="text-2xl text-white/55 leading-relaxed font-light">
            {solution.audience}
          </motion.p>
        </section>

        {/* ══ SECTION 9 — CTA ══ */}
        <section id="cta" className="relative py-40 px-8 overflow-hidden">
          <div className="relative z-10 max-w-[900px] mx-auto text-center">
            <Line delay={0}><span className="text-[10px] tracking-[0.35em] uppercase mb-10 block" style={{ color: solution.color }}>Appel à l'action</span></Line>
            <div className="mb-10">
              <Line delay={0.1}>
                <h2 className="text-[clamp(2.5rem,7vw,6rem)] font-black leading-[0.92] tracking-[-0.03em] text-white">
                  {solution.cta}
                </h2>
              </Line>
            </div>
            <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.4 }} className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to={solution.id === 'commerce-engine' ? '/cimolace/solutions/virtuel-mbolo' : '/cimolace/configurateur'}
                className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-r from-violet-500 to-cyan-500 text-white font-bold text-sm rounded-xl hover:shadow-lg hover:shadow-violet-500/25 transition-all"
              >
                {solution.id === 'commerce-engine' ? 'Voir les forfaits' : 'Configurer'} <ArrowRight className="w-4 h-4" />
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
