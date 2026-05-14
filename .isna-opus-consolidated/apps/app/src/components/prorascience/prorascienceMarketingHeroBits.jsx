import React, { useMemo } from 'react';
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';

export const easePremium = [0.22, 1, 0.36, 1];

/** Styles alignés sur le hero ProrascienceCommercialPage (grille, orbes, CTA, typo shimmer). */
export const PRORASCIENCE_MARKETING_HERO_CSS = `
  .prs-forfaits-site .prs-bg-grid {
    background-image:
      linear-gradient(to right, rgba(255,255,255,0.04) 1px, transparent 1px),
      linear-gradient(to bottom, rgba(255,255,255,0.04) 1px, transparent 1px);
    background-size: 36px 36px;
    mask-image: radial-gradient(ellipse at center, black 45%, transparent 100%);
  }
  .prs-forfaits-site .prs-orb {
    filter: blur(72px);
    opacity: .24;
    animation: prsForfaitsFloat 12s ease-in-out infinite;
  }
  .prs-forfaits-site .prs-orb.alt {
    animation-duration: 15s;
    animation-delay: -2s;
  }
  @keyframes prsForfaitsFloat {
    0%, 100% { transform: translate3d(0, 0, 0) scale(1); }
    50% { transform: translate3d(0, -22px, 0) scale(1.08); }
  }
  .prs-forfaits-site .prs-light-rays {
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
  .prs-forfaits-site .prs-bg-flow {
    background: linear-gradient(
      128deg,
      rgba(111, 76, 255, 0.09) 0%,
      transparent 32%,
      rgba(15, 179, 255, 0.07) 48%,
      transparent 72%,
      rgba(212, 175, 55, 0.07) 100%
    );
    background-size: 420% 420%;
    animation: prsForfaitsFlowGrad 26s ease-in-out infinite;
  }
  @keyframes prsForfaitsFlowGrad {
    0%, 100% { background-position: 0% 40%; }
    50% { background-position: 100% 60%; }
  }
  .prs-forfaits-site .prs-dust {
    background-image: radial-gradient(circle, rgba(255,255,255,0.045) 1px, transparent 1px);
    background-size: 48px 48px;
    opacity: 0.35;
    animation: prsForfaitsDustDrift 90s linear infinite;
  }
  @keyframes prsForfaitsDustDrift {
    from { transform: translate3d(0, 0, 0); }
    to { transform: translate3d(-48px, -24px, 0); }
  }
  .prs-forfaits-site .prs-brand-shimmer {
    position: relative;
    background: linear-gradient(102deg, #c9a030 0%, #fff4c8 38%, #d4af37 62%, #8a7228 100%);
    background-size: 220% auto;
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
    -webkit-text-fill-color: transparent;
    animation: prsForfaitsShimmer 4.5s ease-in-out infinite;
  }
  @keyframes prsForfaitsShimmer {
    0%, 100% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
  }
  .prs-forfaits-site .prs-underline-gold {
    bottom: -0.1em;
    height: 2px;
    border-radius: 2px;
    background: linear-gradient(90deg, transparent, #d4af37, transparent);
    transform: scaleX(0);
    transform-origin: left center;
    animation: prsForfaitsUnderlineGrow 1.1s cubic-bezier(0.22, 1, 0.36, 1) 0.75s forwards;
  }
  @keyframes prsForfaitsUnderlineGrow {
    to { transform: scaleX(1); }
  }
  .prs-forfaits-site .prs-stars-deep {
    opacity: 0.34;
    background-image:
      radial-gradient(circle at 18% 22%, rgba(255,255,255,0.2) 0.6px, transparent 1px),
      radial-gradient(circle at 74% 18%, rgba(255,255,255,0.17) 0.7px, transparent 1.2px),
      radial-gradient(circle at 42% 78%, rgba(255,255,255,0.15) 0.6px, transparent 1px),
      radial-gradient(circle at 88% 68%, rgba(255,255,255,0.18) 0.7px, transparent 1.2px);
    background-size: 280px 280px, 320px 320px, 260px 260px, 300px 300px;
    animation: prsForfaitsStarsDrift 90s linear infinite;
  }
  @keyframes prsForfaitsStarsDrift {
    from { transform: translate3d(0, 0, 0); }
    to { transform: translate3d(-60px, -36px, 0); }
  }
  .prs-forfaits-site .prs-vital-sheen {
    background:
      radial-gradient(ellipse 45% 26% at 50% 2%, rgba(212, 175, 55, 0.09), transparent 62%),
      radial-gradient(ellipse 32% 22% at 14% 36%, rgba(111, 76, 255, 0.1), transparent 65%),
      radial-gradient(ellipse 32% 22% at 86% 62%, rgba(15, 179, 255, 0.08), transparent 65%);
    animation: prsForfaitsVitalSway 18s ease-in-out infinite;
  }
  @keyframes prsForfaitsVitalSway {
    0%, 100% { transform: translate3d(0, 0, 0) scale(1); opacity: 0.95; }
    50% { transform: translate3d(0, -1.8%, 0) scale(1.015); opacity: 1; }
  }
  .prs-forfaits-site .prs-cta-primary.ring-offset-0 {
    box-shadow: 0 6px 28px rgba(212, 175, 55, 0.35);
  }
  @media (hover: hover) {
    .prs-forfaits-site .prs-cta-primary:hover {
      box-shadow: 0 10px 42px rgba(212, 175, 55, 0.48);
      filter: brightness(1.06);
    }
  }
  .prs-forfaits-site .prs-cta-ghost {
    position: relative;
    overflow: hidden;
    transition: letter-spacing 0.35s ease, border-color 0.35s ease, background-color 0.35s ease;
  }
  .prs-forfaits-site .prs-cta-ghost::before {
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
    animation: prsForfaitsBorderTravel 3.5s linear infinite;
    pointer-events: none;
  }
  @keyframes prsForfaitsBorderTravel {
    0% { background-position: 120% 0; }
    100% { background-position: -120% 0; }
  }
  @media (hover: hover) {
    .prs-forfaits-site .prs-cta-ghost:hover::before {
      opacity: 1;
    }
    .prs-forfaits-site .prs-cta-ghost:hover {
      letter-spacing: 0.04em;
    }
  }
  .prs-forfaits-site .prs-hero-chassis {
    transform-style: preserve-3d;
    perspective: 1400px;
  }
  .prs-forfaits-site .prs-glass-sweep {
    pointer-events: none;
    overflow: hidden;
  }
  .prs-forfaits-site .prs-glass-sweep::after {
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
    animation: prsForfaitsGlassSweep 7s ease-in-out infinite;
  }
  @keyframes prsForfaitsGlassSweep {
    0%, 100% { transform: translateX(-75%) rotate(12deg); }
    50% { transform: translateX(55%) rotate(12deg); }
  }
  .prs-forfaits-site .prs-hero-img {
    transform: scale(1);
    transition: transform 12s ease-in-out;
  }
  @media (hover: hover) {
    .prs-forfaits-site .prs-hero-frame:hover .prs-hero-img {
      transform: scale(1.06);
    }
    /* object-contain (ex. cycle privilégié) : pas de zoom au survol pour ne pas recadrer l’illustration */
    .prs-forfaits-site .prs-hero-frame[data-hero-contain='true']:hover .prs-hero-img {
      transform: none;
    }
  }
  .prs-forfaits-site .prs-live-dot {
    animation: prsForfaitsLiveBlink 1.4s ease-in-out infinite;
  }
  @keyframes prsForfaitsLiveBlink {
    0%, 100% { opacity: 1; transform: scale(1); box-shadow: 0 0 0 0 rgba(248, 113, 113, 0.5); }
    50% { opacity: 0.65; transform: scale(0.92); box-shadow: 0 0 0 6px rgba(248, 113, 113, 0); }
  }
  .prs-forfaits-site .prs-wave-bar {
    transform-origin: bottom center;
    animation: prsForfaitsWave 0.95s ease-in-out infinite;
  }
  .prs-forfaits-site .prs-wave-bar:nth-child(2) { animation-delay: 0.12s; }
  .prs-forfaits-site .prs-wave-bar:nth-child(3) { animation-delay: 0.24s; }
  .prs-forfaits-site .prs-wave-bar:nth-child(4) { animation-delay: 0.08s; }
  @keyframes prsForfaitsWave {
    0%, 100% { transform: scaleY(0.35); }
    50% { transform: scaleY(1); }
  }
  @media (prefers-reduced-motion: reduce) {
    .prs-forfaits-site .prs-bg-flow,
    .prs-forfaits-site .prs-dust,
    .prs-forfaits-site .prs-brand-shimmer,
    .prs-forfaits-site .prs-glass-sweep::after,
    .prs-forfaits-site .prs-live-dot,
    .prs-forfaits-site .prs-wave-bar,
    .prs-forfaits-site .prs-stars-deep,
    .prs-forfaits-site .prs-vital-sheen,
    .prs-forfaits-site .prs-orb,
    .prs-forfaits-site .prs-cta-ghost::before {
      animation: none !important;
    }
    .prs-forfaits-site .prs-underline-gold {
      animation: none;
      transform: scaleX(1);
    }
    .prs-forfaits-site .prs-brand-shimmer {
      color: #d4af37;
      -webkit-text-fill-color: #d4af37;
      background: none;
    }
  }
`;

export function WordBlurReveal({ text, className, delayStep = 0.065, baseDelay = 0 }) {
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

export function BrandShimmerWord({ text }) {
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

export function PremiumPressable({ children, className = '' }) {
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

export function MarketingParallaxOrbs() {
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
      <motion.div
        className="prs-light-rays pointer-events-none absolute left-1/2 top-[6%] h-[135vh] w-[135vh] -translate-x-1/2 md:top-[4%]"
        style={{ rotate: rays }}
        aria-hidden
      />
    </>
  );
}

export function MarketingAmbientLayers() {
  return (
    <>
      <div className="pointer-events-none absolute inset-0 z-0 prs-bg-grid" />
      <div className="pointer-events-none absolute inset-0 z-0 prs-stars-deep" aria-hidden />
      <div className="pointer-events-none absolute inset-0 z-0 prs-bg-flow" aria-hidden />
      <div className="pointer-events-none absolute inset-0 z-0 prs-vital-sheen" aria-hidden />
      <div className="pointer-events-none absolute inset-0 z-0 prs-dust" aria-hidden />
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <MarketingParallaxOrbs />
      </div>
    </>
  );
}
