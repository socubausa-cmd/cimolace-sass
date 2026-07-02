import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Conditions d'utilisation — Cimolace" };

export default function TermsPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-24">
      <h1 className="text-4xl font-bold text-slate-900 mb-8">Conditions d&apos;utilisation</h1>
      <div className="prose prose-slate max-w-none space-y-6 text-slate-600">
        <p><strong>1. Éditeur</strong><br />Cimolace — entreprise individuelle enregistrée au Gabon.<br />Contact : infos@prorascience.org</p>

        <p><strong>2. Objet</strong><br />Cimolace est une plateforme logicielle (SaaS) multi-tenant permettant de créer et d&apos;exploiter des espaces numériques : écoles et formations (LIRI), santé et bien-être (MedOS), boutiques (mbolo) et outils pour créateurs. Les présentes conditions régissent l&apos;accès et l&apos;utilisation de ces services.</p>

        <p><strong>3. Compte</strong><br />L&apos;accès à certains services nécessite la création d&apos;un compte. Vous êtes responsable de l&apos;exactitude des informations fournies, de la confidentialité de vos identifiants et de toute activité effectuée depuis votre compte.</p>

        <p><strong>4. Abonnements et paiements</strong><br />Les services payants sont proposés sous forme d&apos;achats ponctuels ou d&apos;abonnements, aux tarifs indiqués sur la page <Link href="/pricing">Tarification</Link>. Les paiements par carte sont traités par notre revendeur et <em>Merchant of Record</em>, <strong>Paddle.com Market Ltd</strong>, qui figure à ce titre sur votre relevé bancaire et gère la facturation, les taxes applicables et les remboursements. Les abonnements sont renouvelés automatiquement jusqu&apos;à résiliation.</p>

        <p><strong>5. Utilisation acceptable</strong><br />Vous vous engagez à ne pas utiliser les services à des fins illégales, à ne pas porter atteinte aux droits de tiers, à ne pas tenter d&apos;altérer la sécurité ou l&apos;intégrité de la plateforme, et à respecter les lois applicables.</p>

        <p><strong>6. Propriété intellectuelle</strong><br />La plateforme, ses contenus, marques et logiciels sont protégés. Les contenus que vous publiez restent votre propriété ; vous nous accordez la licence nécessaire à leur hébergement et à la fourniture du service.</p>

        <p><strong>7. Disponibilité et responsabilité</strong><br />Les services sont fournis « en l&apos;état ». Nous mettons en œuvre des moyens raisonnables pour assurer leur disponibilité, sans garantir une absence totale d&apos;interruption. Notre responsabilité est limitée dans les conditions permises par la loi.</p>

        <p><strong>8. Résiliation</strong><br />Vous pouvez cesser d&apos;utiliser les services et résilier votre abonnement à tout moment. Nous pouvons suspendre un compte en cas de manquement aux présentes conditions.</p>

        <p><strong>9. Remboursements</strong><br />Les modalités sont décrites dans notre <Link href="/refunds">Politique de remboursement</Link>.</p>

        <p><strong>10. Données personnelles</strong><br />Le traitement de vos données est décrit dans notre <Link href="/rgpd">Politique de confidentialité</Link>.</p>

        <p><strong>11. Droit applicable</strong><br />Les présentes conditions sont régies par le droit gabonais. Tout litige relève des juridictions compétentes du Gabon.</p>

        <p><strong>12. Contact</strong><br />Pour toute question : infos@prorascience.org</p>

        <p className="text-xs text-slate-400 mt-12">Dernière mise à jour : juillet 2026</p>
      </div>
    </div>
  );
}
