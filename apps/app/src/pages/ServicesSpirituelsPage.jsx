import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  ShieldCheck, BrainCircuit, Stethoscope, BookOpen,
  CheckCircle2, AlertTriangle, FileText, Flame, Eye, Swords, Heart,
  Lock, UserCheck, Clock, Star, Zap, Shield, Activity, MessageCircle, Info, Sparkles
} from 'lucide-react';
import { ngowazuluMentoratOffers } from '@/config/ngowazuluMentoratOffers';
import NgowazuluMentoratDetailDialog from '@/components/ngowazulu/NgowazuluMentoratDetailDialog';
import NgowazuluConfigFeesModal from '@/components/ngowazulu/NgowazuluConfigFeesModal';

const SectionTitle = ({ icon: Icon, title, color = 'text-[var(--school-accent)]' }) => (
  <div className="flex items-center gap-3 mb-6">
    <div className={`p-2.5 rounded-xl bg-white/5 border border-white/10`}>
      <Icon className={`w-6 h-6 ${color}`} />
    </div>
    <h3 className="text-2xl font-bold text-white font-serif">{title}</h3>
  </div>
);

const SubSection = ({ letter, title, children }) => (
  <div className="mb-10">
    <h4 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
      <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-[color-mix(in_srgb,var(--school-accent)_10%,transparent)] text-[var(--school-accent)] text-sm font-bold border border-[color-mix(in_srgb,var(--school-accent)_20%,transparent)]">
        {letter}
      </span>
      {title}
    </h4>
    {children}
  </div>
);

const BulletItem = ({ children, icon = '▸' }) => (
  <li className="flex items-start gap-2.5 text-base text-gray-300 leading-relaxed">
    <span className="text-[var(--school-accent)] mt-0.5 shrink-0">{icon}</span>
    <span>{children}</span>
  </li>
);

