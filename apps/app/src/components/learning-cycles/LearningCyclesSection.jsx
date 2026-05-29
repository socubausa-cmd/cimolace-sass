import React from 'react';
import { motion } from 'framer-motion';
import { learningCyclesData } from '@/lib/learningCyclesData';
import CycleCard from './CycleCard';

const LearningCyclesSection = () => {
  return (
    <section className="py-16 md:py-24 relative overflow-hidden">
      {/* Background Ambience */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full max-w-7xl mx-auto opacity-30 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-900/20 rounded-full blur-[100px]" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-900/20 rounded-full blur-[100px]" />
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
              Choisissez votre <span className="text-[#D4AF37]">Parcours d'Apprentissage</span>
            </h2>
            <p className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto font-light">
              Adaptez votre formation à vos objectifs personnels et professionnels.
              <br className="hidden md:block"/> Du simple éveil à la maîtrise totale.
            </p>
          </motion.div>
        </div>

        {/* Cycles Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6 items-stretch justify-center">
          {learningCyclesData.map((cycle, index) => (
            <CycleCard key={cycle.id} cycle={cycle} index={index} />
          ))}
        </div>

      </div>
    </section>
  );
};

export default LearningCyclesSection;