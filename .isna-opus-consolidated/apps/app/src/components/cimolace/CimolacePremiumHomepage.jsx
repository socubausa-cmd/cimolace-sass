import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  Bell,
  Brain,
  Calendar,
  CheckCircle2,
  CreditCard,
  GraduationCap,
  Layers3,
  Megaphone,
  Play,
  Radio,
  Sparkles,
  Store,
  Users,
  Video,
  Wand2,
} from 'lucide-react';
import { OS_LIST } from '@/data/cimolaceOsData';
import { cimolacePlatformConfig } from '@/tenants/cimolace/cimolacePlatform.config';

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  show: { opacity: 1, y: 0, transition: { duration: 0.65, ease: [0.16, 1, 0.3, 1] } },
};

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

const heroCards = [
  { label: 'Paiement reçu', value: '+ 248 000 FCFA', icon: CreditCard, color: '#2cc275' },
  { label: 'Live en cours', value: '186 participants', icon: Radio, color: '#ec4899' },
  { label: 'Cours généré', value: '22 segments prêts', icon: GraduationCap, color: '#06b6d4' },
];

const technologyStories = [
  {
    title: 'Live intelligent',
    desc: 'Classes, conférences et communautés avec phases, SmartBoard, replay et mémoire IA.',
    icon: Video,
    color: '#ec4899',
    visual: 'live',
  },
  {
    title: 'Commerce africain',
    desc: 'Boutique, paiement mobile, devis, relances, logistique et suivi client dans un seul flux.',
    icon: Store,
    color: '#2cc275',
    visual: 'commerce',
  },
  {
    title: 'Studio créatif',
    desc: 'Cours, documents, vidéos, campagnes et supports pédagogiques produits dans un même espace.',
    icon: Wand2,
    color: '#8b5cf6',
    visual: 'studio',
  },
  {
    title: 'Secrétariat augmenté',
    desc: 'Rendez-vous, rappels, calendrier, support, CRM et automatisations pour garder le contrôle.',
    icon: Calendar,
    color: '#06b6d4',
    visual: 'admin',
  },
];

const humanScenes = [
  'Coach africain en live premium',
  'École connectée et suivie',
  'Boutique avec paiements mobiles',
  'Agence qui produit ses campagnes',
];

