import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Sparkles, ChevronDown } from 'lucide-react';
import { ISNA_PRODUCTS, ISNA_PRODUCT_CATEGORIES, ISNA_TECH_STACKS } from '@/data/isnaProducts';

// ─── Spotlight hover effect ───────────────────────────────────────────────────
function SpotlightCard({ children, className = '', accentGlow, onClick }) {
  const ref = useRef(null);
  const [spot, setSpot] = useState({ x: 0, y: 0, on: false });
  const rafRef = useRef(null);

  const onMove = useCallback((e) => {
    if (rafRef.current) return; // Skip if already pending
    rafRef.current = requestAnimationFrame(() => {
      const el = ref.current;
      if (!el) {
        rafRef.current = null;
        return;
      }
      const r = el.getBoundingClientRect();
      setSpot({ x: e.clientX - r.left, y: e.clientY - r.top, on: true });
      rafRef.current = null;
    });
  }, []);

  const onMouseLeave = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    setSpot((s) => ({ ...s, on: false }));
  }, []);

  return (
    <div
      ref={ref}
      className={`relative overflow-hidden ${className}`}
      onMouseMove={onMove}
      onMouseLeave={onMouseLeave}
      onClick={onClick}
    >
      <div
        className="pointer-events-none absolute inset-0 z-0 rounded-[inherit] transition-opacity duration-500"
        style={{
          opacity: spot.on ? 1 : 0,
          background: `radial-gradient(420px circle at ${spot.x}px ${spot.y}px, ${accentGlow || 'rgba(255,255,255,0.07)'}, transparent 60%)`,
        }}
      />
      <div className="relative z-10">{children}</div>
    </div>
  );
}

// ─── Badge stack technologique ────────────────────────────────────────────────
function TechBadge({ stackKey }) {
  const stack = ISNA_TECH_STACKS[stackKey];
  if (!stack) return null;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold tracking-wide"
      style={{ borderColor: `${stack.color}40`, color: stack.color, background: `${stack.color}12` }}
    >
      <span
        className="inline-block h-1.5 w-1.5 rounded-full"
        style={{ background: stack.color }}
      />
      {stack.name}
    </span>
  );
}

