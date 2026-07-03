import React from 'react';
import { Link } from 'react-router-dom';
import { motion, MotionConfig, useReducedMotion } from 'framer-motion';
import {
  ArrowRight,
  ArrowUpRight,
  Landmark,
  GraduationCap,
  Radio,
  Store,
  Wand2,
  Briefcase,
  Newspaper,
  CreditCard,
  Brain,
  ShieldCheck,
} from 'lucide-react';
import { OS_LIST } from '@/data/cimolaceOsData';
import { cimolacePlatformConfig } from '@/tenants/cimolace/cimolacePlatform.config';

/**
 * Page d'accueil marketing Cimolace — charte « prorascience.org » :
 * fond slate #0f1419, accent OR #d8b468, ink #f4efe6, serif display Fraunces
 * (déjà chargé dans index.html), corps Inter. Éditorial, sombre, premium.
 *
 * MOTION — règle de robustesse : le contenu est VISIBLE au repos (opacity:1, sans
 * transform). Aucun reveal ne conditionne l'affichage à la timeline d'animation :
 * dans un rendu headless / onglet masqué, framer (RAF) ET les @keyframes CSS sont
 * gelés ; un `initial:{opacity:0}` livrerait alors un hero fantôme (règle impeccable).
 * La seule animation conservée est non-bloquante — la lévitation des cartes hero part
 * de y:0 (donc visible même gelée) et respecte prefers-reduced-motion — plus les
 * micro-interactions au hover (transitions CSS). Données produits = OS_LIST.
 */

// Charte (tokens prorascience.org)
const GOLD = '#d8b468';
const GOLD_SOFT = '#e6cc92';
const SERIF = "'Fraunces','Source Serif 4',Georgia,serif";

// Icône SVG par OS (remplace les emojis de OS_LIST)
const OS_ICONS = {
  temple: Landmark,
  school: GraduationCap,
  'school-live': Radio,
  commerce: Store,
  creator: Wand2,
  business: Briefcase,
  media: Newspaper,
};

function Nav() {
  return (
    <nav className="sticky top-0 z-40 backdrop-blur-md bg-[#0f1419]/75 border-b border-[#f4efe6]/[0.055]">
      <div className="max-w-[1200px] mx-auto px-6 lg:px-7 h-[70px] flex items-center justify-between">
        <Link to="/cimolace" className="flex items-center gap-2.5">
          <span
            className="w-[30px] h-[30px] rounded-[9px] grid place-items-center text-[#20160f] font-semibold"
            style={{ background: `linear-gradient(135deg, ${GOLD}, ${GOLD_SOFT})`, fontFamily: SERIF }}
          >C</span>
          <span className="text-sm font-semibold tracking-[0.14em] text-[#f4efe6]">CIMOLACE</span>
        </Link>
        <div className="hidden md:flex gap-8 text-sm text-[#aeb6bf]">
          <a href="#os" className="hover:text-[#f4efe6] transition-colors">Produits</a>
          <a href="#infra" className="hover:text-[#f4efe6] transition-colors">Infrastructure</a>
          <Link to="/cimolace/launch" className="hover:text-[#f4efe6] transition-colors">Tarifs</Link>
        </div>
        <Link
          to="/cimolace/login"
          className="inline-flex items-center rounded-xl px-[18px] py-2.5 text-sm font-semibold text-[#20160f] transition-all hover:-translate-y-[1px]"
          style={{ background: GOLD }}
        >Accéder à la plateforme</Link>
      </div>
    </nav>
  );
}

function HeroCards() {
  const reduce = useReducedMotion();
  const cards = [
    { icon: Radio, title: 'LIRI · Live & IA', desc: 'Classes, conférences, SmartBoard, replay, mémoire IA.', cls: 'top-2 left-0', d: 0 },
    { icon: GraduationCap, title: 'École', desc: 'Parcours, suivi élève, bulletins, salle live.', cls: 'top-[150px] right-0', d: 0.8 },
    { icon: Landmark, title: 'MedOS · Santé', desc: 'Dossiers, notes SOAP, téléconsultation.', cls: 'bottom-1.5 left-11', d: 0.4 },
  ];
  return (
    <div className="relative h-[440px] max-w-[340px] mx-auto lg:max-w-none">
      <div className="absolute inset-0 grid place-items-center -z-10">
        <div
          className="w-[260px] h-[260px] rounded-full border border-[#f4efe6]/10"
          style={{ background: 'radial-gradient(circle, rgba(216,180,104,.22), transparent 70%)' }}
        />
      </div>
      {cards.map(({ icon: Icon, title, desc, cls, d }) => (
        // Carte VISIBLE au repos. La lévitation part de y:0 → jamais fantôme si gelée.
        <motion.div
          key={title}
          className={`absolute w-[270px] rounded-[18px] border border-[#f4efe6]/10 p-[18px_20px] shadow-[0_30px_70px_-30px_rgba(0,0,0,.8)] ${cls}`}
          style={{ background: 'linear-gradient(180deg, #161d25, #0f1419)' }}
          animate={reduce ? undefined : { y: [0, -12, 0] }}
          transition={reduce ? undefined : { duration: 7 + d, repeat: Infinity, ease: 'easeInOut', delay: d }}
        >
          <span className="w-9 h-9 rounded-[10px] grid place-items-center mb-3" style={{ background: `linear-gradient(135deg, ${GOLD}, ${GOLD_SOFT})` }}>
            <Icon className="w-[18px] h-[18px] text-[#20160f]" strokeWidth={1.8} />
          </span>
          <p className="text-[15px] font-semibold text-[#f4efe6]">{title}</p>
          <p className="mt-1.5 text-[12.5px] leading-[1.5] text-[#7c858f]">{desc}</p>
        </motion.div>
      ))}
    </div>
  );
}