function FloatingCard({ item, index }) {
  const Icon = item.icon;
  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: 0.45 + index * 0.12, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      className="rounded-2xl border border-white/10 bg-white/10 backdrop-blur-2xl p-4 shadow-2xl"
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${item.color}22` }}>
          <Icon className="w-5 h-5" style={{ color: item.color }} />
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-white/40">{item.label}</p>
          <p className="text-sm font-black text-white mt-1">{item.value}</p>
        </div>
      </div>
    </motion.div>
  );
}

function HeroVisual() {
  return (
    <div className="relative min-h-[520px] lg:min-h-[640px]">
      <div className="absolute inset-0 rounded-[2.5rem] bg-gradient-to-br from-violet-500/20 via-cyan-400/10 to-emerald-400/10 blur-3xl" />
      <motion.div
        initial={{ opacity: 0, y: 40, rotateX: 8 }}
        animate={{ opacity: 1, y: 0, rotateX: 0 }}
        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
        className="relative rounded-[2rem] border border-white/10 bg-[#10111b]/80 shadow-2xl overflow-hidden backdrop-blur-xl"
      >
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-red-400/80" />
            <span className="w-3 h-3 rounded-full bg-amber-300/80" />
            <span className="w-3 h-3 rounded-full bg-emerald-400/80" />
          </div>
          <div className="text-xs text-white/35 font-mono">cimolace.africa/os/live</div>
        </div>
        <div className="grid grid-cols-12 min-h-[430px]">
          <div className="col-span-4 border-r border-white/10 p-5 hidden md:block">
            <div className="flex items-center gap-3 mb-7">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-500 to-cyan-400 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-white font-black text-sm">CIMOLACE</p>
                <p className="text-white/35 text-xs">Infrastructure active</p>
              </div>
            </div>
            {['Live Room', 'Paiements', 'School OS', 'Marketing', 'CRM'].map((item, index) => (
              <motion.div
                key={item}
                animate={{ opacity: index === 0 ? [0.8, 1, 0.8] : 1 }}
                transition={{ duration: 2.4, repeat: Infinity, delay: index * 0.2 }}
                className={`mb-2 rounded-xl px-3 py-3 text-sm ${index === 0 ? 'bg-violet-500/20 text-violet-100' : 'text-white/45 bg-white/[0.03]'}`}
              >
                {item}
              </motion.div>
            ))}
          </div>
          <div className="col-span-12 md:col-span-8 p-5 lg:p-7">
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-cyan-300/70">Tableau de bord vivant</p>
                <h3 className="text-2xl font-black text-white mt-2">Une infrastructure. Plusieurs métiers.</h3>
              </div>
              <div className="hidden sm:flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1.5 text-xs text-emerald-200">
                <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse" />
                Actif
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-4">
              {heroCards.map((item, index) => (
                <div key={item.label} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <div className="flex items-center justify-between mb-5">
                    <item.icon className="w-5 h-5" style={{ color: item.color }} />
                    <span className="text-[10px] text-white/30">+{12 + index * 7}%</span>
                  </div>
                  <p className="text-xs text-white/35">{item.label}</p>
                  <p className="text-lg font-black text-white mt-1">{item.value}</p>
                </div>
              ))}
              <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-violet-500/20 to-cyan-400/10 p-4">
                <Brain className="w-5 h-5 text-violet-200 mb-5" />
                <p className="text-xs text-white/40">Agent IA</p>
                <p className="text-lg font-black text-white mt-1">32 actions</p>
              </div>
            </div>
            <div className="rounded-3xl border border-white/10 bg-black/20 p-5 overflow-hidden">
              <div className="flex items-center justify-between mb-5">
                <p className="text-sm font-bold text-white">Flux de production</p>
                <Bell className="w-4 h-4 text-white/35" />
              </div>
              <div className="space-y-3">
                {['Un live démarre', 'Le SmartBoard se synchronise', 'Le replay devient un cours', 'La campagne est générée'].map((step, index) => (
                  <div key={step} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-white/[0.06] border border-white/10 flex items-center justify-center text-xs text-white/50">0{index + 1}</div>
                    <div className="flex-1 h-2 rounded-full bg-white/[0.06] overflow-hidden">
                      <motion.div
                        className="h-full rounded-full bg-gradient-to-r from-violet-400 to-cyan-300"
                        initial={{ width: '0%' }}
                        animate={{ width: `${45 + index * 14}%` }}
                        transition={{ duration: 1.4, delay: 0.7 + index * 0.18, ease: 'easeOut' }}
                      />
                    </div>
                    <p className="w-36 hidden sm:block text-xs text-white/45">{step}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </motion.div>
      <div className="absolute -left-6 top-24 hidden xl:block w-64">
        <FloatingCard item={heroCards[0]} index={0} />
      </div>
      <div className="absolute -right-8 bottom-20 hidden xl:block w-64">
        <FloatingCard item={heroCards[1]} index={1} />
      </div>
    </div>
  );
}

function PremiumHero() {
  return (
    <section id="home" className="scroll-mt-24 relative overflow-hidden bg-[#0a0a0f] px-6 pt-32 pb-20 lg:pt-40 lg:pb-28">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-44 left-1/2 -translate-x-1/2 w-[980px] h-[980px] rounded-full bg-violet-600/20 blur-[180px]" />
        <div className="absolute top-1/4 right-0 w-[560px] h-[560px] rounded-full bg-cyan-400/10 blur-[140px]" />
      </div>
      <div className="relative max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-14 items-center">
        <motion.div variants={stagger} initial="hidden" animate="show">
          <motion.div variants={fadeUp} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs text-white/60 mb-8">
            <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse" />
            Infrastructure intelligente pour l’Afrique moderne
          </motion.div>
          <motion.h1 variants={fadeUp} className="text-5xl md:text-6xl xl:text-7xl font-black tracking-tight leading-[0.92] text-white">
            Créez, vendez, enseignez et diffusez avec une seule infrastructure.
          </motion.h1>
          <motion.p variants={fadeUp} className="mt-7 text-xl text-white/58 leading-relaxed max-w-2xl">
            CIMOLACE réunit site, paiement, live, école, marketing, réservation et IA dans des OS prêts à l’emploi. Moins d’outils séparés. Plus de contrôle. Plus de vitesse.
          </motion.p>
          <motion.div variants={fadeUp} className="mt-10 flex flex-col sm:flex-row gap-3">
            <Link to={cimolacePlatformConfig.routes.installer} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-6 py-4 text-sm font-black text-[#0a0a0f] hover:bg-white/90 transition-colors">
              Créer ma plateforme
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link to="/cimolace/products" className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-6 py-4 text-sm font-black text-white hover:bg-white/[0.08] transition-colors">
              Explorer les OS
            </Link>
          </motion.div>
          <motion.div variants={fadeUp} className="mt-10 grid grid-cols-3 gap-5 max-w-xl">
            {[
              ['7', 'OS prêts'],
              ['30+', 'moteurs'],
              ['1', 'stack unifiée'],
            ].map(([value, label]) => (
              <div key={label}>
                <p className="text-3xl font-black text-white">{value}</p>
                <p className="text-xs uppercase tracking-[0.18em] text-white/35 mt-1">{label}</p>
              </div>
            ))}
          </motion.div>
        </motion.div>
        <HeroVisual />
      </div>
    </section>
  );
}

function ConfiguratorStrip() {
  return (
    <section id="configurator" className="scroll-mt-24 bg-white text-[#0a0a0f] px-6 py-20 lg:py-24 border-y border-black/[0.06]">
      <div className="max-w-7xl mx-auto flex flex-col lg:flex-row lg:items-center lg:justify-between gap-10">
        <div className="max-w-2xl">
          <p className="text-xs uppercase tracking-[0.3em] text-[#5b3df5] mb-3">Configurateur</p>
          <h2 className="text-3xl lg:text-4xl font-black tracking-tight leading-tight mb-4">
            Composez votre OS : modules, marque, domaine.
          </h2>
          <p className="text-[#424245] leading-relaxed">
            Le parcours guidé reprend la logique du catalogue : vous choisissez la verticale, nous préparons le déploiement et la
            mise en route.
          </p>
        </div>
        <Link
          to={cimolacePlatformConfig.routes.configurateur}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-[#0a0a0f] px-8 py-4 text-sm font-black text-white hover:bg-[#1f1f2a] transition-colors"
        >
          Ouvrir le configurateur
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </section>
  );
}

function OsShowcase() {
  const featured = OS_LIST.slice(0, 7);
  return (
    <section id="os" className="scroll-mt-24 bg-[#f5f4ff] text-[#0a0a0f] px-6 py-24 lg:py-32">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-[0.8fr_1.2fr] gap-12 items-end mb-14">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-[#5b3df5] mb-4">Infrastructures prêtes</p>
            <h2 className="text-4xl lg:text-6xl font-black tracking-tight leading-[0.95]">Pas des plugins. Des OS métier.</h2>
          </div>
          <p className="text-lg text-[#424245] leading-relaxed max-w-2xl">
            Chaque OS assemble les bons outils pour une réalité : école, commerce, média, live, temple, business ou création. Vous choisissez un métier, pas une pile technique.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {featured.map((os, index) => (
            <motion.div
              key={os.id}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-8%' }}
              transition={{ duration: 0.55, delay: index * 0.04 }}
            >
              <Link to={`/cimolace/os/${os.id}`} className="group block h-full rounded-[1.75rem] border border-black/5 bg-white p-6 shadow-sm hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 overflow-hidden">
                <div className="relative h-44 rounded-3xl mb-6 overflow-hidden" style={{ background: `linear-gradient(135deg, ${os.colorHex}24, ${os.colorHex}08)` }}>
                  <div className="absolute inset-0 opacity-70" style={{ backgroundImage: `radial-gradient(circle at 30% 20%, ${os.colorHex}66, transparent 32%), radial-gradient(circle at 80% 80%, #ffffffaa, transparent 28%)` }} />
                  <div className="absolute left-5 bottom-5 right-5 rounded-2xl border border-white/50 bg-white/55 backdrop-blur-xl p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-white font-black" style={{ backgroundColor: os.colorHex }}>{os.icon}</div>
                      <div>
                        <p className="text-sm font-black text-[#0a0a0f]">{os.name}</p>
                        <p className="text-xs text-[#424245] mt-1">{os.price}</p>
                      </div>
                    </div>
                  </div>
                </div>
                <h3 className="text-2xl font-black tracking-tight mb-3">{os.name}</h3>
                <p className="text-sm text-[#424245] leading-relaxed mb-5">{os.tagline}</p>
                <div className="flex flex-wrap gap-2 mb-6">
                  {os.uses.slice(0, 3).map((use) => (
                    <span key={use} className="rounded-full border border-black/5 bg-[#fafafa] px-3 py-1 text-[11px] text-[#6e6e73]">{use}</span>
                  ))}
                </div>
                <div className="inline-flex items-center gap-2 text-sm font-black" style={{ color: os.colorHex }}>
                  Découvrir l’OS
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function TechnologyVisual({ visual, color }) {
  if (visual === 'live') {
    return (
      <div className="grid grid-cols-3 gap-2">
        {[0, 1, 2, 3, 4, 5].map((item) => (
          <div key={item} className="aspect-video rounded-xl bg-white/[0.08] border border-white/10 overflow-hidden">
            <div className="w-full h-full" style={{ background: `linear-gradient(135deg, ${color}30, transparent)` }} />
          </div>
        ))}
      </div>
    );
  }
  if (visual === 'commerce') {
    return (
      <div className="space-y-2">
        {['Commande #1428', 'Paiement mobile validé', 'Colis optimisé'].map((item, index) => (
          <div key={item} className="flex items-center justify-between rounded-xl bg-white/[0.07] border border-white/10 px-3 py-2">
            <span className="text-xs text-white/60">{item}</span>
            <CheckCircle2 className="w-4 h-4" style={{ color }} />
          </div>
        ))}
      </div>
    );
  }
  if (visual === 'studio') {
    return (
      <div className="rounded-2xl bg-black/25 border border-white/10 p-3">
        <div className="h-20 rounded-xl mb-3" style={{ background: `linear-gradient(135deg, ${color}45, #22d3ee22)` }} />
        <div className="grid grid-cols-4 gap-2">
          {[30, 60, 45, 80].map((height, index) => <div key={index} className="rounded bg-white/15" style={{ height }} />)}
        </div>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-2">
      {['10:00', '12:30', '15:00', '17:45'].map((time) => (
        <div key={time} className="rounded-xl bg-white/[0.07] border border-white/10 p-3">
          <p className="text-xs text-white/35">RDV</p>
          <p className="font-black text-white mt-1">{time}</p>
        </div>
      ))}
    </div>
  );
}

function TechnologiesShowcase() {
  return (
    <section id="how" className="scroll-mt-24 bg-[#0a0a0f] px-6 py-24 lg:py-32 text-white overflow-hidden">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 mb-14">
          <div className="max-w-3xl">
            <p className="text-xs uppercase tracking-[0.3em] text-cyan-300/70 mb-4">Technologies vivantes</p>
            <h2 className="text-4xl lg:text-6xl font-black tracking-tight leading-[0.95]">Chaque moteur doit se voir, se comprendre, se ressentir.</h2>
          </div>
          <Link to={cimolacePlatformConfig.routes.resourcesDocs} className="inline-flex items-center gap-2 text-sm font-black text-cyan-200 hover:text-white transition-colors">
            Voir la documentation
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {technologyStories.map((item, index) => {
            const Icon = item.icon;
            return (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-8%' }}
                transition={{ duration: 0.55, delay: index * 0.05 }}
                className="rounded-[1.75rem] border border-white/10 bg-white/[0.035] p-5 hover:bg-white/[0.055] transition-colors"
              >
                <div className="h-40 rounded-3xl border border-white/10 bg-black/20 p-4 mb-6 overflow-hidden">
                  <TechnologyVisual visual={item.visual} color={item.color} />
                </div>
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-5" style={{ backgroundColor: `${item.color}18` }}>
                  <Icon className="w-6 h-6" style={{ color: item.color }} />
                </div>
                <h3 className="text-xl font-black mb-3">{item.title}</h3>
                <p className="text-sm text-white/45 leading-relaxed">{item.desc}</p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function HostingModesSection() {
  return (
    <section id="hosting" className="scroll-mt-24 bg-[#fafafa] text-[#0a0a0f] px-6 py-24 lg:py-32 border-t border-black/[0.06]">
      <div className="max-w-7xl mx-auto">
        <p className="text-xs uppercase tracking-[0.3em] text-[#5b3df5] mb-4">Hébergement</p>
        <h2 className="text-4xl lg:text-5xl font-black tracking-tight leading-[0.95] mb-5">Deux modes. Vous choisissez.</h2>
        <p className="text-lg text-[#424245] max-w-3xl leading-relaxed mb-12">
          CIMOLACE peut être hébergé chez nous (zéro souci) ou installé sur votre infrastructure (souveraineté totale). Même produit,
          deux modes opératoires.
        </p>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-[1.75rem] border-2 border-[#5b3df5]/35 bg-white p-8 shadow-sm">
            <span className="inline-block text-[11px] font-black uppercase tracking-wider text-[#5b3df5] mb-4">
              Hébergé CIMOLACE · recommandé
            </span>
            <h3 className="text-2xl font-black mb-3">Hébergé CIMOLACE</h3>
            <p className="text-[#424245] text-sm leading-relaxed mb-6">
              Vous connectez votre domaine, on s&apos;occupe de tout. Mises à jour, sauvegardes, scalabilité, monitoring.
            </p>
            <ul className="space-y-3 text-sm text-[#424245]">
              {[
                'Mise en route en 24h',
                'Mises à jour automatiques',
                'Sauvegardes quotidiennes',
                'Scalabilité selon le trafic',
                'Conformité RGPD',
                'Support technique inclus',
              ].map((item) => (
                <li key={item} className="flex gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-[1.75rem] border border-black/10 bg-white p-8 shadow-sm">
            <span className="inline-block text-[11px] font-black uppercase tracking-wider text-[#0a0a0f]/60 mb-4">
              Installation privée
            </span>
            <h3 className="text-2xl font-black mb-3">Sur votre infrastructure</h3>
            <p className="text-[#424245] text-sm leading-relaxed mb-6">
              Déploiement sur votre cloud ou serveur dédié. Souveraineté complète sur vos données.
            </p>
            <ul className="space-y-3 text-sm text-[#424245]">
              {[
                'AWS, GCP, Azure ou serveur dédié',
                'Vos données restent chez vous',
                'Code protégé (licence commerciale)',
                'Support installation et maintenance',
                'Institutions, écoles, ONG',
                'Tarification sur devis',
              ].map((item) => (
                <li key={item} className="flex gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-[#c9a227] mt-0.5" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

function HumanProofSection() {
  return (
    <section className="bg-white text-[#0a0a0f] px-6 py-24 lg:py-32">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-14 items-center">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-[#5b3df5] mb-4">Afrique moderne</p>
          <h2 className="text-4xl lg:text-6xl font-black tracking-tight leading-[0.95] mb-7">La technologie doit montrer des personnes, pas seulement des diagrammes.</h2>
          <p className="text-lg text-[#424245] leading-relaxed mb-8">
            La nouvelle direction visuelle CIMOLACE met en scène des entrepreneurs, enseignants, créateurs, équipes et communautés africaines dans des environnements premium.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {humanScenes.map((scene) => (
              <div key={scene} className="rounded-2xl border border-black/5 bg-[#fafafa] px-4 py-3 text-sm font-bold text-[#424245]">
                {scene}
              </div>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {humanScenes.map((scene, index) => (
            <motion.div
              key={scene}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.55, delay: index * 0.08 }}
              className={`relative rounded-[2rem] overflow-hidden min-h-[230px] ${index % 2 ? 'mt-10' : ''}`}
              style={{ background: `linear-gradient(135deg, ${['#c9a227', '#1a4f8f', '#2cc275', '#ec4899'][index]}33, #f5f4ff)` }}
            >
              <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle at 30% 20%, rgba(255,255,255,.9), transparent 28%), radial-gradient(circle at 70% 75%, rgba(10,10,15,.14), transparent 32%)' }} />
              <div className="absolute left-4 right-4 bottom-4 rounded-2xl bg-white/70 backdrop-blur-xl border border-white/70 p-4">
                <p className="text-sm font-black text-[#0a0a0f]">{scene}</p>
                <p className="text-xs text-[#6e6e73] mt-1">Image premium à générer</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalPremiumCta() {
  return (
    <section id="contact" className="scroll-mt-24 bg-[#f5f4ff] px-6 py-24">
      <div className="max-w-6xl mx-auto rounded-[2.5rem] bg-[#0a0a0f] text-white p-8 lg:p-14 overflow-hidden relative">
        <div className="absolute -top-32 right-0 w-[520px] h-[520px] rounded-full bg-violet-500/25 blur-[120px]" />
        <div className="relative max-w-3xl">
          <p className="text-xs uppercase tracking-[0.3em] text-white/35 mb-4">Passez à l&apos;action</p>
          <h2 className="text-3xl lg:text-5xl font-black tracking-tight mb-5">Votre plateforme. Demain.</h2>
          <p className="text-white/50 leading-relaxed mb-10">
            Deux options pour démarrer. Engagement nul tant que vous n&apos;avez pas validé — configurateur interactif ou message à
            l&apos;équipe commerciale.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 mb-12">
            <Link
              to={cimolacePlatformConfig.routes.installer}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-6 py-4 text-sm font-black text-[#0a0a0f] hover:bg-white/90 transition-colors"
            >
              Créer ma plateforme
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              to={cimolacePlatformConfig.routes.contact}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/[0.04] px-6 py-4 text-sm font-black text-white hover:bg-white/[0.08] transition-colors"
            >
              Demander une démo
            </Link>
          </div>
          <p className="text-lg md:text-xl font-black text-white/90 leading-snug">
            CIMOLACE ne vend pas <span className="line-through text-white/30">des outils</span>.{' '}
            <span className="block sm:inline sm:ml-1 mt-2 sm:mt-0">
              CIMOLACE déploie{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-cyan-300">des plateformes complètes</span>.
            </span>
          </p>
        </div>
      </div>
    </section>
  );
}

export default function CimolacePremiumHomepage() {
  return (
    <>
      <PremiumHero />
      <OsShowcase />
      <ConfiguratorStrip />
      <TechnologiesShowcase />
      <HostingModesSection />
      <HumanProofSection />
      <FinalPremiumCta />
    </>
  );
}
