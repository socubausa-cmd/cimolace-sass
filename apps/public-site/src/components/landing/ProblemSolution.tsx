"use client";

import { motion } from "framer-motion";
import { X, Check } from "lucide-react";

export function ProblemSolution() {
  return (
    <section className="relative bg-black py-28 md:py-36 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-black via-slate-950 to-black" />
      <div className="absolute top-1/3 right-0 w-[500px] h-[500px] bg-red-500/5 rounded-full blur-[120px]" />
      <div className="absolute bottom-1/3 left-0 w-[500px] h-[500px] bg-emerald-500/5 rounded-full blur-[120px]" />
      <div className="relative z-10 max-w-7xl mx-auto px-6">
        <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.7 }} className="text-center mb-20">
          <p className="text-sm font-semibold tracking-[0.2em] uppercase text-white/30 mb-4">Le constat</p>
          <h2 className="text-4xl md:text-6xl font-bold text-white leading-[1.1] max-w-4xl mx-auto">Vous assemblez des outils.<br /><span className="text-white/40">Ils ne se parlent pas.</span></h2>
        </motion.div>
        <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          <motion.div initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.6, delay: 0.2 }} className="relative bg-white/[0.02] border border-white/[0.04] rounded-3xl p-8 md:p-10 backdrop-blur-sm">
            <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center mb-6"><X className="w-5 h-5 text-red-400" /></div>
            <h3 className="text-xl font-semibold text-white/60 mb-8">Sans Cimolace</h3>
            <ul className="space-y-5">
              {["Stripe pour les paiements","Zoom ou LiveKit à configurer","Un outil email transactionnel","Un LMS pour les formations","Un CRM pour les clients","Zéro isolation multi-tenant","6 mois d'intégration minimum"].map((item) => (
                <li key={item} className="flex items-center gap-3 text-sm text-white/30"><span className="w-1 h-1 rounded-full bg-red-500/30 flex-shrink-0" />{item}</li>
              ))}
            </ul>
          </motion.div>
          <motion.div initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.6, delay: 0.35 }} className="relative bg-white/[0.04] border border-white/[0.08] rounded-3xl p-8 md:p-10 backdrop-blur-sm">
            <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center mb-6"><Check className="w-5 h-5 text-emerald-400" /></div>
            <h3 className="text-xl font-semibold text-white mb-8">Avec Cimolace</h3>
            <ul className="space-y-5">
              {["Tout dans une plateforme unique","LiveKit intégré, prêt à l'emploi","Email, SMS, WhatsApp natifs","Course Builder + Certificats","Tenant isolé pour chaque client","Isolation triple couche (Guard → RLS)","10 minutes pour lancer votre business"].map((item) => (
                <li key={item} className="flex items-center gap-3 text-sm text-white/60"><span className="w-1 h-1 rounded-full bg-emerald-400 flex-shrink-0" />{item}</li>
              ))}
            </ul>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
