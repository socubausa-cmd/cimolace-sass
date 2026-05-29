import React from 'react';
import { motion } from 'framer-motion';

const ProraComparisonTable = () => {
  const data = [
    { criteria: "Source de Vérité", prora: "Expérience vérifiable", religion: "Révélation divine", esoterism: "Secret initiatique", dogma: "Autorité établie" },
    { criteria: "Méthode", prora: "Scientifique (Hypothèse/Preuve)", religion: "Foi / Croyance", esoterism: "Symbolisme / Analogie", dogma: "Obéissance" },
    { criteria: "But", prora: "Connaissance & Maîtrise", religion: "Salut de l'âme", esoterism: "Élévation personnelle", dogma: "Conformité" },
    { criteria: "Rapport au Doute", prora: "Encouragé (Moteur)", religion: "Découragé (Péché)", esoterism: "Canalisé", dogma: "Interdit" },
    { criteria: "Transmission", prora: "Pédagogique & Claire", religion: "Catéchétique", esoterism: "Symbolique & Voilée", dogma: "Impositive" },
  ];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="overflow-x-auto rounded-xl border border-white/10 shadow-2xl bg-[#0F1419]"
    >
      <table className="w-full text-sm text-left">
        <thead className="text-xs uppercase bg-[#15202B] text-gray-400 border-b border-white/10">
          <tr>
            <th className="px-6 py-5 font-bold tracking-wider">Critère</th>
            <th className="px-6 py-5 text-[#D4AF37] bg-[#D4AF37]/10 font-bold tracking-wider border-b-2 border-[#D4AF37] min-w-[150px]">PRORASCIENCE</th>
            <th className="px-6 py-5 font-bold tracking-wider min-w-[120px]">Religion</th>
            <th className="px-6 py-5 font-bold tracking-wider min-w-[120px]">Ésotérisme</th>
            <th className="px-6 py-5 font-bold tracking-wider min-w-[120px]">Dogme</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {data.map((row, index) => (
            <tr key={index} className="bg-[#192734] hover:bg-white/5 transition-colors">
              <td className="px-6 py-4 font-medium text-white border-r border-white/5">{row.criteria}</td>
              <td className="px-6 py-4 text-[#D4AF37] font-bold bg-[#D4AF37]/5 border-r border-white/5 shadow-[inset_0_0_10px_rgba(212,175,55,0.05)]">{row.prora}</td>
              <td className="px-6 py-4 text-gray-400 border-r border-white/5">{row.religion}</td>
              <td className="px-6 py-4 text-gray-400 border-r border-white/5">{row.esoterism}</td>
              <td className="px-6 py-4 text-gray-400">{row.dogma}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </motion.div>
  );
};

export default ProraComparisonTable;