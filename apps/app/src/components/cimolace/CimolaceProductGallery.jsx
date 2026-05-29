import React from 'react';
import { motion } from 'framer-motion';

/* ─────────────────────────────────────────────────────────
   CimolaceProductGallery
   Sticky-scroll 3-column layout showcasing CIMOLACE modules.
   ─ Left & right columns scroll normally
   ─ Center column is sticky (stays in viewport while others scroll)
   ─ No lenis dependency — pure CSS sticky
───────────────────────────────────────────────────────── */

const products = [
  {
    // Vendeur africain utilisant son téléphone pour gérer sa boutique en ligne
    name: 'Virtuel Mbolo™',
    badge: 'Commerce',
    color: '#8b5cf6',
    img: 'https://images.unsplash.com/photo-1534278931827-8a259344abe7?w=600&q=80',
  },
  {
    // Livreur africain avec scooter + colis dans une rue animée
    name: 'Smart Logistics™',
    badge: 'Logistique',
    color: '#06b6d4',
    img: 'https://images.unsplash.com/photo-1601598851547-4302969d0614?w=600&q=80',
  },
  {
    // Femme africaine faisant un paiement mobile avec son téléphone
    name: 'Payflow Africa™',
    badge: 'Paiement',
    color: '#f59e0b',
    img: 'https://images.unsplash.com/photo-1580508174046-170816f65662?w=600&q=80',
  },
  {
    // Jeune africain enregistrant une vidéo / podcast avec smartphone + ring light
    name: 'LIRI Live Engine™',
    badge: 'Streaming',
    color: '#ec4899',
    img: 'https://images.unsplash.com/photo-1611162616305-c69b3037c7bb?w=600&q=80',
  },
  {
    // Groupe de jeunes africains en coworking, collaboration autour d'un ordinateur
    name: 'LIRI Spirit™',
    badge: 'Communauté',
    color: '#8b5cf6',
    img: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=600&q=80',
  },
  {
    // Développeur africain devant plusieurs écrans avec du code / data
    name: 'LIRI AI Core™',
    badge: 'Intelligence',
    color: '#06b6d4',
    img: 'https://images.unsplash.com/photo-1551434678-e076c223a692?w=600&q=80',
  },
  {
    // Étudiant africain avec tablette dans une salle de classe lumineuse
    name: 'LIRI EDU Core™',
    badge: 'Éducation',
    color: '#10b981',
    img: 'https://images.unsplash.com/photo-1427504494785-3a9ca7044f45?w=600&q=80',
  },
  {
    // Organisateur africain gérant un événement, scène colorée avec foule
    name: 'LIRI Event Designer™',
    badge: 'Création',
    color: '#ec4899',
    img: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=600&q=80',
  },
  {
    // Entrepreneur africain devant un tableau de bord / dashboard sur laptop
    name: 'LIRI Agents System™',
    badge: 'Automation',
    color: '#f59e0b',
    img: 'https://images.unsplash.com/photo-1573496799652-408c2ac9fe98?w=600&q=80',
  },
  {
    // Femme africaine professionnelle consultant son agenda / planning sur téléphone
    name: 'LIRI Scheduler™',
    badge: 'Temps',
    color: '#8b5cf6',
    img: 'https://images.unsplash.com/photo-1531746790731-6c087fecd65a?w=600&q=80',
  },
];

/* Left col: indices 0-4  |  Center (sticky): 5,2,8  |  Right: 6,7,9,1,3 */
const leftProducts   = [products[0], products[1], products[2], products[3], products[4]];
const centerProducts = [products[5], products[2], products[8]];
const rightProducts  = [products[6], products[7], products[9], products[1], products[3]];

const ProductFigure = ({ product, className = '' }) => (
  <figure className={`relative w-full overflow-hidden rounded-xl group ${className}`}>
    <img
      src={product.img}
      alt={product.name}
      className="transition-all duration-500 w-full h-full align-bottom object-cover group-hover:scale-105"
    />
    {/* Overlay label */}
    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
    <div className="absolute bottom-0 left-0 right-0 p-4">
      <span
        className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-medium mb-1.5"
        style={{ backgroundColor: `${product.color}25`, color: product.color, border: `1px solid ${product.color}40` }}
      >
        {product.badge}
      </span>
      <p className="text-sm font-bold text-white leading-tight">{product.name}</p>
    </div>
  </figure>
);

const CimolaceProductGallery = () => (
  <section className="relative bg-[#0a0a0f] overflow-hidden">
    {/* Section header (sticky) */}
    <div className="text-white h-screen w-full bg-[#0a0a0f] grid place-content-center sticky top-0 z-10">
      {/* Grid texture */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#4f4f4f18_1px,transparent_1px),linear-gradient(to_bottom,#4f4f4f18_1px,transparent_1px)] bg-[size:54px_54px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />
      {/* Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-violet-600/8 rounded-full blur-[120px] pointer-events-none" />
      <div className="relative z-10 text-center px-8">
        <motion.span
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="inline-block text-xs text-violet-400 tracking-[0.3em] uppercase mb-6"
        >
          Nos produits
        </motion.span>
        <motion.h2
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="text-5xl md:text-7xl font-semibold tracking-tight leading-[1.1]"
        >
          Chaque outil,
          <br />
          <span className="bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">
            une puissance.
          </span>
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.25 }}
          className="mt-5 text-white/40 text-lg"
        >
          Faites défiler pour explorer l'écosystème CIMOLACE 👇
        </motion.p>
      </div>
    </div>

    {/* 3-column sticky gallery */}
    <div className="grid grid-cols-12 gap-2 px-2 pb-2 bg-[#0a0a0f]">

      {/* Left — scrolls */}
      <div className="grid gap-2 col-span-4">
        {leftProducts.map((p, i) => (
          <ProductFigure key={i} product={p} className="h-96" />
        ))}
      </div>

      {/* Center — sticky */}
      <div className="sticky top-0 h-screen w-full col-span-4 gap-2 grid grid-rows-3">
        {centerProducts.map((p, i) => (
          <ProductFigure key={i} product={p} className="h-full" />
        ))}
      </div>

      {/* Right — scrolls */}
      <div className="grid gap-2 col-span-4">
        {rightProducts.map((p, i) => (
          <ProductFigure key={i} product={p} className="h-96" />
        ))}
      </div>
    </div>
  </section>
);

export default CimolaceProductGallery;
