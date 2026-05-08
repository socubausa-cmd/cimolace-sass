import type { Metadata } from "next";
import Link from "next/link";
import { Code, ArrowRight } from "lucide-react";

export const metadata: Metadata = {
  title: "API Reference — Cimolace",
  description: "Documentation technique de l'API Cimolace. Endpoints REST, webhooks, authentification JWT.",
};

const endpoints = [
  { method: "GET", path: "/health", desc: "Healthcheck — état du service", auth: false },
  { method: "GET", path: "/auth/me", desc: "Profil utilisateur connecté", auth: "JWT" },
  { method: "POST", path: "/tenants", desc: "Créer un tenant (auto-création)", auth: "JWT" },
  { method: "GET", path: "/tenants/current", desc: "Tenant courant + rôle", auth: "JWT + Tenant" },
  { method: "PATCH", path: "/tenants/current/branding", desc: "Configurer logo/couleurs", auth: "JWT + Tenant + Owner" },
  { method: "POST", path: "/lives", desc: "Créer une session live payante", auth: "JWT + Tenant + Staff" },
  { method: "GET", path: "/lives", desc: "Lister les lives du tenant", auth: "JWT + Tenant" },
  { method: "GET", path: "/lives/:id", desc: "Détail d'un live", auth: "JWT + Tenant" },
  { method: "GET", path: "/lives/:id/token", desc: "Token LiveKit pour rejoindre", auth: "JWT + Tenant" },
  { method: "POST", path: "/checkout/sessions", desc: "Créer une session Stripe", auth: "JWT" },
  { method: "POST", path: "/checkout/webhook/stripe", desc: "Webhook Stripe entrant", auth: false },
  { method: "GET", path: "/cimolace/catalog", desc: "Catalogue des moteurs (public)", auth: false },
  { method: "GET", path: "/marketing/promo-codes", desc: "Codes promo du tenant", auth: "JWT + Tenant" },
  { method: "GET", path: "/billing/subscription", desc: "Abonnement SaaS du tenant", auth: "JWT + Tenant + Admin" },
];

const methodColors: Record<string, string> = {
  GET: "bg-emerald-50 text-emerald-700",
  POST: "bg-indigo-50 text-indigo-700",
  PATCH: "bg-amber-50 text-amber-700",
  DELETE: "bg-red-50 text-red-700",
};

export default function ApiReferencePage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-24">
      <div className="mb-16">
        <div className="flex items-center gap-2 text-sm text-slate-400 mb-6">
          <Link href="/docs" className="hover:text-slate-600">Documentation</Link>
          <span>/</span>
          <span className="text-slate-700">API Reference</span>
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">API Reference</h1>
        <p className="text-lg text-slate-500 max-w-2xl">API REST Cimolace — Tous les endpoints sont préfixés par <code className="bg-slate-100 px-1.5 py-0.5 rounded text-sm font-mono text-slate-700">https://api.cimolace.com</code></p>
      </div>

      <section className="mb-16">
        <h2 className="text-2xl font-bold text-slate-900 mb-2 flex items-center gap-2"><Code className="w-6 h-6 text-indigo-500" />Endpoints</h2>
        <p className="text-slate-500 mb-8">Tous les endpoints retournent le format <code className="bg-slate-100 px-1 py-0.5 rounded text-xs font-mono">{`{ data }`}</code> ou <code className="bg-slate-100 px-1 py-0.5 rounded text-xs font-mono">{`{ error: { code, message } }`}</code></p>
        <div className="space-y-1 border border-slate-200 rounded-2xl overflow-hidden">
          {endpoints.map((ep, i) => (
            <div key={i} className={`flex items-center gap-4 px-5 py-3 ${i % 2 === 0 ? "bg-white" : "bg-slate-50"}`}>
              <span className={`text-xs font-bold px-2 py-0.5 rounded w-14 text-center ${methodColors[ep.method]}`}>{ep.method}</span>
              <code className="text-sm font-mono text-slate-700 flex-1">{ep.path}</code>
              <span className="text-xs text-slate-500 hidden sm:block">{ep.desc}</span>
              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${ep.auth ? "bg-slate-200 text-slate-600" : "bg-green-50 text-green-600"}`}>{ep.auth ? ep.auth : "Public"}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-slate-50 border border-slate-100 rounded-2xl p-8">
        <h2 className="text-xl font-bold text-slate-900 mb-4">Authentification</h2>
        <p className="text-sm text-slate-600 leading-relaxed mb-4">Tous les endpoints protégés nécessitent un token JWT Supabase dans le header <code className="bg-slate-200 px-1 py-0.5 rounded text-xs">Authorization: Bearer &lt;token&gt;</code></p>
        <p className="text-sm text-slate-600 leading-relaxed mb-4">Les endpoints multi-tenant nécessitent le header <code className="bg-slate-200 px-1 py-0.5 rounded text-xs">X-Tenant-Slug: &lt;slug&gt;</code></p>
        <Link href="/docs/security" className="inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-700">En savoir plus sur la sécurité<ArrowRight className="w-3 h-3" /></Link>
      </section>
    </div>
  );
}
