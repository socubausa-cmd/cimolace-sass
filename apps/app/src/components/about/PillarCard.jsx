import React from 'react';
import { motion } from 'framer-motion';

const PillarCard = ({ icon: Icon, title, points, index }) => (
  <motion.div 
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    transition={{ delay: index * 0.1 }}
    className="bg-[#192734] border border-white/5 p-6 rounded-xl hover:border-[color-mix(in_srgb,var(--school-accent)_30%,transparent)] hover:shadow-lg hover:shadow-[color-mix(in_srgb,var(--school-accent)_5%,transparent)] transition-all duration-300 h-full flex flex-col group"
  >
    <div className="w-14 h-14 bg-gradient-to-br from-[#15202B] to-black rounded-full border border-[color-mix(in_srgb,var(--school-accent)_20%,transparent)] flex items-center justify-center mb-6 shadow-inner group-hover:border-[color-mix(in_srgb,var(--school-accent)_50%,transparent)] transition-colors">
      <Icon className="w-7 h-7 text-[var(--school-accent)]" />
    </div>
    <h3 className="text-xl font-bold text-white mb-4">{title}</h3>
    <ul className="space-y-3 mt-auto">
      {points.map((point, i) => (
        <li key={i} className="flex items-start gap-3 text-sm text-gray-400">
          <div className="w-1.5 h-1.5 rounded-full bg-[var(--school-accent)] mt-1.5 flex-shrink-0" />
          <span>{point}</span>
        </li>
      ))}
    </ul>
  </motion.div>
);

export default PillarCard;