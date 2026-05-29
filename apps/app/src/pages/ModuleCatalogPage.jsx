import React from 'react';
import { Helmet } from 'react-helmet';
import { BookOpen, Users, Star, Crown, Zap, CheckCircle2 } from 'lucide-react';
import ExpandableCard from '@/components/ui/ExpandableCard';
import PricingTable from '@/components/ui/PricingTable';
import { Button } from '@/components/ui/button';

const ModuleCatalogPage = () => {
  const modules = [
    {
      id: "academique",
      title: "Formation Académique",
      icon: BookOpen,
      level: "Tous Niveaux",
      duration: "9 mois",
      format: "Hybride (Live + Replay)",
      objectives: [
        "Maîtriser les bases de la Prorascience",
        "Comprendre les lois universelles",
        "Développer sa discipline intérieure"
      ],
      content: [
        "Cycle 1 : Les Fondements (3 mois)",
        "Cycle 2 : Les Outils de la Conscience (3 mois)",
        "Cycle 3 : Pratique et Réalisation (3 mois)"
      ],
      access: "Accès plateforme 24/7 + 2 Live/semaine",
      certification: "Certificat de Pratiquant Niveau 1",
      pricing: { monthly: "45€", quarterly: "120€", yearly: "400€" }
    },
    {
      id: "autonome",
      title: "Formation Autonome",
      icon: Zap,
      level: "Débutant",
      duration: "Illimité",
      format: "100% E-learning",
      objectives: [
        "Découvrir à son rythme",
        "Accéder aux savoirs fondamentaux",
        "Sans contrainte horaire"
      ],
      content: [
        "Accès à la bibliothèque vidéo de base",
        "Manuels PDF essentiels",
        "Quizz d'auto-évaluation"
      ],
      access: "Accès plateforme 24/7",
      certification: "Attestation de suivi",
      pricing: { monthly: "29€", quarterly: "80€", yearly: "290€" }
    },
    {
      id: "coaching",
      title: "Formation Coaching",
      icon: Users,
      level: "Intermédiaire",
      duration: "6 mois",
      format: "E-learning + Sessions Groupe",
      objectives: [
        "Appliquer la Prorascience au quotidien",
        "Résoudre des blocages personnels",
        "Dynamique de groupe"
      ],
      content: [
        "Modules de développement personnel",
        "Ateliers pratiques mensuels",
        "Cercle de parole guidé"
      ],
      access: "Accès complet + 1 Live Coaching/semaine",
      certification: "Certificat de Développement Personnel",
      pricing: { monthly: "65€", quarterly: "180€", yearly: "600€" }
    },
    {
      id: "privilegie",
      title: "Formation Privilégié",
      icon: Crown,
      level: "Avancé",
      duration: "12 mois",
      format: "VIP & Personnalisé",
      objectives: [
        "Accès direct aux enseignements supérieurs",
        "Suivi personnalisé par les Maîtres",
        "Initiation avancée"
      ],
      content: [
        "Tout le contenu Académique",
        "Sessions privées Q&R",
        "Accès prioritaire aux séminaires"
      ],
      access: "Accès Illimité + Ligne directe",
      certification: "Diplôme Supérieur de Prorascience",
      pricing: { monthly: "150€", quarterly: "420€", yearly: "1500€" }
    },
    {
      id: "mentorat",
      title: "Formation Mentorat",
      icon: Star,
      level: "Expert",
      duration: "Sur sélection",
      format: "One-on-One",
      objectives: [
        "Devenir enseignant",
        "Maîtrise totale des arcanes",
        "Transmission du savoir"
      ],
      content: [
        "Formation de formateur",
        "Supervision de pratique",
        "Création de contenu pédagogique"
      ],
      access: "Accès Total + Mentorat individuel",
      certification: "Titre de Maître-Assistant",
      pricing: { monthly: "Sur devis", quarterly: "-", yearly: "-" }
    }
  ];

  const pricingData = modules.map(m => ({
    title: m.title,
    level: m.level,
    monthly: m.pricing.monthly,
    quarterly: m.pricing.quarterly,
    yearly: m.pricing.yearly,
    quarterlyDiscount: m.pricing.monthly !== "Sur devis" ? "10%" : null,
    yearlyDiscount: m.pricing.monthly !== "Sur devis" ? "20%" : null,
    features: [m.access, m.certification, m.format]
  }));

  return (
    <div className="min-h-screen bg-[#0F1419] font-sans pb-20">
      <Helmet>
        <title>Catalogue des Modules - Formations | PRORASCIENCE ACADEMY</title>
        <meta name="description" content="Découvrez nos différentes formules de formation : Académique, Autonome, Coaching, Privilégié et Mentorat. Comparez les programmes et tarifs." />
      </Helmet>

      {/* Hero */}
      <section className="pt-32 pb-16 px-6 text-center bg-gradient-to-b from-[#192734] to-[#0F1419]">
        <h1 className="text-4xl lg:text-5xl font-serif font-bold text-white mb-6">
          Catalogue des <span className="text-[#D4AF37]">Formations</span>
        </h1>
        <p className="text-xl text-gray-400 max-w-2xl mx-auto">
          Choisissez le parcours qui correspond à votre quête de connaissance et à votre rythme d'apprentissage.
        </p>
      </section>

      {/* Modules List */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 mb-20 space-y-8">
        {modules.map((module) => (
          <ExpandableCard 
            key={module.id} 
            title={module.title} 
            icon={module.icon}
            className="border-l-4 border-l-[#D4AF37]"
          >
            <div className="grid lg:grid-cols-2 gap-10">
              <div className="space-y-6">
                <div>
                  <h4 className="text-[#D4AF37] font-bold uppercase text-sm mb-2 tracking-wider">Détails Clés</h4>
                  <ul className="grid grid-cols-2 gap-4 text-sm text-gray-300">
                    <li><span className="font-bold text-white">Niveau :</span> {module.level}</li>
                    <li><span className="font-bold text-white">Durée :</span> {module.duration}</li>
                    <li><span className="font-bold text-white">Format :</span> {module.format}</li>
                    <li><span className="font-bold text-white">Certif. :</span> {module.certification}</li>
                  </ul>
                </div>
                <div>
                  <h4 className="text-[#D4AF37] font-bold uppercase text-sm mb-2 tracking-wider">Objectifs</h4>
                  <ul className="space-y-2">
                    {module.objectives.map((obj, i) => (
                      <li key={i} className="flex items-start gap-2 text-gray-300 text-sm">
                        <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                        {obj}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="space-y-6">
                 <div>
                  <h4 className="text-[#D4AF37] font-bold uppercase text-sm mb-2 tracking-wider">Contenu du Programme</h4>
                  <div className="bg-black/20 rounded-lg p-4 space-y-3">
                    {module.content.map((item, i) => (
                      <div key={i} className="flex items-center gap-3 text-gray-300 text-sm border-b border-white/5 last:border-0 pb-2 last:pb-0">
                        <span className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold text-[#D4AF37]">{i + 1}</span>
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between bg-[#D4AF37]/10 p-4 rounded-lg border border-[#D4AF37]/30">
                   <div>
                      <span className="block text-xs text-[#D4AF37] uppercase font-bold">À partir de</span>
                      <span className="text-2xl font-bold text-white">{module.pricing.monthly}</span>
                      <span className="text-sm text-gray-400"> / mois</span>
                   </div>
                   <Button className="bg-[#D4AF37] text-black hover:bg-[#b5952f]">S'inscrire</Button>
                </div>
              </div>
            </div>
          </ExpandableCard>
        ))}
      </section>

      {/* Comparison Table */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-20">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-serif font-bold text-white mb-4">Tableau Comparatif</h2>
          <p className="text-gray-400">Une vue d'ensemble pour faire le meilleur choix.</p>
        </div>
        <PricingTable pricingData={pricingData} />
      </section>

      {/* Switch Info */}
      <section className="bg-[#192734] py-16 text-center border-t border-white/5">
        <div className="max-w-3xl mx-auto px-6">
          <h3 className="text-2xl font-bold text-white mb-4">Passerelles et Évolutions</h3>
          <p className="text-gray-400 mb-8">
            Il est possible de changer de module en cours d'année (sous conditions et validation pédagogique). 
            La différence tarifaire sera ajustée au prorata des mois restants.
          </p>
          <a href="/appointment/request">
            <Button variant="outline" className="border-white/20 text-white hover:bg-white/10">Contacter un conseiller</Button>
          </a>
        </div>
      </section>
    </div>
  );
};

export default ModuleCatalogPage;