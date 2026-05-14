import React, { useMemo } from 'react';
import SEO from '@/components/SEO';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  BrainCircuit, FileText, Flame, Eye, Swords, Heart,
  Lock, Activity, AlertTriangle, ArrowRight, MessageCircle,
  CheckCircle2, Shield
} from 'lucide-react';
import { WEB_COACHING } from '@/data/prorascienceVitrineFromWebContent';
import { isnaTenantConfig } from '@/tenants/isna/tenant.config';

const PUBLIC = isnaTenantConfig.branding.publicSiteOrigin;
const SCHOOL = isnaTenantConfig.branding.name;

const SubSection = ({ letter, title, children }) => (
  <div className="mb-10">
    <h4 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
      <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-[#D4AF37]/10 text-[#D4AF37] text-sm font-bold border border-[#D4AF37]/20">
        {letter}
      </span>
      {title}
    </h4>
    {children}
  </div>
);

const BulletItem = ({ children }) => (
  <li className="flex items-start gap-2.5 text-base text-gray-300 leading-relaxed">
    <span className="text-[#D4AF37] mt-0.5 shrink-0">▸</span>
    <span>{children}</span>
  </li>
);

const NumberedStep = ({ number, title, description }) => (
  <div className="flex gap-4 items-start">
    <div className="w-8 h-8 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/20 flex items-center justify-center shrink-0 mt-0.5">
      <span className="text-sm font-bold text-[#D4AF37]">{number}</span>
    </div>
    <div>
      <p className="text-base font-semibold text-white">{title}</p>
      {description && <p className="text-sm text-gray-400 mt-0.5 leading-relaxed">{description}</p>}
    </div>
  </div>
);

const ExorcismPhase = ({ number, title, description }) => (
  <div className="flex gap-4 items-start bg-red-500/[0.03] border border-red-500/10 rounded-xl p-4">
    <div className="w-8 h-8 rounded-full bg-red-500/15 border border-red-500/20 flex items-center justify-center shrink-0">
      <span className="text-sm font-bold text-red-400">{number}</span>
    </div>
    <div>
      <p className="text-base font-bold text-red-300 uppercase tracking-wider">{title}</p>
      <p className="text-sm text-gray-400 mt-1 leading-relaxed">{description}</p>
    </div>
  </div>
);

const CoachingPage = () => {
  const c = WEB_COACHING;
  const titleHero = useMemo(() => {
    const m = c.title.match(/^(Le Coaching)\s+(.+)$/i);
    if (!m) return c.title;
    return (
      <>
        {m[1]}
        <br />
        <span className="text-[#D4AF37]">{m[2]}</span>
      </>
    );
  }, [c.title]);
  return (
    <div className="min-h-screen bg-[#0F1419] text-white pt-20 pb-20">
      <SEO
        title="Coaching Thérapeute"
        description={`Formation complète pour pratiquer l'art de l'intervention spirituelle. Devenez thérapeute spirituel certifié ${SCHOOL} · LIRI par le 5ᵉ Manikongo.`}
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'Course',
          name: `Coaching thérapeute — ${SCHOOL}`,
          provider: { '@type': 'EducationalOrganization', name: `${SCHOOL} · LIRI`, url: PUBLIC },
          description: 'Formation complète pour devenir thérapeute spirituel certifié.',
          url: `${PUBLIC}/accompagnement/coaching`,
          inLanguage: 'fr',
        }}
      />

      {/* ═══════════ HERO ═══════════ */}
      <section className="relative py-24 px-6 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#0F1419] via-[#192734]/50 to-[#0F1419]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-yellow-500/5 rounded-full blur-[150px]" />

        <div className="relative max-w-4xl mx-auto text-center space-y-6">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-yellow-500/10 text-yellow-400 text-xs font-bold uppercase tracking-widest border border-yellow-500/20">
            <BrainCircuit className="w-4 h-4" /> {c.kicker}
          </span>
          <h1 className="text-4xl md:text-6xl font-serif font-bold text-white leading-tight">
            {titleHero}
          </h1>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            {c.lead}
          </p>
          <div className="w-24 h-0.5 bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent mx-auto" />
          <p className="text-sm text-gray-600 uppercase tracking-widest">{c.line}</p>
        </div>
      </section>

      {/* ═══════════ CONTENT ═══════════ */}
      <div className="max-w-5xl mx-auto px-4 md:px-6 space-y-16">

        <div className="space-y-12 bg-[#141c27] rounded-3xl border border-yellow-500/10 p-6 md:p-10">

          {/* A. LE METIER */}
          <SubSection letter="A" title="Le metier de therapeute spirituel">
            <p className="text-sm text-gray-400 mb-4">Le therapeute spirituel est un praticien forme a :</p>
            <ul className="space-y-2.5">
              <BulletItem>Recevoir des patients en consultation</BulletItem>
              <BulletItem>Poser un diagnostic spirituel precis</BulletItem>
              <BulletItem>Identifier les types de blocages et leurs origines</BulletItem>
              <BulletItem>Appliquer les protocoles d'intervention adaptes</BulletItem>
              <BulletItem>Dresser un cahier de charge complet du patient</BulletItem>
              <BulletItem>Conduire des seances de liberation, d'exorcisme et de purification</BulletItem>
              <BulletItem>Utiliser les outils sacres : recipients, reliques, autels</BulletItem>
            </ul>
          </SubSection>

          {/* B. PROTOCOLE */}
          <SubSection letter="B" title="Protocole de reception du patient">
            <p className="text-sm text-gray-400 mb-5">Etapes structurees de la premiere consultation :</p>
            <div className="space-y-4 bg-white/[0.02] rounded-xl border border-white/5 p-5">
              <NumberedStep number="1" title="Accueil & mise en condition" description="Purification de l'espace, invocation de protection" />
              <NumberedStep number="2" title="Anamnese spirituelle" description="Ecoute du recit de vie, identification des declencheurs" />
              <NumberedStep number="3" title="Lecture de l'aura" description="Etat energetique general du patient" />
              <NumberedStep number="4" title="Diagnostic des corps subtils" description="Physique, emotionnel, mental, causal" />
              <NumberedStep number="5" title="Prise de la temperature atmospherique" description="Etat vibratoire de l'environnement du patient" />
              <NumberedStep number="6" title="Calcul du terme astral" description="Position du patient dans son cycle cosmique" />
              <NumberedStep number="7" title="Evaluation du poids karmique" description="Charge heritee, dette actuelle, liberation disponible" />
              <NumberedStep number="8" title="Cartographie du nuage de probabilite" description="Champ des possibles autour du patient" />
              <NumberedStep number="9" title="Projection de trajectoire" description="Lecture hypothetique du destin selon l'etat actuel" />
              <NumberedStep number="10" title="Redaction du cahier de charge" description="Document de suivi personnalise" />
            </div>
          </SubSection>

          {/* C. CAHIER DE CHARGE */}
          <SubSection letter="C" title="Le cahier de charge du patient">
            <p className="text-sm text-gray-400 mb-4">Document fondamental redige lors de chaque consultation. Il contient :</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                'Identite vibratoire du patient',
                'Historique des symptomes spirituels',
                'Carte des corps subtils',
                'Liste des blocages identifies',
                'Protocole d\'intervention recommande',
                'Planning des seances prevues',
                'Suivi de progression',
                'Notes et observations du therapeute',
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-gray-300 bg-white/[0.02] border border-white/5 rounded-lg p-3">
                  <FileText className="w-4 h-4 text-[#D4AF37] shrink-0" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </SubSection>

          {/* D. TYPES DE BLOCAGES */}
          <SubSection letter="D" title="Types de blocages identifies">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {[
                { icon: Lock, label: 'Blocage karmique', desc: 'Dette heritee des vies anterieures' },
                { icon: Swords, label: 'Attaque mystique', desc: 'Agression spirituelle exterieure' },
                { icon: Eye, label: 'Envoutement', desc: 'Sort ou malediction active' },
                { icon: AlertTriangle, label: 'Possession', desc: 'Entite installee dans le corps subtil' },
                { icon: Heart, label: 'Blessure animique', desc: 'Traumatisme de l\'ame profond' },
                { icon: Activity, label: 'Desequilibre energetique', desc: 'Chakras ou meridiens perturbes' },
              ].map((item, i) => (
                <div key={i} className="bg-amber-500/[0.03] border border-amber-500/10 rounded-xl p-4">
                  <item.icon className="w-5 h-5 text-amber-400 mb-2" />
                  <p className="text-base font-bold text-amber-300">{item.label}</p>
                  <p className="text-sm text-gray-500 mt-1">{item.desc}</p>
                </div>
              ))}
            </div>
          </SubSection>

          {/* E. METHODES D'INTERVENTION */}
          <SubSection letter="E" title="Methodes d'intervention">
            <p className="text-base text-gray-400 mb-4">Selon le type de blocage diagnostique, le therapeute choisit parmi :</p>
            <ul className="space-y-2.5">
              <BulletItem>Purification par fumigation (plantes, encens sacres)</BulletItem>
              <BulletItem>Liberation sonore (bols tibetains, clochettes, voix)</BulletItem>
              <BulletItem>Travail sur les recipients sacres — contenant energetique du patient</BulletItem>
              <BulletItem>Utilisation des reliques — objets de puissance pour ancrer l'intention</BulletItem>
              <BulletItem>Preparation et activation de l'autel du patient</BulletItem>
              <BulletItem>Seance d'exorcisme structure — selon protocole en 7 phases</BulletItem>
              <BulletItem>Bain rituel de desenvoutement — preparation des eaux et plantes</BulletItem>
              <BulletItem>Coupe des liens — rituels de separation et de liberation de liens nocifs</BulletItem>
              <BulletItem>Scellage & protection — pose d'une protection vibratoire durable</BulletItem>
              <BulletItem>Reeducation vibratoire — exercices quotidiens prescrits au patient</BulletItem>
            </ul>
          </SubSection>

          {/* F. PROTOCOLE D'EXORCISME */}
          <SubSection letter="F" title="Protocole de seance d'exorcisme">
            <p className="text-sm text-gray-400 mb-5">Procedure en 7 phases — a maitriser par tout therapeute certifie :</p>
            <div className="space-y-3">
              <ExorcismPhase number="1" title="Invocation" description="Appel des forces protectrices et des guides du therapeute" />
              <ExorcismPhase number="2" title="Scellage de l'espace" description="Protection du lieu de travail contre toute intrusion" />
              <ExorcismPhase number="3" title="Identification" description="Confrontation et identification de l'entite ou du blocage" />
              <ExorcismPhase number="4" title="Dialogue spirituel" description="Phase d'echange, de comprehension et de negociation" />
              <ExorcismPhase number="5" title="Extraction" description="Techniques de retrait et de delogement de l'entite" />
              <ExorcismPhase number="6" title="Purification" description="Nettoyage vibratoire complet du patient et de l'espace" />
              <ExorcismPhase number="7" title="Scellage & cloture" description="Fermeture des portes ouvertes, protection finale" />
            </div>
          </SubSection>
        </div>

        {/* ═══════════ CTA ═══════════ */}
        <section className="bg-gradient-to-br from-[#192734] to-[#0f1216] rounded-3xl p-10 md:p-16 text-center border border-white/10 relative overflow-hidden shadow-2xl">
          <div className="absolute top-0 right-0 w-96 h-96 bg-[#D4AF37]/5 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2" />
          <div className="relative z-10 max-w-2xl mx-auto space-y-8">
            <h2 className="text-3xl font-bold font-serif text-white">Devenir therapeute spirituel ?</h2>
            <p className="text-gray-300 text-lg">
              Le Coaching Therapeute est inclus dans le <span className="text-yellow-400 font-semibold">Cycle Prive (Academie Pro)</span>. 
              Un formateur vous accompagne individuellement tout au long de votre parcours.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a href="/appointment/request">
                <Button className="bg-[#D4AF37] text-black hover:bg-yellow-500 gap-2 h-12 px-8 text-lg font-bold">
                  <MessageCircle className="w-5 h-5" /> Prendre rendez-vous
                </Button>
              </a>
              <Link to="/formations">
                <Button variant="outline" className="border-white/20 hover:bg-white/5 text-white h-12 px-8 text-lg">
                  Voir les forfaits <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Footer */}
        <div className="text-center py-4 border-t border-white/5">
          <p className="text-sm text-gray-600">
            © Prorascience — Document de reference officiel du systeme MK5 / NGOWAZULU / ISNA
          </p>
        </div>
      </div>
    </div>
  );
};

export default CoachingPage;