import type { Metadata } from "next";

export const metadata: Metadata = { title: "Mentions légales — Cimolace" };

export default function LegalPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-24">
      <h1 className="text-4xl font-bold text-slate-900 mb-8">Mentions légales</h1>
      <div className="prose prose-slate max-w-none space-y-6 text-slate-600">
        <p><strong>Éditeur</strong><br />Cimolace — ISNA Platform<br />SIRET : [À compléter]<br />Contact : legal@cimolace.com</p>
        <p><strong>Hébergement</strong><br />Vercel Inc.<br />340 S Lemon Ave #4133, Walnut, CA 91789, USA<br />Supabase Inc. (base de données)<br />Google Cloud Platform (API & Workers)</p>
        <p><strong>Propriété intellectuelle</strong><br />L&apos;ensemble des contenus (textes, images, logos, marques) présents sur ce site est protégé par le droit de la propriété intellectuelle. Toute reproduction est interdite sans autorisation préalable.</p>
        <p><strong>Données personnelles</strong><br />Conformément au RGPD, vous disposez d&apos;un droit d&apos;accès, de rectification et de suppression de vos données. Contact : dpo@cimolace.com</p>
        <p className="text-xs text-slate-400 mt-12">Dernière mise à jour : Mai 2026</p>
      </div>
    </div>
  );
}
