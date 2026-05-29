import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  BadgeCheck,
  Brain,
  Building2,
  CircleDollarSign,
  GraduationCap,
  Layers3,
  LockKeyhole,
  MonitorPlay,
  Palette,
  Play,
  Radio,
  Sparkles,
  Wand2,
} from 'lucide-react';
import {
  cimolaceArchitectureBlocks,
  cimolaceHeroMetrics,
  cimolaceOperatingSystems,
  cimolacePrimaryEngines,
  cimolaceSchoolProof,
} from '@/data/cimolaceLandingV2Content';

const ease = [0.16, 1, 0.3, 1];

function Eyebrow({ children, light = false }) {
  return (
    <p className={`mb-5 text-xs font-black uppercase tracking-[0.28em] ${light ? 'text-white/45' : 'text-[#6d5dfc]'}`}>
      {children}
    </p>
  );
}

function DeviceScreen({ title, subtitle, accent = '#6d5dfc', children, className = '' }) {
  return (
    <div className={`overflow-hidden rounded-[2rem] border border-black/10 bg-white shadow-2xl shadow-black/10 ${className}`}>
      <div className="flex items-center justify-between border-b border-black/5 px-5 py-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#8b8b93]">{subtitle}</p>
          <p className="mt-1 text-sm font-black text-[#15151a]">{title}</p>
        </div>
        <div className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#ff605c]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#ffbd44]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#00ca4e]" />
        </div>
      </div>
      <div className="relative min-h-[280px] bg-[#f5f5f7] p-5">
        <div className="absolute right-8 top-8 h-28 w-28 rounded-full blur-3xl" style={{ backgroundColor: `${accent}33` }} />
        <div className="relative">{children}</div>
      </div>
    </div>
  );
}

function HeroProduct() {
  return (
    <div className="relative mx-auto mt-10 max-w-6xl px-4 lg:mt-12">
      <motion.div
        initial={false}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.9, delay: 0.18, ease }}
        className="relative"
      >
        <div className="absolute inset-x-10 top-12 h-52 rounded-full bg-[#7c5cff]/20 blur-[90px]" />
        <DeviceScreen title="CIMOLACE Platform" subtitle="tenant control plane" accent="#6d5dfc" className="relative mx-auto max-w-5xl">
          <div className="grid gap-4 md:grid-cols-[.9fr_1.1fr]">
            <div className="rounded-[1.5rem] bg-[#101014] p-5 text-white">
              <div className="mb-7 flex items-center justify-between">
                <span className="rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-black text-emerald-300">prod</span>
                <span className="text-xs text-white/35">cimolace.space</span>
              </div>
              <p className="text-3xl font-black tracking-tight md:text-4xl">Un tenant.</p>
              <p className="mt-1 text-3xl font-black tracking-tight text-white/45 md:text-4xl">Plusieurs moteurs.</p>
              <div className="mt-7 grid grid-cols-3 gap-2">
                {cimolaceHeroMetrics.map((metric) => (
                  <div key={metric.label} className="rounded-2xl bg-white/[0.06] p-3">
                    <p className="text-2xl font-black">{metric.value}</p>
                    <p className="mt-1 text-[10px] uppercase tracking-[0.16em] text-white/35">{metric.label}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                ['School OS', GraduationCap, '#1a4f8f'],
                ['LIRI Live', Radio, '#ff6b4a'],
                ['Creator Studio', MonitorPlay, '#a855f7'],
                ['Pay Engine', CircleDollarSign, '#2cc275'],
              ].map(([label, Icon, color], index) => (
                <motion.div
                  key={label}
                  initial={false}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.55, delay: 0.45 + index * 0.08, ease }}
                  className="rounded-[1.5rem] border border-black/5 bg-white p-4"
                >
                  <div className="mb-6 flex h-11 w-11 items-center justify-center rounded-2xl" style={{ backgroundColor: `${color}18` }}>
                    <Icon className="h-5 w-5" style={{ color }} />
                  </div>
                  <p className="text-lg font-black text-[#15151a]">{label}</p>
                  <p className="mt-1 text-xs font-bold text-[#86868b]">moteur activable</p>
                </motion.div>
              ))}
            </div>
          </div>
        </DeviceScreen>
      </motion.div>
    </div>
  );
}