const NumberedStep = ({ number, title, description }) => (
  <div className="flex gap-4 items-start">
    <div className="w-8 h-8 rounded-full bg-[color-mix(in_srgb,var(--school-accent)_10%,transparent)] border border-[color-mix(in_srgb,var(--school-accent)_20%,transparent)] flex items-center justify-center shrink-0 mt-0.5">
      <span className="text-sm font-bold text-[var(--school-accent)]">{number}</span>
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

const ServicesSpirituelsPage = () => {
  const location = useLocation();
  const [mentoratDetailOffer, setMentoratDetailOffer] = useState(null);
  const [configFeesModalOpen, setConfigFeesModalOpen] = useState(false);

  useEffect(() => {
    const raw = String(location.hash || '').replace(/^#/, '');
    if (!raw) return;
    const t = window.setTimeout(() => {
      document.getElementById(raw)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
    return () => window.clearTimeout(t);
  }, [location.hash, location.pathname]);

  return (
    <div className="min-h-screen bg-[#0F1419] text-white pt-20 pb-20">
      <Helmet>
        <title>Services Spirituels Professionnels | PRORASCIENCE</title>
        <meta name="description" content="Comprendre la difference entre le Coaching Therapeute et le Montorat Spirituel. Document officiel de reference PRORASCIENCE." />
      </Helmet>

      {/* ═══════════ HERO ═══════════ */}
      <section className="relative py-24 px-6 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#0F1419] via-[#192734]/50 to-[#0F1419]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[color-mix(in_srgb,var(--school-accent)_5%,transparent)] rounded-full blur-[150px]" />
        
        <div className="relative max-w-4xl mx-auto text-center space-y-6">
          <div className="flex items-center justify-center gap-3 text-[var(--school-accent)] text-sm uppercase tracking-[0.3em] font-bold">
            <span>✦</span> PRORASCIENCE <span>✦</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-serif font-bold text-white leading-tight">
            Système de services<br />
            <span className="text-[var(--school-accent)]">Spirituels professionnels</span>
          </h1>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Document officiel de référence — Établi par le 5ᵉ Manikongo — MK5
          </p>
          <div className="w-24 h-0.5 bg-gradient-to-r from-transparent via-[var(--school-accent)] to-transparent mx-auto mt-6" />

          {/* Quick nav */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-8">
            <a href="#coaching" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-yellow-600/10 border border-yellow-600/20 text-yellow-400 font-semibold text-sm hover:bg-yellow-600/20 transition-all">
              <BrainCircuit className="w-5 h-5" /> Coaching thérapeute
            </a>
            <a href="#montorat" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-red-600/10 border border-red-600/20 text-red-400 font-semibold text-sm hover:bg-red-600/20 transition-all">
              <ShieldCheck className="w-5 h-5" /> Montorat spirituel
            </a>
          </div>
        </div>
      </section>

      {/* ═══════════ INTRO ═══════════ */}
      <div className="max-w-5xl mx-auto px-4 md:px-6 space-y-24">
        
        <section className="bg-[#192734]/50 border border-white/10 rounded-2xl p-8 md:p-12 text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
            <h2 className="text-xl font-bold text-white">Important</h2>
          </div>
          <p className="text-gray-300 text-lg max-w-3xl mx-auto leading-relaxed">
            Comprendre la différence entre ces deux services est <span className="text-[var(--school-accent)] font-bold">essentiel</span> avant toute inscription.
            Le coaching forme un praticien. Le Montorat prend en charge un bénéficiaire.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-10 max-w-3xl mx-auto">
            <div className="bg-yellow-500/5 border border-yellow-500/15 rounded-xl p-6 text-left">
              <BrainCircuit className="w-8 h-8 text-yellow-400 mb-3" />
              <h3 className="text-lg font-bold text-yellow-300 mb-2">Coaching thérapeute</h3>
              <p className="text-sm text-gray-400">Formation pour devenir praticien. <span className="text-yellow-300 font-semibold">Vous apprenez à intervenir sur les autres.</span></p>
              <p className="text-sm text-gray-500 mt-2 italic">→ Correspond au cycle privé (Académie Pro)</p>
            </div>
            <div className="bg-red-500/5 border border-red-500/15 rounded-xl p-6 text-left">
              <ShieldCheck className="w-8 h-8 text-red-400 mb-3" />
              <h3 className="text-lg font-bold text-red-300 mb-2">Montorat Spirituel</h3>
              <p className="text-sm text-gray-400">Assistance spirituelle active. <span className="text-red-300 font-semibold">On intervient pour vous et a votre place.</span></p>
              <p className="text-sm text-gray-500 mt-2 italic">→ Correspond au cycle privilégié (mentorat)</p>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════
            PARTIE I : COACHING THERAPEUTE
        ═══════════════════════════════════════════════════════════════ */}
        <section id="coaching" className="scroll-mt-28">
          <div className="text-center mb-16">
            <span className="inline-block px-4 py-1.5 rounded-full bg-yellow-500/10 text-yellow-400 text-xs font-bold uppercase tracking-widest border border-yellow-500/20 mb-4">
              Partie I
            </span>
            <h2 className="text-3xl md:text-4xl font-serif font-bold text-white">
              Le Coaching Therapeute
            </h2>
            <p className="text-gray-400 mt-3 max-w-2xl mx-auto">
              Formation complete pour pratiquer l'art de l\'intervention spirituelle de maniere professionnelle.
              Ce n'est pas une simple initiation : c\'est la transmission d\'un metier.
            </p>
          </div>

          <div className="space-y-12 bg-[#141c27] rounded-3xl border border-yellow-500/10 p-6 md:p-10">

            {/* A. LE METIER */}
            <SubSection letter="A" title="Le metier de therapeute spirituel">
              <p className="text-base text-gray-400 mb-4">Le therapeute spirituel est un praticien forme a :</p>
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
              <p className="text-base text-gray-400 mb-5">Etapes structurees de la premiere consultation :</p>
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
              <p className="text-base text-gray-400 mb-4">Document fondamental redige lors de chaque consultation. Il contient :</p>
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
                  <div key={i} className="flex items-center gap-2 text-base text-gray-300 bg-white/[0.02] border border-white/5 rounded-lg p-3">
                    <FileText className="w-4 h-4 text-[var(--school-accent)] shrink-0" />
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
                  { icon: AlertTriangle, label: 'Possession', desc: 'Entite installée dans le corps subtil' },
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
              <p className="text-sm text-gray-400 mb-4">Selon le type de blocage diagnostique, le therapeute choisit parmi les methodes suivantes :</p>
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
        </section>

        {/* ═══════════ SEPARATOR ═══════════ */}
        <div className="flex items-center justify-center opacity-30">
          <div className="h-px bg-white w-full max-w-xs" />
          <span className="px-6 text-3xl text-[var(--school-accent)]">⚜</span>
          <div className="h-px bg-white w-full max-w-xs" />
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            PARTIE II : MONTORAT SPIRITUEL
        ═══════════════════════════════════════════════════════════════ */}
        <section id="montorat" className="scroll-mt-28">
          <div className="text-center mb-16">
            <span className="inline-block px-4 py-1.5 rounded-full bg-red-500/10 text-red-400 text-xs font-bold uppercase tracking-widest border border-red-500/20 mb-4">
              Partie II
            </span>
            <h2 className="text-3xl md:text-4xl font-serif font-bold text-white">
              Le Montorat Spirituel
            </h2>
            <p className="text-gray-400 mt-3 max-w-2xl mx-auto">
              Aussi appele Guardianship ou Mandat de Veille — un service d'assistance spirituelle active et personnelle.
            </p>
          </div>

          <div className="space-y-12 bg-[#141c27] rounded-3xl border border-red-500/10 p-6 md:p-10">

            {/* A. DEFINITION */}
            <SubSection letter="A" title="Definition du Montorat">
              <div className="bg-red-500/[0.03] border border-red-500/10 rounded-xl p-5 mb-5">
                <p className="text-sm text-gray-300 leading-relaxed">
                  Contrairement au coaching (qui <span className="text-yellow-300 font-semibold">forme</span>), 
                  le Montorat <span className="text-red-300 font-semibold">prend en charge</span>. 
                  Le Moniteur spirituel est un Maitre d'Autel qui accepte de placer le beneficiaire sous sa protection vibratoire complete.
                </p>
              </div>
              <p className="text-sm text-gray-400 mb-4">Le Moniteur spirituel accepte de :</p>
              <ul className="space-y-2.5">
                <BulletItem>Placer le beneficiaire sous sa protection vibratoire</BulletItem>
                <BulletItem>Exercer des rituels en son nom et pour son compte</BulletItem>
                <BulletItem>Interceder aupres des forces spirituelles en faveur du beneficiaire</BulletItem>
                <BulletItem>Surveiller l'espace energetique du beneficiaire en permanence</BulletItem>
                <BulletItem>Detecter et neutraliser les attaques, blocages et infiltrations</BulletItem>
                <BulletItem>Accompagner l'apprentissage sans que le beneficiaire n\'ait a tout faire lui-meme</BulletItem>
              </ul>
            </SubSection>

            {/* B. QUAND */}
            <SubSection letter="B" title="Quand prend-on un Moniteur ?">
              <p className="text-sm text-gray-400 mb-4">Le Montorat s'active dans les situations suivantes :</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {[
                  'Vous subissez des attaques spirituelles repetees',
                  'Vous n\'arrivez pas a vous proteger seul(e)',
                  'Vous traversez une crise spirituelle profonde',
                  'Vous avez besoin d\'un diagnostic et d\'une prise en charge immediate',
                  'Vous souhaitez un accompagnement total pour votre evolution',
                  'Vous voulez quelqu\'un qui intervient a votre place quand c\'est necessaire',
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-2.5 text-sm text-gray-300 bg-red-500/[0.03] border border-red-500/10 rounded-lg p-3">
                    <Zap className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </SubSection>

            {/* C. CE QUE FAIT LE MONITEUR */}
            <SubSection letter="C" title="Ce que fait le Moniteur pour toi">
              <p className="text-sm text-gray-400 mb-5">
                Le Moniteur Spirituel est comme un <span className="text-red-300 font-semibold">Ganga personnel</span>, 
                un <span className="text-red-300 font-semibold">avocat celeste</span>, 
                un <span className="text-red-300 font-semibold">bouclier vivant</span>. Il execute pour toi :
              </p>
              <ul className="space-y-2.5">
                <BulletItem>Les prieres et rituels quotidiens que tu n'as pas le temps ou les moyens de faire</BulletItem>
                <BulletItem>La lecture reguliere de ton aura et de ton etat vibratoire</BulletItem>
                <BulletItem>L'activation de ton autel personnel a distance</BulletItem>
                <BulletItem>Les interventions d'urgence lors d\'attaques soudaines</BulletItem>
                <BulletItem>Le suivi de ta trajectoire astrale et karmique</BulletItem>
                <BulletItem>La pose et le renouvellement de ta protection spirituelle</BulletItem>
                <BulletItem>L'intercession active aupres des ancetres, guides et forces lumineuses</BulletItem>
                <BulletItem>Le rapport regulier de l'evolution de ton etat spirituel</BulletItem>
              </ul>
            </SubSection>

            {/* D. TYPES DE MONTORAT */}
            <SubSection letter="D" title="Types de Montorat disponibles">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  {
                    title: 'Montorat de Protection',
                    icon: Shield,
                    desc: 'Pose de boucliers, surveillance energetique, neutralisation des menaces.',
                    color: 'blue',
                  },
                  {
                    title: 'Montorat de Guerison',
                    icon: Heart,
                    desc: 'Interventions therapeutiques, liberations, purifications regulieres.',
                    color: 'emerald',
                  },
                  {
                    title: 'Montorat d\'Elevation',
                    icon: Star,
                    desc: 'Accompagnement initiatique, acceleration karmique, ouverture des voies.',
                    color: 'purple',
                  },
                ].map((item, i) => (
                  <div key={i} className={`bg-${item.color}-500/[0.04] border border-${item.color}-500/15 rounded-xl p-5 text-center`}>
                    <item.icon className={`w-8 h-8 text-${item.color}-400 mx-auto mb-3`} />
                    <h5 className="text-base font-bold text-white mb-2">{item.title}</h5>
                    <p className="text-sm text-gray-400 leading-relaxed">{item.desc}</p>
                  </div>
                ))}
              </div>
            </SubSection>

            {/* E. CONTRAT DE MONTORAT */}
            <SubSection letter="E" title="Le Contrat de Montorat">
              <p className="text-base text-gray-400 mb-5">Tout Montorat est formalise par un Contrat Sacre comprenant :</p>
              <div className="space-y-4 bg-white/[0.02] rounded-xl border border-white/5 p-5">
                <NumberedStep number="1" title="Duree definie" description="Date de debut, date de fin, possibilite de renouvellement" />
                <NumberedStep number="2" title="Objet du mandat" description="Motif precis de la prise en charge" />
                <NumberedStep number="3" title="Engagements du Moniteur" description="Nature des rituels, frequence d'intervention" />
                <NumberedStep number="4" title="Engagements du beneficiaire" description="Comportement attendu, restrictions eventuelles" />
                <NumberedStep number="5" title="Rapport d'evolution" description="Frequence des bilans partages" />
                <NumberedStep number="6" title="Clause de resiliation" description="Conditions de rupture du contrat" />
                <NumberedStep number="7" title="Ceremonie d'activation" description="Rituel d'ouverture officiel du Montorat" />
                <NumberedStep number="8" title="Ceremonie de cloture" description="Rituel de fermeture et de liberation a terme" />
              </div>
            </SubSection>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════
            PARTIE III : NGOWAZULU
        ═══════════════════════════════════════════════════════════════ */}
        <section id="ngowazulu" className="scroll-mt-28">
          <div className="text-center mb-16">
            <span className="inline-block px-4 py-1.5 rounded-full bg-emerald-500/10 text-emerald-300 text-xs font-bold uppercase tracking-widest border border-emerald-500/20 mb-4">
              Partie III
            </span>
            <h2 className="text-3xl md:text-5xl font-serif font-bold text-white">
              NGOWAZULU
              <span className="block text-[var(--school-accent)] text-2xl md:text-3xl mt-2">L&apos;hôpital spirituel de la science africaine</span>
            </h2>
            <p className="text-gray-400 mt-4 max-w-3xl mx-auto">
              Prorascience enseigne. Ngowazulu intervient.
              Quand il faut comprendre, nous formons. Quand il faut agir, nous intervenons.
            </p>
          </div>

          <div className="space-y-10 bg-[#111924] rounded-3xl border border-emerald-500/10 p-6 md:p-10">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2 rounded-2xl border border-white/10 bg-white/[0.02] p-6">
                <SectionTitle icon={Stethoscope} title="Une autre dimension de Prorascence" color="text-emerald-300" />
                <p className="text-gray-300 leading-relaxed">
                  Certaines situations ne demandent pas seulement d&apos;apprendre.
                  Elles demandent une intervention immédiate et structurée.
                  NGOWAZULU fonctionne comme un hôpital spirituel dédié aux problèmes mystiques.
                </p>
              </div>
              <div className="rounded-2xl border border-red-500/20 bg-red-500/[0.03] p-6">
                <p className="text-xs uppercase tracking-[0.2em] text-red-300 mb-3">Ces situations</p>
                <ul className="space-y-2 text-sm text-gray-300">
                  <BulletItem>Souffrance inexpliquée</BulletItem>
                  <BulletItem>Maladie spirituelle</BulletItem>
                  <BulletItem>Blocage de vie</BulletItem>
                  <BulletItem>Attaque mystique</BulletItem>
                  <BulletItem>Rêves troublants</BulletItem>
                  <BulletItem>Sensation d'oppression</BulletItem>
                </ul>
              </div>
            </div>

            <div className="rounded-2xl border border-[color-mix(in_srgb,var(--school-accent)_20%,transparent)] bg-[color-mix(in_srgb,var(--school-accent)_5%,transparent)] p-6">
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--school-accent)] mb-3">Parcours d'intervention</p>
              <div className="space-y-4">
                <NumberedStep
                  number="1"
                  title="Consultation — 50 EUR"
                  description="Entretien approfondi : écoute, analyse, lecture énergétique, lecture karmique et interprétation des songes. Ce n&apos;est pas un examen, c&apos;est une orientation."
                />
                <NumberedStep
                  number="2"
                  title="Voyance (si nécessaire)"
                  description="Pour les cas complexes : clairvoyance, FA / cauris, vision, lecture du destin. Jusqu&apos;à 3 voyances possibles pour valider une suspicion."
                />
                <NumberedStep
                  number="3"
                  title="Diagnostic"
                  description="Le problème est identifié de façon claire et actionnable."
                />
                <NumberedStep
                  number="4"
                  title="Intervention"
                  description="Selon le cas : exorcisme, travail spirituel, rééquilibrage ou initiation. Cas grave : hospitalisation spirituelle. Cas simple : traitement à distance."
                />
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-black/40 to-black/20 p-6 md:p-8">
              <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-[var(--school-accent)] mb-1">Temple Ngowazulu</p>
                  <p className="text-2xl font-serif font-bold text-white">Contrats mentorat</p>
                  <p className="text-sm text-gray-400 mt-2 max-w-xl">
                    Chaque contrat dure <span className="text-white font-medium">un mois</span>. Vous choisissez la densité des rencontres
                    (du rythme Essentiel au palier Souverain). Cliquez sur <span className="text-[var(--school-accent)]">Détails</span> pour la fiche complète.
                  </p>
                </div>
                <Sparkles className="w-10 h-10 text-[color-mix(in_srgb,var(--school-accent)_60%,transparent)] hidden md:block" />
              </div>

              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 max-w-2xl">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider">Entrée</p>
                  <p className="text-lg font-semibold text-white mt-1">Consultation spirituelle</p>
                  <p className="text-[var(--school-accent)] font-bold">50 EUR</p>
                  <p className="text-xs text-gray-400 mt-2">1 h 30 — discernement et orientation.</p>
                </div>
                <Link
                  to="/paiements/payer?plan=ngowazulu-consultation-90min&interval=one_time&next=%2Fappointment%2Frequest%3Fflow%3Dngowazulu-consultation"
                  className="shrink-0"
                >
                  <Button variant="outline" className="border-white/15 text-white hover:bg-white/5 h-9 w-full sm:w-auto">Réserver</Button>
                </Link>
              </div>

              <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.08] p-4 mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="text-sm text-amber-100/95">
                  <p className="font-semibold text-white">Premier achat mentorat</p>
                  <p className="text-xs text-amber-100/85 mt-1 max-w-xl">
                    Des frais de configuration (100 EUR, uniques) sont calculés et ajoutés automatiquement — ce ne sont pas un produit à commander séparément.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="border-amber-400/50 text-amber-100 hover:bg-amber-500/15 shrink-0"
                  onClick={() => setConfigFeesModalOpen(true)}
                >
                  <Info className="w-4 h-4 mr-2" />
                  Explication détaillée
                </Button>
              </div>

              <p className="text-xs uppercase tracking-[0.2em] text-gray-500 mb-3">Paliers mensuels — au choix</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {ngowazuluMentoratOffers.map((offer) => (
                  <div
                    key={offer.slug}
                    className={`rounded-2xl border bg-gradient-to-br p-5 flex flex-col ${offer.accent}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className={`text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full border ${offer.badgeClass}`}>
                          Mentorat {offer.commercialName}
                        </span>
                        <p className="text-white font-semibold mt-2">{offer.subtitle}</p>
                        <p className="text-[var(--school-accent)] font-bold text-lg mt-1">{offer.priceLabel}</p>
                        <p className="text-xs text-gray-400 mt-1">{offer.frequencyShort}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-4">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="border-white/20 text-gray-200 hover:bg-white/10"
                        onClick={() => setMentoratDetailOffer(offer)}
                      >
                        <Info className="w-4 h-4 mr-1.5" /> Détails
                      </Button>
                      <a href={`/paiements/payer?plan=${encodeURIComponent(offer.slug)}&interval=monthly`}>
                        <Button size="sm" className="bg-[var(--school-accent)] text-black hover:bg-amber-500 font-bold">Souscrire</Button>
                      </a>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-5 rounded-lg border border-emerald-500/25 bg-emerald-500/10 p-3 text-sm text-emerald-200">
                Après votre <span className="font-medium text-emerald-100">premier paiement mentorat</span> (incluant les frais de configuration le cas échéant), complétez le dossier patient :{' '}
                <a href="/ngowazulu/dossier" className="underline font-semibold text-emerald-100">/ngowazulu/dossier</a>
              </div>
            </div>

            <NgowazuluConfigFeesModal open={configFeesModalOpen} onOpenChange={setConfigFeesModalOpen} />

            <NgowazuluMentoratDetailDialog
              offer={mentoratDetailOffer}
              open={Boolean(mentoratDetailOffer)}
              onOpenChange={(v) => {
                if (!v) setMentoratDetailOffer(null);
              }}
              onExplainConfigFees={() => setConfigFeesModalOpen(true)}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.04] p-6">
                <SectionTitle icon={BookOpen} title="NZO-WA-NKISI" color="text-emerald-300" />
                <p className="text-sm text-gray-300 mb-3">Maison des remèdes (pharmacie spirituelle)</p>
                <ul className="space-y-2 text-sm text-gray-300">
                  <BulletItem>Produits spirituels</BulletItem>
                  <BulletItem>Éléments rituels</BulletItem>
                  <BulletItem>Remèdes africains validés</BulletItem>
                </ul>
              </div>

              <div className="rounded-2xl border border-violet-500/20 bg-violet-500/[0.04] p-6">
                <SectionTitle icon={Flame} title="La Communion" color="text-violet-300" />
                <p className="text-sm text-gray-300 mb-3">Maintenance spirituelle continue (abonnement minimum 15 EUR / mois)</p>
                <ul className="space-y-2 text-sm text-gray-300">
                  <BulletItem>Culte NGOWAZULU en live immersif</BulletItem>
                  <BulletItem>Dernier vendredi: fermer le mois</BulletItem>
                  <BulletItem>Premier dimanche: ouvrir le mois</BulletItem>
                  <BulletItem>Prière, enseignement, vision en temps réel</BulletItem>
                </ul>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 p-6">
              <p className="text-xs uppercase tracking-[0.2em] text-gray-400 mb-4">Expérience immersive du culte</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                  <p className="text-sm font-semibold text-white mb-2">Fonctionnalités live immersif</p>
                  <ul className="space-y-2 text-sm text-gray-300">
                    <BulletItem>SmartBoard interactif</BulletItem>
                    <BulletItem>Liens cliquables et offrande en temps réel</BulletItem>
                    <BulletItem>Prière collective et musique spirituelle</BulletItem>
                  </ul>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                  <p className="text-sm font-semibold text-white mb-2">Avant le culte</p>
                  <ul className="space-y-2 text-sm text-gray-300">
                    <BulletItem>Compte à rebours en salle d&apos;attente</BulletItem>
                    <BulletItem>Ambiance spirituelle et préparation mentale</BulletItem>
                    <BulletItem>Lien d&apos;offrande et consignes de calme</BulletItem>
                    <BulletItem>Nom du prêtre et guide affiché</BulletItem>
                  </ul>
                </div>
              </div>
            </div>

            <div className="text-center rounded-2xl border border-[color-mix(in_srgb,var(--school-accent)_20%,transparent)] bg-[color-mix(in_srgb,var(--school-accent)_5%,transparent)] p-6">
              <p className="text-white text-lg font-semibold">Positionnement</p>
              <p className="text-gray-300 mt-2">
                Ngowazulu n&apos;est pas une simple consultation ni une pratique isolée.
                C&apos;est un système complet d&apos;intervention spirituelle.
              </p>
              <p className="text-[var(--school-accent)] font-bold mt-4">
                Quand il faut comprendre → Prorascience | Quand il faut agir → Ngowazulu
              </p>
            </div>
          </div>
        </section>

        {/* ═══════════ CTA FINAL ═══════════ */}
        <section className="bg-gradient-to-br from-[#192734] to-[#0f1216] rounded-3xl p-10 md:p-16 text-center border border-white/10 relative overflow-hidden shadow-2xl">
          <div className="absolute top-0 right-0 w-96 h-96 bg-[color-mix(in_srgb,var(--school-accent)_5%,transparent)] rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-red-500/5 rounded-full blur-[80px] translate-y-1/2 -translate-x-1/2" />
          
          <div className="relative z-10 max-w-2xl mx-auto space-y-8">
            <h2 className="text-3xl font-bold font-serif text-white">Prêt à commencer ?</h2>
            <p className="text-gray-300 text-lg">
              Que vous cherchiez à vous former comme thérapeute ou à bénéficier d&apos;un accompagnement spirituel,
              notre équipe est disponible pour vous orienter vers le cycle adapté à votre situation.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a href="/appointment/request">
                <Button className="bg-[var(--school-accent)] text-black hover:bg-yellow-500 gap-2 h-12 px-8 text-lg font-bold">
                  <MessageCircle className="w-5 h-5" /> Prendre rendez-vous
                </Button>
              </a>
              <Link to="/formations">
                <Button variant="outline" className="border-white/20 hover:bg-white/5 text-white h-12 px-8 text-lg">
                  Voir les forfaits
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* ═══════════ FOOTER NOTE ═══════════ */}
        <div className="text-center py-8 border-t border-white/5">
          <p className="text-sm text-gray-600">
            © Prorascience — Document de référence officiel du système MK5 / NGOWAZULU / ISNA
          </p>
          <p className="text-sm text-gray-600 mt-1">
            Établi par le 5ᵉ Manikongo — Tous droits réservés
          </p>
        </div>
      </div>
    </div>
  );
};

export default ServicesSpirituelsPage;
