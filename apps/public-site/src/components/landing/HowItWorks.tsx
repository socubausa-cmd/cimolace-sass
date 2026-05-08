"use client";

import { motion } from "framer-motion";

export function HowItWorks() {
  return (
    <section id="how-it-works" className="relative bg-black py-28 md:py-36 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-black via-slate-950 to-black" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-500/5 rounded-full blur-[150px]" />
      <div className="relative z-10 max-w-7xl mx-auto px-6">
        <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.7 }} className="text-center mb-20">
          <p className="text-sm font-semibold tracking-[0.2em] uppercase text-white/30 mb-4">Comment ça marche</p>
          <h2 className="text-4xl md:text-6xl font-bold text-white leading-[1.1] max-w-4xl mx-auto">Trois modes.<br /><span className="text-white/40">Zéro friction.</span></h2>
        </motion.div>
        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {[
            { step: "01", title: "Choisissez", desc: "Prenez une infrastructure préconfigurée, ou construisez la vôtre moteur par moteur.", color: "from-indigo-400 to-purple-500" },
            { step: "02", title: "Brandez", desc: "Logo, couleurs, domaine. Votre plateforme, votre identité. En 5 minutes.", color: "from-purple-400 to-pink-500" },
            { step: "03", title: "Lancez", desc: "Configurez vos paiements, invitez votre équipe, publiez votre premier produit.", color: "from-emerald-400 to-teal-500" },
          ].map((item, i) => (
            <motion.div key={item.step} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: i * 0.12 }}>
              <div className="bg-white/[0.02] border border-white/[0.04] rounded-3xl p-10 hover:bg-white/[0.04] transition-colors">
                <span className={`text-6xl font-bold bg-gradient-to-br ${item.color} bg-clip-text text-transparent block mb-6`}>{item.step}</span>
                <h3 className="text-2xl font-bold text-white mb-3">{item.title}</h3>
                <p className="text-white/40 leading-relaxed">{item.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
