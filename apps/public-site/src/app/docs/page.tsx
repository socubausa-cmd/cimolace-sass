import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, Code, Puzzle, Shield, ArrowRight } from "lucide-react";

export const metadata: Metadata = {
  title: "Documentation — Cimolace",
  description: "Guides, tutoriels et référence technique pour Cimolace OS.",
};

const sections = [
  { icon: Puzzle, title: "Démarrer", desc: "Créez votre première plateforme en 10 minutes. Guide pas à pas de l'onboarding.", href: "/docs/getting-started", items: ["Création de compte", "Choix de l'infrastructure", "Branding", "Premier produit"] },
  { icon: BookOpen, title: "Guides", desc: "Tutoriels détaillés par infrastructure et par moteur.", href: "/docs/guides", items: ["Configurer les paiements", "Créer un live payant", "Gérer les accès étudiants", "Personnaliser les emails"] },
  { icon: Code, title: "API Reference", desc: "Documentation complète de l'API Cimolace. Endpoints, webhooks, SDKs.", href: "/docs/api", items: ["Auth JWT", "Tenants & rôles", "Checkout & Webhooks", "LiveKit tokens"] },
  { icon: Shield, title: "Sécurité & Conformité", desc: "Modèle de sécurité, isolation multi-tenant, RGPD.", href: "/docs/security", items: ["Architecture de sécurité", "Isolation tenant", "Chiffrement", "Certifications"] },
];

export default function DocsPage() {
  return (
    <div className="max-w-6xl mx-auto px-6 py-24">
      <div className="text-center mb-16">
        <p className="text-sm font-semibold tracking-[0.2em] uppercase text-slate-400 mb-4">Documentation</p>
        <h1 className="text-4xl md:text-6xl font-bold text-slate-900 mb-4">Tout pour construire avec Cimolace</h1>
        <p className="text-lg text-slate-500 max-w-xl mx-auto">Guides, API reference, tutoriels. Du premier clic à la mise en production.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {sections.map((section) => {
          const Icon = section.icon;
          return (
            <div key={section.title} className="bg-slate-50 border border-slate-100 rounded-2xl p-8 hover:shadow-lg transition-all group">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center mb-4"><Icon className="w-5 h-5 text-indigo-600" /></div>
              <h2 className="text-xl font-bold text-slate-900 mb-2">{section.title}</h2>
              <p className="text-sm text-slate-500 mb-4">{section.desc}</p>
              <ul className="space-y-1.5 mb-6">
                {section.items.map((item) => <li key={item} className="text-sm text-slate-600 flex items-start gap-2"><span className="text-indigo-400 mt-0.5">•</span>{item}</li>)}
              </ul>
              <Link href={section.href} className="inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-700">Explorer<ArrowRight className="w-3 h-3" /></Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}
