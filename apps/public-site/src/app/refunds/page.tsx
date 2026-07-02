import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Politique de remboursement — Cimolace" };

export default function RefundsPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-24">
      <h1 className="text-4xl font-bold text-slate-900 mb-8">Politique de remboursement</h1>
      <div className="prose prose-slate max-w-none space-y-6 text-slate-600">
        <p>Cette politique décrit les conditions de remboursement des achats effectués sur Cimolace (entreprise individuelle, Gabon). Les paiements et remboursements par carte sont traités par notre <em>Merchant of Record</em>, <strong>Paddle.com Market Ltd</strong>.</p>

        <p><strong>1. Achats numériques ponctuels</strong><br />Les produits et contenus numériques sont remboursables dans un délai de <strong>14 jours</strong> suivant l&apos;achat, à condition qu&apos;ils n&apos;aient pas été consommés, téléchargés ou substantiellement utilisés.</p>

        <p><strong>2. Abonnements</strong><br />Les abonnements sont résiliables à tout moment. À la résiliation, vous conservez l&apos;accès jusqu&apos;à la fin de la période déjà payée ; les périodes entamées ne font pas l&apos;objet d&apos;un remboursement au prorata.</p>

        <p><strong>3. Sessions live, cours et consultations</strong><br />Les prestations en direct (sessions live, consultations, accompagnements) ne sont pas remboursables une fois la prestation fournie ou la session commencée.</p>

        <p><strong>4. Demande de remboursement</strong><br />Pour toute demande éligible, contactez-nous à <strong>infos@prorascience.org</strong> en précisant votre numéro de commande. Les remboursements approuvés sont effectués sur le moyen de paiement d&apos;origine, via Paddle.</p>

        <p><strong>5. Exceptions</strong><br />Aucun remboursement n&apos;est accordé en cas d&apos;utilisation abusive, de manquement aux <Link href="/terms">Conditions d&apos;utilisation</Link>, ou pour des prestations déjà intégralement fournies.</p>

        <p className="text-xs text-slate-400 mt-12">Dernière mise à jour : juillet 2026</p>
      </div>
    </div>
  );
}
