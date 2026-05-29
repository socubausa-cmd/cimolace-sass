import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Check, X, ChevronDown, Sparkles, Zap } from 'lucide-react';
import { ISNA_PRODUCTS, ISNA_TECH_STACKS } from '@/data/isnaProducts';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function cn(...classes) {
  return classes.filter(Boolean).join(' ');
}

// ─── Badge technique ──────────────────────────────────────────────────────────
function TechPill({ stackKey }) {
  const stack = ISNA_TECH_STACKS[stackKey];
  if (!stack) return null;
  return (
    <div
      className="flex items-start gap-3 rounded-xl border p-4"
      style={{ borderColor: `${stack.color}30`, background: `${stack.color}0a` }}
    >
      <div className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ background: stack.color }} />
      <div>
        <p className="text-sm font-bold" style={{ color: stack.color }}>{stack.name}</p>
        <p className="text-xs text-white/45 mt-0.5 leading-relaxed">{stack.description}</p>
      </div>
    </div>
  );
}

// ─── Section numérotée ────────────────────────────────────────────────────────
function NumberedSection({ number, label, children }) {
  return (
    <div className="flex gap-6 md:gap-10">
      <div className="shrink-0 pt-1">
        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.04]">
          <span className="text-xs font-bold text-white/30">{String(number).padStart(2, '0')}</span>
        </div>
        <div className="mx-auto mt-2 h-full w-px bg-gradient-to-b from-white/[0.06] to-transparent" />
      </div>
      <div className="pb-12 flex-1 min-w-0">
        <p className="mb-4 text-xs font-bold uppercase tracking-widest text-white/30">{label}</p>
        {children}
      </div>
    </div>
  );
}

// ─── Carte comparaison ────────────────────────────────────────────────────────
function ComparisonRow({ item, accentColor }) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-[#0c1018] overflow-hidden">
      <div className="px-4 py-2.5 border-b border-white/[0.06] bg-white/[0.03]">
        <span className="text-xs font-bold text-white/60">{item.competitor}</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-white/[0.06]">
        <div className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <X className="h-3.5 w-3.5 shrink-0 text-red-400/70" />
            <span className="text-[11px] font-semibold text-red-400/70 uppercase tracking-wide">Eux</span>
          </div>
          <p className="text-sm text-white/45 leading-relaxed">{item.them}</p>
        </div>
        <div className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Check className="h-3.5 w-3.5 shrink-0" style={{ color: accentColor }} />
            <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: accentColor }}>ISNA</span>
          </div>
          <p className="text-sm text-white/80 leading-relaxed">{item.us}</p>
        </div>
      </div>
    </div>
  );
}

