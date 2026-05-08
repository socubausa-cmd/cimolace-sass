import type { Metadata } from "next";
import Link from "next/link";
import { Check, Minus } from "lucide-react";

export const metadata: Metadata = {
  title: "Statut — Cimolace",
  description: "Statut des services Cimolace. Disponibilité en temps réel.",
};

const services = [
  { name: "API Cimolace", status: "operational", uptime: "99.97%", metrics: "12ms p95" },
  { name: "Supabase — Base de données", status: "operational", uptime: "99.99%", metrics: "8ms avg" },
  { name: "Supabase — Auth", status: "operational", uptime: "99.99%", metrics: "45ms p95" },
  { name: "LiveKit Cloud", status: "operational", uptime: "99.95%", metrics: "Frankfurt" },
  { name: "Stripe — Paiements", status: "operational", uptime: "99.99%", metrics: "Europe" },
  { name: "Workers IA & Vidéo", status: "degraded", uptime: "98.2%", metrics: "Queue retardée" },
  { name: "Meilisearch", status: "operational", uptime: "99.8%", metrics: "15ms p50" },
];

const incidents = [
  { date: "7 mai 2026", title: "Latence accrue sur Workers IA", status: "investigating", desc: "Nous investiguons une latence de ~4s sur les jobs de transcription. Le service reste fonctionnel." },
  { date: "4 mai 2026", title: "Maintenance Supabase planifiée", status: "resolved", desc: "Migration PostgreSQL 15 → 16. Fenêtre de 5 min. Aucune interruption mesurée." },
  { date: "1 mai 2026", title: "Intermittence LiveKit Frankfurt", status: "resolved", desc: "Dégradation de 12 min sur le relay Frankfurt. Résolu par le failover automatique." },
];

const statusColors: Record<string, string> = {
  operational: "bg-emerald-50 text-emerald-700 border-emerald-200",
  degraded: "bg-amber-50 text-amber-700 border-amber-200",
  outage: "bg-red-50 text-red-700 border-red-200",
};
const statusLabels: Record<string, string> = {
  operational: "✅ Opérationnel",
  degraded: "⚠️ Dégradé",
  outage: "🔴 Interruption",
};

export default function StatusPage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-24">
      <div className="text-center mb-16">
        <p className="text-sm font-semibold tracking-[0.2em] uppercase text-slate-400 mb-4">Statut</p>
        <h1 className="text-4xl md:text-6xl font-bold text-slate-900 mb-4">Cimolace Status</h1>
        <p className="text-lg text-slate-500">Disponibilité des services en temps réel.</p>
      </div>

      <div className="grid gap-3 mb-16">
        {services.map((svc) => (
          <div key={svc.name} className={`flex items-center justify-between p-4 rounded-xl border ${statusColors[svc.status]}`}>
            <div>
              <p className="font-medium text-slate-900">{svc.name}</p>
              <p className="text-xs text-slate-500">{svc.metrics}</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium">{statusLabels[svc.status]}</p>
              <p className="text-xs opacity-70">{svc.uptime}</p>
            </div>
          </div>
        ))}
      </div>

      <h2 className="text-2xl font-bold text-slate-900 mb-6">Incidents récents</h2>
      <div className="space-y-3">
        {incidents.map((inc) => (
          <div key={inc.date} className="bg-slate-50 border border-slate-100 rounded-xl p-5">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-xs text-slate-400 font-medium">{inc.date}</span>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${inc.status === "resolved" ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"}`}>{inc.status === "resolved" ? "Résolu" : "En cours"}</span>
            </div>
            <h3 className="font-semibold text-slate-900 mb-1">{inc.title}</h3>
            <p className="text-sm text-slate-500">{inc.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