function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-[#f5f5f7] px-5 pb-20 pt-24 text-[#15151a] md:px-8 lg:pb-24 lg:pt-28">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[520px] bg-[radial-gradient(circle_at_50%_0%,rgba(111,88,255,0.18),transparent_58%)]" />
      <div className="pointer-events-none absolute left-1/2 top-24 h-28 w-[min(820px,80vw)] -translate-x-1/2 rounded-full bg-white/80 blur-3xl" />
      <div className="mx-auto max-w-7xl text-center">
        <motion.p
          initial={false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease }}
          className="relative text-sm font-black uppercase tracking-[0.22em] text-[#6d5dfc]"
        >
          Plateforme multi-tenant
        </motion.p>
        <motion.h1
          initial={false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.06, ease }}
          className="relative mx-auto mt-4 max-w-6xl text-6xl font-black leading-[0.86] tracking-tight md:text-8xl lg:text-[9.5rem]"
        >
          CIMOLACE.
        </motion.h1>
        <motion.p
          initial={false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.09, ease }}
          className="relative mx-auto mt-4 max-w-5xl text-4xl font-black leading-[0.95] tracking-tight text-[#15151a]/70 md:text-6xl lg:text-7xl"
        >
          L'OS vivant des nouveaux tenants.
        </motion.p>
        <motion.p
          initial={false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.12, ease }}
          className="relative mx-auto mt-6 max-w-3xl text-xl font-semibold leading-relaxed text-[#515154] md:text-2xl"
        >
          Lancez une ecole, un commerce, un studio ou une plateforme metier avec les moteurs live, IA, paiement, contenu et backoffice deja connectes.
        </motion.p>
        <motion.div
          initial={false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.18, ease }}
          className="relative mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row"
        >
          <Link to="/cimolace/installer" className="inline-flex items-center gap-2 rounded-full bg-[#0071e3] px-7 py-3 text-sm font-black text-white transition hover:bg-[#0077ed]">
            Commencer
            <ArrowRight className="h-4 w-4" />
          </Link>
          <a href="#film" className="inline-flex items-center gap-2 rounded-full px-7 py-3 text-sm font-black text-[#0071e3] transition hover:text-[#005bb5]">
            Voir la vision
            <Play className="h-4 w-4" />
          </a>
        </motion.div>
      </div>
      <HeroProduct />
    </section>
  );
}

