/* eslint-disable */
// ─── FULL REWRITE — Framer-inspired UI ───────────────────────────────────────
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
import { ArrowRight, ArrowUpRight, Zap, Globe, Cpu, Users, Heart, Rocket, Star, Sparkles } from 'lucide-react';
import { CircularTestimonials } from '@/components/ui/circular-testimonials';
import { ConnoisseurStackInteractor } from '@/components/ui/connoisseur-stack-interactor';
import TextBlockAnimation from '@/components/ui/text-block-animation';
import CimolaceHeader from '@/components/cimolace/CimolaceHeader';
import { FullScreenScrollFX } from '@/components/ui/full-screen-scroll-fx';
const InfiniteGallery = lazy(() => import('@/components/ui/3d-gallery-photography'));

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

/* Magnetic hover button */
const MagneticBtn = ({ children }) => {
  const ref = useRef(null);
  const x = useSpring(0, { stiffness: 200, damping: 20 });
  const y = useSpring(0, { stiffness: 200, damping: 20 });
  const handleMove = (e) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    x.set((e.clientX - (rect.left + rect.width / 2)) * 0.3);
    y.set((e.clientY - (rect.top + rect.height / 2)) * 0.3);
  };
  return (
    <motion.div ref={ref} style={{ x, y }} onMouseMove={handleMove} onMouseLeave={() => { x.set(0); y.set(0); }}>
      {children}
    </motion.div>
  );
};

/* ════════════════════════════════════════════
   CONSTANTS
════════════════════════════════════════════ */
const chapters = [
  { id: 'hero', label: 'Intro' },
  { id: 'probleme', label: 'Problème' },
  { id: 'vision', label: 'Vision' },
  { id: 'timeline', label: 'Histoire' },
  { id: 'valeurs', label: 'Valeurs' },
  { id: 'futur', label: 'Futur' },
];
const marqueeA = ['Infrastructure africaine', 'CIMOLACE 2024', 'Virtuel Mbolo', 'Payflow Africa', 'LIRI AI Core', '12 pays', '2 500 entrepreneurs', 'Omnicanal', 'Made in Africa'];
const marqueeB = ['Infrastructure', 'Vision', 'Futur', 'Afrique', 'CIMOLACE', 'Automatisation', 'IA', 'Commerce', 'Formation', 'Communauté'];

/* ════════════════════════════════════════════
   PAGE
════════════════════════════════════════════ */

