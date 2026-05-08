import type { Metadata } from "next";

export const metadata: Metadata = { title: "RGPD — Cimolace" };

export default function RGPDPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-24">
      <h1 className="text-4xl font-bold text-slate-900 mb-8">Politique de confidentialité (RGPD)</h1>
      <div className="prose prose-slate max-w-none space-y-6 text-slate-600">
        <h2 className="text-xl font-semibold text-slate-900 mt-8">1. Collecte des données</h2>
        <p>Nous collectons uniquement les données nécessaires à la fourniture du service : email, nom, informations de paiement, et données liées à votre utilisation de la plateforme (tenants, contenus, statistiques).</p>
        <p>Pour MedOS, les données de santé sont traitées conformément à l&apos;Article 9 du RGPD avec consentement explicite du patient.</p>

        <h2 className="text-xl font-semibold text-slate-900 mt-8">2. Base légale</h2>
        <p>Le traitement repose sur : l&apos;exécution du contrat (fourniture du service SaaS), le consentement (données de santé MedOS), et l&apos;intérêt légitime (amélioration du service, sécurité).</p>

        <h2 className="text-xl font-semibold text-slate-900 mt-8">3. Hébergement</h2>
        <p>Les données sont hébergées chez : Supabase (PostgreSQL, Auth, Storage) — région UE (Frankfurt), Google Cloud Platform (API, Workers) — région UE, et Vercel (frontend) — edge network global.</p>

        <h2 className="text-xl font-semibold text-slate-900 mt-8">4. Vos droits</h2>
        <p>Vous disposez des droits d&apos;accès, de rectification, d&apos;effacement, de portabilité et de limitation du traitement. Pour MedOS, l&apos;export complet du dossier patient est disponible en 1 clic depuis l&apos;interface praticien.</p>
        <p>Contact DPO : dpo@cimolace.com</p>

        <h2 className="text-xl font-semibold text-slate-900 mt-8">5. Sécurité</h2>
        <p>Toutes les données sont chiffrées en transit (TLS 1.3) et au repos (AES-256). Les secrets de paiement sont chiffrés avec AES-256-GCM. L&apos;isolation multi-tenant est garantie par une triple couche : API Guard → Service Filter → RLS PostgreSQL.</p>

        <h2 className="text-xl font-semibold text-slate-900 mt-8">6. Cookies</h2>
        <p>Ce site utilise uniquement des cookies techniques essentiels (session, auth Supabase). Aucun cookie publicitaire ou de tracking.</p>

        <p className="text-xs text-slate-400 mt-12">Dernière mise à jour : Mai 2026</p>
      </div>
    </div>
  );
}
