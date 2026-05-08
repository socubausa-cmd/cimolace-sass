import type { Metadata } from "next";
import { InfraPage } from "@/components/landing/InfraPage";

export const metadata: Metadata = { title: "Temple & Spiritualité — Cimolace", description: "Cérémonies, initiations, dons, cercles. Votre communauté spirituelle en ligne." };

const engines = ["📡 LIRI Live — Cérémonies & initiations en direct","📅 Calendar — Agenda des rites & célébrations","👥 Forum — Cercles de discussion privés","💳 Pay Engine — Dons & cotisations en ligne","💬 Chat Engine — Messagerie communautaire","📚 Library — Textes sacrés & enseignements"];

const plans = [
  { name: "Starter", price: "19€", features: ["5 cérémonies/mois","50 membres","Dons activés","Bibliothèque basic","Email support"] },
  { name: "Pro", price: "49€", features: ["Tout Starter","Cérémonies illimitées","500 membres","Cercles privés","Agenda sacré","Support prioritaire"], highlight: true },
];

export default function TemplePage() {
  return <InfraPage title="Temple & Spiritualité" icon="🕌" tagline="Cérémonies, initiations, dons. Votre espace sacré, en ligne." gradient="from-amber-500 to-yellow-600" engines={engines} plans={plans} status="coming-soon" />;
}