// ─── Carte produit ────────────────────────────────────────────────────────────
function ProductCard({ product, index }) {
  const navigate = useNavigate();
  return (
    <motion.div
      initial={{ opacity: 0, y: 32 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.55, delay: index * 0.07, ease: [0.22, 1, 0.36, 1] }}
    >
      <SpotlightCard
        accentGlow={product.accentGlow}
        className="group cursor-pointer rounded-2xl border border-white/[0.08] bg-[#0c1018] p-6 transition-all duration-300 hover:border-white/[0.16] hover:shadow-2xl"
        onClick={() => navigate(`/isna/produits/${product.slug}`)}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-5">
          <div>
            <span
              className="inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest mb-2"
              style={{ color: product.accentColor, background: `${product.accentColor}18`, border: `1px solid ${product.accentColor}30` }}
            >
              {product.category}
            </span>
            <div className="text-3xl mb-1">{product.icon}</div>
          </div>
          <ArrowRight
            className="mt-1 h-4 w-4 shrink-0 text-white/20 transition-all duration-300 group-hover:translate-x-1 group-hover:text-white/60"
          />
        </div>

        {/* Title */}
        <h3
          className="text-2xl font-bold text-white mb-2 leading-tight"
          style={{ fontFamily: "'SF Pro Display', system-ui, sans-serif" }}
        >
          {product.name}
        </h3>
        <p className="text-sm text-white/50 leading-relaxed mb-5 line-clamp-2">{product.tagline}</p>

        {/* Tech stacks */}
        <div className="flex flex-wrap gap-1.5 mb-5">
          {product.stacks.slice(0, 4).map((s) => (
            <TechBadge key={s} stackKey={s} />
          ))}
          {product.stacks.length > 4 && (
            <span className="inline-flex items-center rounded-full border border-white/10 px-2.5 py-1 text-[10px] text-white/30">
              +{product.stacks.length - 4}
            </span>
          )}
        </div>

        {/* Problems preview */}
        <div className="space-y-1.5 border-t border-white/[0.06] pt-4">
          {product.problems.slice(0, 2).map((p, i) => (
            <div key={i} className="flex items-start gap-2 text-[11px] text-white/40">
              <span className="mt-0.5 shrink-0 text-[10px]">✗</span>
              <span>{p}</span>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div
          className="mt-5 flex items-center gap-2 text-xs font-semibold"
          style={{ color: product.accentColor }}
        >
          Découvrir le produit
          <ArrowRight className="h-3 w-3" />
        </div>
      </SpotlightCard>
    </motion.div>
  );
}

// ─── Hero animé ───────────────────────────────────────────────────────────────
function HeroSection() {
  return (
    <section className="relative flex min-h-[92vh] flex-col items-center justify-center overflow-hidden px-4 text-center">
      {/* Background */}
      <div className="pointer-events-none absolute inset-0 bg-[#060810]">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,rgba(99,102,241,0.15),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_20%_80%,rgba(245,158,11,0.07),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_35%_at_80%_70%,rgba(244,63,94,0.06),transparent)]" />
        {/* Grid */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.3) 1px, transparent 1px)',
            backgroundSize: '80px 80px',
          }}
        />
      </div>

      <div className="relative z-10 max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-4 py-1.5 text-xs font-semibold tracking-widest text-indigo-300 uppercase">
            <Sparkles className="h-3 w-3" />
            Écosystème technologique ISNA
          </div>

          <h1
            className="mb-6 text-5xl font-black leading-[1.05] text-white sm:text-6xl lg:text-7xl"
            style={{ fontFamily: "'SF Pro Display', system-ui, sans-serif", letterSpacing: '-0.03em' }}
          >
            Des technologies
            <br />
            <span className="bg-gradient-to-r from-indigo-400 via-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
              qui transforment
            </span>
            <br />
            l&apos;enseignement.
          </h1>

          <p className="mx-auto mb-10 max-w-2xl text-lg text-white/50 leading-relaxed">
            Chaque produit ISNA résout un problème réel. Découvrez les socles technologiques,
            les fonctionnalités, les cibles et ce qui les distingue de tout ce qui existe déjà.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4">
            <a
              href="#products"
              className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-bold text-black transition-all hover:bg-white/90 hover:shadow-xl hover:shadow-white/10"
            >
              Explorer les produits
              <ArrowRight className="h-4 w-4" />
            </a>
            <a
              href="#stacks"
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-white/10"
            >
              Voir les socles techno
            </a>
          </div>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
          className="absolute -bottom-20 left-1/2 -translate-x-1/2"
        >
          <ChevronDown className="h-5 w-5 animate-bounce text-white/20" />
        </motion.div>
      </div>

      {/* Floating product icons */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {ISNA_PRODUCTS.map((p, i) => (
          <motion.div
            key={p.id}
            className="absolute text-4xl select-none"
            style={{
              left: `${10 + (i * 15) % 80}%`,
              top: `${15 + (i * 23) % 65}%`,
            }}
            animate={{
              y: [0, -14, 0],
              opacity: [0.06, 0.12, 0.06],
            }}
            transition={{
              duration: 4 + i * 0.7,
              repeat: Infinity,
              ease: 'easeInOut',
              delay: i * 0.5,
            }}
          >
            {p.icon}
          </motion.div>
        ))}
      </div>
    </section>
  );
}

