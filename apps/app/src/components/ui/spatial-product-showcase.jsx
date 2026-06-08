import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Wifi, Music, Bluetooth, Sliders, ChevronRight, Users, Sparkles } from 'lucide-react';

// « Deux univers » — switcher École ⟷ Temple (d'après spatial-product-showcase, 21st.dev).
// Adapté JSX + charte PRORASCIENCE (or/sombre) + positionnement en SECTION (fixed → absolute).

const TECH = (id) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=800&q=80`;

const UNIVERS = {
  ecole: {
    id: 'ecole',
    label: 'École',
    eyebrow: 'ISNA · l’École',
    title: 'Comprendre.',
    description:
      'De « je reproduis des gestes » à « je comprends, j’explique, je transmets ». Pédagogie immersive, outils high-tech, certification progressive.',
    image: TECH('1531297484001-80022131f5a1'),
    href: '/t/isna/ecole',
    cta: 'Entrer à l’École',
    status: 'ISNA · École',
    glow: '#d8b468',
    ring: 'rgba(216,180,104,0.40)',
    gradient: 'from-[#bf9a4f] to-[#241a0c]',
    bar: '#d8b468',
    radial: 'radial-gradient(circle at 0% 50%, rgba(216,180,104,0.16), transparent 55%)',
    metric: { icon: Users, text: '2500+ initiés formés' },
    features: [
      { label: 'Immersion LIRI', value: 96, icon: Wifi },
      { label: 'Certification', value: 90, icon: Zap },
    ],
  },
  temple: {
    id: 'temple',
    label: 'Temple',
    eyebrow: 'Ngowazulu · le Temple',
    title: 'Transformer.',
    description:
      'L’hôpital de l’âme : consultation, diagnostic, intervention, communion. Un parcours encadré pour dénouer les impasses réelles de la vie.',
    image: '/founder.jpg',
    href: '/t/isna/temple',
    cta: 'Entrer au Temple',
    status: 'Ngowazulu · Temple',
    glow: '#e0a45a',
    ring: 'rgba(224,164,90,0.40)',
    gradient: 'from-[#c6803a] to-[#241208]',
    bar: '#e0a45a',
    radial: 'radial-gradient(circle at 100% 50%, rgba(224,164,90,0.16), transparent 55%)',
    metric: { icon: Sparkles, text: 'Accompagnement encadré' },
    features: [
      { label: 'Consultation', value: 92, icon: Music },
      { label: 'Communion', value: 85, icon: Bluetooth },
    ],
  },
};

const ANIM = {
  container: {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1, delayChildren: 0.1 } },
    exit: { opacity: 0, transition: { duration: 0.2 } },
  },
  item: {
    hidden: { opacity: 0, y: 20, filter: 'blur(10px)' },
    visible: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { type: 'spring', stiffness: 100, damping: 20 } },
    exit: { opacity: 0, y: -10, filter: 'blur(5px)' },
  },
  image: (isLeft) => ({
    initial: { opacity: 0, scale: 1.4, filter: 'blur(15px)', rotate: isLeft ? -25 : 25, x: isLeft ? -60 : 60 },
    animate: { opacity: 1, scale: 1, filter: 'blur(0px)', rotate: 0, x: 0, transition: { type: 'spring', stiffness: 260, damping: 20 } },
    exit: { opacity: 0, scale: 0.65, filter: 'blur(20px)', transition: { duration: 0.25 } },
  }),
};

const Visual = ({ data, isLeft }) => (
  <motion.div layout="position" className="relative shrink-0">
    <motion.div
      animate={{ rotate: 360 }}
      transition={{ duration: 24, repeat: Infinity, ease: 'linear' }}
      className="absolute inset-[-18%] rounded-full border border-dashed"
      style={{ borderColor: data.ring }}
    />
    <motion.div
      animate={{ scale: [1, 1.05, 1] }}
      transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      className={`absolute inset-0 rounded-full bg-gradient-to-br ${data.gradient} blur-2xl opacity-40`}
    />
    <div className="relative flex h-72 w-72 items-center justify-center overflow-hidden rounded-full border shadow-2xl backdrop-blur-sm md:h-[420px] md:w-[420px]" style={{ borderColor: 'var(--border)', background: 'rgba(0,0,0,0.25)' }}>
      <motion.div
        animate={{ y: [-10, 10, -10] }}
        transition={{ repeat: Infinity, duration: 6, ease: 'easeInOut' }}
        className="relative z-10 flex h-full w-full items-center justify-center"
      >
        <AnimatePresence mode="wait">
          <motion.img
            key={data.id}
            src={data.image}
            alt={data.title}
            variants={ANIM.image(isLeft)}
            initial="initial"
            animate="animate"
            exit="exit"
            className="h-full w-full object-cover"
            draggable={false}
          />
        </AnimatePresence>
        <div className="pointer-events-none absolute inset-0 rounded-full" style={{ background: 'radial-gradient(circle at center, transparent 55%, rgba(13,11,9,0.75) 100%)' }} />
      </motion.div>
    </div>
    <motion.div layout="position" className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap">
      <div className="flex items-center gap-2 rounded-full border px-4 py-2 text-xs uppercase tracking-widest" style={{ borderColor: 'var(--border)', background: 'rgba(13,11,9,0.8)', color: 'var(--muted)' }}>
        <span className="h-1.5 w-1.5 animate-pulse rounded-full" style={{ background: data.glow }} />
        {data.status}
      </div>
    </motion.div>
  </motion.div>
);

const Details = ({ data, isLeft }) => {
  const align = isLeft ? 'items-start text-left' : 'items-end text-right';
  const flexDir = isLeft ? 'flex-row' : 'flex-row-reverse';
  const Metric = data.metric.icon;
  return (
    <motion.div variants={ANIM.container} initial="hidden" animate="visible" exit="exit" className={`flex flex-col ${align}`}>
      <motion.p variants={ANIM.item} className="mb-2 text-[12px] font-semibold uppercase tracking-[0.3em]" style={{ color: 'var(--gold)' }}>
        {data.eyebrow}
      </motion.p>
      <motion.h2 variants={ANIM.item} className="mq-display mb-3 text-5xl font-semibold tracking-tight md:text-6xl" style={{ color: 'var(--fg)' }}>
        {data.title}
      </motion.h2>
      <motion.p variants={ANIM.item} className={`mb-8 max-w-sm leading-relaxed ${isLeft ? 'mr-auto' : 'ml-auto'}`} style={{ color: 'var(--muted)' }}>
        {data.description}
      </motion.p>

      <motion.div variants={ANIM.item} className="w-full max-w-sm space-y-5 rounded-2xl border p-6 backdrop-blur-sm" style={{ borderColor: 'var(--border)', background: 'rgba(22,18,12,0.55)' }}>
        {data.features.map((f, idx) => {
          const Icon = f.icon;
          return (
            <div key={f.label}>
              <div className={`mb-2 flex items-center justify-between text-sm ${flexDir}`}>
                <div className="flex items-center gap-2" style={{ color: 'var(--fg)' }}>
                  <Icon size={16} /> <span>{f.label}</span>
                </div>
                <span className="font-mono text-xs" style={{ color: 'var(--muted2)' }}>{f.value}%</span>
              </div>
              <div className="relative h-2 w-full overflow-hidden rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${f.value}%` }}
                  transition={{ duration: 1, delay: 0.4 + idx * 0.15 }}
                  className={`absolute top-0 bottom-0 ${isLeft ? 'left-0' : 'right-0'}`}
                  style={{ background: data.bar, opacity: 0.85 }}
                />
              </div>
            </div>
          );
        })}
        <div className={`flex pt-2 ${isLeft ? 'justify-start' : 'justify-end'}`}>
          <a href={data.href} className="group flex items-center gap-2 rounded-full px-5 py-2.5 text-xs font-semibold uppercase tracking-wider transition hover:brightness-110" style={{ background: 'var(--gold)', color: '#0d0b09' }}>
            <Sliders size={14} /> {data.cta}
            <ChevronRight size={14} className="transition-transform group-hover:translate-x-1" />
          </a>
        </div>
      </motion.div>

      <motion.div variants={ANIM.item} className={`mt-6 flex items-center gap-3 ${flexDir}`} style={{ color: 'var(--muted)' }}>
        <Metric size={16} />
        <span className="text-sm font-medium">{data.metric.text}</span>
      </motion.div>
    </motion.div>
  );
};

