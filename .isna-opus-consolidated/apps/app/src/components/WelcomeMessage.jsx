import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { isnaTenantConfig } from '@/tenants/isna/tenant.config';

const WelcomeMessage = ({ name }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="bg-gradient-to-r from-purple-600/20 to-pink-600/20 rounded-xl p-6 border border-white/10 shadow-lg mb-8 flex items-center space-x-4"
    >
      <Sparkles className="h-8 w-8 text-yellow-400 animate-pulse" />
      <div>
        <h1 className="text-3xl font-bold text-white">Bienvenue, {name || 'Chercheur'} !</h1>
        <p className="text-gray-300">{`Prêt à explorer les contenus ${isnaTenantConfig.branding.name} ?`}</p>
      </div>
    </motion.div>
  );
};

export default WelcomeMessage;