// ─── Section socles technologiques ────────────────────────────────────────────
function StacksSection() {
  return (
    <section id="stacks" className="py-24 px-4">
      <div className="mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-14 text-center"
        >
          <p className="mb-3 text-xs font-bold uppercase tracking-widest text-white/30">Fondations</p>
          <h2
            className="text-4xl font-black text-white"
            style={{ fontFamily: "'SF Pro Display', system-ui, sans-serif", letterSpacing: '-0.02em' }}
          >
            Les socles technologiques
          </h2>
          <p className="mt-4 text-base text-white/40 max-w-xl mx-auto">
            Chaque produit ISNA est construit sur un ou plusieurs de ces moteurs.
            Ensemble ils forment la colonne vertébrale de l&apos;écosystème.
          </p>
        </motion.div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {Object.entries(ISNA_TECH_STACKS).map(([key, stack], i) => {
            const usedIn = ISNA_PRODUCTS.filter((p) => p.stacks.includes(key)).length;
            return (
              <motion.div
                key={key}
                initial={{ opacity: 0, scale: 0.92 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.05 }}
                className="rounded-xl border border-white/[0.07] bg-[#0c1018] p-4 transition-colors hover:border-white/[0.14]"
              >
                <div
                  className="mb-2 h-2 w-8 rounded-full"
                  style={{ background: stack.color }}
                />
                <p
                  className="text-sm font-bold leading-tight mb-1"
                  style={{ color: stack.color }}
                >
                  {stack.name}
                </p>
                <p className="text-[11px] text-white/40 leading-relaxed mb-3">{stack.description}</p>
                <p className="text-[10px] text-white/25">
                  Utilisé dans {usedIn} produit{usedIn > 1 ? 's' : ''}
                </p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────
export default function IsnaProductsIndexPage() {
  const [activeCategory, setActiveCategory] = useState('all');

  const filtered = ISNA_PRODUCTS.filter(
    (p) => activeCategory === 'all' || p.category === activeCategory,
  );

  return (
    <div className="min-h-screen bg-[#060810] text-white">
      {/* Hero */}
      <HeroSection />

      {/* Socles */}
      <StacksSection />

      {/* Produits */}
      <section id="products" className="py-24 px-4">
        <div className="mx-auto max-w-6xl">
          {/* Section header */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="mb-10 text-center"
          >
            <p className="mb-3 text-xs font-bold uppercase tracking-widest text-white/30">Produits</p>
            <h2
              className="text-4xl font-black text-white"
              style={{ fontFamily: "'SF Pro Display', system-ui, sans-serif", letterSpacing: '-0.02em' }}
            >
              Chaque produit. Une histoire.
            </h2>
            <p className="mt-4 text-base text-white/40 max-w-xl mx-auto">
              Un problème réel, une solution conçue pour ISNA, et une comparaison honnête avec ce qui existe déjà.
            </p>
          </motion.div>

          {/* Filtres */}
          <div className="mb-10 flex flex-wrap justify-center gap-2">
            {ISNA_PRODUCT_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategory(cat.id)}
                className={[
                  'rounded-full border px-4 py-2 text-xs font-semibold transition-all',
                  activeCategory === cat.id
                    ? 'border-white/30 bg-white text-black'
                    : 'border-white/10 bg-white/[0.04] text-white/50 hover:border-white/20 hover:text-white/80',
                ].join(' ')}
              >
                {cat.icon} {cat.label}
              </button>
            ))}
          </div>

          {/* Grille */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeCategory}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3"
            >
              {filtered.map((product, i) => (
                <ProductCard key={product.id} product={product} index={i} />
              ))}
            </motion.div>
          </AnimatePresence>
        </div>
      </section>

      {/* Footer CTA */}
      <section className="border-t border-white/[0.06] py-24 px-4 text-center">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mx-auto max-w-2xl"
        >
          <div className="text-5xl mb-6">🌐</div>
          <h2
            className="text-3xl font-black text-white mb-4"
            style={{ fontFamily: "'SF Pro Display', system-ui, sans-serif", letterSpacing: '-0.02em' }}
          >
            Un écosystème. Une vision.
          </h2>
          <p className="text-base text-white/40 mb-8 leading-relaxed">
            Tous ces produits forment un seul organisme pédagogique — conçu pour l&apos;enseignement
            spirituel, intellectuel et transformateur d&apos;ISNA.
          </p>
          <a
            href="/ecoles/prorascience"
            className="inline-flex items-center gap-2 rounded-xl bg-white px-7 py-3.5 text-sm font-bold text-black hover:bg-white/90 transition-all hover:shadow-xl hover:shadow-white/10"
          >
            En savoir plus sur ProraScience
            <ArrowRight className="h-4 w-4" />
          </a>
        </motion.div>
      </section>
    </div>
  );
}
