import React, { useState } from 'react';
import SEO from '@/components/SEO';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, Target, Eye, Brain, History, GraduationCap, Layers, Quote, Award, Globe, Users, Star, ChevronDown, Shield, Zap, Heart, Lightbulb, Feather, Compass, Anchor, Scale, Flag, Columns, Swords, Microscope as Telescope, XCircle, CheckCircle, Database, Lock, Fingerprint } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

// New Components
import ProraScienceDefinitionBox from '@/components/about/ProraScienceDefinitionBox';
import PillarCard from '@/components/about/PillarCard';
import DomainCard from '@/components/about/DomainCard';
import ProraComparisonTable from '@/components/about/ProraComparisonTable';
import ProraScienceFAQ from '@/components/about/ProraScienceFAQ';
import ProrascienceOntologySection from '@/components/about/ProrascienceOntologySection';
import { WEB_ABOUT } from '@/data/prorascienceVitrineFromWebContent';
import { activeTenantConfig as isnaTenantConfig } from '@/lib/tenant/activeTenantConfig';

const PUBLIC = isnaTenantConfig.branding.publicSiteOrigin;
const SCHOOL = isnaTenantConfig.branding.name;

// --- INTERNAL HELPERS ---
const AccordionItem = ({ title, children, isOpen, onClick, icon: Icon }) => (
  <div className="mb-4 border border-white/10 rounded-xl bg-[#192734] overflow-hidden transition-all duration-300 hover:border-[color-mix(in_srgb,var(--school-accent)_30%,transparent)]">
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between p-6 text-left focus:outline-none bg-[#192734] hover:bg-white/5 transition-colors"
    >
      <div className="flex items-center gap-4">
        {Icon && <div className="p-2 bg-[color-mix(in_srgb,var(--school-accent)_10%,transparent)] rounded-lg"><Icon className="w-5 h-5 text-[var(--school-accent)]" /></div>}
        <span className="text-lg font-bold text-white">{title}</span>
      </div>
      <ChevronDown 
        className={`w-5 h-5 text-gray-400 transition-transform duration-300 ${isOpen ? 'rotate-180 text-[var(--school-accent)]' : ''}`} 
      />
    </button>
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className="px-6 pb-6 pt-0 text-gray-300 border-t border-white/5 bg-[#15202B]/50">
            <div className="pt-4">{children}</div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  </div>
);

const ValueCard = ({ icon: Icon, title, description }) => (
  <motion.div 
    whileHover={{ y: -5 }}
    className="bg-[#192734] p-6 rounded-xl border border-white/5 shadow-lg hover:shadow-[color-mix(in_srgb,var(--school-accent)_10%,transparent)] hover:border-[color-mix(in_srgb,var(--school-accent)_30%,transparent)] transition-all duration-300 h-full"
  >
    <div className="w-12 h-12 bg-gradient-to-br from-[var(--school-accent)] to-yellow-700 rounded-lg flex items-center justify-center mb-4 shadow-lg">
      <Icon className="w-6 h-6 text-white" />
    </div>
    <h3 className="text-xl font-bold text-white mb-3">{title}</h3>
    <p className="text-gray-400 text-sm leading-relaxed">{description}</p>
  </motion.div>
);

const AboutProrascience = () => {
  const [openHistorySection, setOpenHistorySection] = useState(0);
  const a = WEB_ABOUT;
  const statIconByIndex = [Users, Layers, GraduationCap, Globe, Star];
  const valueIcons = [Shield, Heart, Scale, Zap];
  const stats = a.stats.map((s, i) => ({
    label: s.label,
    value: s.value,
    icon: statIconByIndex[i] || Users,
  }));
  const revealUp = {
    initial: { opacity: 0, y: 16 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.2 },
    transition: { duration: 0.45, ease: 'easeOut' },
  };

  return (
    <div className="min-h-screen bg-[#0F1419] font-sans text-gray-300 selection:bg-[color-mix(in_srgb,var(--school-accent)_30%,transparent)] pt-20">
      <SEO
        title="À Propos de la Prorascience"
        description="Découvrez l'Initiation aux Sciences Nocturnes Africaines (ISNA), sa mission, ses piliers, son fondateur le 5ᵉ Manikongo et le système Prorascience."
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'AboutPage',
          name: `À propos — ${SCHOOL} · LIRI`,
          description: 'Mission, vision et fondements de la Prorascience.',
          url: `${PUBLIC}/a-propos`,
        }}
      />

      {/* Hero Section */}
      <section className="relative min-h-[70vh] flex items-center justify-center overflow-hidden py-20">
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=2072&auto=format&fit=crop')] bg-cover bg-center opacity-20" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#0F1419]/90 via-[#0F1419]/80 to-[#0F1419]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-[color-mix(in_srgb,var(--school-accent)_10%,transparent)] via-transparent to-transparent" />
        </div>
        
        <div className="relative z-10 max-w-5xl mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <Badge className="mb-6 bg-[color-mix(in_srgb,var(--school-accent)_10%,transparent)] text-[var(--school-accent)] border-[color-mix(in_srgb,var(--school-accent)_30%,transparent)] px-4 py-1.5 text-sm uppercase tracking-widest backdrop-blur-md">
              {a.hero.badge}
            </Badge>
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-serif font-bold text-white mb-8 leading-tight tracking-tight">
              {a.hero.titleLine1}{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[var(--school-accent)] to-yellow-200">
                {a.hero.titleGold}
              </span>
            </h1>
            <p className="text-xl md:text-2xl text-gray-200 font-light mb-4">
              {a.hero.subtitle}
            </p>
            <div className="h-1 w-24 bg-[var(--school-accent)] mx-auto my-8 rounded-full" />
            <p className="text-lg md:text-xl text-gray-400 max-w-3xl mx-auto italic">
              « {a.hero.quote} »
            </p>
          </motion.div>
        </div>
      </section>

      <section className="py-8 px-6 border-b border-white/5 bg-[#15202B]/30">
        <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-5 gap-4">
          {stats.map((s) => {
            const IconC = s.icon;
            return (
              <div key={s.label} className="text-center rounded-xl border border-white/5 bg-[#0F1419]/40 py-4">
                <IconC className="w-5 h-5 mx-auto text-[var(--school-accent)] mb-2" />
                <p className="text-xl md:text-2xl font-bold text-white tabular-nums">{s.value}</p>
                <p className="text-[10px] md:text-xs text-gray-500 font-semibold uppercase tracking-wide">{s.label}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Section 1: ISNA Presentation */}
      <section className="py-20 px-6 max-w-7xl mx-auto border-b border-white/5">
        <motion.div className="text-center mb-16" {...revealUp}>
          <Badge className="bg-[color-mix(in_srgb,var(--school-accent)_10%,transparent)] text-[var(--school-accent)] border-[color-mix(in_srgb,var(--school-accent)_30%,transparent)] px-4 py-1.5 text-xs uppercase tracking-widest mb-5 animate-pulse">
            {a.sectionComprendre.kicker}
          </Badge>
          <h2 className="text-3xl md:text-5xl font-serif font-bold text-white mb-4">{a.sectionComprendre.title}</h2>
          <p className="text-gray-400 max-w-3xl mx-auto">
            {a.sectionComprendre.lead}
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-6 mb-10">
          <motion.div className="premium-panel p-6" {...revealUp}>
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2"><Brain className="w-5 h-5 text-[var(--school-accent)]" /> Vous pratiquez... mais comprenez-vous vraiment ?</h3>
            <div className="space-y-2">
              {a.practiceItems.map((item, index) => (
                <motion.div
                  key={item}
                  className="flex items-center gap-2 text-sm text-gray-300"
                  initial={{ opacity: 0, x: -8 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, amount: 0.4 }}
                  transition={{ delay: index * 0.05, duration: 0.3 }}
                >
                  <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{item}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>
          <motion.div className="premium-panel p-6" {...revealUp}>
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2"><Target className="w-5 h-5 text-[var(--school-accent)]" /> Mais au fond...</h3>
            <div className="space-y-2">
              {a.rootQuestions.map((item, index) => (
                <motion.div
                  key={item}
                  className="flex items-center gap-2 text-sm text-gray-300"
                  initial={{ opacity: 0, x: 8 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, amount: 0.4 }}
                  transition={{ delay: index * 0.05, duration: 0.3 }}
                >
                  <Lightbulb className="w-4 h-4 text-amber-300 shrink-0" />
                  <span>{item}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6 mb-10">
          <motion.div className="premium-panel p-6" {...revealUp}>
            <h4 className="font-bold text-white mb-3">La realite</h4>
            <div className="space-y-2">
              {a.realityItems.map((item) => (
                <p key={item} className="text-sm text-gray-400">
                  - {item}
                </p>
              ))}
            </div>
          </motion.div>
          <motion.div className="premium-panel p-6" {...revealUp}>
            <h4 className="font-bold text-white mb-3">Consequence</h4>
            <p className="text-sm text-gray-400 mb-3">La pratique devient:</p>
            <div className="flex flex-wrap gap-2">
              {a.consequences.map((item) => (
                <Badge key={item} className="bg-red-500/15 text-red-200 border-red-500/30">{item}</Badge>
              ))}
            </div>
          </motion.div>
          <motion.div className="premium-panel p-6" {...revealUp}>
            <h4 className="font-bold text-white mb-3">{a.problem.title}</h4>
            <p className="text-sm text-gray-300">{a.problem.text}</p>
            <p className="text-sm text-[var(--school-accent)] mt-3">{a.problem.highlight}</p>
          </motion.div>
        </div>

        <motion.div className="premium-panel p-6 mb-8" {...revealUp}>
          <h3 className="text-xl font-bold text-white mb-4">Notre methode</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {a.methodPath.map((item, index) => (
              <motion.div
                key={item}
                className="rounded-lg border border-white/10 bg-[#0F1419]/60 p-3 text-center"
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.4 }}
                transition={{ delay: index * 0.06, duration: 0.35 }}
              >
                <p className="text-sm font-semibold text-white">{item}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>

        <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
          {a.methodColumns.map((col) => (
            <div key={col.title} className="premium-panel p-5">
              <h4 className="text-white font-semibold mb-2">{col.title}</h4>
              {col.items.map((item) => (
                <p key={item} className="text-xs text-gray-400">
                  - {item}
                </p>
              ))}
              <p className="text-xs text-[var(--school-accent)] mt-3">{col.foot}</p>
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <div className="premium-panel p-6">
            <h4 className="text-white font-semibold mb-3">Pour qui ?</h4>
            {a.targetAudience.map((item) => (
              <div key={item} className="flex items-center gap-2 text-sm text-gray-300 mb-2">
                <Compass className="w-4 h-4 text-[var(--school-accent)]" />
                <span>{item}</span>
              </div>
            ))}
          </div>
          <div className="premium-panel p-6">
            <h4 className="text-white font-semibold mb-3">Ce que vous gagnez</h4>
            {a.gains.map((item) => (
              <div key={item} className="flex items-center gap-2 text-sm text-gray-300 mb-2">
                <Award className="w-4 h-4 text-emerald-400" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>

        <motion.div className="mt-10 text-center" {...revealUp}>
          <p className="text-gray-300 italic max-w-3xl mx-auto">
            {a.closing.quote}
          </p>
          <h3 className="text-2xl md:text-3xl font-bold text-white mt-6">{a.closing.title}</h3>
          <div className="flex flex-col sm:flex-row justify-center gap-4 mt-8">
            <Link to="/formations/catalogue">
              <Button className="bg-[var(--school-accent)] text-black hover:bg-amber-500">Rejoindre Prorascence Academy</Button>
            </Link>
            <Link to="/appointment/request">
              <Button variant="outline" className="border-[color-mix(in_srgb,var(--school-accent)_40%,transparent)] text-[var(--school-accent)] hover:bg-[color-mix(in_srgb,var(--school-accent)_10%,transparent)]">Parler a un conseiller</Button>
            </Link>
          </div>
        </motion.div>
      </section>

      {/* Section 1: ISNA Presentation */}
      <section className="py-20 px-6 max-w-7xl mx-auto border-b border-white/5">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-serif font-bold text-white mb-6">{a.mission.title}</h2>
          <p className="text-gray-400 max-w-3xl mx-auto">
            {a.mission.lead}
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {a.mission.values.map((v, i) => (
            <ValueCard
              key={v.title}
              icon={valueIcons[i] || Shield}
              title={v.title}
              description={v.desc}
            />
          ))}
        </div>
      </section>

      {/* SECTION 4: QU'EST-CE QUE LA PRORASCIENCE? */}
      <section className="py-24 px-6 relative bg-[#0F1419] overflow-hidden" id="what-is">
        {/* Decorative elements */}
        <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-[color-mix(in_srgb,var(--school-accent)_50%,transparent)] to-transparent" />
        <div className="absolute top-0 left-1/2 w-[800px] h-[800px] bg-[color-mix(in_srgb,var(--school-accent)_5%,transparent)] rounded-full blur-[100px] -translate-x-1/2 pointer-events-none" />

        <div className="max-w-7xl mx-auto relative z-10">
          {/* Main Title */}
          <div className="text-center mb-20">
            <Badge className="bg-[var(--school-accent)] text-black hover:bg-[#b5952f] mb-4">{a.whatIs.kicker}</Badge>
            <h2 className="text-4xl md:text-5xl font-serif font-bold text-white mb-6">
              {a.whatIs.title.includes('PRORASCIENCE') ? (
                <>
                  {a.whatIs.title.split('PRORASCIENCE')[0]}
                  <span className="text-[var(--school-accent)]">PRORASCIENCE</span>
                  {a.whatIs.title.split('PRORASCIENCE')[1]}
                </>
              ) : (
                a.whatIs.title
              )}
            </h2>
            <p className="text-xl text-gray-400 max-w-3xl mx-auto leading-relaxed">
              {a.whatIs.lead}
            </p>
          </div>

          {/* Subsection 1: Short Definition */}
          <ProraScienceDefinitionBox icon={Lightbulb} title="Définition Synthétique">
            La <strong className="text-white">PRORASCIENCE</strong>
            {a.definitionSynthese.replace(/^La PRORASCIENCE/, '')}
          </ProraScienceDefinitionBox>

          {/* Subsection 2: Developed Definition (3 Pillars) */}
          <div className="mb-24">
            <h3 className="text-2xl font-bold text-white mb-10 text-center flex items-center justify-center gap-3">
              <Columns className="w-6 h-6 text-[var(--school-accent)]" /> Les 3 Piliers Fondateurs
            </h3>
            <div className="grid md:grid-cols-3 gap-8">
              {[Brain, Database, History].map((IconP, i) => (
                <PillarCard
                  key={a.pillars[i].title}
                  index={i}
                  icon={IconP}
                  title={a.pillars[i].title}
                  points={a.pillars[i].points}
                />
              ))}
            </div>
          </div>

          {/* Subsection 3: What PRORASCIENCE is NOT */}
          <div className="mb-24 bg-[#192734] rounded-2xl p-8 md:p-12 border border-red-900/30 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-red-500/5 rounded-full blur-3xl" />
            <h3 className="text-2xl font-bold text-white mb-8 flex items-center gap-3">
              <XCircle className="w-6 h-6 text-red-500" /> Ce que la PRORASCIENCE n'est PAS
            </h3>
            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-6 mb-8">
              {a.notProrascience.map((item, i) => (
                <div key={item} className="flex items-center gap-3 bg-black/20 p-4 rounded-lg border border-red-500/10">
                  <div className="w-6 h-6 rounded-full bg-red-500/20 flex items-center justify-center shrink-0">
                    <XCircle className="w-4 h-4 text-red-500" />
                  </div>
                  <span className="text-gray-300 font-medium">{item}</span>
                </div>
              ))}
            </div>
            <div className="bg-gradient-to-r from-red-900/20 to-transparent p-4 rounded-l border-l-4 border-red-500">
              <p className="text-gray-300 italic">
                {a.notProrascienceKey}
              </p>
            </div>
          </div>

          {/* Subsection 4: What PRORASCIENCE studies (8 Domains) */}
          <div className="mb-24">
             <h3 className="text-2xl font-bold text-white mb-10 text-center flex items-center justify-center gap-3">
              <Target className="w-6 h-6 text-[var(--school-accent)]" /> Domaines d'Étude Concrets
            </h3>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {a.studyDomains.map((d, index) => (
                <DomainCard
                  key={d.title}
                  title={d.title}
                  definition={d.definition}
                  study={d.study}
                  application={d.application}
                  index={index}
                />
              ))}
            </div>
          </div>

          {/* Subsection 5: Etymology & Motto */}
          <div className="mb-24 text-center">
            <div className="inline-block p-1 rounded-full border border-[color-mix(in_srgb,var(--school-accent)_30%,transparent)] mb-8">
              <div className="bg-[#192734] px-8 py-3 rounded-full">
                <span className="font-serif text-[var(--school-accent)] text-xl italic">« {a.motto} »</span>
              </div>
            </div>
            <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
              {a.mottoSteps.map((st, i) => (
                <div key={st.title} className="text-center">
                  <div
                    className={`text-4xl font-bold mb-2 ${i === 2 ? 'text-[var(--school-accent)]' : i === 0 ? 'text-gray-700' : 'text-gray-500'}`}
                  >
                    {st.n}
                  </div>
                  <h4
                    className={`font-bold mb-2 ${i === 2 ? 'text-[var(--school-accent)]' : 'text-white'}`}
                  >
                    {st.title}
                  </h4>
                  <p className="text-sm text-gray-400">{st.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Subsection 6: Fundamental Principle & Comparison */}
          <div className="mb-24">
             <h3 className="text-2xl font-bold text-white mb-10 text-center">Positionnement Unique</h3>
             <ProraComparisonTable />
          </div>

          {/* Subsection 7: Method (4 Steps) */}
          <div className="mb-24 max-w-5xl mx-auto">
             <h3 className="text-2xl font-bold text-white mb-10 text-center flex items-center justify-center gap-3">
              <Swords className="w-6 h-6 text-[var(--school-accent)]" /> La Méthode Prorascientifique
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {a.methodPro.map((item, i) => (
                <div key={item.title} className="bg-[#192734] p-6 rounded-xl border border-white/5 relative group hover:bg-[#15202B] transition-colors">
                  <div className="text-5xl font-bold text-white/5 absolute top-4 right-4 group-hover:text-[color-mix(in_srgb,var(--school-accent)_10%,transparent)] transition-colors">
                    {String(i + 1).padStart(2, '0')}
                  </div>
                  <h4 className="text-lg font-bold text-white mb-2 relative z-10">{item.title}</h4>
                  <p className="text-sm text-gray-400 relative z-10">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Subsection 8: Why a Science? */}
          <div className="mb-24 grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h3 className="text-2xl font-bold text-white mb-6">{a.whyScience.title}</h3>
              <p className="text-gray-300 mb-6 leading-relaxed">
                {a.whyScience.lead}
              </p>
              <ul className="space-y-4">
                {a.whyScience.bullets.map((crit) => (
                  <li key={crit} className="flex items-center gap-3 bg-[#192734] p-3 rounded-lg border border-white/5">
                    <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
                    <span className="text-sm text-gray-300">{crit}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-[#192734] p-8 rounded-2xl border border-white/10">
              <ProraScienceFAQ />
            </div>
          </div>

          {/* Subsection 9: Africa's Place */}
          <div className="mb-24 text-center max-w-3xl mx-auto">
            <Globe className="w-12 h-12 text-[var(--school-accent)] mx-auto mb-6" />
            <h3 className="text-2xl font-bold text-white mb-6">{a.africa.title}</h3>
            <p className="text-gray-300 mb-8">
              {a.africa.lead.includes('Berceau') ? (
                <>
                  {a.africa.lead.split('Berceau')[0]}
                  <strong>Berceau</strong>
                  {a.africa.lead.split('Berceau')[1]}
                </>
              ) : (
                a.africa.lead
              )}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {a.africa.blocks.map((b) => (
                <div key={b.label} className="p-4 rounded-lg bg-[#192734] border border-[color-mix(in_srgb,var(--school-accent)_20%,transparent)]">
                  <span className="block text-[var(--school-accent)] font-bold mb-1">{b.label}</span>
                  <span className="text-sm text-gray-400">{b.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* --- NEW SECTION: PRORASCIENCE ONTOLOGICAL MODEL --- */}
      <ProrascienceOntologySection />

      {/* Section 2: Founder (Kept brief as focus was on the new section, but included for completeness) */}
      <section className="py-20 bg-[#15202B] border-y border-white/5">
        <div className="max-w-7xl mx-auto px-6">
           <div className="text-center mb-12">
            <h2 className="text-3xl font-serif font-bold text-white mb-4">Le Fondateur</h2>
            <p className="text-gray-400 max-w-2xl mx-auto">Le Professeur Kimbembe, initiateur de cette vision.</p>
           </div>
           {/* Brief founder summary to maintain page flow without duplicating too much if user scrolls fast */}
           <div className="bg-[#192734] rounded-xl p-8 border border-white/5 flex flex-col md:flex-row gap-8 items-center">
             <div className="w-32 h-32 bg-gray-700 rounded-full shrink-0 flex items-center justify-center text-3xl font-serif text-gray-500">PK</div>
             <div>
               <h3 className="text-xl font-bold text-white mb-2">Prof. Kimbembe</h3>
               <p className="text-gray-300 italic mb-4">"La science sans conscience est la ruine de l'âme, mais la conscience sans science est l'impuissance de l'esprit."</p>
               <Link to="/equipe">
                 <Button variant="outline" className="text-[var(--school-accent)] border-[var(--school-accent)] hover:bg-[var(--school-accent)] hover:text-black">
                   Découvrir son parcours complet
                 </Button>
               </Link>
             </div>
           </div>
        </div>
      </section>

      {/* Section 3: History & Mandate Accordion */}
      <section className="py-20 px-6 max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-serif font-bold text-white mb-4">Histoire & Mandat</h2>
          <p className="text-gray-400">Les étapes clés de notre institution.</p>
        </div>
        
        <div className="space-y-4">
          <AccordionItem 
            title="I. Les Origines (1968-2000)" 
            icon={Anchor}
            isOpen={openHistorySection === 0} 
            onClick={() => setOpenHistorySection(openHistorySection === 0 ? null : 0)}
          >
            <p>Racines dans la résurgence des mouvements spirituels africains et la quête d'une science endogène.</p>
          </AccordionItem>
          {/* Other accordion items would go here, simplified for this update focus */}
           <AccordionItem 
            title="II. Le Lancement & L'Expansion" 
            icon={Flag}
            isOpen={openHistorySection === 1} 
            onClick={() => setOpenHistorySection(openHistorySection === 1 ? null : 1)}
          >
            <p>Ouverture en 2015, structuration des cursus et développement international.</p>
          </AccordionItem>
        </div>
      </section>

      {/* Section 6: Future Commitments */}
      <section className="py-20 bg-[var(--school-accent)] text-black text-center">
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="text-3xl md:text-4xl font-serif font-bold mb-8">Rejoignez l'Avant-Garde</h2>
          <p className="text-xl opacity-90 mb-10 max-w-2xl mx-auto">
            La Prorascience n'est pas une théorie, c\'est une expérience. Commencez votre transformation aujourd\'hui.
          </p>
          
          <div className="flex flex-col sm:flex-row justify-center gap-6">
            <Link to="/formations/catalogue">
              <Button className="bg-black text-white hover:bg-gray-800 text-lg px-8 py-6 rounded-xl shadow-xl w-full sm:w-auto">
                Consulter le Catalogue
              </Button>
            </Link>
            <a href="/appointment/request">
               <Button variant="outline" className="bg-transparent border-black text-black hover:bg-black/10 text-lg px-8 py-6 rounded-xl w-full sm:w-auto">
                Contacter un conseiller
              </Button>
            </a>
          </div>
        </div>
      </section>
    </div>
  );
};

export default AboutProrascience;