function HighlightsSection() {
  const highlights = [
    {
      title: 'Un socle multi-tenant pour tout connecter.',
      icon: Layers3,
      color: '#6d5dfc',
      text: 'Identite, roles, domaine, donnees, moteurs, backoffice et facturation dans une architecture commune.',
    },
    {
      title: 'Des moteurs qui donnent vie au produit.',
      icon: Sparkles,
      color: '#ff6b4a',
      text: 'Live, SmartBoard, IA, postproduction, paiement, CRM, marketing, notifications et contenu.',
    },
    {
      title: 'Des OS metier prets a deployer.',
      icon: Building2,
      color: '#2cc275',
      text: 'School OS, Commerce OS, Creator OS, Business OS, Media OS, MedOS et Community OS.',
    },
    {
      title: 'Chaque client garde son univers.',
      icon: Palette,
      color: '#c9a227',
      text: 'Logo, domaine, couleurs, pages, modules visibles et experience tenant sont configurables.',
    },
  ];

  return (
    <section id="film" className="bg-white px-5 py-24 text-[#15151a] md:px-8 lg:py-32">
      <div className="mx-auto max-w-7xl">
        <div className="mb-12 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <Eyebrow>Highlights</Eyebrow>
            <h2 className="text-4xl font-black tracking-tight md:text-6xl">La plateforme, en mouvement.</h2>
          </div>
          <Link to="/cimolace/architecture" className="inline-flex items-center gap-2 text-sm font-black text-[#0071e3]">
            Voir l'architecture
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="flex snap-x gap-5 overflow-x-auto pb-6">
          {highlights.map((item, index) => {
            const Icon = item.icon;
            return (
              <motion.article
                key={item.title}
                initial={{ opacity: 1, y: 0 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.65, delay: index * 0.06, ease }}
                className="min-h-[460px] w-[82vw] shrink-0 snap-center overflow-hidden rounded-[2.2rem] bg-[#f5f5f7] p-7 md:w-[520px]"
              >
                <div className="flex h-full flex-col justify-between">
                  <div className="flex h-16 w-16 items-center justify-center rounded-3xl" style={{ backgroundColor: `${item.color}18` }}>
                    <Icon className="h-8 w-8" style={{ color: item.color }} />
                  </div>
                  <div>
                    <h3 className="text-3xl font-black leading-tight tracking-tight md:text-4xl">{item.title}</h3>
                    <p className="mt-5 text-base font-semibold leading-relaxed text-[#66666d]">{item.text}</p>
                  </div>
                </div>
              </motion.article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function ControlPlaneScene() {
  const tenants = [
    { name: 'ISNA / Prorascience', status: 'Production', health: '99.98%', engines: '12 actifs' },
    { name: 'Virtuel Mbolo', status: 'Onboarding', health: 'Pret', engines: '8 actifs' },
    { name: 'MedOS Clinic', status: 'Staging', health: 'OK', engines: '6 actifs' },
  ];

  const signals = [
    ['API', 'Cloud Run', '#1a4f8f'],
    ['Auth', 'Supabase', '#2cc275'],
    ['Live', 'LiveKit', '#ff6b4a'],
    ['Billing', 'Stripe + CinetPay', '#111827'],
  ];

  return (
    <section className="bg-[#101014] px-5 py-24 text-white md:px-8 lg:py-32">
      <div className="mx-auto grid max-w-7xl gap-14 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
        <div>
          <Eyebrow light>Control plane</Eyebrow>
          <h2 className="text-5xl font-black leading-[0.94] tracking-tight md:text-7xl">
            Voir, activer, piloter.
          </h2>
          <p className="mt-7 max-w-xl text-xl font-semibold leading-relaxed text-white/58">
            Cimolace doit montrer l'etat reel d\'un tenant : moteurs actifs, API connectees, statut live, facturation, maintenance et incidents.
          </p>
          <div className="mt-10 grid gap-3 sm:grid-cols-2">
            {signals.map(([label, value, color]) => (
              <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-white/35">{label}</p>
                <div className="mt-4 flex items-center gap-3">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
                  <p className="text-sm font-black text-white">{value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative">
          <div className="absolute inset-x-8 top-10 h-40 rounded-[3rem] bg-white/10 blur-3xl" />
          <div className="relative overflow-hidden rounded-[2.5rem] border border-white/10 bg-[#17171d] shadow-2xl shadow-black/40">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-white/35">CIMOLACE OS</p>
                <p className="mt-1 text-sm font-black">Tenant operations console</p>
              </div>
              <div className="rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-black text-emerald-300">All systems normal</div>
            </div>

            <div className="grid gap-4 p-4 md:grid-cols-[1fr_0.9fr]">
              <div className="space-y-3">
                {tenants.map((tenant, index) => (
                  <motion.div
                    key={tenant.name}
                    initial={{ opacity: 1, y: 0 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.55, delay: index * 0.05, ease }}
                    className="rounded-[1.5rem] border border-white/8 bg-white/[0.06] p-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-lg font-black">{tenant.name}</p>
                        <p className="mt-1 text-xs font-bold uppercase tracking-[0.16em] text-white/35">{tenant.status}</p>
                      </div>
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-[#101014]">{tenant.engines}</span>
                    </div>
                    <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/10">
                      <div className="h-full rounded-full bg-[#2cc275]" style={{ width: index === 0 ? '94%' : index === 1 ? '72%' : '58%' }} />
                    </div>
                    <p className="mt-3 text-xs font-semibold text-white/45">Sante: {tenant.health}</p>
                  </motion.div>
                ))}
              </div>

              <div className="rounded-[1.8rem] bg-white p-4 text-[#15151a]">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[#8b8b93]">ISNA blueprint</p>
                <p className="mt-3 text-3xl font-black leading-tight">School OS pret a cloner.</p>
                <div className="mt-8 space-y-3">
                  {['Branding tenant', 'Live classrooms', 'SmartBoard', 'Replay + postproduction', 'Paiement & abonnement'].map((item) => (
                    <div key={item} className="flex items-center justify-between rounded-2xl bg-[#f5f5f7] px-4 py-3">
                      <span className="text-sm font-black">{item}</span>
                      <BadgeCheck className="h-5 w-5 text-[#2cc275]" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function LivingEngineVisual({ engine }) {
  return (
    <DeviceScreen title={engine.name} subtitle={engine.category} accent={engine.accent}>
      <div className="grid gap-4 sm:grid-cols-[.8fr_1.2fr]">
        <div className="rounded-[1.4rem] p-5 text-white" style={{ backgroundColor: '#111116' }}>
          <div className="mb-14 h-2 w-20 rounded-full" style={{ backgroundColor: engine.accent }} />
          <p className="text-3xl font-black leading-tight">{engine.name}</p>
          <p className="mt-3 text-sm text-white/45">{engine.status}</p>
        </div>
        <div className="space-y-3">
          {engine.capabilities.map((capability) => (
            <div key={capability} className="flex items-center justify-between rounded-2xl border border-black/5 bg-white px-4 py-3">
              <span className="text-sm font-black text-[#34343a]">{capability}</span>
              <BadgeCheck className="h-5 w-5" style={{ color: engine.accent }} />
            </div>
          ))}
          <div className="rounded-2xl bg-[#15151a] p-4 text-white">
            <p className="text-xs uppercase tracking-[0.18em] text-white/35">resultat</p>
            <p className="mt-3 text-lg font-black">Un moteur activable dans le tenant.</p>
          </div>
        </div>
      </div>
    </DeviceScreen>
  );
}

function EngineChaptersSection() {
  const featured = cimolacePrimaryEngines.slice(0, 5);
  return (
    <section id="moteurs" className="bg-[#f5f5f7] px-5 py-24 text-[#15151a] md:px-8 lg:py-32">
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto mb-20 max-w-4xl text-center">
          <Eyebrow>Moteurs</Eyebrow>
          <h2 className="text-5xl font-black leading-[0.96] tracking-tight md:text-7xl">
            Built for the way platforms really work.
          </h2>
          <p className="mx-auto mt-7 max-w-2xl text-xl font-semibold leading-relaxed text-[#66666d]">
            CIMOLACE ne vend pas une seule app. Il assemble les moteurs qui donnent vie a chaque infrastructure.
          </p>
        </div>

        <div className="space-y-24">
          {featured.map((engine, index) => (
            <motion.div
              key={engine.name}
              initial={{ opacity: 1, y: 0 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-15%' }}
              transition={{ duration: 0.75, ease }}
              className={`grid gap-10 lg:grid-cols-2 lg:items-center ${index % 2 ? 'lg:[&>*:first-child]:order-2' : ''}`}
            >
              <div>
                <p className="mb-5 text-sm font-black" style={{ color: engine.accent }}>{engine.category}</p>
                <h3 className="text-4xl font-black leading-[0.96] tracking-tight md:text-6xl">{engine.name}</h3>
                <p className="mt-7 max-w-xl text-lg font-semibold leading-relaxed text-[#66666d]">{engine.summary}</p>
              </div>
              <LivingEngineVisual engine={engine} />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function OsSection() {
  return (
    <section className="bg-white px-5 py-24 text-[#15151a] md:px-8 lg:py-32">
      <div className="mx-auto max-w-7xl">
        <div className="mb-14 max-w-4xl">
          <Eyebrow>OS metier</Eyebrow>
          <h2 className="text-5xl font-black leading-[0.96] tracking-tight md:text-7xl">Pick a business. Not a stack.</h2>
        </div>
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {cimolaceOperatingSystems.map((os, index) => (
            <motion.article
              key={os.name}
              initial={{ opacity: 1, y: 0 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: index * 0.04, ease }}
              className="min-h-[360px] rounded-[2rem] bg-[#f5f5f7] p-7"
            >
              <div className="mb-16 flex h-14 w-14 items-center justify-center rounded-2xl text-white" style={{ backgroundColor: os.accent }}>
                <Wand2 className="h-6 w-6" />
              </div>
              <h3 className="text-3xl font-black tracking-tight">{os.name}</h3>
              <p className="mt-4 text-base font-semibold leading-relaxed text-[#66666d]">{os.promise}</p>
              <div className="mt-7 flex flex-wrap gap-2">
                {os.engines.map((engine) => (
                  <span key={engine} className="rounded-full bg-white px-3 py-1 text-xs font-black text-[#66666d]">
                    {engine}
                  </span>
                ))}
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}

function SchoolStorySection() {
  return (
    <section className="overflow-hidden bg-[#101014] px-5 py-24 text-white md:px-8 lg:py-32">
      <div className="mx-auto grid max-w-7xl gap-14 lg:grid-cols-[.9fr_1.1fr] lg:items-center">
        <div>
          <Eyebrow light>Premier blueprint</Eyebrow>
          <h2 className="text-5xl font-black leading-[0.96] tracking-tight md:text-7xl">
            ISNA / Prorascience montre la voie.
          </h2>
          <p className="mt-7 max-w-xl text-xl font-semibold leading-relaxed text-white/58">
            Le modele ecole devient une infrastructure reutilisable: live, SmartBoard, cours, replay, marketing, calendrier et branding tenant.
          </p>
          <Link to="/cimolace/contact" className="mt-10 inline-flex items-center gap-2 rounded-full bg-white px-7 py-3 text-sm font-black text-[#15151a]">
            Creer une ecole
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="rounded-[2.5rem] bg-[#f5f5f7] p-5 text-[#15151a] md:p-8">
          <DeviceScreen title="ISNA / Prorascience" subtitle="school tenant" accent="#1a4f8f" className="shadow-none">
            <div className="grid gap-3">
              {cimolaceSchoolProof.map((item) => (
                <div key={item} className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3">
                  <BadgeCheck className="h-5 w-5 text-[#2cc275]" />
                  <span className="text-sm font-black text-[#34343a]">{item}</span>
                </div>
              ))}
            </div>
          </DeviceScreen>
        </div>
      </div>
    </section>
  );
}

function ArchitectureSection() {
  return (
    <section className="bg-white px-5 py-24 text-[#15151a] md:px-8 lg:py-32">
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto mb-16 max-w-4xl text-center">
          <Eyebrow>Architecture</Eyebrow>
          <h2 className="text-5xl font-black leading-[0.96] tracking-tight md:text-7xl">
            Modern underneath. Simple on the surface.
          </h2>
        </div>
        <div className="grid gap-4 md:grid-cols-5">
          {cimolaceArchitectureBlocks.map((block, index) => (
            <motion.div
              key={block.label}
              initial={{ opacity: 1, y: 0 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.55, delay: index * 0.04, ease }}
              className="rounded-[1.7rem] bg-[#f5f5f7] p-6"
            >
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[#8b8b93]">{block.label}</p>
              <p className="mt-8 text-2xl font-black">{block.value}</p>
              <p className="mt-3 text-sm font-semibold leading-relaxed text-[#66666d]">{block.detail}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function BrandingSection() {
  return (
    <section className="bg-[#f5f5f7] px-5 py-24 text-[#15151a] md:px-8 lg:py-32">
      <div className="mx-auto grid max-w-7xl gap-14 lg:grid-cols-2 lg:items-center">
        <div>
          <Eyebrow>Branding</Eyebrow>
          <h2 className="text-5xl font-black leading-[0.96] tracking-tight md:text-7xl">
            Cimolace powers it. Your brand owns it.
          </h2>
          <p className="mt-7 max-w-xl text-xl font-semibold leading-relaxed text-[#66666d]">
            Chaque tenant peut porter son logo, son domaine, ses couleurs, ses pages et son experience client.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            ['Logo', Palette],
            ['Domaine', Building2],
            ['Roles', Brain],
            ['Securite', LockKeyhole],
          ].map(([label, Icon]) => (
            <div key={label} className="min-h-[220px] rounded-[2rem] bg-white p-6">
              <Icon className="mb-20 h-7 w-7 text-[#6d5dfc]" />
              <p className="text-2xl font-black">{label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="bg-[#101014] px-5 py-24 text-white md:px-8 lg:py-32">
      <div className="mx-auto max-w-5xl text-center">
        <p className="text-sm font-black text-[#8f7bff]">CIMOLACE</p>
        <h2 className="mt-5 text-5xl font-black leading-[0.96] tracking-tight md:text-7xl">
          Votre plateforme peut commencer par un seul tenant.
        </h2>
        <p className="mx-auto mt-7 max-w-2xl text-xl font-semibold leading-relaxed text-white/58">
          Lancez une ecole, un commerce, un studio ou une infrastructure sur mesure. Les moteurs sont deja la.
        </p>
        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link to="/cimolace/installer" className="inline-flex items-center gap-2 rounded-full bg-white px-7 py-3 text-sm font-black text-[#15151a]">
            Commencer
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link to="/cimolace/contact" className="inline-flex items-center gap-2 rounded-full px-7 py-3 text-sm font-black text-white/80">
            Demander une demo
          </Link>
        </div>
      </div>
    </section>
  );
}

export default function CimolaceLandingV2() {
  return (
    <main className="overflow-hidden bg-white">
      <HeroSection />
      <ControlPlaneScene />
      <HighlightsSection />
      <EngineChaptersSection />
      <OsSection />
      <SchoolStorySection />
      <BrandingSection />
      <ArchitectureSection />
      <FinalCta />
    </main>
  );
}
