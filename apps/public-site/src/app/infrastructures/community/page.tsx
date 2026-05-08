import type { Metadata } from "next";
import { InfraPage } from "@/components/landing/InfraPage";

export const metadata: Metadata = { title: "Communauté — Cimolace", description: "Forums, événements, cotisations. Créez votre communauté en ligne." };

const engines = ["👥 Forum — Discussions thématiques + modération","📅 Calendar — Événements & inscriptions","💬 Chat Engine — Canaux publics & privés","💳 Pay Engine — Cotisations & adhésions","📢 Notification Engine — Emails, push, in-app","📊 Activity Stream — Fil d'actualité communautaire"];

const plans = [
  { name: "Starter", price: "19€", features: ["50 membres","Forums illimités","Chat de groupe","Événements basic","Email support"] },
  { name: "Pro", price: "49€", features: ["Tout Starter","500 membres","Cotisations activées","Notifications push","Annuaire","Support prioritaire"], highlight: true },
];

export default function CommunityPage() {
  return <InfraPage title="Communauté" icon="👥" tagline="Forums, événements, cotisations. Votre communauté, votre plateforme." gradient="from-cyan-500 to-blue-600" engines={engines} plans={plans} status="coming-soon" />;
}
