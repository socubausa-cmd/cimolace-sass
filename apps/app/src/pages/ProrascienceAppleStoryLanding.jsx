import { useState, useRef, useCallback } from 'react';
import { motion, useScroll, useTransform, useReducedMotion } from 'framer-motion';
import { Sparkles, Video, LayoutGrid, Bot, Languages, Users, MessageCircle, GraduationCap } from 'lucide-react';
import { FOUNDER_IMAGE_SOURCES, FOUNDER_PORTRAIT_ALT } from '@/lib/founderImageSources';

/**
 * Témoignages : vidéo YouTube par défaut = extrait libre (Blender Foundation, CC).
 * Remplaçable par `VITE_PRORASCIENCE_APPLE_STORY_YOUTUBE_ID` dans `.env` (ID seul).
 */
const DEFAULT_TESTIMONIAL_YOUTUBE_ID = 'eRsGyueVLvQ';
const envTestimonialYoutubeId = String(import.meta.env.VITE_PRORASCIENCE_APPLE_STORY_YOUTUBE_ID || '').trim();
const testimonialYoutubeId = envTestimonialYoutubeId || DEFAULT_TESTIMONIAL_YOUTUBE_ID;

/** Suit la souris : halo type spotlight (désactivé si reduceMotion). */
function SpotlightZone({ children, className = '', disabled = false, radiusPx = 520, tone = 'light' }) {
  const ref = useRef(null);
  const [spot, setSpot] = useState({ x: 0, y: 0, on: false });

  const onMove = useCallback(
    (e) => {
      if (disabled) return;
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setSpot({ x: e.clientX - r.left, y: e.clientY - r.top, on: true });
    },
    [disabled],
  );

  const onLeave = useCallback(() => {
    setSpot((s) => ({ ...s, on: false }));
  }, []);

  const gradient =
    tone === 'dark'
      ? `radial-gradient(${radiusPx}px circle at ${spot.x}px ${spot.y}px, rgba(255,255,255,0.14), transparent 58%)`
      : `radial-gradient(${radiusPx}px circle at ${spot.x}px ${spot.y}px, rgba(59,130,246,0.18), transparent 58%)`;

  return (
    <div
      ref={ref}
      className={`relative ${className}`}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
    >
      {!disabled && (
        <div
          className="pointer-events-none absolute inset-0 z-[1] rounded-[inherit] transition-opacity duration-300"
          style={{
            opacity: spot.on ? 1 : 0,
            background: gradient,
          }}
          aria-hidden
        />
      )}
      <div className="relative z-[2]">{children}</div>
    </div>
  );
}

