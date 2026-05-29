import React from 'react';
import { motion } from 'framer-motion';
import { Check, X, Minus } from 'lucide-react';

export const FiveModelsTable = () => {
  const models = [
    {
      name: "Modèle Standard",
      founders: "Einstein, Bohr, Heisenberg",
      object: "Matière / Énergie (Visible)",
      approach: "Physique Quantique & Relativité",
      limits: "N'explique pas 95% de l'univers (Matière noire)",
      status: "Académique (Dominant)"
    },
    {
      name: "Modèle Inflationnaire",
      founders: "Alan Guth, Andrei Linde",
      object: "Expansion de l'univers",
      approach: "Champs scalaires",
      limits: "Spéculatif sur l'origine exacte (Big Bang)",
      status: "Académique (Accepté)"
    },
    {
      name: "Modèle Janus",
      founders: "Jean-Pierre Petit",
      object: "Univers Jumeaux (Matière/Antimatière)",
      approach: "Géométrique & Gravitationnelle",
      limits: "Rejeté par l'académie (Polémique)",
      status: "Alternatif (Robuste)"
    },
    {
      name: "Modèles Informationnels",
      founders: "Vlatko Vedral, Erik Verlinde",
      object: "Information (Bit quantique)",
      approach: "Univers holographique",
      limits: "Très abstrait / Mathématique",
      status: "Émergent"
    },
    {
      name: "PRORASCIENCE",
      founders: "Prof. Kimbembe",
      object: "L'Être (Conscience + Énergie)",
      approach: "Ontologique & Cosmologique",
      limits: "Demande un changement de paradigme",
      status: "Nouvelle Science Africaine"
    }
  ];

  return (
    <div className="overflow-x-auto rounded-xl border border-white/10 shadow-2xl bg-[#0F1419] my-8">
      <table className="w-full text-sm text-left min-w-[800px]">
        <thead className="text-xs uppercase bg-[#15202B] text-gray-400 border-b border-white/10">
          <tr>
            <th className="px-6 py-4 font-bold tracking-wider">Modèle</th>
            <th className="px-6 py-4 font-bold tracking-wider">Fondateurs Clés</th>
            <th className="px-6 py-4 font-bold tracking-wider">Objet Central</th>
            <th className="px-6 py-4 font-bold tracking-wider">Approche</th>
            <th className="px-6 py-4 font-bold tracking-wider">Limites / Manques</th>
            <th className="px-6 py-4 font-bold tracking-wider">Statut</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {models.map((row, index) => (
            <tr key={index} className={`hover:bg-white/5 transition-colors ${row.name === "PRORASCIENCE" ? "bg-[#D4AF37]/5" : "bg-[#192734]"}`}>
              <td className={`px-6 py-4 font-bold border-r border-white/5 ${row.name === "PRORASCIENCE" ? "text-[#D4AF37]" : "text-white"}`}>
                {row.name}
              </td>
              <td className="px-6 py-4 text-gray-300 border-r border-white/5">{row.founders}</td>
              <td className="px-6 py-4 text-gray-300 border-r border-white/5">{row.object}</td>
              <td className="px-6 py-4 text-gray-300 border-r border-white/5">{row.approach}</td>
              <td className="px-6 py-4 text-gray-400 border-r border-white/5 italic">{row.limits}</td>
              <td className="px-6 py-4 text-gray-300">
                <span className={`px-2 py-1 rounded text-xs font-bold ${
                  row.status.includes("Dominant") ? "bg-green-500/10 text-green-500" :
                  row.status.includes("Africaine") ? "bg-[#D4AF37]/10 text-[#D4AF37]" :
                  "bg-blue-500/10 text-blue-400"
                }`}>
                  {row.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export const ThreeModelsComparison = () => {
  const data = [
    {
      criteria: "Objet Central",
      standard: "Matière inerte / Énergie",
      janus: "Masse négative / Géométrie",
      prora: "L'Être Global (Mat + Esp)"
    },
    {
      criteria: "Approche",
      standard: "Matérialiste / Quantique",
      janus: "Géométrisation de l'espace",
      prora: "Holistique & Vibratoire"
    },
    {
      criteria: "Limite Principale",
      standard: "Ignore la Conscience",
      janus: "Ignore la dimension Spirituelle",
      prora: "Exige une Éthique rigoureuse"
    },
    {
      criteria: "Domaine",
      standard: "Physique",
      janus: "Astrophysique",
      prora: "Science Totale (Phys + Meta)"
    }
  ];

  return (
    <div className="overflow-x-auto rounded-xl border border-white/10 shadow-2xl bg-[#0F1419] my-8">
      <table className="w-full text-sm text-left">
        <thead className="text-xs uppercase bg-[#15202B] text-gray-400 border-b border-white/10">
          <tr>
            <th className="px-6 py-5 font-bold tracking-wider w-1/4">Critère de Comparaison</th>
            <th className="px-6 py-5 font-bold tracking-wider w-1/4">Modèle Standard</th>
            <th className="px-6 py-5 font-bold tracking-wider w-1/4">Modèle Janus (JPP)</th>
            <th className="px-6 py-5 text-[#D4AF37] bg-[#D4AF37]/10 font-bold tracking-wider border-b-2 border-[#D4AF37] w-1/4">PRORASCIENCE</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {data.map((row, index) => (
            <tr key={index} className="bg-[#192734] hover:bg-white/5 transition-colors">
              <td className="px-6 py-4 font-medium text-white border-r border-white/5">{row.criteria}</td>
              <td className="px-6 py-4 text-gray-400 border-r border-white/5">{row.standard}</td>
              <td className="px-6 py-4 text-gray-400 border-r border-white/5">{row.janus}</td>
              <td className="px-6 py-4 text-[#D4AF37] font-bold bg-[#D4AF37]/5 border-r border-white/5 shadow-[inset_0_0_10px_rgba(212,175,55,0.05)]">
                {row.prora}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};