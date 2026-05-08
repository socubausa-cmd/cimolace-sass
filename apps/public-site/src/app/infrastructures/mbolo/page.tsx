import type { Metadata } from "next";
import { InfraPage } from "@/components/landing/InfraPage";

export const metadata: Metadata = { title: "Boutique Mbolo — Cimolace", description: "E-commerce mobile-first pour l'Afrique. Catalogue, commandes, paiements locaux." };

const engines = ["💳 Pay Engine — Stripe + CinetPay + Orange Money","📦 Catalog — Produits, variants, stocks","📋 Orders — Commandes, livraison, statuts","📱 SMS Engine — Confirmations commande","💬 WhatsApp Engine — Support client","📊 Dashboard — Revenus, clients, statistiques"];

const plans = [
  { name: "Starter", price: "29€", features: ["50 produits","Paiements locaux","Notifications SMS","Dashboard basic","Email support"] },
  { name: "Pro", price: "79€", features: ["Tout Starter","500 produits","WhatsApp intégré","Statistiques avancées","Support prioritaire"], highlight: true },
];

export default function MboloPage() {
  return <InfraPage title="Boutique Mbolo" icon="🛒" tagline="E-commerce mobile-first pour l'Afrique. Paiements CinetPay, Orange Money, MTN." gradient="from-orange-500 to-amber-600" engines={engines} plans={plans} status="coming-soon" />;
}