function Hero() {
  return (
    <header className="relative overflow-hidden">
      {/* halos + grille (statiques, décoratifs) */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <div className="absolute -top-[360px] left-[8%] w-[720px] h-[720px] rounded-full blur-[30px]" style={{ background: 'radial-gradient(circle, rgba(216,180,104,.24), transparent 62%)' }} />
        <div className="absolute -bottom-[260px] -right-20 w-[560px] h-[560px] rounded-full blur-[20px]" style={{ background: 'radial-gradient(circle, rgba(230,204,146,.12), transparent 60%)' }} />
      </div>
      <div
        className="absolute inset-0 z-0 opacity-50"
        style={{
          backgroundImage: 'linear-gradient(rgba(244,239,230,.055) 1px, transparent 1px), linear-gradient(90deg, rgba(244,239,230,.055) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
          maskImage: 'radial-gradient(circle at 30% 20%, #000, transparent 72%)',
          WebkitMaskImage: 'radial-gradient(circle at 30% 20%, #000, transparent 72%)',
        }}
      />
      <div className="relative z-10 max-w-[1200px] mx-auto px-6 lg:px-7 pt-24 pb-24 grid grid-cols-1 lg:grid-cols-[1.05fr_.95fr] gap-14 items-center">
        <div>
          <span className="inline-flex items-center gap-2.5 border border-[#f4efe6]/10 rounded-full px-[15px] py-2 text-[13px] text-[#aeb6bf] bg-[#f4efe6]/[0.03]">
            <span className="w-[7px] h-[7px] rounded-full" style={{ background: GOLD }} />
            Infrastructure intelligente pour l'Afrique
          </span>
          <h1 className="mt-6 font-semibold text-[#f4efe6] leading-[1.02] tracking-[-0.02em] text-balance break-words" style={{ fontFamily: SERIF, fontSize: 'clamp(1.8rem, 6vw, 5rem)' }}>
            Une plateforme.<br /><em className="not-italic" style={{ fontStyle: 'italic', color: GOLD }}>Toutes vos intelligences.</em>
          </h1>
          <p className="mt-6 text-[#aeb6bf] leading-[1.65] max-w-[34ch]" style={{ fontSize: 'clamp(1.05rem, 1.5vw, 1.22rem)' }}>
            Site, paiement, live, école, santé et commerce — réunis dans des OS métier prêts à l'emploi. Moins d'outils éparpillés. Plus de contrôle, plus de vitesse.
          </p>
          <div className="mt-9 flex flex-wrap gap-3.5">
            <Link to="/cimolace/launch" className="inline-flex items-center gap-2 rounded-xl px-5 py-3.5 text-sm font-semibold text-[#20160f] transition-all hover:-translate-y-[1px]" style={{ background: GOLD }}>
              Lancer mon infrastructure <ArrowRight className="w-4 h-4" />
            </Link>
            <a href="#os" className="inline-flex items-center rounded-xl px-5 py-3.5 text-sm font-medium text-[#f4efe6] border border-[#f4efe6]/10 bg-[#f4efe6]/[0.03] hover:bg-[#f4efe6]/[0.07] transition-colors">
              Voir les produits
            </a>
          </div>
          <div className="mt-11 flex flex-wrap gap-10 pt-[30px] border-t border-[#f4efe6]/[0.055]">
            {[['7', 'OS prêts'], ['30+', 'moteurs IA'], ['1', 'stack unifiée']].map(([n, l]) => (
              <div key={l}>
                <div className="text-[2rem] leading-none font-semibold text-[#f4efe6]" style={{ fontFamily: SERIF }}>{n}</div>
                <div className="text-xs tracking-[0.16em] uppercase text-[#7c858f] mt-2">{l}</div>
              </div>
            ))}
          </div>
        </div>
        <div>
          <HeroCards />
        </div>
      </div>
    </header>
  );
}

function Products() {
  const list = Array.isArray(OS_LIST) ? OS_LIST : [];
  const featured = list[0];
  const rest = list.slice(1); // TOUS les OS restants (6) — aucune perte de produit
  const FeatIcon = featured ? (OS_ICONS[featured.id] || Wand2) : Wand2;
  return (
    <section id="os" className="scroll-mt-24 py-[104px]">
      <div className="max-w-[1200px] mx-auto px-6 lg:px-7">
        <div>
          <span className="text-[13px] font-medium" style={{ color: GOLD }}>Les produits</span>
          <h2 className="mt-3.5 font-semibold text-[#f4efe6] leading-[1.05] tracking-[-0.02em] text-balance max-w-[20ch]" style={{ fontFamily: SERIF, fontSize: 'clamp(2rem, 4vw, 3.3rem)' }}>
            Pas des plugins. Des OS métier.
          </h2>
          <p className="mt-4 text-[#aeb6bf] max-w-[56ch] text-[1.05rem]">
            Chaque secteur a sa propre logique. Cimolace livre un système complet par métier — pas une boîte à outils à assembler soi-même.
          </p>
        </div>

        <div className="mt-[52px] grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr] lg:auto-rows-[200px]">
          {featured && (
            <div className="sm:col-span-2 lg:col-span-1 lg:row-span-3 relative overflow-hidden rounded-[20px] border border-[#f4efe6]/10 p-[26px] flex flex-col justify-between gap-8 transition-transform duration-300 hover:-translate-y-1.5" style={{ background: 'linear-gradient(160deg, #1c2530, #161d25)' }}>
              {/* filigrane : grande icône très faible pour habiter la hauteur de la tuile phare */}
              <FeatIcon className="absolute right-[-30px] top-1/2 -translate-y-1/2 w-[240px] h-[240px] pointer-events-none" style={{ color: GOLD, opacity: 0.06 }} strokeWidth={0.9} />
              <span className="relative inline-flex self-start items-center gap-2.5 border border-[#f4efe6]/10 rounded-full px-[13px] py-1.5 text-[12.5px] text-[#aeb6bf] bg-[#f4efe6]/[0.03]">
                <span className="w-[6px] h-[6px] rounded-full" style={{ background: GOLD }} /> Produit phare
              </span>
              <Link to={`/cimolace/os/${featured.id}`} className="relative block">
                <span className="w-11 h-11 rounded-xl grid place-items-center mb-4" style={{ background: `linear-gradient(135deg, ${GOLD}, ${GOLD_SOFT})` }}>
                  <FeatIcon className="w-[22px] h-[22px] text-[#20160f]" strokeWidth={1.7} />
                </span>
                <h3 className="text-[2rem] font-semibold tracking-[-0.01em] text-[#f4efe6]" style={{ fontFamily: SERIF }}>{featured.name}</h3>
                <p className="mt-1.5 text-[#aeb6bf] text-[0.95rem]">{featured.tagline}</p>
                <span className="mt-3.5 inline-flex items-center gap-1.5 text-[13px] font-medium" style={{ color: GOLD }}>Découvrir <ArrowUpRight className="w-3.5 h-3.5" /></span>
              </Link>
              <div className="absolute -right-10 -top-10 w-[180px] h-[180px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(216,180,104,.16), transparent 70%)' }} />
            </div>
          )}
          {rest.map((os) => {
            const Icon = OS_ICONS[os.id] || Wand2;
            return (
              <Link key={os.id} to={`/cimolace/os/${os.id}`} className="group h-full rounded-[20px] border border-[#f4efe6]/10 bg-[#161d25] p-[26px] flex flex-col justify-between transition-all duration-300 hover:-translate-y-1.5 hover:border-[#d8b468]/40 hover:bg-[#1c2530]">
                <span className="w-11 h-11 rounded-xl grid place-items-center bg-[#d8b468]/[0.14]">
                  <Icon className="w-[22px] h-[22px]" style={{ color: GOLD }} strokeWidth={1.7} />
                </span>
                <div className="mt-4">
                  <h3 className="text-[1.35rem] font-semibold text-[#f4efe6]">{os.name}</h3>
                  <p className="mt-1.5 text-[#aeb6bf] text-[0.95rem]">{os.tagline}</p>
                  <span className="mt-3.5 inline-flex items-center gap-1.5 text-[13px] font-medium" style={{ color: GOLD }}>Ouvrir <ArrowUpRight className="w-3.5 h-3.5" /></span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function Infra() {
  const points = [
    { n: '01', icon: CreditCard, title: 'Paiement panafricain', body: 'Mobile money (Airtel, MTN, Orange, Wave), carte, PayPal — encaissement, remboursement et abonnements natifs.' },
    { n: '02', icon: Brain, title: 'IA embarquée', body: "30+ moteurs : génération de cours, notes cliniques, légendes réseaux, mémoire de live. L'intelligence au bon endroit." },
    { n: '03', icon: ShieldCheck, title: 'Marque blanche', body: 'Votre domaine, votre identité. Cimolace reste invisible ; vos clients ne voient que vous.' },
  ];
  return (
    <section id="infra" className="scroll-mt-24 py-[104px] border-y border-[#f4efe6]/[0.055] bg-[#161d25]">
      <div className="max-w-[1200px] mx-auto px-6 lg:px-7">
        <div className="max-w-[640px]">
          <span className="text-[13px] font-medium" style={{ color: GOLD }}>L'infrastructure</span>
          <h2 className="mt-3.5 font-semibold text-[#f4efe6] leading-[1.05] tracking-[-0.02em] text-balance max-w-[20ch]" style={{ fontFamily: SERIF, fontSize: 'clamp(2rem, 4vw, 3.3rem)' }}>
            Une seule stack. Invisible comme il faut.
          </h2>
          <p className="mt-4 text-[#aeb6bf] max-w-[56ch] text-[1.05rem]">
            Comme Stripe pour le paiement ou Zoom pour la vidéo — Cimolace fait tourner vos produits en coulisses. Vous gardez votre marque, votre domaine, vos données.
          </p>
        </div>
        <div className="mt-11 grid gap-10 grid-cols-1 md:grid-cols-3">
          {points.map(({ n, icon: Icon, title, body }) => (
            <div key={n}>
              <h3 className="flex items-center gap-2.5 text-[1.05rem] font-semibold text-[#f4efe6]">
                <span className="text-[1.4rem]" style={{ fontFamily: SERIF, color: GOLD }}>{n}</span>
                <Icon className="w-[18px] h-[18px]" style={{ color: GOLD }} strokeWidth={1.7} /> {title}
              </h3>
              <p className="mt-1.5 text-[#aeb6bf] text-[0.95rem]">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="relative text-center py-[120px]">
      <div className="absolute left-1/2 top-[40%] -translate-x-1/2 -translate-y-1/2 w-[640px] h-[340px] blur-[20px] pointer-events-none" style={{ background: 'radial-gradient(ellipse, rgba(216,180,104,.2), transparent 70%)' }} />
      <div className="relative max-w-[1200px] mx-auto px-6">
        <h2 className="mx-auto font-semibold text-[#f4efe6] leading-[1.04] tracking-[-0.02em] max-w-[16ch]" style={{ fontFamily: SERIF, fontSize: 'clamp(2.2rem, 5vw, 4rem)' }}>
          Votre plateforme. <span style={{ fontStyle: 'italic', color: GOLD }}>Dès demain.</span>
        </h2>
        <p className="mt-6 mx-auto text-[#aeb6bf]">
          Choisissez vos OS, activez, encaissez. L'infrastructure suit — vous avancez.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3.5">
          <Link to="/cimolace/launch" className="inline-flex items-center gap-2 rounded-xl px-5 py-3.5 text-sm font-semibold text-[#20160f] transition-all hover:-translate-y-[1px]" style={{ background: GOLD }}>
            Lancer mon infrastructure <ArrowRight className="w-4 h-4" />
          </Link>
          <Link to={cimolacePlatformConfig?.routes?.resourcesDocs || '/cimolace/login'} className="inline-flex items-center rounded-xl px-5 py-3.5 text-sm font-medium text-[#f4efe6] border border-[#f4efe6]/10 bg-[#f4efe6]/[0.03] hover:bg-[#f4efe6]/[0.07] transition-colors">
            Parler à l'équipe
          </Link>
        </div>
      </div>
    </section>
  );
}

export default function CimolacePremiumHomepage() {
  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen overflow-x-hidden bg-[#0f1419] text-[#f4efe6]" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
        <Nav />
        <Hero />
        <Products />
        <Infra />
        <FinalCta />
        <footer className="border-t border-[#f4efe6]/[0.055] py-10">
          <div className="max-w-[1200px] mx-auto px-6 lg:px-7 flex flex-wrap items-center justify-between gap-4 text-sm text-[#7c858f]">
            <div className="flex items-center gap-2.5">
              <span className="w-[30px] h-[30px] rounded-[9px] grid place-items-center text-[#20160f] font-semibold" style={{ background: `linear-gradient(135deg, ${GOLD}, ${GOLD_SOFT})`, fontFamily: SERIF }}>C</span>
              <span className="font-semibold tracking-[0.14em] text-[#f4efe6]">CIMOLACE</span>
            </div>
            <div>© 2026 Cimolace · Infrastructure sécurisée · Données en Afrique</div>
          </div>
        </footer>
      </div>
    </MotionConfig>
  );
}
