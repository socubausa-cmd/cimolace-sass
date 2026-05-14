import React from 'react';
import { Check, X, Minus } from 'lucide-react';
import { formationsData } from '@/lib/mockFormationsData';
import { Card } from '@/components/ui/card';

const ComparisonTable = () => {
  const packages = ["Académique", "Académique +", "Académique Pro", "Montorat"];
  const headerColors = [
    "bg-blue-900/20 text-blue-300 border-t-4 border-blue-500",
    "bg-yellow-900/20 text-yellow-300 border-t-4 border-yellow-500",
    "bg-red-900/20 text-red-300 border-t-4 border-red-500",
    "bg-purple-900/20 text-purple-300 border-t-4 border-purple-500"
  ];

  return (
    <Card className="w-full overflow-hidden border border-white/10 bg-[#0F1419] shadow-2xl rounded-2xl">
      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full min-w-[1000px] border-collapse">
          <thead>
            <tr>
              <th className="p-6 text-left text-white font-serif font-bold w-1/4 bg-[#151a21] sticky left-0 z-20 shadow-r-lg border-b border-white/10">
                <span className="text-lg">Comparatif des Inclusions</span>
              </th>
              {packages.map((pkg, idx) => (
                <th key={idx} className={`p-4 text-center border-b border-white/10 font-bold text-lg min-w-[150px] ${headerColors[idx]}`}>
                  {pkg}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {formationsData.comparison.categories.map((section, sIdx) => (
              <React.Fragment key={sIdx}>
                <tr className="bg-[#192734]">
                  <td colSpan={5} className="p-4 pl-6 font-bold text-sm tracking-widest text-white uppercase bg-black/20 sticky left-0 z-10">
                    {section.title}
                  </td>
                </tr>
                {section.items.map((row, rIdx) => (
                  <tr key={rIdx} className="hover:bg-white/5 transition-colors group">
                    <td className="p-4 pl-6 text-gray-300 font-medium text-sm sticky left-0 bg-[#0F1419] group-hover:bg-[#161b22] z-10 border-r border-white/5 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.5)]">
                      {row.label}
                    </td>
                    {row.values.map((val, vIdx) => (
                      <td key={vIdx} className="p-4 text-center">
                        <div className="flex justify-center items-center h-full">
                          {val ? (
                            <div className={`p-1.5 rounded-full ${
                              vIdx === 0 ? 'bg-blue-500/10 text-blue-500' : 
                              vIdx === 1 ? 'bg-yellow-500/10 text-yellow-500' : 
                              vIdx === 2 ? 'bg-red-500/10 text-red-500' : 'bg-purple-500/10 text-purple-500'
                            }`}>
                              <Check className="w-5 h-5 stroke-[3px]" />
                            </div>
                          ) : (
                            <div className="opacity-20">
                               <X className="w-5 h-5 text-gray-500" />
                            </div>
                          )}
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
};

export default ComparisonTable;