import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Boxes, CheckCircle2, Layers3, ShieldCheck, Wrench } from 'lucide-react';
import { INCLUSION_LEVELS, OS_STABILITY_MATRIX, PRODUCT_LEVEL_DEFINITIONS, TOOL_CATALOGUE } from '@/data/cimolaceProductTaxonomy';

const levelIcons = [Layers3, ShieldCheck, Boxes, Wrench, CheckCircle2];
const levelColors = ['#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ec4899'];

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } },
};

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};

const levelBadgeColor = {
  required: '#ef4444',
  recommended: '#f59e0b',
  optional: '#06b6d4',
};

const TaxonomyCard = ({ item, index }) => {
  const Icon = levelIcons[index] || Boxes;
  const color = levelColors[index] || '#8b5cf6';

  return (
    <motion.div
      variants={fadeUp}
      className="relative p-5 rounded-2xl border border-white/[0.08] bg-white/[0.025] overflow-hidden"
    >
      <div className="absolute inset-0 opacity-40" style={{ background: `radial-gradient(circle at top left, ${color}16, transparent 55%)` }} />
      <div className="relative">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${color}18` }}>
            <Icon className="w-5 h-5" style={{ color }} />
          </div>
          <span className="text-[10px] uppercase tracking-[0.22em] font-bold" style={{ color }}>{item.label}</span>
        </div>
        <h3 className="text-lg font-black text-white mb-2">{item.title}</h3>
        <p className="text-sm text-white/45 leading-relaxed mb-4">{item.definition}</p>
        <p className="text-xs text-white/30">Exemple : <span className="text-white/60">{item.example}</span></p>
      </div>
    </motion.div>
  );
};

const StabilityTool = ({ entry }) => {
  const tool = TOOL_CATALOGUE[entry.toolId];
  const color = levelBadgeColor[entry.level] || '#8b5cf6';

  if (!tool) return null;

  return (
    <motion.div variants={fadeUp} className="p-4 rounded-xl bg-white/[0.025] border border-white/[0.07]">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h4 className="text-sm font-bold text-white">{tool.name}</h4>
          <p className="text-[10px] uppercase tracking-[0.18em] text-white/25 mt-1">{tool.category} · {entry.role}</p>
        </div>
        <span className="text-[10px] font-bold px-2 py-1 rounded-full whitespace-nowrap" style={{ color, backgroundColor: `${color}14`, border: `1px solid ${color}30` }}>
          {INCLUSION_LEVELS[entry.level]?.label || entry.level}
        </span>
      </div>
      <p className="text-xs text-white/45 leading-relaxed mb-2">{entry.reason}</p>
      <p className="text-xs text-white/25 leading-relaxed">Risque sans cet outil : {entry.absenceRisk}</p>
    </motion.div>
  );
};

const StabilityMatrixPreview = () => {
  const osEntries = Object.values(OS_STABILITY_MATRIX).slice(0, 3);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      {osEntries.map((os) => (
        <motion.div key={os.name} variants={fadeUp} className="rounded-3xl border border-white/[0.08] bg-white/[0.02] p-5">
          <div className="mb-5">
            <p className="text-[10px] uppercase tracking-[0.28em] text-cyan-400/60 mb-2">Stabilité OS</p>
            <h3 className="text-xl font-black text-white mb-3">{os.name}</h3>
            <div className="flex flex-wrap gap-2">
              {os.stabilityChain.map((step) => (
                <span key={step} className="text-[10px] px-2 py-1 rounded-full bg-white/[0.04] text-white/35 border border-white/[0.06]">
                  {step}
                </span>
              ))}
            </div>
          </div>
          <motion.div variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true }} className="space-y-3">
            {os.tools.slice(0, 3).map((entry) => (
              <StabilityTool key={`${os.name}-${entry.toolId}`} entry={entry} />
            ))}
          </motion.div>
        </motion.div>
      ))}
    </div>
  );
};

const CimolaceProductTaxonomySection = () => {
  return (
    <section className="relative bg-[#07070f] py-28 px-6 overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[700px] rounded-full bg-violet-600/8 blur-[150px]" />
      </div>

      <div className="relative max-w-7xl mx-auto">
        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
          className="text-center max-w-3xl mx-auto mb-16"
        >
          <motion.span variants={fadeUp} className="inline-block text-xs text-violet-400 tracking-[0.3em] uppercase mb-5">
            Comprendre la gamme
          </motion.span>
          <motion.h2 variants={fadeUp} className="text-4xl lg:text-6xl font-black text-white tracking-tight leading-tight mb-6">
            Infrastructure, OS, offre, outil :{' '}
            <span className="bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">chaque mot a un rôle.</span>
          </motion.h2>
          <motion.p variants={fadeUp} className="text-lg text-white/45 leading-relaxed">
            Un OS n'est pas une liste d\'outils. C\'est une configuration stable. Chaque outil existe dans la gamme parce qu\'il couvre une étape critique : produire, enseigner, vendre, encaisser, diffuser, automatiser ou retenir.
          </motion.p>
        </motion.div>

        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-60px' }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-20"
        >
          {PRODUCT_LEVEL_DEFINITIONS.map((item, index) => (
            <TaxonomyCard key={item.id} item={item} index={index} />
          ))}
        </motion.div>

        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-60px' }}
          className="mb-10"
        >
          <motion.div variants={fadeUp} className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-8">
            <div>
              <span className="text-[10px] tracking-[0.3em] uppercase text-cyan-400/60 mb-3 block">Matrice de stabilité</span>
              <h3 className="text-3xl lg:text-4xl font-black text-white tracking-tight">Pourquoi chaque outil est dans un OS</h3>
            </div>
            <p className="text-sm text-white/35 max-w-xl leading-relaxed">
              La documentation détaillera ensuite chaque outil, son rôle, son niveau d'inclusion et le risque si on le retire de l\'infrastructure.
            </p>
          </motion.div>
          <StabilityMatrixPreview />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mt-14"
        >
          <a href="/cimolace/comparaison" className="inline-flex items-center gap-2 px-7 py-4 rounded-xl bg-white/[0.06] border border-white/[0.1] text-white font-bold text-sm hover:bg-white/[0.1] transition-colors">
            Comprendre la différence
            <ArrowRight className="w-4 h-4" />
          </a>
        </motion.div>
      </div>
    </section>
  );
};

export default CimolaceProductTaxonomySection;
