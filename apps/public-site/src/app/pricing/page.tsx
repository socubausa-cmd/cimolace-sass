import Link from "next/link";
import type { Metadata } from "next";
import { Sparkles } from "lucide-react";
import { getOnboardingUrl } from "@/lib/urls";

export const metadata: Metadata = {
  title: "Tarifs — Cimolace",
  description: "Plans et tarifs pour toutes les infrastructures Cimolace : École, MedOS, Bien-être, Créateur. À partir de 0€/mois.",
};

type Plan = {
  name: string; price: string; period: string; desc: string;
  features: string[]; cta: string; highlight: boolean;
};

const infrastructures: { name: string; icon: string; plans: Plan[]; color: string }[] = [
  {
    name: "École", icon: "🏫", color: "indigo",
    plans: [
      { name: "Starter", price: "79€", period: "/mois", desc: "Formateur solo", features: ["SmartBoard IA", "Marketing Creator", "50 étudiants", "1 live/mois", "Replay 7 jours"], cta: "Commencer", highlight: false },
      { name: "Pro", price: "199€", period: "/mois", desc: "École établie", features: ["Tout Starter +", "Lives illimités", "Replay permanent", "500 étudiants", "Support prioritaire"], cta: "Commencer", highlight: true },
      { name: "Business", price: "349€", period: "/mois", desc: "Institut", features: ["Tout Pro +", "White Label", "Neuro Recall IA", "2 000 étudiants", "API access", "Account manager"], cta: "Contacter", highlight: false },
    ],
  },
  {
    name: "MedOS", icon: "🏥", color: "emerald",
    plans: [
      { name: "Sprout", price: "0€", period: "/mois", desc: "Pour démarrer", features: ["3 patients", "Dossiers patients", "1 formulaire", "Support email"], cta: "Démarrer", highlight: false },
      { name: "Solo", price: "19€", period: "/mois", desc: "Praticien solo", features: ["50 patients", "Notes SOAP + IA", "Ordonnances PDF", "20 consultations IA/mois", "Formulaires illimités"], cta: "Commencer", highlight: true },
      { name: "Pro", price: "49€", period: "/mois", desc: "Cabinet établi", features: ["200 patients", "Téléconsultation HD", "Programmes de soins", "Journal santé", "Support prioritaire"], cta: "Commencer", highlight: false },
      { name: "Clinic", price: "99€", period: "/mois", desc: "Clinique / groupe", features: ["Patients illimités", "White Label", "Multi-praticiens", "API access", "Account manager"], cta: "Contacter", highlight: false },
    ],
  },
  {
    name: "Bien-être", icon: "🌿", color: "green",
    plans: [
      { name: "Starter", price: "29€", period: "/mois", desc: "Coach débutant", features: ["20 clients", "Programmes de soins", "Formulaires", "Journal de suivi", "Support email"], cta: "Commencer", highlight: false },
      { name: "Pro", price: "79€", period: "/mois", desc: "Coach pro", features: ["100 clients", "Téléconsultation HD", "Automatisations email/SMS", "Paiements intégrés", "Support prioritaire"], cta: "Commencer", highlight: true },
    ],
  },
  {
    name: "Créateur", icon: "🎬", color: "rose",
    plans: [
      { name: "Starter", price: "49€", period: "/mois", desc: "Créateur émergent", features: ["Studio Live", "Monétisation directe", "100 abonnés", "VOD 30 jours", "Chat communauté"], cta: "Commencer", highlight: false },
      { name: "Pro", price: "149€", period: "/mois", desc: "Créateur pro", features: ["Tout Starter +", "VOD illimitée", "Abonnés illimités", "API personnalisée", "Support prioritaire"], cta: "Commencer", highlight: true },
      { name: "Business", price: "299€", period: "/mois", desc: "Studio / réseau", features: ["Tout Pro +", "White Label", "Multi-créateurs", "Régie pub intégrée", "Account manager"], cta: "Contacter", highlight: false },
    ],
  },
];

export default function PricingPage() {
  const onboardingUrl = getOnboardingUrl();

  return (
    <div className="max-w-7xl mx-auto px-6 py-24">
      <div className="text-center mb-20">
        <p className="text-sm font-semibold tracking-[0.2em] uppercase text-slate-400 mb-4">Tarifs</p>
        <h1 className="text-4xl md:text-6xl font-bold text-slate-900 mb-4">Des plans qui grandissent avec vous</h1>
        <p className="text-lg text-slate-500 max-w-xl mx-auto">Pas d&apos;engagement. Changez de plan à tout moment. Tous les plans incluent le constructeur d&apos;infrastructure et 14 jours d&apos;essai.</p>
      </div>

      {infrastructures.map((infra, idx) => (
        <div key={infra.name} className={`mb-24 ${idx > 0 ? "pt-12 border-t border-slate-100" : ""}`}>
          <div className="text-center mb-10">
            <span className="text-3xl">{infra.icon}</span>
            <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mt-2">{infra.name}</h2>
          </div>
          <div className={`grid gap-6 ${infra.name === "MedOS" ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-2 lg:grid-cols-3"} max-w-5xl mx-auto`}>
            {infra.plans.map((plan) => (
              <div key={plan.name} className={`relative rounded-2xl border-2 p-6 flex flex-col ${plan.highlight ? `border-${infra.color}-500 shadow-lg ring-1 ring-${infra.color}-500/20` : "border-slate-200"}`}>
                {plan.highlight && (
                  <span className={`absolute -top-3 left-1/2 -translate-x-1/2 bg-${infra.color}-500 text-white text-xs font-semibold px-4 py-1 rounded-full flex items-center gap-1`}>
                    <Sparkles className="w-3 h-3" />Le plus populaire
                  </span>
                )}
                <h3 className="text-lg font-bold text-slate-900 mb-1">{plan.name}</h3>
                <p className="text-xs text-slate-400 mb-4">{plan.desc}</p>
                <div className="mb-6">
                  <span className="text-4xl font-bold text-slate-900">{plan.price}</span>
                  <span className="text-slate-400 text-sm">{plan.period}</span>
                </div>
                <ul className="space-y-2.5 mb-8 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-slate-600">
                      <span className="text-green-500 mt-0.5 flex-shrink-0">✓</span>{f}
                    </li>
                  ))}
                </ul>
                <Link href={onboardingUrl} className={`block text-center py-2.5 rounded-full text-sm font-semibold transition-all ${plan.highlight ? `bg-${infra.color}-500 text-white hover:bg-${infra.color}-600` : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="text-center mt-16 p-12 bg-slate-50 rounded-3xl">
        <span className="text-3xl mb-4 block">⚙️</span>
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Vous ne trouvez pas votre bonheur ?</h2>
        <p className="text-slate-500 mb-6">Construisez votre propre infrastructure. Activez uniquement les moteurs dont vous avez besoin.</p>
        <Link href={onboardingUrl} className="inline-flex items-center gap-2 bg-slate-900 text-white px-8 py-3 rounded-full font-semibold hover:bg-slate-800 transition-all">Construire mon infrastructure →</Link>
      </div>
    </div>
  );
}
