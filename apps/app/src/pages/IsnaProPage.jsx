import React, { useCallback, useState } from 'react';
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { Link } from 'react-router-dom';
import SEO from '@/components/SEO';
import { FOUNDER_IMAGE_SOURCES, FOUNDER_PORTRAIT_ALT } from '@/lib/founderImageSources';
import { WEB_ISNA_PRO } from '@/data/prorascienceVitrineFromWebContent';
import { activeTenantConfig as isnaTenantConfig } from '@/lib/tenant/activeTenantConfig';

const HERO_PILLAR_META = [
  {
    icon: '🛕',
    iconGlow: 'from-amber-200/25 via-amber-400/15 to-transparent shadow-[0_0_32px_rgba(251,191,36,0.35)]',
  },
  {
    icon: '🌐',
    iconGlow: 'from-sky-300/30 via-blue-500/15 to-transparent shadow-[0_0_28px_rgba(56,189,248,0.3)]',
  },
  {
    icon: '🧠',
    iconGlow: 'from-violet-300/25 via-indigo-500/15 to-transparent shadow-[0_0_28px_rgba(167,139,250,0.28)]',
  },
];
const FUTURE_PEDAGOGY_META = [
  { icon: '🎥', iconGlow: 'from-amber-200/20 via-amber-500/10 to-transparent' },
  { icon: '🧠', iconGlow: 'from-sky-300/20 via-cyan-500/10 to-transparent' },
  { icon: '✨', iconGlow: 'from-violet-300/20 via-fuchsia-500/10 to-transparent' },
  { icon: '🌍', iconGlow: 'from-emerald-300/20 via-teal-500/10 to-transparent' },
];
const VOICE_AVATARS = [
  'https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=240&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=240&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?q=80&w=240&auto=format&fit=crop',
];

const heroPillars = WEB_ISNA_PRO.heroPillars.map((p, i) => ({
  ...HERO_PILLAR_META[i],
  title: p.title,
  body: p.body,
}));

