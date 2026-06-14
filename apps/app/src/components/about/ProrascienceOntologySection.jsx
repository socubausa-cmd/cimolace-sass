import React from 'react';
import { motion } from 'framer-motion';
import { 
  Globe, 
  Brain, 
  Atom, 
  Scale, 
  CheckCircle2, 
  BookOpen, 
  GraduationCap, 
  ArrowRightLeft, 
  Stars, 
  HelpCircle,
  Lightbulb,
  Fingerprint,
  Zap
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import ProraScienceDefinitionBox from '@/components/about/ProraScienceDefinitionBox';
import { FiveModelsTable, ThreeModelsComparison } from '@/components/about/CosmologyComparisons';

const SectionHeader = ({ title, subtitle, icon: Icon }) => (
  <div className="mb-10 text-center">
    {Icon && <div className="mx-auto w-12 h-12 rounded-full bg-[color-mix(in_srgb,var(--school-accent)_10%,transparent)] flex items-center justify-center mb-4"><Icon className="w-6 h-6 text-[var(--school-accent)]" /></div>}
    <h3 className="text-2xl md:text-3xl font-serif font-bold text-white mb-2">{title}</h3>
    {subtitle && <p className="text-gray-400 max-w-2xl mx-auto">{subtitle}</p>}
  </div>
);

const FeatureList = ({ items }) => (
  <ul className="space-y-3">
    {items.map((item, i) => (
      <li key={i} className="flex items-start gap-3 text-gray-300">
        <CheckCircle2 className="w-5 h-5 text-[var(--school-accent)] shrink-0 mt-0.5" />
        <span dangerouslySetInnerHTML={{ __html: item }} />
      </li>
    ))}
  </ul>
);

const ProrascienceOntologySection = () => {
  return (
    <section className="py-24 px-6 relative bg-[#0B1116] border-t border-white/5">
      {/* Background Decor */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-900/5 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-[color-mix(in_srgb,var(--school-accent)_5%,transparent)] rounded-full blur-[100px] pointer-events-none" />

      <div className="max-w-7xl mx-auto relative z-10">
        
        {/* MAIN TITLE */}
        <div className="text-center mb-20">
          <Badge className="bg-blue-600/20 text-blue-400 border-blue-500/30 mb-4 hover:bg-blue-600/30">Science Avancée</Badge>
          <h2 className="text-4xl md:text-5xl font-serif font-bold text-white mb-6 leading-tight">
            La PRORASCIENCE : Un Modèle Africain de <br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[var(--school-accent)] to-yellow-200">Science Ontologique et Cosmologique</span>
          </h2>
          <p className="text-xl text-gray-400 max-w-3xl mx-auto">
            Au-delà d'une simple méthode, la Prorascience se pose comme un modèle scientifique complet, intégrant l\'Être, la conscience et le destin comme des objets d\'étude rigoureux.
          </p>
        </div>

        {/* SECTION 1: DEFINITION OF COSMOLOGICAL MODEL */}
        <div className="mb-24">
          <SectionHeader 
            title="Définition d'un Modèle Cosmologique" 
            subtitle="Pour prétendre au titre de 'Modèle Cosmologique', une structure de pensée doit répondre à 4 questions fondamentales."
            icon={Globe}
          />
          
          <div className="grid md:grid-cols-4 gap-4 mb-10">
            {[
              { q: "L'Origine", a: "D'où vient l'univers ?" },
              { q: "La Structure", a: "De quoi est-il fait ?" },
              { q: "Les Lois", a: "Comment fonctionne-t-il ?" },
              { q: "La Place de l'Homme", a: "Quel est notre rôle ?" }
            ].map((card, i) => (
              <div key={i} className="bg-[#192734] p-6 rounded-xl border border-white/5 text-center hover:border-[color-mix(in_srgb,var(--school-accent)_30%,transparent)] transition-colors">
                <HelpCircle className="w-8 h-8 text-blue-400 mx-auto mb-3" />
                <h4 className="text-white font-bold mb-1">{card.q}</h4>
                <p className="text-sm text-gray-400">{card.a}</p>
              </div>
            ))}
          </div>

          <h4 className="text-xl font-bold text-white mb-6 pl-4 border-l-4 border-[var(--school-accent)]">Comparaison des Grands Modèles</h4>
          <FiveModelsTable />
        </div>

        {/* SECTION 2: PRORASCIENCE VALIDITY CHECKLIST */}
        <div className="mb-24 bg-gradient-to-br from-[#192734] to-[#15202B] p-8 md:p-12 rounded-2xl border border-white/10 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-[color-mix(in_srgb,var(--school-accent)_10%,transparent)] rounded-full blur-3xl -mr-10 -mt-10" />
          <SectionHeader 
            title="La PRORASCIENCE comme Modèle Cosmologique Valide" 
            subtitle="Elle ne se contente pas de critiquer, elle propose une structure complète vérifiable."
          />
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { title: "Constantes Fondamentales", desc: "Définit les invariants de l'univers (Lois de Maât)." },
              { title: "Genèse de l'Être", desc: "Explique l'apparition de la conscience dans la matière." },
              { title: "Ontologie Claire", desc: "Distingue l'Essence (Esprit) de la Substance (Matière)." },
              { title: "Dynamique du Réel", desc: "Modélise les interactions entre visible et invisible." },
              { title: "Continuité Post-Mortem", desc: "Science de la transition d'état (mort) sans dogme." },
              { title: "Mécanique du Destin", desc: "Lois de causalité (Karma) appliquées mathématiquement." }
            ].map((item, i) => (
              <motion.div 
                key={i}
                whileHover={{ scale: 1.02 }}
                className="bg-black/20 p-5 rounded-lg border border-white/5 flex gap-4"
              >
                <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                </div>
                <div>
                  <h4 className="text-white font-bold text-sm mb-1">{item.title}</h4>
                  <p className="text-sm text-gray-400 leading-relaxed">{item.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* SECTION 3 & 4: JANUS COMPARISON */}
        <div className="mb-24">
          <div className="grid md:grid-cols-2 gap-12 items-center mb-10">
            <div>
              <SectionHeader 
                title="PRORASCIENCE vs Modèle Janus" 
                subtitle="Le dialogue avec les modèles alternatifs les plus robustes."
                icon={ArrowRightLeft}
              />
              <p className="text-gray-300 mb-6 leading-relaxed">
                Le modèle <strong>Janus</strong> (J.P. Petit) est fascinant car il introduit la masse négative et géométrise l'univers. Cependant, il reste un modèle <em>astrophysique</em>.
              </p>
              <p className="text-gray-300 leading-relaxed">
                La <strong>PRORASCIENCE</strong> va plus loin en intégrant la variable "Conscience". Là où Janus explique la mécanique des galaxies, la Prorascience explique la mécanique de l'Âme qui observe ces galaxies.
              </p>
            </div>
            <div className="bg-[#192734] p-8 rounded-xl border border-white/10">
              <h4 className="text-white font-bold mb-4 flex items-center gap-2">
                <Atom className="text-blue-400" /> Points de Convergence
              </h4>
              <ul className="space-y-3 mb-6 text-sm text-gray-300">
                <li className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-green-500" /> Remise en cause du dogme établi.</li>
                <li className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-green-500" /> Vision binaire/dualiste de l'univers.</li>
                <li className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-green-500" /> Recherche d'une logique unificatrice.</li>
              </ul>
              <h4 className="text-white font-bold mb-4 flex items-center gap-2">
                <Brain className="text-[var(--school-accent)]" /> Apport Prorascientifique
              </h4>
              <p className="text-sm text-gray-400 italic border-l-2 border-[var(--school-accent)] pl-3">
                "L'univers n'est pas seulement une machine géométrique, c'est un champ de conscience en expérience."
              </p>
            </div>
          </div>
          
          <ThreeModelsComparison />
        </div>

        {/* SECTION 5: ONTOLOGICAL SCIENCE */}
        <div className="mb-24 text-center max-w-4xl mx-auto">
          <SectionHeader 
            title="La PRORASCIENCE comme Science Ontologique" 
            subtitle="L'Ontologie est l'étude de l'Être. La Prorascience en fait une discipline exacte."
            icon={Brain}
          />
          <div className="grid sm:grid-cols-2 gap-4">
             {[
               "Elle <strong>définit l'Être</strong> non comme un concept philo, mais comme une structure vibratoire.",
               "Elle <strong>distingue les niveaux</strong> de réalité (Corps, Âme, Esprit, Hypostase).",
               "Elle <strong>explique la Conscience</strong> comme une propriété fondamentale, non un accident biologique.",
               "Elle <strong>décrit les Lois Universelles</strong> qui régissent l'évolution de cet Être."
             ].map((txt, i) => (
               <div key={i} className="p-4 bg-[#192734] rounded-lg border border-white/5 text-gray-300 text-sm">
                 <span dangerouslySetInnerHTML={{ __html: txt }} />
               </div>
             ))}
          </div>
        </div>

        {/* SECTION 6: AFRICAN MODEL */}
        <div className="mb-24 flex flex-col md:flex-row gap-8 items-center bg-[#15202B] rounded-2xl p-8 border border-[color-mix(in_srgb,var(--school-accent)_20%,transparent)]">
          <div className="md:w-1/3 text-center">
            <Globe className="w-24 h-24 text-[var(--school-accent)] mx-auto opacity-80" />
            <h3 className="text-2xl font-serif font-bold text-white mt-4">Un Modèle <br/>Africain</h3>
          </div>
          <div className="md:w-2/3">
            <h4 className="text-xl font-bold text-white mb-4">Pourquoi cette revendication est-elle légitime ?</h4>
            <FeatureList items={[
              "Elle puise ses concepts (Ka, Ba, Akh) dans les <strong>cosmologies africaines</strong> structurées.",
              "Elle <strong>reformule rationnellement</strong> ces savoirs sans folklore.",
              "Elle n'est <strong>ni mythologique, ni religieuse</strong>, mais purement cognitive.",
              "Elle <strong>dialogue d'égal à égal</strong> avec la science moderne occidentale."
            ]} />
          </div>
        </div>

        {/* SECTION 7 & 8: DEFINITION & SIGNATURE */}
        <div className="grid md:grid-cols-2 gap-8 mb-24">
          <ProraScienceDefinitionBox title="Définition Officielle" icon={BookOpen}>
            <p className="text-white italic text-lg leading-relaxed">
              "La PRORASCIENCE est le système de connaissance qui étudie les principes premiers de l'Univers et de l'Être, en unifiant les lois de la physique matérielle et celles de la métaphysique spirituelle dans un modèle cohérent, vérifiable et opératif."
            </p>
          </ProraScienceDefinitionBox>

          <ProraScienceDefinitionBox title="Signature Intellectuelle" icon={Fingerprint} className="via-blue-900/40 to-blue-900/10 from-blue-900/10 border-blue-500/30">
            <p className="text-white font-serif text-xl md:text-2xl leading-relaxed text-center py-6">
              "Là où la science mesure, la PRORASCIENCE comprend.<br/><br/>
              Là où la cosmologie décrit l'univers, elle décrit l'Être qui y apparaît."
            </p>
          </ProraScienceDefinitionBox>
        </div>

        {/* SECTION 9: ACADEMIC POSITIONING */}
        <div className="mb-24 text-center">
           <SectionHeader title="Positionnement Académique" icon={GraduationCap} />
           <div className="flex flex-col md:flex-row justify-center items-center gap-4 text-sm font-bold text-white">
              <div className="bg-[#192734] px-6 py-4 rounded-lg border border-white/10 w-full md:w-auto">Science Occidentale<br/><span className="text-gray-500 font-normal">Matérialiste / Analytique</span></div>
              <ArrowRightLeft className="text-[var(--school-accent)] w-6 h-6 rotate-90 md:rotate-0" />
              <div className="bg-[color-mix(in_srgb,var(--school-accent)_20%,transparent)] px-8 py-5 rounded-xl border border-[var(--school-accent)] scale-110 shadow-[0_0_20px_rgba(212,175,55,0.2)] w-full md:w-auto">
                PRORASCIENCE<br/><span className="text-[var(--school-accent)] font-normal">Ontologique / Holistique</span>
              </div>
              <ArrowRightLeft className="text-[var(--school-accent)] w-6 h-6 rotate-90 md:rotate-0" />
              <div className="bg-[#192734] px-6 py-4 rounded-lg border border-white/10 w-full md:w-auto">Spiritualité Traditionnelle<br/><span className="text-gray-500 font-normal">Intuitive / Symbolique</span></div>
           </div>
        </div>

        {/* SECTION 10: TEACHING IMPLICATIONS */}
        <div className="max-w-4xl mx-auto bg-[#192734] rounded-xl p-8 border-l-4 border-[var(--school-accent)]">
          <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-3">
            <Lightbulb className="text-[var(--school-accent)]" /> Implications pour l'Enseignement
          </h3>
          <div className="grid sm:grid-cols-2 gap-6">
            <div>
              <h4 className="text-white font-bold mb-2">Rigueur Scientifique</h4>
              <p className="text-sm text-gray-400">Aucune affirmation sans démonstration logique ou expérimentale.</p>
            </div>
            <div>
              <h4 className="text-white font-bold mb-2">Transparence Totale</h4>
              <p className="text-sm text-gray-400">Pas de "mystères" réservés aux initiés. Tout s'explique.</p>
            </div>
            <div>
              <h4 className="text-white font-bold mb-2">Questionnement Encouragé</h4>
              <p className="text-sm text-gray-400">Le doute est l'outil principal de la validation du savoir.</p>
            </div>
            <div>
              <h4 className="text-white font-bold mb-2">Intégration Moderne</h4>
              <p className="text-sm text-gray-400">Utilisation des outils actuels (physique, biologie) pour confirmer la tradition.</p>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
};

export default ProrascienceOntologySection;