export default function DeuxUnivers() {
  const [active, setActive] = useState('ecole');
  const data = UNIVERS[active];
  const isLeft = active === 'ecole';
  const options = [UNIVERS.ecole, UNIVERS.temple];

  return (
    <section id="univers" className="relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden py-20">
      {/* Fond radial qui suit le côté actif */}
      <motion.div
        animate={{ background: data.radial }}
        transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
        className="pointer-events-none absolute inset-0"
      />
      <div className="pointer-events-none absolute left-1/2 top-12 -translate-x-1/2 text-center">
        <p className="text-[12px] font-semibold uppercase tracking-[0.4em]" style={{ color: 'var(--gold)' }}>Deux univers</p>
        <h2 className="mq-display mt-3 text-3xl font-semibold sm:text-4xl" style={{ color: 'var(--fg)' }}>Choisis ta porte.</h2>
      </div>

      <main className="relative z-10 mx-auto flex w-full max-w-7xl flex-col justify-center px-6 py-8">
        <motion.div
          layout
          transition={{ type: 'spring', bounce: 0, duration: 0.9 }}
          className={`flex w-full flex-col items-center justify-center gap-12 md:gap-28 lg:gap-40 ${isLeft ? 'md:flex-row' : 'md:flex-row-reverse'}`}
        >
          <Visual data={data} isLeft={isLeft} />
          <motion.div layout="position" className="w-full max-w-md">
            <AnimatePresence mode="wait">
              <Details key={active} data={data} isLeft={isLeft} />
            </AnimatePresence>
          </motion.div>
        </motion.div>
      </main>

      {/* Pilule de bascule (absolute dans la section) */}
      <div className="pointer-events-none absolute inset-x-0 bottom-10 z-20 flex justify-center">
        <motion.div layout className="pointer-events-auto flex items-center gap-1 rounded-full border p-1.5 shadow-2xl backdrop-blur-2xl" style={{ borderColor: 'var(--border)', background: 'rgba(13,11,9,0.8)' }}>
          {options.map((opt) => (
            <motion.button
              key={opt.id}
              type="button"
              onClick={() => setActive(opt.id)}
              whileTap={{ scale: 0.96 }}
              className="relative flex h-11 w-28 items-center justify-center rounded-full text-sm font-semibold focus:outline-none"
            >
              {active === opt.id && (
                <motion.div layoutId="univers-pill" className="absolute inset-0 rounded-full" style={{ background: 'var(--gold)' }} transition={{ type: 'spring', stiffness: 220, damping: 22 }} />
              )}
              <span className="relative z-10 transition-colors duration-300" style={{ color: active === opt.id ? '#0d0b09' : 'var(--muted)' }}>
                {opt.label}
              </span>
            </motion.button>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
