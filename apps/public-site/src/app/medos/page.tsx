import Link from "next/link";
import type { Metadata } from "next";
import { getOnboardingUrl } from "@/lib/urls";

export const metadata: Metadata = { title: "MedOS — Plateforme médicale | Cimolace", description: "Dossiers patients, notes SOAP, prescriptions, téléconsultation LiveKit." };

export default function MedOSPage() {
  return (
    <>
      <section className="max-w-4xl mx-auto px-6 pt-24 pb-16 text-center">
        <h1 className="text-5xl font-bold text-gray-900 mb-4">MedOS — <span className="text-emerald-600">l&apos;OS médical</span> des praticiens</h1>
        <p className="text-lg text-gray-500 max-w-2xl mx-auto mb-10">Dossiers patients, notes SOAP, ordonnances, programmes de soins et téléconsultation. Multi-tenant, RGPD-compliant.</p>
        <div className="flex gap-4 justify-center">
          <Link href={getOnboardingUrl()} className="bg-emerald-600 text-white px-8 py-3 rounded-xl text-lg font-medium hover:bg-emerald-700 shadow-lg shadow-emerald-200">Démarrer MedOS</Link>
          <Link href="/pricing" className="border border-gray-300 text-gray-700 px-8 py-3 rounded-xl text-lg font-medium hover:bg-gray-50">Voir les tarifs</Link>
        </div>
      </section>
      <section className="max-w-5xl mx-auto px-6 pb-24 grid grid-cols-1 md:grid-cols-3 gap-8">
        {[
          { title: "Dossiers patients", desc: "EHR complet : antécédents, allergies, constantes.", emoji: "📋" },
          { title: "Notes SOAP + IA", desc: "L'IA transcrit et génère un draft SOAP via Claude.", emoji: "🤖" },
          { title: "Ordonnances", desc: "Signature SHA-256, PDF automatique, fax pharmacie.", emoji: "💊" },
          { title: "Téléconsultation HD", desc: "LiveKit intégré. Qualité HD, enregistrement auto.", emoji: "🎥" },
          { title: "Programmes de soins", desc: "Programmes personnalisés, automatisations email/SMS.", emoji: "🎯" },
          { title: "Formulaires médicaux", desc: "Intake, consentement, PHQ-9. 5 templates livrés.", emoji: "📄" },
          { title: "Paiements Afrique & Europe", desc: "Stripe, CinetPay, Orange Money, MTN.", emoji: "💳" },
          { title: "Conformité RGPD", desc: "Audit trail, chiffrement AES-256, droit à l'effacement.", emoji: "🔒" },
          { title: "Journal santé", desc: "Humeur, sommeil, activité, repas. Tendances.", emoji: "📊" },
        ].map((f) => (
          <div key={f.title} className="bg-gray-50 border border-gray-100 rounded-2xl p-6">
            <div className="text-2xl mb-3">{f.emoji}</div>
            <h3 className="font-semibold text-gray-900 mb-2">{f.title}</h3>
            <p className="text-sm text-gray-500">{f.desc}</p>
          </div>
        ))}
      </section>
      <section className="bg-emerald-600 text-white py-16 text-center">
        <h2 className="text-3xl font-bold mb-4">Prêt à digitaliser votre cabinet ?</h2>
        <Link href={getOnboardingUrl()} className="inline-block bg-white text-emerald-600 px-8 py-3 rounded-xl text-lg font-semibold hover:bg-emerald-50">Créer mon espace MedOS</Link>
      </section>
    </>
  );
}
