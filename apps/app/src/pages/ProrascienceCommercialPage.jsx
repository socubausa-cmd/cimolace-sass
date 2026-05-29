import React, { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import {
  motion,
  useScroll,
  useTransform,
  useReducedMotion,
  useInView,
  useMotionValue,
  useSpring,
  useMotionValueEvent,
  animate,
} from 'framer-motion';
import {
  ArrowRight,
  Sparkles,
  PlayCircle,
  ShieldCheck,
  GraduationCap,
  CheckCircle2,
  MessageSquare,
  CalendarDays,
  Globe2,
  BookOpen,
  CreditCard,
  Building2,
  Users,
  Layers3,
  Smartphone,
  BarChart3,
  Star,
  ChevronRight,
  Cpu,
  LayoutPanelTop,
  Rocket,
} from 'lucide-react';
import { LiriWordmark } from '@/components/brand/LiriWordmark';
import SEO from '@/components/SEO';
import { ProrascienceHomeHeroCarousel } from '@/components/prorascience/ProrascienceHomeHeroCarousel';
import { Button } from '@/components/ui/button';
import { FOUNDER_IMAGE_SOURCES } from '@/lib/founderImageSources';
import { getLiriMemberLoginPath } from '@/lib/liriVitrineModel';
import { ELEVE_MOBILE } from '@/lib/eleveMobileRoutes';
import { isnaTenantConfig } from '@/tenants/isna/tenant.config';

const SCHOOL = isnaTenantConfig.branding.name;
const SCHOOL_FULL = isnaTenantConfig.branding.fullName;
const PUBLIC_SITE = isnaTenantConfig.branding.publicSiteOrigin;

/**
 * `?vitrine=web` = forcer la longue page marketing (aussi sur téléphone).
 * Par défaut : (1) appli **Capacitor** → on entre dans la coque `/m/eleve/...` ; (2) **navigateur** sur un écran
 * (largeur < 768px) → `replace` vers `/m/eleve` (même code qu'en WebView ; pas d'appli “Capacitor côté serveur”).
 * Désactiver la redirection web mobile seulement : `VITE_REDIRECT_MOBILE_WEB_TO_ELEVE=0` au build.
 */
const VITRINE_WEB_QUERY = 'vitrine';
const VITRINE_WEB_VALUE = 'web';

/** ID YouTube seulement (ex: dQw4w9WgXcQ) — optionnel : VITE_PRORASCIENCE_COMMERCIAL_YOUTUBE_ID */
const PROMO_YOUTUBE_ID = String(import.meta.env.VITE_PRORASCIENCE_COMMERCIAL_YOUTUBE_ID || '').trim();

const media = {
  /** Bloc « Rejoindre le réseau » (communauté) — visuel aligné LIRI / distance */
  heroAlt: '/image-pro/aprendre-a-distance.png',
  /** Démo MP4 (CC0 MDN) si pas de YouTube — éviter Mixkit : 403 en hotlink depuis des domaines tiers */
  schoolDemoMp4:
    'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
  schoolDemoPoster:
    'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?q=80&w=1280&auto=format&fit=crop',
  gallery: [
    {
      src: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?q=80&w=800&auto=format&fit=crop',
      caption: 'Communauté ISNA — entraide et progression',
    },
    {
      src: 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?q=80&w=800&auto=format&fit=crop',
      caption: 'Rituels compris, pas seulement répétés',
    },
    {
      src: 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?q=80&w=800&auto=format&fit=crop',
      caption: 'Parcours : Comprendre, Pratiquer, Exercer',
    },
    {
      src: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=800&auto=format&fit=crop',
      caption: 'Lives LIRI & classe immersive',
    },
  ],
};

const appleStoryHistory = [
  {
    eyebrow: 'Le monde avant',
    title: 'On vous a appris à faire, pas à comprendre.',
    body:
      'Libations, prières, rituels : des gestes transmis et répétés sans toujours recevoir la logique, les lois invisibles et la structure derrière chaque acte.',
    image: '/image-pro/prorascience-histoire-rites-panels.png',
    alt: 'Rites et panneaux narratifs du corpus enseigné',
  },
  {
    eyebrow: 'La fracture',
    title: 'Avant il fallait voyager. Maintenant une connexion suffit.',
    body:
      'Quitter l\'Europe, retourner au village, chercher un initié, attendre des années. Aujourd\'hui, l\'école initiatique moderne se rejoint depuis votre téléphone ou votre ordinateur.',
    image: '/image-pro/aprendre-a-distance.png',
    alt: 'Apprendre à distance avec l\'école ISNA',
  },
  {
    eyebrow: 'Le basculement',
    title: 'Ce que vous avez vécu. Ce qui change maintenant.',
    body:
      'Le corpus enseigné transforme la répétition en compréhension, la dépendance en autonomie et l\'intuition floue en maîtrise structurée.',
    image: '/image-pro/isna-pro-voyageur-cinematic.png',
    alt: 'Voyage initiatique et transformation du parcours',
  },
];

const trustedBy = [
  '30+ pays représentés',
  'Réseau de transmetteurs',
  'Coaching & mentorat spirituel',
  'Bibliothèque d\'ouvrages fondateurs',
  'Doctrine & pédagogie MK5',
];

const stats = [
  { label: 'Étudiants formés', value: '2500+' },
  { label: 'Modules créés', value: '100+' },
  { label: 'Transmetteurs', value: '50+' },
  { label: 'Pays représentés', value: '30+' },
];

const allInOne = [
  {
    icon: Users,
    title: 'Communauté & vie scolaire',
    description:
      'Espace membre, forum, messagerie et annonces : rester connecté à sa cohorte et au secrétariat.',
  },
  {
    icon: GraduationCap,
    title: 'ISNA — 21 sciences & 4 cycles',
    description:
      'Le curriculum officiel des sciences mystiques africaines, structuré en cycles initiatiques progressifs.',
  },
  {
    icon: CalendarDays,
    title: 'Lives, agenda & événements',
    description:
      'Cours en direct, replays et rendez-vous institutionnels — au rythme du calendrier de l\'école.',
  },
  {
    icon: BookOpen,
    title: 'Bibliothèque & doctrine',
    description:
      'Accès aux livres fondateurs, séries et ressources qui nourrissent la compréhension, pas seulement la pratique.',
  },
  {
    icon: CreditCard,
    title: 'Forfaits & inscription',
    description:
      'Activer son accès premium, gérer son abonnement et suivre la partie administrative en ligne.',
  },
  {
    icon: MessageSquare,
    title: 'Accompagnement humain',
    description:
      'Échanges avec le secrétariat, demandes d\'entretien et parcours visiteur avant passage élève.',
  },
  {
    icon: Smartphone,
    title: 'LIRI sur mobile',
    description:
      'Suivre cours, lives et notifications depuis l\'expérience mobile dédiée à la communauté.',
  },
  {
    icon: Building2,
    title: 'Pages publiques & doctrine',
    description:
      `Doctrine, ${SCHOOL}, équipe, FAQ : tout le socle de crédibilité avant d'entrer dans le parcours.`,
  },
  {
    icon: BarChart3,
    title: 'Suivi & progression',
    description:
      'Progression dans les modules, évaluations et visibilité sur ton parcours d\'initiation.',
  },
];

function produitFind(title) {
  return allInOne.find((x) => x.title === title);
}

const featureStory = [
  {
    eyebrow: `Pôle école ${SCHOOL}`,
    title: 'Apprendre avec structure et profondeur',
    text: `${SCHOOL} professionnalise l'initiation : chaque concept est relié à une méthode, chaque méthode à une application concrète dans la vie.`,
    points: ['Progression claire : fondations → maîtrise', 'Pédagogie immersive (classe, lives)', 'Retours et exigence de niveau'],
    icon: Layers3,
  },
  {
    eyebrow: 'Doctrine — science & spiritualité',
    title: 'Cosmologie et science métaphysique du 5ᵉ Manikongo',
    text: 'Ce corpus n\'est pas une simple croyance : c\'est une lecture rigoureuse du visible et de l\'invisible, ancrée dans une tradition africaine souveraine.',
    points: ['Ontologie, Potentia Prima, lois invisibles', 'Ouvrages et enseignements structurés', 'Lien avec le réseau Ngowazulu / ISNA'],
    icon: Globe2,
  },
  {
    eyebrow: 'Au-delà du cursus',
    title: 'Coaching thérapeutique & mentorat spirituel',
    text: 'Pour ceux qui veulent un accompagnement plus ciblé : diagnostics, soutien et transmission plus intime que le seul cursus collectif.',
    points: ['Coaching thérapeutique privé', 'Mentorat spirituel', 'Chemins institutionnels selon profil'],
    icon: GraduationCap,
  },
];

const premiumRows = [
  {
    badge: 'Doctrine publiée',
    title: 'Le socle intellectuel : bibliothèque et grands livres',
    text: 'Le Fond de Tout, le Dialogue avec la Physique, l\'Ontodynamique… Des textes fondamentaux pour comprendre avant d\'agir.',
    bullets: [`Bibliothèque ${SCHOOL}`, 'Doctrine et glossaire', 'Continuité entre théorie et pratique'],
    icon: LayoutPanelTop,
    ctaHref: '/bibliotheque',
    ctaLabel: 'Explorer la bibliothèque',
  },
  {
    badge: 'LIRI & studio',
    title: 'Classes immersives, smartboard et arène live',
    text: 'Une expérience de cours moderne : animation pédagogique, outils visuels et sessions live au service de la transmission.',
    bullets: ['Lives et replays intégrés', 'Outils de présentation avancés', 'Parcours salle d\'attente / invité'],
    icon: Cpu,
    ctaHref: '/formations/catalogue',
    ctaLabel: 'Voir les parcours',
  },
  {
    badge: 'Les 21 sciences',
    title: 'Le curriculum que suit un nganga complet',
    text: 'De l\'Ontologie sacrée au Mayekou, en quatre cycles : Fondements, Sciences invisibles, Maîtrise, Haute initiation.',
    bullets: ['21 domaines sacrés cartographiés', '4 cycles initiatiques', 'Vision d\'ensemble de l\'ISNA'],
    icon: Rocket,
    ctaHref: '/ecoles',
    ctaLabel: 'Découvrir les 21 sciences',
  },
];

const pricingCards = [
  {
    name: 'Découverte',
    price: 'Gratuit',
    period: '',
    audience: 'Premier pas avec l\'école',
    points: [
      'Compte visiteur et orientation',
      'Salon d\'entretien visiteur',
      `Accès aux pages publiques (doctrine, ${SCHOOL}…)`,
    ],
    cta: 'Créer mon compte',
    featured: false,
    href: '/signup',
  },
  {
    name: 'Parcours élève ISNA',
    price: 'Forfaits',
    period: '',
    audience: 'Accès premium vie scolaire & formations',
    points: [
      'Tableau de bord vie scolaire',
      'Cours, modules et lives selon ton forfait',
      'Messagerie et suivi pédagogique',
    ],
    cta: 'Voir les forfaits',
    featured: true,
    href: '/forfaits',
  },
  {
    name: 'Sur mesure',
    price: 'Sur devis',
    period: '',
    audience: 'Institutions, parcours avancés, accompagnement dédié',
    points: [
      'Échanges directs avec le secrétariat',
      'Coaching & mentorat ciblés',
      'Dossiers spécifiques (réseau, temple…)',
    ],
    cta: 'Prendre rendez-vous',
    featured: false,
    href: '/appointment/request?source=prorascience-isna-commercial',
  },
];

function CommercialFounderPortrait() {
  const sources = useMemo(() => FOUNDER_IMAGE_SOURCES, []);
  const [srcIndex, setSrcIndex] = useState(0);
  const [hideImage, setHideImage] = useState(false);

  const handleError = () => {
    const next = srcIndex + 1;
    if (next < sources.length) {
      setSrcIndex(next);
      return;
    }
    setHideImage(true);
  };

  return (
    <div className="relative mx-auto w-full max-w-md lg:mx-0 lg:max-w-lg">
      <div className="absolute -inset-px rounded-3xl bg-gradient-to-br from-[#D4AF37]/30 via-transparent to-blue-500/15" />
      <div className="relative overflow-hidden rounded-2xl border border-[#D4AF37]/40 bg-[#101722] shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
        {!hideImage ? (
          <img
            src={sources[srcIndex]}
            alt={`5ᵉ Manikongo (Badika Jel David), fondateur de ${SCHOOL}, en posture de transmission rituelle`}
            onError={handleError}
            className="aspect-[4/5] w-full object-cover object-top"
            loading="lazy"
          />
        ) : (
          <div className="flex aspect-[4/5] flex-col items-center justify-center gap-2 bg-white/[0.04] p-8 text-center">
            <p className="text-sm text-white/55">
              Déposez <code className="rounded bg-black/40 px-1.5 py-0.5 text-[#D4AF37]">founder.jpg</code> ou{' '}
              <code className="rounded bg-black/40 px-1.5 py-0.5 text-[#D4AF37]">founder.png</code> dans{' '}
              <code className="rounded bg-black/40 px-1.5 py-0.5">public/</code> pour afficher le portrait.
            </p>
          </div>
        )}
      </div>
      <p className="mt-4 text-center text-xs font-medium tracking-wide text-[#D4AF37]/90 lg:text-left">
        5ᵉ Manikongo · Badika Jel David (Ngowazulu)
      </p>
    </div>
  );
}

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/** Défilement amorti vers une ancre (compense le header sticky). */
function smoothScrollToSectionId(id, { reducedMotion = false, headerOffset = 88, onComplete } = {}) {
  const el = document.getElementById(id);
  if (!el) {
    onComplete?.(null);
    return;
  }
  if (reducedMotion) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.setTimeout(() => {
      try {
        window.history.replaceState(null, '', `#${id}`);
      } catch {
        /* ignore */
      }
      onComplete?.(el);
    }, 450);
    return;
  }

  const targetY = el.getBoundingClientRect().top + window.scrollY - headerOffset;
  const startY = window.scrollY;
  const distance = targetY - startY;
  const duration = Math.min(1700, Math.max(480, Math.abs(distance) * 0.62));
  let startTs = null;

  const step = (ts) => {
    if (startTs == null) startTs = ts;
    const t = Math.min(1, (ts - startTs) / duration);
    window.scrollTo(0, startY + distance * easeInOutCubic(t));
    if (t < 1) {
      requestAnimationFrame(step);
    } else {
      try {
        window.history.replaceState(null, '', `#${id}`);
      } catch {
        /* ignore */
      }
      onComplete?.(el);
    }
  };
  requestAnimationFrame(step);
}

