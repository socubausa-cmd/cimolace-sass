import Link from "next/link";
import type { Metadata } from "next";
import { getOnboardingUrl } from "@/lib/urls";

export const metadata: Metadata = {
  title: "MedOS — L'OS médical des praticiens | Cimolace",
  description: "Dossiers patients, notes SOAP, prescriptions, téléconsultation LiveKit, programmes de soins. Multi-tenant, RGPD natif, paiements Europe & Afrique. À partir de 19€/mois.",
  openGraph: {
    title: "MedOS — L'OS médical des praticiens",
    description: "Cabinet digital complet. EHR, IA, téléconsultation. Conformité RGPD.",
    type: "website",
    locale: "fr_FR",
  },
};

export default function MedOSPage() {
  const url = getOnboardingUrl();
  return (
    <>
      <section className="relative overflow-hidden bg-black min-h-[80vh] flex flex-col justify-center">
        <div className="absolute inset-0">
          <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-emerald-600/20 rounded-full blur-[120px]" />
          <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-teal-500/15 rounded-full blur-[100px]" />
        </div>
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.8) 1px, transparent 0)", backgroundSize: "48px 48px" }} />
        <div className="relative z-10 max-w-7xl mx-auto px-6 pt-24 pb-12 text-center">
          <p className="text-sm font-semibold tracking-[0.2em] uppercase text-emerald-400/60 mb-6">Cimolace OS</p>
          <h1 className="text-6xl md:text-8xl font-bold tracking-tight text-white mb-6">MedOS<span className="text-emerald-400">.</span></h1>
          <p className="text-xl md:text-2xl text-white/50 max-w-2xl mx-auto mb-4 font-medium">L&apos;OS médical des praticiens.</p>
          <p className="text-base md:text-lg text-white/40 max-w-xl mx-auto mb-4">Dossiers patients, notes SOAP, prescriptions, programmes de soins.<br />Téléconsultation HD. RGPD natif. Déjà en production.</p>
          <p className="text-sm text-white/30 mb-8">À partir de <span className="text-white/60 font-semibold">0 €/mois</span> — Plan gratuit disponible</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href={url} className="inline-flex items-center justify-center gap-2 bg-emerald-500 text-white px-10 py-4 rounded-full text-lg font-semibold hover:bg-emerald-600 transition-all">Créer mon espace MedOS →</Link>
            <Link href="/pricing" className="inline-flex items-center justify-center gap-2 border border-white/20 text-white px-10 py-4 rounded-full text-lg font-medium hover:bg-white/10 transition-all">Voir les plans</Link>
          </div>
        </div>
      </section>

      <section className="relative bg-white py-28">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <p className="text-sm font-semibold tracking-[0.2em] uppercase text-slate-400 mb-4">Fonctionnalités</p>
          <h2 className="text-4xl md:text-6xl font-bold text-slate-900 mb-6">Tout ce dont un praticien a besoin.</h2>
          <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto mt-12">
            {[
              { emoji: "📋", title: "Dossiers patients (EHR)", desc: "Antécédents, allergies, constantes. Dossier unique par patient." },
              { emoji: "🤖", title: "IA Charting — Notes SOAP", desc: "Deepgram + Claude. Note SOAP en 30 secondes." },
              { emoji: "💊", title: "Ordonnances numériques", desc: "SHA-256, PDF auto, historique complet." },
              { emoji: "🎥", title: "Téléconsultation LiveKit HD", desc: "Vidéo HD, chat intégré, enregistrement auto." },
              { emoji: "🎯", title: "Programmes de soins", desc: "Parcours personnalisés, rappels auto." },
              { emoji: "🔒", title: "Conformité RGPD", desc: "Audit trail, AES-256, export en 1 clic." },
              { emoji: "💳", title: "Paiements Europe & Afrique", desc: "Stripe, CinetPay, Orange Money, MTN." },
              { emoji: "📊", title: "Journal de santé", desc: "Suivi humeur, sommeil, activité." },
              { emoji: "📄", title: "Formulaires médicaux", desc: "5 templates livrés, configurables." },
            ].map((f) => (
              <div key={f.title} className="bg-slate-50 border border-slate-100 rounded-2xl p-6 text-left">
                <div className="text-2xl mb-3">{f.emoji}</div>
                <h3 className="font-semibold text-slate-900 mb-2">{f.title}</h3>
                <p className="text-sm text-slate-500">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative bg-emerald-500 py-20 text-center">
        <div className="max-w-3xl mx-auto px-6">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Prêt à digitaliser votre cabinet ?</h2>
          <p className="text-emerald-100 mb-8">Créez votre espace MedOS en 10 minutes. Plan gratuit disponible.</p>
          <Link href={url} className="inline-flex items-center justify-center gap-2 bg-white text-emerald-600 px-10 py-4 rounded-full text-lg font-semibold hover:bg-emerald-50 transition-all">Créer mon espace MedOS →</Link>
        </div>
      </section>
    </>
  );
}
