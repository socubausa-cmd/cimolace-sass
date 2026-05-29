import React from 'react';
import { motion } from 'framer-motion';

const ProraScienceDefinitionBox = ({ title, children, icon: Icon, className = "" }) => (
  <motion.div 
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    className={`relative p-[2px] rounded-xl bg-gradient-to-r from-[#D4AF37] via-[#F2D06B] to-[#D4AF37] shadow-xl ${className}`}
  >
    <div className="bg-[#0F1419] p-8 rounded-[10px] h-full relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-[#D4AF37]/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
      {Icon && (
        <div className="mb-6 inline-flex items-center justify-center p-3 rounded-full bg-[#D4AF37]/10 text-[#D4AF37]">
          <Icon className="w-8 h-8" />
        </div>
      )}
      {title && <h3 className="text-2xl font-serif font-bold text-white mb-4">{title}</h3>}
      <div className="text-lg text-gray-300 leading-relaxed relative z-10">
        {children}
      </div>
    </div>
  </motion.div>
);

export default ProraScienceDefinitionBox;