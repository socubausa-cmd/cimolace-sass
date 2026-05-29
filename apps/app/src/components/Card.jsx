import React from 'react';
import { motion } from 'framer-motion';

const Card = ({ children, className = '', hover = true }) => {
  return (
    <motion.div
      whileHover={hover ? { scale: 1.02 } : {}}
      transition={{ duration: 0.2 }}
      className={`
        bg-white/5 backdrop-blur-lg 
        border border-white/10 
        rounded-2xl 
        p-6 
        shadow-lg 
        hover:shadow-2xl hover:shadow-purple-500/20
        hover:border-purple-500/50
        transition-all duration-300
        ${className}
      `}
    >
      {children}
    </motion.div>
  );
};

export default Card;