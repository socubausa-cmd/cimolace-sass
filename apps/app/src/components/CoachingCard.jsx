import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2 } from 'lucide-react';

const CoachingCard = ({ icon: Icon, title, points }) => {
  return (
    <motion.div 
      variants={{
        hidden: { y: 20, opacity: 0 },
        visible: { y: 0, opacity: 1 }
      }}
      className="bg-[#192734] p-6 rounded-xl border border-white/5 hover:border-[color-mix(in_srgb,var(--school-accent)_30%,transparent)] shadow-lg hover:shadow-2xl hover:shadow-purple-500/10 transition-all duration-300 group hover:-translate-y-2 h-full flex flex-col"
    >
      <div className="w-14 h-14 bg-gradient-to-br from-purple-900/30 to-blue-900/30 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-[var(--school-accent)] transition-colors duration-300 shadow-inner border border-white/10">
        <Icon className="w-7 h-7 text-[var(--school-accent)] group-hover:text-black transition-colors duration-300" />
      </div>
      
      <h3 className="text-xl font-bold text-white mb-4 group-hover:text-[var(--school-accent)] transition-colors">{title}</h3>
      
      <div className="space-y-3 flex-grow">
        {points.map((point, idx) => (
          <div key={idx} className="flex items-start gap-3">
            <CheckCircle2 className="w-4 h-4 text-purple-400 mt-1 shrink-0 group-hover:text-[var(--school-accent)] transition-colors" />
            <p className="text-sm text-gray-400 group-hover:text-gray-300 transition-colors leading-relaxed">
              {point}
            </p>
          </div>
        ))}
      </div>
      
      {/* Decor element */}
      <div className="w-12 h-1 bg-gradient-to-r from-purple-500 to-transparent mt-6 rounded-full group-hover:w-full transition-all duration-500"></div>
    </motion.div>
  );
};

export default CoachingCard;