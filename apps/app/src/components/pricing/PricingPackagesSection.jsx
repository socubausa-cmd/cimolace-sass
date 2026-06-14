import React from 'react';
import { motion } from 'framer-motion';
import { learningCyclesData } from '@/lib/learningCyclesData';
import PricingPackageCard from './PricingPackageCard';

const PricingPackagesSection = () => {
  return (
    <section className="py-16 md:py-24 relative overflow-hidden bg-[#0F1419]">
      {/* Background Ambience */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full max-w-7xl mx-auto opacity-30 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-blue-900/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-purple-900/10 rounded-full blur-[120px]" />
      </div>

      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Section Header */}
        <div className="text-center mb-16 space-y-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            <h2 className="text-3xl md:text-5xl font-serif font-bold text-white mb-4">
              Nos Formules <span className="text-[var(--school-accent)]">Prorascience</span>
            </h2>
            <p className="text-lg md:text-xl text-gray-400 max-w-3xl mx-auto font-light leading-relaxed">
              De l'initiation théorique à la maîtrise opérative complète.
              <br className="hidden md:block"/> Sélectionnez le niveau d'engagement qui correspond à votre quête.
            </p>
          </motion.div>
        </div>

        {/* Packages Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6 items-stretch justify-center">
          {learningCyclesData.map((pkg, index) => (
            <PricingPackageCard key={pkg.id} pkg={pkg} index={index} />
          ))}
        </div>

        {/* Bottom Note */}
        <div className="mt-12 text-center">
           <p className="text-sm text-gray-500">
              * Les tarifs sont indiqués en Euros TTC. Les inscriptions sont soumises à validation par l'équipe pédagogique pour les cycles avancés.
           </p>
        </div>

      </div>
    </section>
  );
};

export default PricingPackagesSection;