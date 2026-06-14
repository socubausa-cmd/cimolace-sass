import React, { useState } from 'react';
import Header from '@/components/Header';
import { Video, BookOpen, GraduationCap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import LiveClassesSection from '@/components/school/classroom/LiveClassesSection';
import ProgressiveLearningSectionComponent from '@/components/school/classroom/ProgressiveLearningSectionComponent';

const GoToClassPage = () => {
  const [activeMode, setActiveMode] = useState(null); // 'live' | 'progressive' | null

  return (
    <div className="min-h-screen bg-[#0F1419] flex flex-col">
       <main className="flex-grow pt-8 pb-16 px-4 md:px-8 max-w-7xl mx-auto w-full text-white">
          
          {/* Header Section */}
          <div className="text-center mb-12 space-y-4 pt-10">
             <div className="inline-flex items-center justify-center p-3 rounded-full bg-[color-mix(in_srgb,var(--school-accent)_10%,transparent)] mb-4 ring-1 ring-[color-mix(in_srgb,var(--school-accent)_30%,transparent)]">
                <GraduationCap className="w-8 h-8 text-[var(--school-accent)]" />
             </div>
             <h1 className="text-4xl md:text-5xl font-serif font-bold bg-clip-text text-transparent bg-gradient-to-r from-white via-gray-200 to-gray-400">
                Aller en classe
             </h1>
             <p className="text-lg text-gray-400 max-w-2xl mx-auto">
                Choisissez votre mode d'apprentissage aujourd\'hui. Rejoignez un cours en direct pour l\'interaction ou progressez à votre rythme.
             </p>
          </div>

          {/* Selection Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
             {/* Live Class Card */}
             <motion.div 
                whileHover={{ scale: 1.02, translateY: -5 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setActiveMode(activeMode === 'live' ? null : 'live')}
                className={`relative group cursor-pointer overflow-hidden rounded-2xl border transition-all duration-300 ${
                   activeMode === 'live' 
                      ? 'border-[var(--school-accent)] ring-2 ring-[color-mix(in_srgb,var(--school-accent)_20%,transparent)] bg-[#192734]' 
                      : 'border-white/10 bg-[#192734]/50 hover:bg-[#192734] hover:border-[color-mix(in_srgb,var(--school-accent)_50%,transparent)]'
                }`}
             >
                <div className="absolute inset-0 bg-gradient-to-br from-red-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <div className="p-8 flex flex-col items-center text-center relative z-10">
                   <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-6 transition-colors duration-300 ${
                      activeMode === 'live' ? 'bg-red-500 text-white shadow-lg shadow-red-500/30' : 'bg-[#0F1419] text-gray-400 group-hover:text-red-500 border border-white/10'
                   }`}>
                      <Video className="w-10 h-10" />
                   </div>
                   <h2 className="text-2xl font-bold mb-3 text-white group-hover:text-red-400 transition-colors">Cours en Direct</h2>
                   <p className="text-gray-400 text-sm leading-relaxed">
                      Rejoignez des sessions interactives avec vos professeurs et camarades. Posez vos questions en temps réel.
                   </p>
                   {activeMode === 'live' && (
                      <motion.div layoutId="underline" className="w-12 h-1 bg-red-500 rounded-full mt-6" />
                   )}
                </div>
             </motion.div>

             {/* Progressive Learning Card */}
             <motion.div 
                whileHover={{ scale: 1.02, translateY: -5 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setActiveMode(activeMode === 'progressive' ? null : 'progressive')}
                className={`relative group cursor-pointer overflow-hidden rounded-2xl border transition-all duration-300 ${
                   activeMode === 'progressive' 
                      ? 'border-[var(--school-accent)] ring-2 ring-[color-mix(in_srgb,var(--school-accent)_20%,transparent)] bg-[#192734]' 
                      : 'border-white/10 bg-[#192734]/50 hover:bg-[#192734] hover:border-[color-mix(in_srgb,var(--school-accent)_50%,transparent)]'
                }`}
             >
                <div className="absolute inset-0 bg-gradient-to-br from-[color-mix(in_srgb,var(--school-accent)_10%,transparent)] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <div className="p-8 flex flex-col items-center text-center relative z-10">
                   <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-6 transition-colors duration-300 ${
                      activeMode === 'progressive' ? 'bg-[var(--school-accent)] text-black shadow-lg shadow-[color-mix(in_srgb,var(--school-accent)_30%,transparent)]' : 'bg-[#0F1419] text-gray-400 group-hover:text-[var(--school-accent)] border border-white/10'
                   }`}>
                      <BookOpen className="w-10 h-10" />
                   </div>
                   <h2 className="text-2xl font-bold mb-3 text-white group-hover:text-[var(--school-accent)] transition-colors">Apprentissage Progressif</h2>
                   <p className="text-gray-400 text-sm leading-relaxed">
                      Suivez votre parcours étape par étape. Modules structurés, vidéos à la demande et exercices pratiques.
                   </p>
                   {activeMode === 'progressive' && (
                      <motion.div layoutId="underline" className="w-12 h-1 bg-[var(--school-accent)] rounded-full mt-6" />
                   )}
                </div>
             </motion.div>
          </div>

          {/* Content Area */}
          <AnimatePresence mode="wait">
             {activeMode === 'live' && (
                <motion.div 
                   key="live"
                   initial={{ opacity: 0, y: 20 }}
                   animate={{ opacity: 1, y: 0 }}
                   exit={{ opacity: 0, y: -20 }}
                   transition={{ duration: 0.4 }}
                >
                   <div className="flex items-center gap-3 mb-6">
                      <div className="h-px bg-white/10 flex-grow"></div>
                      <span className="text-red-400 font-bold uppercase tracking-widest text-sm">Session Live</span>
                      <div className="h-px bg-white/10 flex-grow"></div>
                   </div>
                   <LiveClassesSection />
                </motion.div>
             )}

             {activeMode === 'progressive' && (
                <motion.div 
                   key="progressive"
                   initial={{ opacity: 0, y: 20 }}
                   animate={{ opacity: 1, y: 0 }}
                   exit={{ opacity: 0, y: -20 }}
                   transition={{ duration: 0.4 }}
                >
                   <div className="flex items-center gap-3 mb-6">
                      <div className="h-px bg-white/10 flex-grow"></div>
                      <span className="text-[var(--school-accent)] font-bold uppercase tracking-widest text-sm">Parcours Académique</span>
                      <div className="h-px bg-white/10 flex-grow"></div>
                   </div>
                   <ProgressiveLearningSectionComponent />
                </motion.div>
             )}
          </AnimatePresence>

       </main>
    </div>
  );
};

export default GoToClassPage;