/* ─── Images galerie 3D — contexte africain tech/business ─── */
const GALLERY_IMAGES = [
  { src: 'https://images.unsplash.com/photo-1531746790731-6c087fecd65a?w=600&q=80', alt: 'Entrepreneur africain' },
  { src: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=600&q=80', alt: 'Équipe en coworking' },
  { src: 'https://images.unsplash.com/photo-1551434678-e076c223a692?w=600&q=80', alt: 'Développeur sur écrans' },
  { src: 'https://images.unsplash.com/photo-1534278931827-8a259344abe7?w=600&q=80', alt: 'Commerce mobile' },
  { src: 'https://images.unsplash.com/photo-1580508174046-170816f65662?w=600&q=80', alt: 'Paiement mobile' },
  { src: 'https://images.unsplash.com/photo-1601598851547-4302969d0614?w=600&q=80', alt: 'Livraison logistique' },
  { src: 'https://images.unsplash.com/photo-1573496799652-408c2ac9fe98?w=600&q=80', alt: 'Dashboard analytics' },
  { src: 'https://images.unsplash.com/photo-1509062522246-3755977927d7?w=600&q=80', alt: 'Éducation numérique' },
  { src: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=600&q=80', alt: 'Événement africain' },
  { src: 'https://images.unsplash.com/photo-1611162616305-c69b3037c7bb?w=600&q=80', alt: 'Créateur de contenu' },
  { src: 'https://images.unsplash.com/photo-1427504494785-3a9ca7044f45?w=600&q=80', alt: 'Étudiant tablette' },
  { src: 'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=600&q=80', alt: 'Femme tech' },
];

export default function CimolaceAboutPage() {
  const [active, setActive] = useState(0);
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 100, damping: 30 });

  useEffect(() => {
    const onScroll = () => {
      const mid = window.scrollY + window.innerHeight / 2;
      chapters.forEach((c, i) => {
        const el = document.getElementById(c.id);
        if (el && mid >= el.offsetTop && mid < el.offsetTop + el.offsetHeight) setActive(i);
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <>
      <Helmet><title>Notre Histoire | CIMOLACE</title></Helmet>

      <div className="bg-[#050507] text-white min-h-screen overflow-x-hidden">

        {/* Scroll progress bar */}
        <motion.div
          className="fixed top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-violet-500 to-cyan-400 z-[60] origin-left"
          style={{ scaleX }}
        />

        <CimolaceHeader />

        {/* ══ SECTION 1 — HERO ══ */}
        <section id="hero" className="relative min-h-screen flex items-center justify-center overflow-hidden">
          <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")` }} />
          <motion.div animate={{ scale: [1, 1.15, 1], x: [0, 30, 0] }} transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }} className="absolute top-[15%] left-[10%] w-[500px] h-[500px] rounded-full bg-violet-600/10 blur-[120px] pointer-events-none" />
          <motion.div animate={{ scale: [1, 1.2, 1], x: [0, -25, 0] }} transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut', delay: 2 }} className="absolute bottom-[10%] right-[5%] w-[600px] h-[600px] rounded-full bg-cyan-600/8 blur-[140px] pointer-events-none" />

          <div className="relative z-10 max-w-[1100px] mx-auto px-8 pt-28 pb-20 text-center">
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/20 mb-12 text-xs text-violet-300 tracking-widest uppercase">
              <Sparkles className="w-3 h-3" />
              Notre histoire
            </motion.div>
            <div className="mb-8">
              <Line delay={0.1}><h1 className="text-[clamp(3rem,10vw,8.5rem)] font-black leading-[0.9] tracking-[-0.03em] text-white">Tout a commencé</h1></Line>
              <Line delay={0.22}><h1 className="text-[clamp(3rem,10vw,8.5rem)] font-black leading-[0.9] tracking-[-0.03em]"><Shimmer from="#c4b5fd" to="#67e8f9" className="font-black">par une frustration.</Shimmer></h1></Line>
            </div>
            <motion.p initial={{ opacity: 0, y: 24, filter: 'blur(8px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} transition={{ duration: 0.9, delay: 0.6, ease: [0.16, 1, 0.3, 1] }} className="text-lg lg:text-xl text-white/50 max-w-[560px] mx-auto leading-relaxed mb-16">
              Pas celle d'un technicien. Celle d\'un entrepreneur africain qui voulait simplement <span className="text-white/80">vendre, enseigner et grandir</span> — et se heurtait à des murs à chaque étape.
            </motion.p>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.4 }} className="flex flex-col items-center gap-3 text-white/25">
              <span className="text-[10px] tracking-[0.3em] uppercase">Défiler</span>
              <motion.div animate={{ scaleY: [1, 1.5, 1], opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.5, repeat: Infinity }} className="w-px h-10 bg-gradient-to-b from-violet-400/60 to-transparent" />
            </motion.div>
          </div>
        </section>

        <Marquee items={marqueeA} speed={50} />

        {/* ══ SECTION 2 — PROBLÈME ══ */}
        <section id="probleme" className="relative py-32 px-8 max-w-[1100px] mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="flex flex-col justify-center lg:pr-8">
              <Line delay={0}><span className="text-[10px] tracking-[0.35em] uppercase text-red-400/60 mb-5 block">Le constat</span></Line>
              <div className="mb-6">
                <Line delay={0.1}><p className="text-[clamp(2rem,5vw,3.5rem)] font-black leading-[1.05] tracking-[-0.02em] text-white">L'Afrique a du talent.</p></Line>
                <Line delay={0.22}><p className="text-[clamp(2rem,5vw,3.5rem)] font-black leading-[1.05] tracking-[-0.02em] text-red-400/70">Pas l'infrastructure.</p></Line>
              </div>
              <motion.p initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.4, duration: 0.7, ease: [0.16, 1, 0.3, 1] }} className="text-base text-white/45 leading-relaxed">
                Des millions d'entrepreneurs ont des idées brillantes. Mais les outils sont soit absents, soit conçus pour d\'autres réalités.
              </motion.p>
            </div>
            <motion.div variants={stagger(0.08, 0.1)} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-5%' }} className="grid grid-cols-2 gap-3">
              {[
                { emoji: '💳', title: 'Paiements', text: 'Mobile Money, SWIFT, cartes — chaque transaction est un combat.' },
                { emoji: '📦', title: 'Logistique', text: 'Pas de système standardisé. Chaque envoi est une improvisation.' },
                { emoji: '📚', title: 'Formation', text: 'Les plateformes ne comprennent ni les langues ni les contextes locaux.' },
                { emoji: '⚙️', title: 'Automation', text: 'Les outils IA sont hors de prix pour les PME africaines.' },
              ].map((item, i) => (
                <motion.div key={i} variants={fadeUp} whileHover={{ y: -4, borderColor: 'rgba(139,92,246,0.3)' }} className="p-5 rounded-2xl bg-white/[0.025] border border-white/[0.07] cursor-default transition-colors duration-300">
                  <span className="text-2xl block mb-3">{item.emoji}</span>
                  <h4 className="text-sm font-bold text-white mb-1.5">{item.title}</h4>
                  <p className="text-xs text-white/35 leading-relaxed">{item.text}</p>
                </motion.div>
              ))}
            </motion.div>
          </div>
          <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: 0.2, duration: 0.8 }} className="mt-28 border-t border-white/[0.05] pt-20 text-center">
            <Line delay={0}><p className="text-[clamp(1.4rem,4vw,2.8rem)] font-bold text-white/20 leading-tight">Et si le problème n'était pas le talent,</p></Line>
            <Line delay={0.18}><p className="text-[clamp(1.4rem,4vw,2.8rem)] font-bold leading-tight mt-1">mais <Shimmer from="#a78bfa" to="#22d3ee">l'absence d\'infrastructure</Shimmer> ?</p></Line>
          </motion.div>
        </section>

        <Marquee items={marqueeB} speed={35} />

        {/* ══ SECTION 3 — VISION ══ */}
        <section id="vision" className="relative py-40 overflow-hidden">
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            {[900, 650, 420].map((size, i) => (
              <motion.div key={i} animate={{ rotate: i % 2 === 0 ? 360 : -360 }} transition={{ duration: 30 + i * 15, repeat: Infinity, ease: 'linear' }} className="absolute rounded-full border border-white/[0.04]" style={{ width: size, height: size }} />
            ))}
            <div className="absolute w-96 h-96 rounded-full bg-gradient-radial from-violet-500/8 to-transparent blur-2xl" />
          </div>
          <div className="relative z-10 max-w-[900px] mx-auto px-8 text-center">
            <Line delay={0}><span className="text-[10px] tracking-[0.35em] uppercase text-violet-400/60 mb-10 block">La vision</span></Line>
            <div className="mb-10">
              <Line delay={0.1}><h2 className="text-[clamp(2.5rem,7vw,6rem)] font-black leading-[0.92] tracking-[-0.03em] text-white">L'Afrique ne doit pas</h2></Line>
              <Line delay={0.2}><h2 className="text-[clamp(2.5rem,7vw,6rem)] font-black leading-[0.92] tracking-[-0.03em] text-white">rattraper la technologie.</h2></Line>
            </div>
            <motion.div initial={{ scaleX: 0 }} whileInView={{ scaleX: 1 }} viewport={{ once: true }} transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }} className="h-px w-20 bg-gradient-to-r from-violet-500 to-cyan-400 mx-auto mb-10 origin-left" />
            <Line delay={0.4}><p className="text-[clamp(1.8rem,5vw,4rem)] font-black"><Shimmer from="#c4b5fd" to="#67e8f9">Elle peut sauter une étape.</Shimmer></p></Line>
            <motion.p initial={{ opacity: 0, y: 20, filter: 'blur(6px)' }} whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }} viewport={{ once: true }} transition={{ delay: 0.6, duration: 0.8, ease: [0.16, 1, 0.3, 1] }} className="mt-8 text-lg text-white/40 max-w-lg mx-auto leading-relaxed">
              Pas besoin de 30 ans de transition numérique. Avec la bonne infrastructure, on peut partir directement au niveau suivant.
            </motion.p>
            <GlowCard accent="#7c3aed" delay={0.3} className="mt-16 text-left">
              <div className="p-6 rounded-2xl bg-[#0d0d14] border border-white/[0.07]">
                <div className="flex items-center gap-2 mb-5">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/70" />
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500/70" />
                  <span className="text-[10px] text-white/20 ml-2 font-mono">founder.log</span>
                </div>
                <p className="text-sm text-white/60 font-mono leading-relaxed">
                  <span className="text-violet-400">$</span>{' '}
                  <span className="text-white/80 italic">{`"J'avais une boutique, une formation, une communauté. Mais 80% de mon temps partait à gérer des outils qui ne se parlaient pas. J'ai réalisé que le problème n'était pas moi — c'était l'absence d'un système conçu pour moi."`}</span>
                </p>
                <p className="mt-4 text-[11px] text-violet-400/70 font-mono">— NGOWAZULU · Fondateur CIMOLACE</p>
              </div>
            </GlowCard>
          </div>
        </section>

        {/* ══ SECTION 4 — TIMELINE ══ */}
        <section id="timeline" className="py-32 px-8 max-w-[1100px] mx-auto">
          <div className="text-center mb-20">
            <Line delay={0}><span className="text-[10px] tracking-[0.35em] uppercase text-cyan-400/60 mb-4 block">La construction</span></Line>
            <Line delay={0.1}>
              <SplitText text="De l'idée à l'écosystème." as="h2" delay={0.05} className="text-[clamp(2rem,5vw,4rem)] font-black tracking-[-0.03em] text-white block" />
            </Line>
          </div>
          <motion.div
            initial={{ opacity: 0, y: 32 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-5%' }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            <ConnoisseurStackInteractor />
          </motion.div>
        </section>

        {/* ══ SECTION 4B — HÉBERGEMENT ══ */}
        <section className="relative py-32 px-8">
          <div className="max-w-[1100px] mx-auto">
            <div className="mb-14">
              <Line delay={0}>
                <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold tracking-widest uppercase bg-violet-500/10 text-violet-400 border border-violet-500/20 mb-5">
                  Hébergement
                </span>
              </Line>
              <TextBlockAnimation
                blockColor="#5b3df5"
                animateOnScroll={true}
                delay={0.1}
                duration={0.65}
                stagger={0.08}
              >
                <h2 className="text-[clamp(2.2rem,5vw,4rem)] font-black tracking-[-0.03em] text-white mb-5">
                  Deux modes. Vous choisissez.
                </h2>
              </TextBlockAnimation>
              <TextBlockAnimation
                blockColor="#3a1fb8"
                animateOnScroll={true}
                delay={0.3}
                duration={0.5}
                stagger={0.06}
              >
                <p className="text-base text-white/45 max-w-xl leading-relaxed">
                  CIMOLACE peut être hébergé chez nous (zéro souci) ou installé sur votre infrastructure (souveraineté totale). Même produit, deux modes opératoires.
                </p>
              </TextBlockAnimation>
            </div>

            <motion.div
              variants={stagger(0.1, 0.1)}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: '-5%' }}
              className="grid grid-cols-1 lg:grid-cols-2 gap-5"
            >
              {/* Card 1 — Hébergé CIMOLACE */}
              <motion.div
                variants={fadeUp}
                whileHover={{ y: -4, borderColor: 'rgba(139,92,246,0.35)' }}
                className="relative p-8 rounded-2xl bg-white/[0.025] border border-white/[0.08] transition-colors duration-300"
              >
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-[11px] font-bold tracking-widest uppercase text-violet-400 mb-6">
                  <span>⚡</span> Hébergé CIMOLACE · Recommandé
                </div>
                <h3 className="text-2xl font-black text-white mb-3">Hébergé CIMOLACE</h3>
                <p className="text-sm text-white/45 leading-relaxed mb-6">
                  Vous connectez votre domaine, on s'occupe de tout. Mises à jour, sauvegardes, scalabilité, monitoring.
                </p>
                <ul className="space-y-3">
                  {[
                    'Mise en route en 24h',
                    'Mises à jour automatiques',
                    'Sauvegardes quotidiennes',
                    'Scalabilité automatique selon le trafic',
                    'Conformité RGPD garantie',
                    'Support technique inclus',
                  ].map((point) => (
                    <li key={point} className="flex items-center gap-3 text-sm text-white/60">
                      <span className="text-violet-400 font-bold flex-shrink-0">→</span>
                      {point}
                    </li>
                  ))}
                </ul>
              </motion.div>

              {/* Card 2 — Installation privée */}
              <motion.div
                variants={fadeUp}
                whileHover={{ y: -4, borderColor: 'rgba(255,255,255,0.18)' }}
                className="relative p-8 rounded-2xl bg-white/[0.025] border border-white/[0.08] transition-colors duration-300"
              >
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.06] border border-white/[0.1] text-[11px] font-bold tracking-widest uppercase text-white/60 mb-6">
                  <span>🔒</span> Installation Privée
                </div>
                <h3 className="text-2xl font-black text-white mb-3">Installation privée</h3>
                <p className="text-sm text-white/45 leading-relaxed mb-6">
                  CIMOLACE est déployé sur votre infrastructure (votre cloud, votre serveur). Souveraineté complète sur vos données.
                </p>
                <ul className="space-y-3">
                  {[
                    'Déployable sur AWS, GCP, Azure ou serveur dédié',
                    'Vos données restent chez vous',
                    'Code source protégé (license commerciale)',
                    'Support installation et maintenance',
                    'Adapté aux institutions, écoles, ONG',
                    'Tarification sur devis',
                  ].map((point) => (
                    <li key={point} className="flex items-center gap-3 text-sm text-white/60">
                      <span className="text-cyan-400 font-bold flex-shrink-0">→</span>
                      {point}
                    </li>
                  ))}
                </ul>
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* ══ SECTION 5 — VALEURS BENTO ══ */}
        <section id="valeurs" className="py-32 px-8 max-w-[1100px] mx-auto">
          <div className="text-center mb-16">
            <Line delay={0}><span className="text-[10px] tracking-[0.35em] uppercase text-violet-400/60 mb-4 block">Ce qui nous guide</span></Line>
            <Line delay={0.1}>
              <SplitText text="Nos valeurs fondatrices." as="h2" delay={0.04} className="text-[clamp(2rem,5vw,4rem)] font-black tracking-[-0.03em] text-white block" />
            </Line>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { icon: Globe, title: 'Conçu pour le terrain', text: "Chaque décision part de la réalité africaine — pas d'une salle de conférence à San Francisco.", color: '#8b5cf6', wide: true },
              { icon: Cpu, title: "Intelligence d'abord", text: "Nous mettons l'IA là où elle libère vraiment du temps humain.", color: '#06b6d4' },
              { icon: Users, title: "L'entrepreneur au centre", text: "CIMOLACE donne les armes pour aller plus loin, plus vite, avec moins d'efforts.", color: '#f59e0b' },
              { icon: Heart, title: 'Réalisme bienveillant', text: "Pas de discours victimisant. Une aide concrète, honnête, adaptée.", color: '#ec4899' },
              { icon: Rocket, title: 'Ambition africaine', text: "Les prochains leaders tech mondiaux viendront d'Afrique. CIMOLACE les y prépare.", color: '#10b981', wide: true },
              { icon: Zap, title: "Vitesse d'exécution", text: "De l'idée au marché en jours, pas en mois.", color: '#8b5cf6' },
            ].map((v, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 28, scale: 0.96 }} whileInView={{ opacity: 1, y: 0, scale: 1 }} viewport={{ once: true, margin: '-3%' }} transition={{ duration: 0.6, delay: i * 0.07, ease: [0.16, 1, 0.3, 1] }} whileHover={{ y: -4 }} className={`relative group p-7 rounded-2xl bg-white/[0.025] border border-white/[0.07] hover:border-white/[0.15] transition-all duration-400 overflow-hidden ${v.wide ? 'md:col-span-2' : ''}`}>
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" style={{ background: `radial-gradient(ellipse at top left, ${v.color}0a, transparent 65%)` }} />
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-5" style={{ background: `linear-gradient(135deg, ${v.color}20, ${v.color}40)` }}>
                  <v.icon className="w-5 h-5" style={{ color: v.color }} />
                </div>
                <h3 className="text-base font-bold text-white mb-2">{v.title}</h3>
                <p className="text-sm text-white/40 leading-relaxed">{v.text}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* ══ STATS ══ */}
        <section className="py-20 border-y border-white/[0.05]">
          <motion.div variants={stagger(0.12, 0.1)} initial="hidden" whileInView="show" viewport={{ once: true }} className="max-w-[1100px] mx-auto px-8 grid grid-cols-2 md:grid-cols-4 gap-px bg-white/[0.05]">
            {[
              { to: 10, suffix: '', label: 'Modules IA' },
              { to: 12, suffix: '', label: 'Pays africains' },
              { to: 2500, suffix: '+', label: 'Entrepreneurs' },
              { to: 2020, suffix: '', label: 'Année fondatrice' },
            ].map((s, i) => (
              <motion.div key={i} variants={fadeUp} className="bg-[#050507] px-8 py-10 text-center">
                <div className="text-4xl lg:text-5xl font-black text-white mb-2 tracking-tight"><CountUp to={s.to} suffix={s.suffix} /></div>
                <div className="text-xs text-white/30 uppercase tracking-[0.2em]">{s.label}</div>
              </motion.div>
            ))}
          </motion.div>
        </section>

        {/* ══ TESTIMONIALS ══ */}
        <section className="py-32 relative overflow-hidden">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-16"
          >
            <span className="text-[10px] tracking-[0.35em] uppercase text-violet-400/60 mb-4 block">Ils ont vécu l'histoire</span>
            <Line><h2 className="text-[clamp(2rem,6vw,4rem)] font-black leading-[1] tracking-[-0.03em] text-white">Leurs mots,<br /><span className="text-white/30">notre fierté.</span></h2></Line>
          </motion.div>
          <div className="flex justify-center">
            <CircularTestimonials
                autoplay
                testimonials={[
                  {
                    quote: "CIMOLACE a changé ma façon de travailler. En quelques semaines, j'ai automatisé mes ventes, mes livraisons et mon marketing. Je consacre enfin mon énergie à ce qui compte vraiment : mes clients.",
                    name: "Amina Diallo",
                    designation: "Fondatrice — Boutique Mode, Dakar",
                    src: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=600&q=80",
                  },
                  {
                    quote: "J'avais peur que ce soit trop technique. En réalité, LIRI EDU m'a permis de créer ma première formation complète en deux jours. L'intelligence artificielle fait vraiment le travail difficile.",
                    name: "Kofi Mensah",
                    designation: "Formateur digital — Accra, Ghana",
                    src: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&q=80",
                  },
                  {
                    quote: "Recevoir des paiements depuis 4 pays africains différents en un seul endroit, c'est ce que j'attendais depuis des années. Payflow Africa a résolu ce problème que tout le monde ignorait.",
                    name: "Fatou Coulibaly",
                    designation: "CEO — AgriTech Solutions, Abidjan",
                    src: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=600&q=80",
                  },
                  {
                    quote: "LIRI Agents System tourne en permanence, relance mes prospects, envoie mes offres. Mon chiffre d'affaires a doublé en deux mois. C'est comme avoir une équipe qui travaille 24h/24.",
                    name: "Jean-Paul Nkosi",
                    designation: "Entrepreneur — Kinshasa, RDC",
                    src: "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=600&q=80",
                  },
                ]}
                colors={{
                  name: "#ffffff",
                  designation: "#a78bfa",
                  testimony: "#d4d4d8",
                  arrowBackground: "#1a1a2e",
                  arrowForeground: "#f1f1f7",
                  arrowHoverBackground: "#7c3aed",
                }}
                fontSizes={{
                  name: "1.6rem",
                  designation: "0.9rem",
                  quote: "1.05rem",
                }}
              />
            </div>
        </section>

        {/* ══ SECTION 7 — Galerie 3D immersive (désactivée pour éviter les erreurs 404 Unsplash) ══ */}
        {/* <section className="relative bg-[#06050e] overflow-hidden">
          <div className="relative z-10 text-center pt-20 pb-6 px-6">
            <motion.span
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="inline-block text-xs text-violet-400 tracking-[0.3em] uppercase mb-4"
            >
              L'Afrique en images
            </motion.span>
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className="text-4xl md:text-6xl font-black text-white tracking-tight leading-tight"
            >
              L'infrastructure pour{' '}
              <span className="bg-clip-text text-transparent" style={{ backgroundImage: 'linear-gradient(135deg, #a78bfa, #34d399)' }}>
                le continent.
              </span>
            </motion.h2>
          </div>
          <Suspense fallback={null}>
          <InfiniteGallery
            images={GALLERY_IMAGES}
            speed={1.2}
            visibleCount={12}
            className="h-screen w-full"
            fadeSettings={{ fadeIn: { start: 0.05, end: 0.25 }, fadeOut: { start: 0.4, end: 0.43 } }}
            blurSettings={{ blurIn: { start: 0.0, end: 0.1 }, blurOut: { start: 0.4, end: 0.43 }, maxBlur: 8.0 }}
          />
          <div className="pointer-events-none fixed inset-0 flex items-center justify-center text-center px-3 mix-blend-exclusion z-20" style={{ display: 'none' }} />
          <p className="text-center pb-6 text-[11px] uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.2)' }}>
            Molette · Flèches · Tactile pour naviguer
          </p>
          </Suspense>
        </section> */}

        {/* ══ SECTION 8 — CTA ══ */}
        <section id="futur" className="relative py-48 overflow-hidden">
          <motion.div animate={{ rotate: [0, 360] }} transition={{ duration: 30, repeat: Infinity, ease: 'linear' }} className="absolute inset-0 pointer-events-none" style={{ background: 'conic-gradient(from 0deg at 50% 50%, #7c3aed08, #06b6d408, #7c3aed08)' }} />
          <motion.div animate={{ scale: [1, 1.3, 1] }} transition={{ duration: 8, repeat: Infinity }} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-gradient-radial from-violet-600/12 to-transparent blur-3xl pointer-events-none" />
          <div className="relative z-10 max-w-[900px] mx-auto px-8 text-center">
            <Line delay={0}><span className="text-[10px] tracking-[0.35em] uppercase text-violet-400/60 mb-10 block">Ce n'est que le début</span></Line>
            <div className="mb-8">
              <Line delay={0.1}><h2 className="text-[clamp(2.5rem,8vw,7rem)] font-black leading-[0.9] tracking-[-0.03em] text-white">L'histoire continue.</h2></Line>
              <Line delay={0.22}><h2 className="text-[clamp(2.5rem,8vw,7rem)] font-black leading-[0.9] tracking-[-0.03em]"><Shimmer from="#a78bfa" to="#34d399">Écrivez-la avec nous.</Shimmer></h2></Line>
            </div>
            <motion.p initial={{ opacity: 0, y: 20, filter: 'blur(6px)' }} whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }} viewport={{ once: true }} transition={{ delay: 0.4, duration: 0.8, ease: [0.16, 1, 0.3, 1] }} className="text-lg text-white/40 max-w-md mx-auto mb-14 leading-relaxed">
              Chaque entrepreneur qui rejoint CIMOLACE est un co-constructeur de l'Afrique de demain.
            </motion.p>
            <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.6, duration: 0.6 }} className="flex flex-col sm:flex-row gap-4 justify-center">
              <MagneticBtn>
                <Link to="/cimolace" className="inline-flex items-center gap-2 px-8 py-4 bg-white text-black font-bold text-sm rounded-xl hover:bg-white/90 transition-colors">
                  Explorer CIMOLACE <ArrowRight className="w-4 h-4" />
                </Link>
              </MagneticBtn>
              <MagneticBtn>
                <a href="#hero" className="inline-flex items-center gap-2 px-8 py-4 bg-white/[0.06] border border-white/[0.1] text-white font-bold text-sm rounded-xl hover:bg-white/[0.1] transition-colors">
                  <ArrowUpRight className="w-4 h-4" /> Relire l'histoire
                </a>
              </MagneticBtn>
            </motion.div>
          </div>
        </section>

        {/* Footer */}
        <div className="border-t border-white/[0.05] py-6 px-8 flex items-center justify-between max-w-[1100px] mx-auto">
          <span className="text-[11px] text-white/20">{cimolacePlatformConfig.copyrightMicro}</span>
          <Link to={cimolacePlatformConfig.routes.home} className="text-[11px] text-violet-400/60 hover:text-violet-400 transition-colors">{cimolacePlatformConfig.marketingSiteDisplay} ↗</Link>
        </div>

      </div>
    </>
  );
}

