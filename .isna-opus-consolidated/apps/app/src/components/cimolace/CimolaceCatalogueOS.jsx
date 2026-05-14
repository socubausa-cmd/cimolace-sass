import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { OS_CATALOGUE, sectionThemes, motionVariants } from '@/config/cimolace-design-system';

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
};

const stagger = (delay = 0.07) => ({
  hidden: {},
  visible: { transition: { staggerChildren: delay } },
});

const OSCard = ({ os }) => {
  const [hovered, setHovered] = useState(false);
  const c = os.color;

  return (
    <motion.div
      variants={fadeUp}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="group relative bg-white rounded-2xl p-7 flex flex-col gap-5"
      style={{
        borderTop: `3px solid ${c}`,
        boxShadow: hovered
          ? `0 20px 60px -10px ${c}30, 0 4px 20px rgba(0,0,0,0.08)`
          : '0 2px 16px rgba(0,0,0,0.06)',
        transform: hovered ? 'translateY(-4px)' : 'translateY(0)',
        transition: 'transform 0.25s ease, box-shadow 0.25s ease',
      }}
    >
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center text-xl font-bold text-white"
        style={{ backgroundColor: c }}
      >
        {os.emoji}
      </div>

      <div>
        <h3 className="text-xl font-bold text-[#0a0a0f] mb-1">{os.name}</h3>
        <p className="text-sm text-[#6e6e73] leading-relaxed">{os.tagline}</p>
      </div>

      <ul className="flex flex-col gap-2 flex-1">
        {os.features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm text-[#424245]">
            <span
              className="mt-1.5 w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: c }}
            />
            {f}
          </li>
        ))}
      </ul>

      <Link
        to={os.href}
        className="inline-flex items-center gap-1.5 text-sm font-semibold"
        style={{ color: c }}
      >
        Voir détails
        <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-1" />
      </Link>
    </motion.div>
  );
};

const CimolaceCatalogueOS = () => {
  return (
    <section className="relative bg-[#f5f4ff] py-24 px-6">
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full bg-violet-200/40 blur-[120px]" />
        <div className="absolute -bottom-40 -left-40 w-[500px] h-[500px] rounded-full bg-indigo-200/30 blur-[120px]" />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-60px' }}
          variants={stagger(0.08)}
          className="mb-14"
        >
          <motion.span
            variants={fadeUp}
            className="inline-block text-xs font-semibold tracking-[0.28em] uppercase text-violet-600 mb-4"
          >
            Catalogue OS
          </motion.span>
          <motion.h2
            variants={fadeUp}
            className="text-4xl md:text-5xl font-black text-gray-900 leading-tight mb-5 max-w-2xl"
          >
            Sept plateformes prêtes à l'emploi.{' '}
            <span className="text-violet-600">Une seule à choisir.</span>
          </motion.h2>
          <motion.p
            variants={fadeUp}
            className="text-lg text-gray-500 max-w-2xl leading-relaxed"
          >
            Chaque OS est une plateforme complète, pré-configurée pour un usage. Vous activez
            celui qui vous correspond. Vous démarrez en 24h.
          </motion.p>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-40px' }}
          variants={stagger(0.07)}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
        >
          {OS_CATALOGUE.map((os, index) => (
            <OSCard key={os.id} os={os} index={index} />
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default CimolaceCatalogueOS;
