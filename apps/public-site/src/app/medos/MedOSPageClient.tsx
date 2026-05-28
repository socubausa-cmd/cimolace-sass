"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  Brain, Shield, Globe, CreditCard, ArrowRight, Sparkles,
  Stethoscope, FileText, Pill, Video, Target, ClipboardCheck,
  Lock, ChartBar, Users, ChevronRight,
} from "lucide-react";

// ── Data ──────────────────────────────────────────────────────────────────

const features = [
  { icon: Stethoscope, title: "Dossiers patients (EHR)", desc: "Antécédents complets, allergies, constantes, historique. Un dossier unique par patient, partagé entre praticiens du tenant.", color: "from-emerald-400 to-teal-500" },
  { icon: Brain, title: "IA Charting — Notes SOAP", desc: "Deepgram transcrit la consultation en temps réel. Claude génère un brouillon SOAP structuré en 30 secondes. Le praticien révise, valide, signe.", color: "from-purple-400 to-pink-500" },
  { icon: Pill, title: "Ordonnances numériques", desc: "Prescriptions signées SHA-256. Export PDF automatique via Puppeteer. Historique complet. Envoi pharmacie par fax/email.", color: "from-blue-400 to-cyan-500" },
  { icon: Video, title: "Téléconsultation LiveKit HD", desc: "Vidéo HD, audio cristallin. Enregistrement automatique. Chat intégré. Partage d'écran pour résultats d'analyse.", color: "from-red-400 to-orange-500" },
  { icon: Target, title: "Programmes de soins", desc: "Créez des parcours de soins personnalisés. Étapes J+N. Rappels email/SMS automatiques. Suivi d'observance.", color: "from-amber-400 to-yellow-500" },
  { icon: ClipboardCheck, title: "Formulaires médicaux", desc: "5 templates livrés : intake, bilan nutritionnel, consentement, PHQ-9, suivi post-consultation. Configurable.", color: "from-green-400 to-emerald-500" },
  { icon: Lock, title: "Conformité RGPD", desc: "Consentement électronique. Audit trail complet. Chiffrement AES-256. Droit à l'effacement. Export dossier patient en 1 clic.", color: "from-slate-400 to-slate-600" },
  { icon: ChartBar, title: "Journal de santé", desc: "Suivi humeur, sommeil, activité, alimentation. Visualisation des tendances. Alertes en cas d'anomalie.", color: "from-indigo-400 to-blue-500" },
  { icon: CreditCard, title: "Paiements Europe & Afrique", desc: "Stripe, CinetPay, Orange Money, MTN Mobile Money. Consultation payante ou abonnement. Facturation automatique.", color: "from-rose-400 to-pink-500" },
];

const plans = [
  { name: "Sprout", price: "0€", period: "/mois", desc: "Pour démarrer", features: ["3 patients", "Dossiers patients", "1 formulaire", "Support email"], cta: "Démarrer gratuitement", highlight: false },
  { name: "Solo", price: "19€", period: "/mois", desc: "Praticien indépendant", features: ["50 patients", "Notes SOAP + IA", "Ordonnances PDF", "20 consultations IA/mois", "Formulaires illimités"], cta: "Commencer", highlight: true },
  { name: "Pro", price: "49€", period: "/mois", desc: "Cabinet établi", features: ["200 patients", "Téléconsultation HD", "Programmes de soins", "Journal santé", "Support prioritaire"], cta: "Commencer", highlight: false },
  { name: "Clinic", price: "99€", period: "/mois", desc: "Clinique / groupe", features: ["Patients illimités", "White Label", "Multi-praticiens", "API access", "Account manager"], cta: "Contacter", highlight: false },
];

const securityItems = [
  { icon: Shield, title: "Chiffrement AES-256", desc: "Toutes les données de santé au repos et en transit." },
  { icon: Lock, title: "Isolation multi-tenant", desc: "Triple couche : API Guard → Service Filter → RLS PostgreSQL." },
  { icon: FileText, title: "Audit trail", desc: "Chaque accès, modification, export est journalisé et immuable." },
  { icon: Globe, title: "Hébergement UE", desc: "Données hébergées en Europe (Supabase / Google Cloud)." },
];

