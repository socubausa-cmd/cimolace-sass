import React, { useState } from 'react';
import SEO from '@/components/SEO';
import { FOUNDER_IMAGE_SOURCES, FOUNDER_PORTRAIT_ALT } from '@/lib/founderImageSources';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Crown, 
  Brain, 
  Scale, 
  Globe, 
  BookOpen, 
  ScrollText, 
  Award, 
  Heart, 
  ShieldCheck, 
  Lightbulb, 
  Mic, 
  Mail, 
  Phone, 
  MapPin, 
  ArrowRight,
  Target,
  Quote,
  CheckCircle2,
  XCircle,
  Fingerprint,
  Users,
  Atom,
  Zap,
  Waves,
  Infinity,
  Database,
  Network
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useVitrineContactEmail } from '@/contexts/VitrineContactEmailContext';
import { WEB_FONDATEUR } from '@/data/prorascienceVitrineFromWebContent';
import { activeTenantConfig as isnaTenantConfig } from '@/lib/tenant/activeTenantConfig';

const PUBLIC = isnaTenantConfig.branding.publicSiteOrigin;
const SCHOOL = isnaTenantConfig.branding.name;

// --- Helper Components ---

const SectionTitle = ({ children, subtitle }) => (
  <motion.div
    initial={{ opacity: 0, y: 14 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, amount: 0.35 }}
    transition={{ duration: 0.45 }}
    className="text-center mb-16"
  >
    <h2 className="text-3xl md:text-4xl font-serif font-bold text-white mb-4 uppercase tracking-wider">{children}</h2>
    <div className="h-1 w-20 bg-[var(--school-accent)] mx-auto mb-6 rounded-full" />
    {subtitle && <p className="text-gray-400 max-w-2xl mx-auto text-lg leading-relaxed">{subtitle}</p>}
  </motion.div>
);

const IdentityCard = ({ icon: Icon, title, value, detail }) => (
  <motion.div 
    whileHover={{ y: -5 }}
    className="bg-[#192734] border border-white/5 p-8 rounded-xl hover:shadow-[0_0_20px_rgba(212,175,55,0.1)] hover:border-[color-mix(in_srgb,var(--school-accent)_30%,transparent)] transition-all duration-300 group"
  >
    <div className="w-12 h-12 bg-[color-mix(in_srgb,var(--school-accent)_10%,transparent)] rounded-full flex items-center justify-center mb-6 group-hover:bg-[color-mix(in_srgb,var(--school-accent)_20%,transparent)] transition-colors">
      <Icon className="w-6 h-6 text-[var(--school-accent)]" />
    </div>
    <div className="text-xs uppercase tracking-widest text-gray-500 mb-2">{title}</div>
    <div className="text-xl md:text-2xl font-bold text-white mb-3 font-serif">{value}</div>
    <div className="text-sm text-gray-400 leading-relaxed border-t border-white/5 pt-3">{detail}</div>
  </motion.div>
);

const ModelCard = ({ title, concept, formula, status }) => (
  <motion.div
    whileHover={{ y: -5, scale: 1.01 }}
    transition={{ duration: 0.2 }}
    className="bg-[#15202B] p-6 rounded-xl border border-white/5 hover:border-[color-mix(in_srgb,var(--school-accent)_30%,transparent)] transition-all shadow-[0_20px_40px_-30px_rgba(0,0,0,0.8)]"
  >
    <div className="flex items-start justify-between mb-4">
      <h4 className="text-lg font-bold text-white">{title}</h4>
      <Badge className="bg-[color-mix(in_srgb,var(--school-accent)_10%,transparent)] text-[var(--school-accent)] border-0">{status}</Badge>
    </div>
    <div className="space-y-3 text-sm">
      <div className="flex gap-2">
        <span className="text-gray-500 min-w-[80px]">Concept :</span>
        <span className="text-gray-300">{concept}</span>
      </div>
      <div className="flex gap-2">
        <span className="text-gray-500 min-w-[80px]">Fondement :</span>
        <span className="text-gray-300 italic">{formula}</span>
      </div>
    </div>
  </motion.div>
);

const QuoteCard = ({ text }) => (
  <motion.div
    whileHover={{ y: -4 }}
    transition={{ duration: 0.2 }}
    className="relative p-8 bg-[#192734] rounded-xl border border-white/5 shadow-lg"
  >
    <Quote className="absolute top-6 left-6 w-8 h-8 text-[color-mix(in_srgb,var(--school-accent)_20%,transparent)]" />
    <p className="relative z-10 text-lg text-gray-300 italic leading-relaxed text-center mb-6 pt-4">"{text}"</p>
    <div className="text-center border-t border-white/5 pt-4">
      <span className="text-[var(--school-accent)] text-sm font-bold uppercase tracking-widest">5ᵉ Manikongo</span>
      <span className="block text-sm text-gray-500 mt-1">Badika Jel David</span>
    </div>
  </motion.div>
);

