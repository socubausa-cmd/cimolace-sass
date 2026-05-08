import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Calendar, Clock } from "lucide-react";

export const metadata: Metadata = {
  title: "Blog — Cimolace",
  description: "Actualités, guides et retours d'expérience sur Cimolace, MedOS et l'écosystème SaaS.",
};

const posts = [
  {
    slug: "pourquoi-construire-sa-plateforme",
    title: "Pourquoi construire sa propre plateforme plutôt que d'empiler des outils",
    excerpt: "Stripe, Zoom, un LMS, un CRM... À force d'assembler des briques, vous passez plus de temps à maintenir qu'à créer. Voici pourquoi une plateforme intégrée change la donne.",
    date: "2 mai 2026",
    readTime: "6 min",
    category: "Stratégie",
  },
  {
    slug: "medos-praticien-digital",
    title: "MedOS : le cabinet médical 100% digital est une réalité",
    excerpt: "Dossiers patients, IA charting, ordonnances numériques et téléconsultation HD. Comment MedOS accélère la transformation digitale des praticiens.",
    date: "28 avril 2026",
    readTime: "5 min",
    category: "MedOS",
  },
  {
    slug: "multi-tenant-saas-securite",
    title: "Multi-tenant natif : pourquoi l'isolation est votre meilleure assurance",
    excerpt: "Triple couche de sécurité (Guard → Filter → RLS), chiffrement AES-256, audit trail. Comment Cimolace garantit une isolation digne des clouds publics.",
    date: "22 avril 2026",
    readTime: "8 min",
    category: "Ingénierie",
  },
  {
    slug: "monetiser-formations-afrique",
    title: "Monétiser ses formations en Afrique : les défis du paiement mobile",
    excerpt: "CinetPay, Orange Money, MTN Mobile Money. Retour sur l'intégration des moyens de paiement africains dans Cimolace Pay Engine.",
    date: "15 avril 2026",
    readTime: "7 min",
    category: "Business",
  },
  {
    slug: "liri-brain-ia-saas",
    title: "LIRI Brain : l'IA conversationnelle au cœur de votre plateforme",
    excerpt: "Streaming SSE, multi-modèles (DeepSeek, Claude, GPT-4o), isolation par tenant. Comment Cimolace intègre l'IA sans compromis sur la sécurité.",
    date: "8 avril 2026",
    readTime: "9 min",
    category: "IA",
  },
];

const categories = ["Tous", "Stratégie", "MedOS", "Ingénierie", "Business", "IA"];

export default function BlogPage() {
  return (
    <div className="max-w-5xl mx-auto px-6 py-24">
      <div className="text-center mb-16">
        <p className="text-sm font-semibold tracking-[0.2em] uppercase text-slate-400 mb-4">Blog</p>
        <h1 className="text-4xl md:text-6xl font-bold text-slate-900 mb-4">Histoires &amp; apprentissages</h1>
        <p className="text-lg text-slate-500 max-w-xl mx-auto">Construire un SaaS, digitaliser un cabinet, lancer une formation. On partage tout.</p>
      </div>

      <div className="flex flex-wrap gap-2 justify-center mb-12">
        {categories.map((c) => (
          <button key={c} className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${c === "Tous" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>{c}</button>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {posts.map((post, i) => (
          <article key={post.slug} className={`group bg-slate-50 border border-slate-100 rounded-2xl p-6 hover:shadow-lg hover:border-slate-200 transition-all ${i === 0 ? "md:col-span-2" : ""}`}>
            <div className="flex items-center gap-4 text-xs text-slate-400 mb-3">
              <span className="bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full font-medium">{post.category}</span>
              <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{post.date}</span>
              <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{post.readTime}</span>
            </div>
            <h2 className={`font-bold text-slate-900 mb-2 group-hover:text-indigo-600 transition-colors ${i === 0 ? "text-2xl" : "text-xl"}`}>
              <Link href={`/blog/${post.slug}`}>{post.title}</Link>
            </h2>
            <p className="text-sm text-slate-500 leading-relaxed">{post.excerpt}</p>
            <Link href={`/blog/${post.slug}`} className="inline-flex items-center gap-1 mt-4 text-sm font-medium text-indigo-600 hover:text-indigo-700">Lire l'article<ArrowRight className="w-3 h-3" /></Link>
          </article>
        ))}
      </div>

      <div className="text-center mt-16">
        <p className="text-slate-400 text-sm">Plus d'articles bientôt. Abonnez-vous pour être notifié.</p>
      </div>
    </div>
  );
}
