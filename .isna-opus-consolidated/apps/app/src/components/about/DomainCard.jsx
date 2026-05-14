import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, BookOpen, Microscope, Zap } from 'lucide-react';

const DomainCard = ({ title, definition, study, application, index }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.05 }}
      className={`bg-[#192734] border rounded-xl overflow-hidden transition-all duration-300 ${isOpen ? 'border-[#D4AF37]/30 shadow-lg shadow-[#D4AF37]/5' : 'border-white/5 hover:border-[#D4AF37]/20'}`}
    >
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-5 bg-gradient-to-r from-[#192734] to-[#15202B] hover:bg-[#1e2f3f] transition-colors"
      >
        <span className={`font-bold text-lg text-left transition-colors ${isOpen ? 'text-[#D4AF37]' : 'text-white'}`}>{title}</span>
        <ChevronDown className={`w-5 h-5 text-[#D4AF37] transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-white/5 bg-black/20"
          >
            <div className="p-5 space-y-4 text-sm">
              <div className="flex gap-3">
                <div className="mt-0.5 min-w-[20px]"><BookOpen className="w-4 h-4 text-blue-400" /></div>
                <div>
                  <span className="text-blue-400 font-bold block text-xs uppercase mb-1">Définition</span>
                  <p className="text-gray-300 leading-relaxed">{definition}</p>
                </div>
              </div>
              <div className="flex gap-3">
                 <div className="mt-0.5 min-w-[20px]"><Microscope className="w-4 h-4 text-purple-400" /></div>
                <div>
                  <span className="text-purple-400 font-bold block text-xs uppercase mb-1">Objet d'étude</span>
                  <p className="text-gray-300 leading-relaxed">{study}</p>
                </div>
              </div>
              <div className="flex gap-3">
                 <div className="mt-0.5 min-w-[20px]"><Zap className="w-4 h-4 text-[#D4AF37]" /></div>
                <div>
                  <span className="text-[#D4AF37] font-bold block text-xs uppercase mb-1">Application</span>
                  <p className="text-gray-300 leading-relaxed">{application}</p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default DomainCard;