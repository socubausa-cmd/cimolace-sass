import React from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Map, Layers, Award } from 'lucide-react';

const HowItWorksPage = () => {
  return (
    <div className="min-h-screen bg-[#0F1419] py-20 px-4">
      <Helmet><title>Fonctionnement - PRORASCIENCE</title></Helmet>
      
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-serif font-bold text-white mb-6">Fonctionnement de l'École</h1>
          <p className="text-xl text-gray-400">Une structure académique rigoureuse pensée pour votre élévation.</p>
        </div>

        <div className="space-y-12">
          {/* Section 1 */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white/5 border border-white/10 rounded-2xl p-8 md:p-12 flex flex-col md:flex-row gap-8 items-start"
          >
            <div className="w-16 h-16 bg-blue-500/20 rounded-xl flex items-center justify-center flex-shrink-0 text-blue-400">
              <Map className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-2xl font-serif font-bold text-white mb-4">Parcours & Orientation</h2>
              <p className="text-gray-300 leading-relaxed mb-4">
                Dès votre arrivée, vous êtes guidé par notre secrétariat vers le cycle correspondant à votre niveau. 
                Chaque élève dispose d'un suivi personnalisé et d'un accès aux ressources adaptées.
              </p>
            </div>
          </motion.div>

          {/* Section 2 */}
          <motion.div 
             initial={{ opacity: 0, y: 20 }}
             animate={{ opacity: 1, y: 0 }}
             transition={{ delay: 0.1 }}
             className="bg-white/5 border border-white/10 rounded-2xl p-8 md:p-12 flex flex-col md:flex-row gap-8 items-start"
          >
            <div className="w-16 h-16 bg-yellow-500/20 rounded-xl flex items-center justify-center flex-shrink-0 text-yellow-400">
              <Layers className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-2xl font-serif font-bold text-white mb-4">Les 3 Cycles</h2>
              <p className="text-gray-300 leading-relaxed mb-6">
                L'enseignement est structuré en trois niveaux progressifs :
              </p>
              <ul className="space-y-3">
                <li className="flex items-center text-gray-300">
                  <span className="w-2 h-2 bg-yellow-500 rounded-full mr-3"></span>
                  <span className="font-bold text-white mr-2">Disciple :</span> Acquisition des bases fondamentales.
                </li>
                <li className="flex items-center text-gray-300">
                  <span className="w-2 h-2 bg-yellow-500 rounded-full mr-3"></span>
                  <span className="font-bold text-white mr-2">Initié :</span> Pratique et approfondissement technique.
                </li>
                <li className="flex items-center text-gray-300">
                  <span className="w-2 h-2 bg-yellow-500 rounded-full mr-3"></span>
                  <span className="font-bold text-white mr-2">Maître :</span> Expertise et capacité de transmission.
                </li>
              </ul>
            </div>
          </motion.div>

          {/* Section 3 */}
          <motion.div 
             initial={{ opacity: 0, y: 20 }}
             animate={{ opacity: 1, y: 0 }}
             transition={{ delay: 0.2 }}
             className="bg-white/5 border border-white/10 rounded-2xl p-8 md:p-12 flex flex-col md:flex-row gap-8 items-start"
          >
            <div className="w-16 h-16 bg-purple-500/20 rounded-xl flex items-center justify-center flex-shrink-0 text-purple-400">
              <Award className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-2xl font-serif font-bold text-white mb-4">Certification & Examens</h2>
              <p className="text-gray-300 leading-relaxed mb-4">
                Le passage d'un cycle à l'autre est conditionné par la réussite aux examens. 
                L'académie délivre des certificats reconnus au sein de notre réseau, attestant de votre niveau réel de compétence.
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default HowItWorksPage;