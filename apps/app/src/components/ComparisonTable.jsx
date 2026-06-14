import React from 'react';
import { motion } from 'framer-motion';

const ComparisonTable = ({ 
  headers = ["Critère", "Intégral", "Trimestriel", "Mensuel"], 
  data, 
  highlightColumnIndex = 1 
}) => {
  // Default data if none provided (fallback)
  const rows = data || [
    { label: "Montant", values: ["-", "-", "-"] },
    { label: "Total", values: ["-", "-", "-"] },
  ];

  return (
    <div className="overflow-x-auto rounded-xl border border-white/10 shadow-xl bg-[#15202B]">
      <table className="w-full min-w-[800px] text-left border-collapse">
        <thead>
          <tr className="bg-[#192734]">
            {headers.map((header, index) => (
              <th 
                key={index}
                className={`
                  p-4 md:p-6 font-bold text-lg border-b border-white/10 
                  ${index === 0 ? 'text-gray-400 w-1/4' : 'w-1/4'}
                  ${index === highlightColumnIndex ? 'text-[var(--school-accent)] bg-[color-mix(in_srgb,var(--school-accent)_5%,transparent)]' : 'text-white'}
                `}
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <motion.tr 
              key={rowIndex}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: rowIndex * 0.05 }}
              className={`
                group transition-colors hover:bg-white/5
                ${rowIndex % 2 === 0 ? 'bg-transparent' : 'bg-white/[0.02]'}
              `}
            >
              <td className="p-4 md:p-6 text-gray-300 font-medium border-b border-white/5 group-hover:text-white transition-colors">
                {row.label}
              </td>
              
              {/* Handle both data structures: existing (col1, col2...) and new (values array) */}
              {row.values ? (
                row.values.map((val, colIndex) => (
                  <td 
                    key={colIndex}
                    className={`
                      p-4 md:p-6 border-b border-white/5
                      ${(colIndex + 1) === highlightColumnIndex ? 'text-[var(--school-accent)] font-bold bg-[color-mix(in_srgb,var(--school-accent)_5%,transparent)]' : 'text-gray-300'}
                    `}
                  >
                    {val}
                  </td>
                ))
              ) : (
                // Fallback for backward compatibility if needed
                <>
                  <td className="p-4 md:p-6 text-[var(--school-accent)] font-bold border-b border-white/5 bg-[color-mix(in_srgb,var(--school-accent)_5%,transparent)]">{row.col1}</td>
                  <td className="p-4 md:p-6 text-gray-300 border-b border-white/5">{row.col2}</td>
                  <td className="p-4 md:p-6 text-gray-300 border-b border-white/5">{row.col3}</td>
                </>
              )}
            </motion.tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ComparisonTable;