function flashNavTargetElement(el) {
  if (!el) return;
  el.classList.remove('prs-nav-target-flash');
  // Reflow pour relancer l'animation CSS si même cible deux fois de suite
  void el.offsetWidth;
  el.classList.add('prs-nav-target-flash');
  window.setTimeout(() => el.classList.remove('prs-nav-target-flash'), 1000);
}

const faqs = [
  {
    q: "Qu'est-ce que l'ISNA exactement ?",
    a: `L'ISNA (Initiation aux Sciences Nocturnes Africaines) est le pôle école de ${SCHOOL_FULL} : parcours structurés, pédagogie immersive et exigence de compréhension, pas seulement de répétition rituelle.`,
  },
  {
    q: 'Quelle différence entre visiteur et élève premium ?',
    a: "Le visiteur peut s'orienter et demander un entretien ; l'élève avec forfait actif accède à la vie scolaire, aux formations, aux lives et au suivi dans l'application.",
  },
  {
    q: 'Où trouver la doctrine et les 21 sciences ?',
    a: "La carte des 21 sciences et des 4 cycles est sur la page « Les écoles » ; la bibliothèque et les ouvrages fondateurs complètent le socle théorique.",
  },
];

const easePremium = [0.22, 1, 0.36, 1];

function WordBlurReveal({ text, className, delayStep = 0.065, baseDelay = 0 }) {
  const reduce = useReducedMotion();
  const words = text.trim().split(/\s+/);
  if (reduce) {
    return <span className={className}>{text}</span>;
  }
  return (
    <span className={className}>
      {words.map((word, i) => (
        <React.Fragment key={`${word}-${i}`}>
          {i > 0 ? ' ' : null}
          <motion.span
            className="inline-block"
            initial={{ opacity: 0, y: 32, filter: 'blur(14px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ duration: 0.68, delay: baseDelay + i * delayStep, ease: easePremium }}
          >
            {word}
          </motion.span>
        </React.Fragment>
      ))}
    </span>
  );
}

function BrandShimmerWord({ text }) {
  const reduce = useReducedMotion();
  const letters = useMemo(() => [...text], [text]);
  if (reduce) {
    return <span className="text-[#D4AF37]">{text}</span>;
  }
  return (
    <span className="relative inline-block prs-brand-shimmer">
      {letters.map((ch, i) => (
        <motion.span
          key={`${ch}-${i}`}
          className="inline-block"
          initial={{ opacity: 0, y: 22, rotateX: -42 }}
          animate={{ opacity: 1, y: 0, rotateX: 0 }}
          transition={{ duration: 0.42, delay: 0.12 + i * 0.038, ease: easePremium }}
          style={{ transformOrigin: '50% 100%' }}
        >
          {ch}
        </motion.span>
      ))}
      <span className="prs-underline-gold pointer-events-none absolute left-0 right-0" aria-hidden />
    </span>
  );
}

function parseStatDisplay(raw) {
  const s = String(raw).trim();
  const m = s.match(/^([\d\s.,]+)(.*)$/);
  if (!m) return { kind: 'text', text: s };
  const num = parseInt(m[1].replace(/[\s.,]/g, ''), 10);
  if (Number.isNaN(num)) return { kind: 'text', text: s };
  return { kind: 'count', num, suffix: m[2] || '' };
}

function AnimatedStatBlock({ value, label }) {
  const reduce = useReducedMotion();
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-40px' });
  const parsed = useMemo(() => parseStatDisplay(value), [value]);
  const [n, setN] = useState(0);

  useEffect(() => {
    if (parsed.kind !== 'count') return;
    if (!inView) return;
    if (reduce) {
      setN(parsed.num);
      return;
    }
    const ctrl = animate(0, parsed.num, {
      duration: 1.25,
      ease: easePremium,
      onUpdate: (v) => setN(Math.round(v)),
    });
    return () => ctrl.stop();
  }, [inView, parsed, reduce]);

  const display = parsed.kind === 'count' ? `${n}${parsed.suffix}` : parsed.text;

  return (
    <div ref={ref} className="rounded-xl border border-white/10 bg-black/30 p-3 md:p-3.5">
      <p className="text-xl font-bold tabular-nums text-[#D4AF37] md:text-2xl">{display}</p>
      <p className="mt-0.5 text-[11px] leading-snug text-white/65 md:text-xs">{label}</p>
    </div>
  );
}

function SectionHeading({ eyebrow, title, className = '' }) {
  const reduce = useReducedMotion();
  const words = title.trim().split(/\s+/);
  const wordByWord = !reduce && words.length <= 14;
  return (
    <div className={className}>
      <motion.p
        className="text-xs uppercase tracking-[0.2em] text-[#D4AF37]"
        initial={reduce ? false : { opacity: 0, y: 14, filter: 'blur(8px)' }}
        whileInView={reduce ? undefined : { opacity: 1, y: 0, filter: 'blur(0px)' }}
        viewport={{ once: true, amount: 0.9 }}
        transition={{ duration: 0.6, ease: easePremium }}
      >
        {eyebrow}
      </motion.p>
      <h2 className="mt-2 text-3xl font-bold md:text-4xl">
        {wordByWord ? (
          words.map((w, i) => (
            <motion.span
              key={`${w}-${i}`}
              className="inline-block"
              initial={{ opacity: 0, y: 26, filter: 'blur(10px)' }}
              whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              viewport={{ once: true, amount: 0.85 }}
              transition={{ duration: 0.55, delay: i * 0.045, ease: easePremium }}
            >
              {i > 0 ? '\u00A0' : null}
              {w}
            </motion.span>
          ))
        ) : (
          <motion.span
            className="inline-block"
            initial={reduce ? false : { opacity: 0, y: 28, filter: 'blur(12px)' }}
            whileInView={reduce ? undefined : { opacity: 1, y: 0, filter: 'blur(0px)' }}
            viewport={{ once: true, amount: 0.85 }}
            transition={{ duration: 0.65, ease: easePremium }}
          >
            {title}
          </motion.span>
        )}
      </h2>
    </div>
  );
}

/** Lift + tap sur CTA sans imbriquer <button> dans <a>. */
function PremiumPressable({ children, className = '' }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={`inline-flex ${className}`}
      whileHover={reduce ? undefined : { y: -3, scale: 1.02 }}
      whileTap={reduce ? undefined : { scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 420, damping: 22 }}
    >
      {children}
    </motion.div>
  );
}

const liriStudentKnowledge = [
  'Utiliser la vie scolaire : tableau de bord, agenda, annonces et messages.',
  'Rejoindre les lives LIRI — classe immersive, smartboard, caméras et replay.',
  'Suivre son parcours ISNA : 21 sciences, 4 cycles, progression et évaluations.',
  'S\'appuyer sur la bibliothèque et la doctrine (ouvrages fondateurs, glossaire).',
  'Respecter le calendrier institutionnel et les engagements de présence.',
  'Recourir au secrétariat pour inscriptions, forfaits et rendez-vous prioritaires.',
  'Accéder à LIRI mobile pour cours, notifications et hub élève en déplacement.',
];

/** Portraits libres (Unsplash) — illustrent la diversité des membres ; noms fictifs. */
const testimonialMembers = [
  {
    name: 'Sarah K.',
    role: 'Élève ISNA — Europe',
    quote:
      'Pour la première fois j\'ai compris pourquoi les rituels fonctionnent, au-delà de la répétition. Le parcours est exigeant mais clair.',
    image:
      'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=240&h=240&fit=crop&crop=faces',
  },
  {
    name: 'Marc T.',
    role: 'Professionnel en reconversion',
    quote:
      'La vie scolaire et les lives donnent un cadre pro. On sent l\'institution derrière le discours, pas juste des vidéos isolées.',
    image:
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=240&h=240&fit=crop&crop=faces',
  },
  {
    name: 'Aminata D.',
    role: 'Membre depuis 2 ans',
    quote:
      'La bibliothèque et la doctrine m\'ont permis de lier ce que je vivais depuis des années à une grille de lecture cohérente.',
    image:
      'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=240&h=240&fit=crop&crop=faces',
  },
  {
    name: 'Jean-Pierre L.',
    role: 'Cohorte Europe',
    quote:
      'Les lives LIRI et le suivi pédagogique donnent une vraie continuité entre les modules.',
    image:
      'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=240&h=240&fit=crop&crop=faces',
  },
  {
    name: 'Koumba S.',
    role: 'Élève ISNA',
    quote:
      'Enfin une grille qui relie culture, discipline et modernité sans simplifier la doctrine.',
    image:
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=240&h=240&fit=crop&crop=faces',
  },
];

function ParallaxOrbs() {
  const { scrollYProgress } = useScroll();
  const yA = useTransform(scrollYProgress, [0, 1], [0, -150]);
  const yB = useTransform(scrollYProgress, [0, 1], [0, 170]);
  const yC = useTransform(scrollYProgress, [0, 1], [0, -110]);
  const rays = useTransform(scrollYProgress, [0, 1], [0, 22]);
  return (
    <>
      <motion.div
        className="prs-orb absolute -left-20 top-16 h-80 w-80 rounded-full bg-[#6f4cff]"
        style={{ y: yA }}
        aria-hidden
      />
      <motion.div
        className="prs-orb alt absolute right-8 top-24 h-96 w-96 rounded-full bg-[#D4AF37]"
        style={{ y: yB }}
        aria-hidden
      />
      <motion.div
        className="prs-orb absolute bottom-12 left-1/3 h-80 w-80 rounded-full bg-[#0fb3ff]"
        style={{ y: yC }}
        aria-hidden
      />
      <motion.div className="prs-light-rays pointer-events-none absolute left-1/2 top-[6%] h-[135vh] w-[135vh] -translate-x-1/2 md:top-[4%]" style={{ rotate: rays }} aria-hidden />
    </>
  );
}

function AnimatedSection({ id, className, children, amount = 0.14 }) {
  const reduce = useReducedMotion();
  return (
    <motion.section
      id={id}
      className={`prs-section-shell ${className || ''}`}
      initial={reduce ? { opacity: 1, y: 0 } : { opacity: 0, y: 60 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount, margin: '-90px 0px -50px 0px' }}
      transition={{ duration: reduce ? 0 : 0.9, ease: easePremium }}
    >
      {children}
    </motion.section>
  );
}

function LiriPhoneOrbit({ reduce }) {
  return (
    <div className="relative mx-auto flex min-h-[280px] w-full max-w-[400px] items-center justify-center lg:min-h-[340px]">
      <motion.div
        className="absolute h-[min(88vw,420px)] w-[min(88vw,420px)] rounded-full border border-[#D4AF37]/20 bg-[radial-gradient(circle_at_50%_50%,rgba(212,175,55,0.14),transparent_62%)]"
        animate={reduce ? undefined : { scale: [1, 1.04, 1], opacity: [0.45, 0.75, 0.45] }}
        transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
        aria-hidden
      />
      <motion.div
        className="absolute h-[min(68vw,300px)] w-[min(68vw,300px)] rounded-full border border-white/10"
        animate={reduce ? undefined : { rotate: 360 }}
        transition={{ duration: 80, repeat: Infinity, ease: 'linear' }}
        aria-hidden
      >
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="absolute left-1/2 top-1/2 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-[#D4AF37]/35 bg-[#0c111d]/90 shadow-[0_0_24px_rgba(212,175,55,0.2)]"
            style={{
              transform: `rotate(${i * 60}deg) translateY(-118px) rotate(${-i * 60}deg)`,
            }}
          >
            <Users className="h-5 w-5 text-[#D4AF37]" />
          </div>
        ))}
      </motion.div>
      <motion.div
        className="relative z-[3] w-[155px] rounded-[2rem] border-2 border-[#D4AF37]/55 bg-gradient-to-b from-[#1a2234] via-[#121a2b] to-[#0a0f18] p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_28px_80px_rgba(0,0,0,0.55),0_0_60px_rgba(212,175,55,0.22)]"
        animate={reduce ? undefined : { y: [0, -12, 0] }}
        transition={{ duration: 5.5, repeat: Infinity, ease: 'easeInOut' }}
      >
        <div className="flex justify-center">
          <LiriWordmark size="kicker" className="text-[#D4AF37]" />
        </div>
        <div className="mt-3 space-y-2 rounded-xl bg-black/50 p-2 ring-1 ring-white/10">
          <div className="flex gap-1">
            <div className="h-1.5 flex-1 rounded-full bg-white/15" />
            <div className="h-1.5 w-6 rounded-full bg-[#D4AF37]/50" />
          </div>
          <div className="h-24 rounded-lg bg-gradient-to-br from-[#D4AF37]/25 via-[#6f4cff]/15 to-transparent ring-1 ring-[#D4AF37]/25" />
          <div className="h-2 w-2/3 rounded-full bg-white/10" />
          <div className="h-2 w-1/2 rounded-full bg-white/10" />
        </div>
        <p className="mt-2 text-center text-[9px] text-white/45">Live · SmartBoard · Replay</p>
      </motion.div>
      <div className="prs-halo-ring pointer-events-none absolute inset-0 z-[2] flex items-center justify-center" aria-hidden />
    </div>
  );
}

