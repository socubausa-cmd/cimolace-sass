"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, ArrowLeft, Puzzle } from "lucide-react";
import { getOnboardingUrl } from "@/lib/urls";
import { Badge } from "./Badge";

interface Plan { name: string; price: string; features: string[]; highlight?: boolean; }

interface InfraPageProps {
  title: string; icon: string; tagline: string; gradient: string;
  status?: "available" | "beta" | "coming-soon";
  engines: string[];
  plans: Plan[];
}

export function InfraPage({ title, icon, tagline, gradient, status = "available", engines, plans }: InfraPageProps) {
  const onboardingUrl = getOnboardingUrl();
  return (
    <>
      {/* Hero */}
      <section className="relative bg-black py-28 md:py-32 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-black via-slate-950 to-black" />
        <div className="relative z-10 max-w-7xl mx-auto px-6 text-center">
          <Link href="/#infrastructures" className="inline-flex items-center gap-2 text-white/30 hover:text-white/60 transition-colors text-sm mb-8"><ArrowLeft className="w-4 h-4" /> Toutes les infrastructures</Link>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <span className="text-5xl mb-4 block">{icon}</span>
            <h1 className={`text-5xl md:text-7xl font-bold text-white mb-4 bg-gradient-to-r ${gradient} bg-clip-text text-transparent`}>{title}</h1>
            <p className="text-lg text-white/40 max-w-xl mx-auto mb-4">{tagline}</p>
            {status !== "available" && <div className="mb-8"><Badge variant={status} /></div>}
          </motion.div>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href={onboardingUrl} className="bg-white text-black px-10 py-4 rounded-full text-lg font-semibold hover:bg-white/90 transition-all inline-flex items-center justify-center gap-2">Créer ma plateforme<ArrowRight className="w-5 h-5" /></Link>
            <Link href="/pricing" className="border border-white/20 text-white px-10 py-4 rounded-full text-lg font-medium hover:bg-white/10 transition-all">Voir les tarifs</Link>
          </motion.div>
        </div>
      </section>

      {/* Engines — "Moteurs inclus" */}
      <section className="relative bg-white py-24">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-purple-50 text-purple-700 text-xs font-semibold px-3 py-1 rounded-full mb-4"><Puzzle className="w-3 h-3" />MOTEURS</div>
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-3">Moteurs inclus dans {title}</h2>
            <p className="text-slate-400 max-w-lg mx-auto">Cette infrastructure active automatiquement les moteurs Cimolace suivants. Vous pouvez en ajouter ou en retirer à tout moment.</p>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            {engines.map((e, i) => (
              <motion.div key={e} initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.25, delay: i * 0.04 }} className="bg-slate-50 border border-slate-100 rounded-xl px-5 py-4 text-sm text-slate-700 hover:border-purple-200 hover:bg-purple-50/30 transition-all flex items-start gap-3">
                <span className="text-lg flex-shrink-0">{e.split(" — ")[0].split(" ")[0]}</span>
                <span className="text-slate-600">{e.split(" — ").slice(1).join(" — ")}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="relative bg-black py-24 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-black via-slate-950 to-black" />
        <div className="relative z-10 max-w-5xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-white text-center mb-4">Des plans transparents.</h2>
          <p className="text-white/40 text-center mb-12">Pas d&apos;engagement. Changement de plan à tout moment.</p>
          <div className="grid md:grid-cols-3 gap-6">
            {plans.map((plan, i) => (
              <motion.div key={plan.name} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.3, delay: i * 0.1 }} className={`rounded-3xl p-8 flex flex-col backdrop-blur-sm ${plan.highlight ? "bg-white/[0.06] border border-white/10 ring-1 ring-indigo-500/20" : "bg-white/[0.02] border border-white/[0.04]"}`}>
                {plan.highlight && <span className="text-xs font-semibold text-indigo-400 mb-2">Le plus populaire</span>}
                <h3 className="text-xl font-bold text-white mb-1">{plan.name}</h3>
                <div className="mb-6"><span className="text-4xl font-bold text-white">{plan.price}</span><span className="text-white/30">/mois</span></div>
                <ul className="space-y-3 mb-8 flex-1">{plan.features.map((f) => <li key={f} className="flex items-start gap-2 text-sm text-white/50"><span className="text-emerald-400 mt-0.5">✓</span>{f}</li>)}</ul>
                <Link href={onboardingUrl} className={`block text-center py-3 rounded-full font-semibold transition-all ${plan.highlight ? "bg-white text-black hover:bg-white/90" : "bg-white/5 text-white hover:bg-white/10"}`}>Démarrer</Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative bg-slate-50 py-16 text-center">
        <p className="text-slate-500 mb-4">Une question ?</p>
        <Link href="/#faq" className="text-slate-900 font-semibold hover:underline">Consultez notre FAQ →</Link>
      </section>
    </>
  );
}
