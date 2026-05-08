"use client";

import Link from "next/link";
import { Globe, BookOpen, MessageCircle, Mail } from "lucide-react";
import { getOnboardingUrl } from "@/lib/urls";

const footerLinks = {
  Produit: [{ label: "Infrastructures", href: "#infrastructures" },{ label: "Moteurs", href: "#engines" },{ label: "MedOS", href: "/medos" },{ label: "Tarifs", href: "/pricing" }],
  Ressources: [{ label: "Blog", href: "#" },{ label: "Documentation", href: "#" },{ label: "API Reference", href: "#" },{ label: "Statut", href: "#" }],
  Entreprise: [{ label: "À propos", href: "#" },{ label: "Contact", href: "#" },{ label: "Mentions légales", href: "#" },{ label: "RGPD", href: "#" }],
};

export function LandingFooter() {
  const onboardingUrl = getOnboardingUrl();
  return (
    <footer className="bg-slate-900 text-white">
      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-10">
          <div className="lg:col-span-2">
            <Link href="/" className="text-2xl font-bold tracking-tight text-white inline-block mb-4">Cimolace</Link>
            <p className="text-sm text-slate-400 leading-relaxed max-w-xs mb-6">L&apos;OS SaaS multi-tenant qui crée des plateformes. Écoles, cliniques, créateurs, boutiques — votre infrastructure, vos règles, zéro code.</p>
            <div className="flex gap-3">
              {[Globe, BookOpen, MessageCircle, Mail].map((Icon, i) => <a key={i} href="#" className="w-9 h-9 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center transition-colors"><Icon className="w-4 h-4 text-slate-400" /></a>)}
            </div>
          </div>
          {Object.entries(footerLinks).map(([title, links]) => (
            <div key={title}>
              <h4 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4">{title}</h4>
              <ul className="space-y-2.5">{links.map((link) => <li key={link.label}><Link href={link.href} className="text-sm text-slate-400 hover:text-white transition-colors">{link.label}</Link></li>)}</ul>
            </div>
          ))}
        </div>
      </div>
      <div className="border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-slate-500">© {new Date().getFullYear()} Cimolace — ISNA Platform. Tous droits réservés.</p>
          <Link href={onboardingUrl} className="text-xs text-brand-400 hover:text-brand-300 transition-colors font-medium">Créer ma plateforme →</Link>
        </div>
      </div>
    </footer>
  );
}
