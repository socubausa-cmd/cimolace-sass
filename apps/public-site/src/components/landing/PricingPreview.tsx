"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";

const plans = [
  { name: "MedOS Solo", price: "19€", period: "/mois", desc: "Praticien solo — dossiers, prescriptions, IA", features: ["50 patients","Notes SOAP","Ordonnances PDF","20 consultations IA/mois"], href: "/medos", highlight: false },
  { name: "École Pro", price: "199€", period: "/mois", desc: "Formateur établi — lives, VOD, marketing", features: ["500 étudiants","Lives illimités","Replay permanent","SmartBoard IA","Support prioritaire"], href: "/pricing", highlight: true },
  { name: "École Business", price: "349€", period: "/mois", desc: "Institut — white label, tout l'écosystème", features: ["2 000 étudiants","White Label","Neuro Recall IA","API access","Account manager"], href: "/pricing", highlight: false },
];

export function PricingPreview() {
  return (
    <section className="relative bg-black py-28 md:py-36 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-black via-slate-950 to-black" />
      <div className="absolute top-1/3 right-1/3 w-[500px] h-[500px] bg-indigo-500/5 rounded-full blur-[120px]" />
      <div className="relative z-10 max-w-7xl mx-auto px-6">
        <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.7 }} className="text-center mb-20">
          <p className="text-sm font-semibold tracking-[0.2em] uppercase text-white/30 mb-4">Tarifs</p>
          <h2 className="text-4xl md:text-6xl font-bold text-white leading-[1.1] max-w-4xl mx-auto">Des plans qui<br /><span className="text-white/40">grandissent avec vous.</span></h2>
          <p className="mt-6 text-white/30 max-w-lg mx-auto">Pas d&apos;engagement. Changez de plan à tout moment. Tous les plans incluent le constructeur d&apos;infrastructure.</p>
        </motion.div>
        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {plans.map((plan, i) => (
            <motion.div key={plan.name} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.4, delay: i * 0.1 }} whileHover={{ y: -4 }} className={`relative rounded-3xl p-8 flex flex-col backdrop-blur-sm ${plan.highlight ? "bg-white/[0.06] border border-white/10 ring-1 ring-indigo-500/20" : "bg-white/[0.02] border border-white/[0.04]"}`}>
              {plan.highlight && <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-indigo-500 text-white text-xs font-semibold px-4 py-1 rounded-full flex items-center gap-1"><Sparkles className="w-3 h-3" />Le plus populaire</span>}
              <h3 className="text-xl font-bold text-white mb-1">{plan.name}</h3>
              <p className="text-sm text-white/30 mb-6">{plan.desc}</p>
              <div className="mb-6"><span className="text-5xl font-bold text-white">{plan.price}</span><span className="text-white/30">{plan.period}</span></div>
              <ul className="space-y-3 mb-8 flex-1">{plan.features.map((f) => <li key={f} className="flex items-start gap-2 text-sm text-white/50"><span className="text-emerald-400 mt-0.5">✓</span>{f}</li>)}</ul>
              <Link href={plan.href} className={`block text-center py-3.5 rounded-full font-semibold transition-all ${plan.highlight ? "bg-white text-black hover:bg-white/90" : "bg-white/5 text-white hover:bg-white/10"}`}>{plan.highlight ? "Démarrer" : "Voir le plan"}</Link>
            </motion.div>
          ))}
        </div>
        <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: 0.3 }} className="mt-12 text-center">
          <Link href="/pricing" className="inline-flex items-center gap-2 text-white/40 hover:text-white/70 transition-colors text-sm font-medium">Voir tous les plans et infrastructures<ArrowRight className="w-4 h-4" /></Link>
        </motion.div>
      </div>
    </section>
  );
}