// ─── Hero produit ─────────────────────────────────────────────────────────────
function ProductHero({ product }) {
  return (
    <section className="relative flex min-h-[85vh] flex-col items-center justify-center overflow-hidden px-4 text-center">
      {/* Background gradient */}
      <div className={cn('pointer-events-none absolute inset-0 bg-gradient-to-b', product.heroGradient)}>
        <div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(ellipse 70% 55% at 50% 0%, ${product.accentGlow}, transparent)`,
          }}
        />
        <div
          className="absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.4) 1px, transparent 1px)',
            backgroundSize: '64px 64px',
          }}
        />
      </div>

      <div className="relative z-10 max-w-3xl">
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* Badge catégorie */}
          <span
            className="mb-5 inline-block rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-widest"
            style={{
              color: product.accentColor,
              background: `${product.accentColor}18`,
              border: `1px solid ${product.accentColor}35`,
            }}
          >
            {product.category}
          </span>

          {/* Emoji icône */}
          <div className="mb-4 text-6xl">{product.icon}</div>

          {/* Nom */}
          <h1
            className="mb-5 text-5xl font-black text-white sm:text-6xl lg:text-7xl"
            style={{ fontFamily: "'SF Pro Display', system-ui, sans-serif", letterSpacing: '-0.03em', lineHeight: 1.05 }}
          >
            {product.name}
          </h1>

          {/* Tagline */}
          <p
            className="mb-10 text-xl text-white/60 leading-relaxed max-w-2xl mx-auto"
            style={{ fontFamily: "'SF Pro Text', system-ui, sans-serif" }}
          >
            {product.tagline}
          </p>

          {/* Tech stacks */}
          <div className="flex flex-wrap justify-center gap-2 mb-10">
            {product.stacks.map((s) => {
              const stack = ISNA_TECH_STACKS[s];
              if (!stack) return null;
              return (
                <span
                  key={s}
                  className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold"
                  style={{ borderColor: `${stack.color}40`, color: stack.color, background: `${stack.color}12` }}
                >
                  <span className="h-1.5 w-1.5 rounded-full inline-block" style={{ background: stack.color }} />
                  {stack.name}
                </span>
              );
            })}
          </div>

          {/* Scroll cue */}
          <ChevronDown className="mx-auto h-5 w-5 animate-bounce text-white/20" />
        </motion.div>
      </div>
    </section>
  );
}

// ─── Section Histoire ─────────────────────────────────────────────────────────
function StorySection({ product }) {
  return (
    <section className="py-24 px-4 border-t border-white/[0.06]">
      <div className="mx-auto max-w-4xl">
        <NumberedSection number={1} label="L'histoire">
          {/* Problème */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="mb-8 rounded-2xl border border-red-500/20 bg-red-500/[0.05] p-6"
          >
            <div className="flex items-center gap-2 mb-3">
              <span className="text-red-400 text-lg">😓</span>
              <span className="text-xs font-bold uppercase tracking-widest text-red-400/70">Le problème</span>
            </div>
            <p className="text-lg text-white/80 leading-relaxed italic">
              &ldquo;{product.story.problem}&rdquo;
            </p>
          </motion.div>

          {/* Révélation */}
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="mb-8 rounded-2xl p-6 text-center"
            style={{
              background: `linear-gradient(135deg, ${product.accentGlow}, transparent 70%)`,
              border: `1px solid ${product.accentColor}25`,
            }}
          >
            <div className="mb-3">
              <Sparkles className="mx-auto h-6 w-6" style={{ color: product.accentColor }} />
            </div>
            <p
              className="text-2xl font-bold leading-relaxed"
              style={{ color: product.accentColor }}
            >
              &ldquo;{product.story.revelation}&rdquo;
            </p>
          </motion.div>

          {/* Solution */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="rounded-2xl border border-white/10 bg-white/[0.04] p-6"
          >
            <div className="flex items-center gap-2 mb-3">
              <Zap className="h-4 w-4" style={{ color: product.accentColor }} />
              <span
                className="text-xs font-bold uppercase tracking-widest"
                style={{ color: product.accentColor }}
              >
                La solution
              </span>
            </div>
            <p className="text-base text-white/80 leading-relaxed">{product.story.solution}</p>
          </motion.div>
        </NumberedSection>
      </div>
    </section>
  );
}

// ─── Section Fonctionnalités ──────────────────────────────────────────────────
function FeaturesSection({ product }) {
  return (
    <section className="py-24 px-4 border-t border-white/[0.06]">
      <div className="mx-auto max-w-4xl">
        <NumberedSection number={2} label="Fonctionnalités publiques">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {product.features.map((feat, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.07 }}
                className="rounded-xl border border-white/[0.07] bg-[#0c1018] p-5 transition-colors hover:border-white/[0.14]"
              >
                <div className="mb-3 text-2xl">{feat.icon}</div>
                <h4
                  className="text-sm font-bold text-white mb-1.5"
                  style={{ fontFamily: "'SF Pro Display', system-ui, sans-serif" }}
                >
                  {feat.title}
                </h4>
                <p className="text-xs text-white/45 leading-relaxed">{feat.desc}</p>
              </motion.div>
            ))}
          </div>
        </NumberedSection>
      </div>
    </section>
  );
}

// ─── Section Cibles ───────────────────────────────────────────────────────────
function AudienceSection({ product }) {
  return (
    <section className="py-24 px-4 border-t border-white/[0.06]">
      <div className="mx-auto max-w-4xl">
        <NumberedSection number={3} label="Public cible">
          <div className="space-y-3">
            {product.audience.map((a, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -16 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.45, delay: i * 0.1 }}
                className="flex items-center gap-4 rounded-xl border border-white/[0.07] bg-[#0c1018] p-4"
              >
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                  style={{ background: `${product.accentColor}18`, color: product.accentColor }}
                >
                  {i + 1}
                </div>
                <p className="text-sm text-white/75 leading-relaxed">{a}</p>
              </motion.div>
            ))}
          </div>
        </NumberedSection>
      </div>
    </section>
  );
}

// ─── Section Problèmes résolus ────────────────────────────────────────────────
function ProblemsSection({ product }) {
  return (
    <section
      className="py-24 px-4 border-t border-white/[0.06]"
      style={{ background: `radial-gradient(ellipse 80% 50% at 50% 50%, ${product.accentGlow}40, transparent)` }}
    >
      <div className="mx-auto max-w-4xl">
        <NumberedSection number={4} label="Problèmes résolus">
          <div className="space-y-2">
            {product.problems.map((prob, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.08 }}
                className="flex items-start gap-3 rounded-xl border border-white/[0.06] bg-[#0a0e16]/80 px-4 py-3"
              >
                <Check
                  className="mt-0.5 h-4 w-4 shrink-0"
                  style={{ color: product.accentColor }}
                />
                <p className="text-sm text-white/70 leading-relaxed">{prob}</p>
              </motion.div>
            ))}
          </div>
        </NumberedSection>
      </div>
    </section>
  );
}

// ─── Section Socles techno ────────────────────────────────────────────────────
function TechStackSection({ product }) {
  return (
    <section className="py-24 px-4 border-t border-white/[0.06]">
      <div className="mx-auto max-w-4xl">
        <NumberedSection number={5} label="Technologies embarquées">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {product.stacks.map((s, i) => (
              <motion.div
                key={s}
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.06 }}
              >
                <TechPill stackKey={s} />
              </motion.div>
            ))}
          </div>
        </NumberedSection>
      </div>
    </section>
  );
}

// ─── Section Comparaison ──────────────────────────────────────────────────────
function ComparisonSection({ product }) {
  return (
    <section className="py-24 px-4 border-t border-white/[0.06]">
      <div className="mx-auto max-w-4xl">
        <NumberedSection number={6} label="Comparaison marché">
          <div className="mb-5 rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-3">
            <p className="text-sm text-white/40 leading-relaxed">
              Une comparaison honnête — ISNA ne cherche pas à remplacer ces outils mais à aller
              là où ils ne peuvent pas.
            </p>
          </div>
          <div className="space-y-4">
            {product.comparisons.map((comp, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.45, delay: i * 0.1 }}
              >
                <ComparisonRow item={comp} accentColor={product.accentColor} />
              </motion.div>
            ))}
          </div>
        </NumberedSection>
      </div>
    </section>
  );
}

// ─── Navigation autres produits ───────────────────────────────────────────────
function OtherProducts({ currentSlug }) {
  const navigate = useNavigate();
  const others = ISNA_PRODUCTS.filter((p) => p.slug !== currentSlug).slice(0, 3);

  return (
    <section className="py-24 px-4 border-t border-white/[0.06]">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8 text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-white/30 mb-2">Continuer à explorer</p>
          <h3
            className="text-2xl font-black text-white"
            style={{ fontFamily: "'SF Pro Display', system-ui, sans-serif", letterSpacing: '-0.02em' }}
          >
            Autres produits ISNA
          </h3>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {others.map((p) => (
            <motion.button
              key={p.id}
              type="button"
              onClick={() => navigate(`/isna/produits/${p.slug}`)}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              whileHover={{ scale: 1.02 }}
              className="group rounded-2xl border border-white/[0.07] bg-[#0c1018] p-5 text-left transition-all hover:border-white/[0.16]"
            >
              <div className="mb-3 text-3xl">{p.icon}</div>
              <p
                className="text-sm font-bold text-white mb-1"
                style={{ fontFamily: "'SF Pro Display', system-ui, sans-serif" }}
              >
                {p.name}
              </p>
              <p className="text-[11px] text-white/40 line-clamp-2 leading-relaxed">{p.tagline}</p>
              <div
                className="mt-3 flex items-center gap-1 text-[11px] font-semibold"
                style={{ color: p.accentColor }}
              >
                Découvrir <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
              </div>
            </motion.button>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────
export default function IsnaProductStoryPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const product = ISNA_PRODUCTS.find((p) => p.slug === slug);

  if (!product) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#060810] text-white">
        <p className="text-2xl font-bold mb-4">Produit introuvable</p>
        <button
          type="button"
          onClick={() => navigate('/isna/produits')}
          className="rounded-xl border border-white/10 px-5 py-2.5 text-sm text-white/70 hover:text-white transition-colors"
        >
          ← Tous les produits
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#060810] text-white">
      {/* Nav bar */}
      <div className="sticky top-0 z-40 border-b border-white/[0.06] bg-[#060810]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <button
            type="button"
            onClick={() => navigate('/isna/produits')}
            className="flex items-center gap-2 text-sm text-white/50 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Tous les produits
          </button>
          <div className="flex items-center gap-2">
            <span className="text-lg">{product.icon}</span>
            <span
              className="text-sm font-bold"
              style={{ fontFamily: "'SF Pro Display', system-ui, sans-serif" }}
            >
              {product.name}
            </span>
          </div>
          <span
            className="rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-widest"
            style={{ color: product.accentColor, background: `${product.accentColor}18`, border: `1px solid ${product.accentColor}30` }}
          >
            {product.category}
          </span>
        </div>
      </div>

      {/* Sections */}
      <ProductHero product={product} />
      <StorySection product={product} />
      <FeaturesSection product={product} />
      <AudienceSection product={product} />
      <ProblemsSection product={product} />
      <TechStackSection product={product} />
      <ComparisonSection product={product} />
      <OtherProducts currentSlug={product.slug} />

      {/* Footer CTA */}
      <section className="py-24 px-4 text-center border-t border-white/[0.06]">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <div className="text-5xl mb-5">{product.icon}</div>
          <h2
            className="text-3xl font-black text-white mb-4"
            style={{ fontFamily: "'SF Pro Display', system-ui, sans-serif", letterSpacing: '-0.02em' }}
          >
            {product.name} est prêt.
          </h2>
          <p className="text-base text-white/40 mb-8 max-w-lg mx-auto">
            Ce produit fait partie de l&apos;écosystème ISNA — disponible pour les membres et institutions partenaires.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link
              to="/ecoles/prorascience"
              className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-bold text-black hover:opacity-90 transition-all"
              style={{ background: product.accentColor }}
            >
              En savoir plus
              <ArrowRight className="h-4 w-4" />
            </Link>
            <button
              type="button"
              onClick={() => navigate('/isna/produits')}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10 transition-all"
            >
              Voir tous les produits
            </button>
          </div>
        </motion.div>
      </section>
    </div>
  );
}
