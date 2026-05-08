import type { Metadata } from "next";
import { InfraPage } from "@/components/landing/InfraPage";

export const metadata: Metadata = { title: "Boutique Mbolo — Cimolace", description: "E-commerce mobile-first pour l'Afrique. Catalogue, commandes, paiements locaux." };

const features = [
  { title: "Catalogue produits", desc: "Gérez vos produits, variants, stocks. Photos, descriptions, prix." },
  { title: "Paiements Afrique", desc: "CinetPay, Orange Money, MTN Mobile Money, Chariow. Vos clients paient comme ils veulent." },
  { title: "Commandes & Livraison", desc: "Suivi des commandes. Statuts personnalisables. Notifications SMS/WhatsApp." },
  { title: "SMS & WhatsApp", desc: "Confirmation de commande, mise à jour livraison. Communication directe avec vos clients." },
  { title: "Dashboard vendeur", desc: "Revenus, commandes, clients. Tout dans un tableau de bord simple." },
  { title: "Mobile-first", desc: "Design optimisé pour les connexions africaines. Faible bande passante. Mode hors-ligne." },
];

const plans = [
  { name: "Starter", price: "29€", features: ["50 produits","Paiements locaux","Notifications SMS","Dashboard basic","Email support"] },
  { name: "Pro", price: "79€", features: ["Tout Starter","500 produits","WhatsApp intégré","Statistiques avancées","Support prioritaire"], highlight: true },
];

export default function MboloPage() {
  return <InfraPage title="Boutique Mbolo" icon="🛒" tagline="E-commerce mobile-first pour l'Afrique. Catalogue, commandes, paiements locaux." gradient="from-orange-500 to-amber-600" status="coming-soon" features={features} plans={plans} />;
}
