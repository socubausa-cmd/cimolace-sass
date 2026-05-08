"use client";

import { motion } from "framer-motion";
import { Brain, Video, CreditCard, Mail, Calendar, Stethoscope, Workflow, FileText } from "lucide-react";

const categories = [
  { title: "IA", icon: Brain, gradient: "from-purple-400 to-pink-500", count: "5 moteurs" },
  { title: "Live & Vidéo", icon: Video, gradient: "from-red-400 to-orange-500", count: "5 moteurs" },
  { title: "Paiements", icon: CreditCard, gradient: "from-emerald-400 to-green-500", count: "6 moteurs" },
  { title: "Communication", icon: Mail, gradient: "from-blue-400 to-cyan-500", count: "5 moteurs" },
  { title: "Contenu", icon: FileText, gradient: "from-amber-400 to-yellow-500", count: "4 moteurs" },
  { title: "Agenda", icon: Calendar, gradient: "from-rose-400 to-pink-500", count: "3 moteurs" },
  { title: "Santé", icon: Stethoscope, gradient: "from-teal-400 to-emerald-500", count: "8 moteurs" },
  { title: "Infra", icon: Workflow, gradient: "from-slate-400 to-slate-600", count: "5 moteurs" },
];

export function EnginesPreview() {
  return (
    <section id="engines" className="relative bg-slate-50 py-28 md:py-36">
      <div className="max-w-7xl mx-auto px-6">
        <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.7 }} className="text-center mb-20">
          <p className="text-sm font-semibold tracking-[0.2em] uppercase text-slate-400 mb-4">Moteurs</p>
          <h2 className="text-4xl md:text-6xl font-bold text-slate-900 leading-[1.1] max-w-4xl mx-auto">40+ moteurs.<br /><span className="text-slate-300">Activez ce dont vous avez besoin.</span></h2>
          <p className="mt-6 text-slate-400 max-w-lg mx-auto">Comme des apps sur votre téléphone. Chaque moteur est indépendant, interopérable, et s&apos;active en un clic.</p>
        </motion.div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-5xl mx-auto">
          {categories.map((cat, i) => {
            const Icon = cat.icon;
            return (
              <motion.div key={cat.title} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.4, delay: i * 0.05 }} whileHover={{ y: -3 }} className="bg-white border border-slate-100 rounded-2xl p-5 hover:shadow-md transition-all">
                <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${cat.gradient} flex items-center justify-center mb-3`}><Icon className="w-4 h-4 text-white" /></div>
                <h4 className="font-semibold text-slate-900 text-sm">{cat.title}</h4>
                <p className="text-xs text-slate-400 mt-0.5">{cat.count}</p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
