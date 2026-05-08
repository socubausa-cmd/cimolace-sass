"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Badge } from "./Badge";

const infrastructures = [
  { icon: "🏫", name: "École", slug: "ecole", tag: "Formations, lives, certifications", status: "available" as const, gradient: "from-indigo-400 to-purple-400" },
  { icon: "🏥", name: "MedOS", slug: "medos", tag: "Dossiers patients, IA médicale", status: "available" as const, gradient: "from-emerald-400 to-teal-400" },
  { icon: "🌿", name: "Bien-être", slug: "wellness", tag: "Coaching, programmes, suivis", status: "beta" as const, gradient: "from-green-400 to-emerald-400" },
  { icon: "🎬", name: "Créateur", slug: "creator", tag: "Studio, monétisation, VOD", status: "beta" as const, gradient: "from-pink-400 to-rose-400" },
  { icon: "🛒", name: "Mbolo", slug: "mbolo", tag: "E-commerce Afrique", status: "coming-soon" as const, gradient: "from-orange-400 to-amber-400" },
  { icon: "🕌", name: "Temple", slug: "temple", tag: "Spiritualité, cérémonies", status: "coming-soon" as const, gradient: "from-amber-400 to-yellow-400" },
  { icon: "👥", name: "Communauté", slug: "community", tag: "Forums, événements", status: "coming-soon" as const, gradient: "from-cyan-400 to-blue-400" },
];

export function Infrastructures() {
  return (
    <section id="infrastructures" className="relative bg-white py-28 md:py-36">
      <div className="max-w-7xl mx-auto px-6">
        <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.7 }} className="text-center mb-20">
          <p className="text-sm font-semibold tracking-[0.2em] uppercase text-slate-400 mb-4">Infrastructures</p>
          <h2 className="text-4xl md:text-6xl font-bold text-slate-900 leading-[1.1] max-w-4xl mx-auto">7 infrastructures.<br /><span className="text-slate-300">Une plateforme pour chaque métier.</span></h2>
        </motion.div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-6xl mx-auto">
          {infrastructures.map((infra, i) => (
            <Link key={infra.name} href={infra.slug === "medos" ? "/medos" : `/infrastructures/${infra.slug}`}>
              <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.4, delay: i * 0.06 }} whileHover={{ y: -4 }} className="group relative bg-slate-50 border border-slate-100 rounded-2xl p-6 hover:bg-white hover:shadow-lg hover:border-slate-200 transition-all h-full">
                <div className="flex items-start justify-between mb-4"><span className="text-3xl">{infra.icon}</span><Badge variant={infra.status} /></div>
                <h3 className="text-lg font-bold text-slate-900 mb-1">{infra.name}</h3>
                <p className="text-sm text-slate-400">{infra.tag}</p>
                <div className={`mt-4 h-0.5 w-8 rounded-full bg-gradient-to-r ${infra.gradient} opacity-0 group-hover:opacity-100 transition-opacity`} />
              </motion.div>
            </Link>
          ))}
        </div>
        <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: 0.4 }} className="mt-12 text-center">
          <Link href="http://localhost:5173/onboarding" className="inline-flex items-center gap-2 text-slate-900 font-semibold hover:text-slate-600 transition-colors text-sm"><span className="text-lg">⚙️</span> Ou construisez votre propre infrastructure →</Link>
        </motion.div>
      </div>
    </section>
  );
}
