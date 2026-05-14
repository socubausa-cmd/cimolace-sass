import React from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Sparkles, ScrollText, Shield, Crown, Award, Clock, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';

const InitiationCeremonyPage = () => {
  const values = [
    { title: "Engagement", desc: "Le pacte solennel avec soi-même.", icon: Shield },
    { title: "Reconnaissance", desc: "L'acceptation par les pairs.", icon: Award },
    { title: "Transmission", desc: "Le passage du flambeau sacré.", icon: ScrollText },
    { title: "Protection", desc: "L'entrée sous l'égide de l'Ordre.", icon: Shield },
    { title: "Élévation", desc: "Le changement de plan vibratoire.", icon: Crown }
  ];

  const phases = [
    { step: 1, title: "Préparation & Purification", desc: "Temps de recueillement et de préparation vibratoire avant l'entrée dans le temple virtuel." },
    { step: 2, title: "Ouverture Officielle", desc: "Invocation des énergies et mot d'ouverture par le Manikongo.", quote: "Que la lumière soit, et que les ombres reculent devant la Connaissance." },
    { step: 3, title: "Présentation des Impétrants", desc: "Chaque nouvel élève est appelé par son nom pour confirmer sa présence et son intention." },
    { step: 4, title: "Le Serment de l'Initié", desc: "Lecture collective du serment d'engagement envers les lois de la Prorascience.", oath: "Je jure de respecter les lois de la Nature et de l'Âme, de chercher la Vérité sans relâche et d'utiliser la Connaissance pour le Bien commun." },
    { step: 5, title: "Transmission Symbolique", desc: "Remise virtuelle des 4 attributs : Le Livre (Savoir), L'Épée (Discernement), La Lampe (Lumière), Le Manteau (Protection)." },
    { step: 6, title: "Accès aux Ressources", desc: "Déverrouillage officiel des accès à la plateforme et à la bibliothèque initiatique." },
    { step: 7, title: "Clôture Solennelle", desc: "Bénédiction finale et fermeture du cercle.", quote: "Allez en paix, porteurs de lumière." }
  ];

  return (
    <div className="min-h-screen bg-[#0F1419] font-serif pb-20 selection:bg-[#D4AF37]/30">
      <Helmet>
        <title>Cérémonie d'Initiation - Rentrée Solennelle | PRORASCIENCE ACADEMY</title>
      </Helmet>

      {/* Hero */}
      <section className="relative h-[60vh] w-full overflow-hidden flex items-center justify-center">
        <div className="absolute inset-0 z-0">
          <img 
            src="https://images.unsplash.com/photo-1560254532-937f0c90838f?q=80&w=2000&auto=format&fit=crop" 
            alt="Ceremony" 
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#0F1419]/40 via-[#0F1419]/70 to-[#0F1419]" />
        </div>
        
        <div className="relative z-10 text-center px-4">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1 }}
          >
            <Sparkles className="w-16 h-16 text-[#D4AF37] mx-auto mb-6 animate-pulse" />
            <h1 className="text-5xl md:text-7xl font-bold text-white mb-4 tracking-wider">INITIATION</h1>
            <p className="text-xl md:text-2xl text-[#D4AF37] tracking-[0.2em] uppercase">Cérémonie de Rentrée Solennelle</p>
          </motion.div>
        </div>
      </section>

      {/* Introduction */}
      <section className="max-w-4xl mx-auto px-6 py-16 text-center">
        <p className="text-xl text-gray-300 leading-relaxed italic border-l-4 border-[#D4AF37] pl-6 text-left">
          "L'initiation n'est pas une fin, mais un commencement. C'est le moment sacré où l'âme accepte consciemment de se mettre en marche vers sa propre lumière."
        </p>
        
        {/* Values Grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-16">
          {values.map((val, idx) => (
            <div key={idx} className="flex flex-col items-center p-4 bg-white/5 rounded-lg border border-white/5 hover:border-[#D4AF37]/50 transition-colors">
              <val.icon className="w-8 h-8 text-[#D4AF37] mb-3" />
              <h3 className="text-white font-bold text-sm mb-1">{val.title}</h3>
            </div>
          ))}
        </div>
      </section>

      {/* Phases Timeline */}
      <section className="max-w-5xl mx-auto px-6 py-16">
        <h2 className="text-3xl font-bold text-white text-center mb-16">Déroulement du Rituel</h2>
        
        <div className="space-y-12 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-[#D4AF37]/50 before:to-transparent">
          {phases.map((phase, idx) => (
            <div key={idx} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
              
              {/* Icon Marker */}
              <div className="flex items-center justify-center w-10 h-10 rounded-full border-2 border-[#D4AF37] bg-[#0F1419] text-[#D4AF37] shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10 font-bold">
                {phase.step}
              </div>
              
              {/* Content */}
              <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-6 bg-[#192734] rounded-xl border border-white/5 shadow-lg hover:border-[#D4AF37]/30 transition-all">
                <h3 className="text-xl font-bold text-[#D4AF37] mb-2">{phase.title}</h3>
                <p className="text-gray-300 text-sm mb-3">{phase.desc}</p>
                {phase.quote && (
                  <blockquote className="text-xs italic text-gray-400 border-l-2 border-white/20 pl-3">"{phase.quote}"</blockquote>
                )}
                {phase.oath && (
                  <div className="bg-black/30 p-3 rounded mt-2 border border-[#D4AF37]/10">
                    <p className="text-sm text-[#D4AF37] font-serif italic text-center">"{phase.oath}"</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Practical Info */}
      <section className="bg-[#192734] py-16 border-t border-white/10 mt-12">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-2xl font-bold text-white mb-8">Informations Pratiques</h2>
          
          <div className="grid md:grid-cols-3 gap-8 mb-10">
            <div className="p-6 bg-[#0F1419] rounded-xl border border-white/5">
              <Clock className="w-8 h-8 text-[#D4AF37] mx-auto mb-4" />
              <h4 className="text-white font-bold">Durée</h4>
              <p className="text-gray-400">60 - 90 minutes</p>
            </div>
            <div className="p-6 bg-[#0F1419] rounded-xl border border-white/5">
              <DollarSign className="w-8 h-8 text-[#D4AF37] mx-auto mb-4" />
              <h4 className="text-white font-bold">Participation</h4>
              <p className="text-gray-400">100€ (Inclus dans forfaits)</p>
            </div>
            <div className="p-6 bg-[#0F1419] rounded-xl border border-white/5">
              <Sparkles className="w-8 h-8 text-[#D4AF37] mx-auto mb-4" />
              <h4 className="text-white font-bold">Tenue</h4>
              <p className="text-gray-400">Blanc ou Sombre exigé</p>
            </div>
          </div>

          <Button className="bg-[#D4AF37] text-black hover:bg-[#b5952f] px-8 py-6 text-lg font-bold rounded-full shadow-[0_0_20px_rgba(212,175,55,0.3)] hover:shadow-[0_0_30px_rgba(212,175,55,0.5)] transition-all">
            Confirmer ma Présence
          </Button>
          <p className="text-sm text-gray-500 mt-4">La présence est obligatoire pour valider l'inscription administrative.</p>
        </div>
      </section>
    </div>
  );
};

export default InitiationCeremonyPage;