function LiriImmersiveBlock() {
  const reduce = useReducedMotion();
  const n = liriStudentKnowledge.length;

  const intro = (
    <div className="max-w-2xl text-white">
      <p className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.2em] text-[#D4AF37]">
        <span>Cours immersifs ·</span>
        <LiriWordmark size="kicker" className="text-[#D4AF37]" />
      </p>
      <h2 className="mt-3 font-serif text-3xl font-bold leading-tight text-white md:text-4xl">
        LIRI : la classe autour de l&apos;application
      </h2>
      <p className="mt-3 text-base font-medium text-white/80 md:text-lg">Ce que tout élève ISNA doit savoir</p>
      <p className="mt-4 text-sm leading-relaxed text-white/85 md:text-base">
        Les élèves tournent autour du vivier numérique : même salle virtuelle, même smartboard, même exigence
        qu&apos;en présentiel — avec studio, arène live et LIRI mobile pour rester dans le flux.
      </p>
    </div>
  );

  // Liste statique (pas de sticky / useScroll / motion sur les lignes) : évite sections invisibles sur Safari
  // et le fade-in `whileInView` qui peut rester à opacity 0 sur certains navigateurs.
  return (
    <div className="text-white">
      <div className="mb-10">{intro}</div>
      <div className="relative overflow-hidden rounded-[1.75rem] border border-white/[0.12] bg-gradient-to-b from-[#0b121f] via-[#070c14] to-[#04060c] px-5 py-8 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_28px_90px_rgba(0,0,0,0.5)] md:px-10 md:py-11">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 65% 42% at 50% 0%, rgba(212,175,55,0.08), transparent 58%), radial-gradient(ellipse 45% 38% at 85% 100%, rgba(111,76,255,0.07), transparent 52%), radial-gradient(ellipse 50% 35% at 10% 80%, rgba(15,179,255,0.05), transparent 50%)',
          }}
          aria-hidden
        />
        <div className="relative grid gap-10 lg:grid-cols-[1fr_auto] lg:items-start lg:gap-14">
          <div className="min-w-0" role="list" aria-label={`${n} points essentiels LIRI`}>
            <p className="mb-5 rounded-2xl border border-white/15 bg-white/[0.06] px-4 py-3 text-[11px] uppercase tracking-[0.18em] text-white/80">
              Les {n} points à connaître
            </p>
            <ul className="space-y-4 md:space-y-5">
              {liriStudentKnowledge.map((line, i) => (
                <li
                  key={line}
                  role="listitem"
                  className="rounded-2xl border border-white/15 bg-black/35 px-5 py-4 text-left md:px-6 md:py-5"
                >
                  <span className="mb-2 block text-[11px] font-bold uppercase tracking-[0.24em] text-[#D4AF37]">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <p className="m-0 text-base font-medium leading-relaxed text-white md:text-lg">{line}</p>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex justify-center lg:justify-end lg:pt-2">
            <LiriPhoneOrbit reduce={reduce} />
          </div>
        </div>
        <div className="relative mt-8 flex flex-wrap gap-3">
          <Link to="/m/eleve">
            <Button variant="outline" className="border-[#D4AF37]/45 text-[#D4AF37] hover:bg-[#D4AF37]/10">
              Ouvrir LIRI mobile
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

function TestimonialProfileCard({ t, index, reduce, marqueeLayout }) {
  const widthCls = marqueeLayout ? 'w-[min(88vw,19.5rem)] shrink-0' : 'w-full';
  const quoteEntrance = !reduce && !marqueeLayout;
  return (
    <motion.article
      layout={false}
      whileHover={reduce ? undefined : { y: -4, transition: { duration: 0.25, ease: easePremium } }}
      className={`flex flex-col rounded-2xl border border-white/10 bg-[#101729] p-6 prs-card-glow ${widthCls}`}
    >
      <div className="flex flex-col items-center text-center">
        <motion.div
          className="relative mb-4 h-[4.5rem] w-[4.5rem] shrink-0 overflow-hidden rounded-full shadow-[0_0_0_2px_rgba(212,175,55,0.45),0_12px_32px_rgba(0,0,0,0.45)]"
          animate={
            reduce
              ? undefined
              : {
                  scale: [1, 1.06, 1],
                  y: [0, -3, 0],
                }
          }
          transition={{
            duration: 4.2 + (index % 4) * 0.35,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: (index % 7) * 0.22,
          }}
        >
          <img
            src={t.image}
            alt=""
            width={144}
            height={144}
            className="h-full w-full object-cover"
            loading="lazy"
            decoding="async"
          />
        </motion.div>
        <motion.span
          className="prs-quote-mark -mt-1 mb-1 block select-none"
          aria-hidden
          initial={quoteEntrance ? { opacity: 0, scale: 0.5, y: 8 } : false}
          whileInView={quoteEntrance ? { opacity: 1, scale: 1, y: 0 } : undefined}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.45, ease: easePremium }}
        >
          &ldquo;
        </motion.span>
        <div className="mb-3 flex justify-center gap-0.5 text-[#D4AF37]">
          {[0, 1, 2, 3, 4].map((s) => (
            <Star key={s} className="h-3.5 w-3.5 fill-current md:h-4 md:w-4" />
          ))}
        </div>
        <p className="text-sm leading-relaxed text-white/82">{t.quote}</p>
        <div className="mt-5 w-full border-t border-white/10 pt-4">
          <p className="text-sm font-semibold text-white">{t.name}</p>
          <p className="text-xs text-white/60">{t.role}</p>
        </div>
      </div>
    </motion.article>
  );
}

function TestimonialsMarqueeBlock({ reduce }) {
  const loop = useMemo(() => [...testimonialMembers, ...testimonialMembers], []);

  if (reduce) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {testimonialMembers.map((t, idx) => (
          <TestimonialProfileCard key={t.name} t={t} index={idx} reduce marqueeLayout={false} />
        ))}
      </div>
    );
  }

  return (
    <div
      className="prs-temoignage-marquee-wrap relative -mx-2 overflow-hidden px-2 md:-mx-4 md:px-4"
      role="region"
      aria-label="Témoignages membres ISNA"
    >
      <div className="prs-temoignage-marquee-track">
        {loop.map((t, i) => (
          <TestimonialProfileCard key={`${t.name}-${i}`} t={t} index={i} reduce={false} marqueeLayout />
        ))}
      </div>
    </div>
  );
}

const bentoStaggerItem = {
  hidden: { opacity: 0, y: 26 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: easePremium } },
};
const bentoStaggerContainer = (stagger = 0.09) => ({
  hidden: {},
  visible: { transition: { staggerChildren: stagger, delayChildren: 0.04 } },
});

function ProduitBentoCard({ item, variant = 'light', ctaLabel, href, children, compact = false }) {
  if (!item) return null;
  const Icon = item.icon;
  const dark = variant === 'dark';
  return (
    <div
      className={`flex h-full flex-col rounded-2xl border p-5 md:rounded-3xl md:p-6 ${
        compact ? 'p-4 md:p-5' : ''
      } ${
        dark
          ? 'border-[#D4AF37]/28 bg-[#060a11] shadow-[inset_0_1px_0_rgba(212,175,55,0.14)]'
          : 'border-white/10 bg-[#131b2d]/98 shadow-[0_20px_60px_rgba(0,0,0,0.35)]'
      }`}
    >
      <div
        className={`mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl md:mb-4 md:h-12 md:w-12 ${
          dark ? 'bg-[#D4AF37]/14 text-[#D4AF37]' : 'bg-[#6f4cff]/14 text-[#b8a9ff]'
        }`}
      >
        <Icon className={`h-5 w-5 ${compact ? '' : 'md:h-6 md:w-6'}`} />
      </div>
      <h3
        className={`font-semibold leading-snug ${compact ? 'text-sm md:text-[15px]' : 'text-[15px] md:text-base'} ${
          dark ? 'text-white' : 'text-white/95'
        }`}
      >
        {item.title}
      </h3>
      <p
        className={`mt-2 flex-1 leading-relaxed ${compact ? 'text-xs md:text-[13px]' : 'text-sm'} ${
          dark ? 'text-white/62' : 'text-white/68'
        }`}
      >
        {item.description}
      </p>
      {children}
      {href && ctaLabel ? (
        <Link
          to={href}
          className="mt-4 inline-flex items-center text-sm font-medium text-[#D4AF37] transition-colors hover:text-[#ebca5e]"
        >
          {ctaLabel}
          <ChevronRight className="ml-0.5 h-4 w-4 shrink-0" />
        </Link>
      ) : null}
    </div>
  );
}

