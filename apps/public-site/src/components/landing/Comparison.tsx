"use client";

import { motion } from "framer-motion";
import { Check, Minus } from "lucide-react";

const rows = [
  { feature: "Multi-tenant natif", cimolace: true, teachable: false, kajabi: false, practicebetter: false },
  { feature: "LiveKit intégré", cimolace: true, teachable: false, kajabi: false, practicebetter: false },
  { feature: "IA conversationnelle", cimolace: true, teachable: false, kajabi: false, practicebetter: false },
  { feature: "Paiements Afrique", cimolace: true, teachable: false, kajabi: false, practicebetter: false },
  { feature: "Module médical", cimolace: true, teachable: false, kajabi: false, practicebetter: true },
  { feature: "API ouverte", cimolace: true, teachable: false, kajabi: false, practicebetter: false },
  { feature: "Prix de départ", cimolace: "19€/mois", teachable: "$39/mois", kajabi: "$55/mois", practicebetter: "$59/mois" },
];

export function Comparison() {
  return (
    <section className="relative bg-white py-28 md:py-36">
      <div className="max-w-6xl mx-auto px-6">
        <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.7 }} className="text-center mb-20">
          <p className="text-sm font-semibold tracking-[0.2em] uppercase text-slate-400 mb-4">Comparaison</p>
          <h2 className="text-4xl md:text-6xl font-bold text-slate-900 leading-[1.1] max-w-4xl mx-auto">La différence.<br /><span className="text-slate-300">En un coup d&apos;œil.</span></h2>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }} className="overflow-x-auto">
          <table className="w-full text-sm min-w-[600px]">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-4 px-4 font-medium text-slate-500 text-xs uppercase tracking-wider"></th>
                <th className="text-center py-4 px-4 font-bold text-slate-900">Cimolace</th>
                <th className="text-center py-4 px-4 font-medium text-slate-400">Teachable</th>
                <th className="text-center py-4 px-4 font-medium text-slate-400">Kajabi</th>
                <th className="text-center py-4 px-4 font-medium text-slate-400">Practice Better</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={row.feature} className="border-b border-slate-50">
                  <td className="py-4 px-4 text-slate-600">{row.feature}</td>
                  {["cimolace","teachable","kajabi","practicebetter"].map((col) => {
                    const val = (row as Record<string,unknown>)[col];
                    if (val === true) return <td key={col} className="text-center py-4 px-4"><Check className="w-5 h-5 text-emerald-500 mx-auto" /></td>;
                    if (val === false) return <td key={col} className="text-center py-4 px-4"><Minus className="w-5 h-5 text-slate-200 mx-auto" /></td>;
                    return <td key={col} className="text-center py-4 px-4 font-semibold text-slate-900">{val as string}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </motion.div>
        <p className="mt-8 text-center text-xs text-slate-300">Comparaison basée sur les informations publiques — Mai 2026</p>
      </div>
    </section>
  );
}
