"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";

const faqs = [
  { q: "C'est quoi Cimolace ?", a: "Un OS SaaS multi-tenant qui crée des plateformes. Vous choisissez une infrastructure (École, MedOS, Boutique…), vous la brandez, vous lancez. Sans coder." },
  { q: "Combien de temps pour être opérationnel ?", a: "10 minutes pour créer votre espace. 1 à 2 heures pour configurer branding, paiements et votre premier produit." },
  { q: "Je peux avoir mon propre domaine ?", a: "Oui. Les plans Pro et Business incluent le White Label avec domaine personnalisé." },
  { q: "La sécurité multi-tenant ?", a: "Triple couche : Garde API → Filtre Service → RLS PostgreSQL. Même niveau d'isolation que les clouds publics." },
  { q: "Quels moyens de paiement ?", a: "Stripe (Europe/International). CinetPay, Orange Money, MTN, Chariow (Afrique)." },
  { q: "Un plan gratuit ?", a: "MedOS propose un plan gratuit (3 patients). Essai gratuit 14 jours pour les autres infrastructures." },
];

export function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  return (
    <section className="relative bg-white py-28 md:py-36">
      <div className="max-w-3xl mx-auto px-6">
        <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.7 }} className="text-center mb-16">
          <p className="text-sm font-semibold tracking-[0.2em] uppercase text-slate-400 mb-4">FAQ</p>
          <h2 className="text-4xl md:text-5xl font-bold text-slate-900 leading-[1.1]">Tout ce que vous<br /><span className="text-slate-300">devez savoir.</span></h2>
        </motion.div>
        <div className="space-y-2">
          {faqs.map((faq, i) => {
            const isOpen = openIndex === i;
            return (
              <div key={i} className="border border-slate-100 rounded-xl overflow-hidden">
                <button onClick={() => setOpenIndex(isOpen ? null : i)} className="w-full flex items-center justify-between p-5 text-left hover:bg-slate-50 transition-colors">
                  <span className="font-medium text-slate-900 pr-4">{faq.q}</span>
                  <ChevronDown className={`w-5 h-5 text-slate-300 flex-shrink-0 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
                </button>
                <AnimatePresence>{isOpen && <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden"><p className="px-5 pb-5 text-sm text-slate-500 leading-relaxed">{faq.a}</p></motion.div>}</AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