function ProduitBentoGrid({ prefersReducedMotion: reduce }) {
  const communaute = produitFind('Communauté & vie scolaire');
  const bibliotheque = produitFind('Bibliothèque & doctrine');
  const forfaits = produitFind('Forfaits & inscription');
  const cursus = produitFind('ISNA — 21 sciences & 4 cycles');
  const lives = produitFind('Lives, agenda & événements');
  const liri = produitFind('LIRI sur mobile');
  const accompagnement = produitFind('Accompagnement humain');
  const pages = produitFind('Pages publiques & doctrine');

  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rotateX = useSpring(useTransform(my, [-0.5, 0.5], [5, -5]), { stiffness: 280, damping: 32 });
  const rotateY = useSpring(useTransform(mx, [-0.5, 0.5], [-6, 6]), { stiffness: 280, damping: 32 });
  const onHeroMove = (e) => {
    if (reduce) return;
    const r = e.currentTarget.getBoundingClientRect();
    mx.set((e.clientX - r.left) / r.width - 0.5);
    my.set((e.clientY - r.top) / r.height - 0.5);
  };
  const onHeroLeave = () => {
    mx.set(0);
    my.set(0);
  };

  const st = reduce ? 0 : 0.08;

  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-0 prs-bento-surface opacity-40" aria-hidden />
      <div className="relative mx-auto grid max-w-7xl grid-cols-1 gap-4 md:gap-5 lg:grid-cols-12">
        <motion.div
          className="flex flex-col gap-4 md:gap-5 lg:col-span-3"
          variants={bentoStaggerContainer(st)}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.12, margin: '-0px 0px -80px 0px' }}
        >
          <motion.div variants={bentoStaggerItem}>
            <ProduitBentoCard item={communaute}>
              <Link to="/signup" className="mt-4 block">
                <Button className="h-10 w-full bg-[#D4AF37] text-sm font-semibold text-black hover:bg-[#ebca5e] md:w-auto md:px-6">
                  Échanges initiatiques
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link
                to="/signup"
                className="mt-3 inline-flex items-center text-sm font-medium text-[#D4AF37] hover:text-[#ebca5e]"
              >
                Ouvrir l&apos;espace membre
                <ChevronRight className="ml-0.5 h-4 w-4" />
              </Link>
            </ProduitBentoCard>
          </motion.div>
          <motion.div variants={bentoStaggerItem}>
            <ProduitBentoCard item={bibliotheque} ctaLabel="Accéder à la connaissance" href="/bibliotheque" />
          </motion.div>
          <motion.div variants={bentoStaggerItem}>
            <ProduitBentoCard item={forfaits} variant="dark" ctaLabel="Activer un forfait" href="/forfaits" />
          </motion.div>
        </motion.div>

        <motion.div
          className="lg:col-span-6"
          variants={bentoStaggerItem}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.12 }}
        >
          <motion.div
            className="overflow-hidden rounded-2xl border border-white/12 bg-[#0e1524] shadow-[0_32px_100px_rgba(0,0,0,0.45)] md:rounded-3xl"
            style={{
              rotateX: reduce ? 0 : rotateX,
              rotateY: reduce ? 0 : rotateY,
              transformPerspective: 1200,
            }}
            onPointerMove={onHeroMove}
            onPointerLeave={onHeroLeave}
          >
            <div className="prs-bento-dash-mock relative px-4 pb-5 pt-4 md:px-6 md:pt-5">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">
                  {`Cursus officiel ${SCHOOL}`}
                </span>
                <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-300/95">
                  Parcours actif
                </span>
              </div>
              <p className="text-sm font-semibold text-white/90">Cycle 1 — Fondements</p>
              <div className="mt-4 space-y-3">
                {[
                  { label: 'Ontologie & cadre', pct: 72 },
                  { label: 'Sciences invisibles', pct: 45 },
                  { label: 'Mise en pratique', pct: 88 },
                ].map((row) => (
                  <div key={row.label}>
                    <div className="mb-1 flex justify-between text-[11px] text-white/50">
                      <span>{row.label}</span>
                      <span>{row.pct}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-white/[0.08]">
                      <motion.div
                        className="h-full rounded-full bg-gradient-to-r from-[#D4AF37] to-[#6f4cff]"
                        initial={reduce ? false : { width: 0 }}
                        whileInView={{ width: `${row.pct}%` }}
                        viewport={{ once: true, amount: 0.6 }}
                        transition={{ duration: 0.9, ease: easePremium, delay: 0.15 }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="border-t border-white/10 bg-white/[0.035] px-4 py-5 md:px-7 md:py-7">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#D4AF37]/85">
                {cursus?.title}
              </p>
              <h3 className="mt-2 text-xl font-bold leading-tight text-white md:text-2xl">{`Cursus officiel ${SCHOOL}`}</h3>
              <p className="mt-2 text-sm leading-relaxed text-white/65">
                21 sciences, 4 cycles, une progression initiatique claire — du fondement à la maîtrise.
              </p>
              <ul className="mt-5 space-y-2.5 text-sm text-white/78">
                <li className="flex gap-2">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[#D4AF37]" />
                  Curriculum structuré : fondations → sciences invisibles → maîtrise.
                </li>
                <li className="flex gap-2">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[#D4AF37]" />
                  Lives, replays et classe immersive (LIRI) selon ton forfait.
                </li>
                <li className="flex gap-2">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[#D4AF37]" />
                  Suivi des modules, évaluations et visibilité sur ta progression.
                </li>
              </ul>
              <Link to="/ecoles" className="mt-6 inline-block">
                <Button className="h-11 bg-[#1a2334] px-6 font-semibold text-white ring-1 ring-white/15 hover:bg-[#232e44]">
                  Découverte du parcours
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </motion.div>
        </motion.div>

        <motion.div
          className="flex flex-col gap-4 md:gap-5 lg:col-span-3"
          variants={bentoStaggerContainer(st)}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.12, margin: '-0px 0px -80px 0px' }}
        >
          <motion.div variants={bentoStaggerItem}>
            <ProduitBentoCard item={lives}>
              <ul className="mt-3 space-y-1.5 text-sm text-white/65">
                <li className="flex gap-2">
                  <span className="text-[#D4AF37]">·</span>
                  Classes en live & replays
                </li>
                <li className="flex gap-2">
                  <span className="text-[#D4AF37]">·</span>
                  Agenda ISNA & événements
                </li>
              </ul>
              <div className="mt-4 flex flex-col gap-2">
                <Link to="/appointment/request?source=prorascience-bento-lives">
                  <Button
                    variant="outline"
                    className="h-10 w-full border-white/20 bg-white/[0.04] text-sm text-white hover:bg-white/10"
                  >
                    Rendez-vous & rituels
                  </Button>
                </Link>
                <Link
                  to="/formations/catalogue"
                  className="inline-flex items-center text-sm font-medium text-[#D4AF37] hover:text-[#ebca5e]"
                >
                  Catalogue & agenda
                  <ChevronRight className="ml-0.5 h-4 w-4" />
                </Link>
              </div>
            </ProduitBentoCard>
          </motion.div>
          <motion.div variants={bentoStaggerItem}>
            <ProduitBentoCard item={liri} ctaLabel="Emporte ISNA partout" href="/m/eleve" />
          </motion.div>
          <motion.div variants={bentoStaggerItem} className="grid grid-cols-2 gap-3 md:gap-4">
            <ProduitBentoCard
              item={accompagnement}
              variant="dark"
              compact
              ctaLabel="Secrétariat"
              href="/appointment/request?source=prorascience-bento"
            />
            <ProduitBentoCard item={pages} variant="dark" compact ctaLabel="Pages publiques" href="/a-propos" />
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}

const ProrascienceCommercialPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const forceWebVitrine =
    new URLSearchParams(location.search).get(VITRINE_WEB_QUERY) === VITRINE_WEB_VALUE;

  const redirectMobileWebToLiriOff =
    import.meta.env.VITE_REDIRECT_MOBILE_WEB_TO_ELEVE === '0'
    || import.meta.env.VITE_REDIRECT_MOBILE_WEB_TO_ELEVE === 'false';

  /** Largeur max 767px = mobile (coque LIRI) ; 768px et plus = page vitrine web (PC / grand écran). Synchro à la rotation. */
  const [isNarrowViewport, setIsNarrowViewport] = useState(
    () =>
      typeof window !== 'undefined'
      && (window.matchMedia('(max-width: 767px)').matches ?? window.innerWidth < 768),
  );
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const mq = window.matchMedia('(max-width: 767px)');
    const onChange = () => setIsNarrowViewport(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const isWebMobileNotNative =
    typeof window !== 'undefined' && !Capacitor.isNativePlatform() && isNarrowViewport;
  const shouldOpenLiriShellInWebView =
    !forceWebVitrine
    && typeof window !== 'undefined'
    && Capacitor.isNativePlatform();
  /** Téléphone (navigateur) : même coque LIRI que l'appli; PC large : on reste sur la vitrine web. */
  const shouldRedirectWebMobileToEleveEntry =
    !forceWebVitrine
    && !redirectMobileWebToLiriOff
    && isWebMobileNotNative;

  useEffect(() => {
    if (shouldOpenLiriShellInWebView) {
      navigate(ELEVE_MOBILE.prorascience, { replace: true });
      return;
    }
    if (shouldRedirectWebMobileToEleveEntry) {
      navigate(ELEVE_MOBILE.prorascience, { replace: true });
    }
  }, [navigate, shouldOpenLiriShellInWebView, shouldRedirectWebMobileToEleveEntry]);

  const prefersReducedMotion = useReducedMotion();
  // Désactivé pour améliorer les performances - progressScale non critique
  // const { scrollY, scrollYProgress } = useScroll();
  // const progressScale = useSpring(scrollYProgress, { stiffness: 140, damping: 32, mass: 0.28 });
  const [navSolid, setNavSolid] = useState(false);
  // Simplifié pour éviter useMotionValueEvent coûteux
  // useMotionValueEvent(scrollY, 'change', (latest) => {
  //   setNavSolid(latest > 32);
  // });

  const [inPageNavTransition, setInPageNavTransition] = useState(false);

  const completeInPageNav = useCallback((el) => {
    flashNavTargetElement(el);
    setInPageNavTransition(false);
  }, []);

  const onInPageNavClick = useCallback(
    (sectionId) => (e) => {
      e.preventDefault();
      if (prefersReducedMotion) {
        smoothScrollToSectionId(sectionId, {
          reducedMotion: true,
          onComplete: completeInPageNav,
        });
        return;
      }
      setInPageNavTransition(true);
      window.setTimeout(() => {
        smoothScrollToSectionId(sectionId, {
          reducedMotion: false,
          onComplete: completeInPageNav,
        });
      }, 200);
    },
    [prefersReducedMotion, completeInPageNav],
  );

  const scrollToVideo = useCallback(() => {
    smoothScrollToSectionId('video-ecole', {
      reducedMotion: prefersReducedMotion,
      onComplete: (el) => flashNavTargetElement(el),
    });
  }, [prefersReducedMotion]);

  useEffect(() => {
    const hash = window.location.hash?.replace(/^#/, '').trim();
    if (!hash) return;
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;
    const t = window.setTimeout(() => {
      if (!document.getElementById(hash)) return;
      smoothScrollToSectionId(hash, {
        reducedMotion: reduceMotion,
        onComplete: (el) => flashNavTargetElement(el),
      });
    }, 120);
    return () => window.clearTimeout(t);
  }, []);

  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const rotateX = useSpring(useTransform(mouseY, [-0.5, 0.5], [4.5, -4.5]), { stiffness: 260, damping: 30 });
  const rotateY = useSpring(useTransform(mouseX, [-0.5, 0.5], [-5.5, 5.5]), { stiffness: 260, damping: 30 });

  const onHeroPointerMove = (e) => {
    if (prefersReducedMotion) return;
    const r = e.currentTarget.getBoundingClientRect();
    mouseX.set((e.clientX - r.left) / r.width - 0.5);
    mouseY.set((e.clientY - r.top) / r.height - 0.5);
  };
  const onHeroPointerLeave = () => {
    mouseX.set(0);
    mouseY.set(0);
  };

  if (shouldOpenLiriShellInWebView || shouldRedirectWebMobileToEleveEntry) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-[#0B0B0F] text-white">
        <div className="flex flex-col items-center gap-3 text-white/60">
          <LiriWordmark size="compact" className="text-[#D4AF37]/90" />
          <p className="text-[12px]">Ouverture LIRI…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="prs-live-site relative min-h-screen overflow-x-hidden bg-[#070b12] text-white">
      <SEO
        title={`${SCHOOL} — ${SCHOOL_FULL}`}
        description={`${SCHOOL_FULL} : cosmologie et science métaphysique du 5ᵉ Manikongo. Parcours structurés, 21 sciences, 4 cycles, bibliothèque, lives LIRI, coaching et mentorat.`}
        canonical={`${PUBLIC_SITE}/`}
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'EducationalOrganization',
          name: `${SCHOOL} · LIRI`,
          url: `${PUBLIC_SITE}/`,
          description: `${SCHOOL_FULL} : 21 sciences, doctrine, formations, vie scolaire et accompagnement.`,
          inLanguage: 'fr',
        }}
      />

      <style>{`
        .prs-bg-grid {
          background-image:
            linear-gradient(to right, rgba(255,255,255,0.04) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255,255,255,0.04) 1px, transparent 1px);
          background-size: 36px 36px;
          mask-image: radial-gradient(ellipse at center, black 45%, transparent 100%);
        }
        .prs-orb {
          filter: blur(72px);
          opacity: .24;
          animation: prsFloat 12s ease-in-out infinite;
        }
        .prs-orb.alt {
          animation-duration: 15s;
          animation-delay: -2s;
        }
        @keyframes prsFloat {
          0%, 100% { transform: translate3d(0, 0, 0) scale(1); }
          50% { transform: translate3d(0, -22px, 0) scale(1.08); }
        }
        .prs-glass {
          background: linear-gradient(180deg, rgba(255,255,255,.09), rgba(255,255,255,.03));
          backdrop-filter: blur(10px);
        }
        .prs-hero-img {
          transform: scale(1);
          transition: transform 12s ease-in-out;
        }
        @media (hover: hover) {
          .prs-hero-frame:hover .prs-hero-img {
            transform: scale(1.06);
          }
        }
        .prs-gallery-card img {
          transition: transform 0.7s ease, filter 0.5s ease;
        }
        @media (hover: hover) {
          .prs-gallery-card:hover img {
            transform: scale(1.05);
            filter: brightness(1.08);
          }
        }
        .prs-light-rays {
          background: conic-gradient(
            from 210deg at 50% 45%,
            transparent 0deg,
            rgba(212, 175, 55, 0.14) 40deg,
            transparent 78deg,
            rgba(111, 76, 255, 0.12) 130deg,
            transparent 175deg,
            rgba(15, 179, 255, 0.12) 240deg,
            transparent 300deg,
            rgba(212, 175, 55, 0.08) 340deg,
            transparent 360deg
          );
          opacity: 0.38;
          filter: blur(1px);
          mask-image: radial-gradient(ellipse 55% 50% at 50% 42%, black 0%, transparent 72%);
        }
        .prs-halo-ring {
          background: radial-gradient(circle at 50% 50%, rgba(212, 175, 55, 0.2) 0%, transparent 42%);
          animation: prsHaloBreathe 6s ease-in-out infinite;
        }
        @keyframes prsHaloBreathe {
          0%, 100% { opacity: 0.5; transform: scale(0.92); }
          50% { opacity: 0.85; transform: scale(1.05); }
        }
        .prs-card-glow {
          box-shadow: 0 0 0 1px rgba(212, 175, 55, 0.12), 0 20px 50px rgba(0, 0, 0, 0.45);
          transition: box-shadow 0.5s ease, border-color 0.5s ease, transform 0.5s ease;
        }
        @media (hover: hover) {
          .prs-card-glow:hover {
            box-shadow: 0 0 0 1px rgba(212, 175, 55, 0.35), 0 28px 70px rgba(212, 175, 55, 0.12);
            transform: translateY(-3px);
          }
        }
        .prs-temoignage-marquee-wrap::before,
        .prs-temoignage-marquee-wrap::after {
          content: '';
          position: absolute;
          top: 0;
          bottom: 0;
          width: 2.5rem;
          z-index: 2;
          pointer-events: none;
        }
        .prs-temoignage-marquee-wrap::before {
          left: 0;
          background: linear-gradient(90deg, rgb(7, 11, 18) 0%, transparent 100%);
        }
        .prs-temoignage-marquee-wrap::after {
          right: 0;
          background: linear-gradient(270deg, rgb(7, 11, 18) 0%, transparent 100%);
        }
        @keyframes prsTemoignageMarquee {
          0% { transform: translate3d(0, 0, 0); }
          100% { transform: translate3d(-50%, 0, 0); }
        }
        .prs-temoignage-marquee-track {
          display: flex;
          width: max-content;
          gap: 1.25rem;
          padding: 0.25rem 0;
          animation: prsTemoignageMarquee 48s linear infinite;
          will-change: transform;
        }
        .prs-temoignage-marquee-wrap:hover .prs-temoignage-marquee-track {
          animation-play-state: paused;
        }
        @media (prefers-reduced-motion: reduce) {
          .prs-temoignage-marquee-track {
            animation: none;
            width: auto;
          }
        }
        .prs-bg-flow {
          background: linear-gradient(
            128deg,
            rgba(111, 76, 255, 0.09) 0%,
            transparent 32%,
            rgba(15, 179, 255, 0.07) 48%,
            transparent 72%,
            rgba(212, 175, 55, 0.07) 100%
          );
          background-size: 420% 420%;
          animation: prsFlowGrad 26s ease-in-out infinite;
        }
        @keyframes prsFlowGrad {
          0%, 100% { background-position: 0% 40%; }
          50% { background-position: 100% 60%; }
        }
        .prs-dust {
          background-image: radial-gradient(circle, rgba(255,255,255,0.045) 1px, transparent 1px);
          background-size: 48px 48px;
          opacity: 0.35;
          animation: prsDustDrift 90s linear infinite;
        }
        @keyframes prsDustDrift {
          from { transform: translate3d(0, 0, 0); }
          to { transform: translate3d(-48px, -24px, 0); }
        }
        .prs-brand-shimmer {
          position: relative;
          background: linear-gradient(102deg, #c9a030 0%, #fff4c8 38%, #d4af37 62%, #8a7228 100%);
          background-size: 220% auto;
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          -webkit-text-fill-color: transparent;
          animation: prsShimmer 4.5s ease-in-out infinite;
        }
        @keyframes prsShimmer {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        .prs-underline-gold {
          bottom: -0.1em;
          height: 2px;
          border-radius: 2px;
          background: linear-gradient(90deg, transparent, #d4af37, transparent);
          transform: scaleX(0);
          transform-origin: left center;
          animation: prsUnderlineGrow 1.1s cubic-bezier(0.22, 1, 0.36, 1) 0.75s forwards;
        }
        @keyframes prsUnderlineGrow {
          to { transform: scaleX(1); }
        }
        .prs-nav-solid {
          background-color: rgba(7, 11, 18, 0.88) !important;
          border-bottom-color: rgba(255, 255, 255, 0.12);
          box-shadow: 0 12px 40px rgba(0, 0, 0, 0.35);
        }
        .prs-nav-link {
          position: relative;
        }
        .prs-nav-link::after {
          content: '';
          position: absolute;
          left: 0;
          bottom: -3px;
          width: 0;
          height: 1px;
          background: #d4af37;
          transition: width 0.35s cubic-bezier(0.22, 1, 0.36, 1);
        }
        @media (hover: hover) {
          .prs-nav-link:hover::after {
            width: 100%;
          }
          .prs-nav-link:hover {
            letter-spacing: 0.02em;
          }
        }
        .prs-cta-primary.ring-offset-0 {
          box-shadow: 0 6px 28px rgba(212, 175, 55, 0.35);
        }
        @media (hover: hover) {
          .prs-cta-primary:hover {
            box-shadow: 0 10px 42px rgba(212, 175, 55, 0.48);
            filter: brightness(1.06);
          }
        }
        .prs-cta-ghost {
          position: relative;
          overflow: hidden;
          transition: letter-spacing 0.35s ease, border-color 0.35s ease, background-color 0.35s ease;
        }
        .prs-cta-ghost::before {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: inherit;
          padding: 1px;
          background: linear-gradient(
            105deg,
            transparent 20%,
            rgba(212, 175, 55, 0.55) 50%,
            transparent 80%
          );
          background-size: 260% 100%;
          -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          opacity: 0;
          animation: prsBorderTravel 3.5s linear infinite;
          pointer-events: none;
        }
        @keyframes prsBorderTravel {
          0% { background-position: 120% 0; }
          100% { background-position: -120% 0; }
        }
        @media (hover: hover) {
          .prs-cta-ghost:hover::before {
            opacity: 1;
          }
          .prs-cta-ghost:hover {
            letter-spacing: 0.04em;
          }
        }
        .prs-hero-chassis {
          transform-style: preserve-3d;
          perspective: 1400px;
        }
        .prs-glass-sweep {
          pointer-events: none;
          overflow: hidden;
        }
        .prs-glass-sweep::after {
          content: '';
          position: absolute;
          inset: -40%;
          background: linear-gradient(
            115deg,
            transparent 35%,
            rgba(255, 255, 255, 0.07) 48%,
            transparent 60%
          );
          transform: translateX(-60%) rotate(12deg);
          animation: prsGlassSweep 7s ease-in-out infinite;
        }
        @keyframes prsGlassSweep {
          0%, 100% { transform: translateX(-75%) rotate(12deg); }
          50% { transform: translateX(55%) rotate(12deg); }
        }
        .prs-video-chassis {
          animation: prsBreathBorder 5.5s ease-in-out infinite;
        }
        @keyframes prsBreathBorder {
          0%, 100% { box-shadow: 0 0 0 1px rgba(212, 175, 55, 0.2), 0 24px 80px rgba(0, 0, 0, 0.45); }
          50% { box-shadow: 0 0 0 1px rgba(212, 175, 55, 0.42), 0 32px 100px rgba(212, 175, 55, 0.12); }
        }
        .prs-live-dot {
          animation: prsLiveBlink 1.4s ease-in-out infinite;
        }
        @keyframes prsLiveBlink {
          0%, 100% { opacity: 1; transform: scale(1); box-shadow: 0 0 0 0 rgba(248, 113, 113, 0.5); }
          50% { opacity: 0.65; transform: scale(0.92); box-shadow: 0 0 0 6px rgba(248, 113, 113, 0); }
        }
        .prs-wave-bar {
          transform-origin: bottom center;
          animation: prsWave 0.95s ease-in-out infinite;
        }
        .prs-wave-bar:nth-child(2) { animation-delay: 0.12s; }
        .prs-wave-bar:nth-child(3) { animation-delay: 0.24s; }
        .prs-wave-bar:nth-child(4) { animation-delay: 0.08s; }
        @keyframes prsWave {
          0%, 100% { transform: scaleY(0.35); }
          50% { transform: scaleY(1); }
        }
        .prs-quote-mark {
          font-family: Georgia, serif;
          font-size: 3.5rem;
          line-height: 1;
          background: linear-gradient(180deg, rgba(212, 175, 55, 0.45), rgba(212, 175, 55, 0.08));
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }
        .prs-aurora-wrap {
          position: relative;
          overflow: hidden;
        }
        .prs-aurora-wrap::before {
          content: '';
          position: absolute;
          inset: -20% -40%;
          background:
            radial-gradient(ellipse 50% 40% at 20% 40%, rgba(111, 76, 255, 0.22), transparent 55%),
            radial-gradient(ellipse 45% 45% at 80% 60%, rgba(15, 179, 255, 0.18), transparent 50%),
            radial-gradient(ellipse 40% 35% at 50% 80%, rgba(212, 175, 55, 0.16), transparent 55%);
          animation: prsAurora 14s ease-in-out infinite;
          pointer-events: none;
        }
        @keyframes prsAurora {
          0%, 100% { transform: translate3d(-4%, 0, 0) scale(1); opacity: 0.9; }
          33% { transform: translate3d(3%, -3%, 0) scale(1.04); opacity: 1; }
          66% { transform: translate3d(2%, 4%, 0) scale(0.98); opacity: 0.85; }
        }
        .prs-aurora-content {
          position: relative;
          z-index: 1;
        }
        .prs-key-glow {
          text-shadow: 0 0 28px rgba(212, 175, 55, 0.35);
          background: linear-gradient(90deg, rgba(255,255,255,0.95), #f5e7b8, rgba(255,255,255,0.92));
          background-size: 200% auto;
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          -webkit-text-fill-color: transparent;
          animation: prsHighlightSweep 5s ease-in-out infinite;
        }
        @keyframes prsHighlightSweep {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        .prs-bento-surface {
          background-image:
            linear-gradient(to right, rgba(255, 255, 255, 0.03) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
          background-size: 44px 44px;
          mask-image: radial-gradient(ellipse 75% 65% at 50% 40%, black 0%, transparent 100%);
        }
        .prs-bento-dash-mock {
          background: linear-gradient(180deg, #0d1424 0%, #0a101c 100%);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06);
        }
        .prs-live-progress {
          background: linear-gradient(90deg, rgba(111, 76, 255, 0.95), rgba(212, 175, 55, 0.98), rgba(15, 179, 255, 0.9));
          box-shadow: 0 0 18px rgba(212, 175, 55, 0.35), 0 0 42px rgba(111, 76, 255, 0.25);
        }
        .prs-stars-deep {
          opacity: 0.34;
          background-image:
            radial-gradient(circle at 18% 22%, rgba(255,255,255,0.2) 0.6px, transparent 1px),
            radial-gradient(circle at 74% 18%, rgba(255,255,255,0.17) 0.7px, transparent 1.2px),
            radial-gradient(circle at 42% 78%, rgba(255,255,255,0.15) 0.6px, transparent 1px),
            radial-gradient(circle at 88% 68%, rgba(255,255,255,0.18) 0.7px, transparent 1.2px);
          background-size: 280px 280px, 320px 320px, 260px 260px, 300px 300px;
          animation: prsStarsDrift 90s linear infinite;
        }
        @keyframes prsStarsDrift {
          from { transform: translate3d(0, 0, 0); }
          to { transform: translate3d(-60px, -36px, 0); }
        }
        .prs-vital-sheen {
          background:
            radial-gradient(ellipse 45% 26% at 50% 2%, rgba(212, 175, 55, 0.09), transparent 62%),
            radial-gradient(ellipse 32% 22% at 14% 36%, rgba(111, 76, 255, 0.1), transparent 65%),
            radial-gradient(ellipse 32% 22% at 86% 62%, rgba(15, 179, 255, 0.08), transparent 65%);
          animation: prsVitalSway 18s ease-in-out infinite;
        }
        @keyframes prsVitalSway {
          0%, 100% { transform: translate3d(0, 0, 0) scale(1); opacity: 0.95; }
          50% { transform: translate3d(0, -1.8%, 0) scale(1.015); opacity: 1; }
        }
        .prs-live-site .prs-section-shell {
          position: relative;
          isolation: isolate;
        }
        .prs-live-site .prs-section-shell::after {
          content: '';
          position: absolute;
          left: 4%;
          right: 4%;
          bottom: 0;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(212, 175, 55, 0.38), transparent);
          opacity: 0.42;
          pointer-events: none;
        }
        .prs-live-site .prs-section-shell > div {
          position: relative;
          z-index: 1;
        }
        .prs-live-site h2,
        .prs-live-site h3 {
          letter-spacing: -0.01em;
        }
        .prs-live-site .rounded-2xl.border,
        .prs-live-site .rounded-3xl.border {
          box-shadow: 0 16px 45px rgba(0, 0, 0, 0.3);
        }
        @keyframes prsNavTargetFlash {
          0% {
            box-shadow: inset 0 0 0 0 rgba(212, 175, 55, 0), 0 0 0 0 rgba(212, 175, 55, 0);
          }
          28% {
            box-shadow:
              inset 0 0 0 2px rgba(212, 175, 55, 0.55),
              0 0 72px rgba(212, 175, 55, 0.12);
          }
          100% {
            box-shadow: inset 0 0 0 0 rgba(212, 175, 55, 0), 0 0 0 0 rgba(212, 175, 55, 0);
          }
        }
        .prs-nav-target-flash {
          animation: prsNavTargetFlash 0.95s cubic-bezier(0.22, 1, 0.36, 1) forwards;
          position: relative;
          z-index: 4;
        }
        @media (prefers-reduced-motion: reduce) {
          .prs-nav-target-flash {
            animation: none !important;
          }
          .prs-bg-flow, .prs-dust, .prs-brand-shimmer, .prs-glass-sweep::after, .prs-video-chassis,
          .prs-live-dot, .prs-wave-bar, .prs-aurora-wrap::before, .prs-key-glow, .prs-cta-ghost::before,
          .prs-stars-deep, .prs-vital-sheen {
            animation: none !important;
          }
          .prs-underline-gold {
            animation: none;
            transform: scaleX(1);
          }
          .prs-brand-shimmer {
            color: #d4af37;
            -webkit-text-fill-color: #d4af37;
            background: none;
          }
          .prs-key-glow {
            color: rgba(255, 255, 255, 0.92);
            -webkit-text-fill-color: rgba(255, 255, 255, 0.92);
            background: none;
            text-shadow: none;
          }
        }
      `}</style>

      {/* Barre de progression désactivée pour améliorer les performances */}
      {/* <motion.div
        className="prs-live-progress fixed left-0 right-0 top-0 z-[100] h-[2px] origin-left"
        style={{ scaleX: progressScale }}
        aria-hidden
      /> */}
      <div className="pointer-events-none absolute inset-0 z-0 prs-bg-grid" />
      <div className="pointer-events-none absolute inset-0 z-0 prs-stars-deep" aria-hidden />
      <div className="pointer-events-none absolute inset-0 z-0 prs-bg-flow" aria-hidden />
      <div className="pointer-events-none absolute inset-0 z-0 prs-vital-sheen" aria-hidden />
      <div className="pointer-events-none absolute inset-0 z-0 prs-dust" aria-hidden />
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <ParallaxOrbs />
      </div>

      <div className="relative z-[2]">
      <motion.header
        className={`sticky top-0 z-[60] border-b backdrop-blur-md transition-[background-color,box-shadow,border-color] duration-500 ${
          navSolid ? 'prs-nav-solid border-white/12' : 'border-white/8 bg-[#070b12]/58'
        }`}
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.65, ease: easePremium }}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2 text-sm font-semibold tracking-wide text-white/90">
            <motion.span
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#D4AF37] text-black"
              initial={{ boxShadow: '0 0 0 0 rgba(212,175,55,0)' }}
              animate={
                prefersReducedMotion
                  ? {}
                  : {
                      boxShadow: [
                        '0 0 0 0 rgba(212,175,55,0)',
                        '0 0 24px 2px rgba(212,175,55,0.45)',
                        '0 0 0 0 rgba(212,175,55,0)',
                      ],
                    }
              }
              transition={{ duration: 2.4, times: [0, 0.45, 1], delay: 0.35 }}
            >
              I
            </motion.span>
            {`${SCHOOL} · LIRI`}
          </Link>
          <div className="hidden items-center gap-7 text-sm text-white/75 md:flex">
            <a href="#fondateur" className="prs-nav-link hover:text-white" onClick={onInPageNavClick('fondateur')}>
              Fondateur
            </a>
            <a href="#liri" className="prs-nav-link hover:text-white" onClick={onInPageNavClick('liri')}>
              LIRI
            </a>
            <a href="#video-ecole" className="prs-nav-link hover:text-white" onClick={onInPageNavClick('video-ecole')}>
              Vidéo
            </a>
            <a href="#communaute" className="prs-nav-link hover:text-white" onClick={onInPageNavClick('communaute')}>
              Communauté
            </a>
            <a href="#produit" className="prs-nav-link hover:text-white" onClick={onInPageNavClick('produit')}>
              L&apos;école
            </a>
            <a href="#temoignages" className="prs-nav-link hover:text-white" onClick={onInPageNavClick('temoignages')}>
              Témoignages
            </a>
            <a href="#tarifs" className="prs-nav-link hover:text-white" onClick={onInPageNavClick('tarifs')}>
              Rejoindre
            </a>
          </div>
          <div className="flex items-center gap-2">
            <PremiumPressable>
              <Button variant="ghost" className="text-white/85 hover:bg-white/10" asChild>
                <Link to={getLiriMemberLoginPath()} title="Se connecter à LIRI (espace membre)">
                  Connexion
                </Link>
              </Button>
            </PremiumPressable>
            <PremiumPressable>
              <Button className="prs-cta-primary bg-[#D4AF37] text-black hover:bg-[#ebca5e]" asChild>
                <Link to="/signup">Rejoindre l&apos;ISNA</Link>
              </Button>
            </PremiumPressable>
          </div>
        </div>
      </motion.header>

      <motion.div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-[58] bg-[#070b12]"
        initial={false}
        animate={{ opacity: inPageNavTransition ? 0.4 : 0 }}
        transition={{ duration: 0.3, ease: easePremium }}
      />

      <motion.section
        className="relative px-6 pb-16 pt-20 md:pb-20 md:pt-24"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <div className="mx-auto max-w-7xl">
          <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
            <motion.div
              variants={{
                hidden: {},
                visible: { transition: { staggerChildren: 0.11, delayChildren: 0.06 } },
              }}
              initial="hidden"
              animate="visible"
            >
              <motion.div
                variants={{ hidden: { opacity: 0, y: 28 }, visible: { opacity: 1, y: 0, transition: { duration: 0.65, ease: easePremium } } }}
                className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.18em] text-[#D4AF37]"
              >
                <Sparkles className="h-4 w-4" />
                Initiation aux Sciences Nocturnes Africaines (ISNA)
              </motion.div>
              <motion.h1
                variants={{ hidden: { opacity: 0, y: 36 }, visible: { opacity: 1, y: 0, transition: { duration: 0.75, ease: easePremium } } }}
                className="mt-6 text-4xl font-bold leading-[1.12] md:text-6xl lg:text-7xl"
              >
                <span className="block">
                  <WordBlurReveal text="L'école" baseDelay={0.08} delayStep={0.06} />
                  <span className="inline-block w-2 md:w-3" aria-hidden />
                  <BrandShimmerWord text={SCHOOL} />
                </span>
                <span className="mt-1 block md:mt-2">
                  <WordBlurReveal
                    text="science métaphysique & tradition africaine"
                    baseDelay={0.42}
                    delayStep={0.05}
                  />
                </span>
              </motion.h1>
              <motion.p
                variants={{
                  hidden: { opacity: 0, y: 22, filter: 'blur(14px)' },
                  visible: {
                    opacity: 1,
                    y: 0,
                    filter: 'blur(0px)',
                    transition: { duration: 0.9, delay: 0.55, ease: easePremium },
                  },
                }}
                className="mt-6 max-w-2xl text-lg leading-relaxed text-white/75 md:text-xl"
              >
                Cosmologie et enseignement du{' '}
                <motion.strong
                  className="relative font-semibold prs-key-glow text-white/95"
                  animate={
                    prefersReducedMotion ? undefined : { opacity: [0.88, 1, 0.88] }
                  }
                  transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                >
                  5ᵉ Manikongo
                </motion.strong>{' '}
                : intégrer science et spiritualité pour une transformation authentique. Parcours ISNA, 21 sciences,
                bibliothèque, lives et accompagnement humain.
              </motion.p>

              <motion.div
                variants={{ hidden: { opacity: 0, y: 22 }, visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: easePremium } } }}
                className="mt-9 flex flex-wrap gap-3"
              >
                <PremiumPressable>
                  <Button
                    className="group prs-cta-primary h-12 bg-[#D4AF37] px-7 font-bold text-black hover:bg-[#ebca5e]"
                    asChild
                  >
                    <Link to="/signup" className="inline-flex items-center">
                      Commencer (visiteur)
                      <ArrowRight className="ml-2 h-5 w-5 transition-transform duration-300 group-hover:translate-x-1.5" />
                    </Link>
                  </Button>
                </PremiumPressable>
                <PremiumPressable>
                  <Button
                    type="button"
                    variant="outline"
                    className="prs-cta-ghost group h-12 border-white/25 px-7 text-white hover:bg-white/10"
                    onClick={scrollToVideo}
                  >
                    <PlayCircle className="mr-2 h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                    Voir la présentation
                  </Button>
                </PremiumPressable>
              </motion.div>

              <motion.div
                variants={{ hidden: { opacity: 0 }, visible: { opacity: 1, transition: { duration: 0.5 } } }}
                className="mt-8 flex flex-wrap items-center gap-2 text-xs text-white/55"
              >
                <ShieldCheck className="h-4 w-4 text-[#D4AF37]" />
                Système MK5 / Ngowazulu / ISNA
                <span className="mx-1 text-white/30">•</span>
                Parcours encadré
                <span className="mx-1 text-white/30">•</span>
                Secrétariat &amp; rendez-vous
              </motion.div>
            </motion.div>

            <motion.div
              className="relative prs-hero-chassis"
              style={{
                rotateX: prefersReducedMotion ? 0 : rotateX,
                rotateY: prefersReducedMotion ? 0 : rotateY,
                transformPerspective: 1200,
              }}
              onPointerMove={onHeroPointerMove}
              onPointerLeave={onHeroPointerLeave}
              initial={{ opacity: 0, scale: 0.92, y: 48 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.95, delay: 0.35, ease: easePremium }}
            >
              <div className="prs-hero-frame prs-glass-sweep relative overflow-hidden rounded-3xl border border-white/15 shadow-[0_30px_90px_rgba(0,0,0,.55)]">
                <ProrascienceHomeHeroCarousel
                  prefersReducedMotion={prefersReducedMotion}
                  onOpenVideo={scrollToVideo}
                  easePremium={easePremium}
                />
              </div>

              <div className="relative z-[1] -mt-8 mx-3 rounded-2xl border border-white/12 bg-[#0c111d]/90 p-4 shadow-xl backdrop-blur-lg md:mx-6 md:p-5">
                <div className="mb-3 flex items-center justify-between gap-2 border-b border-white/10 pb-3">
                  <span className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-white/55">
                    <span className="relative flex h-2 w-2 shrink-0">
                      {!prefersReducedMotion ? (
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-40" />
                      ) : null}
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500 prs-live-dot" />
                    </span>
                    En direct
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="flex h-4 items-end gap-0.5" aria-hidden>
                      {[14, 10, 16, 12].map((h, i) => (
                        <span
                          key={i}
                          className="w-0.5 rounded-full bg-[#D4AF37]/75 prs-wave-bar"
                          style={{ height: h }}
                        />
                      ))}
                    </span>
                    <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-300">
                      LIVE + REPLAY
                    </span>
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:gap-3">
                  {stats.map((item) => (
                    <AnimatedStatBlock key={item.label} value={item.value} label={item.label} />
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </motion.section>

      <AnimatedSection className="relative border-y border-white/10 bg-[#0a111c] px-6 py-8">
        <div className="mx-auto max-w-7xl">
          <p className="mb-4 text-center text-xs uppercase tracking-[0.18em] text-white/45">
            {`Une communauté mondiale autour du savoir — ${SCHOOL}`}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {trustedBy.map((name) => (
              <span
                key={name}
                className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-xs text-white/70"
              >
                {name}
              </span>
            ))}
          </div>
        </div>
      </AnimatedSection>

      <AnimatedSection id="fondateur" className="scroll-mt-24 border-y border-white/10 bg-gradient-to-b from-[#0a0f18] to-[#070b12] px-6 py-16 md:py-20">
        <div className="mx-auto max-w-7xl">
          <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,420px)_1fr] lg:gap-16">
            <CommercialFounderPortrait />
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-[#D4AF37]">Transmission</p>
              <h2 className="mt-3 font-serif text-3xl font-bold leading-tight md:text-4xl lg:text-[2.75rem]">
                Le fondateur de&nbsp;
                <span className="text-[#D4AF37]">{SCHOOL_FULL}</span>
              </h2>
              <p className="mt-5 text-base leading-relaxed text-white/78 md:text-lg">
                Le <strong className="font-semibold text-white/92">5ᵉ Manikongo</strong> — Badika Jel David, connu dans
                le réseau sous le nom de <strong className="font-semibold text-white/92">Ngowazulu</strong> — porte la
                charge spirituelle et doctrinale de l&apos;école : faire de la connaissance africaine une science
                articulée de la réalité, du visible à l&apos;invisible.
              </p>
              <p className="mt-4 text-sm leading-relaxed text-white/68 md:text-base">
                Son mandat n&apos;est pas une revendication politique sur la royauté historique du Kongo : c&apos;est une
                responsabilité de <em>garde du savoir</em> et de transmission pour cette génération — le fil conducteur
                entre l&apos;Ordre mystique des Manikongo et le pôle école ISNA tels qu&apos;ils sont présentés sur le
                site officiel.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <PremiumPressable>
                  <Button className="group prs-cta-primary h-11 bg-[#D4AF37] px-6 font-semibold text-black hover:bg-[#ebca5e]" asChild>
                    <Link to="/a-propos/fondateur" className="inline-flex items-center">
                      Biographie et mandat complet
                      <ArrowRight className="ml-2 h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                    </Link>
                  </Button>
                </PremiumPressable>
                <PremiumPressable>
                  <Button variant="outline" className="prs-cta-ghost h-11 border-white/25 px-6 text-white hover:bg-white/10" asChild>
                    <Link to="/a-propos">À propos — doctrine et réseau</Link>
                  </Button>
                </PremiumPressable>
              </div>
            </div>
          </div>
        </div>
      </AnimatedSection>

      <AnimatedSection id="video-ecole" className="scroll-mt-24 px-6 py-16">
        <div className="mx-auto max-w-5xl text-center">
          <SectionHeading eyebrow="Présentation" title={`Découvrir ${SCHOOL} en vidéo`} />
          <p className="mx-auto mt-4 max-w-2xl text-sm text-white/70 md:text-base">
            L&apos;esprit du pôle école : rigueur, initiation structurée et transmission vivante — doctrine et
            l&apos;enseignement du 5ᵉ Manikongo.
            {PROMO_YOUTUBE_ID
              ? ' Vidéo officielle de présentation.'
              : ' Exemple visuel ci-dessous ; remplacez-le par votre propre bande-annonce (YouTube ou fichier).'}
          </p>
        </div>
        <div className="mx-auto mt-10 max-w-5xl">
          <motion.div
            className="prs-video-chassis relative overflow-hidden rounded-2xl border border-white/15 bg-black shadow-2xl ring-1 ring-[#D4AF37]/25"
            initial={{ opacity: 0, scale: 0.94, y: 40 }}
            whileInView={{ opacity: 1, scale: 1, y: 0 }}
            viewport={{ once: true, amount: 0.35 }}
            transition={{ duration: 0.85, ease: easePremium }}
          >
            <motion.div
              className="pointer-events-none absolute -inset-px rounded-2xl opacity-60"
              style={{
                background: 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(212,175,55,0.35), transparent 55%)',
              }}
              animate={
                prefersReducedMotion ? { opacity: 0.45 } : { opacity: [0.35, 0.55, 0.35] }
              }
              transition={
                prefersReducedMotion
                  ? { duration: 0.2 }
                  : { duration: 5, repeat: Infinity, ease: 'easeInOut' }
              }
              aria-hidden
            />
            <div className="relative">
              <div className="absolute left-3 top-3 z-10 flex items-center gap-2 rounded-full border border-white/12 bg-black/55 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/90 backdrop-blur-md">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-500 prs-live-dot" />
                Studio live
              </div>
            {PROMO_YOUTUBE_ID ? (
              <div className="relative aspect-video w-full bg-black">
                <iframe
                  title={`Présentation ${SCHOOL} · LIRI`}
                  src={`https://www.youtube-nocookie.com/embed/${PROMO_YOUTUBE_ID}?rel=0`}
                  className="absolute inset-0 h-full w-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              </div>
            ) : (
              <video
                className="w-full"
                controls
                playsInline
                preload="metadata"
                poster={media.schoolDemoPoster}
              >
                <source src={media.schoolDemoMp4} type="video/mp4" />
                Votre navigateur ne lit pas la video HTML5.
              </video>
            )}
            </div>
          </motion.div>
          {import.meta.env.DEV && !PROMO_YOUTUBE_ID && (
            <p className="mt-3 text-center text-xs text-white/45">
              Astuce dev : ajoutez <code className="rounded bg-white/10 px-1.5 py-0.5">VITE_PRORASCIENCE_COMMERCIAL_YOUTUBE_ID</code> dans votre .env pour integrer votre chaine YouTube.
            </p>
          )}
        </div>
      </AnimatedSection>

      <AnimatedSection className="scroll-mt-24 border-y border-white/10 bg-[#070c14] px-6 py-16 md:py-20">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto mb-12 max-w-3xl text-center">
            <p className="text-xs uppercase tracking-[0.18em] text-[#D4AF37]">Mode histoire</p>
            <h2 className="mt-3 font-serif text-3xl font-bold leading-tight md:text-4xl">
              Avant la classe immersive, voici l'histoire que l\'application vient résoudre
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-white/70 md:text-base">
              Le parcours digital ne commence pas par un outil. Il commence par une rupture : passer d'une pratique
              répétée à une compréhension transmise avec structure, images, lives et pédagogie.
            </p>
          </div>

          <div className="space-y-8">
            {appleStoryHistory.map((item, index) => (
              <motion.article
                key={item.title}
                initial={{ opacity: 0, y: 32 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.7, ease: easePremium, delay: index * 0.06 }}
                className="grid gap-6 overflow-hidden rounded-[1.9rem] border border-white/10 bg-white/[0.03] p-5 md:p-7 lg:grid-cols-[0.92fr_1.08fr] lg:items-center"
              >
                <div className={index % 2 === 1 ? 'lg:order-2' : ''}>
                  <p className="text-xs uppercase tracking-[0.22em] text-[#D4AF37]/80">{item.eyebrow}</p>
                  <h3 className="mt-3 text-2xl font-bold leading-tight text-white md:text-4xl">{item.title}</h3>
                  <p className="mt-4 max-w-2xl text-sm leading-relaxed text-white/72 md:text-base">{item.body}</p>
                </div>
                <div className="overflow-hidden rounded-[1.35rem] border border-white/10 bg-black/30">
                  <img
                    src={item.image}
                    alt={item.alt}
                    className="h-72 w-full object-cover sm:h-80 lg:h-[22rem]"
                    loading="lazy"
                  />
                </div>
              </motion.article>
            ))}
          </div>
        </div>
      </AnimatedSection>

      {/* Section hors AnimatedSection : évite opacity:0 si whileInView ne se déclenche pas (section vide). */}
      <section id="liri" className="scroll-mt-24 border-y border-white/10 bg-[#080d16] px-6 py-16 md:py-20">
        <div className="relative z-[1] mx-auto max-w-7xl">
          <LiriImmersiveBlock />
        </div>
      </section>

      <AnimatedSection id="communaute" className="scroll-mt-24 border-y border-white/10 bg-[#0a111c] px-6 py-16">
        <div className="mx-auto max-w-7xl">
          <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-[#D4AF37]">Vie de l&apos;école</p>
              <h2 className="mt-2 text-3xl font-bold md:text-4xl">Ni secte ni folklore : une communauté d&apos;élèves</h2>
            </div>
            <p className="max-w-md text-sm text-white/70">
              Discussions autour de la doctrine, lives avec les enseignants, retraites de cohorte — le lien entre pairs
              qui avancent dans les mêmes sciences.
            </p>
          </div>
          <motion.div
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.15 }}
            variants={{
              hidden: {},
              visible: { transition: { staggerChildren: 0.1 } },
            }}
          >
            {media.gallery.map((item) => (
              <motion.figure
                key={item.caption}
                variants={{
                  hidden: { opacity: 0, y: 36, scale: 0.97 },
                  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.65, ease: easePremium } },
                }}
                className="prs-gallery-card group overflow-hidden rounded-2xl border border-white/10 bg-[#101729]"
              >
                <div className="relative aspect-[4/3] overflow-hidden">
                  <img
                    src={item.src}
                    alt={item.caption}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-90" />
                  <figcaption className="absolute bottom-0 left-0 right-0 p-4 text-sm font-semibold text-white">
                    {item.caption}
                  </figcaption>
                </div>
              </motion.figure>
            ))}
          </motion.div>
          <div className="mt-10 overflow-hidden rounded-2xl border border-white/10 md:flex md:h-80">
            <div className="relative min-h-[220px] flex-1 md:min-h-0">
              <img
                src={media.heroAlt}
                alt={`Bibliothèque et savoir — ${SCHOOL} · LIRI`}
                className="h-full w-full object-cover"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-black/55 to-transparent" />
            </div>
            <div className="flex flex-1 flex-col justify-center p-8 md:max-w-md">
              <h3 className="text-xl font-bold md:text-2xl">Rejoindre le réseau ISNA</h3>
              <p className="mt-3 text-sm leading-relaxed text-white/70">
                Des milliers de personnes sur plusieurs continents suivent déjà les parcours : mêmes exigences,
                même fil conducteur — de la compréhension des lois jusqu&apos;à la maîtrise pratique.
              </p>
              <PremiumPressable className="mt-5">
                <Button className="group prs-cta-primary bg-[#D4AF37] text-black hover:bg-[#ebca5e]" asChild>
                  <Link to="/signup" className="inline-flex items-center">
                    Ouvrir un compte visiteur
                    <ArrowRight className="ml-2 h-4 w-4 transition-transform duration-300 group-hover:translate-x-1.5" />
                  </Link>
                </Button>
              </PremiumPressable>
            </div>
          </div>
        </div>
      </AnimatedSection>

      <AnimatedSection id="produit" className="overflow-x-hidden px-6 pb-16 pt-16">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div className="max-w-2xl">
              <SectionHeading
                eyebrow="Une expérience complète"
                title="Tout ce dont un élève ISNA a besoin en ligne"
              />
            </div>
            <p className="max-w-xl text-sm text-white/70">
              Trois colonnes : à gauche, communauté, savoir et inscription ; au centre, le cursus officiel comme pivot
              visuel ; à droite, lives, LIRI mobile et les deux raccourcis institutionnels — une lecture guidée, sans
              grille plate.
            </p>
          </div>
        </div>

        <ProduitBentoGrid prefersReducedMotion={prefersReducedMotion} />
      </AnimatedSection>

      <AnimatedSection className="px-6 pb-16">
        <div className="mx-auto max-w-7xl">
          <motion.div
            className="grid gap-5 lg:grid-cols-3"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.15 }}
            variants={{
              hidden: {},
              visible: { transition: { staggerChildren: 0.12 } },
            }}
          >
            {featureStory.map((block) => (
              <motion.div
                key={block.title}
                variants={{
                  hidden: { opacity: 0, y: 40, rotateX: 8 },
                  visible: { opacity: 1, y: 0, rotateX: 0, transition: { duration: 0.7, ease: easePremium } },
                }}
                className="rounded-3xl border border-white/10 bg-[#0f1628] p-6 shadow-[0_20px_50px_rgba(0,0,0,0.35)]"
                style={{ perspective: 1200 }}
              >
                <motion.div
                  className="mb-4 inline-flex rounded-xl bg-[#D4AF37]/10 p-3 text-[#D4AF37]"
                  whileHover={prefersReducedMotion ? undefined : { scale: 1.06, rotate: [0, -6, 6, 0] }}
                  transition={{ duration: 0.5 }}
                >
                  <block.icon className="h-5 w-5" />
                </motion.div>
                <p className="text-xs uppercase tracking-[0.18em] text-[#D4AF37]">{block.eyebrow}</p>
                <h3 className="mt-3 text-2xl font-bold leading-tight">{block.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-white/70">{block.text}</p>
                <ul className="mt-4 space-y-2">
                  {block.points.map((point) => (
                    <li key={point} className="flex items-start gap-2 text-sm text-white/80">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#D4AF37]" />
                      {point}
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </AnimatedSection>

      <AnimatedSection className="px-6 pb-16">
        <div className="mx-auto max-w-7xl space-y-4">
          {premiumRows.map((row, i) => (
            <motion.div
              key={row.title}
              initial={{ opacity: 0, x: i % 2 === 0 ? -32 : 32 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.25 }}
              transition={{ duration: 0.75, delay: i * 0.05, ease: easePremium }}
              className="rounded-3xl border border-white/10 bg-[#0e1526] p-7 md:p-8"
            >
              <div className="grid items-center gap-6 md:grid-cols-[1.2fr_0.8fr]">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-[#D4AF37]">{row.badge}</p>
                  <h3 className="mt-2 text-2xl font-bold md:text-3xl">{row.title}</h3>
                  <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/70 md:text-base">{row.text}</p>
                  <ul className="mt-4 space-y-2">
                    {row.bullets.map((item) => (
                      <li key={item} className="flex items-start gap-2 text-sm text-white/80">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#D4AF37]" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
                  <motion.div
                    className="inline-flex rounded-xl bg-[#D4AF37]/10 p-3 text-[#D4AF37]"
                    whileHover={prefersReducedMotion ? undefined : { rotate: [0, -5, 5, 0], scale: 1.05 }}
                    transition={{ duration: 0.5 }}
                  >
                    <row.icon className="h-6 w-6" />
                  </motion.div>
                  <p className="mt-4 text-sm text-white/70">
                    Accès direct aux ressources et parcours décrits à gauche — la même doctrine que sur le site
                    institutionnel.
                  </p>
                  <Link to={row.ctaHref} className="mt-4 inline-flex items-center text-sm font-medium text-[#D4AF37]">
                    {row.ctaLabel}
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Link>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </AnimatedSection>

      <AnimatedSection id="temoignages" className="px-6 pb-16">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8 flex items-end justify-between gap-4">
            <div>
              <SectionHeading eyebrow="Témoignages" title="Ce que disent les membres" />
            </div>
            <Link to="/appointment/request?source=prorascience-social-proof" className="hidden md:block">
              <Button variant="outline" className="border-white/25 text-white hover:bg-white/10">
                Parler au secrétariat
              </Button>
            </Link>
          </div>

          <TestimonialsMarqueeBlock reduce={prefersReducedMotion} />
        </div>
      </AnimatedSection>

      <AnimatedSection id="tarifs" className="px-6 pb-20">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8 text-center">
            <SectionHeading
              eyebrow="Rejoindre l'ISNA"
              title="Trois portes d'entrée possibles"
              className="mx-auto max-w-3xl text-center [&_h2]:mx-auto"
            />
          </div>

          <motion.div
            className="mb-8 grid gap-4 md:grid-cols-3"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.15 }}
            variants={{
              hidden: {},
              visible: { transition: { staggerChildren: 0.11 } },
            }}
          >
            {pricingCards.map((plan) => (
              <motion.div
                key={plan.name}
                variants={{
                  hidden: { opacity: 0, y: 40 },
                  visible: { opacity: 1, y: 0, transition: { duration: 0.65, ease: easePremium } },
                }}
                whileHover={prefersReducedMotion ? undefined : { y: -5, transition: { duration: 0.25 } }}
                className={`rounded-2xl border p-6 ${
                  plan.featured
                    ? 'border-[#D4AF37]/50 bg-gradient-to-b from-[#1b2437] to-[#12192b]'
                    : 'border-white/10 bg-[#0f1628]'
                }`}
              >
                <p className="text-sm text-white/75">{plan.audience}</p>
                <h3 className="mt-2 text-2xl font-bold">{plan.name}</h3>
                <p className="mt-3 text-3xl font-bold text-[#D4AF37]">
                  {plan.price}
                  <span className="ml-1 text-base font-medium text-white/60">{plan.period}</span>
                </p>
                <ul className="mt-4 space-y-2">
                  {plan.points.map((p) => (
                    <li key={p} className="flex items-start gap-2 text-sm text-white/80">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#D4AF37]" />
                      {p}
                    </li>
                  ))}
                </ul>
                <Link to={plan.href} className="mt-6 block">
                  <Button
                    className={
                      plan.featured
                        ? 'w-full bg-[#D4AF37] text-black hover:bg-[#ebca5e]'
                        : 'w-full border border-white/25 bg-transparent text-white hover:bg-white/10'
                    }
                  >
                    {plan.cta}
                  </Button>
                </Link>
              </motion.div>
            ))}
          </motion.div>

          <div className="prs-aurora-wrap rounded-3xl border border-[#D4AF37]/35 bg-gradient-to-r from-[#12192c] via-[#101a30] to-[#172741] p-10 text-center md:p-14">
            <div className="prs-aurora-content">
              <motion.p
                className="text-xs uppercase tracking-[0.18em] text-[#f2d983]"
                initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }}
                whileInView={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.8 }}
                transition={{ duration: 0.55, ease: easePremium }}
              >
                Prochaine étape
              </motion.p>
              <motion.h2
                className="mt-3 text-3xl font-bold md:text-5xl"
                initial={prefersReducedMotion ? false : { opacity: 0, y: 32, filter: 'blur(12px)' }}
                whileInView={prefersReducedMotion ? undefined : { opacity: 1, y: 0, filter: 'blur(0px)' }}
                viewport={{ once: true, amount: 0.75 }}
                transition={{ duration: 0.75, delay: 0.08, ease: easePremium }}
              >
                Entrer dans l&apos;initiation avec méthode
              </motion.h2>
              <p className="mx-auto mt-4 max-w-2xl text-white/75">
                Ouvrez un compte visiteur, visionnez la présentation, puis choisissez votre forfait ou fixez un entretien
                avec le secrétariat pour un parcours personnalisé.
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <PremiumPressable>
                  <Button className="group prs-cta-primary h-12 bg-[#D4AF37] px-7 font-bold text-black hover:bg-[#ebca5e]" asChild>
                    <Link to="/signup" className="inline-flex items-center">
                      Créer mon compte
                      <ArrowRight className="ml-2 h-4 w-4 transition-transform duration-300 group-hover:translate-x-1.5" />
                    </Link>
                  </Button>
                </PremiumPressable>
                <PremiumPressable>
                  <Button variant="outline" className="prs-cta-ghost h-12 border-white/30 px-7 text-white hover:bg-white/10" asChild>
                    <Link to="/a-propos" className="inline-flex items-center">
                      Lire la doctrine
                    </Link>
                  </Button>
                </PremiumPressable>
                <PremiumPressable>
                  <Button
                    variant="outline"
                    className="prs-cta-ghost group h-12 border-white/30 px-7 text-white hover:bg-white/10"
                    asChild
                  >
                    <Link to="/appointment/request?source=prorascience-commercial-final-cta" className="inline-flex items-center">
                      <MessageSquare className="mr-2 h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
                      Prendre un rendez-vous
                    </Link>
                  </Button>
                </PremiumPressable>
              </div>
            </div>
          </div>
        </div>
      </AnimatedSection>

      <AnimatedSection className="px-6 pb-24">
        <div className="mx-auto max-w-4xl">
          <div className="mb-6 text-center">
            <SectionHeading eyebrow="FAQ" title="Questions fréquentes" className="text-center" />
          </div>
          <div className="space-y-3">
            {faqs.map((item) => (
              <details key={item.q} className="group rounded-2xl border border-white/10 bg-[#0f1628] p-5">
                <summary className="cursor-pointer list-none pr-8 text-base font-semibold text-white marker:content-none">
                  {item.q}
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-white/70">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </AnimatedSection>
      </div>
    </div>
  );
};

export default ProrascienceCommercialPage;