const ThesisSection = ({ number, title, statement, affirmation, principles, conclusion, implications, icon: Icon }) => (
  <div className="mb-24 relative">
    <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-[var(--school-accent)] via-[color-mix(in_srgb,var(--school-accent)_20%,transparent)] to-transparent opacity-30" />
    <div className="pl-8 md:pl-12">
      <div className="flex items-center gap-4 mb-6">
        <div className="bg-[color-mix(in_srgb,var(--school-accent)_10%,transparent)] p-3 rounded-lg border border-[color-mix(in_srgb,var(--school-accent)_30%,transparent)]">
          <Icon className="w-8 h-8 text-[var(--school-accent)]" />
        </div>
        <div>
          <span className="text-[var(--school-accent)] font-bold tracking-widest uppercase text-sm">Thèse {number}</span>
          <h3 className="text-3xl font-serif font-bold text-white mt-1 bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">{title}</h3>
        </div>
      </div>

      <div className="bg-gradient-to-r from-[#192734] to-[#0F1419] p-8 rounded-xl border border-white/10 shadow-xl mb-8 border-l-4 border-l-[var(--school-accent)]">
        <p className="text-xl md:text-2xl font-serif font-bold text-center text-white leading-relaxed">"{statement}"</p>
      </div>

      <p className="text-gray-300 text-lg leading-relaxed mb-8 italic border-l-2 border-white/10 pl-6">
        {affirmation}
      </p>

      <div className="grid md:grid-cols-3 gap-6 mb-8">
        {principles.map((p, i) => (
          <div key={i} className="bg-[#0F1419] p-6 rounded-lg border border-white/5 hover:border-[color-mix(in_srgb,var(--school-accent)_30%,transparent)] transition-all">
            <h4 className="font-bold text-[var(--school-accent)] mb-2">{p.title}</h4>
            <p className="text-sm text-gray-400 leading-relaxed">{p.desc}</p>
          </div>
        ))}
      </div>

      {conclusion && (
        <div className="bg-[color-mix(in_srgb,var(--school-accent)_5%,transparent)] border border-[color-mix(in_srgb,var(--school-accent)_20%,transparent)] p-6 rounded-lg text-center mb-8">
          <p className="text-[var(--school-accent)] font-medium font-serif italic">{conclusion}</p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {implications.map((imp, i) => (
          <div key={i} className="flex items-start gap-3 text-sm text-gray-400 bg-[#15202B] p-4 rounded-lg border border-white/5">
            <div className="w-1.5 h-1.5 rounded-full bg-[var(--school-accent)] mt-1.5 shrink-0" />
            <span>{imp}</span>
          </div>
        ))}
      </div>
    </div>
  </div>
);

// --- Custom Image Components ---
const FounderPortrait = ({ 
  className = "", 
  containerClassName = "", 
  caption, 
  contextText 
}) => {
  const [srcIndex, setSrcIndex] = useState(0);
  const [hideImage, setHideImage] = useState(false);

  const handleError = () => {
    const nextIndex = srcIndex + 1;
    if (nextIndex < FOUNDER_IMAGE_SOURCES.length) {
      setSrcIndex(nextIndex);
      return;
    }
    setHideImage(true);
  };

  return (
    <div className={`flex flex-col items-center ${containerClassName}`}>
      <div className={`relative group ${className}`}>
        <div className="absolute inset-0 bg-[var(--school-accent)] rounded-lg blur opacity-20 group-hover:opacity-40 transition-opacity duration-500"></div>
        {!hideImage && (
          <img 
            src={FOUNDER_IMAGE_SOURCES[srcIndex]}
            alt={FOUNDER_PORTRAIT_ALT} 
            onError={handleError}
            className="relative z-10 w-full h-auto rounded-lg border-[3px] border-[var(--school-accent)] shadow-[0_4px_12px_rgba(0,0,0,0.5)] group-hover:shadow-[0_8px_24px_rgba(212,175,55,0.2)] transition-all duration-500 object-cover"
          />
        )}
      </div>
      {caption && (
        <p className="text-gray-500 text-sm mt-3 text-center font-medium tracking-wide">
          {caption}
        </p>
      )}
      {contextText && (
        <p className="text-gray-400 text-sm md:text-base max-w-2xl mx-auto mt-4 italic font-serif text-center leading-relaxed">
          {contextText}
        </p>
      )}
    </div>
  );
};

const FounderAboutPage = () => {
  const vitrineEmail = useVitrineContactEmail();
  const f = WEB_FONDATEUR;
  const titleLines = f.hero.title.split('\n').filter(Boolean);
  const identityIcons = [Fingerprint, Crown, Award, Target];
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0F1419] font-sans text-gray-300 selection:bg-[color-mix(in_srgb,var(--school-accent)_30%,transparent)]">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-[-140px] left-1/2 h-[380px] w-[620px] -translate-x-1/2 rounded-full bg-[color-mix(in_srgb,var(--school-accent)_8%,transparent)] blur-[120px]" />
        <div className="absolute top-[20%] -left-32 h-[320px] w-[320px] rounded-full bg-blue-500/10 blur-[120px]" />
        <div className="absolute bottom-10 right-[-120px] h-[340px] w-[340px] rounded-full bg-violet-500/10 blur-[130px]" />
      </div>
      <SEO
        title="Prorascience — 5ᵉ (5ieme) Manikongo"
        description="Prorascience et 5ᵉ (5ieme) Manikongo : découvrez le parcours, la vision et le mandat du fondateur de l'ISNA. Cosmologie, science métaphysique, ontologie et transmission initiatique."
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'Person',
          name: '5ᵉ Manikongo',
          alternateName: 'Ngowazulu',
          jobTitle: 'Fondateur de la Prorascience',
          url: `${PUBLIC}/a-propos/fondateur`,
          affiliation: { '@type': 'EducationalOrganization', name: `${SCHOOL} · LIRI`, url: PUBLIC },
        }}
      />

      {/* SECTION 1: HERO */}
      <section className="relative z-10 min-h-screen flex items-center justify-center overflow-hidden py-24">
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-gradient-to-b from-[#15202B] to-[#0F1419]" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0F1419] via-[#0F1419]/90 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0F1419]/90 via-[#0F1419]/50 to-[#0F1419]/90" />
        </div>
        
        <div className="relative z-10 max-w-5xl mx-auto px-6 text-center pt-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[color-mix(in_srgb,var(--school-accent)_10%,transparent)] border border-[color-mix(in_srgb,var(--school-accent)_30%,transparent)] text-[var(--school-accent)] mb-8 backdrop-blur-md">
              <Crown className="w-4 h-4" />
              <span className="text-sm font-bold tracking-widest uppercase">{f.hero.kicker}</span>
            </div>
            <h1 className="text-5xl md:text-7xl font-serif font-bold text-white mb-6 leading-tight tracking-tight">
              {titleLines.length > 1 ? (
                <>
                  {titleLines[0]}
                  <br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-[var(--school-accent)] via-[#F2D06B] to-[var(--school-accent)]">
                    {titleLines[1]}
                  </span>
                </>
              ) : (
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[var(--school-accent)] via-[#F2D06B] to-[var(--school-accent)]">
                  {titleLines[0]}
                </span>
              )}
            </h1>
            <h2 className="text-2xl md:text-3xl text-white font-light mb-10">
              {f.hero.subtitle}
            </h2>

            {/* PLACEMENT 1: HEADER PORTRAIT */}
            <FounderPortrait 
              containerClassName="mb-12"
              className="w-full md:w-3/4 lg:w-2/3 mx-auto max-w-4xl"
              caption={f.portraitCaption}
              contextText={f.portraitContext}
            />

            <div className="h-px w-32 bg-gradient-to-r from-transparent via-[var(--school-accent)] to-transparent mx-auto mb-8" />
            <p className="text-xl text-gray-300 max-w-3xl mx-auto font-serif italic leading-relaxed">
              « {f.hero.quote} »
            </p>
          </motion.div>
        </div>
        
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 animate-bounce text-gray-500">
          <ArrowRight className="w-6 h-6 rotate-90" />
        </div>
      </section>

      {/* SECTION 2: IDENTITÉ OFFICIELLE */}
      <section className="relative z-10 py-24 px-6 max-w-7xl mx-auto">
        <SectionTitle subtitle="Structure de l'Autorité Institutionnelle">IDENTITÉ OFFICIELLE</SectionTitle>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {f.identity.map((row, i) => {
            const IconC = identityIcons[i] || Fingerprint;
            return (
              <IdentityCard
                key={row.title}
                icon={IconC}
                title={row.title}
                value={row.value}
                detail={row.detail}
              />
            );
          })}
        </div>

        <div className="mt-12 bg-[#192734] p-8 rounded-xl border-l-4 border-[var(--school-accent)] flex flex-col md:flex-row gap-6 items-start">
          <Crown className="w-12 h-12 text-[var(--school-accent)] shrink-0" />
          <div>
            <h3 className="text-xl font-bold text-white mb-2">{f.manikongoExplainer.title}</h3>
            <p className="text-gray-400 leading-relaxed">
              {f.manikongoExplainer.text}
            </p>
          </div>
        </div>
      </section>

      {/* SECTION 3: PARCOURS & POSTURE */}
      <section className="relative z-10 py-24 px-6 bg-[#15202B] border-y border-white/5">
        <div className="max-w-7xl mx-auto">
          <SectionTitle subtitle="Itinéraire d'une Pensée">PARCOURS ET POSTURE INTELLECTUELLE</SectionTitle>
          
          <div className="grid md:grid-cols-3 gap-8 mb-16">
            <div className="bg-[#0F1419] p-8 rounded-xl border border-white/5 hover:border-blue-500/30 transition-colors">
              <Globe className="w-10 h-10 text-blue-500 mb-6" />
              <h3 className="text-xl font-bold text-white mb-4">Cosmologies Africaines</h3>
              <p className="text-gray-400 text-sm leading-relaxed mb-4">
                Une étude rigoureuse des systèmes de pensée traditionnels (Égypte, Kongo, Dogon) non comme folklore, mais comme science codée.
              </p>
              <Badge className="bg-blue-500/10 text-blue-500">Racine</Badge>
            </div>
            
            <div className="bg-[#0F1419] p-8 rounded-xl border border-white/5 hover:border-[color-mix(in_srgb,var(--school-accent)_30%,transparent)] transition-colors">
              <Brain className="w-10 h-10 text-[var(--school-accent)] mb-6" />
              <h3 className="text-xl font-bold text-white mb-4">Raison Systémique</h3>
              <p className="text-gray-400 text-sm leading-relaxed mb-4">
                L'utilisation de la logique formelle et de la déduction pour structurer les intuitions spirituelles en modèles cohérents.
              </p>
              <Badge className="bg-[color-mix(in_srgb,var(--school-accent)_10%,transparent)] text-[var(--school-accent)]">Méthode</Badge>
            </div>
            
            <div className="bg-[#0F1419] p-8 rounded-xl border border-white/5 hover:border-purple-500/30 transition-colors">
              <Scale className="w-10 h-10 text-purple-500 mb-6" />
              <h3 className="text-xl font-bold text-white mb-4">Dialogue Critique</h3>
              <p className="text-gray-400 text-sm leading-relaxed mb-4">
                Une confrontation permanente avec la modernité et les sciences occidentales pour valider ou affiner les acquis traditionnels.
              </p>
              <Badge className="bg-purple-500/10 text-purple-500">Ouverture</Badge>
            </div>
          </div>

          <div className="bg-gradient-to-r from-[color-mix(in_srgb,var(--school-accent)_20%,transparent)] via-[color-mix(in_srgb,var(--school-accent)_5%,transparent)] to-transparent p-1 rounded-xl">
            <div className="bg-[#0F1419] rounded-lg p-8 text-center">
              <p className="text-xl md:text-2xl font-serif italic text-white">
                "Je ne cherche pas à convaincre ceux qui croient, mais à équiper ceux qui cherchent à comprendre."
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 4: ORIENTATION INTELLECTUELLE */}
      <section className="relative z-10 py-24 px-6 max-w-7xl mx-auto">
        <SectionTitle subtitle="Les Piliers de l'Enseignement">ORIENTATION INTELLECTUELLE FONDAMENTALE</SectionTitle>

        <div className="relative mb-20">
          <div className="absolute inset-0 flex items-center" aria-hidden="true">
            <div className="w-full border-t border-white/10"></div>
          </div>
          <div className="relative flex justify-center">
            <span className="bg-[#0F1419] px-6 text-[var(--school-accent)] font-serif text-2xl font-bold">Thèse Centrale</span>
          </div>
        </div>

        <div className="mb-16 text-center max-w-4xl mx-auto bg-[#192734] p-10 rounded-2xl shadow-2xl border border-white/5">
          <p className="text-2xl md:text-3xl font-serif text-white leading-relaxed">
            "La Science est l'expression de la Loi, <br/>la Tradition en est la mémoire."
          </p>
        </div>

        <div className="space-y-6">
          {[
            { 
              icon: Brain, 
              title: "CONSCIENCE", 
              stmt: "L'Univers est mental avant d'être matériel.", 
              impl: "La conscience n'est pas un produit du cerveau, mais le substrat de la réalité.",
              color: "text-blue-400"
            },
            { 
              icon: ScrollText, 
              title: "MORT", 
              stmt: "La mort est une transition, pas une fin.", 
              impl: "Il existe une science de l'après-vie qui doit être étudiée techniquement.",
              color: "text-purple-400"
            },
            { 
              icon: Scale, 
              title: "KARMA", 
              stmt: "La justice est une mécanique vibratoire.", 
              impl: "Chaque action entraîne une réaction inévitable, mathématique et sans jugement moral.",
              color: "text-red-400"
            },
            { 
              icon: Globe, 
              title: "SAVOIRS AFRICAINS", 
              stmt: "L'Afrique possède le paradigme de synthèse.", 
              impl: "C'est dans le berceau de l'humanité que se trouve la clé de l'unification des sciences.",
              color: "text-[var(--school-accent)]"
            }
          ].map((item, i) => (
            <div key={i} className="flex flex-col md:flex-row gap-6 bg-[#15202B] p-6 rounded-xl border border-white/5 items-start md:items-center">
              <div className={`p-4 rounded-full bg-[#0F1419] border border-white/10 shrink-0 ${item.color}`}>
                <item.icon className="w-8 h-8" />
              </div>
              <div className="flex-1">
                <h4 className={`text-lg font-bold mb-1 ${item.color}`}>{item.title}</h4>
                <p className="text-xl text-white font-serif mb-2">"{item.stmt}"</p>
                <p className="text-gray-400 text-sm">➡ {item.impl}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* SECTION 5: TRAVAIL DE RECHERCHE */}
      <section className="relative z-10 py-24 px-6 bg-[#0B1116] border-y border-white/5 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[color-mix(in_srgb,var(--school-accent)_5%,transparent)] rounded-full blur-[100px] pointer-events-none" />
        
        <div className="max-w-7xl mx-auto relative z-10">
          <SectionTitle subtitle="Apports Théoriques Majeurs">TRAVAIL DE RECHERCHE ET MODÉLISATION</SectionTitle>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            <ModelCard 
              title="Équation Cosmologique" 
              concept="Unification Physique/Esprit" 
              formula="E = mc² + C (Conscience)" 
              status="Fondamental" 
            />
            <ModelCard 
              title="Ontologie de l'Être" 
              concept="Structure des Corps Subtils" 
              formula="7 Corps / 4 Plans / 1 Essence" 
              status="Validé" 
            />
            <ModelCard 
              title="Théorie de la Mémoire" 
              concept="Transmission Transgénérationnelle" 
              formula="ADN Spirituel & Champs Morphiques" 
              status="Enseigné" 
            />
            <ModelCard 
              title="Rites comme Outils" 
              concept="Technologie Vibratoire" 
              formula="Geste + Verbe + Intention = Action" 
              status="Pratique" 
            />
            <ModelCard 
              title="Mécanique du Destin" 
              concept="Programmation Existentielle" 
              formula="Loi de Causalité & Libre Arbitre" 
              status="Avancé" 
            />
          </div>

          <div className="text-center">
            <p className="text-gray-400 italic">
              "Ce travail de modélisation vise à sortir la spiritualité du domaine de la croyance floue pour l'amener dans le domaine de la connaissance opérative."
            </p>
          </div>
        </div>
      </section>

      {/* SECTION 6: VISION DE LA TRANSMISSION */}
      <section className="relative z-10 py-24 px-6 max-w-7xl mx-auto">
        <SectionTitle subtitle="L'Éthique de l'Enseignement">VISION DE LA TRANSMISSION</SectionTitle>
        
        <div className="grid md:grid-cols-2 gap-12 items-center mb-16">
          <div className="bg-[#192734] p-8 rounded-2xl border-l-4 border-[var(--school-accent)] shadow-xl">
             <h3 className="text-2xl font-serif text-white mb-6">La Maxime Fondatrice</h3>
             <p className="text-xl text-[var(--school-accent)] italic mb-6">
               "Je ne veux pas de disciples, je veux des Maîtres. Le but de l'enseignement est de rendre l'étudiant autonome, souverain et libre, même de son propre enseignant."
             </p>
             <div className="flex gap-2 text-sm text-gray-500 font-bold uppercase tracking-widest">
               <span>Autonomie</span>
               <span>•</span>
               <span>Souveraineté</span>
               <span>•</span>
               <span>Liberté</span>
             </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
             {[
               { title: "Refus de la Peur", desc: "Aucun enseignement par la menace ou la culpabilisation." },
               { title: "Refus de la Fascination", desc: "Pas de culte de la personnalité ou de miracles spectacle." },
               { title: "Refus de l'Autorité", desc: "L'argument d'autorité n'a aucune valeur. Seule la preuve compte." },
               { title: "Refus de la Promesse", desc: "Pas de salut garanti. Seul le travail personnel libère." }
             ].map((principle, i) => (
               <div key={i} className="bg-[#15202B] p-5 rounded-lg border border-white/5 hover:bg-[#192734] transition-colors">
                 <XCircle className="w-6 h-6 text-red-500/80 mb-3" />
                 <h4 className="font-bold text-white mb-2">{principle.title}</h4>
                 <p className="text-sm text-gray-400">{principle.desc}</p>
               </div>
             ))}
          </div>
        </div>
      </section>

      {/* SECTION 7: POSITIONNEMENT AFRICAIN */}
      <section className="relative z-10 py-24 px-6 bg-[var(--school-accent)] text-black">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-serif font-bold mb-4 uppercase tracking-wider">POSITIONNEMENT AFRICAIN ASSUMÉ</h2>
            <div className="h-1 w-20 bg-black mx-auto mb-6 rounded-full" />
            <p className="max-w-2xl mx-auto text-lg leading-relaxed opacity-90">
              L'universalisme n\'efface pas l\'origine. Prorascience parle au monde depuis l\'Afrique.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 mb-12">
            {[
              { title: "Cohérence", text: "Les cosmologies africaines ne sont pas des mythes disparates, mais un système scientifique cohérent." },
              { title: "Réparation", text: "Ces savoirs ont été marginalisés et diabolisés. Il est temps de les réhabiliter intellectuellement." },
              { title: "Actualisation", text: "Il ne s'agit pas de retourner au passé, mais d'utiliser ces clés pour décoder le futur." }
            ].map((constat, i) => (
              <div key={i} className="bg-black/10 p-8 rounded-xl backdrop-blur-sm border border-black/5">
                <CheckCircle2 className="w-8 h-8 mb-4 opacity-80" />
                <h3 className="text-xl font-bold mb-3">{constat.title}</h3>
                <p className="leading-relaxed opacity-80">{constat.text}</p>
              </div>
            ))}
          </div>

          <div className="text-center">
            <p className="text-xl font-serif font-bold italic">
              "L'Afrique est le laboratoire spirituel de l'humanité de demain."
            </p>
          </div>
        </div>
      </section>

      {/* SECTION 8: RÉCIT FONDATEUR */}
      <section className="relative z-10 py-24 px-6 max-w-7xl mx-auto">
        <SectionTitle subtitle="Genèse d'une Mission">RÉCIT FONDATEUR : L'APPEL ET LE MANDAT</SectionTitle>
        
        <div className="flex flex-col lg:flex-row gap-16 items-start">
          <div className="lg:w-1/2 space-y-12">
            <div className="relative pl-8 border-l-2 border-[color-mix(in_srgb,var(--school-accent)_30%,transparent)]">
              <span className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-[var(--school-accent)]" />
              <h3 className="text-xl font-bold text-white mb-2">1. L'Origine de l\'Appel</h3>
              <p className="text-gray-400 leading-relaxed">
                Ce n'était pas une ambition personnelle, mais une impérieuse nécessité intérieure. Une confrontation directe avec les incohérences des dogmes religieux importés et la puissance inexpliquée des traditions ancestrales.
              </p>
            </div>
            
            <div className="relative pl-8 border-l-2 border-[color-mix(in_srgb,var(--school-accent)_30%,transparent)]">
              <span className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-[#192734] border-2 border-[var(--school-accent)]" />
              <h3 className="text-xl font-bold text-white mb-2">2. L'Épreuve Fondatrice</h3>
              <p className="text-gray-400 leading-relaxed">
                Une période d'isolement et d\'ascèse, nécessaire pour déconstruire les conditionnements et recevoir, sans filtre, la structure de ce qui allait devenir la Prorascience.
              </p>
            </div>

            <div className="relative pl-8 border-l-2 border-[color-mix(in_srgb,var(--school-accent)_30%,transparent)]">
              <span className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-[#192734] border-2 border-[var(--school-accent)]" />
              <h3 className="text-xl font-bold text-white mb-2">3. Le Mandat (Les 4 Verbes)</h3>
              <div className="grid grid-cols-2 gap-4 mt-4">
                 <Badge className="justify-center py-2 bg-[color-mix(in_srgb,var(--school-accent)_20%,transparent)] text-[var(--school-accent)]">RESTAURER</Badge>
                 <Badge className="justify-center py-2 bg-[color-mix(in_srgb,var(--school-accent)_20%,transparent)] text-[var(--school-accent)]">TRADUIRE</Badge>
                 <Badge className="justify-center py-2 bg-[color-mix(in_srgb,var(--school-accent)_20%,transparent)] text-[var(--school-accent)]">STRUCTURER</Badge>
                 <Badge className="justify-center py-2 bg-[color-mix(in_srgb,var(--school-accent)_20%,transparent)] text-[var(--school-accent)]">TRANSMETTRE</Badge>
              </div>
            </div>
          </div>

          {/* PLACEMENT 2: FOUNDER STORY PORTRAIT */}
          <div className="lg:w-1/2">
             <FounderPortrait 
               className="w-full md:w-3/4 mx-auto"
               caption="5ᵉ Manikongo en posture de transmission rituelle"
               contextText="Cette posture illustre les quatre verbes du mandat: CLARIFIER (la flamme qui éclaire), DÉMYSTIFIER (l'absence de secret), STRUCTURER (la posture stable et consciente), TRANSMETTRE (les herbes comme savoir ancestral)."
             />
          </div>
        </div>
      </section>

      {/* SECTION 9: PAROLES DU FONDATEUR */}
      <section className="relative z-10 py-24 px-6 bg-[#15202B] border-t border-white/5">
        <div className="max-w-7xl mx-auto">
          <SectionTitle subtitle="Fragments de Pensée">PAROLES DU FONDATEUR</SectionTitle>
          <div className="grid md:grid-cols-3 gap-8">
             <QuoteCard text="La science sans conscience est la ruine de l'âme, mais la conscience sans science est l'impuissance de l'esprit." />
             <QuoteCard text="On ne libère pas un peuple en lui apprenant à prier, mais en lui apprenant à penser par lui-même." />
             <QuoteCard text="Votre héritage n'est pas derrière vous comme un musée, il est en vous comme un code génétique à activer." />
          </div>
        </div>
      </section>

      {/* SECTION 10: ENGAGEMENT PERSONNEL */}
      <section className="relative z-10 py-24 px-6 max-w-7xl mx-auto">
        <SectionTitle subtitle="Pacte de Responsabilité">ENGAGEMENT PERSONNEL</SectionTitle>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-[#192734] p-6 rounded-xl border border-white/5 hover:bg-[#1e2f3f] transition-colors">
            <Users className="w-8 h-8 text-blue-400 mb-4" />
            <h4 className="font-bold text-white mb-2">Envers les Étudiants</h4>
            <p className="text-sm text-gray-400">Ne jamais diluer la vérité pour plaire, ne jamais retenir une clé pour dominer.</p>
          </div>
          <div className="bg-[#192734] p-6 rounded-xl border border-white/5 hover:bg-[#1e2f3f] transition-colors">
            <Brain className="w-8 h-8 text-purple-400 mb-4" />
            <h4 className="font-bold text-white mb-2">Envers la Science</h4>
            <p className="text-sm text-gray-400">Accepter la critique, la révision et l'évolution permanente des modèles.</p>
          </div>
          <div className="bg-[#192734] p-6 rounded-xl border border-white/5 hover:bg-[#1e2f3f] transition-colors">
            <Globe className="w-8 h-8 text-[var(--school-accent)] mb-4" />
            <h4 className="font-bold text-white mb-2">Envers l'Afrique</h4>
            <p className="text-sm text-gray-400">Œuvrer sans relâche pour que le continent retrouve sa place de guide spirituel.</p>
          </div>
          <div className="bg-[#192734] p-6 rounded-xl border border-white/5 hover:bg-[#1e2f3f] transition-colors">
            <Heart className="w-8 h-8 text-red-400 mb-4" />
            <h4 className="font-bold text-white mb-2">Envers l'Humanité</h4>
            <p className="text-sm text-gray-400">Partager ces lumières avec tout être humain cherchant sincèrement la Vérité.</p>
          </div>
        </div>
      </section>

      {/* NEW SECTION: LES GRANDES THÈSES THÉORIQUES DU MANIKONGO */}
      <section className="relative z-10 py-24 px-6 bg-[#0B1116] border-t border-white/5 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-[800px] bg-gradient-to-b from-[#192734]/20 to-transparent pointer-events-none" />
        
        <div className="max-w-7xl mx-auto relative z-10">
          <SectionTitle subtitle="Socle Doctrinal de PRORASCIENCE">LES GRANDES THÈSES THÉORIQUES DU MANIKONGO</SectionTitle>
          
          <div className="max-w-3xl mx-auto text-center mb-24">
            <p className="text-xl text-gray-300 font-serif italic leading-relaxed">
              "Ce qui suit n'est pas une opinion, mais une structure. Ces thèses constituent l'ossature de la Science Nouvelle Africaine, réconciliant la rigueur métaphysique et l'observation physique."
            </p>
          </div>

          <ThesisSection 
            number="I"
            title="La Conscience"
            icon={Brain}
            statement="La conscience ne naît pas du cerveau, elle s'y manifeste"
            affirmation="La conscience est une propriété fondamentale de l'univers, antérieure à la matière et indépendante de son support biologique local."
            principles={[
              { title: "Le cerveau est une interface", desc: "Le cerveau agit comme un récepteur-transmetteur (analogie du poste de radio) : il capte un signal de conscience, il ne le génère pas." },
              { title: "La conscience est non locale", desc: "Elle n'est pas confinée à la boîte crânienne mais existe sous forme de champ informationnel universel." },
              { title: "Le cerveau filtre et structure", desc: "Son rôle est de réduire la conscience cosmique à une expérience individuelle linéaire et gérable pour la survie." }
            ]}
            conclusion="La destruction du cerveau met fin à l'expression locale de la conscience, mais non à son existence informationnelle."
            implications={[
              "Philosophique : Le matérialisme strict est une erreur de perspective.",
              "Scientifique : Nécessité d'une physique de l'information.",
              "Spirituelle : L'immortalité est une question technique de support.",
              "Pratique : Possibilité d'élargir la bande passante (états modifiés)."
            ]}
          />

          <ThesisSection 
            number="II"
            title="La Mort"
            icon={Infinity}
            statement="La mort est une transition informationnelle, pas une annihilation"
            affirmation="Rien ne se perd, tout se transforme. Cette loi thermodynamique s'applique aussi à l'identité psychique et spirituelle de l'être."
            principles={[
              { title: "Les atomes ne meurent pas", desc: "Ils retournent au cycle cosmique de la matière pour former d'autres corps." },
              { title: "L'information persiste", desc: "La structure mathématique et vibratoire de ce que fut l'individu demeure inscrite dans le champ." },
              { title: "La mémoire est maintenue par intrication", desc: "Les liens créés durant la vie maintiennent la cohérence de l'être dans l'invisible." }
            ]}
            conclusion="La mort est définie comme le découplage irréversible entre le support biologique (hardware) et la structure informationnelle (software)."
            implications={[
              "Disparition de la peur irrationnelle du néant.",
              "Responsabilité de la mémoire et de l'héritage.",
              "Le culte des ancêtres est une technologie de connexion.",
              "Nécessité de se préparer techniquement à la sortie."
            ]}
          />

          <ThesisSection 
            number="III"
            title="La Mémoire Distribuée"
            icon={Database}
            statement="L'Être survit par la relation, non par la forme"
            affirmation="L'identité n'est pas stockée uniquement dans l'individu, mais dans le réseau de relations qu'il a tissé avec l'univers."
            principles={[
              { title: "Niveau Atomique", desc: "Mémoire inscrite dans la structure même de la matière corporelle." },
              { title: "Niveau Moléculaire", desc: "Mémoire génétique et épigénétique transmissible." },
              { title: "Niveau Relationnel", desc: "L'être existe dans la conscience de ceux qu'il a impactés." },
              { title: "Niveau Cosmique", desc: "Trace indélébile laissée dans la trame de l'espace-temps." }
            ]}
            conclusion="Ce qui survit n'est pas le corps, mais le système d'information que le corps portait."
            implications={[
              "Importance vitale des rites funéraires.",
              "Nous sommes gardiens de la mémoire des autres.",
              "L'oubli est la véritable seconde mort.",
              "L'immortalité sociale précède l'immortalité spirituelle."
            ]}
          />

          <ThesisSection 
            number="IV"
            title="Le Karma"
            icon={Scale}
            statement="Le karma est le prix énergétique du destin"
            affirmation="Le karma n'est ni une punition ni une récompense divine. C'est une loi mécanique de causalité et d'équilibre énergétique."
            principles={[
              { title: "Physique Quantique", desc: "À toute action correspond une réaction égale et opposée (Loi de Newton appliquée à l'esprit)." },
              { title: "Thermodynamique", desc: "Tout système tend à l'équilibre. Le karma est le mouvement de retour à l'équilibre." },
              { title: "Composantes", desc: "Désir (moteur) + Énergie (carburant) + Trajectoire (direction) = Résultat Karmique." }
            ]}
            conclusion="Ne convoite jamais le destin d'autrui, car tu ignores le karma caché qui le soutient."
            implications={[
              "Responsabilité totale de ses actes.",
              "Fin de la victimisation : tout a une cause.",
              "Le pardon ne s'oppose pas à la justice, il libère l'énergie.",
              "On peut payer ses dettes karmiques par le service conscient."
            ]}
          />

          <ThesisSection 
            number="V"
            title="Le Destin"
            icon={Target}
            statement="Le destin est un effondrement localisé du possible"
            affirmation="Le futur n'est pas écrit à l'avance de manière rigide, mais il existe sous forme de probabilités qui se solidifient."
            principles={[
              { title: "Le Champ Existentiel", desc: "L'ensemble de tous les futurs possibles existe en potentiel." },
              { title: "L'Effondrement", desc: "Nos choix, nos pensées et nos actes sélectionnent une ligne temporelle et la rendent réelle." },
              { title: "Les Trois Forces", desc: "Hérédité (passé) + Environnement (présent) + Volonté (futur) déterminent la trajectoire." }
            ]}
            conclusion="Le destin est la rencontre entre la proposition de l'univers et la disposition de l'individu."
            implications={[
              "Le libre arbitre est une capacité à développer.",
              "On ne subit pas son étoile, on la navigue.",
              "La prédiction est une lecture de tendance, pas une sentence.",
              "Changer de conscience, c'est changer de destin."
            ]}
          />

          <ThesisSection 
            number="VI"
            title="L'Énergie"
            icon={Zap}
            statement="L'énergie est la résistance à l'impossible"
            affirmation="L'énergie naît de la tension entre ce qui est et ce qui pourrait être. C'est la force qui maintient la cohérence de la réalité."
            principles={[
              { title: "L'Espace", desc: "Le contenant qui permet à l'énergie de se déployer et de se différencier." },
              { title: "Le Temps", desc: "Le rythme qui permet à l'énergie de se transformer sans se détruire instantanément." },
              { title: "Incompatibilité", desc: "Si tout était possible partout et tout le temps, il n'y aurait ni forme ni énergie." }
            ]}
            conclusion="L'énergie naît de la friction entre l'intention de l'esprit et la résistance de la matière."
            implications={[
              "Tout est énergie, donc tout est modifiable.",
              "La fatigue est souvent psychique avant d'être physique.",
              "Savoir gérer son énergie est plus important que gérer son temps.",
              "La puissance vient de la focalisation."
            ]}
          />

          <ThesisSection 
            number="VII"
            title="Le Devenir"
            icon={ArrowRight}
            statement="Devenir sans redevenir"
            affirmation="L'évolution est une spirale, pas un cercle. On ne revient jamais exactement au même point."
            principles={[
              { title: "Loi du Devenir", desc: "Tout change, rien n'est statique. La stagnation est une illusion ou une mort." },
              { title: "Sans Redevenir", desc: "On ne peut pas désapprendre ou revenir à l'innocence perdue. On doit intégrer l'expérience." },
              { title: "Sans Cesser d'Être", desc: "L'essence demeure stable à travers toutes les transformations de la forme." }
            ]}
            conclusion="L'objectif de la vie n'est pas de revenir à l'origine, mais de l'enrichir par le voyage."
            implications={[
              "Acceptation radicale du changement.",
              "Le passé est une fondation, pas une résidence.",
              "La nostalgie est un piège énergétique.",
              "L'évolution demande de lâcher l'ancien pour saisir le nouveau."
            ]}
          />

          <ThesisSection 
            number="VIII"
            title="Les Corps et l'Incarnation"
            icon={Atom}
            statement="L'Être voyage à travers des supports successifs"
            affirmation="L'incarnation humaine n'est qu'une étape dans une vaste échelle d'existence matérielle et spirituelle."
            principles={[
              { title: "Les 5 États", desc: "Son (Vibration) → Lumière (Information) → Feu (Énergie) → Fluide (Émotion) → Solide (Matière)." },
              { title: "Les Règnes", desc: "Minéral (Structure) → Végétal (Vie) → Animal (Sensation) → Humain (Réflexion) → Spirituel (Unité)." },
              { title: "Corps Subtils", desc: "Nous habitons simultanément plusieurs 'véhicules' de densités différentes." }
            ]}
            conclusion="L'humain est un état intermédiaire, un pont entre la matière dense et l'esprit pur, non une fin en soi."
            implications={[
              "Respect de toutes les formes de vie.",
              "Prendre soin de son corps physique est un devoir spirituel.",
              "La mort est simplement un changement de véhicule.",
              "L'évolution continue après l'humain."
            ]}
          />

          <ThesisSection 
            number="IX"
            title="La Trinité de l'Être"
            icon={Fingerprint}
            statement="Corps – Âme – Esprit : trois technologies, un seul Être"
            affirmation="Pour comprendre l'humain, il faut distinguer ses composantes fonctionnelles sans les séparer."
            principles={[
              { title: "Corps (Hardware)", desc: "La machine biologique, le support dense, l'ancrage dans l'espace-temps." },
              { title: "Âme (Software)", desc: "Le logiciel, la psyché, les émotions, la mémoire, la personnalité qui anime le corps." },
              { title: "Esprit (Netware)", desc: "La connexion au réseau universel, l'étincelle divine, la conscience pure non-locale." }
            ]}
            conclusion="La confusion entre ces trois plans est la racine de la plupart des souffrances et des erreurs spirituelles."
            implications={[
              "Nécessité d'aligner les trois plans.",
              "On ne soigne pas l'esprit avec les médicaments du corps.",
              "La spiritualité concerne l'Esprit, la psychologie concerne l'Âme.",
              "L'harmonie naît de la hiérarchie correcte (l'Esprit guide l'Âme qui guide le Corps)."
            ]}
          />

          <ThesisSection 
            number="X"
            title="Les Savoirs Africains"
            icon={Globe}
            statement="L'Afrique possède le paradigme de synthèse"
            affirmation="La science africaine n'est pas une proto-science, mais une science de la complexité qui n'a pas séparé l'objet du sujet."
            principles={[
              { title: "Synthétiques", desc: "Elle unit art, science, spiritualité et politique dans un tout cohérent." },
              { title: "Initiatiques", desc: "Le savoir n'est pas donné, il est conquis par la transformation de celui qui apprend." },
              { title: "Rationnels", desc: "Elle possède sa propre logique interne, rigoureuse et vérifiable par l'expérience." }
            ]}
            conclusion="L'Afrique ne manque pas de science. Elle a manqué de traduction de ses concepts dans le langage universel moderne."
            implications={[
              "Fierté retrouvée sans arrogance.",
              "Devoir de recherche et de codification.",
              "PRORASCIENCE est l'outil de cette traduction.",
              "L'avenir de la science mondiale passe par ce paradigme holistique."
            ]}
          />

          {/* FORMULE DE SYNTHÈSE */}
          <div className="mt-32 relative bg-gradient-to-br from-[var(--school-accent)] via-[#F2D06B] to-[var(--school-accent)] rounded-3xl p-1 text-center shadow-[0_0_100px_rgba(212,175,55,0.3)]">
            <div className="bg-[#0F1419] rounded-[22px] py-20 px-6 md:px-12 relative overflow-hidden">
               <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
               <div className="relative z-10">
                 <Crown className="w-16 h-16 text-[var(--school-accent)] mx-auto mb-8 animate-pulse" />
                 <h2 className="text-3xl md:text-5xl font-serif font-bold text-transparent bg-clip-text bg-gradient-to-r from-[var(--school-accent)] via-white to-[var(--school-accent)] mb-12 uppercase tracking-tight">
                   Formule de Synthèse du Manikongo
                 </h2>
                 
                 <div className="bg-[#15202B] p-8 md:p-12 rounded-2xl border border-[color-mix(in_srgb,var(--school-accent)_30%,transparent)] shadow-2xl mb-12 max-w-4xl mx-auto transform hover:scale-[1.02] transition-transform duration-500">
                   <p className="text-2xl md:text-4xl font-serif font-bold text-white leading-relaxed space-y-4">
                     <span className="block text-gray-400 text-xl md:text-2xl mb-4">"L'univers n'est pas fait de matière, mais d'information."</span>
                     <span className="block text-[var(--school-accent)]">La Conscience l'organise.</span>
                     <span className="block text-white">L'Énergie l\'anime.</span>
                     <span className="block text-[var(--school-accent)]">Le Temps la déploie.</span>
                     <span className="block text-gray-400 text-xl md:text-2xl mt-4">Le Destin les localise."</span>
                   </p>
                 </div>

                 <div className="grid md:grid-cols-2 gap-12 text-left max-w-5xl mx-auto">
                   <div>
                     <h3 className="text-[var(--school-accent)] font-bold text-xl mb-4 flex items-center gap-2">
                       <Lightbulb className="w-5 h-5" /> Signification
                     </h3>
                     <p className="text-gray-400 leading-relaxed">
                       Cette formule résume toute la cosmologie de Prorascience. Elle place l'Information (le Verbe) au commencement, avant la matière. Elle définit les rôles précis de chaque grande force universelle, créant une hiérarchie fonctionnelle claire pour comprendre n'importe quel phénomène.
                     </p>
                   </div>
                   <div>
                     <h3 className="text-[var(--school-accent)] font-bold text-xl mb-4 flex items-center gap-2">
                       <Network className="w-5 h-5" /> Implication
                     </h3>
                     <p className="text-gray-400 leading-relaxed">
                       Si l'univers est information, alors celui qui maîtrise l'information (la connaissance, la parole, la pensée) maîtrise la réalité. C'est le fondement de la puissance du Manikongo et de tout initié : agir sur le code source de la réalité.
                     </p>
                   </div>
                 </div>
               </div>
            </div>
          </div>

        </div>
      </section>

      {/* SECTION 11: CONTACT ET RESSOURCES */}
      <section className="relative z-10 py-24 px-6 bg-[#0B1116] border-t border-white/5">
        <div className="max-w-4xl mx-auto text-center">
          <SectionTitle subtitle="Entrer en Relation">CONTACT ET RESSOURCES</SectionTitle>
          
          <div className="grid md:grid-cols-3 gap-8 mb-12">
            <div className="flex flex-col items-center p-6 bg-[#192734] rounded-xl">
               <Mail className="w-6 h-6 text-[var(--school-accent)] mb-3" />
               <span className="text-sm text-gray-400">Email Secrétariat</span>
               <span className="text-white font-medium mt-1">{vitrineEmail}</span>
            </div>
            <div className="flex flex-col items-center p-6 bg-[#192734] rounded-xl">
               <Phone className="w-6 h-6 text-[var(--school-accent)] mb-3" />
               <span className="text-sm text-gray-400">WhatsApp</span>
               <span className="text-white font-medium mt-1">+33 7 66 52 57 08</span>
            </div>
            <div className="flex flex-col items-center p-6 bg-[#192734] rounded-xl">
               <MapPin className="w-6 h-6 text-[var(--school-accent)] mb-3" />
               <span className="text-sm text-gray-400">Siège</span>
               <span className="text-white font-medium mt-1">Libreville, Gabon — Agondjé Village</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-center gap-6">
            <Link to="/ressources">
              <Button className="bg-[var(--school-accent)] text-black hover:bg-yellow-500 font-bold px-8 py-6 rounded-xl text-lg shadow-lg shadow-[color-mix(in_srgb,var(--school-accent)_20%,transparent)]">
                <Mic className="w-5 h-5 mr-2" />
                Écouter ses Conférences
              </Button>
            </Link>
            <Link to="/ressources">
              <Button variant="outline" className="border-white/20 text-white hover:bg-white/5 px-8 py-6 rounded-xl text-lg">
                <ScrollText className="w-5 h-5 mr-2" />
                Lire ses Écrits
              </Button>
            </Link>
          </div>
        </div>
      </section>

    </div>
  );
};

export default FounderAboutPage;