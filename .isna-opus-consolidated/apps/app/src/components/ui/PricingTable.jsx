import React from 'react';
import { Check } from 'lucide-react';

const PricingTable = ({ pricingData }) => {
  return (
    <div className="overflow-x-auto w-full">
      <table className="w-full min-w-[800px] border-collapse bg-[#192734] rounded-xl overflow-hidden shadow-xl text-left">
        <thead>
          <tr className="bg-[#0F1419] border-b border-white/10">
            <th className="p-6 text-[#D4AF37] font-serif text-lg font-bold">Module</th>
            <th className="p-6 text-white font-bold text-center">Mensuel</th>
            <th className="p-6 text-white font-bold text-center">Trimestriel</th>
            <th className="p-6 text-white font-bold text-center">Annuel <span className="text-xs text-green-500 block font-normal">(Économie max)</span></th>
            <th className="p-6 text-white font-bold text-center">Avantages Inclus</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {pricingData.map((item, index) => (
            <tr key={index} className="hover:bg-white/5 transition-colors">
              <td className="p-6 font-bold text-white border-r border-white/5">
                {item.title}
                <span className="block text-sm text-gray-400 font-normal mt-1">{item.level}</span>
              </td>
              <td className="p-6 text-center text-gray-300">
                {item.monthly}
              </td>
              <td className="p-6 text-center text-gray-300">
                {item.quarterly}
                {item.quarterlyDiscount && <span className="block text-xs text-green-400 mt-1">-{item.quarterlyDiscount}</span>}
              </td>
              <td className="p-6 text-center font-bold text-[#D4AF37] bg-[#D4AF37]/5">
                {item.yearly}
                {item.yearlyDiscount && <span className="block text-xs text-green-400 mt-1">-{item.yearlyDiscount}</span>}
              </td>
              <td className="p-6 text-sm text-gray-400">
                <ul className="space-y-1">
                  {item.features.slice(0, 3).map((feature, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <Check className="w-3 h-3 text-green-500" /> {feature}
                    </li>
                  ))}
                  {item.features.length > 3 && <li className="text-xs italic pl-5">et plus...</li>}
                </ul>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default PricingTable;