/** Parallaxe léger au scroll sur le contenu de la section. */
function ParallaxSection({ id, className = '', children, intensity = 22 }) {
  const ref = useRef(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const y = useTransform(scrollYProgress, [0, 1], reduce ? [0, 0] : [intensity, -intensity]);

  return (
    <section ref={ref} id={id} className={className}>
      <motion.div style={{ y }} className="will-change-transform">
        {children}
      </motion.div>
    </section>
  );
}

/** Bloc image hero : spotlight + parallaxe scroll + zoom / flottement CSS sur l'image. */
function HeroParallaxSpotlight({ src, alt, reduce }) {
  const wrapRef = useRef(null);
  const { scrollYProgress } = useScroll({ target: wrapRef, offset: ['start end', 'end start'] });
  const y = useTransform(scrollYProgress, [0, 1], reduce ? [0, 0] : [48, -48]);

  return (
    <SpotlightZone disabled={reduce} className="rounded-[2rem]">
      <div
        ref={wrapRef}
        className="overflow-hidden rounded-[2rem] border border-black/5 bg-white shadow-[0_20px_80px_rgba(15,23,42,0.08)]"
      >
        <motion.div style={{ y }}>
          <img
            src={src}
            alt={alt}
            className="apple-hero-zoom-float aspect-[16/10] w-full object-cover object-center sm:aspect-[2/1] lg:aspect-auto lg:max-h-[min(52vh,560px)]"
            loading="eager"
          />
        </motion.div>
      </div>
    </SpotlightZone>
  );
}

function SmallParallaxMedia({ children, reduce, className = '' }) {
  const wrapRef = useRef(null);
  const { scrollYProgress } = useScroll({ target: wrapRef, offset: ['start end', 'end start'] });
  const y = useTransform(scrollYProgress, [0, 1], reduce ? [0, 0] : [18, -18]);

  return (
    <div ref={wrapRef} className={`overflow-hidden ${className}`}>
      <motion.div style={{ y }} className="h-full w-full">
        {children}
      </motion.div>
    </div>
  );
}

function MemberAvatar({ photo, initials }) {
  const [broken, setBroken] = useState(false);
  if (broken || !photo) {
    return (
      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-violet-600 text-sm font-bold text-white ring-2 ring-white shadow-md">
        {initials}
      </div>
    );
  }
  return (
    <img
      src={photo}
      alt=""
      className="h-14 w-14 shrink-0 rounded-full object-cover ring-2 ring-blue-100 shadow-md"
      loading="lazy"
      onError={() => setBroken(true)}
    />
  );
}

function AnimatedSectionIcon({ Icon, reduce }) {
  if (reduce) {
    return (
      <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600/15 to-violet-600/15 text-blue-700">
        <Icon className="h-5 w-5" strokeWidth={1.75} />
      </span>
    );
  }
  return (
    <motion.span
      className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600/15 to-violet-600/15 text-blue-700"
      animate={{ y: [0, -5, 0], rotate: [0, -4, 4, 0] }}
      transition={{ duration: 4.2, repeat: Infinity, ease: 'easeInOut' }}
    >
      <motion.span
        animate={{ scale: [1, 1.12, 1] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
      >
        <Icon className="h-5 w-5" strokeWidth={1.75} />
      </motion.span>
    </motion.span>
  );
}

function FounderPortraitImg({ className, loading = 'lazy', decorative = false }) {
  const [srcIndex, setSrcIndex] = useState(0);
  const [failed, setFailed] = useState(false);

  const onError = () => {
    const next = srcIndex + 1;
    if (next < FOUNDER_IMAGE_SOURCES.length) setSrcIndex(next);
    else setFailed(true);
  };

  if (failed) return null;

  return (
    <img
      src={FOUNDER_IMAGE_SOURCES[srcIndex]}
      alt={decorative ? '' : FOUNDER_PORTRAIT_ALT}
      aria-hidden={decorative ? true : undefined}
      onError={onError}
      className={className}
      loading={loading}
    />
  );
}

export default function ProrascienceAppleStoryLanding() {
  const reduce = useReducedMotion();
  const featureCards = [
    {
      title: 'Classe immersive LIRI',
      desc: 'Présence réelle à distance, interaction directe, expérience vivante comme en présentiel.',
      Icon: Video,
    },
    {
      title: 'Smartboard intelligent',
      desc: 'Visualisez les concepts, les lois et les mécanismes invisibles avec une pédagogie claire.',
      Icon: LayoutGrid,
    },
    {
      title: 'IA pédagogique',
      desc: 'Reformulation, assistance, explication guidée, transcription et aide à la compréhension.',
      Icon: Bot,
    },
    {
      title: 'Traduction multilingue',
      desc: 'Cours vidéo, transcription et accompagnement pédagogique accessibles dans plusieurs langues.',
      Icon: Languages,
    },
  ];

  const journey = [
    {
      step: '01',
      title: "Entrer dans l'école",
      desc: 'Un téléphone, un ordinateur, une connexion. Le temple est chez vous.',
    },
    {
      step: '02',
      title: 'Comprendre ce que vous faites',
      desc: 'Libations, prières, rituels : découvrez les lois et mécanismes derrière chaque acte.',
    },
    {
      step: '03',
      title: 'Devenir autonome',
      desc: 'Passez de la pratique répétée à la maîtrise consciente de la spiritualité africaine.',
    },
  ];

  const learnItems = [
    'La science des rituels',
    'La logique des libations',
    'Les lois ontologiques',
    'Les mécanismes énergétiques',
    'La structure du destin',
    'La science des divinités',
  ];

  const communityMembers = [
    {
      name: 'K. M.',
      role: 'Éveillé · Europe',
      quote: 'Pour la première fois, les rituels prennent un sens structuré. Je ne répète plus à l\'aveugle.',
      photo: 'https://randomuser.me/api/portraits/women/65.jpg',
    },
    {
      name: 'A. D.',
      role: 'Membre · Afrique',
      quote: 'Les cours live et la communauté m\'ont aidé à tenir un rythme sérieux sans quitter mon travail.',
      photo: 'https://randomuser.me/api/portraits/men/32.jpg',
    },
    {
      name: 'S. L.',
      role: 'Éveillée · Amériques',
      quote: 'La traduction et l\'IA pédagogique rendent accessibles des notions que je n\'avais jamais vues écrites clairement.',
      photo: 'https://randomuser.me/api/portraits/women/68.jpg',
    },
    {
      name: 'J. N.',
      role: 'Membre · diaspora',
      quote: 'J\'ai retrouvé un cadre digne : doctrine, respect, progression. Le temple vraiment chez moi.',
      photo: 'https://randomuser.me/api/portraits/men/75.jpg',
    },
  ];

  const imageBank = {
    heroRites: '/image-pro/prorascience-apple-hero-rites.png',
    rupture: '/image-pro/prorascience-rupture-tradition-numerique.png',
    ritual: '/image-pro/isna-pro-rituel-compris-cinematic.png',
    voyage: '/image-pro/isna-pro-voyageur-cinematic.png',
    devices: '/image-pro/liri-hero-devices.png',
    distance: '/image-pro/aprendre-a-distance.png',
    layout: '/image-pro/liri-layout-showcase.png',
  };

  const featureVisuals = [imageBank.devices, imageBank.layout, imageBank.distance, imageBank.voyage];

  return (
    <div className="min-h-screen bg-[#f7f8fb] text-[#0f172a]">
      <style>{`
        .apple-cine-img {
          animation: appleCineZoom 16s ease-in-out infinite alternate;
          transform-origin: 56% 42%;
          will-change: transform;
        }
        @keyframes appleCineZoom {
          from { transform: scale(1) translate3d(0, 0, 0); }
          to { transform: scale(1.1) translate3d(-1.2%, -0.8%, 0); }
        }
        .apple-cine-float {
          animation: appleCineFloat 5.5s ease-in-out infinite;
          will-change: transform;
        }
        @keyframes appleCineFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        .apple-hero-zoom-float {
          display: block;
          width: 100%;
          height: 100%;
          min-height: 420px;
          object-fit: cover;
          transform-origin: center 45%;
          animation: appleHeroZoomFloat 22s ease-in-out infinite alternate;
          will-change: transform;
        }
        @keyframes appleHeroZoomFloat {
          0% { transform: scale(1.02) translateY(0); }
          40% { transform: scale(1.1) translateY(-14px); }
          100% { transform: scale(1.14) translateY(4px); }
        }
        @media (prefers-reduced-motion: reduce) {
          .apple-cine-img,
          .apple-cine-float,
          .apple-hero-zoom-float {
            animation: none;
            transform: none;
            will-change: auto;
          }
        }
      `}</style>
      <header className="sticky top-0 z-50 border-b border-black/5 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-violet-600 text-white shadow-lg">
              P
            </div>
            <div>
              <div className="text-lg font-semibold tracking-tight">Prorascience</div>
              <div className="text-xs text-slate-500">ISNA • École initiatique en ligne</div>
            </div>
          </div>

          <nav className="hidden gap-6 text-sm text-slate-600 lg:flex xl:gap-8">
            <a href="#philosophie" className="hover:text-slate-950">Philosophie</a>
            <a href="#pedagogie" className="hover:text-slate-950">Pédagogie</a>
            <a href="#formations" className="hover:text-slate-950">Formations</a>
            <a href="#temoignages" className="hover:text-slate-950">Témoignages</a>
            <a href="#communaute" className="hover:text-slate-950">Communauté</a>
            <a href="#entrer" className="hover:text-slate-950">Entrer</a>
          </nav>

          <div className="flex items-center gap-3">
            <button className="hidden rounded-full border border-black/10 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 md:inline-flex">
              Voir la démonstration
            </button>
            <button className="rounded-full bg-slate-950 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">
              Entrer dans l'école
            </button>
          </div>
        </div>
      </header>

      <main>
        <ParallaxSection className="relative overflow-hidden bg-[#f7f8fb]" intensity={20}>
          <div className="mx-auto grid max-w-7xl gap-14 px-6 py-20 lg:grid-cols-[1fr_1.08fr] lg:items-center lg:py-28">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700">
                <motion.span
                  animate={reduce ? undefined : { scale: [1, 1.06, 1] }}
                  transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                  className="inline-flex"
                >
                  <Sparkles className="h-4 w-4 text-blue-600" strokeWidth={2} />
                </motion.span>
                La spiritualité africaine, enfin comprise
              </div>
              <h1 className="mt-6 max-w-3xl text-5xl font-semibold tracking-tight text-slate-950 sm:text-6xl lg:text-7xl">
                Vous avez pratiqué.<br />
                <span className="text-slate-500">Mais avez-vous compris&nbsp;?</span>
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600 sm:text-xl">
                ISNA enseigne la Prorascience pour révéler les lois invisibles, les mécanismes métaphysiques
                et la structure ontologique derrière les rituels, les paroles et les symboles.
              </p>
              <div className="mt-8 flex flex-wrap gap-4">
                <button className="rounded-full bg-slate-950 px-7 py-3 text-sm font-medium text-white shadow-lg hover:bg-slate-800">
                  Entrer dans l'école
                </button>
                <button className="rounded-full border border-black/10 bg-white px-7 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50">
                  Voir une démonstration
                </button>
              </div>
              <div className="mt-10 grid max-w-2xl gap-4 sm:grid-cols-3">
                <div className="rounded-3xl border border-black/5 bg-white p-5 shadow-sm">
                  <div className="text-3xl font-semibold text-slate-950">+1 000</div>
                  <div className="mt-1 text-sm text-slate-500">Éveillés accompagnés</div>
                </div>
                <div className="rounded-3xl border border-black/5 bg-white p-5 shadow-sm">
                  <div className="text-3xl font-semibold text-slate-950">+5k</div>
                  <div className="mt-1 text-sm text-slate-500">Sessions live</div>
                </div>
                <div className="rounded-3xl border border-black/5 bg-white p-5 shadow-sm">
                  <div className="text-3xl font-semibold text-slate-950">100%</div>
                  <div className="mt-1 text-sm text-slate-500">En ligne, partout</div>
                </div>
              </div>
            </div>

            <div className="relative">
              <HeroParallaxSpotlight
                src={imageBank.heroRites}
                alt="Rituels et savoirs : libations, divination, traditions"
                reduce={reduce}
              />
            </div>
          </div>
        </ParallaxSection>

        <ParallaxSection id="philosophie" className="mx-auto max-w-7xl px-6 py-24" intensity={18}>
          <div className="grid gap-8 lg:grid-cols-2">
            <SpotlightZone disabled={reduce} className="rounded-[2rem]">
              <div className="rounded-[2rem] border border-black/5 bg-white p-8 shadow-sm">
              <SmallParallaxMedia reduce={reduce} className="mb-6 rounded-2xl border border-black/5">
                <img
                  src={imageBank.voyage}
                  alt="Ancien chemin initiatique avec déplacement et guidance locale"
                  className={`aspect-[16/9] w-full object-cover ${reduce ? '' : 'apple-cine-img'}`}
                  loading="lazy"
                />
              </SmallParallaxMedia>
              <div className="text-sm font-medium uppercase tracking-[0.24em] text-slate-400">Le problème</div>
              <h2 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
                On vous a appris à faire, mais pas à comprendre.
              </h2>
              <p className="mt-6 text-lg leading-8 text-slate-600">
                Des libations. Des prières. Des rituels. Mais rarement l'explication précise des lois invisibles,
                des mécanismes énergétiques et de la structure ontologique derrière chaque acte.
              </p>
              </div>
            </SpotlightZone>
            <SpotlightZone disabled={reduce} tone="dark" className="rounded-[2rem]">
              <div className="rounded-[2rem] border border-black/5 bg-slate-950 p-8 text-white shadow-sm">
              <SmallParallaxMedia reduce={reduce} className="mb-6 rounded-2xl border border-white/10">
                <img
                  src={imageBank.ritual}
                  alt="Rituel compris : lois invisibles et structure rendues explicites"
                  className={`aspect-[16/9] w-full object-cover object-[60%_48%] ${reduce ? '' : 'apple-cine-img'}`}
                  loading="lazy"
                />
              </SmallParallaxMedia>
              <div className="text-sm font-medium uppercase tracking-[0.24em] text-white/40">La révélation</div>
              <h2 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">
                La Prorascience révèle ce qui a toujours été caché.
              </h2>
              <p className="mt-6 text-lg leading-8 text-white/65">
                Rien n'est mystique par hasard. Chaque parole, chaque symbole, chaque rituel repose sur une
                structure, une logique, une activation et des lois précises qu'il devient enfin possible d\'étudier.
              </p>
              </div>
            </SpotlightZone>
          </div>
        </ParallaxSection>

        <ParallaxSection className="mx-auto max-w-7xl px-6 pb-24" intensity={14}>
          <SpotlightZone disabled={reduce} tone="dark" className="rounded-[2.5rem]" radiusPx={640}>
          <div className="relative overflow-hidden rounded-[2.5rem] border border-black/5 bg-gradient-to-br from-slate-950 to-slate-900 px-8 py-14 text-white shadow-[0_20px_80px_rgba(15,23,42,0.12)]">
            <img
              src={imageBank.rupture}
              alt=""
              className={`absolute inset-0 h-full w-full object-cover object-[52%_center] opacity-35 ${reduce ? '' : 'apple-cine-img'}`}
              aria-hidden
            />
            <div className="absolute inset-0 bg-gradient-to-r from-slate-950/92 via-slate-950/78 to-slate-900/70" aria-hidden />
            <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
              <div className="relative">
                <div className="text-sm font-medium uppercase tracking-[0.24em] text-white/40">La rupture historique</div>
                <h2 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">
                  Avant, il fallait voyager pour apprendre.
                </h2>
                <p className="mt-6 text-lg leading-8 text-white/65">
                  Quitter l'Europe. Retourner au village. Chercher un initié. Attendre des années. Aujourd\'hui,
                  le temple est chez vous. Avec ISNA, un ordinateur, un smartphone et une connexion suffisent pour
                  commencer un parcours initiatique 100% en ligne.
                </p>
              </div>
              <div className="relative grid gap-4 sm:grid-cols-3">
                {journey.map((item) => (
                  <div key={item.step} className="rounded-[1.6rem] border border-white/10 bg-white/5 p-5">
                    <div className="text-sm font-medium text-blue-300">{item.step}</div>
                    <h3 className="mt-4 text-2xl font-medium tracking-tight">{item.title}</h3>
                    <p className="mt-4 text-sm leading-6 text-white/65">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
          </SpotlightZone>
        </ParallaxSection>

        <ParallaxSection id="pedagogie" className="border-y border-black/5 bg-white py-24" intensity={18}>
          <div className="mx-auto max-w-7xl px-6">
            <div className="max-w-3xl">
              <div className="flex items-center gap-3">
                <AnimatedSectionIcon Icon={GraduationCap} reduce={reduce} />
                <div className="text-sm font-medium uppercase tracking-[0.24em] text-slate-400">Pédagogie du futur</div>
              </div>
              <h2 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
                Une école initiatique conçue comme une expérience complète.
              </h2>
              <p className="mt-6 text-lg leading-8 text-slate-600">
                ISNA associe classes virtuelles immersives, cours vidéo, transcription multilingue, assistance
                pédagogique IA et moteur de conférence LIRI pour rendre compréhensible ce qui est resté longtemps mal compris.
              </p>
            </div>

            <div className="mt-14 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
              {featureCards.map((item, idx) => (
                <SpotlightZone key={item.title} disabled={reduce} className="rounded-[1.75rem]">
                  <div className="rounded-[1.75rem] border border-black/5 bg-[#f8fafc] p-6 shadow-sm">
                  <SmallParallaxMedia reduce={reduce} className="mb-5 rounded-2xl border border-black/5">
                    <img
                      src={featureVisuals[idx % featureVisuals.length]}
                      alt={item.title}
                      className={`aspect-[4/3] w-full object-cover ${reduce ? '' : 'apple-cine-img'}`}
                      loading="lazy"
                    />
                  </SmallParallaxMedia>
                  <AnimatedSectionIcon Icon={item.Icon} reduce={reduce} />
                  <h3 className="mt-6 text-2xl font-medium tracking-tight text-slate-950">{item.title}</h3>
                  <p className="mt-4 text-base leading-7 text-slate-600">{item.desc}</p>
                  </div>
                </SpotlightZone>
              ))}
            </div>
          </div>
        </ParallaxSection>

        <ParallaxSection id="formations" className="mx-auto max-w-7xl px-6 py-24" intensity={16}>
          <div className="grid gap-12 lg:grid-cols-[0.92fr_1.08fr] lg:items-start">
            <div>
              <div className="flex items-center gap-3">
                <AnimatedSectionIcon Icon={Sparkles} reduce={reduce} />
                <div className="text-sm font-medium uppercase tracking-[0.24em] text-slate-400">Formations initiatiques</div>
              </div>
              <h2 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
                Comprendre. Maîtriser. Devenir autonome.
              </h2>
              <p className="mt-6 text-lg leading-8 text-slate-600">
                Vous n'apprenez plus seulement des gestes. Vous apprenez la logique, la structure et les lois de
                la spiritualité africaine pour devenir autonome dans votre pratique.
              </p>
              <SpotlightZone disabled={reduce} className="mt-8 rounded-[1.4rem]">
                <div className="overflow-hidden rounded-[1.4rem] border border-black/5 bg-white shadow-sm">
                  <SmallParallaxMedia reduce={reduce} className="h-full w-full">
                    <FounderPortraitImg
                      className={`aspect-[4/5] w-full object-cover object-[center_22%] sm:aspect-[3/4] ${reduce ? '' : 'apple-cine-img'}`}
                      loading="lazy"
                    />
                  </SmallParallaxMedia>
                </div>
              </SpotlightZone>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {learnItems.map((item) => (
                <div key={item} className="rounded-[1.4rem] border border-black/5 bg-white p-5 text-lg text-slate-800 shadow-sm">
                  {item}
                </div>
              ))}
            </div>
          </div>
        </ParallaxSection>

        <ParallaxSection id="temoignages" className="border-y border-black/5 bg-[#f1f5f9] py-24" intensity={16}>
          <div className="mx-auto max-w-7xl px-6">
            <div className="max-w-3xl">
              <div className="flex items-center gap-3">
                <AnimatedSectionIcon Icon={MessageCircle} reduce={reduce} />
                <div className="text-sm font-medium uppercase tracking-[0.24em] text-slate-400">Témoignages</div>
              </div>
              <h2 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
                Ils parlent de leur parcours avec ISNA.
              </h2>
              <p className="mt-6 text-lg leading-8 text-slate-600">
                Écoutez des retours d'éveillés et de membres : compréhension, régularité, et lien à la communauté.
              </p>
            </div>

            <div className="mt-12">
              <SpotlightZone disabled={reduce} className="rounded-[1.75rem]">
              <div className="overflow-hidden rounded-[1.75rem] border border-black/5 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
                <div className="aspect-video w-full">
                  <iframe
                    title="Témoignages ISNA Prorascience — vidéo YouTube"
                    className="h-full w-full"
                    src={`https://www.youtube-nocookie.com/embed/${testimonialYoutubeId}?rel=0`}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                    loading="lazy"
                  />
                </div>
              </div>
              </SpotlightZone>
              {!envTestimonialYoutubeId && (
                <p className="mt-4 text-center text-sm text-slate-500">
                  Vidéo d'exemple libre de droits (Blender Foundation). Pour afficher vos témoignages, définissez{' '}
                  <code className="rounded bg-slate-200/80 px-1.5 py-0.5 text-xs text-slate-800">
                    VITE_PRORASCIENCE_APPLE_STORY_YOUTUBE_ID
                  </code>{' '}
                  dans votre <code className="rounded bg-slate-200/80 px-1.5 py-0.5 text-xs">.env</code>.
                </p>
              )}
            </div>
          </div>
        </ParallaxSection>

        <ParallaxSection id="communaute" className="mx-auto max-w-7xl px-6 py-24" intensity={18}>
          <div className="max-w-3xl">
            <div className="flex items-center gap-3">
              <AnimatedSectionIcon Icon={Users} reduce={reduce} />
              <div className="text-sm font-medium uppercase tracking-[0.24em] text-slate-400">Communauté</div>
            </div>
            <h2 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
              Rejoindre des membres engagés.
            </h2>
            <p className="mt-6 text-lg leading-8 text-slate-600">
              Un espace pour avancer ensemble : entraide, live, et respect du cadre initiatique.
            </p>
          </div>

          <motion.ul
            className="mt-14 grid list-none gap-6 p-0 sm:grid-cols-2 xl:grid-cols-4"
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.15 }}
            variants={{
              hidden: {},
              show: {
                transition: { staggerChildren: reduce ? 0 : 0.12, delayChildren: reduce ? 0 : 0.06 },
              },
            }}
          >
            {communityMembers.map((m, i) => (
              <motion.li
                key={`${m.name}-${i}`}
                variants={{
                  hidden: { opacity: 0, y: reduce ? 0 : 28 },
                  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: 'easeOut' } },
                }}
                whileHover={reduce ? undefined : { y: -6, transition: { type: 'spring', stiffness: 400, damping: 22 } }}
                className="list-none"
              >
                <SpotlightZone disabled={reduce} className="h-full rounded-[1.5rem]">
                  <div className="flex h-full flex-col rounded-[1.5rem] border border-black/5 bg-white p-6 shadow-sm transition-shadow hover:shadow-[0_18px_40px_rgba(15,23,42,0.1)]">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <MemberAvatar
                          photo={m.photo}
                          initials={(m.name.match(/\b\w/gi) || []).join('').slice(0, 2)}
                        />
                        <div>
                          <p className="text-lg font-semibold text-slate-950">{m.name}</p>
                          <p className="text-sm font-medium text-blue-700">{m.role}</p>
                        </div>
                      </div>
                      {!reduce && (
                        <motion.span
                          className="text-blue-600/80"
                          animate={{ y: [0, -4, 0] }}
                          transition={{ duration: 3 + i * 0.2, repeat: Infinity, ease: 'easeInOut' }}
                          aria-hidden
                        >
                          <Users className="h-6 w-6" strokeWidth={1.5} />
                        </motion.span>
                      )}
                      {reduce && (
                        <span className="text-blue-600/80" aria-hidden>
                          <Users className="h-6 w-6" strokeWidth={1.5} />
                        </span>
                      )}
                    </div>
                    <p className="mt-4 text-sm leading-6 text-slate-600">&ldquo;{m.quote}&rdquo;</p>
                  </div>
                </SpotlightZone>
              </motion.li>
            ))}
          </motion.ul>
        </ParallaxSection>

        <ParallaxSection id="entrer" className="mx-auto max-w-6xl px-6 pb-24" intensity={12}>
          <div className="relative overflow-hidden rounded-[2.5rem] border border-black/5 bg-gradient-to-br from-blue-600 to-slate-950 px-8 py-16 text-center text-white shadow-[0_20px_80px_rgba(59,130,246,0.18)]">
            <FounderPortraitImg
              decorative
              className={`pointer-events-none absolute inset-0 h-full w-full object-cover object-[center_28%] opacity-20 ${reduce ? '' : 'apple-cine-img'}`}
              loading="eager"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-blue-950/75 to-slate-950/85" aria-hidden />
            <div className="relative">
            <div className="text-sm font-medium uppercase tracking-[0.24em] text-white/50">Entrer dans le système</div>
            <h2 className="mt-4 text-4xl font-semibold tracking-tight sm:text-6xl">
              Le temple n'est plus un lieu.<br />
              C'est un accès.
            </h2>
            <p className="mx-auto mt-6 max-w-3xl text-lg leading-8 text-white/75">
              Une connexion, un téléphone ou un ordinateur, et le début d'un parcours de compréhension, de maîtrise
              et d'autonomie. Le temple est chez vous. L\'école est ouverte.
            </p>
            <div className="mt-10 flex flex-wrap justify-center gap-4">
              <button className="rounded-full bg-white px-7 py-3 text-sm font-medium text-slate-950 hover:bg-slate-100">
                Entrer dans la Prorascience
              </button>
              <button className="rounded-full border border-white/20 px-7 py-3 text-sm font-medium text-white hover:bg-white/10">
                Voir le système produit
              </button>
            </div>
            </div>
          </div>
        </ParallaxSection>
      </main>
    </div>
  );
}
