"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Brain, Shield, Globe, CreditCard, ArrowRight } from "lucide-react";

export function MedOSFocus() {
  return (
    <section className="relative bg-black py-28 md:py-36 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-black via-slate-950 to-black" />
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-emerald-500/5 rounded-full blur-[150px]" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-teal-500/5 rounded-full blur-[120px]" />
      <div className="relative z-10 max-w-7xl mx-auto px-6">
        <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.7 }} className="text-center mb-20">
          <p className="text-sm font-semibold tracking-[0.2em] uppercase text-emerald-400/60 mb-4">Focus</p>
          <h2 className="text-5xl md:text-7xl font-bold text-white leading-[1.05] max-w-4xl mx-auto mb-6">MedOS<span className="text-emerald-400">.</span></h2>
          <p className="text-lg text-white/40 max-w-xl mx-auto">L&apos;OS médical des praticiens. Déjà en production.</p>
        </motion.div>
        <div className="grid sm:grid-cols-2 gap-4 max-w-4xl mx-auto mb-16">
          {[
            { icon: Brain, title: "IA Charting", desc: "Transcription Deepgram + Claude. Note SOAP en 30s." },
            { icon: Shield, title: "RGPD natif", desc: "Consentement, audit trail, chiffrement AES-256." },
            { icon: Globe, title: "Afrique & Europe", desc: "LiveKit HD. CinetPay, Orange Money, MTN." },
            { icon: CreditCard, title: "Double billing", desc: "Praticien → MedOS. Patient → consultation." },
          ].map((item, i) => {
            const Icon = item.icon;
            return (
              <motion.div key={item.title} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.4, delay: i * 0.08 }} className="bg-white/[0.02] border border-white/[0.04] rounded-2xl p-6 flex gap-4 hover:bg-white/[0.04] transition-colors">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center flex-shrink-0 mt-0.5"><Icon className="w-5 h-5 text-emerald-400" /></div>
                <div><h4 className="font-semibold text-white mb-1">{item.title}</h4><p className="text-sm text-white/30">{item.desc}</p></div>
              </motion.div>
            );
          })}
        </div>
        <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="text-center">
          <Link href="/medos" className="inline-flex items-center gap-2 bg-emerald-500 text-white px-10 py-4 rounded-full text-lg font-semibold hover:bg-emerald-600 transition-all">Découvrir MedOS<ArrowRight className="w-5 h-5" /></Link>
          <p className="mt-4 text-sm text-white/20">À partir de 19 €/mois — Plan gratuit disponible</p>
        </motion.div>
      </div>
    </section>
  );
}
