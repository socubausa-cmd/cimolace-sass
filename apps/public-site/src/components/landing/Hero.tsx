"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Sparkles, Shield, CreditCard, Globe } from "lucide-react";
import { getOnboardingUrl } from "@/lib/urls";

export function Hero() {
  const onboardingUrl = getOnboardingUrl();
  return (
    <section className="relative overflow-hidden bg-black min-h-[92vh] flex flex-col justify-center">
      <div className="absolute inset-0">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-indigo-600/20 rounded-full blur-[120px] animate-float" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-emerald-500/15 rounded-full blur-[100px] animate-float" style={{ animationDelay: "-3s" }} />
        <div className="absolute top-1/3 right-1/3 w-[400px] h-[400px] bg-purple-600/10 rounded-full blur-[100px] animate-float" style={{ animationDelay: "-5s" }} />
      </div>
      <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.8) 1px, transparent 0)", backgroundSize: "48px 48px" }} />
      <div className="relative z-10 max-w-7xl mx-auto px-6 pt-24 pb-12 text-center">
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: [0.25, 0.1, 0.25, 1] }}>
          <h1 className="text-6xl md:text-8xl font-bold tracking-tight text-white mb-6">Cimolace<span className="text-indigo-400">.</span></h1>
        </motion.div>
        <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2 }} className="text-xl md:text-2xl text-white/70 max-w-2xl mx-auto mb-4 font-medium">L&apos;OS qui crée des plateformes SaaS.</motion.p>
        <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.35 }} className="text-base md:text-lg text-white/50 max-w-xl mx-auto mb-10">Votre plateforme. Vos règles. Zéro code.<br />Écoles, cliniques, créateurs, boutiques — lancez-vous en 10 minutes.</motion.p>
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5, delay: 0.45 }} className="text-sm text-white/40 mb-8">À partir de <span className="text-white/70 font-semibold">19 €/mois</span></motion.p>
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.55 }} className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
          <Link href={onboardingUrl} className="group inline-flex items-center justify-center gap-2 bg-white text-black px-10 py-4 rounded-full text-lg font-semibold hover:bg-white/90 transition-all">Créer ma plateforme<ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" /></Link>
          <Link href="/pricing" className="inline-flex items-center justify-center gap-2 border border-white/20 text-white px-10 py-4 rounded-full text-lg font-medium hover:bg-white/10 transition-all">Voir les tarifs</Link>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.7 }} className="relative max-w-4xl mx-auto">
          <div className="relative h-48 md:h-64">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 md:w-64 md:h-64 rounded-3xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-white/10 backdrop-blur-sm animate-pulse-glow" />
            {[{ icon: "🧠", label: "IA", x: "-20%", y: "-30%", delay: 0 },{ icon: "📡", label: "Live", x: "70%", y: "-20%", delay: 1 },{ icon: "💳", label: "Paiement", x: "80%", y: "50%", delay: 2 },{ icon: "💬", label: "Chat", x: "-10%", y: "80%", delay: 3 },{ icon: "📧", label: "Email", x: "-25%", y: "40%", delay: 1.5 },{ icon: "🔒", label: "Sécurité", x: "55%", y: "75%", delay: 3.5 }].map((m) => (
              <div key={m.label} className="absolute animate-float text-center" style={{ left: m.x, top: m.y, transform: "translate(-50%, -50%)", animationDelay: `${m.delay}s` }}>
                <div className="w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm flex items-center justify-center text-2xl hover:bg-white/10 transition-colors">{m.icon}</div>
                <p className="text-[10px] md:text-xs text-white/40 mt-1.5 font-medium">{m.label}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5, delay: 1 }} className="relative z-10 border-t border-white/10 mt-auto">
        <div className="max-w-5xl mx-auto px-6 py-6 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {[{ icon: Shield, label: "Isolation stricte", desc: "Triple couche de sécurité" },{ icon: CreditCard, label: "Paiements natifs", desc: "Stripe · CinetPay · MTN" },{ icon: Globe, label: "Afrique & Europe", desc: "Multi-devises, multi-régions" },{ icon: Sparkles, label: "IA intégrée", desc: "LIRI Brain · SmartBoard" }].map((item, i) => {
            const Icon = item.icon;
            return <div key={i} className="flex flex-col items-center gap-1.5"><Icon className="w-4 h-4 text-white/30" /><span className="text-xs font-medium text-white/50">{item.label}</span><span className="text-[10px] text-white/30">{item.desc}</span></div>;
          })}
        </div>
      </motion.div>
    </section>
  );
}
