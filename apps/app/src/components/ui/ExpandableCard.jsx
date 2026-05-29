import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';

const ExpandableCard = ({ title, children, icon: Icon, className = "", defaultExpanded = false }) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <div className={`bg-[#192734] border border-white/5 rounded-xl overflow-hidden shadow-lg transition-all duration-300 hover:border-white/20 ${className}`}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-6 text-left focus:outline-none"
      >
        <div className="flex items-center gap-4">
          {Icon && (
            <div className="p-3 bg-[#D4AF37]/10 rounded-lg text-[#D4AF37]">
              <Icon className="w-6 h-6" />
            </div>
          )}
          <h3 className="text-xl font-serif font-bold text-white">{title}</h3>
        </div>
        <ChevronDown 
          className={`w-6 h-6 text-gray-400 transition-transform duration-300 ${isExpanded ? 'rotate-180 text-[#D4AF37]' : ''}`} 
        />
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="px-6 pb-6 pt-0 border-t border-white/5 mt-2">
              <div className="pt-4 text-gray-300">
                {children}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ExpandableCard;