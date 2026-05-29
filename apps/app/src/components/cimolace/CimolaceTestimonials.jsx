import React from 'react';
import { motion } from 'framer-motion';
import { TestimonialsColumn } from '@/components/ui/testimonials-columns';
import { Star } from 'lucide-react';
import AnimatedTextCycle from '@/components/ui/animated-text-cycle';

const testimonials = [
  {
    text: "CIMOLACE a transformé ma boutique en ligne. En 3 semaines, j'avais automatisé mes commandes, mes paiements Mobile Money et mes relances clients.",
    image: "https://randomuser.me/api/portraits/women/44.jpg",
    name: "Amina Diallo",
    role: "Fondatrice — Boutique Mode, Dakar",
  },
  {
    text: "Grâce à LIRI EDU Core, j'ai lancé ma première formation en ligne en moins de 48h. Le module crée les cours, les exercices et les certifications automatiquement.",
    image: "https://randomuser.me/api/portraits/men/32.jpg",
    name: "Kofi Mensah",
    role: "Formateur — Accra, Ghana",
  },
  {
    text: "Payflow Africa m'a permis de recevoir des paiements depuis 4 pays africains différents. Plus besoin de courir après les virements.",
    image: "https://randomuser.me/api/portraits/women/68.jpg",
    name: "Fatou Coulibaly",
    role: "CEO — AgriTech Solutions, Abidjan",
  },
  {
    text: "Le LIRI Live Engine a révolutionné mes cultes en ligne. Mes fidèles peuvent prier en temps réel depuis 12 pays. C'est miraculeux.",
    image: "https://randomuser.me/api/portraits/men/55.jpg",
    name: "Pasteur Emeka Obi",
    role: "Fondateur — Lagos Gospel Center",
  },
  {
    text: "LIRI Agents System tourne pendant que je dors. Il gère mes relances, envoie mes offres et suit mes clients. Mon CA a doublé en 2 mois.",
    image: "https://randomuser.me/api/portraits/women/23.jpg",
    name: "Aïssatou Bah",
    role: "Entrepreneur — Conakry, Guinée",
  },
  {
    text: "L'intégration de Smart Logistics a divisé mes coûts de livraison par deux. L'IA calcule automatiquement les meilleurs emballages.",
    image: "https://randomuser.me/api/portraits/men/71.jpg",
    name: "Jean-Paul Nkosi",
    role: "Directeur Logistique — Kinshasa",
  },
  {
    text: "Ce qui m'a le plus frappé, c'est que tout est pensé pour l'Afrique. Le Mobile Money, les langues, la réalité du terrain. Enfin une vraie solution.",
    image: "https://randomuser.me/api/portraits/women/12.jpg",
    name: "Nadia El Fassi",
    role: "Directrice Marketing — Casablanca",
  },
  {
    text: "LIRI Designer a créé toutes mes affiches d'événement en quelques minutes. Une qualité professionnelle que je ne pouvais pas me permettre avant.",
    image: "https://randomuser.me/api/portraits/men/43.jpg",
    name: "Thierno Baldé",
    role: "Organisateur d'événements — Bamako",
  },
  {
    text: "L'accompagnement de l'équipe CIMOLACE est exceptionnel. En 24h on était opérationnels. C'est ça l'infrastructure africaine dont on avait besoin.",
    image: "https://randomuser.me/api/portraits/women/57.jpg",
    name: "Cynthia Mwamba",
    role: "Co-fondatrice — EdTech startup, Nairobi",
  },
];

const firstColumn  = testimonials.slice(0, 3);
const secondColumn = testimonials.slice(3, 6);
const thirdColumn  = testimonials.slice(6, 9);

const CimolaceTestimonials = () => {
  return (
    <section className="relative bg-[#0a0a0f] py-24 overflow-hidden">
      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-violet-600/5 blur-[120px]" />
        <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-violet-500/40 to-transparent" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-12">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          viewport={{ once: true }}
          className="flex flex-col items-center text-center max-w-[560px] mx-auto mb-16"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-violet-500/30 bg-violet-500/10 text-xs text-violet-300 tracking-widest uppercase mb-5">
            <Star className="w-3 h-3 fill-violet-400 text-violet-400" />
            Témoignages
          </div>

          <h2 className="text-4xl lg:text-5xl font-black tracking-tight text-white mb-4">
            Ils ont bâti leur{' '}
            <span className="bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent inline-flex items-baseline gap-2 flex-wrap justify-center">
              <AnimatedTextCycle
                words={['empire', 'boutique', 'formation', 'communauté', 'business', 'écosystème']}
                interval={2600}
                className="bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent"
              />
              {' '}avec CIMOLACE
            </span>
          </h2>
          <p className="text-gray-400 text-lg leading-relaxed">
            Des entrepreneurs africains qui ont transformé leur business grâce à notre infrastructure IA.
          </p>
        </motion.div>

        {/* Scrolling columns — mask fade top/bottom */}
        <div className="flex justify-center gap-6 [mask-image:linear-gradient(to_bottom,transparent,black_20%,black_80%,transparent)] max-h-[740px] overflow-hidden">
          <TestimonialsColumn
            testimonials={firstColumn}
            duration={18}
          />
          <TestimonialsColumn
            testimonials={secondColumn}
            duration={22}
            className="hidden md:block"
          />
          <TestimonialsColumn
            testimonials={thirdColumn}
            duration={20}
            className="hidden lg:block"
          />
        </div>

        {/* Bottom CTA */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="text-center mt-14"
        >
          <p className="text-sm text-gray-500 mb-4">
            Rejoignez +2 500 entrepreneurs qui font confiance à CIMOLACE
          </p>
          <a
            href="#pricing"
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-violet-500 to-cyan-500 text-white text-sm font-bold rounded-xl hover:opacity-90 transition-opacity"
          >
            Rejoindre l'écosystème →
          </a>
        </motion.div>
      </div>
    </section>
  );
};

export default CimolaceTestimonials;