// ── Component ─────────────────────────────────────────────────────────────

export function MedOSPageClient({ onboardingUrl }: { onboardingUrl: string }) {
  return (
    <>
      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-black min-h-[80vh] flex flex-col justify-center">
        <div className="absolute inset-0">
          <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-emerald-600/20 rounded-full blur-[120px] animate-float" />
          <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-teal-500/15 rounded-full blur-[100px] animate-float" style={{ animationDelay: "-3s" }} />
        </div>
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.8) 1px, transparent 0)", backgroundSize: "48px 48px" }} />
        <div className="relative z-10 max-w-7xl mx-auto px-6 pt-24 pb-12 text-center">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: [0.25, 0.1, 0.25, 1] }}>
            <p className="text-sm font-semibold tracking-[0.2em] uppercase text-emerald-400/60 mb-6">Cimolace OS</p>
            <h1 className="text-6xl md:text-8xl font-bold tracking-tight text-white mb-6">MedOS<span className="text-emerald-400">.</span></h1>
          </motion.div>
          <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2 }} className="text-xl md:text-2xl text-white/50 max-w-2xl mx-auto mb-4 font-medium">L&apos;OS médical des praticiens.</motion.p>
          <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.35 }} className="text-base md:text-lg text-white/40 max-w-xl mx-auto mb-4">Dossiers patients, notes SOAP, prescriptions, programmes de soins.<br />Téléconsultation HD. RGPD natif. Déjà en production.</motion.p>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5, delay: 0.45 }} className="text-sm text-white/30 mb-8">À partir de <span className="text-white/60 font-semibold">0 €/mois</span> — Plan gratuit disponible</motion.p>
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.55 }} className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href={onboardingUrl} className="group inline-flex items-center justify-center gap-2 bg-emerald-500 text-white px-10 py-4 rounded-full text-lg font-semibold hover:bg-emerald-600 transition-all">Créer mon espace MedOS<ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" /></Link>
            <Link href="/pricing" className="inline-flex items-center justify-center gap-2 border border-white/20 text-white px-10 py-4 rounded-full text-lg font-medium hover:bg-white/10 transition-all">Voir les plans</Link>
          </motion.div>
        </div>
      </section>

      {/* ── Features ───────────────────────────────────────────────────── */}
      <section className="relative bg-white py-28 md:py-36">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.7 }} className="text-center mb-20">
            <p className="text-sm font-semibold tracking-[0.2em] uppercase text-slate-400 mb-4">Fonctionnalités</p>
            <h2 className="text-4xl md:text-6xl font-bold text-slate-900 leading-[1.1] max-w-4xl mx-auto">Tout ce dont un praticien<br /><span className="text-slate-300">a besoin. Rien de superflu.</span></h2>
          </motion.div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {features.map((feat, i) => {
              const Icon = feat.icon;
              return (
                <motion.div key={feat.title} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.4, delay: i * 0.06 }} className="group relative bg-slate-50 border border-slate-100 rounded-2xl p-6 hover:bg-white hover:shadow-lg hover:border-slate-200 transition-all">
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${feat.color} flex items-center justify-center mb-4`}><Icon className="w-5 h-5 text-white" /></div>
                  <h3 className="font-semibold text-slate-900 mb-2">{feat.title}</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">{feat.desc}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Plans MedOS ────────────────────────────────────────────────── */}
      <section className="relative bg-slate-50 py-28 md:py-36">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.7 }} className="text-center mb-20">
            <p className="text-sm font-semibold tracking-[0.2em] uppercase text-slate-400 mb-4">Plans MedOS</p>
            <h2 className="text-4xl md:text-5xl font-bold text-slate-900 leading-[1.1] max-w-3xl mx-auto">Un plan pour chaque<br /><span className="text-slate-300">étape de votre pratique.</span></h2>
          </motion.div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-6xl mx-auto">
            {plans.map((plan, i) => (
              <motion.div key={plan.name} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.4, delay: i * 0.08 }} whileHover={{ y: -4 }} className={`relative bg-white rounded-2xl p-6 flex flex-col ${plan.highlight ? "border-2 border-emerald-500 shadow-lg ring-1 ring-emerald-500/20" : "border border-slate-200"}`}>
                {plan.highlight && <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-emerald-500 text-white text-xs font-semibold px-4 py-1 rounded-full flex items-center gap-1"><Sparkles className="w-3 h-3" />Recommandé</span>}
                <h3 className="text-lg font-bold text-slate-900 mb-1">{plan.name}</h3>
                <p className="text-xs text-slate-400 mb-4">{plan.desc}</p>
                <div className="mb-6"><span className="text-4xl font-bold text-slate-900">{plan.price}</span><span className="text-slate-400 text-sm">{plan.period}</span></div>
                <ul className="space-y-2.5 mb-8 flex-1">{plan.features.map((f) => <li key={f} className="flex items-start gap-2 text-xs text-slate-600"><span className="text-emerald-500 mt-0.5 flex-shrink-0">✓</span>{f}</li>)}</ul>
                <Link href={onboardingUrl} className={`block text-center py-2.5 rounded-full text-sm font-semibold transition-all ${plan.highlight ? "bg-emerald-500 text-white hover:bg-emerald-600" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>{plan.cta}</Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Sécurité ───────────────────────────────────────────────────── */}
      <section className="relative bg-black py-28 md:py-36 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-black via-slate-950 to-black" />
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-emerald-500/5 rounded-full blur-[120px]" />
        <div className="relative z-10 max-w-7xl mx-auto px-6">
          <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.7 }} className="text-center mb-20">
            <p className="text-sm font-semibold tracking-[0.2em] uppercase text-emerald-400/40 mb-4">Sécurité & Conformité</p>
            <h2 className="text-4xl md:text-5xl font-bold text-white leading-[1.1] max-w-3xl mx-auto">Vos données patients<br /><span className="text-white/30">sont une responsabilité.</span></h2>
          </motion.div>
          <div className="grid sm:grid-cols-2 gap-4 max-w-4xl mx-auto">
            {securityItems.map((item, i) => {
              const Icon = item.icon;
              return (
                <motion.div key={item.title} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.4, delay: i * 0.08 }} className="bg-white/[0.02] border border-white/[0.04] rounded-2xl p-6 flex gap-4">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center flex-shrink-0"><Icon className="w-5 h-5 text-emerald-400" /></div>
                  <div><h4 className="font-semibold text-white mb-1">{item.title}</h4><p className="text-sm text-white/30">{item.desc}</p></div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Final CTA ──────────────────────────────────────────────────── */}
      <section className="relative bg-white py-20 text-center">
        <div className="max-w-3xl mx-auto px-6">
          <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">Prêt à digitaliser votre cabinet ?</h2>
          <p className="text-lg text-slate-500 mb-10">Créez votre espace MedOS en 10 minutes. Plan gratuit disponible.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href={onboardingUrl} className="group inline-flex items-center justify-center gap-2 bg-emerald-500 text-white px-10 py-4 rounded-full text-lg font-semibold hover:bg-emerald-600 transition-all">Créer mon espace MedOS<ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" /></Link>
            <Link href="/medos/integration" className="inline-flex items-center justify-center gap-2 border border-slate-300 text-slate-700 px-10 py-4 rounded-full text-lg font-medium hover:bg-slate-50 transition-all">Comment intégrer<ChevronRight className="w-5 h-5" /></Link>
            <Link href="/pricing" className="inline-flex items-center justify-center gap-2 border border-slate-300 text-slate-700 px-10 py-4 rounded-full text-lg font-medium hover:bg-slate-50 transition-all">Comparer les plans<ChevronRight className="w-5 h-5" /></Link>
          </div>
        </div>
      </section>
    </>
  );
}
