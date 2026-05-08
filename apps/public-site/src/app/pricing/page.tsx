import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Tarifs — Cimolace",
  description: "Plans et tarifs pour toutes les infrastructures Cimolace.",
};

const PLANS = [
  { name: "Starter", price: "79€", period: "/mois", desc: "Formateur solo.", features: ["SmartBoard", "Marketing Creator", "50 étudiants", "1 live", "Replay 7j"], cta: "Commencer", highlight: false },
  { name: "Pro", price: "199€", period: "/mois", desc: "École établie.", features: ["Tout Starter", "Lives illimités", "Replay permanent", "500 étudiants", "Support prioritaire"], cta: "Commencer", highlight: true },
  { name: "Business", price: "349€", period: "/mois", desc: "Institut.", features: ["Tout Pro", "White Label", "Neuro Recall IA", "2000 étudiants", "API access"], cta: "Contacter", highlight: false },
];

export default function PricingPage() {
  return (
    <div className="max-w-5xl mx-auto px-6 py-24">
      <div className="text-center mb-16">
        <h1 className="text-4xl font-bold text-slate-900 mb-4">Des plans adaptés à votre taille</h1>
        <p className="text-slate-500">Pas d&apos;engagement. Changement de plan à tout moment.</p>
      </div>
      <div className="grid md:grid-cols-3 gap-8">
        {PLANS.map((p) => (
          <div key={p.name} className={`rounded-2xl border-2 p-8 flex flex-col ${p.highlight ? "border-indigo-600 shadow-xl relative" : "border-slate-200"}`}>
            {p.highlight && <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-indigo-600 text-white text-xs font-bold px-4 py-1 rounded-full">Le plus populaire</span>}
            <h2 className="text-xl font-bold text-slate-900 mb-1">{p.name}</h2>
            <p className="text-sm text-slate-500 mb-4">{p.desc}</p>
            <div className="mb-6"><span className="text-4xl font-bold">{p.price}</span><span className="text-slate-400">{p.period}</span></div>
            <ul className="space-y-3 mb-8 flex-1">{p.features.map((f) => <li key={f} className="flex items-start gap-2 text-sm text-slate-600"><span className="text-green-500">✓</span>{f}</li>)}</ul>
            <Link href="http://localhost:5173/onboarding" className={`block text-center py-3 rounded-xl font-medium ${p.highlight ? "bg-indigo-600 text-white hover:bg-indigo-700" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>{p.cta}</Link>
          </div>
        ))}
      </div>
    </div>
  );
}