export default function IsnaProPage() {
  const reduce = useReducedMotion();
  const [founderSrcIndex, setFounderSrcIndex] = useState(0);
  const [founderImageFailed, setFounderImageFailed] = useState(false);
  const founderImageSrc = founderImageFailed ? null : FOUNDER_IMAGE_SOURCES[founderSrcIndex];
  const onFounderImageError = useCallback(() => {
    setFounderSrcIndex((i) => {
      const next = i + 1;
      if (next < FOUNDER_IMAGE_SOURCES.length) return next;
      setFounderImageFailed(true);
      return i;
    });
  }, []);
  // Désactivé pour améliorer les performances - parallax non critique
  // const { scrollYProgress } = useScroll();
  // const parallaxTop = useTransform(scrollYProgress, [0, 1], ['-8%', '12%']);
  // const parallaxBottom = useTransform(scrollYProgress, [0, 1], ['8%', '-12%']);
  const futurePedagogy = WEB_ISNA_PRO.futurePedagogy.map((f, i) => ({
    ...FUTURE_PEDAGOGY_META[i],
    title: f.title,
    desc: f.desc,
  }));

  const storyHeroImage = '/image-pro/isna-pro-rituel-compris-cinematic.png';

  const mastery = WEB_ISNA_PRO.mastery;

  const members = WEB_ISNA_PRO.voices.map((v, i) => ({
    name: v.name,
    role: v.role,
    quote: v.quote,
    avatar: VOICE_AVATARS[i] || VOICE_AVATARS[0],
  }));

  const membersMarquee = [
    ...members,
    {
      name: 'Yao M.',
      role: 'Eleve ISNA - Suisse',
      quote: 'Jai gagne en confiance et en precision dans ma pratique.',
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=240&auto=format&fit=crop',
    },
    {
      name: 'Linda E.',
      role: 'Membre ISNA - UK',
      quote: "La progression est claire, moderne, et vraiment immersive.",
      avatar: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?q=80&w=240&auto=format&fit=crop',
    },
  ];

  return (
    <div className="min-h-screen overflow-x-hidden bg-black text-white">
      <SEO
        title={`ISNA Pro — ${isnaTenantConfig.branding.name}`}
        description="ISNA Pro : école initiatique moderne, pédagogie immersive et compréhension des lois invisibles."
      />
      <style>{`
        .isna-grid-bg {
          background-image:
            linear-gradient(rgba(255,255,255,0.075) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.075) 1px, transparent 1px);
          background-size: 48px 48px;
        }
        .isna-wave {
          transform-origin: bottom;
          animation: isnaWave 1.2s ease-in-out infinite;
        }
        .isna-wave:nth-child(2) { animation-delay: .12s; }
        .isna-wave:nth-child(3) { animation-delay: .24s; }
        .isna-wave:nth-child(4) { animation-delay: .08s; }
        @keyframes isnaWave {
          0%, 100% { transform: scaleY(0.35); opacity: .55; }
          50% { transform: scaleY(1); opacity: 1; }
        }
        .isna-marquee {
          overflow: hidden;
          mask-image: linear-gradient(to right, transparent, black 9%, black 91%, transparent);
        }
        .isna-marquee-track {
          display: flex;
          width: max-content;
          animation: isnaMarquee 28s linear infinite;
        }
        @keyframes isnaMarquee {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        .isna-ritual-frame {
          position: relative;
          overflow: hidden;
          border-radius: 1.5rem;
          border: 1px solid rgba(255,255,255,0.1);
          background: radial-gradient(circle at 50% 40%, rgba(212,175,55,0.18), rgba(255,255,255,0.02) 42%, rgba(0,0,0,0.6) 100%);
        }
        .isna-ritual-img {
          position: relative;
          z-index: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          animation: isnaKenBurns 14s ease-in-out infinite alternate;
          filter: saturate(1.04) contrast(1.03);
          transform-origin: 52% 44%;
        }
        @keyframes isnaKenBurns {
          from { transform: scale(1) translate3d(0, 0, 0); }
          to { transform: scale(1.13) translate3d(-1.8%, -1.2%, 0); }
        }
        .isna-ritual-img--cinematic {
          animation-name: isnaKenBurnsCinematic;
          animation-duration: 16s;
          transform-origin: 48% 42%;
        }
        @keyframes isnaKenBurnsCinematic {
          from { transform: scale(1.02) translate3d(0.6%, 0, 0); }
          to { transform: scale(1.19) translate3d(-2.4%, -1.6%, 0); }
        }
        .isna-ritual-img--mystical {
          animation-duration: 18s;
          filter: saturate(1.06) contrast(1.1) brightness(0.88);
          transform-origin: 50% 58%;
        }
        .isna-ritual-frame--monde-avant {
          border-color: rgba(212, 175, 55, 0.28);
          box-shadow:
            0 0 0 1px rgba(212, 175, 55, 0.06),
            0 28px 80px rgba(0, 0, 0, 0.75),
            0 0 70px rgba(212, 175, 55, 0.07);
        }
        .isna-mystical-gold-veil {
          position: absolute;
          inset: 0;
          z-index: 2;
          pointer-events: none;
          background:
            radial-gradient(circle at 18% 22%, rgba(212, 175, 55, 0.18) 0%, transparent 42%),
            radial-gradient(circle at 82% 28%, rgba(244, 208, 79, 0.12) 0%, transparent 38%),
            radial-gradient(circle at 55% 88%, rgba(212, 175, 55, 0.1) 0%, transparent 45%),
            repeating-conic-gradient(from 0deg at 50% 50%, transparent 0deg 8deg, rgba(212, 175, 55, 0.025) 8deg 9deg);
          opacity: 0.88;
          mix-blend-mode: screen;
          animation: isnaMysticalGlow 10s ease-in-out infinite alternate;
        }
        @keyframes isnaMysticalGlow {
          from { opacity: 0.55; }
          to { opacity: 0.95; }
        }
        @keyframes isnaMysticalEmber {
          0%, 100% { opacity: 0.25; transform: translateY(0) scale(1); }
          50% { opacity: 1; transform: translateY(-14px) scale(1.25); }
        }
        .isna-mystical-ember {
          position: absolute;
          z-index: 4;
          width: 5px;
          height: 5px;
          border-radius: 9999px;
          background: #f4d03f;
          box-shadow: 0 0 10px #d4af37, 0 0 22px rgba(212, 175, 55, 0.45);
          animation: isnaMysticalEmber 3.8s ease-in-out infinite;
        }
        .isna-mystical-smoke {
          position: absolute;
          inset: 0;
          z-index: 3;
          pointer-events: none;
          background: linear-gradient(
            118deg,
            transparent 35%,
            rgba(255, 255, 255, 0.045) 48%,
            transparent 62%
          );
          background-size: 220% 100%;
          mix-blend-mode: soft-light;
          animation: isnaMysticalSmoke 18s linear infinite;
        }
        @keyframes isnaMysticalSmoke {
          from { background-position: 0% 50%; }
          to { background-position: 100% 50%; }
        }
        .isna-ritual-overlay {
          position: absolute;
          inset: 0;
          z-index: 1;
          background: linear-gradient(to top, rgba(0,0,0,.65), rgba(0,0,0,.08) 45%, rgba(0,0,0,.45));
        }
        @keyframes isnaFounderPortraitZoom {
          from { transform: scale(1) translate3d(0, 0, 0); }
          to { transform: scale(1.14) translate3d(0, -1.2%, 0); }
        }
        .isna-founder-portrait-zoom {
          animation: isnaFounderPortraitZoom 22s ease-in-out infinite alternate;
          transform-origin: 50% 32%;
          will-change: transform;
        }
        @keyframes isnaFounderFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-14px); }
        }
        .isna-founder-float {
          animation: isnaFounderFloat 5.5s ease-in-out infinite;
          will-change: transform;
        }
        @media (prefers-reduced-motion: reduce) {
          .isna-marquee-track {
            animation: none;
          }
          .isna-ritual-img,
          .isna-ritual-img--cinematic,
          .isna-ritual-img--mystical {
            animation: none;
            transform: scale(1.03);
          }
          .isna-mystical-gold-veil {
            animation: none;
            opacity: 0.72;
          }
          .isna-mystical-ember {
            animation: none;
            opacity: 0.55;
          }
          .isna-mystical-smoke {
            animation: none;
          }
          .isna-founder-portrait-zoom {
            animation: none;
            transform: none;
            will-change: auto;
          }
          .isna-founder-float {
            animation: none;
            will-change: auto;
          }
        }
      `}</style>

      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <motion.div
          className="absolute left-[8%] top-20 h-40 w-40 rounded-full bg-blue-500/10 blur-3xl"
          animate={{ y: [0, 24, 0], x: [0, 16, 0] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute right-[12%] top-28 h-52 w-52 rounded-full bg-violet-500/10 blur-3xl"
          animate={{ y: [0, -20, 0], x: [0, -14, 0] }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
        />
        <div className="isna-grid-bg absolute inset-0 opacity-[0.06]" />
      </div>

      <header className="sticky top-0 z-50 border-b border-white/10 bg-black/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/10">P</div>
            <div>
              <div className="text-lg font-semibold tracking-tight">{isnaTenantConfig.branding.name}</div>
              <div className="text-xs text-white/45">LIRI · École initiatique moderne</div>
            </div>
          </div>
          <nav className="hidden gap-8 text-sm text-white/65 lg:flex">
            <a href="#vision" className="hover:text-white">Vision</a>
            <a href="#ecole" className="hover:text-white">L&apos;école</a>
            <a href="#rupture" className="hover:text-white">Rupture</a>
            <a href="#pedagogie" className="hover:text-white">Pédagogie</a>
            <a href="#maitrise" className="hover:text-white">Maîtrise</a>
            <a href="#entrer" className="hover:text-white">Entrer</a>
          </nav>
          <div className="flex items-center gap-3">
            <button className="hidden rounded-full border border-white/15 px-4 py-2 text-sm text-white/80 hover:bg-white/10 md:inline-flex">Voir le système</button>
            <Link to="/signup" className="rounded-full bg-white px-5 py-2 text-sm font-medium text-black hover:bg-white/90">Entrer</Link>
          </div>
        </div>
      </header>

      <main>
        <section id="vision" className="relative overflow-hidden border-b border-white/10 bg-black">
          <div className="mx-auto max-w-4xl px-6 pb-6 pt-20 text-center sm:pb-8 sm:pt-28 lg:pt-32">
            <motion.h1
              className="text-balance text-4xl font-semibold leading-tight tracking-tight sm:text-5xl lg:text-[2.75rem] xl:text-6xl"
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.75 }}
            >
              L'initiation n\'est plus un lieu. C\'est un accès.
            </motion.h1>
            <motion.p
              className="mx-auto mt-6 max-w-2xl text-pretty text-base leading-relaxed text-white/72 sm:text-lg lg:text-xl"
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.65, delay: 0.06 }}
            >
              Accédez aux cours initiatiques en immersion, sans déplacement, grâce à LIRI.
            </motion.p>
            <motion.div
              className="mt-10 flex flex-wrap items-center justify-center gap-4"
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.12 }}
            >
              <Link
                to="/signup"
                className="rounded-full bg-white px-7 py-3 text-sm font-medium text-black transition hover:scale-[1.02]"
              >
                Entrer dans l'école
              </Link>
              <a
                href="#pedagogie"
                className="rounded-full border border-white/18 px-7 py-3 text-sm font-medium text-white/90 transition hover:bg-white/10"
              >
                Découvrir la pédagogie
              </a>
            </motion.div>
          </div>

          <div className="relative mx-auto max-w-5xl px-6 pb-6 lg:max-w-6xl">
            <div className="pointer-events-none absolute inset-x-0 top-[42%] z-0 -translate-y-1/2">
              <div
                className="mx-auto h-px w-[min(94%,48rem)] bg-gradient-to-r from-transparent via-blue-200/35 to-transparent opacity-90 blur-[1px]"
                aria-hidden
              />
              <div
                className="mx-auto mt-0 h-px w-[min(88%,40rem)] bg-gradient-to-r from-transparent via-amber-200/25 to-transparent opacity-70"
                aria-hidden
              />
              <div
                className="mx-auto -mt-10 h-28 w-[min(100%,52rem)] bg-[radial-gradient(ellipse_90%_80%_at_50%_60%,rgba(59,130,246,0.22),transparent_55%)] blur-3xl"
                aria-hidden
              />
              <div
                className="mx-auto -mt-20 h-20 w-[min(90%,36rem)] bg-[radial-gradient(ellipse_80%_100%_at_50%_100%,rgba(251,191,36,0.14),transparent_60%)] blur-2xl"
                aria-hidden
              />
            </div>
            <motion.div
              className="relative z-10 mx-auto max-w-4xl"
              initial={{ opacity: 0, y: 32 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.85, delay: 0.05 }}
            >
              <img
                src="/image-pro/liri-hero-devices.png"
                alt="LIRI sur ordinateur et smartphone : interface live avec cours initiatique en vidéo"
                className="mx-auto w-full object-contain drop-shadow-[0_32px_64px_rgba(0,0,0,0.75)]"
                loading="eager"
                fetchPriority="high"
              />
            </motion.div>
          </div>

          <div className="mx-auto grid max-w-6xl gap-12 px-6 pb-24 pt-10 md:grid-cols-3 md:gap-10 md:pb-28">
            {heroPillars.map((pillar, i) => (
              <motion.div
                key={pillar.title}
                className="text-center md:text-left"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.35 }}
                transition={{ duration: 0.65, delay: i * 0.1 }}
              >
                <motion.div
                  className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/12 bg-gradient-to-br ${pillar.iconGlow} text-2xl md:mx-0`}
                  animate={reduce ? {} : { y: [0, -6, 0], scale: [1, 1.04, 1] }}
                  transition={{ duration: 3 + i * 0.4, repeat: Infinity, ease: 'easeInOut', delay: i * 0.2 }}
                  aria-hidden
                >
                  {pillar.icon}
                </motion.div>
                <h2 className="text-lg font-semibold tracking-tight sm:text-xl">{pillar.title}</h2>
                <p className="mt-3 text-sm leading-relaxed text-white/65 sm:text-base">{pillar.body}</p>
              </motion.div>
            ))}
          </div>
        </section>

        <section id="ecole" className="relative overflow-hidden border-b border-white/10">
          <div className="absolute inset-0 bg-black" aria-hidden />
          <div className="absolute inset-0">
            {founderImageSrc ? (
              <img
                src={founderImageSrc}
                alt=""
                onError={onFounderImageError}
                className="h-full min-h-[520px] w-full scale-105 object-cover object-[center_22%] opacity-[0.38]"
                aria-hidden
              />
            ) : null}
            <div className="absolute inset-0 bg-gradient-to-b from-black via-black/[0.88] to-black" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_75%_55%_at_50%_38%,transparent_0%,rgba(0,0,0,0.9)_72%)]" />
          </div>
          <div className="relative z-10 mx-auto max-w-7xl px-6 py-20 sm:py-28">
            <motion.div
              className="mb-12 text-center lg:mb-14"
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.7 }}
            >
              <p className="text-sm uppercase tracking-[0.35em] text-amber-200/75">L&apos;école</p>
              <h2 className="mt-4 text-balance text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl">
                Le fondateur
              </h2>
            </motion.div>
            <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,440px)_1fr] lg:gap-20 xl:grid-cols-[minmax(0,500px)_1fr]">
              <motion.figure
                className="mx-auto w-full max-w-[min(100%,420px)] sm:max-w-[460px] lg:mx-0 lg:max-w-none"
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.25 }}
                transition={{ duration: 0.7 }}
              >
                <div className={reduce ? '' : 'isna-founder-float'}>
                  <div className="relative overflow-hidden rounded-[1.75rem] border border-white/18 bg-zinc-900/40 shadow-[0_36px_90px_rgba(0,0,0,.72)] ring-1 ring-white/10">
                    {founderImageSrc ? (
                      <>
                        <div className="relative aspect-[3/4] w-full overflow-hidden">
                          <img
                            src={founderImageSrc}
                            alt={FOUNDER_PORTRAIT_ALT}
                            onError={onFounderImageError}
                            className="isna-founder-portrait-zoom absolute inset-0 h-full w-full object-cover object-[center_20%]"
                            loading="lazy"
                          />
                        </div>
                        <div
                          className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-28 bg-gradient-to-t from-black/55 to-transparent sm:h-32"
                          aria-hidden
                        />
                      </>
                    ) : (
                    <div className="flex aspect-[3/4] flex-col items-center justify-center gap-3 bg-zinc-950 p-6 text-center">
                      <p className="text-xs text-white/55">
                        Ajoutez <code className="rounded bg-white/10 px-1 py-0.5 text-amber-200/90">founder.jpg</code> ou{' '}
                        <code className="rounded bg-white/10 px-1 py-0.5 text-amber-200/90">founder.png</code> dans{' '}
                        <code className="rounded bg-white/10 px-1 py-0.5">public/</code>.
                      </p>
                    </div>
                  )}
                  </div>
                </div>
                <figcaption className="mt-5 text-center text-sm text-white/50 lg:text-left">
                  <span className="font-medium text-white/70">Fondateur</span>
                  <span className="text-white/35"> · </span>
                  {`${isnaTenantConfig.branding.name} · LIRI`}
                </figcaption>
              </motion.figure>
              <motion.div
                className="text-center lg:text-left"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.25 }}
                transition={{ duration: 0.7, delay: 0.06 }}
              >
                <p className="text-pretty text-base leading-relaxed text-white/72 sm:text-lg">
                  {`Derrière ${isnaTenantConfig.branding.name} et LIRI, une même exigence : rendre l'initiation structurée, intelligible et transmissible — sans diluer sa profondeur. Découvrez le parcours, la vision et le mandat du fondateur.`}
                </p>
                <Link
                  to="/a-propos/fondateur"
                  className="mt-8 inline-flex rounded-full border border-white/20 bg-white/10 px-8 py-3 text-sm font-medium text-white transition hover:border-white/35 hover:bg-white/15"
                >
                  À propos du fondateur
                </Link>
              </motion.div>
            </div>
          </div>
        </section>

        <section id="histoire" className="mx-auto max-w-7xl px-6 py-20 sm:py-24">
          <motion.div
            className="relative overflow-hidden rounded-[2.25rem] border border-white/15 bg-black shadow-[0_40px_110px_rgba(0,0,0,0.65)]"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.25 }}
            transition={{ duration: 0.85 }}
          >
            <img
              src={storyHeroImage}
              alt="Scène rituelle africaine nocturne autour du feu : ambiance noire et cinématique."
              className={`absolute inset-0 h-full w-full object-cover object-[62%_52%] ${reduce ? '' : 'isna-ritual-img isna-ritual-img--mystical'}`}
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-black/95 via-black/80 to-black/35" aria-hidden />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/45" aria-hidden />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_68%_52%,rgba(212,175,55,0.18),transparent_62%)]" aria-hidden />
            <div className="pointer-events-none absolute inset-y-0 left-[44%] right-0 z-[2] overflow-hidden rounded-[inherit]" aria-hidden>
              <div className="isna-mystical-gold-veil" />
              <div className="isna-mystical-smoke" />
              {[
                { t: '14%', l: '18%', d: '0s' },
                { t: '22%', l: '78%', d: '0.6s' },
                { t: '48%', l: '24%', d: '1.1s' },
                { t: '62%', l: '88%', d: '0.3s' },
                { t: '38%', l: '52%', d: '1.8s' },
                { t: '72%', l: '40%', d: '0.9s' },
              ].map((p, i) => (
                <span key={i} className="isna-mystical-ember" style={{ top: p.t, left: p.l, animationDelay: p.d }} />
              ))}
            </div>

            <div className="relative z-[3] min-h-[22rem] p-6 sm:min-h-[24rem] sm:p-8 lg:min-h-[26rem] lg:p-10">
              <div className="max-w-2xl rounded-2xl border border-white/10 bg-black/38 p-4 backdrop-blur-[1px] sm:p-6 lg:pb-7">
                <p className="text-sm uppercase tracking-[0.3em] text-white/65">Une histoire</p>
                <div className="mt-4 space-y-2 text-lg text-amber-100/90 sm:text-2xl">
                  <p>👁️ Recevez les yeux pour voir</p>
                  <p>✋ Recevez les oreilles pour comprendre</p>
                </div>
                <h2 className="mt-6 text-balance text-4xl font-semibold leading-[1.05] tracking-tight text-white [text-shadow:0_1px_10px_rgba(0,0,0,0.75)] sm:text-5xl lg:text-[3.2rem]">
                  Vous avez pratiqué.
                  <br />
                  Mais avez-vous compris...
                  <br />
                  ce que vous faisiez ?
                </h2>
                <p className="mt-6 max-w-lg text-pretty text-lg leading-relaxed text-white/88">
                  Ce que vous avez appris sans explication, nous vous l&apos;enseignons avec méthode.
                </p>
                <div className="mt-8 flex flex-wrap items-center gap-4">
                  <Link to="/signup" className="rounded-full bg-white px-8 py-3 text-sm font-semibold text-black transition hover:bg-white/90">
                    Entrer dans l&apos;école
                  </Link>
                  <a href="#pedagogie" className="rounded-full border border-white/30 bg-black/25 px-8 py-3 text-sm font-medium text-white transition hover:bg-white/10">
                    Voir une démonstration
                  </a>
                </div>
              </div>
            </div>
          </motion.div>
        </section>

        <section className="border-y border-white/10 bg-white/[0.02] py-24 sm:py-32">
          <div className="mx-auto max-w-7xl px-6">
            <div className="mb-12 text-center">
              <p className="text-sm uppercase tracking-[0.35em] text-white/40">Membres & temoignages</p>
              <h2 className="mt-4 text-4xl font-semibold tracking-tight sm:text-6xl">Une communaute vivante, pas une simple video.</h2>
            </div>
            <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
              <motion.div
                className="rounded-[2rem] border border-white/10 bg-gradient-to-br from-[#091023] to-[#03070f] p-6"
                initial={{ opacity: 0, y: 28 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
              >
                <div className="mb-4 flex items-center justify-between">
                  <p className="text-sm uppercase tracking-[0.22em] text-white/45">Video live ISNA</p>
                  <span className="rounded-full border border-red-400/40 bg-red-400/15 px-3 py-1 text-[11px] text-red-200">LIVE</span>
                </div>
                <div className="relative aspect-video overflow-hidden rounded-2xl border border-white/10 bg-black/50">
                  <img
                    src="https://images.unsplash.com/photo-1523240795612-9a054b0db644?q=80&w=1280&auto=format&fit=crop"
                    alt="Cours immersif ISNA"
                    className="h-full w-full object-cover opacity-80"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                  <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between rounded-xl border border-white/15 bg-black/45 px-4 py-3 text-xs text-white/85 backdrop-blur">
                    <span>Temoignage en direct + interpretation multilingue</span>
                    <span className="flex h-5 items-end gap-1">
                      <span className="isna-wave h-3 w-1 rounded-full bg-[var(--school-accent)]" />
                      <span className="isna-wave h-5 w-1 rounded-full bg-[var(--school-accent)]" />
                      <span className="isna-wave h-4 w-1 rounded-full bg-[var(--school-accent)]" />
                      <span className="isna-wave h-6 w-1 rounded-full bg-[var(--school-accent)]" />
                    </span>
                  </div>
                </div>
              </motion.div>
              <div className="space-y-4">
                {members.map((m, i) => (
                  <motion.div
                    key={m.name}
                    className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
                    initial={{ opacity: 0, x: 30 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1 }}
                  >
                    <div className="flex items-center gap-3">
                      <img src={m.avatar} alt={m.name} className="h-12 w-12 rounded-full border border-white/20 object-cover" loading="lazy" />
                      <div>
                        <p className="font-semibold">{m.name}</p>
                        <p className="text-xs text-white/55">{m.role}</p>
                      </div>
                    </div>
                    <p className="mt-3 text-sm leading-relaxed text-white/75">"{m.quote}"</p>
                  </motion.div>
                ))}
              </div>
            </div>
            <div className="isna-marquee mt-10">
              <div className="isna-marquee-track gap-3">
                {[...membersMarquee, ...membersMarquee].map((m, idx) => (
                  <div key={`${m.name}-${idx}`} className="flex w-[260px] shrink-0 items-center gap-3 rounded-xl border border-white/10 bg-black/35 px-3 py-2">
                    <img src={m.avatar} alt={m.name} className="h-10 w-10 rounded-full border border-white/20 object-cover" />
                    <div>
                      <p className="text-sm font-semibold">{m.name}</p>
                      <p className="text-[11px] text-white/55">{m.role}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="rupture" className="border-y border-white/10 bg-white/[0.02] py-24 sm:py-32">
          <div className="mx-auto max-w-7xl px-6">
            <div className="text-center">
              <p className="text-sm uppercase tracking-[0.35em] text-white/40">La rupture</p>
              <h2 className="mt-4 text-4xl font-semibold tracking-tight sm:text-6xl">Avant, il fallait voyager. Aujourd'hui, une connexion suffit.</h2>
            </div>
            <div className="mt-16 grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
              <div className="rounded-[2rem] border border-white/10 bg-black/40 p-8">
                <div className="text-sm uppercase tracking-[0.35em] text-white/35">Avant</div>
                <ul className="mt-8 space-y-5 text-lg text-white/70">
                  <li>Quitter l'Europe.</li>
                  <li>Retourner au village.</li>
                  <li>Chercher un initié.</li>
                  <li>Attendre des années.</li>
                </ul>
              </div>
              <div className="rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.2),transparent_28%),linear-gradient(to_bottom,#0f172a,#020617)] p-8">
                <div className="text-sm uppercase tracking-[0.35em] text-white/35">Aujourd'hui</div>
                <div className="mt-5 overflow-hidden rounded-2xl border border-white/10">
                  <img
                    src="/image-pro/aprendre-a-distance.png"
                    alt="Apprentissage spirituel a distance entre diaspora et guide traditionnel"
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                </div>
                <h3 className="mt-4 text-4xl font-semibold tracking-tight">Le temple est chez vous.</h3>
                <p className="mt-6 max-w-2xl text-lg leading-8 text-white/70">Depuis votre téléphone ou votre ordinateur, vous accédez à une école initiatique moderne, partout dans le monde.</p>
              </div>
            </div>
          </div>
        </section>

        <section id="pedagogie" className="mx-auto max-w-7xl px-6 py-24 sm:py-32">
          <div className="text-center">
            <p className="text-sm uppercase tracking-[0.35em] text-white/40">La pédagogie du futur</p>
            <h2 className="mt-4 text-4xl font-semibold tracking-tight sm:text-6xl">Une expérience complète pour apprendre autrement.</h2>
          </div>
          <div className="mt-16 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            {futurePedagogy.map((item) => (
              <motion.div key={item.title} className="rounded-[1.75rem] border border-white/10 bg-white/[0.03] p-6" whileHover={{ y: -8, scale: 1.01 }} transition={{ type: 'spring', stiffness: 220, damping: 18 }}>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-lg">{item.icon}</div>
                <h3 className="mt-6 text-2xl font-medium tracking-tight">{item.title}</h3>
                <p className="mt-4 text-base leading-7 text-white/65">{item.desc}</p>
              </motion.div>
            ))}
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-4">
            {[
              { label: 'Présence live', value: 92 },
              { label: 'Clarté pédagogique', value: 88 },
              { label: 'Autonomie acquise', value: 81 },
              { label: 'Continuité mobile', value: 94 },
            ].map((g) => (
              <div key={g.label} className="rounded-xl border border-white/10 bg-black/30 p-4">
                <div className="mb-2 flex items-center justify-between text-xs text-white/55">
                  <span>{g.label}</span>
                  <span>{g.value}%</span>
                </div>
                <div className="h-2 rounded-full bg-white/10">
                  <motion.div
                    className="h-2 rounded-full bg-gradient-to-r from-[#6f4cff] via-[#0fb3ff] to-[var(--school-accent)]"
                    initial={{ width: 0 }}
                    whileInView={{ width: `${g.value}%` }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.9 }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section id="maitrise" className="border-y border-white/10 bg-white/[0.02] py-24 sm:py-32">
          <div className="mx-auto max-w-7xl px-6">
            <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr]">
              <div>
                <p className="text-sm uppercase tracking-[0.35em] text-white/40">La maîtrise</p>
                <h2 className="mt-4 text-4xl font-semibold tracking-tight sm:text-6xl">Vous n'apprenez plus seulement des gestes.</h2>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {mastery.map((item) => (
                  <motion.div key={item} className="rounded-[1.4rem] border border-white/10 bg-black/35 p-5 text-lg text-white/80" whileHover={{ y: -4 }}>
                    {item}
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="entrer" className="mx-auto max-w-6xl px-6 pb-24 sm:pb-32">
          <motion.div className="rounded-[2.75rem] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.35),transparent_28%),linear-gradient(to-right,#111827,#312e81)] px-8 py-16 text-center" initial={{ opacity: 0, scale: 0.98 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }}>
            <p className="text-sm uppercase tracking-[0.35em] text-white/45">{`Entrer dans ${isnaTenantConfig.branding.name}`}</p>
            <h2 className="mt-4 text-4xl font-semibold tracking-tight sm:text-6xl">
              Le temple n'est plus un lieu.
              <br />
              C'est un accès.
            </h2>
            <div className="mt-10 flex flex-wrap justify-center gap-4">
              <Link to="/signup" className="rounded-full bg-white px-7 py-3 text-sm font-medium text-black hover:bg-white/90">Entrer dans l'école</Link>
              <a href="#vision" className="rounded-full border border-white/20 px-7 py-3 text-sm font-medium text-white hover:bg-white/10">Voir la démonstration</a>
            </div>
          </motion.div>
        </section>
      </main>
    </div>
  );
}
