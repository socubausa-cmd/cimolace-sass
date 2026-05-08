import type { Metadata } from "next";
import { InfraPage } from "@/components/landing/InfraPage";

export const metadata: Metadata = { title: "Communauté — Cimolace", description: "Forums, événements, cotisations. Créez votre communauté en ligne." };

const features = [
  { title: "Forums", desc: "Discussions thématiques. Modération. Rôles. Réactions. Recherche." },
  { title: "Événements", desc: "Organisez des événements. Inscription, rappels, live intégré." },
  { title: "Cotisations", desc: "Gérez les adhésions. Paiements récurrents. Niveaux d'accès." },
  { title: "Chat", desc: "Messagerie privée et de groupe. Canaux. Fichiers. Audio." },
  { title: "Annuaire", desc: "Profils membres. Compétences. Mise en relation." },
  { title: "Notifications", desc: "Emails, push, in-app. Tenez votre communauté informée." },
];

const plans = [
  { name: "Starter", price: "19€", features: ["50 membres","Forums illimités","Chat de groupe","Événements basic","Email support"] },
  { name: "Pro", price: "49€", features: ["Tout Starter","500 membres","Cotisations activées","Notifications push","Annuaire","Support prioritaire"], highlight: true },
];

export default function CommunityPage() {
  return <InfraPage title="Communauté" icon="👥" tagline="Forums, événements, cotisations. Votre communauté, votre plateforme." gradient="from-cyan-500 to-blue-600" status="coming-soon" features={features} plans={plans} />;
}
