import React from 'react';
import { Helmet } from 'react-helmet';
import { Target, Award, Users } from 'lucide-react';

const AboutPage = () => {
  return (
    <div className="min-h-screen bg-[#0F1419] text-white pt-24 pb-20">
      <Helmet><title>À Propos | PRORASCIENCE</title></Helmet>

      {/* Hero */}
      <section className="text-center max-w-4xl mx-auto px-6 mb-20">
         <h1 className="text-4xl md:text-6xl font-serif font-bold mb-6">L'Excellence Spirituelle</h1>
         <p className="text-xl text-gray-400 leading-relaxed">
            PRORASCIENCE ACADEMY n'est pas seulement une école, c\'est un sanctuaire de connaissance dédié à la réconciliation entre la science et le sacré.
         </p>
      </section>

      {/* Mission */}
      <section className="bg-[#192734] py-16 mb-20 border-y border-white/5">
         <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-3 gap-12">
            {[
               { icon: Target, title: "Notre Mission", txt: "Former des initiés capables de comprendre les lois universelles avec rigueur scientifique." },
               { icon: Award, title: "Nos Valeurs", txt: "Excellence, Intégrité, Tradition et Innovation sont les piliers de notre enseignement." },
               { icon: Users, title: "Communauté", txt: "Un réseau mondial d'étudiants et de chercheurs unis par la quête de vérité." }
            ].map((item, i) => (
               <div key={i} className="text-center">
                  <div className="w-16 h-16 bg-[color-mix(in_srgb,var(--school-accent)_10%,transparent)] rounded-full flex items-center justify-center mx-auto mb-6 text-[var(--school-accent)]">
                     <item.icon className="w-8 h-8"/>
                  </div>
                  <h3 className="text-xl font-bold mb-4">{item.title}</h3>
                  <p className="text-gray-400">{item.txt}</p>
               </div>
            ))}
         </div>
      </section>

      {/* History */}
      <section className="max-w-4xl mx-auto px-6">
         <h2 className="text-3xl font-serif font-bold mb-8 text-center">Notre Histoire</h2>
         <div className="space-y-8 relative border-l-2 border-[color-mix(in_srgb,var(--school-accent)_20%,transparent)] pl-8 ml-4 md:ml-0">
            {[
               { year: "2018", title: "La Fondation", txt: "Création de l'ordre par un cercle de chercheurs passionnés par l'hermétisme." },
               { year: "2020", title: "L'Académie En Ligne", txt: "Lancement de la plateforme numérique pour rendre le savoir accessible mondialement." },
               { year: "2023", title: "Reconnaissance", txt: "Plus de 5000 étudiants formés et une reconnaissance internationale dans les cercles ésotériques." }
            ].map((ev, i) => (
               <div key={i} className="relative">
                  <div className="absolute -left-[41px] top-1 w-5 h-5 rounded-full bg-[#0F1419] border-2 border-[var(--school-accent)]"></div>
                  <span className="text-[var(--school-accent)] font-bold text-lg mb-1 block">{ev.year}</span>
                  <h3 className="text-xl font-bold text-white mb-2">{ev.title}</h3>
                  <p className="text-gray-400">{ev.txt}</p>
               </div>
            ))}
         </div>
      </section>
    </div>
  );
};

export default AboutPage;