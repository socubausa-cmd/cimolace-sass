import React from 'react';
import { motion } from 'framer-motion';

const PillarCard = ({ icon: Icon, title, points, index }) => (
  <motion.div 
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    transition={{ delay: index * 0.1 }}
    className="bg-[#192734] border border-white/5 p-6 rounded-xl hover:border-[#D4AF37]/30 hover:shadow-lg hover:shadow-[#D4AF37]/5 transition-all duration-300 h-full flex flex-col group"
  >
    <div className="w-14 h-14 bg-gradient-to-br from-[#15202B] to-black rounded-full border border-[#D4AF37]/20 flex items-center justify-center mb-6 shadow-inner group-hover:border-[#D4AF37]/50 transition-colors">
      <Icon className="w-7 h-7 text-[#D4AF37]" />
    </div>
    <h3 className="text-xl font-bold text-white mb-4">{title}</h3>
    <ul className="space-y-3 mt-auto">
      {points.map((point, i) => (
        <li key={i} className="flex items-start gap-3 text-sm text-gray-400">
          <div className="w-1.5 h-1.5 rounded-full bg-[#D4AF37] mt-1.5 flex-shrink-0" />
          <span>{point}</span>
        </li>
      ))}
    </ul>
  </motion.div>
);

export default PillarCard;